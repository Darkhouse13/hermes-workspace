
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '@/server/auth-middleware'
import { requireJsonContentType } from '@/server/rate-limit'
import { getPaperclipCompany, updatePaperclipCompany } from '@/server/paperclip-company'

export const Route = createFileRoute('/api/paperclip/company')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        return json({ ok: true, company: await getPaperclipCompany() })
      },
      PATCH: async ({ request }) => {
        if (!isAuthenticated(request)) return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        const csrf = requireJsonContentType(request)
        if (csrf) return csrf
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
        return json({ ok: true, company: await updatePaperclipCompany(body as any) })
      },
    },
  },
})
