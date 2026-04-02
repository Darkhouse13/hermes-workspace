
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '@/server/auth-middleware'
import { requireJsonContentType } from '@/server/rate-limit'
import { createProject, listProjectSummaries } from '@/server/paperclip-projects'

export const Route = createFileRoute('/api/paperclip/projects')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        return json({ ok: true, items: await listProjectSummaries() })
      },
      POST: async ({ request }) => {
        if (!isAuthenticated(request)) return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        const csrf = requireJsonContentType(request)
        if (csrf) return csrf
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
        const project = await createProject({
          name: String(body.name || '').trim(),
          thesis: typeof body.thesis === 'string' ? body.thesis : '',
          objective: typeof body.objective === 'string' ? body.objective : '',
          owner: typeof body.owner === 'string' ? body.owner : 'Hermes',
          primaryMarket: typeof body.primaryMarket === 'string' ? body.primaryMarket : '',
          constraints: Array.isArray(body.constraints) ? body.constraints.map(String) : [],
          successMetrics: Array.isArray(body.successMetrics) ? body.successMetrics.map(String) : [],
        })
        return json({ ok: true, project })
      },
    },
  },
})
