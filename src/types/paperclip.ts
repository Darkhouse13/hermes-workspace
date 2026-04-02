
export type PaperclipRole =
  | 'ceo'
  | 'research'
  | 'cto'
  | 'engineering'
  | 'qa'
  | 'content'

export type MissionStatus =
  | 'queued'
  | 'in_progress'
  | 'blocked'
  | 'awaiting_handoff'
  | 'awaiting_approval'
  | 'completed'
  | 'cancelled'

export type ApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'changes_requested'

export type ProjectStage =
  | 'idea'
  | 'validation'
  | 'scoping'
  | 'architecture'
  | 'build'
  | 'launch'
  | 'growth'
  | 'paused'
  | 'archived'

export type ApprovalType =
  | 'founder_strategy'
  | 'founder_budget'
  | 'founder_launch'
  | 'claude_code_final'
  | 'qa_release'

export type RouteNextActionType =
  | 'launch_mission'
  | 'request_approval'
  | 'resolve_blocker'
  | 'review_handoff'
  | 'resume_stale_mission'
  | 'create_successor_mission'
  | 'noop'

export type RoleRoutingRule = {
  role: PaperclipRole
  label: string
  primaryModel: string
  primaryProvider: string
  fallbackModel?: string
  fallbackProvider?: string
  finalApprovalRequired?: boolean
  notes?: string
}

export type PaperclipCompany = {
  id: string
  name: string
  orgChartLabel: string
  routing: Array<RoleRoutingRule>
  approvalPolicy: {
    requireClaudeFinalApprovalForCode: boolean
    founderApprovalRequiredForLaunch: boolean
    founderApprovalRequiredForStrategy: boolean
  }
  costPolicy: {
    preferLowerCostForLowRisk: boolean
    preserveSpecialistsForHighRisk: boolean
  }
  createdAt: string
  updatedAt: string
}

export type PaperclipArtifact = {
  id: string
  projectId: string
  missionId?: string
  type: string
  title: string
  summary?: string
  path?: string
  tags?: Array<string>
  createdAt: string
}

export type PaperclipDecision = {
  id: string
  projectId: string
  sourceMissionId?: string
  title: string
  context: string
  optionsConsidered: Array<string>
  chosenOption: string
  reason: string
  downside?: string
  revisitTrigger?: string
  createdAt: string
}

export type PaperclipProject = {
  id: string
  slug: string
  name: string
  status: 'active' | 'paused' | 'archived'
  stage: ProjectStage
  thesis: string
  objective: string
  owner: string
  primaryMarket?: string
  constraints: Array<string>
  successMetrics: Array<string>
  latestSummary: string
  activeMissionIds: Array<string>
  linkedSessionIds: Array<string>
  createdAt: string
  updatedAt: string
}

export type PaperclipMission = {
  id: string
  projectId: string
  title: string
  role: PaperclipRole
  status: MissionStatus
  priority: number
  riskTier: 0 | 1 | 2 | 3
  goal: string
  instructions: string
  inputs: Array<string>
  expectedOutputs: Array<string>
  linkedSessionIds: Array<string>
  dependencyIds: Array<string>
  parentMissionId?: string
  resultSummary?: string
  nextRecommendedAction?: string
  provider?: string
  model?: string
  fallbackProvider?: string
  fallbackModel?: string
  createdAt: string
  startedAt?: string
  completedAt?: string
  updatedAt: string
}

export type PaperclipHandoff = {
  id: string
  projectId: string
  missionId: string
  fromRole: PaperclipRole
  toRole: PaperclipRole | 'founder'
  summary: string
  whatChanged?: string
  decisions: Array<string>
  blockers: Array<string>
  nextSteps: Array<string>
  openQuestions: Array<string>
  confidence: 'low' | 'medium' | 'high'
  changedFiles?: Array<string>
  testStatus?: string
  unresolvedWarnings?: Array<string>
  rollbackNotes?: string
  createdAt: string
}

export type PaperclipApproval = {
  id: string
  projectId: string
  missionId: string
  type: ApprovalType
  requiredByRole: PaperclipRole | 'founder'
  status: ApprovalStatus
  rationale: string
  requestedDecision?: string
  decisionOptions?: Array<string>
  recommendedOption?: string
  blockingIssues: Array<string>
  decisionLog: Array<string>
  resolutionSummary?: string
  createdAt: string
  updatedAt: string
  approvedAt?: string
  rejectedAt?: string
}

export type PaperclipEventType =
  | 'project_created'
  | 'mission_created'
  | 'mission_status_changed'
  | 'session_linked'
  | 'handoff_created'
  | 'approval_created'
  | 'approval_updated'
  | 'route_recommended'

export type PaperclipEvent = {
  id: string
  projectId: string
  missionId?: string
  type: PaperclipEventType
  summary: string
  metadata?: Record<string, unknown>
  createdAt: string
}

export type PaperclipSessionLink = {
  sessionId: string
  missionId: string
  projectId: string
  role: PaperclipRole
  createdAt: string
}

export type PaperclipProjectSummary = {
  project: PaperclipProject
  activeMissionCount: number
  blockedMissionCount: number
  pendingApprovalCount: number
  latestHandoffSnippet?: string
}

export type PaperclipProjectDetail = {
  project: PaperclipProject
  missions: Array<PaperclipMission>
  handoffs: Array<PaperclipHandoff>
  approvals: Array<PaperclipApproval>
  artifacts: Array<PaperclipArtifact>
  events: Array<PaperclipEvent>
  sessionLinks: Array<PaperclipSessionLink>
}

export type PaperclipMissionFilters = {
  projectId?: string
  role?: PaperclipRole
  status?: MissionStatus
  riskTier?: number
}

export type PaperclipHandoffFilters = {
  projectId?: string
  missionId?: string
  role?: PaperclipRole
}

export type PaperclipApprovalFilters = {
  projectId?: string
  missionId?: string
  status?: ApprovalStatus
  type?: ApprovalType
}

export type LaunchRoleRequest = {
  projectId: string
  missionId?: string
  role: PaperclipRole
  title?: string
  goal: string
  instructions: string
  priority?: number
  riskTier?: 0 | 1 | 2 | 3
}

export type LaunchRoleResponse = {
  mission: PaperclipMission
  sessionId: string
  provider: string
  model: string
  fallbackProvider?: string
  fallbackModel?: string
  approvalRequired: boolean
}

export type RouteNextAction = {
  action: RouteNextActionType
  missionId?: string
  recommendedRole?: PaperclipRole
  rationale: string
  suggestedTitle?: string
  suggestedGoal?: string
  suggestedInstructions?: string
}

export const PAPERCLIP_ROLES: Array<PaperclipRole> = [
  'ceo',
  'research',
  'cto',
  'engineering',
  'qa',
  'content',
]

export const MISSION_STATUSES: Array<MissionStatus> = [
  'queued',
  'in_progress',
  'blocked',
  'awaiting_handoff',
  'awaiting_approval',
  'completed',
  'cancelled',
]
