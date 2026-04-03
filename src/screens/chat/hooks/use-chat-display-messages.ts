import { useMemo } from 'react'
import type { ChatMessage } from '../types'
import { textFromMessage } from '../utils'
import { stripQueuedWrapper } from '@/lib/strip-queued-wrapper'
import { normalizeMessageValue } from '@/lib/chat-content-normalization'

// ── Helper functions ─────────────────────────────────────────────

function getMessageStatusValue(message: ChatMessage): string {
  return normalizeMessageValue((message as Record<string, unknown>).status)
}

function getMessageTimestampValue(message: ChatMessage): number | null {
  const raw = message as Record<string, unknown>
  const candidates = [
    raw.timestamp,
    raw.__createdAt,
    raw.createdAt,
    raw.created_at,
  ]
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate < 1_000_000_000_000 ? candidate * 1000 : candidate
    }
    if (typeof candidate === 'string') {
      const parsed = Date.parse(candidate)
      if (!Number.isNaN(parsed)) return parsed
    }
  }
  return null
}

function getMessageAttachmentSignature(message: ChatMessage): string {
  if (!Array.isArray(message.attachments) || message.attachments.length === 0) {
    return ''
  }
  return message.attachments
    .map((attachment) => {
      const name = typeof attachment.name === 'string' ? attachment.name : ''
      const size = typeof attachment.size === 'number' ? String(attachment.size) : ''
      const type =
        typeof attachment.contentType === 'string'
          ? attachment.contentType
          : ''
      return `${name}:${size}:${type}`
    })
    .sort()
    .join('|')
}

function isOptimisticUserMessage(message: ChatMessage): boolean {
  const raw = message as Record<string, unknown>
  return (
    normalizeMessageValue(raw.__optimisticId).length > 0 ||
    ['sending', 'sent', 'done'].includes(getMessageStatusValue(message))
  )
}

function shouldCollapseTextDuplicate(
  existing: ChatMessage,
  candidate: ChatMessage,
): boolean {
  if (existing.role !== candidate.role) return false
  if (candidate.role === 'assistant') return true
  if (candidate.role !== 'user') return false

  const existingOptimistic = isOptimisticUserMessage(existing)
  const candidateOptimistic = isOptimisticUserMessage(candidate)
  if (existingOptimistic === candidateOptimistic) return false

  const existingTs = getMessageTimestampValue(existing)
  const candidateTs = getMessageTimestampValue(candidate)
  if (existingTs !== null && candidateTs !== null) {
    if (Math.abs(existingTs - candidateTs) > 15_000) return false
  }

  return (
    getMessageAttachmentSignature(existing) ===
    getMessageAttachmentSignature(candidate)
  )
}

function messageFallbackSignature(message: ChatMessage): string {
  const raw = message as Record<string, unknown>
  const timestamp = normalizeMessageValue(
    typeof raw.timestamp === 'number' ? String(raw.timestamp) : raw.timestamp,
  )

  const contentParts = Array.isArray(message.content)
    ? message.content
        .map((part: any) => {
          if (part.type === 'text') {
            return `t:${typeof part.text === 'string' ? part.text.trim() : ''}`
          }
          if (part.type === 'thinking') {
            return `th:${typeof (part).thinking === 'string' ? (part).thinking : ''}`
          }
          if (part.type === 'toolCall') {
            const toolPart = part
            return `tc:${toolPart.id ?? ''}:${toolPart.name ?? ''}`
          }
          return `p:${(part).type ?? ''}`
        })
        .join('|')
    : ''

  const attachments = Array.isArray(message.attachments)
    ? message.attachments
        .map((attachment) => {
          const name = typeof attachment.name === 'string' ? attachment.name : ''
          const size = typeof attachment.size === 'number' ? String(attachment.size) : ''
          const type =
            typeof attachment.contentType === 'string'
              ? attachment.contentType
              : ''
          return `${name}:${size}:${type}`
        })
        .join('|')
    : ''

  return `${message.role ?? 'unknown'}:${timestamp}:${contentParts}:${attachments}`
}

function stripQueuedWrapperFromUserMessage(message: ChatMessage): ChatMessage {
  if (message.role !== 'user') return message
  const text = textFromMessage(message)
  const cleanedText = stripQueuedWrapper(text)
  if (cleanedText === text) return message
  return {
    ...message,
    content: [{ type: 'text', text: cleanedText }],
    text: cleanedText,
    body: cleanedText,
    message: cleanedText,
  }
}

// ── Hook ─────────────────────────────────────────────────────────

export interface UseChatDisplayMessagesDeps {
  realtimeMessages: Array<ChatMessage>
  activeIsRealtimeStreaming: boolean
  activeRealtimeStreamingText: string
  realtimeStreamingThinking: string
  activeToolCalls: Array<{ name: string; phase: string; id?: string }>
}

