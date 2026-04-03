import { describe, expect, it } from 'vitest'
import type { ChatMessage } from '../screens/chat/types'
import type { StreamingState } from '../stores/chat-store'
import {
  assembleStreamingMessage,
  finalizeStreamingMessage,
} from './chat-streaming-assembly'

function makeStreaming(overrides?: Partial<StreamingState>): StreamingState {
  return {
    runId: null,
    text: '',
    thinking: '',
    lifecycleEvents: [],
    toolCalls: [],
    ...overrides,
  }
}

function textMsg(role: string, text: string, extra?: Record<string, unknown>): ChatMessage {
  return {
    role,
    content: [{ type: 'text', text }],
    ...extra,
  } as ChatMessage
}

// ---------------------------------------------------------------------------
// assembleStreamingMessage
// ---------------------------------------------------------------------------

describe('assembleStreamingMessage', () => {
  it('creates message with text content', () => {
    const streaming = makeStreaming({ text: 'Hello world' })
    const result = assembleStreamingMessage(streaming, 1000, 5)

    expect(result.role).toBe('assistant')
    expect(result.content).toHaveLength(1)
    expect((result.content as any)[0].type).toBe('text')
    expect((result.content as any)[0].text).toBe('Hello world')
  })

  it('sets timestamp and metadata', () => {
    const streaming = makeStreaming({ text: 'hi' })
    const result = assembleStreamingMessage(streaming, 1234, 7)

    expect(result.timestamp).toBe(1234)
    expect((result as any).__receiveTime).toBe(1234)
    expect((result as any).__realtimeSequence).toBe(7)
    expect((result as any).__streamingStatus).toBe('complete')
  })

  it('includes thinking content when present', () => {
    const streaming = makeStreaming({ text: 'answer', thinking: 'let me think' })
    const result = assembleStreamingMessage(streaming, 1000, 1)

    expect(result.content).toHaveLength(2)
    expect((result.content as any)[0].type).toBe('thinking')
    expect((result.content as any)[0].thinking).toBe('let me think')
    expect((result.content as any)[1].type).toBe('text')
    expect((result.content as any)[1].text).toBe('answer')
  })

  it('includes tool calls when present', () => {
    const streaming = makeStreaming({
      text: 'result',
      toolCalls: [
        { id: 'tc-1', name: 'exec', phase: 'done', args: { command: 'ls' } },
      ],
    })
    const result = assembleStreamingMessage(streaming, 1000, 1)

    const tcPart = (result.content as any).find((p: any) => p.type === 'toolCall')
    expect(tcPart).toBeDefined()
    expect(tcPart.id).toBe('tc-1')
    expect(tcPart.name).toBe('exec')
    expect(tcPart.arguments).toEqual({ command: 'ls' })
  })

  it('handles multiple tool calls', () => {
    const streaming = makeStreaming({
      text: '',
      toolCalls: [
        { id: 'tc-1', name: 'read', phase: 'done' },
        { id: 'tc-2', name: 'write', phase: 'done' },
      ],
    })
    const result = assembleStreamingMessage(streaming, 1000, 1)

    const toolCalls = (result.content as any).filter((p: any) => p.type === 'toolCall')
    expect(toolCalls).toHaveLength(2)
  })

  it('produces empty content array for empty streaming state', () => {
    const streaming = makeStreaming()
    const result = assembleStreamingMessage(streaming, 1000, 1)

    expect(result.content).toHaveLength(0)
    expect(result.role).toBe('assistant')
  })

  it('strips final tags from streaming text', () => {
    const streaming = makeStreaming({ text: '<final>clean text</final>' })
    const result = assembleStreamingMessage(streaming, 1000, 1)

    expect((result.content as any)[0].text).toBe('clean text')
  })

  it('omits text part when text is empty after stripping', () => {
    const streaming = makeStreaming({ text: '<final></final>' })
    const result = assembleStreamingMessage(streaming, 1000, 1)

    const textParts = (result.content as any).filter((p: any) => p.type === 'text')
    expect(textParts).toHaveLength(0)
  })

  it('places thinking before text in content array', () => {
    const streaming = makeStreaming({ text: 'answer', thinking: 'hmm' })
    const result = assembleStreamingMessage(streaming, 1000, 1)

    expect((result.content as any)[0].type).toBe('thinking')
    expect((result.content as any)[1].type).toBe('text')
  })

  it('places tool calls after text in content array', () => {
    const streaming = makeStreaming({
      text: 'done',
      toolCalls: [{ id: 'tc', name: 'exec', phase: 'done' }],
    })
    const result = assembleStreamingMessage(streaming, 1000, 1)
    const types = (result.content as any).map((p: any) => p.type)
    expect(types).toEqual(['text', 'toolCall'])
  })
})

