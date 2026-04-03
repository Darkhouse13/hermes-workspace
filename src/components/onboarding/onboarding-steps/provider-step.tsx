import type * as React from 'react'
import { cn } from '@/lib/utils'
import { ProviderLogo } from '@/components/provider-logo'

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

type ProviderDef = {
  id: string
  name: string
  logo: string
  desc: string
  authType: string
  envKey?: string
}

type ProviderStepProps = {
  mutedStyle: React.CSSProperties
  cardStyle: React.CSSProperties
  inputStyle: React.CSSProperties
  providers: Array<ProviderDef>
  backendInfo: GatewayStatusResponse | null
  canEditConfig: boolean
  canFetchModels: boolean
  backendSupportsChat: boolean
  configuredModel: string
  selectedProvider: string | null
  setSelectedProvider: (id: string | null) => void
  apiKey: string
  setApiKey: (key: string) => void
  baseUrl: string
  setBaseUrl: (url: string) => void
  saving: boolean
  saveError: string
  setSaveError: (err: string) => void
  availableModels: Array<string>
  selectedModel: string
  setSelectedModel: (model: string) => void
  isOAuth: boolean
  needsApiKey: boolean
  needsBaseUrl: boolean
  oauthStep: 'idle' | 'loading' | 'waiting' | 'success' | 'error'
  oauthUserCode: string
  oauthVerificationUrl: string
  oauthError: string
  onStartNousOAuth: () => void
  onSaveProviderConfig: () => Promise<boolean>
  onSaveModelSelection: () => Promise<boolean>
  onLoadModels: () => Promise<void>
  onContinue: () => void
  stripProviderPrefix: (model: string) => string
}

