import { useCallback, useEffect, useState } from 'react'
import type * as React from 'react'
import {
  CloudIcon,
  Notification03Icon,
  PaintBoardIcon,
  Settings02Icon,
  SourceCodeSquareIcon,
  UserIcon,
} from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { SettingsSection, SettingsRow } from './settings-layout'

export type HermesProvider = {
  id: string
  name: string
  authType: string
  envKeys: Array<string>
  configured: boolean
  maskedKeys: Record<string, string>
}

export type HermesConfigData = {
  config: Record<string, unknown>
  providers: Array<HermesProvider>
  activeProvider: string
  activeModel: string
  hermesHome: string
}

export type AvailableModelsResponse = {
  provider: string
  models: Array<{ id: string; description: string }>
  providers: Array<{ id: string; label: string; authenticated: boolean }>
}

export function HermesConfigSection() {
  const [data, setData] = useState<HermesConfigData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [modelInput, setModelInput] = useState('')
  const [providerInput, setProviderInput] = useState('')
  const [baseUrlInput, setBaseUrlInput] = useState('')

  // Available providers + models from hermes-agent
  const [availableProviders, setAvailableProviders] = useState<Array<{ id: string; label: string; authenticated: boolean }>>([])
  const [availableModels, setAvailableModels] = useState<Array<{ id: string; description: string }>>([])
  const [loadingModels, setLoadingModels] = useState(false)

  const fetchModelsForProvider = useCallback(async (provider: string) => {
    setLoadingModels(true)
    try {
      const res = await fetch(`/api/hermes-proxy/api/available-models?provider=${encodeURIComponent(provider)}`)
      if (res.ok) {
        const result = await res.json() as AvailableModelsResponse
        setAvailableModels(result.models)
        if (result.providers.length) setAvailableProviders(result.providers)
      }
    } catch { /* ignore */ }
    setLoadingModels(false)
  }, [])

  useEffect(() => {
    fetch('/api/hermes-config')
      .then((r) => r.json())
      .then((d: HermesConfigData) => {
        setData(d)
        setModelInput((d.activeModel) || '')
        setProviderInput((d.activeProvider) || '')
        setBaseUrlInput((d.config.base_url as string | undefined) ?? '')
        setLoading(false)
        // Fetch available models for current provider
        if (d.activeProvider) {
          void fetchModelsForProvider(d.activeProvider)
        }
      })
      .catch(() => setLoading(false))
  }, [fetchModelsForProvider])

  const saveConfig = async (updates: { config?: Record<string, unknown>; env?: Record<string, string> }) => {
    setSaving(true)
    setSaveMessage(null)
    try {
      const res = await fetch('/api/hermes-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      const result = await res.json() as { message?: string }
      setSaveMessage(result.message || 'Saved')
      // Refresh data
      const refreshRes = await fetch('/api/hermes-config')
      const refreshData = await refreshRes.json() as HermesConfigData
      setData(refreshData)
      setTimeout(() => setSaveMessage(null), 3000)
    } catch {
      setSaveMessage('Failed to save')
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <SettingsSection title="Hermes Agent" description="Loading configuration..." icon={Settings02Icon}>
        <div className="animate-pulse h-20 rounded-lg" style={{ backgroundColor: 'var(--theme-panel)' }} />
      </SettingsSection>
    )
  }

  if (!data) {
    return (
      <SettingsSection title="Hermes Agent" description="Could not load Hermes configuration." icon={Settings02Icon}>
        <p className="text-sm" style={{ color: 'var(--theme-muted)' }}>
          Make sure Hermes Agent is running on localhost:8642
        </p>
      </SettingsSection>
    )
  }

  const memoryConfig = (data.config.memory as Record<string, unknown> | undefined) ?? {}
  const terminalConfig = (data.config.terminal as Record<string, unknown> | undefined) ?? {}
  const displayConfig = (data.config.display as Record<string, unknown> | undefined) ?? {}

  return (
    <>
      {saveMessage && (
        <div className="rounded-lg px-3 py-2 text-sm font-medium" style={{
          backgroundColor: saveMessage.includes('Failed') ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
          color: saveMessage.includes('Failed') ? '#ef4444' : '#22c55e',
        }}>
          {saveMessage}
        </div>
      )}

      {/* Model & Provider */}
      <SettingsSection
        title="Model & Provider"
        description="Configure the default AI model for Hermes Agent."
        icon={SourceCodeSquareIcon}
      >
        <SettingsRow label="Provider" description="Select the inference provider.">
          <div className="flex gap-2 w-full max-w-sm">
            {availableProviders.length > 0 ? (
              <select
                value={providerInput}
                onChange={(e) => {
                  const newProvider = e.target.value
                  setProviderInput(newProvider)
                  setModelInput('')
                  void fetchModelsForProvider(newProvider)
                }}
                className="flex-1 rounded-md border border-primary-300 bg-white dark:bg-primary-800 px-3 py-2 text-sm text-primary-900 dark:text-primary-100 dark:border-primary-600 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                {availableProviders.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}{p.authenticated ? ' ✓' : ''}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                value={providerInput}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProviderInput(e.target.value)}
                placeholder="e.g. ollama, anthropic, openai-codex"
                className="flex-1"
              />
            )}
          </div>
        </SettingsRow>
        <SettingsRow label="Model" description="The model Hermes uses for conversations.">
          <div className="flex gap-2 w-full max-w-sm">
            {availableModels.length > 0 ? (
              <select
                value={modelInput}
                onChange={(e) => setModelInput(e.target.value)}
                className="flex-1 rounded-md border border-primary-300 bg-white dark:bg-primary-800 px-3 py-2 text-sm font-mono text-primary-900 dark:text-primary-100 dark:border-primary-600 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                {!availableModels.some(m => m.id === modelInput) && modelInput && (
                  <option value={modelInput}>{modelInput} (current)</option>
                )}
                {availableModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id}{m.description ? ` — ${m.description}` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                value={modelInput}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setModelInput(e.target.value)}
                placeholder={loadingModels ? 'Loading models...' : 'e.g. qwen3.5:35b'}
                className="flex-1 font-mono"
              />
            )}
          </div>
        </SettingsRow>
        <SettingsRow label="Base URL" description="For local providers (Ollama, LM Studio, MLX). Leave blank for cloud.">
          <div className="flex gap-2 w-full max-w-sm">
            <Input
              value={baseUrlInput}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBaseUrlInput(e.target.value)}
              placeholder="e.g. http://localhost:11434/v1"
              className="flex-1 font-mono text-sm"
            />
          </div>
        </SettingsRow>
        <div className="flex justify-end pt-2">
          <Button
            size="sm"
            disabled={saving}
            onClick={() => {
              const configUpdate: Record<string, unknown> = {
                model: modelInput.trim(),
                provider: providerInput.trim(),
                base_url: baseUrlInput.trim() || null,
              }
              void saveConfig({ config: configUpdate })
            }}
          >
            {saving ? 'Saving...' : 'Save Model'}
          </Button>
        </div>
      </SettingsSection>

      {/* API Keys */}
      <SettingsSection
        title="API Keys"
        description="Manage provider API keys stored in ~/.hermes/.env"
        icon={CloudIcon}
      >
        {data.providers
          .filter((p) => p.envKeys.length > 0)
          .map((provider) => (
            <SettingsRow
              key={provider.id}
              label={provider.name}
              description={provider.configured ? '✅ Configured' : '❌ Not configured'}
            >
              <div className="flex items-center gap-2 w-full max-w-sm">
                {provider.envKeys.map((envKey) => (
                  <div key={envKey} className="flex-1">
                    {editingKey === envKey ? (
                      <div className="flex gap-2">
                        <Input
                          type="password"
                          value={keyInput}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setKeyInput(e.target.value)}
                          placeholder={`Enter ${envKey}`}
                          className="flex-1"
                        />
                        <Button
                          size="sm"
                          onClick={() => {
                            saveConfig({ env: { [envKey]: keyInput } })
                            setEditingKey(null)
                            setKeyInput('')
                          }}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setEditingKey(null); setKeyInput('') }}
                        >
                          ✕
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono" style={{ color: 'var(--theme-muted)' }}>
                          {provider.maskedKeys[envKey] || 'Not set'}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setEditingKey(envKey); setKeyInput('') }}
                        >
                          {provider.configured ? 'Change' : 'Add'}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </SettingsRow>
          ))}
      </SettingsSection>

      {/* Memory */}
      <SettingsSection
        title="Memory"
        description="Configure Hermes Agent memory and user profiles."
        icon={UserIcon}
      >
        <SettingsRow label="Memory enabled" description="Store and recall memories across sessions.">
          <Switch
            checked={memoryConfig.memory_enabled !== false}
            onCheckedChange={(checked: boolean) =>
              saveConfig({ config: { memory: { memory_enabled: checked } } })
            }
          />
        </SettingsRow>
        <SettingsRow label="User profile" description="Remember user preferences and context.">
          <Switch
            checked={memoryConfig.user_profile_enabled !== false}
            onCheckedChange={(checked: boolean) =>
              saveConfig({ config: { memory: { user_profile_enabled: checked } } })
            }
          />
        </SettingsRow>
      </SettingsSection>

      {/* Terminal */}
      <SettingsSection
        title="Terminal"
        description="Shell execution settings."
        icon={SourceCodeSquareIcon}
      >
        <SettingsRow label="Backend" description="Terminal execution backend.">
          <span className="text-sm font-mono" style={{ color: 'var(--theme-muted)' }}>
            {(terminalConfig.backend as string) || 'local'}
          </span>
        </SettingsRow>
        <SettingsRow label="Timeout" description="Max seconds for terminal commands.">
          <span className="text-sm font-mono" style={{ color: 'var(--theme-muted)' }}>
            {(terminalConfig.timeout as number) || 180}s
          </span>
        </SettingsRow>
      </SettingsSection>

      {/* Display */}
      <SettingsSection
        title="Display"
        description="CLI display preferences (reflected in agent behavior)."
        icon={PaintBoardIcon}
      >
        <SettingsRow label="Personality" description="Agent response style.">
          <span className="text-sm font-mono" style={{ color: 'var(--theme-muted)' }}>
            {(displayConfig.personality as string) || 'default'}
          </span>
        </SettingsRow>
        <SettingsRow label="Skin" description="CLI theme skin.">
          <span className="text-sm font-mono" style={{ color: 'var(--theme-muted)' }}>
            {(displayConfig.skin as string) || 'default'}
          </span>
        </SettingsRow>
      </SettingsSection>

      {/* Info */}
      <SettingsSection
        title="About"
        description="Hermes Agent runtime information."
        icon={Notification03Icon}
      >
        <SettingsRow label="Config location" description="Where Hermes stores its configuration.">
          <span className="text-xs font-mono" style={{ color: 'var(--theme-muted)' }}>
            {data.hermesHome}
          </span>
        </SettingsRow>
        <SettingsRow label="Active provider" description="Current inference provider.">
          <span className="text-sm font-medium" style={{ color: 'var(--theme-accent)' }}>
            {data.providers.find((p) => p.id === data.activeProvider)?.name || data.activeProvider}
          </span>
        </SettingsRow>
      </SettingsSection>
    </>
  )
}
