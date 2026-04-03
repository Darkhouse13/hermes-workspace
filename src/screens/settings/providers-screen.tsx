import { Search01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { ActiveModelCard } from './components/active-model-config'
import { ProviderManagementSection } from './components/provider-card'
import { ProviderWizard } from './components/provider-wizard'
import BackendUnavailableState from '@/components/backend-unavailable-state'
import type { ProviderSummaryForEdit } from './components/provider-wizard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { toast } from '@/components/ui/toast'
import { getUnavailableReason, isFeatureAvailable } from '@/lib/feature-gates'
import { cn } from '@/lib/utils'
import type {
  ConfigPatchResponse,
  ConfigQueryResponse,
  HermesConfig,
  SelectOption,
} from './provider-api'
import {
  buildModelOptions,
  buildProviderSummaries,
  coerceBoolean,
  coerceString,
  fetchModels,
  getDraftValue,
  parseNumberValue,
  parseTextValue,
  readPath,
  searchMatchesSetting,
} from './provider-api'
import type { ProviderSummary } from './provider-api'
import type { SaveSettingPayload, SettingDefinition, SettingsTabId } from './provider-settings'
import { SETTINGS, TAB_ORDER } from './provider-settings'

type ProvidersScreenProps = {
  embedded?: boolean
}

// ---------------------------------------------------------------------------
// SettingCard
// ---------------------------------------------------------------------------

function SettingCard(props: {
  setting: SettingDefinition
  config: HermesConfig | undefined
  draftValues: Record<string, string>
  setDraftValues: React.Dispatch<React.SetStateAction<Record<string, string>>>
  saveSetting: (payload: SaveSettingPayload) => Promise<void>
  isSaving: boolean
  savePath: string | null
  modelOptions: Array<SelectOption>
}) {
  const {
    setting,
    config,
    draftValues,
    setDraftValues,
    saveSetting,
    isSaving,
    savePath,
    modelOptions,
  } = props

  const disabled = setting.unsupported || isSaving
  const isActiveSave = Boolean(setting.path) && savePath === setting.path
  const draftValue = getDraftValue(setting, config, draftValues)
  const currentValue = setting.path ? readPath(config, setting.path) : undefined

  async function commit(rawValue: string) {
    if (!setting.path || setting.unsupported) return

    let nextValue: unknown = rawValue
    if (setting.kind === 'number') {
      nextValue = parseNumberValue(rawValue)
      if (nextValue === null) {
        toast(`Enter a valid number for ${setting.label}`, { type: 'error' })
        return
      }
    } else if (setting.kind === 'multiline' || setting.kind === 'text') {
      nextValue = parseTextValue(setting, rawValue)
    }

    const currentSerialized = JSON.stringify(currentValue ?? null)
    const nextSerialized = JSON.stringify(nextValue ?? null)
    if (currentSerialized === nextSerialized) {
      setDraftValues((prev) => {
        const next = { ...prev }
        delete next[setting.id]
        return next
      })
      return
    }

    await saveSetting({
      path: setting.path,
      value: nextValue,
      label: setting.label,
    })

    setDraftValues((prev) => {
      const next = { ...prev }
      delete next[setting.id]
      return next
    })
  }

  return (
    <article className="rounded-2xl border border-primary-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-primary-900">{setting.label}</h3>
            {setting.unsupported ? (
              <span className="rounded-full border border-primary-300 bg-primary-100 px-2 py-0.5 text-[11px] font-medium text-primary-700">
                Not available
              </span>
            ) : null}
            {isActiveSave ? (
              <span className="rounded-full border border-primary-300 bg-primary-50 px-2 py-0.5 text-[11px] font-medium text-primary-700">
                Saving...
              </span>
            ) : null}
          </div>
          <p className="text-sm text-primary-600">{setting.description}</p>
          {setting.path ? (
            <p className="text-xs text-primary-500">{setting.path}</p>
          ) : null}
        </div>

        <div className="w-full md:max-w-[420px]">
          {setting.kind === 'boolean' ? (
            <div className="flex min-h-10 items-center justify-end">
              <Switch
                checked={coerceBoolean(currentValue)}
                disabled={disabled}
                aria-label={setting.label}
                onCheckedChange={(checked) => {
                  if (!setting.path || setting.unsupported) return
                  void saveSetting({
                    path: setting.path,
                    value: checked,
                    label: setting.label,
                  })
                }}
              />
            </div>
          ) : null}

          {setting.kind === 'select' ? (
            <select
              className="w-full rounded-lg border border-primary-200 bg-surface px-3 py-2 text-sm text-primary-900 outline-none"
              value={coerceString(currentValue)}
              disabled={disabled}
              onChange={(event) => {
                if (!setting.path || setting.unsupported) return
                void saveSetting({
                  path: setting.path,
                  value: event.target.value,
                  label: setting.label,
                })
              }}
            >
              <option value="">Select...</option>
              {(setting.options ?? []).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : null}

          {setting.kind === 'text' ? (
            <>
              <Input
                value={draftValue}
                disabled={disabled}
                placeholder={setting.placeholder}
                list={setting.id === 'primary-model' ? 'settings-model-options' : undefined}
                onChange={(event) => {
                  const nextValue = event.target.value
                  setDraftValues((prev) => ({
                    ...prev,
                    [setting.id]: nextValue,
                  }))
                }}
                onBlur={() => {
                  void commit(draftValue)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void commit(draftValue)
                  }
                }}
              />
              {setting.id === 'primary-model' ? (
                <datalist id="settings-model-options">
                  {modelOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </datalist>
              ) : null}
            </>
          ) : null}

          {setting.kind === 'number' ? (
            <Input
              type="number"
              value={draftValue}
              disabled={disabled}
              min={setting.min}
              step={setting.step}
              placeholder={setting.placeholder}
              onChange={(event) => {
                const nextValue = event.target.value
                setDraftValues((prev) => ({
                  ...prev,
                  [setting.id]: nextValue,
                }))
              }}
              onBlur={() => {
                void commit(draftValue)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void commit(draftValue)
                }
              }}
            />
          ) : null}

          {setting.kind === 'multiline' ? (
            <textarea
              className="min-h-[88px] w-full rounded-lg border border-primary-200 bg-surface px-3 py-2 text-sm text-primary-900 outline-none placeholder:text-primary-500"
              value={draftValue}
              disabled={disabled}
              rows={setting.rows ?? 4}
              placeholder={setting.placeholder}
              onChange={(event) => {
                const nextValue = event.target.value
                setDraftValues((prev) => ({
                  ...prev,
                  [setting.id]: nextValue,
                }))
              }}
              onBlur={() => {
                void commit(draftValue)
              }}
            />
          ) : null}
        </div>
      </div>
    </article>
  )
}

// ---------------------------------------------------------------------------
// ProvidersScreen
// ---------------------------------------------------------------------------

export function ProvidersScreen({ embedded = false }: ProvidersScreenProps) {
  const queryClient = useQueryClient()
  const configAvailable = isFeatureAvailable('config')
  const [activeTab, setActiveTab] = useState<SettingsTabId>('providers')
  const [search, setSearch] = useState('')
  const [draftValues, setDraftValues] = useState<Record<string, string>>({})
  const [wizardOpen, setWizardOpen] = useState(false)
  const [editingProvider, setEditingProvider] =
    useState<ProviderSummaryForEdit | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const modelsQuery = useQuery({
    queryKey: ['hermes', 'providers', 'models'],
    queryFn: fetchModels,
    refetchInterval: 60_000,
    retry: false,
    enabled: configAvailable,
  })

  const configQuery = useQuery({
    queryKey: ['hermes', 'config'],
    queryFn: async () => {
      const response = await fetch('/api/config-get')
      const payload = (await response.json().catch(() => ({}))) as ConfigQueryResponse
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || `HTTP ${response.status}`)
      }
      return (payload.payload ?? {})
    },
    retry: 1,
    enabled: configAvailable,
  })

  const saveMutation = useMutation({
    mutationFn: async ({ path, value }: SaveSettingPayload) => {
      const response = await fetch('/api/config-patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, value }),
      })
      const payload = (await response.json().catch(() => ({}))) as ConfigPatchResponse
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || `HTTP ${response.status}`)
      }
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['hermes', 'config'] })
      toast(`${variables.label} saved`, { type: 'success' })
    },
    onError: (error) => {
      toast(error instanceof Error ? error.message : 'Failed to save setting', {
        type: 'error',
      })
    },
  })

  const providerSummaries = useMemo(
    function resolveProviderSummaries() {
      return buildProviderSummaries({
        models: Array.isArray(modelsQuery.data?.models)
          ? modelsQuery.data.models
          : [],
        configuredProviders: Array.isArray(
          modelsQuery.data?.configuredProviders,
        )
          ? modelsQuery.data.configuredProviders
          : [],
      })
    },
    [modelsQuery.data?.configuredProviders, modelsQuery.data?.models],
  )

  const modelOptions = useMemo(
    function resolveModelOptions() {
      return buildModelOptions(
        Array.isArray(modelsQuery.data?.models) ? modelsQuery.data.models : [],
      )
    },
    [modelsQuery.data?.models],
  )

  const searchQuery = search.trim().toLowerCase()

  const filteredSettings = useMemo(
    function filterSettings() {
      if (!searchQuery) return SETTINGS
      return SETTINGS.filter((setting) => searchMatchesSetting(setting, searchQuery))
    },
    [searchQuery],
  )

  const settingsByTab = useMemo(
    function groupSettingsByTab() {
      return TAB_ORDER.reduce<Record<SettingsTabId, Array<SettingDefinition>>>(
        (accumulator, tab) => {
          accumulator[tab.id] = filteredSettings.filter(
            (setting) => setting.tab === tab.id,
          )
          return accumulator
        },
        {
          providers: [],
          models: [],
          agents: [],
          session: [],
          memory: [],
        },
      )
    },
    [filteredSettings],
  )

  function handleEdit(provider: ProviderSummary) {
    setEditingProvider({ id: provider.id, name: provider.name })
    setWizardOpen(true)
  }

  async function handleDelete(provider: ProviderSummary) {
    const confirmed = window.confirm(
      `Remove provider "${provider.name}"? This will delete the API key from your local config.`,
    )
    if (!confirmed) return

    setDeletingId(provider.id)
    try {
      const res = await fetch('/api/hermes-config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'remove-provider',
          provider: provider.id,
        }),
      })
      const data = (await res.json()) as { ok: boolean; error?: string }
      if (!data.ok) {
        toast(`Failed to remove provider: ${data.error ?? 'Unknown error'}`, {
          type: 'error',
        })
      } else {
        await queryClient.invalidateQueries({
          queryKey: ['hermes', 'providers', 'models'],
        })
        toast(`Provider "${provider.name}" removed`, { type: 'success' })
      }
    } catch {
      toast('Network error — could not remove provider.', { type: 'error' })
    } finally {
      setDeletingId(null)
    }
  }

  async function saveSetting(payload: SaveSettingPayload) {
    await saveMutation.mutateAsync(payload)
  }

  function handleWizardOpenChange(open: boolean) {
    setWizardOpen(open)
    if (!open) {
      setEditingProvider(null)
    }
  }

  const totalSearchMatches = filteredSettings.length

  if (!configAvailable) {
    return (
      <div className={cn(embedded ? 'h-full bg-primary-50' : 'min-h-full bg-surface')}>
        <BackendUnavailableState
          feature="Provider Setup"
          description={getUnavailableReason('config')}
        />
      </div>
    )
  }

  return (
    <div className={cn(embedded ? 'h-full bg-primary-50' : 'min-h-full bg-surface')}>
      <main
        className={cn(
          'min-h-full px-4 pb-24 pt-5 text-primary-900 md:px-6 md:pt-8',
          embedded && 'px-4 pb-6 pt-4 md:px-6 md:pb-6 md:pt-4',
        )}
      >
        <section className="mx-auto w-full max-w-[1480px] space-y-5">
          <header className="flex flex-col gap-4 rounded-xl border border-primary-200 bg-primary-50/80 px-5 py-4 shadow-sm">
            <div className="space-y-1">
              <h1 className="hidden md:block text-lg font-semibold text-primary-900">
                Settings
              </h1>
              <p className="text-sm text-primary-600">
                Configure providers plus Hermes agent defaults in one place.
              </p>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <label className="relative w-full md:max-w-md">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-primary-500">
                  <HugeiconsIcon icon={Search01Icon} size={18} strokeWidth={1.8} />
                </span>
                <Input
                  value={search}
                  type="search"
                  placeholder="Search settings, paths, or descriptions"
                  className="pl-10"
                  onChange={(event) => {
                    setSearch(event.target.value)
                  }}
                />
              </label>

              <div className="text-sm text-primary-600">
                {searchQuery
                  ? `${totalSearchMatches} matching setting${totalSearchMatches === 1 ? '' : 's'}`
                  : `${SETTINGS.length} configurable defaults`}
              </div>
            </div>
          </header>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as SettingsTabId)}>
            <TabsList
              variant="underline"
              className="w-full flex-nowrap overflow-x-auto justify-start gap-2 rounded-xl border border-primary-200 bg-white px-3 py-2"
            >
              {TAB_ORDER.map((tab) => {
                const count =
                  tab.id === 'providers'
                    ? providerSummaries.length
                    : settingsByTab[tab.id].length
                return (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="rounded-lg px-3 py-2 text-sm"
                  >
                    {tab.label}
                    <span className="ml-1 rounded-full bg-primary-100 px-1.5 py-0.5 text-[11px] text-primary-700">
                      {count}
                    </span>
                  </TabsTrigger>
                )
              })}
            </TabsList>

            <TabsContent value="providers" className="space-y-5">
              <ActiveModelCard modelOptions={modelOptions} />
              <ProviderManagementSection
                embedded={embedded}
                providerSummaries={providerSummaries}
                modelsQuery={modelsQuery}
                deletingId={deletingId}
                onAddProvider={() => {
                  setEditingProvider(null)
                  setWizardOpen(true)
                }}
                onEdit={handleEdit}
                onDelete={(provider) => {
                  void handleDelete(provider)
                }}
              />
            </TabsContent>

            {TAB_ORDER.filter((tab) => tab.id !== 'providers').map((tab) => {
              const items = settingsByTab[tab.id]
              return (
                <TabsContent key={tab.id} value={tab.id} className="space-y-4">
                  {configQuery.isPending ? (
                    <div className="rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-600">
                      Loading current configuration...
                    </div>
                  ) : null}

                  {configQuery.error ? (
                    <div className="rounded-xl border border-primary-200 bg-white px-4 py-3">
                      <p className="text-sm text-primary-700">
                        Unable to load configuration right now.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => configQuery.refetch()}
                      >
                        Retry
                      </Button>
                    </div>
                  ) : null}

                  {!configQuery.isPending && !configQuery.error && items.length === 0 ? (
                    <div className="rounded-xl border border-primary-200 bg-primary-50 px-4 py-4 text-sm text-primary-600">
                      No settings in this tab match your current search.
                    </div>
                  ) : null}

                  {!configQuery.isPending && !configQuery.error
                    ? items.map((setting) => (
                        <SettingCard
                          key={setting.id}
                          setting={setting}
                          config={configQuery.data}
                          draftValues={draftValues}
                          setDraftValues={setDraftValues}
                          saveSetting={saveSetting}
                          isSaving={saveMutation.isPending}
                          savePath={saveMutation.variables?.path ?? null}
                          modelOptions={modelOptions}
                        />
                      ))
                    : null}
                </TabsContent>
              )
            })}
          </Tabs>
        </section>
      </main>

      <ProviderWizard
        open={wizardOpen}
        onOpenChange={handleWizardOpenChange}
        editProvider={editingProvider}
      />
    </div>
  )
}
