import type { SelectOption } from './provider-api'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SettingsTabId = 'providers' | 'models' | 'agents' | 'session' | 'memory'
export type SettingKind = 'text' | 'number' | 'select' | 'boolean' | 'multiline'

export type SettingDefinition = {
  id: string
  tab: SettingsTabId
  label: string
  description: string
  path?: string
  kind: SettingKind
  options?: Array<SelectOption>
  placeholder?: string
  min?: number
  step?: number
  rows?: number
  unsupported?: boolean
  formatter?: (value: unknown) => string
  parser?: (value: string) => unknown
}

export type SaveSettingPayload = {
  path: string
  value: unknown
  label: string
}

// ---------------------------------------------------------------------------
// Tab order
// ---------------------------------------------------------------------------

export const TAB_ORDER: Array<{ id: SettingsTabId; label: string }> = [
  { id: 'providers', label: 'Providers' },
  { id: 'models', label: 'Models' },
  { id: 'agents', label: 'AI & Agents' },
  { id: 'session', label: 'Session' },
  { id: 'memory', label: 'Memory' },
]

// ---------------------------------------------------------------------------
// Memory provider options
// ---------------------------------------------------------------------------

export const MEMORY_PROVIDER_OPTIONS: Array<SelectOption> = [
  { label: 'Local', value: 'local' },
  { label: 'OpenAI', value: 'openai' },
  { label: 'Gemini', value: 'gemini' },
  { label: 'Voyage', value: 'voyage' },
  { label: 'Mistral', value: 'mistral' },
  { label: 'Ollama', value: 'ollama' },
]

export const MEMORY_FALLBACK_OPTIONS: Array<SelectOption> = [
  { label: 'None', value: 'none' },
  ...MEMORY_PROVIDER_OPTIONS,
]

// ---------------------------------------------------------------------------
// Formatters / parsers
// ---------------------------------------------------------------------------

export function formatStringList(value: unknown): string {
  if (!Array.isArray(value)) return ''
  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean)
    .join('\n')
}

export function parseStringList(value: string): Array<string> {
  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

// ---------------------------------------------------------------------------
// Settings definitions
// ---------------------------------------------------------------------------

export const SETTINGS: Array<SettingDefinition> = [
  {
    id: 'primary-model',
    tab: 'models',
    path: 'agents.defaults.model.primary',
    label: 'Default model',
    description: 'Primary model used for new agents unless a specific agent overrides it.',
    kind: 'text',
    placeholder: 'provider/model',
  },
  {
    id: 'fallback-chain',
    tab: 'models',
    path: 'agents.defaults.model.fallbacks',
    label: 'Fallback chain',
    description: 'Ordered fallback models. Use one per line or separate with commas.',
    kind: 'multiline',
    rows: 3,
    placeholder: 'anthropic-oauth/claude-sonnet-4-6',
    formatter: formatStringList,
    parser: parseStringList,
  },
  {
    id: 'context-tokens-models',
    tab: 'models',
    path: 'agents.defaults.contextTokens',
    label: 'Context tokens',
    description: 'Default token budget applied to agents when no narrower override is present.',
    kind: 'number',
    min: 1,
    step: 1000,
  },
  // Thinking/reasoning settings removed — not supported by Hermes Agent
  // Legacy settings removed: bootstrap, block streaming,
  // compaction, thinking, verbose, and fast mode do not apply here.
  {
    id: 'context-tokens-session',
    tab: 'session',
    path: 'agents.defaults.contextTokens',
    label: 'Session context tokens',
    description: 'Same agent default context budget surfaced here for session setup workflows.',
    kind: 'number',
    min: 1,
    step: 1000,
  },
  {
    id: 'memory-provider',
    tab: 'memory',
    path: 'agents.defaults.memorySearch.provider',
    label: 'Memory search provider',
    description: 'Embedding provider used for memory lookup and consolidation.',
    kind: 'select',
    options: MEMORY_PROVIDER_OPTIONS,
  },
  {
    id: 'memory-fallback',
    tab: 'memory',
    path: 'agents.defaults.memorySearch.fallback',
    label: 'Memory fallback provider',
    description: 'Fallback provider when the primary memory search provider is unavailable.',
    kind: 'select',
    options: MEMORY_FALLBACK_OPTIONS,
  },
  {
    id: 'memory-sync-on-session-start',
    tab: 'memory',
    path: 'agents.defaults.memorySearch.sync.onSessionStart',
    label: 'Sync on session start',
    description: 'Refresh indexed memory paths when a new session starts.',
    kind: 'boolean',
  },
  {
    id: 'memory-sync-on-search',
    tab: 'memory',
    path: 'agents.defaults.memorySearch.sync.onSearch',
    label: 'Sync on search',
    description: 'Run a sync before memory search queries.',
    kind: 'boolean',
  },
  {
    id: 'memory-sync-interval',
    tab: 'memory',
    path: 'agents.defaults.memorySearch.sync.intervalMinutes',
    label: 'Consolidation interval',
    description: 'Background memory consolidation cadence, in minutes.',
    kind: 'number',
    min: 0,
    step: 5,
  },
]
