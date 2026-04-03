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

type TestStepProps = {
  mutedStyle: React.CSSProperties
  cardStyle: React.CSSProperties
  backendInfo: GatewayStatusResponse | null
  selectedModel: string
  configuredModel: string
  testStatus: 'idle' | 'testing' | 'success' | 'error'
  testMessage: string
  onTestConnection: () => void
  onContinue: () => void
  onBack: () => void
  stripProviderPrefix: (model: string) => string
}

export function TestStep({
  mutedStyle,
  cardStyle,
  backendInfo,
  selectedModel,
  configuredModel,
  testStatus,
  testMessage,
  onTestConnection,
  onContinue,
  onBack,
  stripProviderPrefix,
}: TestStepProps) {
  return (
    <div className="space-y-4 text-center">
      <div className="text-4xl">🧪</div>
      <h2 className="text-lg font-bold">Test Chat</h2>
      <p className="text-sm" style={mutedStyle}>
        Verify that core chat works first. Enhanced Hermes features are
        optional and appear automatically when supported.
      </p>

      <div
        className="rounded-xl p-3 text-left text-xs"
        style={cardStyle}
      >
        <p style={mutedStyle}>Backend</p>
        <p className="mt-1 font-mono">
          {backendInfo?.hermesUrl || 'Configured automatically'}
        </p>
        {selectedModel || configuredModel ? (
          <p className="mt-2" style={mutedStyle}>
            Model:{' '}
            <span className="font-mono text-accent-400">
              {stripProviderPrefix(selectedModel || configuredModel)}
            </span>
          </p>
        ) : null}
      </div>

      {testStatus === 'idle' ? (
        <button
          onClick={onTestConnection}
          className="w-full rounded-xl bg-accent-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-600"
        >
          Send Test Message
        </button>
      ) : null}

      {testStatus === 'testing' ? (
        <div
          className="flex items-center justify-center gap-2 text-sm"
          style={mutedStyle}
        >
          <span className="size-2 animate-pulse rounded-full bg-accent-500" />
          Waiting for the backend response...
        </div>
      ) : null}

      {testStatus === 'success' ? (
        <div className="space-y-3">
          <div
            className="rounded-xl p-3 text-left text-sm"
            style={cardStyle}
          >
            <span className="font-medium text-green-500">
              Assistant:
            </span>{' '}
            <span>{testMessage}</span>
          </div>
          <button
            onClick={onContinue}
            className="w-full rounded-xl bg-green-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-700"
          >
            Continue
          </button>
        </div>
      ) : null}

      {testStatus === 'error' ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-red-500/30 bg-red-900/20 p-3 text-left text-sm">
            <p className="mb-1 font-medium text-red-400">
              Chat test failed
            </p>
            <p className="text-xs" style={mutedStyle}>
              {testMessage}
            </p>
            {testMessage.includes('401') ||
            testMessage.toLowerCase().includes('key') ? (
              <p className="mt-2 text-xs text-yellow-400">
                Check your provider credentials and account access.
              </p>
            ) : testMessage.toLowerCase().includes('model') ? (
              <p className="mt-2 text-xs text-yellow-400">
                Confirm the selected model exists on this backend.
              </p>
            ) : (
              <p className="mt-2 text-xs text-yellow-400">
                Confirm the backend is running and still reachable from
                Hermes Workspace.
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onTestConnection}
              className="flex-1 rounded-lg bg-accent-500 py-2 text-xs font-medium text-white"
            >
              Retry
            </button>
            <button
              onClick={onBack}
              className="flex-1 rounded-lg border py-2 text-xs font-medium"
              style={{ borderColor: 'var(--theme-border)' }}
            >
              ← Back
            </button>
          </div>
          <button
            onClick={onContinue}
            className="mx-auto block text-xs"
            style={mutedStyle}
          >
            Skip for now
          </button>
        </div>
      ) : null}
    </div>
  )
}
