
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { PaperclipButton } from '@/components/paperclip/paperclip-button'
import { PaperclipCard } from '@/components/paperclip/paperclip-card'

export function CreateHandoffDialog({ projectId, missionId, onSubmit }: { projectId: string; missionId: string; onSubmit: (payload: Record<string, unknown>) => Promise<void> | void }) {
  const [fromRole, setFromRole] = useState('research')
  const [toRole, setToRole] = useState('ceo')
  const [summary, setSummary] = useState('')
  return (
    <PaperclipCard className="space-y-3">
      <div className="brutalist-label">Create handoff</div>
      <Input nativeInput value={fromRole} onChange={(e) => setFromRole(e.currentTarget.value)} placeholder="From role" />
      <Input nativeInput value={toRole} onChange={(e) => setToRole(e.currentTarget.value)} placeholder="To role" />
      <textarea className="brutalist-textarea" value={summary} onChange={(e) => setSummary(e.currentTarget.value)} placeholder="Summary" />
      <PaperclipButton onClick={() => onSubmit({ projectId, missionId, fromRole, toRole, summary })} disabled={!summary.trim()}>Create handoff</PaperclipButton>
    </PaperclipCard>
  )
}
