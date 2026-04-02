import type { PaperclipCompany, RoleRoutingRule } from '@/types/paperclip'
import { getPaperclipCompanyPath } from '@/server/paperclip-paths'
import { nowIso, readJsonOrDefault, writeJsonPretty } from '@/server/paperclip-store'

const DEFAULT_ROUTING: Array<RoleRoutingRule> = [
  {
    role: 'ceo',
    label: 'CEO / Orchestrator',
    primaryModel: 'current-runtime',
    primaryProvider: 'current-runtime',
    fallbackModel: 'gpt-5.4-mini',
    fallbackProvider: 'openai-codex',
  },
  {
    role: 'research',
    label: 'Research & Strategy',
    primaryModel: 'gpt-5.4-mini',
    primaryProvider: 'openai-codex',
    fallbackModel: 'GLM-5.1',
    fallbackProvider: 'zai',
  },
  {
    role: 'cto',
    label: 'CTO / Lead Engineer',
    primaryModel: 'Claude Code',
    primaryProvider: 'anthropic',
    fallbackModel: 'kimi-k2.5',
    fallbackProvider: 'moonshot',
    finalApprovalRequired: true,
    notes: 'Claude must approve final code path before merge.',
  },
  {
    role: 'engineering',
    label: 'Engineering',
    primaryModel: 'Claude Code',
    primaryProvider: 'anthropic',
    fallbackModel: 'kimi-k2.5',
    fallbackProvider: 'moonshot',
    finalApprovalRequired: true,
  },
  {
    role: 'qa',
    label: 'QA / Validation',
    primaryModel: 'kimi-k2.5',
    primaryProvider: 'moonshot',
    fallbackModel: 'gpt-5.4-mini',
    fallbackProvider: 'openai-codex',
  },
  {
    role: 'content',
    label: 'Content & Marketing',
    primaryModel: 'MiniMax-M2.7',
    primaryProvider: 'minimax',
    fallbackModel: 'gpt-5.4-mini',
    fallbackProvider: 'openai-codex',
  },
]

function buildDefaultCompany(): PaperclipCompany {
  const timestamp = nowIso()
  return {
    id: 'paperclip-company',
    name: 'Paperclip',
    orgChartLabel: 'Founder-driven multi-project operating system',
    routing: DEFAULT_ROUTING,
    approvalPolicy: {
      requireClaudeFinalApprovalForCode: true,
      founderApprovalRequiredForLaunch: true,
      founderApprovalRequiredForStrategy: true,
    },
    costPolicy: {
      preferLowerCostForLowRisk: true,
      preserveSpecialistsForHighRisk: true,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export async function getPaperclipCompany(): Promise<PaperclipCompany> {
  const company = await readJsonOrDefault<PaperclipCompany | null>(
    getPaperclipCompanyPath(),
    null,
  )
  if (company) return company
  const created = buildDefaultCompany()
  await writeJsonPretty(getPaperclipCompanyPath(), created)
  return created
}

export async function updatePaperclipCompany(
  patch: Partial<PaperclipCompany>,
): Promise<PaperclipCompany> {
  const current = await getPaperclipCompany()
  const next: PaperclipCompany = {
    ...current,
    ...patch,
    updatedAt: nowIso(),
  }
  await writeJsonPretty(getPaperclipCompanyPath(), next)
  return next
}

export async function getRoleRoutingRules(): Promise<Array<RoleRoutingRule>> {
  const company = await getPaperclipCompany()
  return company.routing
}

export async function getRoleRoutingRule(role: RoleRoutingRule['role']) {
  const rules = await getRoleRoutingRules()
  return rules.find((rule) => rule.role === role)
}
