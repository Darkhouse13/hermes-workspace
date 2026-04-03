import { create } from 'zustand'
import type {
  ChatMessage,
  StreamToolCall,
} from '../screens/chat/types'
import { stripFinalTags } from '../lib/chat-content-normalization'
import {
  getMessageEventTime,
} from '../lib/chat-message-identity'
import {
  sortMessagesChronologically,
  isExternalInboundUserSource,
  extractMessageText,
  findOptimisticIndex,
  findDuplicateIndex,
  mergeOptimisticMessage,
  hasRecentExternalDuplicate,
  findDoneEventDuplicateIndex,
  matchesRealtimeMessage,
  mergeRealtimeAssistantMetadata,
} from '../lib/chat-message-dedup'
import { finalizeStreamingMessage } from '../lib/chat-streaming-assembly'

let _streamingPersistTimer: ReturnType<typeof setTimeout> | null = null

export type ChatStreamEvent =
  | {
      type: 'message'
      message: ChatMessage
      sessionKey: string
      runId?: string
      transport?: 'chat-events' | 'send-stream'
    }
  | {
      type: 'chunk'
      text: string
      runId?: string
      sessionKey: string
      fullReplace?: boolean
      transport?: 'chat-events' | 'send-stream'
    }
  | {
      type: 'thinking'
      text: string
      runId?: string
      sessionKey: string
      transport?: 'chat-events' | 'send-stream'
    }
  | {
      type: 'tool'
      phase: StreamToolCall['phase']
      name: string
      toolCallId?: string
      args?: unknown
      result?: string
      runId?: string
      sessionKey: string
      transport?: 'chat-events' | 'send-stream'
    }
  | {
      type: 'done'
      state: string
      errorMessage?: string
      runId?: string
      sessionKey: string
      message?: ChatMessage
      transport?: 'chat-events' | 'send-stream'
    }
  | {
      type: 'user_message'
      message: ChatMessage
      sessionKey: string
      source?: string
      runId?: string
      transport?: 'chat-events' | 'send-stream'
    }
  | {
      type: 'status' | 'lifecycle'
      text: string
      sessionKey: string
      runId?: string
      transport?: 'chat-events' | 'send-stream'
    }

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'

export type StreamingState = {
  runId: string | null
  text: string
  thinking: string
  lifecycleEvents: Array<{
    text: string
    emoji: string
    timestamp: number
    isError: boolean
  }>
  toolCalls: StreamToolCall[]
}

type ChatState = {
  connectionState: ConnectionState
  lastError: string | null
  /** Messages received via real-time stream, keyed by sessionKey */
  realtimeMessages: Map<string, Array<ChatMessage>>
  /** Current streaming state per session */
  streamingState: Map<string, StreamingState>
  /** Timestamp of last received event */
  lastEventAt: number
  /**
   * RunIds currently being handled by send-stream (the active send SSE).
   * Server-side dedup is the primary defense. This client-side set remains as
   * a fallback in case a stale event slips through after transport issues.
   */
  sendStreamRunIds: Set<string>

  // Actions
  setConnectionState: (state: ConnectionState, error?: string) => void
  processEvent: (event: ChatStreamEvent) => void
  getRealtimeMessages: (sessionKey: string) => Array<ChatMessage>
  getStreamingState: (sessionKey: string) => StreamingState | null
  clearSession: (sessionKey: string) => void
  clearRealtimeBuffer: (sessionKey: string) => void
  clearStreamingSession: (sessionKey: string) => void
  clearAllStreaming: () => void
  mergeHistoryMessages: (
    sessionKey: string,
    historyMessages: Array<ChatMessage>,
  ) => Array<ChatMessage>
  /** Register a runId as being handled by send-stream — chat-events will skip it */
  registerSendStreamRun: (runId: string) => void
  /** Unregister a runId when send-stream completes */
  unregisterSendStreamRun: (runId: string) => void
  /** Check if a runId is being handled by send-stream */
  isSendStreamRun: (runId: string | undefined) => boolean
}

