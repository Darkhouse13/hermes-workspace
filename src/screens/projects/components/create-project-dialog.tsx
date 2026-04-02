
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { PaperclipCard } from '@/components/paperclip/paperclip-card'
import { PaperclipButton } from '@/components/paperclip/paperclip-button'

export function CreateProjectDialog({ onSubmit }: { onSubmit: (payload: Record<string, unknown>) => Promise<void> | void }) {
  const [name, setName] = useState('')
  const [thesis, setThesis] = useState('')
  const [objective, setObjective] = useState('')
  return (
    <PaperclipCard className="space-y-3">
      <div className="brutalist-label">Create project</div>
      <Input nativeInput value={name} onChange={(e) => setName(e.currentTarget.value)} placeholder="Project name" />
      <textarea className="brutalist-textarea" value={thesis} onChange={(e) => setThesis(e.currentTarget.value)} placeholder="Thesis" />
      <textarea className="brutalist-textarea" value={objective} onChange={(e) => setObjective(e.currentTarget.value)} placeholder="Objective" />
      <PaperclipButton onClick={() => onSubmit({ name, thesis, objective })} disabled={!name.trim()}>Create project</PaperclipButton>
    </PaperclipCard>
  )
}
