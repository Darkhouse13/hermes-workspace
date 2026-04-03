'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useRouterState } from '@tanstack/react-router'
import { WelcomeStep } from './onboarding-steps/welcome-step'
import { ConnectStep } from './onboarding-steps/connect-step'
import { ProviderStep } from './onboarding-steps/provider-step'
import { TestStep } from './onboarding-steps/test-step'
import { DoneStep } from './onboarding-steps/done-step'

const KNOWN_PROVIDER_PREFIXES = [
  'openrouter',
  'anthropic',
  'openai',
  'openai-codex',
  'nous',
  'ollama',
  'zai',
  'kimi-coding',
  'minimax',
  'minimax-cn',
]

function stripProviderPrefix(model: string): string {
  if (!model) return model
  const slash = model.indexOf('/')
  if (slash === -1) return model
  const prefix = model.slice(0, slash)
  if (KNOWN_PROVIDER_PREFIXES.includes(prefix)) {
    return model.slice(slash + 1)
  }
  return model
}

const ONBOARDING_KEY = 'hermes-onboarding-complete'

type Step = 'welcome' | 'connect' | 'provider' | 'test' | 'done'

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

const PROVIDERS = [
  {
    id: 'nous',
    name: 'Nous Portal',
    logo: '/providers/nous.png',
    desc: 'Free via OAuth',
    authType: 'oauth',
  },
  {
    id: 'openai-codex',
    name: 'OpenAI Codex',
    logo: '/providers/openai.png',
    desc: 'Free via ChatGPT Pro',
    authType: 'oauth',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    logo: '/providers/anthropic.png',
    desc: 'API key required',
    authType: 'api_key',
    envKey: 'ANTHROPIC_API_KEY',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    logo: '/providers/openrouter.png',
    desc: 'API key required',
    authType: 'api_key',
    envKey: 'OPENROUTER_API_KEY',
  },
  {
    id: 'ollama',
    name: 'Ollama',
    logo: '/providers/ollama.png',
    desc: 'Local models, no key needed',
    authType: 'none',
  },
  {
    id: 'custom',
    name: 'Custom (OpenAI-compat)',
    logo: '/providers/openai.png',
    desc: 'Any OpenAI-compatible endpoint',
    authType: 'custom',
  },
]

function getEnhancedFeatureNames(
  capabilities?: GatewayStatusResponse['capabilities'],
): Array<string> {
  if (!capabilities) return []
  const features: Array<{ enabled?: boolean; label: string }> = [
    { enabled: capabilities.sessions, label: 'Sessions' },
    { enabled: capabilities.skills, label: 'Skills' },
    { enabled: capabilities.memory, label: 'Memory' },
    { enabled: capabilities.config, label: 'In-app config' },
    { enabled: capabilities.jobs, label: 'Jobs' },
  ]

  return features
    .filter((feature) => feature.enabled)
    .map((feature) => feature.label)
}

