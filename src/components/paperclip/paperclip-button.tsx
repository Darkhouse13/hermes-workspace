
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function PaperclipButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={cn('brutalist-button', className)} {...props} />
}
