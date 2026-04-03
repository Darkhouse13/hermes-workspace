import { Link } from '@tanstack/react-router'
import { useEffect } from 'react'
import { PaperclipBadge } from '@/components/paperclip/paperclip-badge'
import { PaperclipCard } from '@/components/paperclip/paperclip-card'
import { PaperclipPage } from '@/components/paperclip/paperclip-page'
import { PaperclipSection } from '@/components/paperclip/paperclip-section'
import { usePaperclipStore } from '@/stores/paperclip-store'

export function MissionControlScreen() {
  const {
    projects,
    missions,
    approvals,
    handoffs,
    fetchProjects,
    fetchMissions,
    fetchApprovals,
    fetchHandoffs,
  } = usePaperclipStore()

  useEffect(() => {
    void fetchProjects()
    void fetchMissions()
    void fetchApprovals()
    void fetchHandoffs()
  }, [fetchApprovals, fetchHandoffs, fetchMissions, fetchProjects])

  const blocked = missions.filter((mission) => mission.status === 'blocked')
  const pendingApprovals = approvals.filter((approval) => approval.status === 'pending')
  const queued = missions
    .filter((mission) => mission.status === 'queued' || mission.status === 'in_progress')
    .sort((a, b) => b.priority - a.priority || b.riskTier - a.riskTier)
    .slice(0, 10)
  const recentHandoffs = [...handoffs].slice(0, 10)

  return (
    <PaperclipPage
      title="Mission Control"
      subtitle="Org-level orchestration queue across your full Paperclip portfolio."
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <PaperclipCard className="space-y-2">
          <div className="brutalist-label">Projects</div>
          <div className="text-3xl font-black text-[var(--theme-text)]">{projects.length}</div>
          <p className="text-sm text-[var(--theme-muted)]">Active portfolio entities tracked by Paperclip.</p>
        </PaperclipCard>
        <PaperclipCard className="space-y-2">
          <div className="brutalist-label">Queued / active work</div>
          <div className="text-3xl font-black text-[var(--theme-text)]">{queued.length}</div>
          <p className="text-sm text-[var(--theme-muted)]">Cross-project work items currently competing for attention.</p>
        </PaperclipCard>
        <PaperclipCard className="space-y-2">
          <div className="brutalist-label">Blocked missions</div>
          <div className="text-3xl font-black text-[var(--theme-text)]">{blocked.length}</div>
          <p className="text-sm text-[var(--theme-muted)]">Items requiring intervention or a decision before work can continue.</p>
        </PaperclipCard>
        <PaperclipCard className="space-y-2">
          <div className="brutalist-label">Pending approvals</div>
          <div className="text-3xl font-black text-[var(--theme-text)]">{pendingApprovals.length}</div>
          <p className="text-sm text-[var(--theme-muted)]">Governance gates waiting on founder or specialist review.</p>
        </PaperclipCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1.2fr]">
        <PaperclipSection title="Global priority queue" eyebrow="Execution">
          <div className="grid gap-3">
            {queued.map((mission, index) => (
              <PaperclipCard key={mission.id} className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="brutalist-label">Rank #{index + 1}</div>
                    <div className="font-bold text-[var(--theme-text)]">{mission.title}</div>
                    <div className="mt-1 text-xs text-[var(--theme-muted)]">Project {mission.projectId}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <PaperclipBadge label={mission.role} tone="info" />
                    <PaperclipBadge label={`P${mission.priority}`} tone="info" />
                    <PaperclipBadge label={`risk ${mission.riskTier}`} tone={mission.riskTier >= 2 ? 'warning' : 'info'} />
                  </div>
                </div>
                <p className="text-sm text-[var(--theme-muted)]">{mission.goal}</p>
                <div className="flex flex-wrap gap-2">
                  <Link to="/projects/$projectId" params={{ projectId: mission.projectId }} className="brutalist-button">Open project</Link>
                  {mission.linkedSessionIds.at(-1) ? <Link to="/chat/$sessionKey" params={{ sessionKey: mission.linkedSessionIds.at(-1)! }} className="brutalist-button">Open latest session</Link> : null}
                </div>
              </PaperclipCard>
            ))}
            {queued.length === 0 ? <PaperclipCard>No global queue items yet.</PaperclipCard> : null}
          </div>
        </PaperclipSection>

        <div className="space-y-4">
          <PaperclipSection title="Founder approvals" eyebrow="Governance">
            <div className="grid gap-3">
              {pendingApprovals.slice(0, 6).map((approval) => (
                <PaperclipCard key={approval.id} className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="brutalist-label">{approval.type}</div>
                    <PaperclipBadge label={approval.status} tone="warning" />
                  </div>
                  <p className="text-sm text-[var(--theme-text)]">{approval.requestedDecision || approval.rationale}</p>
                  {approval.recommendedOption ? <p className="text-xs text-[var(--theme-muted)]">Recommended: {approval.recommendedOption}</p> : null}
                  <Link to="/approvals" className="brutalist-button inline-flex justify-center">Open approvals</Link>
                </PaperclipCard>
              ))}
              {pendingApprovals.length === 0 ? <PaperclipCard>No pending approvals.</PaperclipCard> : null}
            </div>
          </PaperclipSection>

          <PaperclipSection title="Recent handoffs" eyebrow="Continuity">
            <div className="grid gap-3">
              {recentHandoffs.map((handoff) => (
                <PaperclipCard key={handoff.id} className="space-y-2">
                  <div className="brutalist-label">{handoff.fromRole} → {handoff.toRole}</div>
                  <p className="text-sm text-[var(--theme-text)]">{handoff.summary}</p>
                </PaperclipCard>
              ))}
              {recentHandoffs.length === 0 ? <PaperclipCard>No handoffs yet.</PaperclipCard> : null}
            </div>
          </PaperclipSection>
        </div>
      </div>
    </PaperclipPage>
  )
}
