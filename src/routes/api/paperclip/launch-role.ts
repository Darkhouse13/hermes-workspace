
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '@/server/auth-middleware'
import { requireJsonContentType } from '@/server/rate-limit'
import { launchRoleForMission } from '@/server/paperclip-launchers'
import type { PaperclipRole } from '@/types/paperclip'

export const Route = createFileRoute('/api/paperclip/launch-role')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthenticated(request)) return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        const csrf = requireJsonContentType(request)
        if (csrf) return csrf
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
        return json({ ok: true, launch: await launchRoleForMission({
          projectId: String(body.projectId || ''),
          missionId: typeof body.missionId === 'string' ? body.missionId : undefined,
          role: String(body.role || 'research') as PaperclipRole,
          title: typeof body.title === 'string' ? body.title : undefined,
          goal: String(body.goal || ''),
          instructions: String(body.instructions || ''),
          priority: typeof body.priority === 'number' ? body.priority : Number(body.priority || 2),
          riskTier: (typeof body.riskTier === 'number' ? body.riskTier : Number(body.riskTier || 1)) as 0 | 1 | 2 | 3,
        }) })
      },
    },
  },
})
