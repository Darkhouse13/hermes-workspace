import type {
  ChatMessage,
  MessageContent,
  TextContent,
} from '../screens/chat/types'
import { stripFinalTags } from './chat-content-normalization'
import {
  getMessageId,
  getClientNonce,
  getMessageEventTime,
  getMessageReceiveTime,
  messageMultipartSignature,
} from './chat-message-identity'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function getMessageHistoryIndex(msg: ChatMessage | null | undefined): number | undefined {
  if (!msg) return undefined
  const value = (msg as Record<string, unknown>).__historyIndex
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function getMessageRealtimeSequence(
  msg: ChatMessage | null | undefined,
): number | undefined {
  if (!msg) return undefined
  const value = (msg as Record<string, unknown>).__realtimeSequence
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export function hasToolCalls(msg: ChatMessage | null | undefined): boolean {
  if (!msg) return false
  if (Array.isArray(msg.content)) {
    const contentHasToolCalls = msg.content.some((part) => part.type === 'toolCall')
    if (contentHasToolCalls) return true
  }

  const raw = msg as Record<string, unknown>
  return (
    (Array.isArray(raw.streamToolCalls) && raw.streamToolCalls.length > 0) ||
    (Array.isArray(raw.__streamToolCalls) && raw.__streamToolCalls.length > 0)
  )
}

function getMessageChronologyRank(msg: ChatMessage): number {
  const role = normalizeString(msg.role).toLowerCase()
  if (role === 'user') return 0
  if (role === 'assistant' && hasToolCalls(msg)) return 1
  if (role === 'tool' || role === 'toolresult' || role === 'tool_result') return 2
  if (role === 'assistant') return 3
  return 4
}

function compareMessagesByTime(left: ChatMessage, right: ChatMessage): number {
  const leftTime = getMessageEventTime(left) ?? getMessageReceiveTime(left) ?? 0
  const rightTime = getMessageEventTime(right) ?? getMessageReceiveTime(right) ?? 0
  if (leftTime !== rightTime) return leftTime - rightTime

  const leftRank = getMessageChronologyRank(left)
  const rightRank = getMessageChronologyRank(right)
  if (leftRank !== rightRank) return leftRank - rightRank

  const leftHistoryIndex = getMessageHistoryIndex(left)
  const rightHistoryIndex = getMessageHistoryIndex(right)
  if (
    leftHistoryIndex !== undefined &&
    rightHistoryIndex !== undefined &&
    leftHistoryIndex !== rightHistoryIndex
  ) {
    return leftHistoryIndex - rightHistoryIndex
  }

  const leftRealtimeSequence = getMessageRealtimeSequence(left)
  const rightRealtimeSequence = getMessageRealtimeSequence(right)
  if (
    leftRealtimeSequence !== undefined &&
    rightRealtimeSequence !== undefined &&
    leftRealtimeSequence !== rightRealtimeSequence
  ) {
    return leftRealtimeSequence - rightRealtimeSequence
  }

  const leftId = getMessageId(left) ?? ''
  const rightId = getMessageId(right) ?? ''
  return leftId.localeCompare(rightId)
}

export function sortMessagesChronologically(
  messages: Array<ChatMessage>,
): Array<ChatMessage> {
  return messages
    .map((message, index) => ({ message, index }))
    .sort((left, right) => {
      const byTime = compareMessagesByTime(left.message, right.message)
      if (byTime !== 0) return byTime
      return left.index - right.index
    })
    .map(({ message }) => message)
}

export function isExternalInboundUserSource(source: unknown): boolean {
  const normalized = normalizeString(source).toLowerCase()
  return normalized === 'webchat' || normalized === 'signal' || normalized === 'telegram'
}

export function getAttachmentSignature(msg: ChatMessage | null | undefined): string {
  if (!msg) return ''
  const attachments = Array.isArray((msg as any).attachments)
    ? ((msg as any).attachments as Array<Record<string, unknown>>)
    : []
  if (attachments.length === 0) return ''
  return attachments
    .map((attachment) => {
      return `${normalizeString(attachment.name)}:${String(attachment.size ?? '')}`
    })
    .sort()
    .join('|')
}

export function isOptimisticUserCandidate(msg: ChatMessage | null | undefined): boolean {
  if (!msg || msg.role !== 'user') return false
  const raw = msg as Record<string, unknown>
  return (
    normalizeString(raw.__optimisticId).length > 0 ||
    ['sending', 'queued', 'sent', 'done'].includes(normalizeString(raw.status))
  )
}

// ---------------------------------------------------------------------------
// Text extraction
// ---------------------------------------------------------------------------

function extractTextFromContent(
  content: Array<MessageContent> | undefined,
): string {
  if (!content || !Array.isArray(content)) return ''
  return stripFinalTags(
    content
      .filter(
        (c): c is TextContent =>
          c.type === 'text' && typeof (c as any).text === 'string',
      )
      .map((c) => c.text)
      .join('\n')
      .trim(),
  )
}

/**
 * Extract text from a ChatMessage using multiple strategies:
 *   1. content array (canonical format)
 *   2. top-level text/body/message fields (legacy / some server adapters)
 */
export function extractMessageText(msg: ChatMessage | null | undefined): string {
  if (!msg) return ''
  const fromContent = extractTextFromContent(msg.content)
  if (fromContent.length > 0) return fromContent

  const raw = msg as Record<string, unknown>
  for (const key of ['text', 'body', 'message']) {
    const val = raw[key]
    if (typeof val === 'string' && val.trim().length > 0) return stripFinalTags(val.trim())
  }
  return ''
}

// ---------------------------------------------------------------------------
// Dedup: find optimistic message index
// ---------------------------------------------------------------------------

export function findOptimisticIndex(
  normalizedMessage: ChatMessage,
  sessionMessages: ChatMessage[],
): number {
  const newClientNonce = getClientNonce(normalizedMessage)

  const optimisticIndexByNonce =
    newClientNonce.length > 0
      ? sessionMessages.findIndex((existing) => {
          if (existing.role !== normalizedMessage.role) return false
          const existingNonce = getClientNonce(existing)
          if (existingNonce.length === 0 || existingNonce !== newClientNonce) {
            return false
          }
          return (
            normalizeString((existing as any).status) === 'sending' ||
            Boolean((existing as any).__optimisticId)
          )
        })
      : -1

  if (optimisticIndexByNonce >= 0) return optimisticIndexByNonce

  if (normalizedMessage.role === 'user') {
    return sessionMessages.findIndex((existing) => {
      if (existing.role !== 'user') return false
      if (!isOptimisticUserCandidate(existing)) return false
      const existingText = extractMessageText(existing)
      const incomingText = extractMessageText(normalizedMessage)
      if (existingText && incomingText && existingText === incomingText) {
        return true
      }
      const existingAttachments = getAttachmentSignature(existing)
      const incomingAttachments = getAttachmentSignature(normalizedMessage)
      return (
        existingText.length === 0 &&
        incomingText.length === 0 &&
        existingAttachments.length > 0 &&
        existingAttachments === incomingAttachments
      )
    })
  }

  return -1
}

// ---------------------------------------------------------------------------
// Dedup: find duplicate message index (7-factor)
// ---------------------------------------------------------------------------

export function findDuplicateIndex(
  normalizedMessage: ChatMessage,
  sessionMessages: ChatMessage[],
): number {
  const newId = getMessageId(normalizedMessage)
  const newClientNonce = getClientNonce(normalizedMessage)
  const newMultipartSignature = messageMultipartSignature(normalizedMessage)
  const newPlainText = extractMessageText(normalizedMessage)

  return sessionMessages.findIndex((existing) => {
    if (existing.role !== normalizedMessage.role) return false

    // Factor 1: ID-based dedup
    const existingId = getMessageId(existing)
    if (newId && existingId && newId === existingId) return true

    // Factor 2: Nonce/idempotency key dedup
    const existingNonce = getClientNonce(existing)
    if (newClientNonce && existingNonce && newClientNonce === existingNonce) {
      return true
    }

    // Factor 3: Multipart content signature dedup
    if (
      newMultipartSignature.length > 0 &&
      newMultipartSignature === messageMultipartSignature(existing)
    ) {
      return true
    }

    // Factor 4: Content-text dedup (assistant messages only, > 20 chars)
    if (
      normalizedMessage.role === 'assistant' &&
      newPlainText.length > 20 &&
      newPlainText === extractMessageText(existing)
    ) {
      return true
    }

    return false
  })
}

// ---------------------------------------------------------------------------
// Dedup: merge optimistic message with incoming
// ---------------------------------------------------------------------------

export function mergeOptimisticMessage(
  optimisticMessage: ChatMessage,
  incomingMessage: ChatMessage,
): ChatMessage {
  const incomingText = extractMessageText(incomingMessage)
  const optimisticText = extractMessageText(optimisticMessage)
  const incomingHasAttachments =
    Array.isArray((incomingMessage as any).attachments) &&
    (incomingMessage as any).attachments.length > 0
  const optimisticHasAttachments =
    Array.isArray((optimisticMessage as any).attachments) &&
    (optimisticMessage as any).attachments.length > 0

  return {
    ...optimisticMessage,
    ...incomingMessage,
    content:
      incomingText.length > 0 || !optimisticText.length
        ? incomingMessage.content
        : optimisticMessage.content,
    attachments:
      incomingHasAttachments || !optimisticHasAttachments
        ? incomingMessage.attachments
        : optimisticMessage.attachments,
    __optimisticId: undefined,
    status: undefined,
  }
}

// ---------------------------------------------------------------------------
// Dedup: external inbound duplicate check
// ---------------------------------------------------------------------------

export function hasRecentExternalDuplicate(
  normalizedMessage: ChatMessage,
  sessionMessages: ChatMessage[],
  isExternalSource: boolean,
  eventTime: number,
): boolean {
  if (!isExternalSource) return false
  const newPlainText = extractMessageText(normalizedMessage)
  if (newPlainText.length === 0) return false

  return sessionMessages.some((existing) => {
    if (existing.role !== 'user') return false
    if (extractMessageText(existing) !== newPlainText) return false
    const existingEventTime =
      getMessageEventTime(existing) ?? getMessageReceiveTime(existing)
    if (existingEventTime === undefined) return false
    return Math.abs(eventTime - existingEventTime) <= 10_000
  })
}

// ---------------------------------------------------------------------------
// Dedup: done-event duplicate check
// ---------------------------------------------------------------------------

export function findDoneEventDuplicateIndex(
  completeMessage: ChatMessage,
  sessionMessages: ChatMessage[],
): number {
  const completeText = extractMessageText(completeMessage)
  const completeId = getMessageId(completeMessage)

  return sessionMessages.findIndex((existing) => {
    if (existing.role !== 'assistant') return false
    const existingId = getMessageId(existing)
    if (completeId && existingId && completeId === existingId) return true
    if (completeText && completeText === extractMessageText(existing)) return true
    return false
  })
}

// ---------------------------------------------------------------------------
// History merge: match realtime messages with history
// ---------------------------------------------------------------------------

export function matchesRealtimeMessage(
  histMsg: ChatMessage,
  rtMsg: ChatMessage,
): boolean {
  const rtId = getMessageId(rtMsg)
  const rtText = extractMessageText(rtMsg)
  const rtNonce = getClientNonce(rtMsg)
  const rtSignature = messageMultipartSignature(rtMsg)
  const histId = getMessageId(histMsg)

  // Factor 1: ID match
  if (rtId && histId && rtId === histId) {
    return true
  }

  // Factor 2: Nonce match
  const histNonce = getClientNonce(histMsg)
  if (rtNonce && histNonce && rtNonce === histNonce) {
    return true
  }

  // Factor 3: Text content match
  if (histMsg.role === rtMsg.role && rtText) {
    const histText = extractMessageText(histMsg)
    if (histText === rtText) return true
  }

  // Factor 4: Optimistic message matching
  const histRaw = histMsg as Record<string, unknown>
  const histIsOptimistic =
    normalizeString(histRaw.status) === 'sending' ||
    normalizeString(histRaw.__optimisticId).length > 0

  if (histIsOptimistic && histMsg.role === rtMsg.role) {
    if (rtText) {
      const histText = extractMessageText(histMsg)
      if (histText === rtText) return true
      if (histText && rtText.startsWith(histText)) return true
    }
    // Factor 5: Attachment matching for optimistic
    const rtAttachments = Array.isArray((rtMsg as any).attachments)
      ? (rtMsg as any).attachments as Array<Record<string, unknown>>
      : []
    const histAttachments = Array.isArray((histMsg as any).attachments)
      ? (histMsg as any).attachments as Array<Record<string, unknown>>
      : []
    if (
      rtAttachments.length > 0 &&
      rtAttachments.length == histAttachments.length
    ) {
      const rtSig = rtAttachments
        .map(
          (a) =>
            `${normalizeString(a.name)}:${String(a.size ?? '')}`,
        )
        .sort()
        .join('|')
      const histSig = histAttachments
        .map(
          (a) =>
            `${normalizeString(a.name)}:${String(a.size ?? '')}`,
        )
        .sort()
        .join('|')
      if (rtSig && rtSig === histSig) return true
    }
  }

  // Factor 6 & 7: Multipart signature match
  return (
    rtSignature.length > 0 &&
    rtSignature === messageMultipartSignature(histMsg)
  )
}

// ---------------------------------------------------------------------------
// History merge: merge realtime assistant metadata onto history message
// ---------------------------------------------------------------------------

export function mergeRealtimeAssistantMetadata(
  historyMessage: ChatMessage,
  realtimeMessage: ChatMessage,
): ChatMessage {
  if (historyMessage.role !== 'assistant' || realtimeMessage.role !== 'assistant') {
    return historyMessage
  }

  const realtimeToolCalls = Array.isArray((realtimeMessage as any).__streamToolCalls)
    ? (realtimeMessage as any).__streamToolCalls
    : []
  const historyToolCalls = Array.isArray((historyMessage as any).__streamToolCalls)
    ? (historyMessage as any).__streamToolCalls
    : []
  const historyStreamToolCalls = Array.isArray((historyMessage as any).streamToolCalls)
    ? (historyMessage as any).streamToolCalls
    : []

  if (
    realtimeToolCalls.length === 0 ||
    historyToolCalls.length > 0 ||
    historyStreamToolCalls.length > 0
  ) {
    return historyMessage
  }

  return {
    ...historyMessage,
    __streamToolCalls: realtimeToolCalls,
    streamToolCalls: realtimeToolCalls,
  }
}

export function ensureAssistantTextContent(msg: ChatMessage): ChatMessage {
  if (msg.role !== 'assistant') return msg
  if (Array.isArray(msg.content) && msg.content.length > 0) return msg

  const text = extractMessageText(msg)
  if (!text) return msg

  return {
    ...msg,
    content: [{ type: 'text', text } as TextContent],
  }
}
