import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowExpand01Icon,
  ArrowUp01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { ResearchCard } from './research-card'
import type { UseResearchCardResult } from '@/hooks/use-research-card'
import { AssistantAvatar } from '@/components/avatars'
import { cn } from '@/lib/utils'
import {
  getToolStatusLabel,
  getToolEmoji,
  getToolVerb,
} from '@/lib/chat-tool-labels'

export function ToolCallCard({ name, phase }: { name: string; phase: string }) {
  const isDone = phase === 'done' || phase === 'complete' || phase === 'completed'
  const isError = phase === 'error' || phase === 'failed'
  const isRunning = !isDone && !isError

  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!isRunning) return
    setElapsed(0)
    const id = window.setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => window.clearInterval(id)
  }, [isRunning])

  const [dots, setDots] = useState(0)
  useEffect(() => {
    if (!isRunning) return
    const id = window.setInterval(() => setDots((d) => (d + 1) % 4), 400)
    return () => window.clearInterval(id)
  }, [isRunning])

  const elapsedLabel = elapsed >= 60 ? `${Math.floor(elapsed / 60)}m ${elapsed % 60}s` : `${elapsed}s`
  const emoji = getToolEmoji(name)
  const verb = getToolVerb(name)
  const displayName = name.replace(/_/g, ' ')

  return (
    <div
      className="rounded-lg border border-primary-200 bg-primary-50 text-[11px] overflow-hidden"
      style={{
        borderLeftWidth: '3px',
        borderLeftColor: isRunning ? '#6366f1' : isDone ? '#22c55e' : '#ef4444',
        boxShadow: isRunning ? '0 0 8px rgba(99,102,241,0.12)' : 'none',
      }}
    >
      <div className="flex items-center gap-1.5 px-2.5 py-1.5">
        <span className="text-sm leading-none">{emoji}</span>
        <span className="font-mono font-semibold text-ink">{displayName}</span>
        <span className="flex-1" />
        {isRunning && <span className="text-[10px] tabular-nums text-primary-400">{elapsedLabel}</span>}
        {isDone && <span className="text-xs text-green-500">✅</span>}
        {isError && <span className="text-xs text-red-500">❌</span>}
        {isRunning && <span className="size-1.5 rounded-full animate-pulse bg-indigo-500" />}
      </div>
      {isRunning && (
        <div className="px-2.5 pb-1.5 text-[10px] text-primary-400">
          {verb}{'.'.repeat(dots)}
        </div>
      )}
    </div>
  )
}

export type ThinkingBubbleProps = {
  activeToolCalls?: Array<{ id: string; name: string; phase: string }>
  liveToolActivity?: Array<{ name: string; timestamp: number }>
  researchCard?: UseResearchCardResult
  isCompacting?: boolean
}

/**
 * Premium shimmer thinking bubble — matches the assistant message position
 * with three bouncing dots, a gradient shimmer sweep, and a dynamic status
 * label that reflects what's actually happening (tool calls, etc.).
 */
