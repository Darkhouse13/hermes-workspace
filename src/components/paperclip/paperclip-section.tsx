
import type { ReactNode } from 'react'

export function PaperclipSection({ title, eyebrow, children }: { title: string; eyebrow?: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        {eyebrow ? <div className="brutalist-label">{eyebrow}</div> : null}
        <h2 className="text-lg font-black uppercase tracking-[0.08em] text-[var(--theme-text)]">{title}</h2>
      </div>
      {children}
    </section>
  )
}
