// Stub — Hermes Workspace uses hermes-api.ts for chat streaming, not legacy SSE.
// This hook is kept as a no-op to satisfy use-realtime-chat-history imports.

import type { StreamingState } from '@/stores/chat-store'

export function useChatStream(_opts: {
  sessionKey?: string
  enabled?: boolean
  onReconnect?: () => void
  onSilentTimeout?: (ms: number) => void
  onUserMessage?: (message: Record<string, unknown>, source?: string) => void
  onApprovalRequest?: (approval: Record<string, unknown>) => void
  onCompactionStart?: () => void
  onCompactionEnd?: () => void
  onCompaction?: (event: { phase?: string; sessionKey: string }) => void
  onDone?: (state: string, eventSessionKey: string, streamingSnapshot: StreamingState | null) => void
}) {
  return {
    connectionState: 'connected' as const,
    lastError: null as string | null,
    reconnect: () => {},
  }
}
