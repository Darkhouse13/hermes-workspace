import {
  Add01Icon,
  CheckmarkCircle02Icon,
  Delete02Icon,
  Edit01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { useQuery } from '@tanstack/react-query'
import { ProviderIcon } from './provider-icon'
import type { ModelCatalogEntry } from '@/lib/model-types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ProviderStatus, ProviderSummary } from '../provider-api'

// ---------------------------------------------------------------------------
// ProviderStatusBadge
// ---------------------------------------------------------------------------

export function ProviderStatusBadge({ status }: { status: ProviderStatus }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-primary-300 bg-white px-2 py-0.5 text-xs font-medium text-primary-700">
      <HugeiconsIcon icon={CheckmarkCircle02Icon} size={20} strokeWidth={1.5} />
      {status === 'active' ? 'Active' : 'Configured'}
    </span>
  )
}

// ---------------------------------------------------------------------------
// ProviderManagementSection
// ---------------------------------------------------------------------------

export function ProviderManagementSection(props: {
  embedded: boolean
  providerSummaries: Array<ProviderSummary>
  modelsQuery: ReturnType<typeof useQuery<{ ok?: boolean; models?: Array<ModelCatalogEntry>; configuredProviders?: Array<string> }>>
  deletingId: string | null
  onAddProvider: () => void
  onEdit: (provider: ProviderSummary) => void
  onDelete: (provider: ProviderSummary) => void
}) {
  const {
    embedded,
    providerSummaries,
    modelsQuery,
    deletingId,
    onAddProvider,
    onEdit,
    onDelete,
  } = props

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 rounded-xl border border-primary-200 bg-primary-50/80 px-5 py-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="space-y-1.5">
          <h2 className="text-base font-semibold text-primary-900">
            Provider Setup
          </h2>
          <p className="text-sm text-primary-600">
            View configured providers and walk through safe setup instructions
            for new providers.
          </p>
        </div>
        <Button size="sm" onClick={onAddProvider}>
          <HugeiconsIcon icon={Add01Icon} size={20} strokeWidth={1.5} />
          Add Provider
        </Button>
      </header>

      <section className="rounded-2xl border border-primary-200 bg-primary-50/80 p-4 shadow-sm md:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-medium text-primary-900">
              Configured Providers
            </h3>
            <p className="mt-1 text-xs text-primary-600">
              API keys stay in your local Hermes config and are never sent to Studio.
            </p>
          </div>
          <p className="text-xs text-primary-600 tabular-nums">
            {providerSummaries.length} provider
            {providerSummaries.length === 1 ? '' : 's'}
          </p>
        </div>

        {modelsQuery.isPending ? (
          <p className="rounded-xl border border-primary-200 bg-white px-3 py-2 text-sm text-primary-600">
            Loading providers from Hermes...
          </p>
        ) : null}

        {modelsQuery.error ? (
          <div className="rounded-xl border border-primary-200 bg-white px-4 py-3">
            <p className="mb-2 text-sm text-primary-700">
              Unable to load providers right now. Check your Hermes connection.
            </p>
            <Button variant="outline" size="sm" onClick={() => modelsQuery.refetch()}>
              Retry
            </Button>
          </div>
        ) : null}

        {!modelsQuery.isPending &&
        !modelsQuery.error &&
        providerSummaries.length === 0 ? (
          <div className="rounded-xl border border-primary-200 bg-white px-4 py-4">
            <p className="text-sm text-primary-700">
              No providers are configured yet. Use Add Provider to open setup
              instructions.
            </p>
          </div>
        ) : null}

        {providerSummaries.length > 0 ? (
          <div className={cn('grid gap-3', embedded ? '' : 'md:grid-cols-2')}>
            {providerSummaries.map(function mapProvider(provider) {
              const isDeleting = deletingId === provider.id

              return (
                <article
                  key={provider.id}
                  className="rounded-2xl border border-primary-200 bg-white p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <span className="inline-flex size-9 items-center justify-center rounded-xl border border-primary-200 bg-primary-100/70">
                        <ProviderIcon providerId={provider.id} />
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-medium text-primary-900">
                          {provider.name}
                        </h3>
                        <p className="mt-0.5 text-xs text-primary-600 line-clamp-2">
                          {provider.description}
                        </p>
                      </div>
                    </div>
                    <ProviderStatusBadge status={provider.status} />
                  </div>

                  <div className="mt-3 flex items-center justify-between rounded-xl border border-primary-200 bg-primary-50 px-2.5 py-2">
                    <span className="text-xs text-primary-600">
                      Available models
                    </span>
                    <span className="text-sm font-medium text-primary-900 tabular-nums">
                      {provider.modelCount}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1.5"
                      onClick={function onProviderEdit() {
                        onEdit(provider)
                      }}
                      disabled={isDeleting}
                      aria-label={`Edit ${provider.name}`}
                    >
                      <HugeiconsIcon
                        icon={Edit01Icon}
                        size={14}
                        strokeWidth={1.5}
                      />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1.5"
                      onClick={function onProviderDelete() {
                        onDelete(provider)
                      }}
                      disabled={isDeleting}
                      aria-label={`Delete ${provider.name}`}
                    >
                      <HugeiconsIcon
                        icon={Delete02Icon}
                        size={14}
                        strokeWidth={1.5}
                      />
                      {isDeleting ? 'Removing...' : 'Delete'}
                    </Button>
                  </div>
                </article>
              )
            })}
          </div>
        ) : null}
      </section>
    </div>
  )
}