// ---------------------------------------------------------------------------
// finalizeStreamingMessage
// ---------------------------------------------------------------------------

describe('finalizeStreamingMessage', () => {
  const identityStripper = (msg: ChatMessage) => msg

  it('prefers event message over streaming state', () => {
    const eventMsg = textMsg('assistant', 'from event', { createdAt: 500 })
    const streaming = makeStreaming({ text: 'from stream' })
    const result = finalizeStreamingMessage(eventMsg, streaming, identityStripper, 1000, 1)

    expect(result).not.toBeNull()
    const textPart = (result!.content as any).find((p: any) => p.type === 'text')
    expect(textPart.text).toBe('from event')
  })

  it('sets metadata on event message result', () => {
    const eventMsg = textMsg('assistant', 'hello', { createdAt: 500 })
    const result = finalizeStreamingMessage(eventMsg, null, identityStripper, 1000, 3)

    expect(result!.timestamp).toBe(500) // uses event time
    expect((result as any).__receiveTime).toBe(1000)
    expect((result as any).__realtimeSequence).toBe(3)
    expect((result as any).__streamingStatus).toBe('complete')
  })

  it('falls back to now when event has no timestamp', () => {
    const eventMsg = textMsg('assistant', 'hello')
    const result = finalizeStreamingMessage(eventMsg, null, identityStripper, 2000, 1)

    expect(result!.timestamp).toBe(2000)
  })

  it('applies stripFinalTags function to event message', () => {
    const eventMsg = textMsg('assistant', '<final>content</final>')
    const stripper = (msg: ChatMessage) => {
      return {
        ...msg,
        content: (msg.content as any).map((p: any) =>
          p.type === 'text' ? { ...p, text: 'stripped' } : p,
        ),
      } as ChatMessage
    }
    const result = finalizeStreamingMessage(eventMsg, null, stripper, 1000, 1)

    const textPart = (result!.content as any).find((p: any) => p.type === 'text')
    expect(textPart.text).toBe('stripped')
  })

  it('embeds stream tool calls on event message', () => {
    const eventMsg = textMsg('assistant', 'done')
    const streaming = makeStreaming({
      toolCalls: [{ id: 'tc-1', name: 'exec', phase: 'done' }],
    })
    const result = finalizeStreamingMessage(eventMsg, streaming, identityStripper, 1000, 1)

    expect((result as any).__streamToolCalls).toHaveLength(1)
    expect((result as any).__streamToolCalls[0].name).toBe('exec')
  })

  it('does not embed empty tool calls array', () => {
    const eventMsg = textMsg('assistant', 'done')
    const streaming = makeStreaming({ toolCalls: [] })
    const result = finalizeStreamingMessage(eventMsg, streaming, identityStripper, 1000, 1)

    expect((result as any).__streamToolCalls).toBeUndefined()
  })

  it('falls back to streaming assembly when no event message', () => {
    const streaming = makeStreaming({ text: 'streamed text' })
    const result = finalizeStreamingMessage(null, streaming, identityStripper, 1000, 2)

    expect(result).not.toBeNull()
    expect(result!.role).toBe('assistant')
    const textPart = (result!.content as any).find((p: any) => p.type === 'text')
    expect(textPart.text).toBe('streamed text')
  })

  it('falls back to streaming assembly when event message is undefined', () => {
    const streaming = makeStreaming({ text: 'from stream' })
    const result = finalizeStreamingMessage(undefined, streaming, identityStripper, 1000, 1)

    expect(result).not.toBeNull()
    const textPart = (result!.content as any).find((p: any) => p.type === 'text')
    expect(textPart.text).toBe('from stream')
  })

  it('returns null when no event and streaming has no text', () => {
    const streaming = makeStreaming({ text: '' })
    const result = finalizeStreamingMessage(null, streaming, identityStripper, 1000, 1)

    expect(result).toBeNull()
  })

  it('returns null when no event and no streaming state', () => {
    const result = finalizeStreamingMessage(null, null, identityStripper, 1000, 1)
    expect(result).toBeNull()
  })

  it('returns null when no event and streaming is undefined', () => {
    const result = finalizeStreamingMessage(undefined, undefined, identityStripper, 1000, 1)
    expect(result).toBeNull()
  })
})
