
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { PaperclipButton } from '@/components/paperclip/paperclip-button'
import { PaperclipCard } from '@/components/paperclip/paperclip-card'

export function CreateMissionDialog({ projectId, onSubmit }: { projectId: string; onSubmit: (payload: Record<string, unknown>) => Promise<void> | void }) {
  const [title, setTitle] = useState('')
  const [role, setRole] = useState('research')
  const [goal, setGoal] = useState('')
  const [instructions, setInstructions] = useState('')
  return (
    <PaperclipCard className="space-y-3">
      <div className="brutalist-label">Create mission</div>
      <Input nativeInput value={title} onChange={(e) => setTitle(e.currentTarget.value)} placeholder="Mission title" />
      <Input nativeInput value={role} onChange={(e) => setRole(e.currentTarget.value)} placeholder="Role" />
      <textarea className="brutalist-textarea" value={goal} onChange={(e) => setGoal(e.currentTarget.value)} placeholder="Goal" />
      <textarea className="brutalist-textarea" value={instructions} onChange={(e) => setInstructions(e.currentTarget.value)} placeholder="Instructions" />
      <PaperclipButton onClick={() => onSubmit({ projectId, title, role, goal, instructions })} disabled={!title.trim()}>Create mission</PaperclipButton>
    </PaperclipCard>
  )
}
