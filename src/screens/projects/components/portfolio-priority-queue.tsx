import { Link } from '@tanstack/react-router'
import type { PaperclipMission, PaperclipProjectSummary } from '@/types/paperclip'
import { PaperclipBadge } from '@/components/paperclip/paperclip-badge'
import { PaperclipCard } from '@/components/paperclip/paperclip-card'

export function PortfolioPriorityQueue({
  projects,
  missions,
}: {
  projects: Array<PaperclipProjectSummary>
  missions: Array<PaperclipMission>
}) {
  const projectById = new Map(projects.map((entry) => [entry.project.id, entry.project]))
  const queued = [...missions]
    .filter((mission) => mission.status === 'queued' || mission.status === 'in_progress' || mission.status === 'blocked')
    .sort((a, b) => b.priority - a.priority || b.riskTier - a.riskTier || Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, 8)

  return (
    <div className="grid gap-3">
      {queued.map((mission, index) => {
        const project = projectById.get(mission.projectId)
        return (
          <PaperclipCard key={mission.id} className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="brutalist-label">Priority #{index + 1}</div>
                <div className="font-bold text-[var(--theme-text)]">{mission.title}</div>
                <div className="mt-1 text-xs text-[var(--theme-muted)]">{project?.name || mission.projectId}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <PaperclipBadge label={`P${mission.priority}`} tone="info" />
                <PaperclipBadge label={`RISK ${mission.riskTier}`} tone={mission.riskTier >= 2 ? 'warning' : 'info'} />
                <PaperclipBadge label={mission.status.replaceAll('_', ' ')} tone={mission.status === 'blocked' ? 'danger' : mission.status === 'in_progress' ? 'warning' : 'success'} />
              </div>
            </div>
            <p className="text-sm text-[var(--theme-muted)]">{mission.goal}</p>
            <div className="flex flex-wrap gap-2">
              <Link to="/projects/$projectId" params={{ projectId: mission.projectId }} className="brutalist-button">Open project</Link>
              {mission.linkedSessionIds.at(-1) ? <Link to="/chat/$sessionKey" params={{ sessionKey: mission.linkedSessionIds.at(-1)! }} className="brutalist-button">Open latest session</Link> : null}
            </div>
          </PaperclipCard>
        )
      })}
      {queued.length === 0 ? <PaperclipCard>No portfolio queue items yet.</PaperclipCard> : null}
    </div>
  )
}
