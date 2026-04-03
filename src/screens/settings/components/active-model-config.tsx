import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { getConfig, patchConfig } from '@/server/hermes-api'
import {
  coerceString,
  stripProviderPrefix,
} from '../provider-api'
import type { SelectOption } from '../provider-api'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ModelProviderOption = 'custom' | 'openrouter' | 'anthropic' | 'openai'

export type ModelConfigDraft = {
  provider: ModelProviderOption
  model: string
  baseUrl: string
}

export type PerformanceDraft = {
  streamStaleTimeout: string
  streamReadTimeout: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODEL_PROVIDER_OPTIONS: Array<SelectOption> = [
  { label: 'Custom', value: 'custom' },
  { label: 'OpenRouter', value: 'openrouter' },
  { label: 'Anthropic', value: 'anthropic' },
  { label: 'OpenAI', value: 'openai' },
]

const MODEL_PRESETS = [
  {
    id: 'ollama',
    label: 'Ollama',
    provider: 'custom' as const,
    baseUrl: 'http://127.0.0.1:11434/v1',
  },
  {
    id: 'llama-server',
    label: 'llama-server',
    provider: 'custom' as const,
    baseUrl: 'http://127.0.0.1:8080/v1',
  },
]

const DEFAULT_STREAM_STALE_TIMEOUT_SECONDS = 90
const DEFAULT_STREAM_READ_TIMEOUT_SECONDS = 60
const MODEL_PROVIDER_VALUES = new Set<ModelProviderOption>(
  MODEL_PROVIDER_OPTIONS.map((option) => option.value as ModelProviderOption),
)

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

type HermesConfig = Record<string, unknown>

export function readRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

export function parseModelProvider(value: unknown): ModelProviderOption {
  return typeof value === 'string' &&
    MODEL_PROVIDER_VALUES.has(value as ModelProviderOption)
    ? (value as ModelProviderOption)
    : 'custom'
}

export function readPrimaryModelConfig(config: HermesConfig | undefined): ModelConfigDraft {
  const modelBlock = readRecord(config?.model)
  const flatModel = typeof config?.model === 'string' ? config.model : ''

  return {
    provider: parseModelProvider(modelBlock?.provider ?? config?.provider),
    model: coerceString(modelBlock?.default ?? flatModel),
    baseUrl: coerceString(modelBlock?.base_url ?? config?.base_url),
  }
}

export function readFallbackModelConfig(config: HermesConfig | undefined): ModelConfigDraft {
  const fallbackBlock = readRecord(config?.fallback_model)

  return {
    provider: parseModelProvider(fallbackBlock?.provider),
    model: coerceString(fallbackBlock?.model),
    baseUrl: coerceString(fallbackBlock?.base_url),
  }
}

export function readPerformanceConfig(config: HermesConfig | undefined): PerformanceDraft {
  const performanceBlock = readRecord(config?.performance)
  const staleTimeout =
    performanceBlock?.stream_stale_timeout ?? config?.stream_stale_timeout
  const readTimeout =
    performanceBlock?.stream_read_timeout ?? config?.stream_read_timeout

  return {
    streamStaleTimeout:
      typeof staleTimeout === 'number' && Number.isFinite(staleTimeout)
        ? String(staleTimeout)
        : String(DEFAULT_STREAM_STALE_TIMEOUT_SECONDS),
    streamReadTimeout:
      typeof readTimeout === 'number' && Number.isFinite(readTimeout)
        ? String(readTimeout)
        : String(DEFAULT_STREAM_READ_TIMEOUT_SECONDS),
  }
}

export function hasModelConfigValue(value: ModelConfigDraft): boolean {
  return Boolean(value.model.trim() || value.baseUrl.trim())
}

export function parseTimeoutInput(value: string, fallback: number): number {
  const parsed = Number(value.trim())
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

// ---------------------------------------------------------------------------
// ModelConfigSection
// ---------------------------------------------------------------------------

export function ModelConfigSection(props: {
  title: string
  description: string
  value: ModelConfigDraft
  onChange: (nextValue: ModelConfigDraft) => void
  modelOptions: Array<SelectOption>
  showPresets?: boolean
  datalistId: string
}) {
  const {
    title,
    description,
    value,
    onChange,
    modelOptions,
    showPresets = false,
    datalistId,
  } = props

  return (
    <section className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 shadow-sm">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-primary-900">{title}</h3>
        <p className="text-sm text-primary-600">{description}</p>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-[0.12em] text-primary-600">
            Provider
          </span>
          <select
            className="h-10 w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 text-sm text-primary-900 outline-none"
            value={value.provider}
            onChange={(event) => {
              onChange({
                ...value,
                provider: parseModelProvider(event.target.value),
              })
            }}
          >
            {MODEL_PROVIDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-[0.12em] text-primary-600">
            Model Name
          </span>
          <Input
            value={value.model}
            list={datalistId}
            placeholder="gpt-4.1, claude-sonnet-4-5, qwen2.5:32b"
            className="border-[var(--theme-border)] bg-[var(--theme-card)] font-mono text-sm"
            onChange={(event) => {
              onChange({
                ...value,
                model: event.target.value,
              })
            }}
          />
        </label>
      </div>

      <label className="mt-4 block space-y-1.5">
        <span className="text-xs font-medium uppercase tracking-[0.12em] text-primary-600">
          Base URL
        </span>
        <Input
          value={value.baseUrl}
          placeholder="http://127.0.0.1:11434/v1"
          className="border-[var(--theme-border)] bg-[var(--theme-card)] font-mono text-sm"
          onChange={(event) => {
            onChange({
              ...value,
              baseUrl: event.target.value,
            })
          }}
        />
      </label>

      {showPresets ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {MODEL_PRESETS.map((preset) => (
            <Button
              key={preset.id}
              type="button"
              size="sm"
              variant="outline"
              className="border-[var(--theme-border)] bg-[var(--theme-card)]"
              onClick={() => {
                onChange({
                  ...value,
                  provider: preset.provider,
                  baseUrl: preset.baseUrl,
                })
              }}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      ) : null}

      <datalist id={datalistId}>
        {modelOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </datalist>
    </section>
  )
}

// ---------------------------------------------------------------------------
// ActiveModelCard
// ---------------------------------------------------------------------------

export function ActiveModelCard({ modelOptions }: { modelOptions: Array<SelectOption> }) {
  const queryClient = useQueryClient()
  const [primaryConfig, setPrimaryConfig] = useState<ModelConfigDraft>({
    provider: 'custom',
    model: '',
    baseUrl: '',
  })
  const [fallbackConfig, setFallbackConfig] = useState<ModelConfigDraft>({
    provider: 'custom',
    model: '',
    baseUrl: '',
  })
  const [performanceConfig, setPerformanceConfig] = useState<PerformanceDraft>({
    streamStaleTimeout: String(DEFAULT_STREAM_STALE_TIMEOUT_SECONDS),
    streamReadTimeout: String(DEFAULT_STREAM_READ_TIMEOUT_SECONDS),
  })
  const [showFallback, setShowFallback] = useState(false)

  const configQuery = useQuery({
    queryKey: ['hermes', 'active-config'],
    queryFn: getConfig,
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const normalizedPrimaryModel = stripProviderPrefix(primaryConfig.model.trim())
      const normalizedFallbackModel = stripProviderPrefix(fallbackConfig.model.trim())
      const streamStaleTimeout = parseTimeoutInput(
        performanceConfig.streamStaleTimeout,
        DEFAULT_STREAM_STALE_TIMEOUT_SECONDS,
      )
      const streamReadTimeout = parseTimeoutInput(
        performanceConfig.streamReadTimeout,
        DEFAULT_STREAM_READ_TIMEOUT_SECONDS,
      )

      const patch: Record<string, unknown> = {
        model: normalizedPrimaryModel,
        provider: primaryConfig.provider,
        base_url: primaryConfig.baseUrl.trim(),
        stream_stale_timeout: streamStaleTimeout,
        stream_read_timeout: streamReadTimeout,
        performance: {
          stream_stale_timeout: streamStaleTimeout,
          stream_read_timeout: streamReadTimeout,
        },
      }

      patch.fallback_model = hasModelConfigValue(fallbackConfig)
        ? {
            provider: fallbackConfig.provider,
            model: normalizedFallbackModel,
            base_url: fallbackConfig.baseUrl.trim(),
          }
        : null

      await patchConfig(patch)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['hermes', 'active-config'] }),
        queryClient.invalidateQueries({ queryKey: ['hermes', 'config'] }),
        queryClient.invalidateQueries({ queryKey: ['hermes-config'] }),
      ])
      toast('Model config saved — takes effect on next message', {
        type: 'success',
      })
    },
    onError: (error) => {
      toast(
        error instanceof Error ? error.message : 'Failed to save model config',
        { type: 'error' },
      )
    },
  })

  useEffect(() => {
    if (!configQuery.data) return
    setPrimaryConfig(readPrimaryModelConfig(configQuery.data))
    setFallbackConfig(readFallbackModelConfig(configQuery.data))
    setPerformanceConfig(readPerformanceConfig(configQuery.data))
  }, [configQuery.data])

  return (
    <section className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 shadow-sm md:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h3 className="text-base font-medium text-primary-900">
            Model Configuration
          </h3>
          <p className="text-sm text-primary-600">
            Update the primary model, optional fallback, and stream timeout
            settings saved in <code className="font-mono">~/.hermes/config.yaml</code>.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => void saveMutation.mutateAsync()}
          disabled={configQuery.isPending || saveMutation.isPending}
        >
          {saveMutation.isPending ? 'Saving...' : 'Save'}
        </Button>
      </div>

      {configQuery.isPending ? (
        <p className="mt-4 text-sm text-primary-500">Loading configuration...</p>
      ) : configQuery.error ? (
        <p className="mt-4 text-sm text-red-500">
          Could not load config — is Hermes Agent running?
        </p>
      ) : (
        <div className="mt-5 space-y-4">
          <ModelConfigSection
            title="Primary Model"
            description="Default provider, model, and base URL used for new Hermes requests."
            value={primaryConfig}
            onChange={setPrimaryConfig}
            modelOptions={modelOptions}
            showPresets
            datalistId="settings-primary-model-options"
          />

          <section className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-primary-900">
                  Fallback Model
                </h3>
                <p className="text-sm text-primary-600">
                  Optional secondary model Hermes can use if the primary path
                  fails.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-[var(--theme-border)] bg-[var(--theme-card)]"
                onClick={() => {
                  setShowFallback((current) => !current)
                }}
              >
                {showFallback ? 'Hide Fallback' : 'Show Fallback'}
              </Button>
            </div>

            {showFallback ? (
              <div className="mt-4">
                <ModelConfigSection
                  title="Fallback Settings"
                  description="Keep these fields empty if you do not want a fallback model configured."
                  value={fallbackConfig}
                  onChange={setFallbackConfig}
                  modelOptions={modelOptions}
                  datalistId="settings-fallback-model-options"
                />
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 shadow-sm">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-primary-900">
                Performance
              </h3>
              <p className="text-sm text-primary-600">
                Increase these timeouts for slower local models or larger
                prompts that stream output more gradually.
              </p>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-primary-600">
                  Stream Stale Timeout
                </span>
                <Input
                  type="number"
                  min={1}
                  value={performanceConfig.streamStaleTimeout}
                  className="border-[var(--theme-border)] bg-[var(--theme-card)] text-sm"
                  onChange={(event) => {
                    setPerformanceConfig((current) => ({
                      ...current,
                      streamStaleTimeout: event.target.value,
                    }))
                  }}
                />
                <p className="text-xs text-primary-500">Default: 90s</p>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-primary-600">
                  Stream Read Timeout
                </span>
                <Input
                  type="number"
                  min={1}
                  value={performanceConfig.streamReadTimeout}
                  className="border-[var(--theme-border)] bg-[var(--theme-card)] text-sm"
                  onChange={(event) => {
                    setPerformanceConfig((current) => ({
                      ...current,
                      streamReadTimeout: event.target.value,
                    }))
                  }}
                />
                <p className="text-xs text-primary-500">Default: 60s</p>
              </label>
            </div>

            <p className="mt-4 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card2)] px-3 py-2 text-sm text-primary-600">
              Slow local runners such as Ollama and `llama-server` often need
              more headroom before Hermes decides a stream has stalled.
            </p>
          </section>
        </div>
      )}
    </section>
  )
}
