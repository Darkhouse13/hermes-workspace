import type * as React from 'react'

type GatewayStatusResponse = {
  capabilities?: {
    health?: boolean
    chatCompletions?: boolean
    models?: boolean
    streaming?: boolean
    sessions?: boolean
    skills?: boolean
    memory?: boolean
    config?: boolean
    jobs?: boolean
  }
  hermesUrl?: string
}

type ConnectStepProps = {
  mutedStyle: React.CSSProperties
  cardStyle: React.CSSProperties
  backendStatus: 'idle' | 'checking' | 'ready' | 'error'
  backendMessage: string
  backendInfo: GatewayStatusResponse | null
  onRetry: () => void
  onContinue: () => void
}

export function ConnectStep({
  mutedStyle,
  cardStyle,
  backendStatus,
  backendMessage,
  backendInfo,
  onRetry,
  onContinue,
}: ConnectStepProps) {
  return (
    <div className="space-y-4 text-center">
      <div className="text-4xl">🔌</div>
      <h2 className="text-lg font-bold">Connect Your Backend</h2>
      <p className="text-sm" style={mutedStyle}>
        Start by verifying that Hermes Workspace can reach your
        OpenAI-compatible backend.
      </p>

      {backendStatus === 'checking' && (
        <div
          className="flex items-center justify-center gap-2 text-sm"
          style={mutedStyle}
        >
          <span className="size-2 animate-pulse rounded-full bg-accent-500" />
          Checking backend capabilities...
        </div>
      )}

      {backendStatus === 'ready' && (
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2 text-sm text-green-500">
            <span className="size-2 rounded-full bg-green-500" />
            {backendMessage}
          </div>
          <div
            className="rounded-xl p-3 text-left text-xs"
            style={cardStyle}
          >
            <p style={mutedStyle}>Backend URL</p>
            <p className="mt-1 font-mono">
              {backendInfo?.hermesUrl || 'Configured automatically'}
            </p>
          </div>
        </div>
      )}

      {backendStatus === 'error' && (
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2 text-sm text-red-400">
            <span className="size-2 rounded-full bg-red-500" />
            {backendMessage}
          </div>
          <div
            className="rounded-xl p-3 text-left text-xs"
            style={{ ...cardStyle, borderColor: 'var(--theme-border)' }}
          >
            <p className="font-medium text-white">
              Compatible backends
            </p>
            <p className="mt-2" style={mutedStyle}>
              Use any backend that exposes{' '}
              <code>/v1/chat/completions</code>. If you point Hermes
              Workspace at a Hermes gateway, enhanced features unlock
              automatically.
            </p>
            <div
              className="mt-3 rounded-lg px-3 py-2 font-mono text-[11px]"
              style={{ background: 'rgba(0,0,0,0.2)' }}
            >
              HERMES_API_URL=http://127.0.0.1:8642 pnpm dev
            </div>
            <div
              className="mt-2 rounded-lg px-3 py-2 font-mono text-[11px]"
              style={{ background: 'rgba(0,0,0,0.2)' }}
            >
              hermes gateway
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onRetry}
          className="flex-1 rounded-xl border py-3 text-sm font-semibold transition-colors"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          Retry
        </button>
        <button
          onClick={onContinue}
          disabled={backendStatus !== 'ready'}
          className="flex-1 rounded-xl bg-accent-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
        >
          Continue
        </button>
      </div>
    </div>
  )
}
