
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '@/server/auth-middleware'
import { requireJsonContentType } from '@/server/rate-limit'
import { listApprovals } from '@/server/paperclip-approvals'
import { listHandoffs } from '@/server/paperclip-handoffs'
import { listProjectMissions } from '@/server/paperclip-missions'
import { getProject, updateProject } from '@/server/paperclip-projects'

export const Route = createFileRoute('/api/paperclip/projects/$projectId')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!isAuthenticated(request)) return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        const project = await getProject(params.projectId)
        if (!project) return json({ ok: false, error: 'Project not found' }, { status: 404 })
        const [missions, handoffs, approvals] = await Promise.all([
          listProjectMissions(project.id),
          listHandoffs(project.id),
          listApprovals(project.id),
        ])
        return json({ ok: true, detail: { project, missions, handoffs, approvals, artifacts: [] } })
      },
      PATCH: async ({ request, params }) => {
        if (!isAuthenticated(request)) return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        const csrf = requireJsonContentType(request)
        if (csrf) return csrf
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
        return json({ ok: true, project: await updateProject(params.projectId, body as any) })
      },
    },
  },
})
