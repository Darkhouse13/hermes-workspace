import type { PaperclipMission, PaperclipRole, RouteNextAction } from '@/types/paperclip'
import { appendProjectEvent } from '@/server/paperclip-continuity'
import { listApprovals } from '@/server/paperclip-approvals'
import { listHandoffs } from '@/server/paperclip-handoffs'
import { listProjectMissions } from '@/server/paperclip-missions'
import { getProject } from '@/server/paperclip-projects'

const STALE_MISSION_MS = 1000 * 60 * 30

export function suggestSuccessor(role: PaperclipRole): {
  role: PaperclipRole
  title: string
  goal: string
  instructions: string
} {
  switch (role) {
    case 'research':
      return {
        role: 'ceo',
        title: 'Synthesize research findings',
        goal: 'Turn the research output into a scoped recommendation and decision-ready brief.',
        instructions: 'Review the linked research mission output, summarize the strongest insights, define risks, and recommend the next mission.',
      }
    case 'ceo':
      return {
        role: 'cto',
        title: 'Design architecture from scoped brief',
        goal: 'Translate the approved scope into a technical architecture and implementation path.',
        instructions: 'Use the scoped brief to define the architecture, milestones, and technical risks.',
      }
    case 'cto':
      return {
        role: 'engineering',
        title: 'Implement approved technical slice',
        goal: 'Build the next technical milestone from the architecture brief.',
        instructions: 'Implement the next milestone, preserve tests, and prepare a clean handoff for QA.',
      }
    case 'engineering':
      return {
        role: 'qa',
        title: 'Review completed engineering work',
        goal: 'Validate the implementation for regressions, defects, and readiness.',
        instructions: 'Review the linked implementation mission, identify blockers, and prepare release confidence notes.',
      }
    case 'qa':
      return {
        role: 'content',
        title: 'Prepare launch-facing assets',
        goal: 'Create messaging, launch materials, or implementation-facing copy from validated work.',
        instructions: 'Use the validated output to prepare messaging or GTM-ready assets aligned with the product scope.',
      }
    default:
      return {
        role: 'ceo',
        title: 'Review mission outcome',
        goal: 'Review the latest mission and decide the next best move.',
        instructions: 'Inspect the latest handoff, summarize the current state, and create the next mission if needed.',
      }
  }
}

export function hasUnmetDependencies(mission: PaperclipMission, all: Array<PaperclipMission>): boolean {
  if (!mission.dependencyIds.length) return false
  const completed = new Set(all.filter((item) => item.status === 'completed').map((item) => item.id))
  return mission.dependencyIds.some((dependencyId) => !completed.has(dependencyId))
}

export function latestMissionNeedingFollowup(missions: Array<PaperclipMission>): PaperclipMission | null {
  return [...missions]
    .filter((mission) => mission.status === 'completed' || mission.status === 'awaiting_handoff')
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0] || null
}

export async function routeNextForProject(projectIdOrSlug: string): Promise<RouteNextAction> {
  const project = await getProject(projectIdOrSlug)
  if (!project) throw new Error('Project not found')
  const missions = await listProjectMissions(project.id)
  const approvals = await listApprovals(project.id)
  const handoffs = await listHandoffs(project.id)
  const now = Date.now()

  const blocked = missions.find((mission) => mission.status === 'blocked')
  if (blocked) {
    const result: RouteNextAction = {
      action: 'resolve_blocker',
      missionId: blocked.id,
      recommendedRole: 'ceo',
      rationale: `Mission "${blocked.title}" is blocked and needs replanning or intervention.`,
    }
    await appendProjectEvent({ projectId: project.id, missionId: blocked.id, type: 'route_recommended', summary: result.rationale })
    return result
  }

  const pendingApproval = approvals.find((approval) => approval.status === 'pending')
  if (pendingApproval) {
    const result: RouteNextAction = {
      action: 'request_approval',
      missionId: pendingApproval.missionId,
      recommendedRole: pendingApproval.requiredByRole === 'founder' ? 'ceo' : pendingApproval.requiredByRole,
      rationale: `Approval ${pendingApproval.type} is pending and is the current bottleneck.`,
    }
    await appendProjectEvent({ projectId: project.id, missionId: pendingApproval.missionId, type: 'route_recommended', summary: result.rationale })
    return result
  }

  const staleMission = missions.find(
    (mission) => mission.status === 'in_progress' && now - Date.parse(mission.updatedAt) > STALE_MISSION_MS,
  )
  if (staleMission) {
    const result: RouteNextAction = {
      action: 'resume_stale_mission',
      missionId: staleMission.id,
      recommendedRole: staleMission.role,
      rationale: `Mission "${staleMission.title}" appears stale and should be resumed or checked.`,
    }
    await appendProjectEvent({ projectId: project.id, missionId: staleMission.id, type: 'route_recommended', summary: result.rationale })
    return result
  }

  const awaitingHandoff = missions.find((mission) => mission.status === 'awaiting_handoff')
  if (awaitingHandoff) {
    const successor = suggestSuccessor(awaitingHandoff.role)
    const result: RouteNextAction = {
      action: 'create_successor_mission',
      missionId: awaitingHandoff.id,
      recommendedRole: successor.role,
      rationale: `Mission "${awaitingHandoff.title}" finished work and should hand off to ${successor.role}.`,
      suggestedTitle: successor.title,
      suggestedGoal: successor.goal,
      suggestedInstructions: successor.instructions,
    }
    await appendProjectEvent({ projectId: project.id, missionId: awaitingHandoff.id, type: 'route_recommended', summary: result.rationale })
    return result
  }

  const queued = [...missions]
    .filter((mission) => mission.status === 'queued')
    .filter((mission) => !hasUnmetDependencies(mission, missions))
    .sort((a, b) => b.priority - a.priority || a.riskTier - b.riskTier).at(0)
  if (queued) {
    const result: RouteNextAction = {
      action: 'launch_mission',
      missionId: queued.id,
      recommendedRole: queued.role,
      rationale: `Mission "${queued.title}" is the highest-priority ready mission.`,
    }
    await appendProjectEvent({ projectId: project.id, missionId: queued.id, type: 'route_recommended', summary: result.rationale })
    return result
  }

  const followupSource = latestMissionNeedingFollowup(missions)
  if (followupSource) {
    const successor = suggestSuccessor(followupSource.role)
    const result: RouteNextAction = {
      action: 'create_successor_mission',
      missionId: followupSource.id,
      recommendedRole: successor.role,
      rationale: `No ready missions exist, so the latest completed work should spawn a successor mission for ${successor.role}.`,
      suggestedTitle: successor.title,
      suggestedGoal: successor.goal,
      suggestedInstructions: successor.instructions,
    }
    await appendProjectEvent({ projectId: project.id, missionId: followupSource.id, type: 'route_recommended', summary: result.rationale })
    return result
  }

  const latestHandoff = handoffs.at(0)
  if (latestHandoff) {
    const result: RouteNextAction = {
      action: 'review_handoff',
      missionId: latestHandoff.missionId,
      recommendedRole: latestHandoff.toRole === 'founder' ? 'ceo' : latestHandoff.toRole,
      rationale: 'Latest handoff is available for review and next-step routing.',
    }
    await appendProjectEvent({ projectId: project.id, missionId: latestHandoff.missionId, type: 'route_recommended', summary: result.rationale })
    return result
  }

  const result: RouteNextAction = {
    action: 'noop',
    rationale: 'No launch-ready missions, blockers, approvals, or successor recommendations were found for this project.',
  }
  await appendProjectEvent({ projectId: project.id, type: 'route_recommended', summary: result.rationale })
  return result
}
