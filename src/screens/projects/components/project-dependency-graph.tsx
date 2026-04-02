import type { PaperclipMission } from '@/types/paperclip'
import { PaperclipBadge } from '@/components/paperclip/paperclip-badge'
import { PaperclipCard } from '@/components/paperclip/paperclip-card'

export function ProjectDependencyGraph({ missions }: { missions: Array<PaperclipMission> }) {
  const byId = new Map(missions.map((mission) => [mission.id, mission]))

  return (
    <div className="grid gap-3">
      {missions.map((mission) => {
        const dependencies = mission.dependencyIds
          .map((dependencyId) => byId.get(dependencyId))
          .filter(Boolean) as Array<PaperclipMission>
        const dependents = missions.filter((candidate) => candidate.dependencyIds.includes(mission.id))
        return (
          <PaperclipCard key={mission.id} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="brutalist-label">Node</div>
                <div className="font-bold text-[var(--theme-text)]">{mission.title}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <PaperclipBadge label={mission.role} tone="info" />
                <PaperclipBadge label={mission.status.replaceAll('_', ' ')} tone={mission.status === 'completed' ? 'success' : mission.status === 'blocked' ? 'danger' : 'warning'} />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="brutalist-label">Depends on</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {dependencies.length > 0 ? dependencies.map((dependency) => (
                    <span key={dependency.id} className="brutalist-badge">← {dependency.title}</span>
                  )) : <span className="text-sm text-[var(--theme-muted)]">No dependencies</span>}
                </div>
              </div>
              <div>
                <div className="brutalist-label">Unlocks</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {dependents.length > 0 ? dependents.map((dependent) => (
                    <span key={dependent.id} className="brutalist-badge">→ {dependent.title}</span>
                  )) : <span className="text-sm text-[var(--theme-muted)]">No downstream missions</span>}
                </div>
              </div>
            </div>
          </PaperclipCard>
        )
      })}
      {missions.length === 0 ? <PaperclipCard>No dependency graph yet.</PaperclipCard> : null}
    </div>
  )
}
