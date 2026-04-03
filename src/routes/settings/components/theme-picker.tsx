import { useState } from 'react'
import type { ThemeId } from '@/lib/theme'
import { THEMES, getTheme, isDarkTheme, setTheme } from '@/lib/theme'
import { useSettings } from '@/hooks/use-settings'
import { cn } from '@/lib/utils'

export function PageThemeSwatch({
  colors,
}: {
  colors: {
    bg: string
    panel: string
    border: string
    accent: string
    text: string
  }
}) {
  return (
    <div
      className="flex h-10 w-full overflow-hidden rounded-md border"
      style={{ borderColor: colors.border, backgroundColor: colors.bg }}
    >
      <div
        className="flex h-full w-4 flex-col gap-0.5 p-0.5"
        style={{ backgroundColor: colors.panel }}
      >
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-1.5 w-full rounded-sm"
            style={{ backgroundColor: colors.border }}
          />
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-0.5 p-1">
        <div
          className="h-1.5 w-3/4 rounded"
          style={{ backgroundColor: colors.text, opacity: 0.8 }}
        />
        <div
          className="h-1 w-1/2 rounded"
          style={{ backgroundColor: colors.text, opacity: 0.3 }}
        />
        <div
          className="mt-0.5 h-1.5 w-6 rounded-full"
          style={{ backgroundColor: colors.accent }}
        />
      </div>
    </div>
  )
}

export const THEME_PREVIEWS: Record<
  ThemeId,
  { bg: string; panel: string; border: string; accent: string; text: string }
> = {
  'hermes-official': {
    bg: '#0A0E1A',
    panel: '#11182A',
    border: '#24304A',
    accent: '#6366F1',
    text: '#E6EAF2',
  },
  'hermes-official-light': {
    bg: '#F6F8FC',
    panel: '#FFFFFF',
    border: '#D7DEEE',
    accent: '#4F46E5',
    text: '#111827',
  },
  'hermes-classic': {
    bg: '#0d0f12',
    panel: '#1a1f26',
    border: '#2a313b',
    accent: '#b98a44',
    text: '#eceff4',
  },
  'hermes-slate': {
    bg: '#0d1117',
    panel: '#1c2128',
    border: '#30363d',
    accent: '#7eb8f6',
    text: '#c9d1d9',
  },
  'hermes-mono': {
    bg: '#111111',
    panel: '#222222',
    border: '#333333',
    accent: '#aaaaaa',
    text: '#e6edf3',
  },
  'hermes-classic-light': {
    bg: '#F5F2ED',
    panel: '#FFFFFF',
    border: '#D9D0C4',
    accent: '#b98a44',
    text: '#1a1f26',
  },
  'hermes-slate-light': {
    bg: '#F6F8FA',
    panel: '#FFFFFF',
    border: '#D0D7DE',
    accent: '#3b82f6',
    text: '#1F2328',
  },
  'hermes-mono-light': {
    bg: '#FAFAFA',
    panel: '#FFFFFF',
    border: '#D4D4D4',
    accent: '#666666',
    text: '#1a1a1a',
  },
}

export function WorkspaceThemePicker() {
  const { updateSettings } = useSettings()
  const [current, setCurrent] = useState<ThemeId>(() => getTheme())

  function applyWorkspaceTheme(id: ThemeId) {
    setTheme(id)
    updateSettings({ theme: isDarkTheme(id) ? 'dark' : 'light' })
    setCurrent(id)
  }

  return (
    <div className="grid w-full gap-2 md:grid-cols-3">
      {THEMES.map((t) => {
        const isActive = current === t.id
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => applyWorkspaceTheme(t.id)}
            className={cn(
              'flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors',
              isActive
                ? 'border-[var(--theme-accent)] bg-[var(--theme-accent-subtle)] text-[var(--theme-text)]'
                : 'border-[var(--theme-border)] bg-[var(--theme-card)] text-[var(--theme-text)] hover:bg-[var(--theme-card2)]',
            )}
          >
            <PageThemeSwatch colors={THEME_PREVIEWS[t.id]} />
            <div className="flex items-center gap-1.5">
              <span className="text-xs">{t.icon}</span>
              <span className="text-xs font-semibold">{t.label}</span>
              {isActive && (
                <span className="ml-auto text-[9px] font-bold uppercase tracking-wide text-[var(--theme-accent)]">
                  Active
                </span>
              )}
            </div>
            <p className="text-[10px] leading-tight text-[var(--theme-muted)]">
              {t.description}
            </p>
          </button>
        )
      })}
    </div>
  )
}
