import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog'
import { computeDiff } from './markdown-preview'

// ──────────────────────────────────────────────────────────────────────────────
// Diff Modal
// ──────────────────────────────────────────────────────────────────────────────

export type DiffModalProps = {
  open: boolean
  fileName: string
  original: string
  updated: string
  onSave: () => void
  onCancel: () => void
}

export function DiffModal({ open, fileName, original, updated, onSave, onCancel }: DiffModalProps) {
  const diffLines = useMemo(
    () => (open ? computeDiff(original, updated) : []),
    [open, original, updated],
  )

  const addedCount = diffLines.filter((l) => l.kind === 'added').length
  const removedCount = diffLines.filter((l) => l.kind === 'removed').length

  // Separate left (original) and right (new) columns for split view
  const leftLines = diffLines.filter((l) => l.kind !== 'added')
  const rightLines = diffLines.filter((l) => l.kind !== 'removed')

  if (!open) return null

  return (
    <DialogRoot open={open} onOpenChange={(isOpen) => { if (!isOpen) onCancel() }}>
      <DialogContent className="max-w-5xl w-full">
        <div className="flex flex-col max-h-[85vh]">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-primary-200 dark:border-neutral-800 px-5 py-3">
            <div className="min-w-0">
              <DialogTitle className="text-sm font-semibold text-primary-900 dark:text-neutral-100 truncate">
                Review changes — {fileName}
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs text-primary-500 dark:text-neutral-400">
                <span className="text-emerald-600 font-medium">+{addedCount} added</span>
                {' · '}
                <span className="text-red-600 font-medium">−{removedCount} removed</span>
              </DialogDescription>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" size="sm" onClick={onCancel}>
                Cancel
              </Button>
              <Button size="sm" onClick={onSave}>
                Save anyway
              </Button>
            </div>
          </div>

          {/* Split diff view */}
          <div className="flex flex-1 min-h-0 overflow-hidden divide-x divide-primary-200 dark:divide-neutral-800">
            {/* Left — original */}
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
              <div className="shrink-0 px-3 py-1.5 text-[11px] font-semibold text-primary-500 dark:text-neutral-400 bg-primary-100/60 dark:bg-neutral-900/60 border-b border-primary-200 dark:border-neutral-800 uppercase tracking-wide">
                Original
              </div>
              <div className="flex-1 overflow-auto">
                <div className="font-mono text-[11px] leading-relaxed">
                  {leftLines.map((line, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'flex items-start gap-0',
                        line.kind === 'removed'
                          ? 'bg-red-50 dark:bg-red-950/25'
                          : '',
                      )}
                    >
                      <span className="shrink-0 w-10 select-none px-2 text-right text-primary-300 dark:text-neutral-600 text-[10px] leading-relaxed border-r border-primary-200 dark:border-neutral-800">
                        {line.leftNum ?? ''}
                      </span>
                      <span
                        className={cn(
                          'shrink-0 w-5 select-none text-center leading-relaxed',
                          line.kind === 'removed' ? 'text-red-500' : 'text-transparent',
                        )}
                      >
                        {line.kind === 'removed' ? '−' : ' '}
                      </span>
                      <span
                        className={cn(
                          'flex-1 whitespace-pre-wrap break-all px-1',
                          line.kind === 'removed'
                            ? 'text-red-800 dark:text-red-300'
                            : 'text-primary-800 dark:text-neutral-300',
                        )}
                      >
                        {line.text || ' '}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right — new */}
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
              <div className="shrink-0 px-3 py-1.5 text-[11px] font-semibold text-primary-500 dark:text-neutral-400 bg-primary-100/60 dark:bg-neutral-900/60 border-b border-primary-200 dark:border-neutral-800 uppercase tracking-wide">
                New
              </div>
              <div className="flex-1 overflow-auto">
                <div className="font-mono text-[11px] leading-relaxed">
                  {rightLines.map((line, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'flex items-start gap-0',
                        line.kind === 'added'
                          ? 'bg-emerald-50 dark:bg-emerald-950/25'
                          : '',
                      )}
                    >
                      <span className="shrink-0 w-10 select-none px-2 text-right text-primary-300 dark:text-neutral-600 text-[10px] leading-relaxed border-r border-primary-200 dark:border-neutral-800">
                        {line.rightNum ?? ''}
                      </span>
                      <span
                        className={cn(
                          'shrink-0 w-5 select-none text-center leading-relaxed',
                          line.kind === 'added' ? 'text-emerald-600' : 'text-transparent',
                        )}
                      >
                        {line.kind === 'added' ? '+' : ' '}
                      </span>
                      <span
                        className={cn(
                          'flex-1 whitespace-pre-wrap break-all px-1',
                          line.kind === 'added'
                            ? 'text-emerald-800 dark:text-emerald-300'
                            : 'text-primary-800 dark:text-neutral-300',
                        )}
                      >
                        {line.text || ' '}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </DialogRoot>
  )
}
