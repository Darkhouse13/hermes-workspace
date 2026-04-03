
import { useState } from 'react'
import type { PaperclipProject, ProjectStage } from '@/types/paperclip'
import { Input } from '@/components/ui/input'
import { PaperclipCard } from '@/components/paperclip/paperclip-card'
import { PaperclipButton } from '@/components/paperclip/paperclip-button'

export function EditProjectDialog({ project, onSubmit }: { project: PaperclipProject; onSubmit: (payload: Record<string, unknown>) => Promise<void> | void }) {
  const [thesis, setThesis] = useState(project.thesis)
  const [objective, setObjective] = useState(project.objective)
  const [stage, setStage] = useState<ProjectStage>(project.stage)
  return (
    <PaperclipCard className="space-y-3">
      <div className="brutalist-label">Edit project</div>
      <Input nativeInput value={project.name} readOnly />
      <textarea className="brutalist-textarea" value={thesis} onChange={(e) => setThesis(e.currentTarget.value)} />
      <textarea className="brutalist-textarea" value={objective} onChange={(e) => setObjective(e.currentTarget.value)} />
      <Input nativeInput value={stage} onChange={(e) => setStage(e.currentTarget.value as ProjectStage)} />
      <PaperclipButton onClick={() => onSubmit({ thesis, objective, stage })}>Save project</PaperclipButton>
    </PaperclipCard>
  )
}
