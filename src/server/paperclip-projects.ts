import type { PaperclipProject, PaperclipProjectDetail, PaperclipProjectSummary } from '@/types/paperclip'
import {
  getPaperclipProjectApprovalsPath,
  getPaperclipProjectArtifactsPath,
  getPaperclipProjectDir,
  getPaperclipProjectHandoffsPath,
  getPaperclipProjectMarkdownPath,
  getPaperclipProjectSessionsDir,
  getPaperclipProjectStatePath,
  getPaperclipProjectsIndexPath,
} from '@/server/paperclip-paths'
import {
  ensureDir,
  nowIso,
  readJsonOrDefault,
  slugify,
  upsertById,
  writeJsonPretty,
  writeText,
} from '@/server/paperclip-store'
import { appendProjectEvent, listProjectEvents, listProjectSessionLinks } from '@/server/paperclip-continuity'
import { listApprovals } from '@/server/paperclip-approvals'
import { listHandoffs } from '@/server/paperclip-handoffs'
import { listProjectMissions } from '@/server/paperclip-missions'

async function readProjects(): Promise<Array<PaperclipProject>> {
  return readJsonOrDefault<Array<PaperclipProject>>(getPaperclipProjectsIndexPath(), [])
}

async function writeProjects(projects: Array<PaperclipProject>): Promise<void> {
  await writeJsonPretty(getPaperclipProjectsIndexPath(), projects)
}

export async function listProjects(): Promise<Array<PaperclipProject>> {
  const projects = await readProjects()
  return [...projects].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
}

export async function getProject(projectIdOrSlug: string): Promise<PaperclipProject | null> {
  const projects = await readProjects()
  return projects.find(
    (project) => project.id === projectIdOrSlug || project.slug === projectIdOrSlug,
  ) || null
}

export async function createProject(input: {
  name: string
  thesis?: string
  objective?: string
  owner?: string
  primaryMarket?: string
  constraints?: Array<string>
  successMetrics?: Array<string>
}): Promise<PaperclipProject> {
  const timestamp = nowIso()
  const baseSlug = slugify(input.name) || 'paperclip-project'
  const existing = await readProjects()
  const duplicateCount = existing.filter((project) => project.slug.startsWith(baseSlug)).length
  const slug = duplicateCount > 0 ? `${baseSlug}-${duplicateCount + 1}` : baseSlug
  const project: PaperclipProject = {
    id: `project_${Math.random().toString(36).slice(2, 10)}`,
    slug,
    name: input.name.trim(),
    status: 'active',
    stage: 'idea',
    thesis: input.thesis?.trim() || '',
    objective: input.objective?.trim() || '',
    owner: input.owner?.trim() || 'Hermes',
    primaryMarket: input.primaryMarket?.trim() || '',
    constraints: input.constraints || [],
    successMetrics: input.successMetrics || [],
    latestSummary: input.objective?.trim() || 'New Paperclip project created.',
    activeMissionIds: [],
    linkedSessionIds: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  const projectDir = getPaperclipProjectDir(slug)
  await ensureDir(projectDir)
  await ensureDir(getPaperclipProjectSessionsDir(slug))
  await ensureDir(`${projectDir}/missions`)
  await ensureDir(`${projectDir}/artifacts`)
  await writeText(
    getPaperclipProjectMarkdownPath(slug, 'PROJECT.md'),
    `# ${project.name}\n\n## Thesis\n\n${project.thesis || 'TBD'}\n\n## Objective\n\n${project.objective || 'TBD'}\n`,
  )
  await writeText(getPaperclipProjectMarkdownPath(slug, 'DECISIONS.md'), '# Decisions\n')
  await writeText(getPaperclipProjectMarkdownPath(slug, 'NOTES.md'), '# Notes\n')
  await writeText(getPaperclipProjectMarkdownPath(slug, 'HANDOFFS.md'), '# Handoffs\n')
  await writeJsonPretty(getPaperclipProjectStatePath(slug), project)
  await writeJsonPretty(getPaperclipProjectHandoffsPath(slug), [])
  await writeJsonPretty(getPaperclipProjectApprovalsPath(slug), [])
  await writeJsonPretty(getPaperclipProjectArtifactsPath(slug), [])

  await writeProjects(upsertById(existing, project))
  await appendProjectEvent({
    projectId: project.id,
    type: 'project_created',
    summary: `Project created: ${project.name}`,
  })
  return project
}

export async function updateProject(
  projectIdOrSlug: string,
  patch: Partial<PaperclipProject>,
): Promise<PaperclipProject> {
  const current = await getProject(projectIdOrSlug)
  if (!current) throw new Error('Project not found')
  const next: PaperclipProject = {
    ...current,
    ...patch,
    updatedAt: nowIso(),
  }
  const projects = await readProjects()
  await writeProjects(upsertById(projects, next))
  await writeJsonPretty(getPaperclipProjectStatePath(next.slug), next)
  return next
}

export async function addProjectSessionLink(projectIdOrSlug: string, sessionId: string): Promise<void> {
  const project = await getProject(projectIdOrSlug)
  if (!project) throw new Error('Project not found')
  if (!project.linkedSessionIds.includes(sessionId)) {
    await updateProject(project.id, {
      linkedSessionIds: [...project.linkedSessionIds, sessionId],
    })
  }
}

export async function summarizeProject(project: PaperclipProject): Promise<PaperclipProjectSummary> {
  const handoffs = await readJsonOrDefault<Array<{ summary?: string }>>(
    getPaperclipProjectHandoffsPath(project.slug),
    [],
  )
  const approvals = await readJsonOrDefault<Array<{ status?: string }>>(
    getPaperclipProjectApprovalsPath(project.slug),
    [],
  )
  const missionsDir = `${getPaperclipProjectDir(project.slug)}/missions`
  let activeMissionCount = 0
  let blockedMissionCount = 0
  try {
    const fs = await import('node:fs/promises')
    const entries = await fs.readdir(missionsDir)
    for (const entry of entries) {
      const mission = await readJsonOrDefault<{ status?: string }>(`${missionsDir}/${entry}`, {})
      if (mission.status && !['completed', 'cancelled'].includes(mission.status)) activeMissionCount += 1
      if (mission.status === 'blocked') blockedMissionCount += 1
    }
  } catch {}

  return {
    project,
    activeMissionCount,
    blockedMissionCount,
    pendingApprovalCount: approvals.filter((approval) => approval.status === 'pending').length,
    latestHandoffSnippet: handoffs[handoffs.length - 1]?.summary,
  }
}

export async function getProjectDetail(projectIdOrSlug: string): Promise<PaperclipProjectDetail | null> {
  const project = await getProject(projectIdOrSlug)
  if (!project) return null
  const [missions, handoffs, approvals, events, sessionLinks] = await Promise.all([
    listProjectMissions(project.id),
    listHandoffs(project.id),
    listApprovals(project.id),
    listProjectEvents(project.id),
    listProjectSessionLinks(project.id),
  ])
  return {
    project,
    missions,
    handoffs,
    approvals,
    artifacts: [],
    events,
    sessionLinks,
  }
}

export async function listProjectSummaries(): Promise<Array<PaperclipProjectSummary>> {
  const projects = await listProjects()
  return Promise.all(projects.map((project) => summarizeProject(project)))
}
