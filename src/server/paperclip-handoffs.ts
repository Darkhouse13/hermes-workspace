import type { PaperclipHandoff, PaperclipRole } from '@/types/paperclip'
import { getPaperclipProjectHandoffsPath, getPaperclipProjectMarkdownPath } from '@/server/paperclip-paths'
import { appendMarkdownSection, makePaperclipId, nowIso, readJsonOrDefault, writeJsonPretty } from '@/server/paperclip-store'
import { appendProjectEvent } from '@/server/paperclip-continuity'
import { getProject } from '@/server/paperclip-projects'
import { getMission } from '@/server/paperclip-missions'

async function readHandoffs(projectSlug: string): Promise<Array<PaperclipHandoff>> {
  return readJsonOrDefault<Array<PaperclipHandoff>>(getPaperclipProjectHandoffsPath(projectSlug), [])
}

async function writeHandoffs(projectSlug: string, handoffs: Array<PaperclipHandoff>): Promise<void> {
  await writeJsonPretty(getPaperclipProjectHandoffsPath(projectSlug), handoffs)
}

export async function listHandoffs(projectIdOrSlug?: string): Promise<Array<PaperclipHandoff>> {
  if (projectIdOrSlug) {
    const project = await getProject(projectIdOrSlug)
    if (!project) throw new Error('Project not found')
    return readHandoffs(project.slug)
  }
  const { listProjects } = await import('@/server/paperclip-projects')
  const projects = await listProjects()
  const nested = await Promise.all(projects.map((project) => readHandoffs(project.slug)))
  return nested.flat().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}

export async function createHandoff(input: {
  projectId: string
  missionId: string
  fromRole: PaperclipRole
  toRole: PaperclipRole | 'founder'
  summary: string
  whatChanged?: string
  decisions?: Array<string>
  blockers?: Array<string>
  nextSteps?: Array<string>
  openQuestions?: Array<string>
  confidence?: 'low' | 'medium' | 'high'
  changedFiles?: Array<string>
  testStatus?: string
  unresolvedWarnings?: Array<string>
  rollbackNotes?: string
}): Promise<PaperclipHandoff> {
  const project = await getProject(input.projectId)
  if (!project) throw new Error('Project not found')
  const handoff: PaperclipHandoff = {
    id: makePaperclipId('handoff'),
    projectId: project.id,
    missionId: input.missionId,
    fromRole: input.fromRole,
    toRole: input.toRole,
    summary: input.summary,
    whatChanged: input.whatChanged,
    decisions: input.decisions || [],
    blockers: input.blockers || [],
    nextSteps: input.nextSteps || [],
    openQuestions: input.openQuestions || [],
    confidence: input.confidence || 'medium',
    changedFiles: input.changedFiles,
    testStatus: input.testStatus,
    unresolvedWarnings: input.unresolvedWarnings,
    rollbackNotes: input.rollbackNotes,
    createdAt: nowIso(),
  }
  const current = await readHandoffs(project.slug)
  await writeHandoffs(project.slug, [...current, handoff])
  await appendMarkdownSection(
    getPaperclipProjectMarkdownPath(project.slug, 'HANDOFFS.md'),
    `${handoff.fromRole} -> ${handoff.toRole}`,
    handoff.summary,
  )
  await appendProjectEvent({
    projectId: project.id,
    missionId: handoff.missionId,
    type: 'handoff_created',
    summary: `Handoff created: ${handoff.fromRole} -> ${handoff.toRole}`,
  })
  return handoff
}

export async function ensureHandoffForMissionTransition(
  missionId: string,
  reason: 'blocked' | 'awaiting_approval' | 'completed',
): Promise<PaperclipHandoff | null> {
  const mission = await getMission(missionId)
  if (!mission) return null
  const project = await getProject(mission.projectId)
  if (!project) return null
  const current = await readHandoffs(project.slug)
  const existing = current.find((handoff) => handoff.missionId === missionId)
  if (existing) return existing
  const toRole: PaperclipRole | 'founder' =
    reason === 'awaiting_approval' ? 'founder' : 'ceo'
  return createHandoff({
    projectId: project.id,
    missionId,
    fromRole: mission.role,
    toRole,
    summary: mission.resultSummary || `${mission.title} moved to ${reason.replace('_', ' ')}`,
    blockers: reason === 'blocked' ? ['Mission requires intervention before continuing.'] : [],
    nextSteps:
      reason === 'completed'
        ? ['Review result and route the next mission.']
        : reason === 'awaiting_approval'
          ? ['Resolve pending approval before continuing.']
          : ['Resolve blocker and return mission to queue.'],
  })
}
