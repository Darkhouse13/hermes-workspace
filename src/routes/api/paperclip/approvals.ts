
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '@/server/auth-middleware'
import { requireJsonContentType } from '@/server/rate-limit'
import { createApproval, listApprovals, updateApprovalStatus } from '@/server/paperclip-approvals'
import type { ApprovalStatus, ApprovalType, PaperclipRole } from '@/types/paperclip'

export const Route = createFileRoute('/api/paperclip/approvals')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        const url = new URL(request.url)
        const projectId = url.searchParams.get('projectId') || undefined
        return json({ ok: true, items: await listApprovals(projectId) })
      },
      POST: async ({ request }) => {
        if (!isAuthenticated(request)) return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        const csrf = requireJsonContentType(request)
        if (csrf) return csrf
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
        if (body.approvalId) {
          return json({ ok: true, approval: await updateApprovalStatus(String(body.approvalId), String(body.status) as ApprovalStatus, typeof body.note === 'string' ? body.note : undefined) })
        }
        return json({ ok: true, approval: await createApproval({
          projectId: String(body.projectId || ''),
          missionId: String(body.missionId || ''),
          type: String(body.type || 'founder_strategy') as ApprovalType,
          requiredByRole: String(body.requiredByRole || 'founder') as PaperclipRole | 'founder',
          rationale: String(body.rationale || ''),
          requestedDecision: typeof body.requestedDecision === 'string' ? body.requestedDecision : undefined,
          decisionOptions: Array.isArray(body.decisionOptions) ? body.decisionOptions.map(String) : undefined,
          recommendedOption: typeof body.recommendedOption === 'string' ? body.recommendedOption : undefined,
          blockingIssues: Array.isArray(body.blockingIssues) ? body.blockingIssues.map(String) : [],
        }) })
      },
    },
  },
})