export function HermesOnboarding() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const [show, setShow] = useState(false)
  const [step, setStep] = useState<Step>('welcome')
  const [backendStatus, setBackendStatus] = useState<
    'idle' | 'checking' | 'ready' | 'error'
  >('idle')
  const [backendInfo, setBackendInfo] = useState<GatewayStatusResponse | null>(
    null,
  )
  const [backendMessage, setBackendMessage] = useState('')
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [availableModels, setAvailableModels] = useState<Array<string>>([])
  const [selectedModel, setSelectedModel] = useState('')
  const [testStatus, setTestStatus] = useState<
    'idle' | 'testing' | 'success' | 'error'
  >('idle')
  const [testMessage, setTestMessage] = useState('')
  const [configuredModel, setConfiguredModel] = useState('')

  const [oauthStep, setOauthStep] = useState<
    'idle' | 'loading' | 'waiting' | 'success' | 'error'
  >('idle')
  const [oauthUserCode, setOauthUserCode] = useState('')
  const [oauthVerificationUrl, setOauthVerificationUrl] = useState('')
  const [oauthError, setOauthError] = useState('')
  const oauthPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const provider = PROVIDERS.find((p) => p.id === selectedProvider)
  const needsApiKey =
    provider?.authType === 'api_key' || provider?.authType === 'custom'
  const needsBaseUrl =
    provider?.id === 'ollama' || provider?.authType === 'custom'
  const isOAuth = provider?.authType === 'oauth'
  const capabilities = backendInfo?.capabilities
  const canEditConfig = Boolean(capabilities?.config)
  const enhancedFeatures = getEnhancedFeatureNames(capabilities)
  const canFetchModels = Boolean(capabilities?.models)
  const backendSupportsChat = Boolean(capabilities?.chatCompletions)

  const loadCurrentConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/hermes-config')
      if (!res.ok) return
      const data = (await res.json()) as {
        activeModel?: string
        activeProvider?: string
      }
      if (data.activeModel) {
        const normalizedModel = stripProviderPrefix(data.activeModel)
        setConfiguredModel(normalizedModel)
        setSelectedModel((current) => current || normalizedModel)
      }
      if (data.activeProvider) {
        setSelectedProvider((current) => current || data.activeProvider || null)
      }
    } catch {}
  }, [])

  const loadModels = useCallback(async () => {
    if (!canFetchModels) return
    try {
      const modelsRes = await fetch('/api/models')
      if (!modelsRes.ok) return
      const modelsData = (await modelsRes.json()) as {
        data?: Array<{ id?: string }>
        models?: Array<{ id?: string }>
      }
      const rawModels = modelsData.data || modelsData.models || []
      const models = rawModels
        .map((model) => (typeof model.id === 'string' ? model.id : ''))
        .filter(Boolean)
        .slice(0, 20)

      setAvailableModels(models)
      setSelectedModel(
        (current) => current || stripProviderPrefix(models[0] || ''),
      )
    } catch {
      setAvailableModels([])
    }
  }, [canFetchModels])

  const checkBackend = useCallback(async () => {
    setBackendStatus('checking')
    setBackendMessage('')

    try {
      const res = await fetch('/api/gateway-status')
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const data = (await res.json()) as GatewayStatusResponse
      setBackendInfo(data)

      if (data.capabilities?.chatCompletions) {
        setBackendStatus('ready')
        setBackendMessage(
          data.capabilities.sessions
            ? 'Backend connected. Core chat works, and Hermes gateway enhancements are available.'
            : 'Backend connected. Core chat is ready.',
        )
        return
      }

      if (data.capabilities?.health) {
        setBackendStatus('error')
        setBackendMessage(
          'Backend is reachable, but /v1/chat/completions is not available yet.',
        )
        return
      }

      setBackendStatus('error')
      setBackendMessage('No compatible backend detected yet.')
    } catch (err) {
      setBackendInfo(null)
      setBackendStatus('error')
      setBackendMessage(
        err instanceof Error ? err.message : 'Connection check failed',
      )
    }
  }, [])

  const saveProviderConfig = useCallback(async () => {
    if (!selectedProvider) return true
    if (!canEditConfig) return true

    setSaving(true)
    setSaveError('')

    try {
      const prov = PROVIDERS.find((p) => p.id === selectedProvider)
      const body: Record<string, unknown> = {
        config: { model: { provider: selectedProvider } },
      }

      if (prov?.envKey && apiKey) {
        body.env = { [prov.envKey]: apiKey }
      }
      if (baseUrl) {
        body.config = { model: { provider: selectedProvider, baseUrl } }
      }

      const res = await fetch('/api/hermes-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`Save failed: ${res.status}`)

      await loadCurrentConfig()
      await loadModels()
      return true
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save')
      return false
    } finally {
      setSaving(false)
    }
  }, [
    apiKey,
    baseUrl,
    canEditConfig,
    loadCurrentConfig,
    loadModels,
    selectedProvider,
  ])

  const saveModelSelection = useCallback(async () => {
    const modelToSave = stripProviderPrefix(selectedModel || configuredModel)
    if (!modelToSave) return true

    setConfiguredModel(modelToSave)

    if (!canEditConfig || !selectedProvider) return true

    try {
      const res = await fetch('/api/hermes-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            model: { provider: selectedProvider, default: modelToSave },
          },
        }),
      })
      if (!res.ok) throw new Error(`Save failed: ${res.status}`)
      return true
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save model')
      return false
    }
  }, [canEditConfig, configuredModel, selectedModel, selectedProvider])

  const testConnection = useCallback(async () => {
    setTestStatus('testing')
    setTestMessage('')

    try {
      const res = await fetch('/api/send-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionKey: 'new',
          friendlyId: 'new',
          message:
            'Reply with one short sentence confirming the backend connection works.',
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const reader = res.body?.getReader()
      if (!reader) throw new Error('No stream returned')

      const decoder = new TextDecoder()
      let text = ''

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const matches = chunk.match(/(?:delta|text|content)":"([^"]+)"/g)
        if (matches) {
          for (const match of matches) {
            text += match.replace(/.*":"/, '').replace(/"$/, '')
          }
        }
      }

      setTestMessage(text.slice(0, 240) || 'Chat test succeeded.')
      setTestStatus('success')
      void checkBackend()
    } catch (err) {
      setTestMessage(err instanceof Error ? err.message : 'Connection failed')
      setTestStatus('error')
    }
  }, [checkBackend])

  const startNousOAuth = useCallback(async () => {
    setOauthStep('loading')
    setOauthError('')

    try {
      const res = await fetch('/api/oauth/device-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'nous' }),
      })
      const data = (await res.json()) as {
        device_code?: string
        user_code?: string
        verification_uri_complete?: string
        interval?: number
        error?: string
      }

      if (!res.ok || data.error) {
        setOauthError(data.error || 'Failed to start OAuth')
        setOauthStep('error')
        return
      }

      setOauthUserCode(data.user_code || '')
      setOauthVerificationUrl(data.verification_uri_complete || '')
      setOauthStep('waiting')

      if (data.verification_uri_complete) {
        window.open(data.verification_uri_complete, '_blank')
      }

      const intervalMs = Math.max((data.interval || 5) * 1000, 3000)
      oauthPollRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch('/api/oauth/poll-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              provider: 'nous',
              deviceCode: data.device_code,
            }),
          })
          const pollData = (await pollRes.json()) as {
            status: string
            message?: string
          }

          if (pollData.status === 'success') {
            if (oauthPollRef.current) clearInterval(oauthPollRef.current)
            setOauthStep('success')
            await saveProviderConfig()
            await loadModels()
            return
          }

          if (pollData.status === 'error') {
            if (oauthPollRef.current) clearInterval(oauthPollRef.current)
            setOauthError(pollData.message || 'Authentication failed')
            setOauthStep('error')
          }
        } catch {}
      }, intervalMs)
    } catch (err) {
      setOauthError(
        err instanceof Error ? err.message : 'Failed to start OAuth',
      )
      setOauthStep('error')
    }
  }, [loadModels, saveProviderConfig])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const allowedRoutes = ['/', '/dashboard', '/chat', '/chat/', '/new']
    const shouldAppear =
      allowedRoutes.includes(pathname) || pathname.startsWith('/chat/')
    if (!shouldAppear) {
      setShow(false)
      return
    }
    if (!localStorage.getItem(ONBOARDING_KEY)) {
      setShow(true)
    }
  }, [pathname])

  useEffect(() => {
    return () => {
      if (oauthPollRef.current) clearInterval(oauthPollRef.current)
    }
  }, [])

  useEffect(() => {
    if (oauthPollRef.current) clearInterval(oauthPollRef.current)
    setOauthStep('idle')
    setOauthUserCode('')
    setOauthVerificationUrl('')
    setOauthError('')
  }, [selectedProvider])

  useEffect(() => {
    if (show) {
      void loadCurrentConfig()
    }
  }, [loadCurrentConfig, show])

  const complete = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, 'true')
    setShow(false)
  }, [])

  if (!show) return null

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'var(--theme-card)',
    border: '1px solid var(--theme-border)',
    color: 'var(--theme-text)',
  }
  const mutedStyle: React.CSSProperties = { color: 'var(--theme-muted)' }
  const inputStyle: React.CSSProperties = {
    backgroundColor: 'var(--theme-bg)',
    border: '1px solid var(--theme-border)',
    color: 'var(--theme-text)',
  }

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center px-4"
      style={{
        backgroundColor: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.97 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="w-full max-w-md rounded-2xl p-8"
          style={cardStyle}
        >
          {step === 'welcome' && (
            <WelcomeStep
              mutedStyle={mutedStyle}
              onConnect={() => {
                setStep('connect')
                void checkBackend()
              }}
              onSkip={complete}
            />
          )}

          {step === 'connect' && (
            <ConnectStep
              mutedStyle={mutedStyle}
              cardStyle={cardStyle}
              backendStatus={backendStatus}
              backendMessage={backendMessage}
              backendInfo={backendInfo}
              onRetry={() => void checkBackend()}
              onContinue={() => {
                setStep('provider')
                void loadModels()
              }}
            />
          )}

          {step === 'provider' && (
            <ProviderStep
              mutedStyle={mutedStyle}
              cardStyle={cardStyle}
              inputStyle={inputStyle}
              providers={PROVIDERS}
              backendInfo={backendInfo}
              canEditConfig={canEditConfig}
              canFetchModels={canFetchModels}
              backendSupportsChat={backendSupportsChat}
              configuredModel={configuredModel}
              selectedProvider={selectedProvider}
              setSelectedProvider={setSelectedProvider}
              apiKey={apiKey}
              setApiKey={setApiKey}
              baseUrl={baseUrl}
              setBaseUrl={setBaseUrl}
              saving={saving}
              saveError={saveError}
              setSaveError={setSaveError}
              availableModels={availableModels}
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
              isOAuth={Boolean(isOAuth)}
              needsApiKey={Boolean(needsApiKey)}
              needsBaseUrl={Boolean(needsBaseUrl)}
              oauthStep={oauthStep}
              oauthUserCode={oauthUserCode}
              oauthVerificationUrl={oauthVerificationUrl}
              oauthError={oauthError}
              onStartNousOAuth={startNousOAuth}
              onSaveProviderConfig={saveProviderConfig}
              onSaveModelSelection={saveModelSelection}
              onLoadModels={loadModels}
              onContinue={() => {
                setStep('test')
                setTestStatus('idle')
                setTestMessage('')
              }}
              stripProviderPrefix={stripProviderPrefix}
            />
          )}

          {step === 'test' && (
            <TestStep
              mutedStyle={mutedStyle}
              cardStyle={cardStyle}
              backendInfo={backendInfo}
              selectedModel={selectedModel}
              configuredModel={configuredModel}
              testStatus={testStatus}
              testMessage={testMessage}
              onTestConnection={testConnection}
              onContinue={() => setStep('done')}
              onBack={() => setStep('provider')}
              stripProviderPrefix={stripProviderPrefix}
            />
          )}

          {step === 'done' && (
            <DoneStep
              mutedStyle={mutedStyle}
              cardStyle={cardStyle}
              enhancedFeatures={enhancedFeatures}
              onComplete={complete}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
