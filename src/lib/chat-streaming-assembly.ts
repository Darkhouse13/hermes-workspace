import type {
  ChatMessage,
  MessageContent,
  TextContent,
  ThinkingContent,
  ToolCallContent,
} from '../screens/chat/types'
import type { StreamingState } from '../stores/chat-store'
import { stripFinalTags } from './chat-content-normalization'
import { getMessageEventTime } from '../lib/chat-message-identity'
import { ensureAssistantTextContent } from './chat-message-dedup'

/**
 * Build a final ChatMessage from streaming state (text, thinking, tool calls).
 * Used as a fallback when the `done` event has no message payload.
 */
export function assembleStreamingMessage(
  streaming: StreamingState,
  now: number,
  realtimeSequence: number,
): ChatMessage {
  const cleanStreamText = stripFinalTags(streaming.text)
  const content: Array<MessageContent> = []

  if (streaming.thinking) {
    content.push({
      type: 'thinking',
      thinking: streaming.thinking,
    } as ThinkingContent)
  }

  if (cleanStreamText) {
    content.push({
      type: 'text',
      text: cleanStreamText,
    } as TextContent)
  }

  for (const toolCall of streaming.toolCalls) {
    content.push({
      type: 'toolCall',
      id: toolCall.id,
      name: toolCall.name,
      arguments: toolCall.args as Record<string, unknown> | undefined,
    } as ToolCallContent)
  }

  return {
    role: 'assistant',
    content,
    timestamp: now,
    __receiveTime: now,
    __realtimeSequence: realtimeSequence,
    __streamingStatus: 'complete',
  }
}

/**
 * Prepare the final complete message from a `done` event.
 * Prefers the authoritative event payload; falls back to streaming state.
 */
export function finalizeStreamingMessage(
  eventMessage: ChatMessage | undefined | null,
  streaming: StreamingState | null | undefined,
  stripFinalTagsFromMessage: (msg: ChatMessage) => ChatMessage,
  now: number,
  realtimeSequence: number,
): ChatMessage | null {
  if (eventMessage) {
    const cleanedMessage = ensureAssistantTextContent(
      stripFinalTagsFromMessage(eventMessage),
    )
    // Preserve tool calls from streaming state on the final message
    const streamToolCallsToEmbed = streaming?.toolCalls.length
      ? streaming.toolCalls
      : undefined
    return {
      ...cleanedMessage,
      timestamp: getMessageEventTime(cleanedMessage) ?? now,
      __receiveTime: now,
      __realtimeSequence: realtimeSequence,
      __streamingStatus: 'complete',
      ...(streamToolCallsToEmbed ? { __streamToolCalls: streamToolCallsToEmbed } : {}),
    }
  }

  if (streaming && streaming.text) {
    return assembleStreamingMessage(streaming, now, realtimeSequence)
  }

  return null
}
