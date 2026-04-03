import { describe, expect, it } from 'vitest'
import type { PaperclipMission } from '@/types/paperclip'
import { hasUnmetDependencies, latestMissionNeedingFollowup, suggestSuccessor } from './paperclip-routing'

function makeMission(overrides: Partial<PaperclipMission>): PaperclipMission {
  return {
    id: 'mission_test',
    projectId: 'proj_test',
    title: 'Test Mission',
    role: 'engineering',
    status: 'queued',
    priority: 2,
    riskTier: 1,
    goal: 'Test goal',
    instructions: 'Test instructions',
    inputs: [],
    expectedOutputs: [],
    linkedSessionIds: [],
    dependencyIds: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('suggestSuccessor', () => {
  it('research -> ceo', () => {
    const result = suggestSuccessor('research')
    expect(result.role).toBe('ceo')
  })

  it('ceo -> cto', () => {
    const result = suggestSuccessor('ceo')
    expect(result.role).toBe('cto')
  })

  it('cto -> engineering', () => {
    const result = suggestSuccessor('cto')
    expect(result.role).toBe('engineering')
  })

  it('engineering -> qa', () => {
    const result = suggestSuccessor('engineering')
    expect(result.role).toBe('qa')
  })

  it('qa -> content', () => {
    const result = suggestSuccessor('qa')
    expect(result.role).toBe('content')
  })

  it('content (default) -> ceo', () => {
    const result = suggestSuccessor('content')
    expect(result.role).toBe('ceo')
  })

  it('returns non-empty title, goal, and instructions', () => {
    const result = suggestSuccessor('engineering')
    expect(result.title.length).toBeGreaterThan(0)
    expect(result.goal.length).toBeGreaterThan(0)
    expect(result.instructions.length).toBeGreaterThan(0)
  })
})

describe('hasUnmetDependencies', () => {
  it('returns false when mission has no dependencies', () => {
    const mission = makeMission({ dependencyIds: [] })
    expect(hasUnmetDependencies(mission, [])).toBe(false)
  })

  it('returns false when all dependencies are completed', () => {
    const dep = makeMission({ id: 'dep-1', status: 'completed' })
    const mission = makeMission({ dependencyIds: ['dep-1'] })
    expect(hasUnmetDependencies(mission, [dep, mission])).toBe(false)
  })

  it('returns true when a dependency is not completed', () => {
    const dep = makeMission({ id: 'dep-1', status: 'in_progress' })
    const mission = makeMission({ dependencyIds: ['dep-1'] })
    expect(hasUnmetDependencies(mission, [dep, mission])).toBe(true)
  })

  it('returns true when a dependency is queued', () => {
    const dep = makeMission({ id: 'dep-1', status: 'queued' })
    const mission = makeMission({ dependencyIds: ['dep-1'] })
    expect(hasUnmetDependencies(mission, [dep, mission])).toBe(true)
  })
})

describe('latestMissionNeedingFollowup', () => {
  it('returns null for empty array', () => {
    expect(latestMissionNeedingFollowup([])).toBeNull()
  })

  it('returns null when no missions are completed or awaiting_handoff', () => {
    const missions = [
      makeMission({ status: 'queued' }),
      makeMission({ status: 'in_progress' }),
    ]
    expect(latestMissionNeedingFollowup(missions)).toBeNull()
  })

  it('returns the most recently updated completed mission', () => {
    const older = makeMission({ id: 'old', status: 'completed', updatedAt: '2026-01-01T00:00:00Z' })
    const newer = makeMission({ id: 'new', status: 'completed', updatedAt: '2026-02-01T00:00:00Z' })
    expect(latestMissionNeedingFollowup([older, newer])?.id).toBe('new')
  })

  it('returns awaiting_handoff mission', () => {
    const mission = makeMission({ id: 'handoff', status: 'awaiting_handoff', updatedAt: '2026-03-01T00:00:00Z' })
    const completed = makeMission({ id: 'done', status: 'completed', updatedAt: '2026-01-01T00:00:00Z' })
    expect(latestMissionNeedingFollowup([completed, mission])?.id).toBe('handoff')
  })
})
