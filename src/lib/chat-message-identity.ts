/**
 * Shared chat message identity helpers.
 *
 * Provides utilities for extracting IDs, nonces, timestamps, and content
 * signatures from ChatMessage objects, abstracting over the various field
 * name conventions used by different server backends.
 */

import type { ChatMessage } from '../screens/chat/types'
import { stripFinalTags } from './chat-content-normalization'

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Extract a stable message ID from a ChatMessage, checking both
 * `id` and `messageId` fields.
 */
export function getMessageId(msg: ChatMessage | null | undefined): string | undefined {
  if (!msg) return undefined
  const id = (msg as { id?: string }).id
  if (typeof id === 'string' && id.trim().length > 0) return id
  const messageId = (msg as { messageId?: string }).messageId
  if (typeof messageId === 'string' && messageId.trim().length > 0) return messageId
  return undefined
}

/**
 * Extract the client-side nonce/idempotency key from a message,
 * checking `clientId`, `client_id`, `nonce`, `idempotencyKey`.
 */
export function getClientNonce(msg: ChatMessage | null | undefined): string {
  if (!msg) return ''
  const raw = msg as Record<string, unknown>
  return (
    normalizeString(raw.clientId) ||
    normalizeString(raw.client_id) ||
    normalizeString(raw.nonce) ||
    normalizeString(raw.idempotencyKey)
  )
}

/**
 * Extract the event timestamp from a message, checking `createdAt`
 * and `timestamp` fields. Returns undefined if no valid time found.
 */
export function getMessageEventTime(msg: ChatMessage | null | undefined): number | undefined {
  if (!msg) return undefined
  const raw = msg as Record<string, unknown>
  for (const key of ['createdAt', 'timestamp'] as const) {
    const value = raw[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Date.parse(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return undefined
}

/**
 * Extract the internal receive timestamp from a message.
 */
export function getMessageReceiveTime(msg: ChatMessage | null | undefined): number | undefined {
  if (!msg) return undefined
  const value = (msg as Record<string, unknown>).__receiveTime
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/**
 * Build a content-based signature for a message, used to detect
 * duplicate messages across different delivery channels.
 *
 * The signature encodes role + content parts + attachments so
 * that two messages with the same visible content produce the
 * same signature regardless of metadata differences.
 */
export function messageMultipartSignature(msg: ChatMessage | null | undefined): string {
  if (!msg) return ''
  let content = Array.isArray(msg.content)
    ? msg.content
        .map((part) => {
          if (part.type === 'text') return `t:${String((part as any).text ?? '').trim()}`
          if (part.type === 'thinking') return `h:${String((part as any).thinking ?? '').trim()}`
          return `tc:${String((part as any).id ?? '')}:${String((part as any).name ?? '')}`
        })
        .join('|')
    : ''
  // Fallback: if content array is empty/missing, check top-level text fields
  // so that legacy-format messages still produce a meaningful signature.
  if (!content) {
    const raw = msg as Record<string, unknown>
    for (const key of ['text', 'body', 'message']) {
      const val = raw[key]
      if (typeof val === 'string' && val.trim().length > 0) {
        content = `t:${stripFinalTags(val.trim())}`
        break
      }
    }
  }
  const attachments = Array.isArray((msg as any).attachments)
    ? (msg as any).attachments
        .map((attachment: any) => `${String(attachment?.name ?? '')}:${String(attachment?.size ?? '')}:${String(attachment?.contentType ?? '')}`)
        .join('|')
    : ''
  return `${msg.role ?? 'unknown'}:${content}:${attachments}`
}