export function useChatDisplayMessages(deps: UseChatDisplayMessagesDeps) {
  const displayMessages = useMemo(() => {
    const filtered = deps.realtimeMessages.filter((msg) => {
      if (msg.role === 'user') {
        const text = stripQueuedWrapper(textFromMessage(msg))
        if (text.startsWith('A subagent task')) return false
        return true
      }
      if (msg.role === 'assistant') {
        if (msg.__streamingStatus === 'streaming') return true
        if ((msg as any).__optimisticId && !msg.content?.length) return true
        if (textFromMessage(msg).trim().length > 0) return true
        const content = Array.isArray(msg.content) ? msg.content : []
        const hasToolCalls = content.some((part) => part.type === 'toolCall')
        const hasStreamToolCalls =
          Array.isArray((msg as any).__streamToolCalls) &&
          (msg as any).__streamToolCalls.length > 0
        return hasToolCalls || hasStreamToolCalls
      }
      return false
    })

    const sortedForDedup = [...filtered].sort((a, b) => {
      const aRaw = a as Record<string, unknown>
      const bRaw = b as Record<string, unknown>
      const aIsOptimistic =
        normalizeMessageValue(aRaw.__optimisticId).startsWith('opt-') &&
        !normalizeMessageValue(aRaw.id)
      const bIsOptimistic =
        normalizeMessageValue(bRaw.__optimisticId).startsWith('opt-') &&
        !normalizeMessageValue(bRaw.id)
      if (aIsOptimistic && !bIsOptimistic) return 1
      if (!aIsOptimistic && bIsOptimistic) return -1
      return 0
    })

    const seen = new Set<string>()
    const seenByText = new Map<string, ChatMessage>()
    const dedupedSet = new Set<ChatMessage>()
    for (const msg of sortedForDedup) {
      const raw = msg as Record<string, unknown>
      const rawOptimisticId = normalizeMessageValue(raw.__optimisticId)
      const bareOptimisticUuid = rawOptimisticId.startsWith('opt-')
        ? rawOptimisticId.slice(4)
        : ''
      const idCandidates = [
        normalizeMessageValue(raw.id),
        normalizeMessageValue(raw.messageId),
        normalizeMessageValue(raw.clientId),
        normalizeMessageValue(raw.client_id),
        normalizeMessageValue(raw.nonce),
        normalizeMessageValue(raw.idempotencyKey),
        bareOptimisticUuid,
        rawOptimisticId,
      ].filter(Boolean)

      const primaryKey =
        idCandidates.length > 0
          ? `${msg.role}:id:${idCandidates[0]}`
          : `${msg.role}:fallback:${messageFallbackSignature(msg)}`

      if (seen.has(primaryKey)) continue

      const text = stripQueuedWrapper(textFromMessage(msg)).trim()
      if (text.length > 0) {
        const normalizedText = text.replace(/\s+/g, ' ')
        const textKey = `${msg.role}:text:${normalizedText}`
        const existingTextMatch = seenByText.get(textKey)
        if (
          existingTextMatch &&
          shouldCollapseTextDuplicate(existingTextMatch, msg)
        ) {
          continue
        }
        if (!existingTextMatch) {
          seenByText.set(textKey, msg)
        }
      }

      seen.add(primaryKey)
      for (const candidate of idCandidates.slice(1)) {
        seen.add(`${msg.role}:id:${candidate}`)
      }
      dedupedSet.add(msg)
    }

    const deduped = filtered
      .filter((msg) => dedupedSet.has(msg))
      .map((msg) => stripQueuedWrapperFromUserMessage(msg))

    if (!deps.activeIsRealtimeStreaming) {
      return deduped
    }

    const nextMessages = [...deduped]
    const streamToolCalls = deps.activeToolCalls.map((toolCall) => ({
      ...toolCall,
      phase: toolCall.phase,
    }))

    const streamingMsg = {
      role: 'assistant',
      content: [],
      __optimisticId: 'streaming-current',
      __streamingStatus: 'streaming',
      __streamingText: deps.activeRealtimeStreamingText,
      __streamingThinking: deps.realtimeStreamingThinking,
      __streamToolCalls: streamToolCalls,
    } as ChatMessage

    const existingStreamIdx = nextMessages.findIndex(
      (message) => message.__streamingStatus === 'streaming',
    )

    if (existingStreamIdx >= 0) {
      nextMessages[existingStreamIdx] = {
        ...nextMessages[existingStreamIdx],
        ...streamingMsg,
      }
      return nextMessages
    }

    const lastUserIdx = nextMessages.reduce(
      (lastIdx, msg, idx) => (msg.role === 'user' ? idx : lastIdx),
      -1,
    )
    if (lastUserIdx >= 0 && lastUserIdx === nextMessages.length - 1) {
      nextMessages.push(streamingMsg)
    } else if (lastUserIdx >= 0) {
      nextMessages.splice(lastUserIdx + 1, 0, streamingMsg)
    } else {
      nextMessages.push(streamingMsg)
    }
    return nextMessages
  }, [
    deps.activeToolCalls,
    deps.activeIsRealtimeStreaming,
    deps.activeRealtimeStreamingText,
    deps.realtimeMessages,
    deps.realtimeStreamingThinking,
  ])

  return { displayMessages }
}
