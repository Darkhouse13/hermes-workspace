
import { Link } from '@tanstack/react-router'
import { useEffect } from 'react'
import type { PaperclipProjectDetail } from '@/types/paperclip'
import { PaperclipBadge } from '@/components/paperclip/paperclip-badge'
import { PaperclipCard } from '@/components/paperclip/paperclip-card'
import { PaperclipPage } from '@/components/paperclip/paperclip-page'
import { PaperclipSection } from '@/components/paperclip/paperclip-section'
import { usePaperclipStore } from '@/stores/paperclip-store'
import { CreateHandoffDialog } from './components/create-handoff-dialog'
import { CreateMissionDialog } from './components/create-mission-dialog'
import { EditProjectDialog } from './components/edit-project-dialog'
import { LaunchRoleDialog } from './components/launch-role-dialog'
import { ProjectDependencyGraph } from './components/project-dependency-graph'
import { ProjectMissionPipeline } from './components/project-mission-pipeline'

export function ProjectDetailScreen({ projectId }: { projectId: string }) {
  const { currentProject, fetchProjectDetail, createMission, createHandoff, launchRole, updateProject, fetchRecommendation, recommendation, createSuccessorFromRecommendation } = usePaperclipStore() as any
  useEffect(() => {
    void fetchProjectDetail(projectId)
    void fetchRecommendation(projectId)
  }, [fetchProjectDetail, fetchRecommendation, projectId])
  const detail = currentProject as PaperclipProjectDetail | null
  if (!detail) return <PaperclipPage title="Project" subtitle="Loading project detail..."><PaperclipCard>Loading...</PaperclipCard></PaperclipPage>
  const latestMission = detail.missions[0]
  return (
    <PaperclipPage
      title={detail.project.name}
      subtitle={detail.project.objective || detail.project.thesis || 'Project detail'}
      actions={latestMission?.linkedSessionIds.at(-1) ? <Link to="/chat/$sessionKey" params={{ sessionKey: latestMission.linkedSessionIds.at(-1)! }} className="brutalist-button">Open latest session</Link> : undefined}
    >
      <div className="grid gap-4 xl:grid-cols-[1.2fr_2fr]">
        <div className="space-y-4">
          <PaperclipCard className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <PaperclipBadge label={detail.project.stage} tone="info" />
              <PaperclipBadge label={detail.project.status} tone={detail.project.status === 'active' ? 'success' : 'warning'} />
            </div>
            <p className="text-sm text-[var(--theme-muted)]">{detail.project.latestSummary}</p>
            {recommendation ? <div className="space-y-2 border-2 border-dashed border-[var(--theme-border)] p-3"><div className="brutalist-label">Recommended next action</div><div className="font-semibold text-[var(--theme-text)]">{recommendation.action}</div><p className="text-sm text-[var(--theme-muted)]">{recommendation.rationale}</p>{recommendation.recommendedRole ? <div className="text-xs text-[var(--theme-muted)]">Suggested role: {recommendation.recommendedRole}</div> : null}<div className="flex flex-wrap gap-2 pt-2">{recommendation.action === 'create_successor_mission' ? <button className="brutalist-button" onClick={() => createSuccessorFromRecommendation(projectId)}>Create successor mission</button> : null}{recommendation.action === 'launch_mission' && recommendation.missionId ? <button className="brutalist-button" onClick={() => {
              const targetMission = detail.missions.find((mission) => mission.id === recommendation.missionId)
              if (!targetMission) return
              return launchRole({
                projectId,
                missionId: targetMission.id,
                role: targetMission.role,
                title: targetMission.title,
                goal: targetMission.goal,
                instructions: targetMission.instructions,
              })
            }}>Launch recommended mission</button> : null}</div></div> : null}
          </PaperclipCard>
          <EditProjectDialog project={detail.project} onSubmit={(payload) => updateProject(detail.project.id, payload)} />
          <CreateMissionDialog projectId={detail.project.id} onSubmit={createMission} />
          <LaunchRoleDialog projectId={detail.project.id} onSubmit={launchRole} />
          {latestMission ? <CreateHandoffDialog projectId={detail.project.id} missionId={latestMission.id} onSubmit={createHandoff} /> : null}
        </div>
        <div className="space-y-4">
          <PaperclipSection title="Mission pipeline" eyebrow="Execution">
            <ProjectMissionPipeline missions={detail.missions} />
          </PaperclipSection>
          <PaperclipSection title="Dependency graph" eyebrow="Flow">
            <ProjectDependencyGraph missions={detail.missions} />
          </PaperclipSection>
          <PaperclipSection title="Handoffs" eyebrow="Continuity">
            <div className="grid gap-3">
              {detail.handoffs.map((handoff) => <PaperclipCard key={handoff.id}><div className="brutalist-label">{handoff.fromRole} → {handoff.toRole}</div><p className="mt-2 text-sm text-[var(--theme-text)]">{handoff.summary}</p></PaperclipCard>)}
              {detail.handoffs.length === 0 ? <PaperclipCard>No handoffs yet.</PaperclipCard> : null}
            </div>
          </PaperclipSection>
          <PaperclipSection title="Approvals" eyebrow="Governance">
            <div className="grid gap-3">
              {detail.approvals.map((approval) => <PaperclipCard key={approval.id}><div className="flex items-center justify-between gap-2"><div className="brutalist-label">{approval.type}</div><PaperclipBadge label={approval.status} tone={approval.status === 'approved' ? 'success' : approval.status === 'rejected' ? 'danger' : 'warning'} /></div><p className="mt-2 text-sm text-[var(--theme-muted)]">{approval.rationale}</p>{approval.requestedDecision ? <p className="mt-2 text-sm text-[var(--theme-text)]"><strong>Decision needed:</strong> {approval.requestedDecision}</p> : null}{approval.recommendedOption ? <p className="mt-2 text-sm text-[var(--theme-text)]"><strong>Recommended:</strong> {approval.recommendedOption}</p> : null}{approval.decisionOptions?.length ? <div className="mt-2 flex flex-wrap gap-2">{approval.decisionOptions.map((option) => <span key={option} className="brutalist-badge">{option}</span>)}</div> : null}{approval.resolutionSummary ? <p className="mt-2 text-xs text-[var(--theme-muted)]">{approval.resolutionSummary}</p> : null}</PaperclipCard>)}
              {detail.approvals.length === 0 ? <PaperclipCard>No approvals yet.</PaperclipCard> : null}
            </div>
          </PaperclipSection>
          <PaperclipSection title="Continuity timeline" eyebrow="Context">
            <div className="grid gap-3">
              {detail.events.map((event) => <PaperclipCard key={event.id}><div className="brutalist-label">{event.type.replaceAll('_', ' ')}</div><p className="mt-2 text-sm text-[var(--theme-text)]">{event.summary}</p><p className="mt-2 text-xs text-[var(--theme-muted)]">{new Date(event.createdAt).toLocaleString()}</p></PaperclipCard>)}
              {detail.events.length === 0 ? <PaperclipCard>No continuity events yet.</PaperclipCard> : null}
            </div>
          </PaperclipSection>
          <PaperclipSection title="Linked sessions" eyebrow="Trace">
            <div className="grid gap-3">
              {detail.sessionLinks.map((link) => <PaperclipCard key={link.sessionId}><div className="brutalist-label">{link.role}</div><p className="mt-2 text-sm text-[var(--theme-text)]">Session {link.sessionId}</p><Link to="/chat/$sessionKey" params={{ sessionKey: link.sessionId }} className="mt-2 inline-flex text-sm font-semibold underline">Open session</Link></PaperclipCard>)}
              {detail.sessionLinks.length === 0 ? <PaperclipCard>No linked sessions yet.</PaperclipCard> : null}
            </div>
          </PaperclipSection>
        </div>
      </div>
    </PaperclipPage>
  )
}
