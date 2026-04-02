
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '@/server/auth-middleware'
import { routeNextForProject } from '@/server/paperclip-routing'

export const Route = createFileRoute('/api/paperclip/route-next')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        const url = new URL(request.url)
        const projectId = url.searchParams.get('projectId') || ''
        return json({ ok: true, recommendation: await routeNextForProject(projectId) })
      },
    },
  },
})
