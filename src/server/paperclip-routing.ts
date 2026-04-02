
import type { PaperclipRole, RouteNextAction } from '@/types/paperclip'
import { listApprovals } from '@/server/paperclip-approvals'
import { listHandoffs } from '@/server/paperclip-handoffs'
import { listProjectMissions } from '@/server/paperclip-missions'
import { getProject } from '@/server/paperclip-projects'

function suggestedRoleFromMissionRole(role: PaperclipRole): PaperclipRole {
  if (role === 'research') return 'ceo'
  if (role === 'cto') return 'engineering'
  if (role === 'engineering') return 'qa'
  if (role === 'qa') return 'ceo'
  return 'ceo'
}

export async function routeNextForProject(projectIdOrSlug: string): Promise<RouteNextAction> {
  const project = await getProject(projectIdOrSlug)
  if (!project) throw new Error('Project not found')
  const missions = await listProjectMissions(project.id)
  const approvals = await listApprovals(project.id)
  const handoffs = await listHandoffs(project.id)

  const blocked = missions.find((mission) => mission.status === 'blocked')
  if (blocked) {
    return {
      action: 'resolve_blocker',
      missionId: blocked.id,
      recommendedRole: 'ceo',
      rationale: `Mission "${blocked.title}" is blocked and needs replanning or intervention.`,
    }
  }

  const pendingApproval = approvals.find((approval) => approval.status === 'pending')
  if (pendingApproval) {
    return {
      action: 'request_approval',
      missionId: pendingApproval.missionId,
      recommendedRole: pendingApproval.requiredByRole === 'founder' ? 'ceo' : pendingApproval.requiredByRole,
      rationale: `Approval ${pendingApproval.type} is pending and is the current bottleneck.`,
    }
  }

  const awaitingHandoff = missions.find((mission) => mission.status === 'awaiting_handoff')
  if (awaitingHandoff) {
    return {
      action: 'review_handoff',
      missionId: awaitingHandoff.id,
      recommendedRole: suggestedRoleFromMissionRole(awaitingHandoff.role),
      rationale: `Mission "${awaitingHandoff.title}" finished work and should be routed via handoff.`,
    }
  }

  const queued = [...missions]
    .filter((mission) => mission.status === 'queued')
    .sort((a, b) => b.priority - a.priority || a.riskTier - b.riskTier)[0]
  if (queued) {
    return {
      action: 'launch_mission',
      missionId: queued.id,
      recommendedRole: queued.role,
      rationale: `Mission "${queued.title}" is the highest-priority ready mission.`,
    }
  }

  const latestHandoff = handoffs[0]
  if (latestHandoff) {
    return {
      action: 'review_handoff',
      missionId: latestHandoff.missionId,
      recommendedRole: latestHandoff.toRole === 'founder' ? 'ceo' : latestHandoff.toRole,
      rationale: 'Latest handoff is available for review and next-step routing.',
    }
  }

  return {
    action: 'noop',
    rationale: 'No launch-ready missions, blockers, or approvals were found for this project.',
  }
}
