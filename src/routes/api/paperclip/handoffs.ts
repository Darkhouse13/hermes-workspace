
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '@/server/auth-middleware'
import { requireJsonContentType } from '@/server/rate-limit'
import { createHandoff, listHandoffs } from '@/server/paperclip-handoffs'
import type { PaperclipRole } from '@/types/paperclip'

export const Route = createFileRoute('/api/paperclip/handoffs')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        const url = new URL(request.url)
        const projectId = url.searchParams.get('projectId') || undefined
        return json({ ok: true, items: await listHandoffs(projectId) })
      },
      POST: async ({ request }) => {
        if (!isAuthenticated(request)) return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        const csrf = requireJsonContentType(request)
        if (csrf) return csrf
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
        return json({
          ok: true,
          handoff: await createHandoff({
            projectId: String(body.projectId || ''),
            missionId: String(body.missionId || ''),
            fromRole: String(body.fromRole || 'research') as PaperclipRole,
            toRole: String(body.toRole || 'ceo') as PaperclipRole | 'founder',
            summary: String(body.summary || ''),
            whatChanged: typeof body.whatChanged === 'string' ? body.whatChanged : undefined,
            decisions: Array.isArray(body.decisions) ? body.decisions.map(String) : [],
            blockers: Array.isArray(body.blockers) ? body.blockers.map(String) : [],
            nextSteps: Array.isArray(body.nextSteps) ? body.nextSteps.map(String) : [],
            openQuestions: Array.isArray(body.openQuestions) ? body.openQuestions.map(String) : [],
            confidence: (body.confidence as 'low' | 'medium' | 'high' | undefined) ?? 'medium',
          }),
        })
      },
    },
  },
})
