
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '@/server/auth-middleware'
import { requireJsonContentType } from '@/server/rate-limit'
import { ensureApprovalForMission } from '@/server/paperclip-approvals'
import { ensureHandoffForMissionTransition } from '@/server/paperclip-handoffs'
import { getMission, transitionMissionStatus, updateMission } from '@/server/paperclip-missions'
import type { MissionStatus, PaperclipMission } from '@/types/paperclip'

export const Route = createFileRoute('/api/paperclip/missions/$missionId')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!isAuthenticated(request)) return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        const mission = await getMission(params.missionId)
        if (!mission) return json({ ok: false, error: 'Mission not found' }, { status: 404 })
        return json({ ok: true, mission })
      },
      PATCH: async ({ request, params }) => {
        if (!isAuthenticated(request)) return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        const csrf = requireJsonContentType(request)
        if (csrf) return csrf
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
        let mission = body.status
          ? await transitionMissionStatus(params.missionId, String(body.status) as MissionStatus)
          : await updateMission(params.missionId, body as Partial<PaperclipMission>)
        if (mission.status === 'blocked' || mission.status === 'awaiting_approval' || mission.status === 'completed') {
          await ensureHandoffForMissionTransition(mission.id, mission.status as 'blocked' | 'awaiting_approval' | 'completed')
        }
        if (mission.status === 'awaiting_approval' || mission.status === 'completed') {
          await ensureApprovalForMission(mission.id, mission.status)
        }
        mission = (await getMission(params.missionId)) || mission
        return json({ ok: true, mission })
      },
    },
  },
})
