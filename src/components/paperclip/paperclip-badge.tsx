
import { cn } from '@/lib/utils'

export function PaperclipBadge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }) {
  return <span className={cn('brutalist-badge', `brutalist-badge--${tone}`)}>{label}</span>
}