const createEmptyStreamingState = (): StreamingState => ({
  runId: null,
  text: '',
  thinking: '',
  lifecycleEvents: [],
  toolCalls: [],
})

function persistStreamingState(sessionKey: string, state: StreamingState): void {
  if (typeof sessionStorage === 'undefined') return
  if (_streamingPersistTimer) clearTimeout(_streamingPersistTimer)
  _streamingPersistTimer = setTimeout(() => {
    sessionStorage.setItem(
      `hermes_streaming_${sessionKey}`,
      JSON.stringify({ ...state, _savedAt: Date.now() }),
    )
  }, 500)
}

export function restoreStreamingState(sessionKey: string): StreamingState | null {
  if (typeof sessionStorage === 'undefined') return null

  const storageKey = `hermes_streaming_${sessionKey}`
  const raw = sessionStorage.getItem(storageKey)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as StreamingState & { _savedAt?: unknown }
    const savedAt =
      typeof parsed._savedAt === 'number' && Number.isFinite(parsed._savedAt)
        ? parsed._savedAt
        : null

    if (!savedAt || Date.now() - savedAt > 60_000) {
      sessionStorage.removeItem(storageKey)
      return null
    }

    const { _savedAt, ...streamingState } = parsed
    return streamingState
  } catch {
    sessionStorage.removeItem(storageKey)
    return null
  }
}

let realtimeMessageSequence = 0

const LIFECYCLE_PREFIX_EMOJIS = ['⏳', '⚠️', '🔄', '🗜️', '❌'] as const

function parseLifecycleEvent(text: string, timestamp: number): {
  text: string
  emoji: string
  timestamp: number
  isError: boolean
} {
  const trimmed = text.trim()
  const matchedEmoji =
    LIFECYCLE_PREFIX_EMOJIS.find((emoji) => trimmed.startsWith(emoji)) ?? ''
  const normalizedText = matchedEmoji
    ? trimmed.slice(matchedEmoji.length).trimStart()
    : trimmed
  const lowerText = normalizedText.toLowerCase()
  const isError =
    matchedEmoji === '❌' ||
    matchedEmoji === '⚠️' ||
    lowerText.includes('error') ||
    lowerText.includes('failed')

  return {
    text: normalizedText || trimmed,
    emoji: matchedEmoji,
    timestamp,
    isError,
  }
}

/**
 * Return a copy of `msg` with <final>...</final> tags stripped from all text
 * content blocks.  Other content types (thinking, toolCall, etc.) are left
 * untouched.  If the message has no text content the original object is
 * returned as-is so we don't allocate unnecessarily.
 */
function stripFinalTagsFromMessage(msg: ChatMessage): ChatMessage {
  let modified = false
  const rawMessage = msg as Record<string, unknown>
  const nextMessage: ChatMessage & Record<string, unknown> = { ...msg }

  if (Array.isArray(msg.content)) {
    const nextContent = msg.content.map((part) => {
      if (part.type !== 'text') return part
      const raw = part.text ?? ''
      const stripped = stripFinalTags(typeof raw === 'string' ? raw : String(raw))
      if (stripped === raw) return part
      modified = true
      return { ...part, text: stripped }
    })
    nextMessage.content = nextContent as typeof msg.content
  }

  for (const key of ['text', 'body', 'message'] as const) {
    const value = rawMessage[key]
    if (typeof value !== 'string') continue
    const stripped = stripFinalTags(value)
    if (stripped === value) continue
    nextMessage[key] = stripped
    modified = true
  }

  if (!modified) return msg
  return nextMessage
}