export function ThinkingBubble({
  activeToolCalls = [],
  liveToolActivity = [],
  researchCard,
  isCompacting = false,
}: ThinkingBubbleProps) {
  const allTools = useMemo(
    () =>
      liveToolActivity.length > 0
        ? liveToolActivity.map((t) => ({ name: t.name, phase: 'calling' as const }))
        : activeToolCalls.map((t) => ({ name: t.name, phase: t.phase })),
    [activeToolCalls, liveToolActivity],
  )

  // Derive the most recent active tool name
  const activeToolName = useMemo(() => {
    // liveToolActivity is ordered newest-first
    if (liveToolActivity.length > 0) return liveToolActivity[0].name
    // activeToolCalls: prefer 'calling'/'start' phase, fall back to most recent
    const calling = activeToolCalls.find(
      (tc) => tc.phase === 'calling' || tc.phase === 'start',
    )
    if (calling) return calling.name
    if (activeToolCalls.length > 0) return activeToolCalls[activeToolCalls.length - 1].name
    return null
  }, [activeToolCalls, liveToolActivity])

  const statusLabel = isCompacting
    ? 'Compacting context...'
    : activeToolName
      ? getToolStatusLabel(activeToolName)
      : 'Thinking…'

  // Elapsed time counter — resets when the status label changes (new tool)
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    setElapsed(0)
    const interval = window.setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => window.clearInterval(interval)
  }, [statusLabel])

  const elapsedLabel = elapsed >= 60
    ? `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`
    : `${elapsed}s`

  const isStale = elapsed >= 30
  const isVeryStale = elapsed >= 60
  const canExpandResearch = Boolean(researchCard && researchCard.steps.length > 0)
  const expandedResearchCard = canExpandResearch ? researchCard : null
  const completedResearchSteps = researchCard
    ? researchCard.steps.filter((step) => step.status === 'done').length
    : 0

  // Track displayed label with a small delay so we fade between changes
  const [displayedLabel, setDisplayedLabel] = useState(statusLabel)
  const [visible, setVisible] = useState(true)
  const prevLabelRef = useRef(statusLabel)

  useEffect(() => {
    if (statusLabel === prevLabelRef.current) return
    // Fade out, swap, fade in
    setVisible(false)
    const swapTimer = window.setTimeout(() => {
      setDisplayedLabel(statusLabel)
      prevLabelRef.current = statusLabel
      setVisible(true)
    }, 150)
    return () => window.clearTimeout(swapTimer)
  }, [statusLabel])

  // When a tool is active, render grouped tool pill cards instead of shimmer bubble
  if (allTools.length > 0 && !isCompacting) {
    // Group consecutive same-name tools to avoid flooding the UI
    const grouped: Array<{ name: string; phase: string; count: number }> = []
    for (const tc of allTools) {
      const last = grouped[grouped.length - 1]
      if (grouped.length > 0 && last.name === tc.name) {
        last.count++
        // Keep the most "active" phase (running > complete > error)
        if (tc.phase !== 'done' && tc.phase !== 'complete' && tc.phase !== 'completed') {
          last.phase = tc.phase
        }
      } else {
        grouped.push({ name: tc.name, phase: tc.phase, count: 1 })
      }
    }
    return (
      <div className="flex flex-col gap-1.5 max-w-sm animate-in fade-in duration-200">
        {grouped.map((tc, i) => (
          <div key={`${tc.name}-${i}`} className="relative">
            <ToolCallCard name={tc.name} phase={tc.phase} />
            {tc.count > 1 && (
              <span className="absolute -top-1 -right-1 text-[9px] font-bold bg-indigo-500 text-white rounded-full size-5 flex items-center justify-center shadow-sm">
                {tc.count}
              </span>
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex items-end gap-2">
      {/* Avatar with pulsing glow ring */}
      <div className="thinking-avatar-glow shrink-0 rounded-lg">
        <AssistantAvatar size={28} />
      </div>

      {/* Chat bubble */}
      <div className="relative overflow-hidden rounded-2xl rounded-bl-sm border border-primary-200 dark:border-primary-200/20 bg-primary-100 dark:bg-primary-100 thinking-shimmer-bubble">
        {/* Shimmer overlay */}
        <div className="thinking-shimmer-sweep pointer-events-none absolute inset-0" aria-hidden="true" />

        <div className="relative flex flex-col gap-1 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                {isCompacting ? (
                  <span
                    className="inline-block size-3 rounded-full border border-primary-300 border-t-primary-500 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <>
                    <span className="thinking-dot thinking-dot-1" />
                    <span className="thinking-dot thinking-dot-2" />
                    <span className="thinking-dot thinking-dot-3" />
                  </>
                )}
                <span
                  className={cn(
                    'thinking-label ml-1.5 text-xs font-medium transition-opacity duration-300',
                    isStale
                      ? 'text-amber-500 dark:text-amber-400'
                      : 'text-primary-500 dark:text-primary-500',
                  )}
                  style={{ opacity: visible ? 1 : 0 }}
                >
                  {displayedLabel}{' '}
                  {elapsed >= 3 ? (
                    <span className="text-[10px] opacity-60">{elapsedLabel}</span>
                  ) : null}
                </span>
              </div>
              {canExpandResearch ? (
                <div className="mt-1 flex items-center gap-2 text-[11px] text-primary-500 dark:text-primary-400">
                  <span>{completedResearchSteps}/{expandedResearchCard?.steps.length ?? 0} tools</span>
                  <span aria-hidden="true" className="opacity-40">•</span>
                  <span>{expandedResearchCard?.isActive ? 'Live timeline' : 'Timeline ready'}</span>
                </div>
              ) : null}
            </div>
            {canExpandResearch ? (
              <button
                type="button"
                onClick={() => expandedResearchCard?.setCollapsed(!expandedResearchCard.collapsed)}
                className="relative z-10 inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-primary-200/80 bg-primary-50/90 text-primary-500 transition-colors hover:bg-primary-100 dark:border-primary-800 dark:bg-primary-900/80 dark:text-primary-300 dark:hover:bg-primary-800"
                aria-label={expandedResearchCard?.collapsed ? 'Expand research timeline' : 'Collapse research timeline'}
                title={expandedResearchCard?.collapsed ? 'Expand research timeline' : 'Collapse research timeline'}
              >
                <HugeiconsIcon
                  icon={expandedResearchCard?.collapsed ? ArrowExpand01Icon : ArrowUp01Icon}
                  size={14}
                  strokeWidth={1.8}
                />
              </button>
            ) : null}
          </div>

          {isStale ? (
            <span className="text-[11px] text-amber-500 dark:text-amber-400 animate-pulse">
              {isVeryStale ? 'Still working… this is taking a while' : 'Taking longer than usual…'}
            </span>
          ) : null}

          {activeToolName && !isCompacting ? (
            <div
              style={{
                opacity: visible ? 1 : 0,
                transition: 'opacity 300ms ease',
              }}
            >
              <span className="inline-flex items-center rounded-full bg-primary-200/60 dark:bg-primary-800/30 px-2 py-0.5 text-[10px] font-mono text-primary-400 dark:text-primary-500 select-none">
                {activeToolName}
              </span>
            </div>
          ) : null}
        </div>

        {expandedResearchCard && !expandedResearchCard.collapsed ? (
          <ResearchCard researchCard={expandedResearchCard} />
        ) : null}
      </div>
    </div>
  )
}
