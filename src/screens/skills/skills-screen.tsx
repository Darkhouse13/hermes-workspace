import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs'
import {
  DialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ScrollAreaRoot,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from '@/components/ui/scroll-area'
import { Markdown } from '@/components/prompt-kit/markdown'
import { toast } from '@/components/ui/toast'
import type {
  SkillsTab,
  SkillsSort,
  SkillSummary,
  SkillsApiResponse,
} from './components/skills-types'
import { PAGE_LIMIT, DEFAULT_CATEGORIES } from './components/skills-types'
import { resolveSkillSearchTier } from './components/skills-utils'
import { SecurityBadge } from './components/security-badge'
import { SkillsGrid, FeaturedGrid } from './components/skills-grid'

export function SkillsScreen() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<SkillsTab>('installed')
  const [searchInput, setSearchInput] = useState('')
  const [category, setCategory] = useState('All')
  const [sort, setSort] = useState<SkillsSort>('name')
  const [page, setPage] = useState(1)
  const [actionSkillId, setActionSkillId] = useState<string | null>(null)
  const [selectedSkill, setSelectedSkill] = useState<SkillSummary | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const skillsQuery = useQuery({
    queryKey: ['skills-browser', tab, searchInput, category, page, sort],
    queryFn: async function fetchSkills(): Promise<SkillsApiResponse> {
      const params = new URLSearchParams()
      params.set('tab', tab)
      params.set('search', searchInput)
      params.set('category', category)
      params.set('page', String(page))
      params.set('limit', String(PAGE_LIMIT))
      params.set('sort', sort)

      const response = await fetch(`/api/skills?${params.toString()}`)
      const payload = (await response.json()) as SkillsApiResponse & {
        error?: string
      }
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to fetch skills')
      }
      return payload
    },
  })

  const categories = useMemo(
    function resolveCategories() {
      const fromApi = skillsQuery.data?.categories
      if (Array.isArray(fromApi) && fromApi.length > 0) {
        return fromApi
      }
      return DEFAULT_CATEGORIES
    },
    [skillsQuery.data?.categories],
  )

  const totalPages = Math.max(
    1,
    Math.ceil((skillsQuery.data?.total || 0) / PAGE_LIMIT),
  )

  const skills = useMemo(
    function resolveVisibleSkills() {
      const sourceSkills = skillsQuery.data?.skills || []
      const normalizedQuery = searchInput.trim().toLowerCase()
      if (!normalizedQuery) {
        return sourceSkills
      }

      return sourceSkills
        .map(function mapSkillToTier(skill, index) {
          return {
            skill,
            index,
            tier: resolveSkillSearchTier(skill, normalizedQuery),
          }
        })
        .sort(function sortByTierThenOriginalOrder(a, b) {
          if (a.tier !== b.tier) return a.tier - b.tier
          return a.index - b.index
        })
        .map(function unwrapSkill(entry) {
          return entry.skill
        })
    },
    [searchInput, skillsQuery.data?.skills],
  )

  async function runSkillAction(
    action: 'install' | 'uninstall' | 'toggle',
    payload: {
      skillId: string
      enabled?: boolean
    },
  ) {
    setActionError(null)
    setActionSkillId(payload.skillId)

    try {
      const response = await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          skillId: payload.skillId,
          enabled: payload.enabled,
        }),
      })

      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || 'Action failed')
      }

      await queryClient.invalidateQueries({ queryKey: ['skills-browser'] })
      setSelectedSkill(function updateSelectedSkill(current) {
        if (!current || current.id !== payload.skillId) return current
        if (action === 'install') {
          return {
            ...current,
            installed: true,
            enabled: true,
          }
        }
        if (action === 'uninstall') {
          return {
            ...current,
            installed: false,
            enabled: false,
          }
        }
        return {
          ...current,
          enabled: payload.enabled ?? current.enabled,
        }
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setActionError(errorMessage)
      toast(errorMessage, { type: 'error', icon: '❌' })
    } finally {
      setActionSkillId(null)
    }
  }

  function handleTabChange(nextTab: string) {
    const parsedTab: SkillsTab =
      nextTab === 'installed' ||
      nextTab === 'marketplace' ||
      nextTab === 'featured'
        ? nextTab
        : 'installed'

    setTab(parsedTab)
    setPage(1)
    if (parsedTab !== 'marketplace') {
      setCategory('All')
      setSort('name')
    }
  }

  function handleSearchChange(value: string) {
    setSearchInput(value)
    setPage(1)
  }

  function handleCategoryChange(value: string) {
    setCategory(value)
    setPage(1)
  }

  function handleSortChange(value: SkillsSort) {
    setSort(value)
    setPage(1)
  }

  return (
    <div className="min-h-full overflow-y-auto bg-surface text-ink">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-4 py-6 pb-[calc(var(--tabbar-h,80px)+1.5rem)] sm:px-6 lg:px-8">
        <header className="rounded-2xl border border-primary-200 bg-primary-50/85 p-4 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase text-primary-500 tabular-nums">
                Hermes Workspace Marketplace
              </p>
              <h1 className="text-2xl font-medium text-ink text-balance sm:text-3xl">
                Skills Browser
              </h1>
              <p className="text-sm text-primary-500 text-pretty sm:text-base">
                Discover, install, and manage skills across your local workspace
                and Skills Hub.
              </p>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-primary-200 bg-primary-50/80 p-3 backdrop-blur-xl sm:p-4">
          <Tabs value={tab} onValueChange={handleTabChange}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <TabsList
                className="w-full rounded-xl border border-primary-200 bg-primary-100/60 p-1 sm:w-auto"
                variant="default"
              >
                <TabsTab value="installed" className="flex-1 sm:min-w-[132px]">
                  Installed
                </TabsTab>
                <TabsTab value="marketplace" className="flex-1 sm:min-w-[168px]">
                  Marketplace
                </TabsTab>
                <TabsTab value="featured" className="flex-1 sm:min-w-[120px]">
                  Featured
                </TabsTab>
              </TabsList>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={searchInput}
                  onChange={(event) => handleSearchChange(event.target.value)}
                  placeholder="Search by name, tags, or description"
                  className="h-9 w-full min-w-0 rounded-lg border border-primary-200 bg-primary-100/60 px-3 text-sm text-ink outline-none transition-colors focus:border-primary sm:min-w-[220px]"
                />

                {tab === 'marketplace' ? (
                  <select
                    value={category}
                    onChange={(event) =>
                      handleCategoryChange(event.target.value)
                    }
                    className="h-9 rounded-lg border border-primary-200 bg-primary-100/60 px-3 text-sm text-ink outline-none"
                  >
                    {categories.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                ) : null}

                {tab === 'marketplace' ? (
                  <select
                    value={sort}
                    onChange={(event) =>
                      handleSortChange(
                        event.target.value === 'category' ? 'category' : 'name',
                      )
                    }
                    className="h-9 rounded-lg border border-primary-200 bg-primary-100/60 px-3 text-sm text-ink outline-none"
                  >
                    <option value="name">Name A-Z</option>
                    <option value="category">Category</option>
                  </select>
                ) : null}
              </div>
            </div>

            {actionError ? (
              <p className="rounded-lg border border-primary-200 bg-primary-100/60 px-3 py-2 text-sm text-ink">
                {actionError}
              </p>
            ) : null}

            <TabsPanel value="installed" className="pt-2">
              <SkillsGrid
                skills={skills}
                loading={skillsQuery.isPending}
                actionSkillId={actionSkillId}
                tab="installed"
                onOpenDetails={setSelectedSkill}
                onInstall={(skillId) => runSkillAction('install', { skillId })}
                onUninstall={(skillId) =>
                  runSkillAction('uninstall', { skillId })
                }
                onToggle={(skillId, enabled) =>
                  runSkillAction('toggle', { skillId, enabled })
                }
              />
            </TabsPanel>

            <TabsPanel value="marketplace" className="pt-2">
              <SkillsGrid
                skills={skills}
                loading={skillsQuery.isPending}
                actionSkillId={actionSkillId}
                tab="marketplace"
                onOpenDetails={setSelectedSkill}
                onInstall={(skillId) => runSkillAction('install', { skillId })}
                onUninstall={(skillId) =>
                  runSkillAction('uninstall', { skillId })
                }
                onToggle={(skillId, enabled) =>
                  runSkillAction('toggle', { skillId, enabled })
                }
              />
            </TabsPanel>

            <TabsPanel value="featured" className="pt-2">
              <FeaturedGrid
                skills={skills}
                loading={skillsQuery.isPending}
                actionSkillId={actionSkillId}
                onOpenDetails={setSelectedSkill}
                onInstall={(skillId) => runSkillAction('install', { skillId })}
                onUninstall={(skillId) =>
                  runSkillAction('uninstall', { skillId })
                }
              />
            </TabsPanel>
          </Tabs>
        </section>

        {tab !== 'featured' ? (
          <footer className="flex items-center justify-between rounded-xl border border-primary-200 bg-primary-50/80 px-3 py-2.5 text-sm text-primary-500 tabular-nums">
            <span>
              {(skillsQuery.data?.total || 0).toLocaleString()} total skills
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || skillsQuery.isPending}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </Button>
              <span className="min-w-[82px] text-center">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || skillsQuery.isPending}
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
              >
                Next
              </Button>
            </div>
          </footer>
        ) : null}
      </div>

      <DialogRoot
        open={Boolean(selectedSkill)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedSkill(null)
          }
        }}
      >
        <DialogContent className="w-[min(960px,95vw)] border-primary-200 bg-primary-50/95 backdrop-blur-sm">
          {selectedSkill ? (
            <div className="flex max-h-[85vh] flex-col">
              <div className="border-b border-primary-200 px-5 py-4">
                <DialogTitle className="text-balance">
                  {selectedSkill.icon} {selectedSkill.name}
                </DialogTitle>
                <DialogDescription className="mt-1 text-pretty">
                  by {selectedSkill.author} • {selectedSkill.category} •{' '}
                  {selectedSkill.fileCount.toLocaleString()} files
                </DialogDescription>
                {selectedSkill.security && (
                  <div className="mt-3 rounded-xl border border-primary-200 bg-primary-50/80 overflow-hidden">
                    <SecurityBadge
                      security={selectedSkill.security}
                      compact={false}
                    />
                  </div>
                )}
              </div>

              <ScrollAreaRoot className="h-[56vh]">
                <ScrollAreaViewport className="px-5 py-4">
                  <div className="space-y-3">
                    {selectedSkill.homepage ? (
                      <p className="text-sm text-primary-500 text-pretty">
                        Homepage:{' '}
                        <a
                          href={selectedSkill.homepage}
                          target="_blank"
                          rel="noreferrer"
                          className="underline decoration-border underline-offset-4 hover:decoration-primary"
                        >
                          {selectedSkill.homepage}
                        </a>
                      </p>
                    ) : null}

                    <div className="flex flex-wrap gap-1.5">
                      {selectedSkill.triggers.length > 0 ? (
                        selectedSkill.triggers.slice(0, 8).map((trigger) => (
                          <span
                            key={trigger}
                            className="rounded-md border border-primary-200 bg-primary-100/50 px-2 py-0.5 text-xs text-primary-500"
                          >
                            {trigger}
                          </span>
                        ))
                      ) : (
                        <span className="rounded-md border border-primary-200 bg-primary-100/50 px-2 py-0.5 text-xs text-primary-500">
                          No triggers listed
                        </span>
                      )}
                    </div>

                    <article className="rounded-xl border border-primary-200 bg-primary-100/30 p-4 backdrop-blur-sm">
                      <Markdown>
                        {selectedSkill.content ||
                          `# ${selectedSkill.name}\n\n${selectedSkill.description}`}
                      </Markdown>
                    </article>
                  </div>
                </ScrollAreaViewport>
                <ScrollAreaScrollbar>
                  <ScrollAreaThumb />
                </ScrollAreaScrollbar>
              </ScrollAreaRoot>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-primary-200 px-5 py-3">
                <p className="text-sm text-primary-500 text-pretty">
                  Source:{' '}
                  <code className="inline-code">
                    {selectedSkill.sourcePath}
                  </code>
                </p>
                <div className="flex items-center gap-2">
                  {selectedSkill.installed ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={actionSkillId === selectedSkill.id}
                      onClick={() => {
                        runSkillAction('uninstall', {
                          skillId: selectedSkill.id,
                        })
                      }}
                    >
                      Uninstall
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled={actionSkillId === selectedSkill.id}
                      onClick={() =>
                        runSkillAction('install', { skillId: selectedSkill.id })
                      }
                    >
                      Install
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedSkill(null)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </DialogRoot>
    </div>
  )
}
