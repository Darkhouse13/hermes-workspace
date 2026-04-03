import { describe, expect, it } from 'vitest'
import type { ChatMessage } from '../screens/chat/types'
import {
  extractMessageText,
  findDuplicateIndex,
  findOptimisticIndex,
  mergeOptimisticMessage,
  hasRecentExternalDuplicate,
  findDoneEventDuplicateIndex,
  matchesRealtimeMessage,
  mergeRealtimeAssistantMetadata,
  sortMessagesChronologically,
  isExternalInboundUserSource,
  getAttachmentSignature,
  isOptimisticUserCandidate,
  ensureAssistantTextContent,
} from './chat-message-dedup'

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
// extractMessageText
// ---------------------------------------------------------------------------

describe('extractMessageText', () => {
  it('extracts text from content array', () => {
    expect(extractMessageText(textMsg('user', 'hello'))).toBe('hello')
  })

  it('extracts text from top-level text field', () => {
    expect(extractMessageText({ role: 'user', content: [], text: 'fallback' } as any)).toBe('fallback')
  })

  it('extracts text from top-level body field', () => {
    expect(extractMessageText({ role: 'user', content: [], body: 'body text' } as any)).toBe('body text')
  })

  it('strips <final> tags', () => {
    expect(extractMessageText(textMsg('assistant', '<final>hello</final>'))).toBe('hello')
  })

  it('returns empty string for null/undefined', () => {
    expect(extractMessageText(null)).toBe('')
    expect(extractMessageText(undefined)).toBe('')
  })
})

// ---------------------------------------------------------------------------
// findDuplicateIndex
// ---------------------------------------------------------------------------

describe('findDuplicateIndex', () => {
  it('detects ID-based duplicate', () => {
    const existing = [textMsg('assistant', 'hi', { id: 'msg-1' })]
    const incoming = textMsg('assistant', 'different text', { id: 'msg-1' })
    expect(findDuplicateIndex(incoming, existing)).toBe(0)
  })

  it('detects nonce-based duplicate', () => {
    // getClientNonce reads `nonce` field, not `clientNonce`
    const existing = [textMsg('user', 'hello', { nonce: 'nonce-1' })]
    const incoming = textMsg('user', 'hello again', { nonce: 'nonce-1' })
    expect(findDuplicateIndex(incoming, existing)).toBe(0)
  })

  it('detects content-text duplicate for assistant messages > 20 chars', () => {
    const longText = 'This is a long enough text to trigger content dedup.'
    const existing = [textMsg('assistant', longText, { id: 'old-id' })]
    const incoming = textMsg('assistant', longText, { id: 'new-id' })
    expect(findDuplicateIndex(incoming, existing)).toBe(0)
  })

  it('dedup matches short assistant messages via multipart signature', () => {
    // Same content array produces same multipart signature (factor 3)
    const existing = [textMsg('assistant', 'ok', { id: 'old' })]
    const incoming = textMsg('assistant', 'ok', { id: 'new' })
    expect(findDuplicateIndex(incoming, existing)).toBe(0)
  })

  it('dedup matches user messages via multipart signature', () => {
    // Same content array produces same multipart signature (factor 3)
    const longText = 'This is a long enough text to trigger content dedup.'
    const existing = [textMsg('user', longText, { id: 'old' })]
    const incoming = textMsg('user', longText, { id: 'new' })
    expect(findDuplicateIndex(incoming, existing)).toBe(0)
  })

  it('does NOT match across roles', () => {
    const existing = [textMsg('user', 'hello', { id: 'msg-1' })]
    const incoming = textMsg('assistant', 'hello', { id: 'msg-1' })
    expect(findDuplicateIndex(incoming, existing)).toBe(-1)
  })

  it('returns -1 for no duplicates', () => {
    const existing = [textMsg('assistant', 'one')]
    const incoming = textMsg('assistant', 'two')
    expect(findDuplicateIndex(incoming, existing)).toBe(-1)
  })
})

// ---------------------------------------------------------------------------
// findOptimisticIndex
// ---------------------------------------------------------------------------

describe('findOptimisticIndex', () => {
  it('matches by nonce with sending status', () => {
    const existing = [
      textMsg('user', 'hello', { clientNonce: 'n1', status: 'sending' }),
    ]
    const incoming = textMsg('user', 'hello', { clientNonce: 'n1' })
    expect(findOptimisticIndex(incoming, existing)).toBe(0)
  })

  it('matches by nonce with __optimisticId', () => {
    const existing = [
      textMsg('user', 'hello', { clientNonce: 'n1', __optimisticId: 'opt-1' }),
    ]
    const incoming = textMsg('user', 'hello', { clientNonce: 'n1' })
    expect(findOptimisticIndex(incoming, existing)).toBe(0)
  })

  it('falls back to text matching for optimistic user messages', () => {
    const existing = [
      textMsg('user', 'hello world', { status: 'sending' }),
    ]
    const incoming = textMsg('user', 'hello world')
    expect(findOptimisticIndex(incoming, existing)).toBe(0)
  })

  it('returns -1 for non-optimistic messages', () => {
    const existing = [textMsg('user', 'hello world')]
    const incoming = textMsg('user', 'hello world')
    expect(findOptimisticIndex(incoming, existing)).toBe(-1)
  })

  it('does not match assistant messages by text fallback', () => {
    const existing = [textMsg('assistant', 'hi', { status: 'sending' })]
    const incoming = textMsg('assistant', 'hi')
    expect(findOptimisticIndex(incoming, existing)).toBe(-1)
  })
})

