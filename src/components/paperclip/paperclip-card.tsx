
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function PaperclipCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('brutalist-panel p-4', className)}>{children}</div>
}
