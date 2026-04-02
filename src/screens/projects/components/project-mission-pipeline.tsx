
import { Link } from '@tanstack/react-router'
import type { PaperclipMission } from '@/types/paperclip'
import { PaperclipBadge } from '@/components/paperclip/paperclip-badge'
import { PaperclipCard } from '@/components/paperclip/paperclip-card'

export function ProjectMissionPipeline({ missions }: { missions: Array<PaperclipMission> }) {
  return (
    <div className="grid gap-3">
      {missions.map((mission) => (
        <PaperclipCard key={mission.id} className="space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="brutalist-label">{mission.role}</div>
              <div className="font-bold text-[var(--theme-text)]">{mission.title}</div>
            </div>
            <PaperclipBadge label={mission.status.replaceAll('_', ' ')} tone={mission.status === 'blocked' ? 'danger' : mission.status === 'completed' ? 'success' : 'info'} />
          </div>
          <p className="text-sm text-[var(--theme-muted)]">{mission.goal}</p>
          {mission.linkedSessionIds.at(-1) ? <Link to="/chat/$sessionKey" params={{ sessionKey: mission.linkedSessionIds.at(-1)! }} className="text-sm font-semibold underline">Open latest session</Link> : null}
        </PaperclipCard>
      ))}
      {missions.length === 0 ? <PaperclipCard>No missions yet.</PaperclipCard> : null}
    </div>
  )
}
