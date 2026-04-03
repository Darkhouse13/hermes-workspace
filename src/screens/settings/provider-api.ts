import type { ModelCatalogEntry } from '@/lib/model-types'
import {
  getProviderDisplayName,
  getProviderInfo,
  normalizeProviderId,
} from '@/lib/provider-catalog'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProviderStatus = 'active' | 'configured'

export type ProviderSummary = {
  id: string
  name: string
  description: string
  modelCount: number
  status: ProviderStatus
}

export type HermesConfig = Record<string, unknown>

export type ConfigQueryResponse = {
  ok?: boolean
  payload?: HermesConfig
  error?: string
}

export type ConfigPatchResponse = {
  ok?: boolean
  error?: string
}

export type HermesCatalogEntry =
  | string
  | {
      id: string
      provider: string
      name: string
      [key: string]: unknown
    }

export type SelectOption = {
  label: string
  value: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Strip the provider prefix that hermes-agent adds internally via litellm.
 * e.g. "openrouter/nvidia/nemotron-..." -> "nvidia/nemotron-..."
 *      "anthropic/claude-3-5-sonnet"    -> "claude-3-5-sonnet"
 * Only strips the first path segment if it matches a known provider ID.
 */
export const KNOWN_PROVIDER_PREFIXES = [
  'openrouter', 'anthropic', 'openai', 'openai-codex', 'nous',
  'ollama', 'zai', 'kimi-coding', 'minimax', 'minimax-cn',
]

const HERMES_API_URL = process.env.HERMES_API_URL || 'http://127.0.0.1:8642'

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

export function stripProviderPrefix(model: string): string {
  if (!model) return model
  const slash = model.indexOf('/')
  if (slash === -1) return model
  const prefix = model.slice(0, slash)
  if (KNOWN_PROVIDER_PREFIXES.includes(prefix)) {
    return model.slice(slash + 1)
  }
  return model
}

function isHermesCatalogEntry(
  entry: HermesCatalogEntry | null,
): entry is HermesCatalogEntry {
  return entry !== null
}

// ---------------------------------------------------------------------------
// fetchModels
// ---------------------------------------------------------------------------

export async function fetchModels(): Promise<{
  ok?: boolean
  models?: Array<ModelCatalogEntry>
  configuredProviders?: Array<string>
}> {
  const response = await fetch(`${HERMES_API_URL}/v1/models`)
  if (!response.ok) {
    throw new Error(`Hermes models request failed (${response.status})`)
  }

  const payload = (await response.json()) as
    | Array<unknown>
    | { data?: Array<Record<string, unknown>>; models?: Array<Record<string, unknown>> }
  const rawModels = Array.isArray(payload)
    ? payload
    : Array.isArray(payload.data)
      ? payload.data
      : Array.isArray(payload.models)
        ? payload.models
        : []

  const models = rawModels
    .map((entry) => {
      if (typeof entry === 'string') return entry
      if (!entry || typeof entry !== 'object') return null
      const record = entry as Record<string, unknown>
      const id =
        typeof record.id === 'string'
          ? record.id.trim()
          : typeof record.name === 'string'
            ? record.name.trim()
            : typeof record.model === 'string'
              ? record.model.trim()
              : ''
      if (!id) return null
      const provider =
        typeof record.provider === 'string' && record.provider.trim()
          ? record.provider.trim()
          : typeof record.owned_by === 'string' && record.owned_by.trim()
            ? record.owned_by.trim()
            : id.includes('/')
              ? id.split('/')[0]
              : 'hermes-agent'

      return {
        ...record,
        id,
        provider,
        name:
          typeof record.name === 'string' && record.name.trim()
            ? record.name.trim()
            : typeof record.display_name === 'string' && record.display_name.trim()
              ? record.display_name.trim()
              : typeof record.label === 'string' && record.label.trim()
                ? record.label.trim()
                : id,
      }
    })
    .filter(isHermesCatalogEntry)

  const configuredProviders = Array.from(
    new Set(
      models.flatMap((entry) => {
        if (typeof entry === 'string') return []
        return typeof entry.provider === 'string' && entry.provider
          ? [entry.provider]
          : []
      }),
    ),
  )

  return { ok: true, models: models as Array<ModelCatalogEntry>, configuredProviders }
}

// ---------------------------------------------------------------------------
// Data processing utilities
// ---------------------------------------------------------------------------

export function readProviderId(entry: ModelCatalogEntry): string | null {
  if (typeof entry === 'string') return null
  const provider = typeof entry.provider === 'string' ? entry.provider : ''
  const normalized = normalizeProviderId(provider)
  return normalized || null
}

export function buildProviderSummaries(payload: {
  models?: Array<ModelCatalogEntry>
  configuredProviders?: Array<string>
}): Array<ProviderSummary> {
  const modelCounts = new Map<string, number>()

  for (const entry of payload.models ?? []) {
    const providerId = readProviderId(entry)
    if (!providerId) continue

    const current = modelCounts.get(providerId) ?? 0
    modelCounts.set(providerId, current + 1)
  }

  const configuredSet = new Set<string>()
  for (const providerId of payload.configuredProviders ?? []) {
    const normalized = normalizeProviderId(providerId)
    if (normalized) configuredSet.add(normalized)
  }

  for (const providerId of modelCounts.keys()) {
    configuredSet.add(providerId)
  }

  const summaries: Array<ProviderSummary> = []

  for (const providerId of configuredSet) {
    const metadata = getProviderInfo(providerId)
    const modelCount = modelCounts.get(providerId) ?? 0

    summaries.push({
      id: providerId,
      name: getProviderDisplayName(providerId),
      description:
        metadata?.description ||
        'Configured provider in your local Hermes setup.',
      modelCount,
      status: modelCount > 0 ? 'active' : 'configured',
    })
  }

  summaries.sort(function sortByName(a, b) {
    return a.name.localeCompare(b.name)
  })

  return summaries
}

export function readPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object') return undefined
    return (current as Record<string, unknown>)[segment]
  }, source)
}

