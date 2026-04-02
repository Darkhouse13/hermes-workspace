
import fs from 'node:fs/promises'
import type { MissionStatus, PaperclipMission, PaperclipMissionFilters } from '@/types/paperclip'
import { getPaperclipMissionsDir, getPaperclipMissionPath } from '@/server/paperclip-paths'
import { makePaperclipId, nowIso, readJsonOrDefault, writeJsonPretty } from '@/server/paperclip-store'
import { getProject, updateProject } from '@/server/paperclip-projects'

const ALLOWED_TRANSITIONS: Record<MissionStatus, Array<MissionStatus>> = {
  queued: ['in_progress', 'cancelled'],
  in_progress: ['blocked', 'awaiting_handoff', 'awaiting_approval', 'completed', 'cancelled'],
  blocked: ['queued', 'cancelled', 'awaiting_approval'],
  awaiting_handoff: ['queued', 'completed', 'awaiting_approval'],
  awaiting_approval: ['queued', 'completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

async function readMissionFiles(projectSlug: string): Promise<Array<PaperclipMission>> {
  const dir = getPaperclipMissionsDir(projectSlug)
  try {
    const entries = await fs.readdir(dir)
    const missions = await Promise.all(
      entries
        .filter((entry) => entry.endsWith('.json'))
        .map((entry) => readJsonOrDefault<PaperclipMission | null>(`${dir}/${entry}`, null)),
    )
    return missions.filter(Boolean) as Array<PaperclipMission>
  } catch {
    return []
  }
}

export async function listProjectMissions(projectIdOrSlug: string): Promise<Array<PaperclipMission>> {
  const project = await getProject(projectIdOrSlug)
  if (!project) throw new Error('Project not found')
  return readMissionFiles(project.slug)
}

export async function listMissions(filters: PaperclipMissionFilters = {}): Promise<Array<PaperclipMission>> {
  const project = filters.projectId ? await getProject(filters.projectId) : null
  const projects = project ? [project] : await import('@/server/paperclip-projects').then((m) => m.listProjects())
  const collections = await Promise.all(projects.map((item) => readMissionFiles(item.slug)))
  return collections
    .flat()
    .filter((mission) => !filters.role || mission.role === filters.role)
    .filter((mission) => !filters.status || mission.status === filters.status)
    .filter((mission) => filters.riskTier === undefined || mission.riskTier === filters.riskTier)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
}

export async function getMission(missionId: string): Promise<PaperclipMission | null> {
  const missions = await listMissions()
  return missions.find((mission) => mission.id === missionId) || null
}

export async function createMission(input: {
  projectId: string
  title: string
  role: PaperclipMission['role']
  goal: string
  instructions: string
  priority?: number
  riskTier?: 0 | 1 | 2 | 3
  inputs?: Array<string>
  expectedOutputs?: Array<string>
  dependencyIds?: Array<string>
}): Promise<PaperclipMission> {
  const project = await getProject(input.projectId)
  if (!project) throw new Error('Project not found')
  const timestamp = nowIso()
  const mission: PaperclipMission = {
    id: makePaperclipId('mission'),
    projectId: project.id,
    title: input.title,
    role: input.role,
    status: 'queued',
    priority: input.priority ?? 2,
    riskTier: input.riskTier ?? 1,
    goal: input.goal,
    instructions: input.instructions,
    inputs: input.inputs || [],
    expectedOutputs: input.expectedOutputs || [],
    linkedSessionIds: [],
    dependencyIds: input.dependencyIds || [],
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  await writeJsonPretty(getPaperclipMissionPath(project.slug, mission.id), mission)
  if (!project.activeMissionIds.includes(mission.id)) {
    await updateProject(project.id, {
      activeMissionIds: [...project.activeMissionIds, mission.id],
      latestSummary: mission.goal,
    })
  }
  return mission
}

export async function updateMission(
  missionId: string,
  patch: Partial<PaperclipMission>,
): Promise<PaperclipMission> {
  const current = await getMission(missionId)
  if (!current) throw new Error('Mission not found')
  const project = await getProject(current.projectId)
  if (!project) throw new Error('Project not found')
  const next: PaperclipMission = { ...current, ...patch, updatedAt: nowIso() }
  await writeJsonPretty(getPaperclipMissionPath(project.slug, missionId), next)
  return next
}

export async function transitionMissionStatus(
  missionId: string,
  status: MissionStatus,
): Promise<PaperclipMission> {
  const mission = await getMission(missionId)
  if (!mission) throw new Error('Mission not found')
  if (!ALLOWED_TRANSITIONS[mission.status].includes(status)) {
    throw new Error(`Invalid mission transition: ${mission.status} -> ${status}`)
  }
  const patch: Partial<PaperclipMission> = { status, updatedAt: nowIso() }
  if (status === 'in_progress' && !mission.startedAt) patch.startedAt = nowIso()
  if (status === 'completed') patch.completedAt = nowIso()
  return updateMission(missionId, patch)
}

export async function attachMissionSession(missionId: string, sessionId: string): Promise<PaperclipMission> {
  const mission = await getMission(missionId)
  if (!mission) throw new Error('Mission not found')
  if (mission.linkedSessionIds.includes(sessionId)) return mission
  return updateMission(missionId, {
    linkedSessionIds: [...mission.linkedSessionIds, sessionId],
  })
}
