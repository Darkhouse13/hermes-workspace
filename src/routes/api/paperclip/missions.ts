
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '@/server/auth-middleware'
import { requireJsonContentType } from '@/server/rate-limit'
import { createMission, listMissions } from '@/server/paperclip-missions'

export const Route = createFileRoute('/api/paperclip/missions')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        const url = new URL(request.url)
        const projectId = url.searchParams.get('projectId') || undefined
        const role = url.searchParams.get('role') || undefined
        const status = url.searchParams.get('status') || undefined
        const riskTier = url.searchParams.get('riskTier')
        const items = await listMissions({
          projectId,
          role: role as any,
          status: status as any,
          riskTier: riskTier ? Number(riskTier) : undefined,
        })
        return json({ ok: true, items })
      },
      POST: async ({ request }) => {
        if (!isAuthenticated(request)) return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        const csrf = requireJsonContentType(request)
        if (csrf) return csrf
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
        const mission = await createMission({
          projectId: String(body.projectId || ''),
          title: String(body.title || ''),
          role: String(body.role || 'research') as any,
          goal: String(body.goal || ''),
          instructions: String(body.instructions || ''),
          priority: typeof body.priority === 'number' ? body.priority : Number(body.priority || 2),
          riskTier: typeof body.riskTier === 'number' ? body.riskTier as any : Number(body.riskTier || 1) as any,
          inputs: Array.isArray(body.inputs) ? body.inputs.map(String) : [],
          expectedOutputs: Array.isArray(body.expectedOutputs) ? body.expectedOutputs.map(String) : [],
          dependencyIds: Array.isArray(body.dependencyIds) ? body.dependencyIds.map(String) : [],
        })
        return json({ ok: true, mission })
      },
    },
  },
})