export function coerceBoolean(value: unknown): boolean {
  return value === true
}

export function coerceString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function coerceNumber(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
}

export function defaultFormatValue(setting: { kind: string }, value: unknown): string {
  if (setting.kind === 'number') return coerceNumber(value)
  if (setting.kind === 'boolean') return coerceBoolean(value) ? 'true' : 'false'
  return coerceString(value)
}

export function getDraftValue(
  setting: { id: string; path?: string; kind: string; formatter?: (value: unknown) => string },
  config: HermesConfig | undefined,
  draftValues: Record<string, string>,
): string {
  if (setting.id in draftValues) return draftValues[setting.id]
  if (!setting.path) return ''
  const rawValue = readPath(config, setting.path)
  if (setting.formatter) return setting.formatter(rawValue)
  return defaultFormatValue(setting, rawValue)
}

export function parseTextValue(
  setting: { parser?: (value: string) => unknown },
  rawValue: string,
): unknown {
  if (setting.parser) return setting.parser(rawValue)
  return rawValue.trim()
}

export function parseNumberValue(rawValue: string): number | null {
  const trimmed = rawValue.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

export function buildModelOptions(models: Array<ModelCatalogEntry>): Array<SelectOption> {
  const seen = new Set<string>()
  const options: Array<SelectOption> = []

  for (const entry of models) {
    const modelId =
      typeof entry === 'string'
        ? entry
        : typeof entry.id === 'string'
          ? entry.id
          : typeof entry.alias === 'string'
            ? entry.alias
            : typeof entry.model === 'string'
              ? entry.model
              : ''

    if (!modelId.trim() || seen.has(modelId)) continue
    seen.add(modelId)

    const label =
      typeof entry === 'string'
        ? entry
        : typeof entry.displayName === 'string'
          ? entry.displayName
          : typeof entry.label === 'string'
            ? entry.label
            : typeof entry.name === 'string'
              ? entry.name
              : modelId

    options.push({ label, value: modelId })
  }

  options.sort(function sortOptions(a, b) {
    return a.label.localeCompare(b.label)
  })

  return options
}

export function searchMatchesSetting(
  setting: { label: string; description: string; path?: string; tab: string },
  query: string,
): boolean {
  const haystack = [
    setting.label,
    setting.description,
    setting.path,
    setting.tab,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return haystack.includes(query)
}
