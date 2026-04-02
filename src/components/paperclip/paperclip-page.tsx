
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function PaperclipPage({ title, subtitle, actions, children, className }: {
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-6 p-4 md:p-6', className)}>
      <div className="brutalist-panel flex flex-col gap-3 p-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="brutalist-label">Paperclip Mission Control</div>
          <h1 className="mt-2 text-2xl font-black uppercase tracking-[0.08em] text-[var(--theme-text)]">{title}</h1>
          {subtitle ? <p className="mt-2 max-w-3xl text-sm text-[var(--theme-muted)]">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  )
}
