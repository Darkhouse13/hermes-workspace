
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '@/server/auth-middleware'
import { requireJsonContentType } from '@/server/rate-limit'
import { getProjectDetail, updateProject } from '@/server/paperclip-projects'
import type { PaperclipProject } from '@/types/paperclip'

export const Route = createFileRoute('/api/paperclip/projects/$projectId')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!isAuthenticated(request)) return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        const detail = await getProjectDetail(params.projectId)
        if (!detail) return json({ ok: false, error: 'Project not found' }, { status: 404 })
        return json({ ok: true, detail })
      },
      PATCH: async ({ request, params }) => {
        if (!isAuthenticated(request)) return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        const csrf = requireJsonContentType(request)
        if (csrf) return csrf
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
        return json({ ok: true, project: await updateProject(params.projectId, body as Partial<PaperclipProject>) })
      },
    },
  },
})
