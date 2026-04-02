import type { LaunchRoleRequest, LaunchRoleResponse, PaperclipMission, PaperclipRole } from '@/types/paperclip'
import { createSession } from '@/server/hermes-api'
import { getRoleRoutingRule } from '@/server/paperclip-company'
import { appendProjectEvent, writeProjectSessionLink } from '@/server/paperclip-continuity'
import { attachMissionSession, createMission, getMission, transitionMissionStatus, updateMission } from '@/server/paperclip-missions'
import { addProjectSessionLink, getProject, updateProject } from '@/server/paperclip-projects'

export async function planRoleLaunch(role: PaperclipRole) {
  const routing = await getRoleRoutingRule(role)
  if (!routing) throw new Error(`No routing rule configured for role ${role}`)
  return routing
}

export async function launchRoleForMission(
  input: LaunchRoleRequest,
): Promise<LaunchRoleResponse> {
  const project = await getProject(input.projectId)
  if (!project) throw new Error('Project not found')
  const plan = await planRoleLaunch(input.role)
  let mission: PaperclipMission
  if (input.missionId) {
    const existing = await getMission(input.missionId)
    if (!existing) throw new Error('Mission not found')
    mission = await updateMission(existing.id, {
      title: input.title || existing.title,
      goal: input.goal || existing.goal,
      instructions: input.instructions || existing.instructions,
      provider: plan.primaryProvider,
      model: plan.primaryModel,
      fallbackProvider: plan.fallbackProvider,
      fallbackModel: plan.fallbackModel,
    })
  } else {
    mission = await createMission({
      projectId: project.id,
      title: input.title || `${plan.label}: ${input.goal.slice(0, 48)}`,
      role: input.role,
      goal: input.goal,
      instructions: input.instructions,
      priority: input.priority,
      riskTier: input.riskTier,
    })
  }

  const session = await createSession({
    title: `${project.name} · ${mission.title}`,
    model: plan.primaryModel,
  })

  await attachMissionSession(mission.id, session.id)
  await addProjectSessionLink(project.id, session.id)
  await writeProjectSessionLink({
    sessionId: session.id,
    missionId: mission.id,
    projectId: project.id,
    role: mission.role,
    createdAt: new Date().toISOString(),
  })
  await transitionMissionStatus(mission.id, 'in_progress')
  await updateProject(project.id, {
    latestSummary: `Launched ${mission.role} mission: ${mission.title}`,
  })
  await appendProjectEvent({
    projectId: project.id,
    missionId: mission.id,
    type: 'session_linked',
    summary: `Launched ${mission.role} role session for ${mission.title}`,
    metadata: {
      sessionId: session.id,
      provider: plan.primaryProvider,
      model: plan.primaryModel,
    },
  })
  const refreshed = await getMission(mission.id)
  if (!refreshed) throw new Error('Mission refresh failed')
  return {
    mission: refreshed,
    sessionId: session.id,
    provider: plan.primaryProvider,
    model: plan.primaryModel,
    fallbackProvider: plan.fallbackProvider,
    fallbackModel: plan.fallbackModel,
    approvalRequired: Boolean(plan.finalApprovalRequired),
  }
}

export async function resumeMission(missionId: string): Promise<{ mission: PaperclipMission; sessionId: string | null }> {
  const mission = await getMission(missionId)
  if (!mission) throw new Error('Mission not found')
  return {
    mission,
    sessionId: mission.linkedSessionIds[mission.linkedSessionIds.length - 1] || null,
  }
}
