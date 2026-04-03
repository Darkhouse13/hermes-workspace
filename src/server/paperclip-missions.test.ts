import { describe, expect, it } from 'vitest'
import { ALLOWED_TRANSITIONS } from './paperclip-missions'
import { MISSION_STATUSES } from '@/types/paperclip'

describe('ALLOWED_TRANSITIONS', () => {
  it('has an entry for every mission status', () => {
    for (const status of MISSION_STATUSES) {
      expect(ALLOWED_TRANSITIONS).toHaveProperty(status)
    }
  })

  it('completed is a terminal state (no transitions)', () => {
    expect(ALLOWED_TRANSITIONS.completed).toEqual([])
  })

  it('cancelled is a terminal state (no transitions)', () => {
    expect(ALLOWED_TRANSITIONS.cancelled).toEqual([])
  })

  it('queued can transition to in_progress and cancelled', () => {
    expect(ALLOWED_TRANSITIONS.queued).toContain('in_progress')
    expect(ALLOWED_TRANSITIONS.queued).toContain('cancelled')
  })

  it('in_progress has the most transitions', () => {
    const maxTransitions = Math.max(
      ...Object.values(ALLOWED_TRANSITIONS).map((t) => t.length),
    )
    expect(ALLOWED_TRANSITIONS.in_progress.length).toBe(maxTransitions)
  })

  it('in_progress can reach blocked, awaiting_handoff, awaiting_approval, completed, cancelled', () => {
    expect(ALLOWED_TRANSITIONS.in_progress).toContain('blocked')
    expect(ALLOWED_TRANSITIONS.in_progress).toContain('awaiting_handoff')
    expect(ALLOWED_TRANSITIONS.in_progress).toContain('awaiting_approval')
    expect(ALLOWED_TRANSITIONS.in_progress).toContain('completed')
    expect(ALLOWED_TRANSITIONS.in_progress).toContain('cancelled')
  })
})
