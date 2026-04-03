import { useCallback } from 'react'
import type { QueryClient } from '@tanstack/react-query'
import type { ChatAttachment, ChatMessage } from '../types'
import type { ThinkingLevel } from '../components/chat-composer'
import { createOptimisticMessage } from '../chat-screen-utils'
import {
  appendHistoryMessage,
  updateSessionLastMessage,
} from '../chat-queries'
import { setPendingGeneration } from '../pending-send'
import {
  normalizeMimeType,
  isImageMimeType,
  readDataUrlMimeType,
  stripDataUrlPrefix,
} from '@/lib/chat-content-normalization'

type PortableHistoryMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface UseChatSendMessageDeps {
  queryClient: QueryClient
  thinkingLevelRef: React.RefObject<ThinkingLevel>
  failsafeTimerRef: React.MutableRefObject<number | null>
  activeSendRef: React.MutableRefObject<{
    sessionKey: string
    friendlyId: string
    clientId: string
  } | null>
  finalDisplayMessages: Array<ChatMessage>
  buildPortableHistory: (messages: Array<ChatMessage>) => Array<PortableHistoryMessage>
  setSending: (value: boolean) => void
  setError: (value: string | null) => void
  setLocalActivity: (activity: string) => void
  setResearchResetKey: React.Dispatch<React.SetStateAction<number>>
  setWaitingForResponse: React.Dispatch<React.SetStateAction<boolean>>
  clearCompletedStreaming: () => void
  streamStart: () => void
  streamFinish: () => void
  startStreaming: (params: {
    sessionKey: string
    friendlyId: string
    message: string
    history: Array<PortableHistoryMessage>
    attachments?: Array<Record<string, unknown>>
    thinking?: string
    fastMode: boolean
    idempotencyKey: string
  }) => Promise<void>
}

export function useChatSendMessage(deps: UseChatSendMessageDeps) {
  const sendMessage = useCallback(
    function sendMessage(
      sessionKey: string,
      friendlyId: string,
      body: string,
      attachments: Array<ChatAttachment> = [],
      fastMode = false,
      skipOptimistic = false,
      existingClientId = '',
    ) {
      const currentThinkingLevel = deps.thinkingLevelRef.current
      deps.setLocalActivity('reading')
      const normalizedAttachments = attachments.map((attachment) => ({
        ...attachment,
        id: attachment.id ?? crypto.randomUUID(),
      }))

      // Inject text/file attachment content directly into the message body.
      const textBlocks = normalizedAttachments
        .filter((a) => {
          const mime =
            normalizeMimeType(a.contentType ?? '') ||
            readDataUrlMimeType(a.dataUrl ?? '')
          return !isImageMimeType(mime) && (a.dataUrl ?? '').length > 0
        })
        .map((a) => {
          const raw = a.dataUrl ?? ''
          const content = raw.startsWith('data:')
            ? atob(raw.split(',')[1] ?? '')
            : raw
          return `\n\n<attachment name="${a.name ?? 'file'}">\n${content}\n</attachment>`
        })
      const enrichedBody = body + textBlocks.join('')

      let optimisticClientId = existingClientId
      deps.setResearchResetKey((current) => current + 1)
      if (!skipOptimistic) {
        const { clientId, optimisticMessage } = createOptimisticMessage(
          body,
          normalizedAttachments,
        )
        optimisticClientId = clientId
        appendHistoryMessage(
          deps.queryClient,
          friendlyId,
          sessionKey,
          optimisticMessage,
        )
        updateSessionLastMessage(
          deps.queryClient,
          sessionKey,
          friendlyId,
          optimisticMessage,
        )
      }

      setPendingGeneration(true)
      deps.setSending(true)
      deps.setError(null)
      deps.clearCompletedStreaming()
      deps.setWaitingForResponse(true)
      deps.activeSendRef.current = {
        sessionKey,
        friendlyId,
        clientId: optimisticClientId,
      }

      // Failsafe: clear waitingForResponse after 120s no matter what
      if (deps.failsafeTimerRef.current) {
        window.clearTimeout(deps.failsafeTimerRef.current)
      }
      deps.failsafeTimerRef.current = window.setTimeout(() => {
        deps.streamFinish()
      }, 120_000)

      // Send a compatibility shape for attachment parsing.
      const payloadAttachments = normalizedAttachments.map((attachment) => {
        const mimeType =
          normalizeMimeType(attachment.contentType) ||
          readDataUrlMimeType(attachment.dataUrl)
        const isImage = isImageMimeType(mimeType)
        const rawDataUrl = attachment.dataUrl ?? ''
        let encodedContent: string
        let finalDataUrl: string
        if (!isImage && !rawDataUrl.startsWith('data:')) {
          encodedContent = btoa(unescape(encodeURIComponent(rawDataUrl)))
          finalDataUrl = mimeType
            ? `data:${mimeType};base64,${encodedContent}`
            : `data:text/plain;base64,${encodedContent}`
        } else {
          encodedContent = stripDataUrlPrefix(rawDataUrl)
          finalDataUrl = rawDataUrl
        }
        return {
          id: attachment.id,
          name: attachment.name,
          fileName: attachment.name,
          contentType: mimeType || undefined,
          mimeType: mimeType || undefined,
          mediaType: mimeType || undefined,
          type: isImage ? 'image' : 'file',
          content: encodedContent,
          data: encodedContent,
          base64: encodedContent,
          dataUrl: finalDataUrl,
          size: attachment.size,
        }
      })
      const history = deps.buildPortableHistory(deps.finalDisplayMessages)

      try {
        deps.streamStart()
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn('[chat] streamStart error (non-fatal):', e)
        }
      }

      void deps.startStreaming({
        sessionKey,
        friendlyId,
        message: enrichedBody,
        history,
        attachments:
          payloadAttachments.length > 0 ? payloadAttachments : undefined,
        thinking: currentThinkingLevel === 'off' ? undefined : currentThinkingLevel,
        fastMode,
        idempotencyKey: optimisticClientId || crypto.randomUUID(),
      }).catch((err: unknown) => {
        const messageText = err instanceof Error ? err.message : String(err)
        if (import.meta.env.DEV) {
          console.warn('[chat] send-stream failed', messageText)
        }
      })
    },
    [
      deps.finalDisplayMessages,
      deps.clearCompletedStreaming,
      deps.queryClient,
      deps.setLocalActivity,
      deps.startStreaming,
      deps.streamFinish,
      deps.streamStart,
    ],
  )

  return { sendMessage }
}
