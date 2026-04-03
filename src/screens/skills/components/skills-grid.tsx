import { AnimatePresence, motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type { SkillSummary } from './skills-types'
import { SecurityBadge } from './security-badge'

type SkillsGridProps = {
  skills: Array<SkillSummary>
  loading: boolean
  actionSkillId: string | null
  tab: 'installed' | 'marketplace'
  onOpenDetails: (skill: SkillSummary) => void
  onInstall: (skillId: string) => void
  onUninstall: (skillId: string) => void
  onToggle: (skillId: string, enabled: boolean) => void
}

export function SkillsGrid({
  skills,
  loading,
  actionSkillId,
  tab,
  onOpenDetails,
  onInstall,
  onUninstall,
  onToggle,
}: SkillsGridProps) {
  if (loading) {
    return <SkillsSkeleton count={tab === 'installed' ? 6 : 9} />
  }

  if (skills.length === 0) {
    const isMarketplace = tab === 'marketplace' || tab === ('featured' as string)
    return (
      <div className="rounded-xl border border-dashed border-primary-200 bg-primary-100/40 px-4 py-8 text-center">
        <p className="text-sm font-medium text-primary-700">
          {isMarketplace ? 'Marketplace Not Configured' : 'No skills found'}
        </p>
        <p className="mt-1 text-xs text-primary-500 text-pretty max-w-sm mx-auto">
          {isMarketplace ? (
            <>
              Run{' '}
              <code className="rounded bg-primary-200 px-1.5 py-0.5 font-mono text-[11px]">
                hermes skills sync
              </code>{' '}
              in your terminal to download the skills registry, or browse skills
              at{' '}
              <a
                href="https://github.com/NousResearch/hermes-agent"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-500 hover:underline"
              >
                Skills Hub
              </a>
            </>
          ) : (
            'Try adjusting your filters or search term'
          )}
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <AnimatePresence initial={false}>
        {skills.map((skill) => {
          const isActing = actionSkillId === skill.id

          return (
            <motion.article
              key={`${tab}-${skill.id}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="flex min-h-[220px] flex-col rounded-2xl border border-primary-200 bg-primary-50/85 p-4 shadow-sm backdrop-blur-sm"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <p className="text-xl leading-none">{skill.icon}</p>
                  <h3 className="line-clamp-1 text-base font-medium text-ink text-balance">
                    {skill.name}
                  </h3>
                  <p className="line-clamp-1 text-xs text-primary-500">
                    by {skill.author}
                  </p>
                </div>
                <span
                  className={cn(
                    'rounded-md border px-2 py-0.5 text-xs tabular-nums',
                    skill.installed
                      ? 'border-primary/40 bg-primary/15 text-primary'
                      : 'border-primary-200 bg-primary-100/60 text-primary-500',
                  )}
                >
                  {skill.installed ? 'Installed' : 'Available'}
                </span>
              </div>

              <p className="line-clamp-3 min-h-[58px] text-sm text-primary-500 text-pretty">
                {skill.description}
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <SecurityBadge security={skill.security} />
                <span className="rounded-md border border-primary-200 bg-primary-100/50 px-2 py-0.5 text-xs text-primary-500">
                  {skill.category}
                </span>
                {skill.triggers.slice(0, 2).map((trigger) => (
                  <span
                    key={`${skill.id}-${trigger}`}
                    className="rounded-md border border-primary-200 bg-primary-100/50 px-2 py-0.5 text-xs text-primary-500"
                  >
                    {trigger}
                  </span>
                ))}
              </div>

              <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenDetails(skill)}
                >
                  Details
                </Button>

                {tab === 'installed' ? (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-primary-500">
                      <Switch
                        checked={skill.enabled}
                        disabled={isActing}
                        onCheckedChange={(checked) =>
                          onToggle(skill.id, checked)
                        }
                        aria-label={`Toggle ${skill.name}`}
                      />
                      {skill.enabled ? 'Enabled' : 'Disabled'}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isActing}
                      onClick={() => onUninstall(skill.id)}
                    >
                      Uninstall
                    </Button>
                  </div>
                ) : skill.installed ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isActing}
                    onClick={() => onUninstall(skill.id)}
                  >
                    Uninstall
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={isActing}
                    onClick={() => onInstall(skill.id)}
                  >
                    Install
                  </Button>
                )}
              </div>
            </motion.article>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

type FeaturedGridProps = {
  skills: Array<SkillSummary>
  loading: boolean
  actionSkillId: string | null
  onOpenDetails: (skill: SkillSummary) => void
  onInstall: (skillId: string) => void
  onUninstall: (skillId: string) => void
}

export function FeaturedGrid({
  skills,
  loading,
  actionSkillId,
  onOpenDetails,
  onInstall,
  onUninstall,
}: FeaturedGridProps) {
  if (loading) {
    return <SkillsSkeleton count={6} large />
  }

  if (skills.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-primary-200 bg-primary-100/40 px-4 py-10 text-center text-sm text-primary-500 text-pretty">
        Featured picks are currently unavailable.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 pb-2 lg:grid-cols-2">
      {skills.map((skill) => {
        const isActing = actionSkillId === skill.id
        return (
          <article
            key={skill.id}
            className="flex min-h-0 flex-col rounded-2xl border border-primary-200 bg-primary-50/85 p-4 shadow-sm backdrop-blur-sm"
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase text-primary-500 tabular-nums">
                  {skill.featuredGroup || 'Staff Pick'}
                </p>
                <h3 className="text-lg font-medium text-ink text-balance">
                  {skill.icon} {skill.name}
                </h3>
                <p className="text-sm text-primary-500">by {skill.author}</p>
              </div>

              <span
                className={cn(
                  'rounded-md border px-2 py-0.5 text-xs tabular-nums',
                  skill.installed
                    ? 'border-primary/40 bg-primary/15 text-primary'
                    : 'border-primary-200 bg-primary-100/60 text-primary-500',
                )}
              >
                {skill.installed ? 'Installed' : 'Staff Pick'}
              </span>
            </div>

            <p className="line-clamp-3 mb-3 text-sm text-primary-500 text-pretty">
              {skill.description}
            </p>

            <div className="mt-auto flex items-center justify-between gap-2 pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenDetails(skill)}
              >
                Details
              </Button>
              {skill.installed ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isActing}
                  onClick={() => onUninstall(skill.id)}
                >
                  Uninstall
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={isActing}
                  onClick={() => onInstall(skill.id)}
                >
                  Install
                </Button>
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}

export function SkillsSkeleton({
  count,
  large = false,
}: {
  count: number
  large?: boolean
}) {
  return (
    <div
      className={cn(
        'grid gap-3',
        large
          ? 'grid-cols-1 lg:grid-cols-2'
          : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3',
      )}
    >
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={cn(
            'animate-pulse rounded-2xl border border-primary-200 bg-primary-50/70 p-4',
            large ? 'min-h-[120px]' : 'min-h-[100px]',
          )}
        >
          <div className="mb-3 h-5 w-2/5 rounded-md bg-primary-100" />
          <div className="mb-2 h-4 w-3/4 rounded-md bg-primary-100" />
          <div className="h-4 w-1/2 rounded-md bg-primary-100" />
          <div className="mt-4 h-20 rounded-xl bg-primary-100/80" />
          <div className="mt-4 h-8 w-1/3 rounded-md bg-primary-100" />
        </div>
      ))}
    </div>
  )
}
