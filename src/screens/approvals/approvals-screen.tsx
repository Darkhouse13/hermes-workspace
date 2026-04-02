
import { useEffect } from 'react'
import { PaperclipBadge } from '@/components/paperclip/paperclip-badge'
import { PaperclipCard } from '@/components/paperclip/paperclip-card'
import { PaperclipPage } from '@/components/paperclip/paperclip-page'
import { usePaperclipStore } from '@/stores/paperclip-store'

export function ApprovalsScreen() {
  const { approvals, fetchApprovals, updateApproval } = usePaperclipStore()
  useEffect(() => { void fetchApprovals() }, [fetchApprovals])
  return (
    <PaperclipPage title="Approvals" subtitle="Governance checkpoints for launches, strategy shifts, and Claude final code approval.">
      <div className="grid gap-3">
        {approvals.map((approval) => (
          <PaperclipCard key={approval.id} className="space-y-3">
            <div className="flex items-center justify-between gap-2"><div className="brutalist-label">{approval.type}</div><PaperclipBadge label={approval.status} tone={approval.status === 'approved' ? 'success' : approval.status === 'rejected' ? 'danger' : 'warning'} /></div>
            <p className="text-sm text-[var(--theme-text)]">{approval.rationale}</p>
            <div className="flex flex-wrap gap-2">
              <button className="brutalist-button" onClick={() => updateApproval({ approvalId: approval.id, status: 'approved', note: 'Approved in Mission Control' })}>Approve</button>
              <button className="brutalist-button" onClick={() => updateApproval({ approvalId: approval.id, status: 'rejected', note: 'Rejected in Mission Control' })}>Reject</button>
              <button className="brutalist-button" onClick={() => updateApproval({ approvalId: approval.id, status: 'changes_requested', note: 'Changes requested in Mission Control' })}>Request changes</button>
            </div>
          </PaperclipCard>
        ))}
        {approvals.length === 0 ? <PaperclipCard>No approvals yet.</PaperclipCard> : null}
      </div>
    </PaperclipPage>
  )
}
