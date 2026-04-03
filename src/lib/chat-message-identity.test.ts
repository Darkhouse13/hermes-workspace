import { describe, expect, it } from 'vitest'
import type { ChatMessage } from '../screens/chat/types'
import {
  getMessageId,
  getClientNonce,
  getMessageEventTime,
  getMessageReceiveTime,
  messageMultipartSignature,
} from './chat-message-identity'

function msg(overrides: Partial<ChatMessage> & { role: string }): ChatMessage {
  return { content: [], ...overrides } as ChatMessage
}

function textMsg(role: string, text: string, extra?: Record<string, unknown>): ChatMessage {
  return {
    role,
    content: [{ type: 'text', text }],
    ...extra,
  } as ChatMessage
}

// ---------------------------------------------------------------------------
// getMessageId
// ---------------------------------------------------------------------------

describe('getMessageId', () => {
  it('returns id when present', () => {
    expect(getMessageId(msg({ role: 'user', id: 'abc-123' }))).toBe('abc-123')
  })

  it('returns messageId when id is absent', () => {
    expect(getMessageId(msg({ role: 'user', messageId: 'msg-456' }))).toBe('msg-456')
  })

  it('prefers id over messageId', () => {
    expect(getMessageId(msg({ role: 'user', id: 'id-1', messageId: 'mid-2' }))).toBe('id-1')
  })

  it('returns undefined for null', () => {
    expect(getMessageId(null)).toBeUndefined()
  })

  it('returns undefined for undefined', () => {
    expect(getMessageId(undefined)).toBeUndefined()
  })

  it('returns undefined when id is empty string', () => {
    expect(getMessageId(msg({ role: 'user', id: '' }))).toBeUndefined()
  })

  it('returns undefined when id is whitespace only', () => {
    expect(getMessageId(msg({ role: 'user', id: '   ' }))).toBeUndefined()
  })

  it('returns messageId when id is whitespace', () => {
    expect(getMessageId(msg({ role: 'user', id: '  ', messageId: 'valid' }))).toBe('valid')
  })

  it('returns undefined when both id and messageId are empty', () => {
    expect(getMessageId(msg({ role: 'user', id: '', messageId: '' }))).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// getClientNonce
// ---------------------------------------------------------------------------

describe('getClientNonce', () => {
  it('returns clientId when present', () => {
    expect(getClientNonce(msg({ role: 'user', clientId: 'cid-1' }))).toBe('cid-1')
  })

  it('returns client_id when clientId is absent', () => {
    expect(getClientNonce(msg({ role: 'user', client_id: 'cid-2' }))).toBe('cid-2')
  })

  it('returns nonce when other fields absent', () => {
    expect(getClientNonce(msg({ role: 'user', nonce: 'n-1' }))).toBe('n-1')
  })

  it('returns idempotencyKey as last fallback', () => {
    expect(getClientNonce(msg({ role: 'user', idempotencyKey: 'ik-1' }))).toBe('ik-1')
  })

  it('prefers clientId over nonce', () => {
    expect(getClientNonce(msg({ role: 'user', clientId: 'cid', nonce: 'n' }))).toBe('cid')
  })

  it('returns empty string for null', () => {
    expect(getClientNonce(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(getClientNonce(undefined)).toBe('')
  })

  it('returns empty string when no nonce fields exist', () => {
    expect(getClientNonce(msg({ role: 'user' }))).toBe('')
  })

  it('skips empty string fields', () => {
    expect(getClientNonce(msg({ role: 'user', clientId: '', nonce: 'valid' }))).toBe('valid')
  })

  it('trims whitespace from nonce values', () => {
    expect(getClientNonce(msg({ role: 'user', nonce: '  trimmed  ' }))).toBe('trimmed')
  })
})

// ---------------------------------------------------------------------------
// getMessageEventTime
// ---------------------------------------------------------------------------

describe('getMessageEventTime', () => {
  it('returns createdAt when it is a number', () => {
    expect(getMessageEventTime(msg({ role: 'user', createdAt: 1700000000 }))).toBe(1700000000)
  })

  it('returns timestamp when createdAt is absent', () => {
    expect(getMessageEventTime(msg({ role: 'user', timestamp: 1700000001 }))).toBe(1700000001)
  })

  it('prefers createdAt over timestamp', () => {
    expect(getMessageEventTime(msg({ role: 'user', createdAt: 100, timestamp: 200 }))).toBe(100)
  })

  it('parses string dates', () => {
    const result = getMessageEventTime(msg({ role: 'user', createdAt: '2024-01-01T00:00:00Z' }))
    expect(result).toBe(Date.parse('2024-01-01T00:00:00Z'))
  })

  it('returns undefined for null', () => {
    expect(getMessageEventTime(null)).toBeUndefined()
  })

  it('returns undefined for undefined', () => {
    expect(getMessageEventTime(undefined)).toBeUndefined()
  })

  it('returns undefined when no time fields exist', () => {
    expect(getMessageEventTime(msg({ role: 'user' }))).toBeUndefined()
  })

  it('ignores NaN values', () => {
    expect(getMessageEventTime(msg({ role: 'user', createdAt: NaN }))).toBeUndefined()
  })

  it('ignores Infinity values', () => {
    expect(getMessageEventTime(msg({ role: 'user', createdAt: Infinity }))).toBeUndefined()
  })

  it('ignores empty string dates', () => {
    expect(getMessageEventTime(msg({ role: 'user', createdAt: '' }))).toBeUndefined()
  })

  it('ignores invalid date strings', () => {
    expect(getMessageEventTime(msg({ role: 'user', createdAt: 'not-a-date' }))).toBeUndefined()
  })

  it('falls back to timestamp when createdAt is invalid', () => {
    expect(getMessageEventTime(msg({ role: 'user', createdAt: NaN, timestamp: 999 }))).toBe(999)
  })
})

// ---------------------------------------------------------------------------
// getMessageReceiveTime
// ---------------------------------------------------------------------------

describe('getMessageReceiveTime', () => {
  it('returns __receiveTime when present', () => {
    expect(getMessageReceiveTime(msg({ role: 'user', __receiveTime: 42 }))).toBe(42)
  })

  it('returns undefined for null message', () => {
    expect(getMessageReceiveTime(null)).toBeUndefined()
  })

  it('returns undefined for undefined message', () => {
    expect(getMessageReceiveTime(undefined)).toBeUndefined()
  })

  it('returns undefined when __receiveTime is missing', () => {
    expect(getMessageReceiveTime(msg({ role: 'user' }))).toBeUndefined()
  })

  it('returns undefined when __receiveTime is not a number', () => {
    expect(getMessageReceiveTime(msg({ role: 'user', __receiveTime: 'string' as unknown as number }))).toBeUndefined()
  })

  it('returns undefined when __receiveTime is NaN', () => {
    expect(getMessageReceiveTime(msg({ role: 'user', __receiveTime: NaN }))).toBeUndefined()
  })

  it('returns undefined when __receiveTime is Infinity', () => {
    expect(getMessageReceiveTime(msg({ role: 'user', __receiveTime: Infinity }))).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// messageMultipartSignature
// ---------------------------------------------------------------------------

describe('messageMultipartSignature', () => {
  it('returns empty string for null', () => {
    expect(messageMultipartSignature(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(messageMultipartSignature(undefined)).toBe('')
  })

  it('encodes text content parts', () => {
    const sig = messageMultipartSignature(textMsg('user', 'hello'))
    expect(sig).toBe('user:t:hello:')
  })

  it('encodes thinking content parts', () => {
    const m = msg({
      role: 'assistant',
      content: [{ type: 'thinking', thinking: 'hmm' }],
    } as any)
    const sig = messageMultipartSignature(m)
    expect(sig).toBe('assistant:h:hmm:')
  })

  it('encodes toolCall content parts', () => {
    const m = msg({
      role: 'assistant',
      content: [{ type: 'toolCall', id: 'tc-1', name: 'exec' }],
    } as any)
    const sig = messageMultipartSignature(m)
    expect(sig).toBe('assistant:tc:tc-1:exec:')
  })

  it('encodes unknown part types', () => {
    const m = msg({
      role: 'assistant',
      content: [{ type: 'image' }],
    } as any)
    const sig = messageMultipartSignature(m)
    expect(sig).toBe('assistant:p:image:')
  })

  it('joins multiple parts with pipe', () => {
    const m = msg({
      role: 'assistant',
      content: [
        { type: 'thinking', thinking: 'let me think' },
        { type: 'text', text: 'result' },
      ],
    } as any)
    const sig = messageMultipartSignature(m)
    expect(sig).toBe('assistant:h:let me think|t:result:')
  })

  it('falls back to top-level text field when content is empty', () => {
    const m = { role: 'user', content: [], text: 'fallback text' } as any
    // content array is empty but present; the map returns '' which is falsy
    // so it falls back to the top-level text field
    const sig = messageMultipartSignature(m)
    expect(sig).toContain('t:fallback text')
  })

  it('falls back to body field', () => {
    const m = { role: 'user', content: [], body: 'body text' } as any
    const sig = messageMultipartSignature(m)
    expect(sig).toContain('t:body text')
  })

  it('includes attachment info', () => {
    const m = msg({
      role: 'user',
      attachments: [{ name: 'file.txt', size: 100, contentType: 'text/plain' }],
    } as any)
    const sig = messageMultipartSignature(m)
    expect(sig).toContain('file.txt:100:text/plain')
  })

  it('uses "unknown" role when role is undefined', () => {
    const m = { content: [{ type: 'text', text: 'x' }] } as any
    const sig = messageMultipartSignature(m)
    expect(sig).toMatch(/^unknown:/)
  })

  it('trims text content', () => {
    const sig = messageMultipartSignature(textMsg('user', '  spaced  '))
    expect(sig).toBe('user:t:spaced:')
  })

  it('produces same signature for identical messages', () => {
    const a = textMsg('user', 'hello world')
    const b = textMsg('user', 'hello world')
    expect(messageMultipartSignature(a)).toBe(messageMultipartSignature(b))
  })

  it('produces different signatures for different roles', () => {
    const a = textMsg('user', 'hello')
    const b = textMsg('assistant', 'hello')
    expect(messageMultipartSignature(a)).not.toBe(messageMultipartSignature(b))
  })
})
