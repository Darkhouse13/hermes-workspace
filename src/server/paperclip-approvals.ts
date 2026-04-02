import type { ApprovalStatus, ApprovalType, PaperclipApproval } from '@/types/paperclip'
import { getPaperclipProjectApprovalsPath } from '@/server/paperclip-paths'
import { makePaperclipId, nowIso, readJsonOrDefault, writeJsonPretty } from '@/server/paperclip-store'
import { appendProjectEvent } from '@/server/paperclip-continuity'
import { getProject } from '@/server/paperclip-projects'
import { getMission } from '@/server/paperclip-missions'

async function readApprovals(projectSlug: string): Promise<Array<PaperclipApproval>> {
  return readJsonOrDefault<Array<PaperclipApproval>>(getPaperclipProjectApprovalsPath(projectSlug), [])
}

async function writeApprovals(projectSlug: string, approvals: Array<PaperclipApproval>): Promise<void> {
  await writeJsonPretty(getPaperclipProjectApprovalsPath(projectSlug), approvals)
}

export async function listApprovals(projectIdOrSlug?: string): Promise<Array<PaperclipApproval>> {
  if (projectIdOrSlug) {
    const project = await getProject(projectIdOrSlug)
    if (!project) throw new Error('Project not found')
    return readApprovals(project.slug)
  }
  const { listProjects } = await import('@/server/paperclip-projects')
  const projects = await listProjects()
  const nested = await Promise.all(projects.map((project) => readApprovals(project.slug)))
  return nested.flat().sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
}

export async function createApproval(input: {
  projectId: string
  missionId: string
  type: ApprovalType
  requiredByRole: PaperclipApproval['requiredByRole']
  rationale: string
  requestedDecision?: string
  decisionOptions?: Array<string>
  recommendedOption?: string
  blockingIssues?: Array<string>
}): Promise<PaperclipApproval> {
  const project = await getProject(input.projectId)
  if (!project) throw new Error('Project not found')
  const approval: PaperclipApproval = {
    id: makePaperclipId('approval'),
    projectId: project.id,
    missionId: input.missionId,
    type: input.type,
    requiredByRole: input.requiredByRole,
    status: 'pending',
    rationale: input.rationale,
    requestedDecision: input.requestedDecision,
    decisionOptions: input.decisionOptions,
    recommendedOption: input.recommendedOption,
    blockingIssues: input.blockingIssues || [],
    decisionLog: [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
  const current = await readApprovals(project.slug)
  await writeApprovals(project.slug, [...current, approval])
  await appendProjectEvent({
    projectId: project.id,
    missionId: approval.missionId,
    type: 'approval_created',
    summary: `Approval created: ${approval.type}`,
  })
  return approval
}

export async function updateApprovalStatus(
  approvalId: string,
  status: ApprovalStatus,
  note?: string,
): Promise<PaperclipApproval> {
  const approvals = await listApprovals()
  const approval = approvals.find((item) => item.id === approvalId)
  if (!approval) throw new Error('Approval not found')
  const project = await getProject(approval.projectId)
  if (!project) throw new Error('Project not found')
  const projectApprovals = await readApprovals(project.slug)
  const timestamp = nowIso()
  const next: PaperclipApproval = {
    ...approval,
    status,
    updatedAt: timestamp,
    approvedAt: status === 'approved' ? timestamp : approval.approvedAt,
    rejectedAt: status === 'rejected' ? timestamp : approval.rejectedAt,
    decisionLog: note ? [...approval.decisionLog, `${timestamp}: ${note}`] : approval.decisionLog,
    resolutionSummary: note || approval.resolutionSummary,
  }
  await writeApprovals(
    project.slug,
    projectApprovals.map((item) => (item.id === approvalId ? next : item)),
  )
  await appendProjectEvent({
    projectId: project.id,
    missionId: next.missionId,
    type: 'approval_updated',
    summary: `Approval ${next.type} updated to ${status}`,
  })
  return next
}

export async function createClaudeFinalApprovalForMission(
  missionId: string,
): Promise<PaperclipApproval | null> {
  const mission = await getMission(missionId)
  if (!mission) return null
  const project = await getProject(mission.projectId)
  if (!project) return null
  const approvals = await readApprovals(project.slug)
  const existing = approvals.find(
    (approval) => approval.missionId === missionId && approval.type === 'claude_code_final',
  )
  if (existing) return existing
  return createApproval({
    projectId: project.id,
    missionId,
    type: 'claude_code_final',
    requiredByRole: 'cto',
    rationale: 'Code-related missions must receive Claude final approval before merge or execution.',
  })
}

export async function ensureApprovalForMission(
  missionId: string,
  status?: string,
): Promise<PaperclipApproval | null> {
  const mission = await getMission(missionId)
  if (!mission) return null
  if (!['cto', 'engineering'].includes(mission.role)) return null
  if (status && !['awaiting_approval', 'completed'].includes(status)) return null
  return createClaudeFinalApprovalForMission(missionId)
}

export async function ensureFounderApprovalForMission(input: {
  projectId: string
  missionId: string
  rationale: string
  requestedDecision?: string
  decisionOptions?: Array<string>
  recommendedOption?: string
}): Promise<PaperclipApproval | null> {
  const project = await getProject(input.projectId)
  if (!project) return null
  const approvals = await readApprovals(project.slug)
  const existing = approvals.find(
    (approval) =>
      approval.missionId === input.missionId &&
      approval.requiredByRole === 'founder' &&
      approval.status === 'pending',
  )
  if (existing) return existing
  return createApproval({
    projectId: input.projectId,
    missionId: input.missionId,
    type: 'founder_strategy',
    requiredByRole: 'founder',
    rationale: input.rationale,
    requestedDecision: input.requestedDecision,
    decisionOptions: input.decisionOptions,
    recommendedOption: input.recommendedOption,
  })
}
