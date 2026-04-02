
import { useEffect } from 'react'
import { PaperclipCard } from '@/components/paperclip/paperclip-card'
import { PaperclipPage } from '@/components/paperclip/paperclip-page'
import { PaperclipBadge } from '@/components/paperclip/paperclip-badge'
import { usePaperclipStore } from '@/stores/paperclip-store'

export function HandoffsScreen() {
  const { handoffs, fetchHandoffs } = usePaperclipStore()
  useEffect(() => { void fetchHandoffs() }, [fetchHandoffs])
  return (
    <PaperclipPage title="Handoffs" subtitle="Structured transfers between roles so orchestration survives project switching.">
      <div className="grid gap-3">
        {handoffs.map((handoff) => <PaperclipCard key={handoff.id} className="space-y-2"><div className="flex items-center justify-between gap-2"><div className="brutalist-label">{handoff.fromRole} → {handoff.toRole}</div><PaperclipBadge label={handoff.confidence} tone={handoff.confidence === 'high' ? 'success' : handoff.confidence === 'low' ? 'danger' : 'warning'} /></div><p className="text-sm text-[var(--theme-text)]">{handoff.summary}</p><p className="text-xs text-[var(--theme-muted)]">Mission {handoff.missionId}</p></PaperclipCard>)}
        {handoffs.length === 0 ? <PaperclipCard>No handoffs yet.</PaperclipCard> : null}
      </div>
    </PaperclipPage>
  )
}