export function ProviderStep({
  mutedStyle,
  cardStyle,
  inputStyle,
  providers,
  backendInfo,
  canEditConfig,
  canFetchModels,
  backendSupportsChat,
  configuredModel,
  selectedProvider,
  setSelectedProvider,
  apiKey,
  setApiKey,
  baseUrl,
  setBaseUrl,
  saving,
  saveError,
  setSaveError,
  availableModels,
  selectedModel,
  setSelectedModel,
  isOAuth,
  needsApiKey,
  needsBaseUrl,
  oauthStep,
  oauthUserCode,
  oauthVerificationUrl,
  oauthError,
  onStartNousOAuth,
  onSaveProviderConfig,
  onSaveModelSelection,
  onLoadModels,
  onContinue,
  stripProviderPrefix,
}: ProviderStepProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-center text-lg font-bold">
        Choose Provider and Model
      </h2>
      <p className="text-center text-xs" style={mutedStyle}>
        {canEditConfig
          ? 'Save provider settings here, then choose a model before testing chat.'
          : 'This backend manages provider settings outside Hermes Workspace. Confirm the model you expect to use, then test chat.'}
      </p>

      <div className="rounded-xl p-3 text-xs" style={cardStyle}>
        <p style={mutedStyle}>Backend mode</p>
        <p className="mt-1">
          {backendInfo?.capabilities?.sessions
            ? 'Hermes gateway detected'
            : 'Portable OpenAI-compatible backend'}
        </p>
        {configuredModel ? (
          <p className="mt-2" style={mutedStyle}>
            Current model:{' '}
            <span className="font-mono text-accent-400">
              {configuredModel}
            </span>
          </p>
        ) : null}
      </div>

      <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto pr-1">
        {providers.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setSelectedProvider(p.id)
              setApiKey('')
              setBaseUrl('')
              setSaveError('')
            }}
            className={cn(
              'flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all',
              selectedProvider === p.id ? 'ring-2 ring-accent-500' : '',
            )}
            style={cardStyle}
          >
            <ProviderLogo
              provider={p.id}
              size={40}
              className="shrink-0 rounded-xl"
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{p.name}</div>
              <div className="text-xs" style={mutedStyle}>
                {p.desc}
              </div>
            </div>
            {selectedProvider === p.id ? (
              <span className="ml-auto size-2.5 shrink-0 rounded-full bg-green-500" />
            ) : null}
          </button>
        ))}
      </div>

      {selectedProvider &&
        isOAuth &&
        selectedProvider === 'nous' &&
        canEditConfig && (
          <div
            className="space-y-3 rounded-xl p-4 text-left"
            style={{ ...cardStyle, borderColor: 'var(--theme-border)' }}
          >
            {oauthStep === 'idle' && (
              <button
                onClick={onStartNousOAuth}
                className="w-full rounded-lg bg-accent-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-600"
              >
                Connect with Nous Portal
              </button>
            )}
            {oauthStep === 'loading' && (
              <div
                className="flex items-center justify-center gap-2 py-2 text-sm"
                style={mutedStyle}
              >
                <span className="size-2 animate-pulse rounded-full bg-accent-500" />
                Starting OAuth flow...
              </div>
            )}
            {oauthStep === 'waiting' && (
              <div className="space-y-3">
                <div
                  className="flex items-center gap-2 text-sm"
                  style={mutedStyle}
                >
                  <span className="size-2 animate-pulse rounded-full bg-yellow-400" />
                  Waiting for approval...
                </div>
                {oauthUserCode ? (
                  <div className="space-y-1 text-center">
                    <p className="text-xs" style={mutedStyle}>
                      Your code
                    </p>
                    <p className="text-2xl font-mono font-bold tracking-widest">
                      {oauthUserCode}
                    </p>
                  </div>
                ) : null}
                {oauthVerificationUrl ? (
                  <button
                    onClick={() =>
                      window.open(oauthVerificationUrl, '_blank')
                    }
                    className="w-full rounded-lg border py-2 text-xs font-medium"
                    style={{ borderColor: 'var(--theme-border)' }}
                  >
                    Open Nous Portal ↗
                  </button>
                ) : null}
              </div>
            )}
            {oauthStep === 'success' && (
              <div className="flex items-center gap-2 text-sm text-green-500">
                <span>✓</span>
                <span>Authenticated successfully.</span>
              </div>
            )}
            {oauthStep === 'error' && (
              <div className="space-y-2">
                <p className="text-xs text-red-400">
                  {oauthError || 'Authentication failed'}
                </p>
                <button
                  onClick={onStartNousOAuth}
                  className="w-full rounded-lg bg-accent-500 py-2 text-xs font-medium text-white"
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        )}

      {selectedProvider &&
        isOAuth &&
        selectedProvider === 'openai-codex' &&
        canEditConfig && (
          <div
            className="space-y-2 rounded-xl p-4 text-left"
            style={{ ...cardStyle, borderColor: 'var(--theme-border)' }}
          >
            <p className="text-sm font-medium">Run in your terminal</p>
            <div
              className="rounded-lg px-3 py-2 font-mono text-xs"
              style={{ background: 'rgba(0,0,0,0.2)' }}
            >
              hermes auth login openai-codex
            </div>
            <p className="text-xs" style={mutedStyle}>
              After the login flow completes, click below to refresh
              provider settings.
            </p>
            <button
              onClick={async () => {
                await onSaveProviderConfig()
                await onLoadModels()
              }}
              className="w-full rounded-lg bg-accent-500 py-2 text-xs font-medium text-white"
            >
              I&apos;ve authenticated
            </button>
          </div>
        )}

      {selectedProvider && (needsApiKey || needsBaseUrl) && (
        <div className="space-y-2 pt-1">
          {needsBaseUrl ? (
            <div>
              <label
                className="mb-1 block text-xs font-medium"
                style={mutedStyle}
              >
                {selectedProvider === 'ollama'
                  ? 'Ollama URL'
                  : 'Base URL'}
              </label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={
                  selectedProvider === 'ollama'
                    ? 'http://localhost:11434'
                    : 'https://api.example.com/v1'
                }
                className="w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent-500"
                style={inputStyle}
              />
            </div>
          ) : null}
          {needsApiKey ? (
            <div>
              <label
                className="mb-1 block text-xs font-medium"
                style={mutedStyle}
              >
                API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent-500"
                style={inputStyle}
              />
            </div>
          ) : null}
        </div>
      )}

      <div>
        <label
          className="mb-1 block text-xs font-medium"
          style={mutedStyle}
        >
          Model
        </label>
        {availableModels.length > 0 ? (
          <select
            value={selectedModel}
            onChange={(e) =>
              setSelectedModel(stripProviderPrefix(e.target.value))
            }
            className="w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent-500"
            style={inputStyle}
          >
            {availableModels.map((model) => (
              <option key={model} value={model}>
                {stripProviderPrefix(model)}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            placeholder={configuredModel || 'gpt-4.1'}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent-500"
            style={inputStyle}
          />
        )}
        <p className="mt-2 text-xs" style={mutedStyle}>
          {canFetchModels
            ? 'Models were fetched from the backend when available.'
            : 'If your backend does not expose /v1/models, enter the model name manually.'}
        </p>
      </div>

      {!canEditConfig ? (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-200">
          In-app provider editing is unavailable on this backend. That
          is optional. If the backend is already configured, continue to
          the chat test.
        </div>
      ) : null}

      {saveError ? (
        <p className="text-xs text-red-400">{saveError}</p>
      ) : null}

      <div className="flex gap-2">
        {selectedProvider &&
        canEditConfig &&
        (needsApiKey || needsBaseUrl) ? (
          <button
            onClick={() => void onSaveProviderConfig()}
            disabled={
              saving || (needsApiKey && !apiKey && !needsBaseUrl)
            }
            className="flex-1 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        ) : null}
        <button
          onClick={async () => {
            let ok = true
            if (
              selectedProvider &&
              canEditConfig &&
              (!isOAuth || oauthStep === 'success')
            ) {
              ok = await onSaveProviderConfig()
            }
            if (ok) {
              ok = await onSaveModelSelection()
            }
            if (ok) {
              onContinue()
            }
          }}
          disabled={!backendSupportsChat}
          className="flex-1 rounded-xl bg-accent-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
        >
          Continue →
        </button>
      </div>
    </div>
  )
}
