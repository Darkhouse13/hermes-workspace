
import { Link } from '@tanstack/react-router'
import { useEffect } from 'react'
import { PaperclipBadge } from '@/components/paperclip/paperclip-badge'
import { PaperclipCard } from '@/components/paperclip/paperclip-card'
import { PaperclipPage } from '@/components/paperclip/paperclip-page'
import { PaperclipSection } from '@/components/paperclip/paperclip-section'
import { usePaperclipStore } from '@/stores/paperclip-store'
import { PortfolioPriorityQueue } from './components/portfolio-priority-queue'
import { CreateProjectDialog } from './components/create-project-dialog'

export function ProjectsScreen() {
  const { projects, missions, fetchProjects, fetchMissions, createProject, loading, error } = usePaperclipStore()
  useEffect(() => { void fetchProjects(); void fetchMissions() }, [fetchProjects, fetchMissions])
  return (
    <PaperclipPage title="Projects" subtitle="Projects are the source of continuity for every app, idea, or venture inside Paperclip.">
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1.4fr_1.5fr]">
        <CreateProjectDialog onSubmit={createProject} />
        <PaperclipSection title="Active portfolio" eyebrow="Visibility">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {projects.map(({ project, activeMissionCount, blockedMissionCount, pendingApprovalCount, latestHandoffSnippet }) => (
              <PaperclipCard key={project.id} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="brutalist-label">{project.stage}</div>
                    <div className="text-lg font-black uppercase tracking-[0.06em] text-[var(--theme-text)]">{project.name}</div>
                  </div>
                  <PaperclipBadge label={project.status} tone={project.status === 'active' ? 'success' : 'warning'} />
                </div>
                <p className="text-sm text-[var(--theme-muted)]">{project.objective || project.thesis || 'No objective yet.'}</p>
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div className="brutalist-stat"><strong>{activeMissionCount}</strong><span>Missions</span></div>
                  <div className="brutalist-stat"><strong>{blockedMissionCount}</strong><span>Blocked</span></div>
                  <div className="brutalist-stat"><strong>{pendingApprovalCount}</strong><span>Approvals</span></div>
                </div>
                <p className="text-xs text-[var(--theme-muted)]">{latestHandoffSnippet || project.latestSummary}</p>
                <Link to="/projects/$projectId" params={{ projectId: project.id }} className="brutalist-button inline-flex w-full justify-center">Open project</Link>
              </PaperclipCard>
            ))}
            {!loading && projects.length === 0 ? <PaperclipCard>No projects yet.</PaperclipCard> : null}
          </div>
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
        </PaperclipSection>
        <PaperclipSection title="Portfolio priority queue" eyebrow="Orchestration">
          <PortfolioPriorityQueue projects={projects} missions={missions} />
        </PaperclipSection>
      </div>
    </PaperclipPage>
  )
}
