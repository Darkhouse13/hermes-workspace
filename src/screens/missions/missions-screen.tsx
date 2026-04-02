
import { useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import { PaperclipBadge } from '@/components/paperclip/paperclip-badge'
import { PaperclipCard } from '@/components/paperclip/paperclip-card'
import { PaperclipPage } from '@/components/paperclip/paperclip-page'
import { usePaperclipStore } from '@/stores/paperclip-store'

export function MissionsScreen() {
  const { missions, fetchMissions, updateMission } = usePaperclipStore()
  useEffect(() => { void fetchMissions() }, [fetchMissions])
  return (
    <PaperclipPage title="Missions" subtitle="Cross-project execution queue for every role in the Paperclip company.">
      <div className="grid gap-3">
        {missions.map((mission) => (
          <PaperclipCard key={mission.id} className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="brutalist-label">{mission.role}</div>
                <div className="font-bold text-[var(--theme-text)]">{mission.title}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <PaperclipBadge label={`P${mission.priority}`} tone="info" />
                <PaperclipBadge label={mission.status.replaceAll('_', ' ')} tone={mission.status === 'completed' ? 'success' : mission.status === 'blocked' ? 'danger' : 'warning'} />
              </div>
            </div>
            <p className="text-sm text-[var(--theme-muted)]">{mission.goal}</p>
            <div className="flex flex-wrap gap-2">
              <Link to="/projects/$projectId" params={{ projectId: mission.projectId }} className="brutalist-button">Open project</Link>
              <button className="brutalist-button" onClick={() => updateMission(mission.id, { status: 'completed' })}>Mark complete</button>
              <button className="brutalist-button" onClick={() => updateMission(mission.id, { status: 'awaiting_approval' })}>Send to approval</button>
              <button className="brutalist-button" onClick={() => updateMission(mission.id, { status: 'blocked' })}>Block mission</button>
            </div>
          </PaperclipCard>
        ))}
        {missions.length === 0 ? <PaperclipCard>No missions yet.</PaperclipCard> : null}
      </div>
    </PaperclipPage>
  )
}