// ---------------------------------------------------------------------------
// mergeOptimisticMessage
// ---------------------------------------------------------------------------

describe('mergeOptimisticMessage', () => {
  it('prefers incoming content when it has text', () => {
    const optimistic = textMsg('user', 'draft', { __optimisticId: 'opt-1' })
    const incoming = textMsg('user', 'final version')
    const merged = mergeOptimisticMessage(optimistic, incoming)
    expect(extractMessageText(merged)).toBe('final version')
  })

  it('clears __optimisticId and status', () => {
    const optimistic = textMsg('user', 'hello', { __optimisticId: 'opt-1', status: 'sending' })
    const incoming = textMsg('user', 'hello')
    const merged = mergeOptimisticMessage(optimistic, incoming)
    expect((merged as any).__optimisticId).toBeUndefined()
    expect((merged as any).status).toBeUndefined()
  })

  it('keeps optimistic content when incoming is empty', () => {
    const optimistic = textMsg('user', 'hello', { __optimisticId: 'opt-1' })
    const incoming = msg({ role: 'user' })
    const merged = mergeOptimisticMessage(optimistic, incoming)
    expect(extractMessageText(merged)).toBe('hello')
  })
})

// ---------------------------------------------------------------------------
// hasRecentExternalDuplicate
// ---------------------------------------------------------------------------

