import { useState } from 'react'
import type { PaperclipApproval } from '@/types/paperclip'
import { PaperclipBadge } from '@/components/paperclip/paperclip-badge'
import { PaperclipCard } from '@/components/paperclip/paperclip-card'

export function FounderApprovalCard({
  approval,
  onUpdate,
}: {
  approval: PaperclipApproval
  onUpdate: (payload: Record<string, unknown>) => Promise<void> | void
}) {
  const [note, setNote] = useState(approval.resolutionSummary || '')

  const submit = (status: 'approved' | 'rejected' | 'changes_requested', preset?: string) => {
    const finalNote = preset || note || `${status} in Mission Control`
    return onUpdate({ approvalId: approval.id, status, note: finalNote })
  }

  return (
    <PaperclipCard className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="brutalist-label">{approval.type}</div>
        <PaperclipBadge
          label={approval.status}
          tone={
            approval.status === 'approved'
              ? 'success'
              : approval.status === 'rejected'
                ? 'danger'
                : 'warning'
          }
        />
      </div>

      <p className="text-sm text-[var(--theme-text)]">{approval.rationale}</p>

      {approval.requestedDecision ? (
        <div className="space-y-2 border-2 border-dashed border-[var(--theme-border)] p-3">
          <div className="brutalist-label">Founder decision needed</div>
          <p className="text-sm font-semibold text-[var(--theme-text)]">{approval.requestedDecision}</p>
          {approval.recommendedOption ? (
            <p className="text-sm text-[var(--theme-muted)]">
              Recommended: <strong className="text-[var(--theme-text)]">{approval.recommendedOption}</strong>
            </p>
          ) : null}
          {approval.decisionOptions?.length ? (
            <div className="flex flex-wrap gap-2">
              {approval.decisionOptions.map((option) => (
                <button
                  key={option}
                  className="brutalist-badge cursor-pointer"
                  onClick={() => setNote(`Founder selected option: ${option}`)}
                >
                  {option}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <textarea
        className="brutalist-textarea"
        placeholder="Decision note / rationale"
        value={note}
        onChange={(event) => setNote(event.currentTarget.value)}
      />

      <div className="flex flex-wrap gap-2">
        <button className="brutalist-button" onClick={() => submit('approved')}>
          Approve
        </button>
        <button className="brutalist-button" onClick={() => submit('changes_requested')}>
          Request changes
        </button>
        <button className="brutalist-button" onClick={() => submit('rejected')}>
          Reject
        </button>
        {approval.recommendedOption ? (
          <button
            className="brutalist-button"
            onClick={() => submit('approved', `Founder approved recommended option: ${approval.recommendedOption}`)}
          >
            Approve recommended option
          </button>
        ) : null}
      </div>
    </PaperclipCard>
  )
}