export const useChatStore = create<ChatState>((set, get) => ({
  connectionState: 'disconnected',
  lastError: null,
  realtimeMessages: new Map(),
  streamingState: new Map(),
  lastEventAt: 0,
  sendStreamRunIds: new Set(),

  setConnectionState: (connectionState, error) => {
    set({ connectionState, lastError: error ?? null })
  },

  registerSendStreamRun: (runId) => {
    const next = new Set(get().sendStreamRunIds)
    next.add(runId)
    set({ sendStreamRunIds: next })
  },

  unregisterSendStreamRun: (runId) => {
    const next = new Set(get().sendStreamRunIds)
    next.delete(runId)
    set({ sendStreamRunIds: next })
  },

  isSendStreamRun: (runId) => {
    if (!runId) return false
    return get().sendStreamRunIds.has(runId)
  },

  processEvent: (event) => {
    const state = get()
    const sessionKey = event.sessionKey
    const now = Date.now()

    // Skip ALL events for runs being handled by send-stream.
    // send-stream is the authoritative handler for active sends — chat-events
    // fires the same events in parallel, causing duplicate messages.
    // Previously only covered chunk/thinking/tool/done — missing 'message'
    // was the root cause of the persistent duplication bug.
    if (
      event.transport !== 'send-stream' &&
      event.runId &&
      get().sendStreamRunIds.has(event.runId)
    ) {
      return
    }

    switch (event.type) {
      case 'message':
      case 'user_message': {
        // Filter internal system event messages that should never appear in chat.
        // These are pre-compaction flushes, heartbeat prompts, and similar
        // server-injected control messages — mirror the filter in use-chat-history.ts.
        if (event.message.role === 'user') {
          const rawText = extractMessageText(event.message)
          if (
            rawText.startsWith('Pre-compaction memory flush') ||
            rawText.includes('Store durable memories now') ||
            rawText.includes('APPEND new content only and do not overwrite') ||
            rawText.startsWith('A subagent task') ||
            rawText.startsWith('[Queued announce messages') ||
            rawText.includes('Summarize this naturally for the user') ||
            (rawText.includes('Stats: runtime') && rawText.includes('sessionKey agent:'))
          ) {
            break
          }
        }

        const messages = new Map(state.realtimeMessages)
        const sessionMessages = [...(messages.get(sessionKey) ?? [])]
        const incomingReceiveTime = now

        // Strip <final>…</final> sentinel tags from assistant messages before
        // storing or comparing.  The server can emit a bare assistant-message
        // event (state=undefined) whose text is still wrapped in these tags,
        // and the subsequent clean `done` event then fails the dedup check
        // because the stored text differs from the final text.
        const normalizedMessage =
          event.message.role === 'assistant'
            ? stripFinalTagsFromMessage(event.message)
            : event.message

        const optimisticIndex = findOptimisticIndex(normalizedMessage, sessionMessages)
        const duplicateIndex = findDuplicateIndex(normalizedMessage, sessionMessages)

        const eventSource = event.type === 'user_message' ? event.source : undefined
        const isExternalInboundUser =
          normalizedMessage.role === 'user' && isExternalInboundUserSource(eventSource)
        const incomingEventTime =
          getMessageEventTime(normalizedMessage) ?? incomingReceiveTime

        // Mark user messages from external sources
        const incomingMessage: ChatMessage = {
          ...normalizedMessage,
          __realtimeSource: eventSource,
          __receiveTime: incomingReceiveTime,
          __realtimeSequence: realtimeMessageSequence++,
          status: undefined,
        }

        if (optimisticIndex >= 0) {
          sessionMessages[optimisticIndex] = mergeOptimisticMessage(
            sessionMessages[optimisticIndex],
            incomingMessage,
          )
          messages.set(sessionKey, sortMessagesChronologically(sessionMessages))
          set({ realtimeMessages: messages, lastEventAt: now })
          break
        }

        if (hasRecentExternalDuplicate(normalizedMessage, sessionMessages, isExternalInboundUser, incomingEventTime)) {
          break
        }

        if (duplicateIndex === -1) {
          sessionMessages.push(incomingMessage)
          messages.set(sessionKey, sortMessagesChronologically(sessionMessages))
          set({ realtimeMessages: messages, lastEventAt: now })
        }
        break
      }

      case 'chunk': {
        const streamingMap = new Map(state.streamingState)
        const prev =
          streamingMap.get(sessionKey) ?? createEmptyStreamingState()

        // Server sends full accumulated text with fullReplace=true
        // Replace entire text (default), or append if fullReplace is explicitly false
        const next: StreamingState = {
          ...prev,
          text: stripFinalTags(
            event.fullReplace === false ? prev.text + event.text : event.text,
          ),
          runId: event.runId ?? prev.runId,
        }

        streamingMap.set(sessionKey, next)
        set({ streamingState: streamingMap, lastEventAt: now })
        persistStreamingState(sessionKey, next)
        if (next.text.length <= 20) console.log('[chat-store:chunk] sessionKey=', sessionKey, 'text=', next.text)
        break
      }

      case 'thinking': {
        const streamingMap = new Map(state.streamingState)
        const prev =
          streamingMap.get(sessionKey) ?? createEmptyStreamingState()
        const next: StreamingState = {
          ...prev,
          thinking: event.text,
          runId: event.runId ?? prev.runId,
        }

        streamingMap.set(sessionKey, next)
        set({ streamingState: streamingMap, lastEventAt: now })
        persistStreamingState(sessionKey, next)
        break
      }

      case 'status':
      case 'lifecycle': {
        const streamingMap = new Map(state.streamingState)
        const prev =
          streamingMap.get(sessionKey) ?? createEmptyStreamingState()
        const next: StreamingState = {
          ...prev,
          runId: event.runId ?? prev.runId,
          lifecycleEvents: [
            ...prev.lifecycleEvents,
            parseLifecycleEvent(event.text, now),
          ],
        }

        streamingMap.set(sessionKey, next)
        set({ streamingState: streamingMap, lastEventAt: now })
        persistStreamingState(sessionKey, next)
        break
      }

      case 'tool': {
        const streamingMap = new Map(state.streamingState)
        const prev =
          streamingMap.get(sessionKey) ?? createEmptyStreamingState()

        const toolCallId =
          event.toolCallId ??
          `${event.name || 'tool'}-${event.runId || sessionKey}-${prev.toolCalls.length}`
        const existingToolIndex = prev.toolCalls.findIndex(
          (tc) => tc.id === toolCallId,
        )

        const nextToolCalls = [...prev.toolCalls]

        if (existingToolIndex >= 0) {
          nextToolCalls[existingToolIndex] = {
            ...nextToolCalls[existingToolIndex],
            phase: event.phase,
            args: event.args,
            result: event.result ?? nextToolCalls[existingToolIndex].result,
          }
        } else {
          // Create entry for ANY phase (complete, error, skill.loaded, artifact.created, etc.)
          // Events like skill.loaded arrive with phase 'complete' and no prior 'start' — create them too
          nextToolCalls.push({
            id: toolCallId,
            name: event.name,
            phase: event.phase,
            args: event.args,
            result: event.result,
          })
        }

        const next: StreamingState = {
          ...prev,
          runId: event.runId ?? prev.runId,
          toolCalls: nextToolCalls,
        }

        streamingMap.set(sessionKey, next)
        set({ streamingState: streamingMap, lastEventAt: now })
        persistStreamingState(sessionKey, next)
        break
      }

      case 'done': {
        const streamingMap = new Map(state.streamingState)
        const streaming = streamingMap.get(sessionKey)

        // DEBUG: trace done handler
        console.log('[chat-store:done] sessionKey=', sessionKey)
        console.log('[chat-store:done] streaming=', streaming ? { text: streaming.text.slice(0, 50), runId: streaming.runId } : null)
        console.log('[chat-store:done] event.message=', event.message ? 'present' : 'missing')
        console.log('[chat-store:done] streamingMap keys=', [...streamingMap.keys()])

        // Build the complete message — prefer authoritative final payload (bug #8 fix)
        const completeMessage = finalizeStreamingMessage(
          event.message,
          streaming,
          stripFinalTagsFromMessage,
          now,
          realtimeMessageSequence++,
        )

        console.log('[chat-store:done] completeMessage=', completeMessage ? { role: completeMessage.role, contentLen: JSON.stringify(completeMessage.content).length } : null)
        if (completeMessage) {
          const messages = new Map(state.realtimeMessages)
          const sessionMessages = [...(messages.get(sessionKey) ?? [])]

          const existingIdx = findDoneEventDuplicateIndex(completeMessage, sessionMessages)

          if (existingIdx === -1) {
            sessionMessages.push(completeMessage)
            messages.set(sessionKey, sortMessagesChronologically(sessionMessages))
            set({ realtimeMessages: messages })
          } else {
            // Replace tagged pre-final message with clean final version
            sessionMessages[existingIdx] = {
              ...sessionMessages[existingIdx],
              ...completeMessage,
            }
            messages.set(sessionKey, sortMessagesChronologically(sessionMessages))
            set({ realtimeMessages: messages })
          }
        }

        // Clear streaming state immediately — tool calls are preserved via
        // __streamToolCalls embedded on completeMessage above, so pills survive
        // in the history message without needing streaming state alive.
        // DO NOT keep a stub here — it keeps isRealtimeStreaming=true which
        // injects an invisible streaming placeholder that causes a blank gap.
        streamingMap.delete(sessionKey)
        set({ streamingState: streamingMap, lastEventAt: now })
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem(`hermes_streaming_${sessionKey}`)
        }
        break
      }
    }
  },

  getRealtimeMessages: (sessionKey) => {
    return get().realtimeMessages.get(sessionKey) ?? []
  },

  getStreamingState: (sessionKey) => {
    return get().streamingState.get(sessionKey) ?? null
  },

  clearSession: (sessionKey) => {
    const messages = new Map(get().realtimeMessages)
    const streaming = new Map(get().streamingState)
    messages.delete(sessionKey)
    streaming.delete(sessionKey)
    set({ realtimeMessages: messages, streamingState: streaming })
  },

  clearRealtimeBuffer: (sessionKey) => {
    const messages = new Map(get().realtimeMessages)
    messages.delete(sessionKey)
    set({ realtimeMessages: messages })
  },

  clearStreamingSession: (sessionKey) => {
    const streaming = new Map(get().streamingState)
    if (!streaming.has(sessionKey)) return
    streaming.delete(sessionKey)
    set({ streamingState: streaming })
  },

  clearAllStreaming: () => {
    if (get().streamingState.size === 0) return
    set({ streamingState: new Map() })
  },

  mergeHistoryMessages: (sessionKey, historyMessages) => {
    const realtimeMessages = get().realtimeMessages.get(sessionKey) ?? []

    if (realtimeMessages.length === 0) {
      return sortMessagesChronologically(historyMessages)
    }

    const mergedHistoryMessages = historyMessages.map((histMsg) => {
      const matchingRealtime = realtimeMessages.find((rtMsg) =>
        matchesRealtimeMessage(histMsg, rtMsg),
      )
      return matchingRealtime
        ? mergeRealtimeAssistantMetadata(histMsg, matchingRealtime)
        : histMsg
    })

    const newRealtimeMessages = realtimeMessages.filter(
      (rtMsg) =>
        !mergedHistoryMessages.some((histMsg) => matchesRealtimeMessage(histMsg, rtMsg)),
    )

    if (newRealtimeMessages.length === 0) {
      return sortMessagesChronologically(mergedHistoryMessages)
    }

    return sortMessagesChronologically([...mergedHistoryMessages, ...newRealtimeMessages])
  },
}))