describe('hasRecentExternalDuplicate', () => {
  it('detects duplicate within 10s window', () => {
    const now = Date.now()
    const existing = [textMsg('user', 'hello', { __receiveTime: now - 5000 })]
    const incoming = textMsg('user', 'hello')
    expect(hasRecentExternalDuplicate(incoming, existing, true, now)).toBe(true)
  })

  it('ignores duplicates outside 10s window', () => {
    const now = Date.now()
    const existing = [textMsg('user', 'hello', { __receiveTime: now - 15000 })]
    const incoming = textMsg('user', 'hello')
    expect(hasRecentExternalDuplicate(incoming, existing, true, now)).toBe(false)
  })

  it('returns false when not external source', () => {
    const now = Date.now()
    const existing = [textMsg('user', 'hello', { __receiveTime: now })]
    const incoming = textMsg('user', 'hello')
    expect(hasRecentExternalDuplicate(incoming, existing, false, now)).toBe(false)
  })

  it('returns false for empty text', () => {
    const now = Date.now()
    const existing = [msg({ role: 'user', __receiveTime: now })]
    const incoming = msg({ role: 'user' })
    expect(hasRecentExternalDuplicate(incoming, existing, true, now)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// findDoneEventDuplicateIndex
// ---------------------------------------------------------------------------

describe('findDoneEventDuplicateIndex', () => {
  it('finds duplicate by ID', () => {
    const existing = [textMsg('assistant', 'hello', { id: 'msg-1' })]
    const complete = textMsg('assistant', 'hello final', { id: 'msg-1' })
    expect(findDoneEventDuplicateIndex(complete, existing)).toBe(0)
  })

  it('finds duplicate by text content', () => {
    const existing = [textMsg('assistant', 'exact text', { id: 'old' })]
    const complete = textMsg('assistant', 'exact text', { id: 'new' })
    expect(findDoneEventDuplicateIndex(complete, existing)).toBe(0)
  })

  it('returns -1 for no match', () => {
    const existing = [textMsg('assistant', 'old text')]
    const complete = textMsg('assistant', 'new text')
    expect(findDoneEventDuplicateIndex(complete, existing)).toBe(-1)
  })

  it('ignores user messages', () => {
    const existing = [textMsg('user', 'hello', { id: 'msg-1' })]
    const complete = textMsg('assistant', 'hello', { id: 'msg-1' })
    expect(findDoneEventDuplicateIndex(complete, existing)).toBe(-1)
  })
})

// ---------------------------------------------------------------------------
// matchesRealtimeMessage
// ---------------------------------------------------------------------------

describe('matchesRealtimeMessage', () => {
  it('matches by ID', () => {
    const hist = textMsg('assistant', 'hi', { id: 'msg-1' })
    const rt = textMsg('assistant', 'hi', { id: 'msg-1' })
    expect(matchesRealtimeMessage(hist, rt)).toBe(true)
  })

  it('matches by nonce', () => {
    const hist = textMsg('user', 'hello', { clientNonce: 'n1' })
    const rt = textMsg('user', 'hello', { clientNonce: 'n1' })
    expect(matchesRealtimeMessage(hist, rt)).toBe(true)
  })

  it('matches by text content with same role', () => {
    const hist = textMsg('assistant', 'same text')
    const rt = textMsg('assistant', 'same text')
    expect(matchesRealtimeMessage(hist, rt)).toBe(true)
  })

  it('does not match different text', () => {
    const hist = textMsg('assistant', 'text a')
    const rt = textMsg('assistant', 'text b')
    expect(matchesRealtimeMessage(hist, rt)).toBe(false)
  })

  it('matches optimistic history with partial text', () => {
    const hist = textMsg('user', 'hel', { status: 'sending' })
    const rt = textMsg('user', 'hello world')
    expect(matchesRealtimeMessage(hist, rt)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// mergeRealtimeAssistantMetadata
// ---------------------------------------------------------------------------

describe('mergeRealtimeAssistantMetadata', () => {
  it('copies __streamToolCalls from realtime to history', () => {
    const hist = textMsg('assistant', 'hello')
    const rt = textMsg('assistant', 'hello', {
      __streamToolCalls: [{ id: 'tc1', name: 'exec', phase: 'done' }],
    })
    const merged = mergeRealtimeAssistantMetadata(hist, rt)
    expect((merged as any).__streamToolCalls).toHaveLength(1)
  })

  it('does not overwrite existing tool calls', () => {
    const hist = textMsg('assistant', 'hello', {
      __streamToolCalls: [{ id: 'tc1', name: 'read', phase: 'done' }],
    })
    const rt = textMsg('assistant', 'hello', {
      __streamToolCalls: [{ id: 'tc2', name: 'exec', phase: 'done' }],
    })
    const merged = mergeRealtimeAssistantMetadata(hist, rt)
    expect((merged as any).__streamToolCalls[0].name).toBe('read')
  })

  it('returns history unchanged for user messages', () => {
    const hist = textMsg('user', 'hello')
    const rt = textMsg('user', 'hello')
    expect(mergeRealtimeAssistantMetadata(hist, rt)).toBe(hist)
  })
})

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

describe('sortMessagesChronologically', () => {
  it('sorts by event time', () => {
    const msgs = [
      textMsg('user', 'second', { createdAt: 2000 }),
      textMsg('user', 'first', { createdAt: 1000 }),
    ]
    const sorted = sortMessagesChronologically(msgs)
    expect(extractMessageText(sorted[0])).toBe('first')
  })

  it('preserves insertion order for equal times', () => {
    const msgs = [
      textMsg('user', 'a'),
      textMsg('user', 'b'),
    ]
    const sorted = sortMessagesChronologically(msgs)
    expect(extractMessageText(sorted[0])).toBe('a')
    expect(extractMessageText(sorted[1])).toBe('b')
  })
})

describe('isExternalInboundUserSource', () => {
  it('recognizes webchat', () => expect(isExternalInboundUserSource('webchat')).toBe(true))
  it('recognizes signal', () => expect(isExternalInboundUserSource('signal')).toBe(true))
  it('recognizes telegram', () => expect(isExternalInboundUserSource('telegram')).toBe(true))
  it('rejects unknown sources', () => expect(isExternalInboundUserSource('unknown')).toBe(false))
  it('handles non-strings', () => expect(isExternalInboundUserSource(42)).toBe(false))
})

describe('getAttachmentSignature', () => {
  it('returns empty for no attachments', () => {
    expect(getAttachmentSignature(msg({ role: 'user' }))).toBe('')
  })

  it('builds signature from name and size', () => {
    const m = msg({ role: 'user', attachments: [{ name: 'a.txt', size: 100 }] } as any)
    expect(getAttachmentSignature(m)).toBe('a.txt:100')
  })
})

describe('isOptimisticUserCandidate', () => {
  it('returns true for sending status', () => {
    expect(isOptimisticUserCandidate(textMsg('user', 'hi', { status: 'sending' }))).toBe(true)
  })

  it('returns true for __optimisticId', () => {
    expect(isOptimisticUserCandidate(textMsg('user', 'hi', { __optimisticId: 'opt' }))).toBe(true)
  })

  it('returns false for regular messages', () => {
    expect(isOptimisticUserCandidate(textMsg('user', 'hi'))).toBe(false)
  })

  it('returns false for assistant messages', () => {
    expect(isOptimisticUserCandidate(textMsg('assistant', 'hi', { status: 'sending' }))).toBe(false)
  })
})

describe('ensureAssistantTextContent', () => {
  it('adds content array from top-level text field', () => {
    const m = { role: 'assistant', content: [], text: 'hello' } as any
    const result = ensureAssistantTextContent(m)
    expect(result.content).toHaveLength(1)
    expect((result.content as any)[0].text).toBe('hello')
  })

  it('preserves existing content array', () => {
    const m = textMsg('assistant', 'existing')
    expect(ensureAssistantTextContent(m)).toBe(m)
  })

  it('returns user messages unchanged', () => {
    const m = textMsg('user', 'hi')
    expect(ensureAssistantTextContent(m)).toBe(m)
  })
})
