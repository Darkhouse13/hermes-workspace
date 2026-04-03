import { describe, expect, it } from 'vitest'
import { makePaperclipId, nowIso, slugify, sortByUpdatedAtDesc, upsertById } from './paperclip-store'

describe('upsertById', () => {
  it('appends item when id is not found', () => {
    const items = [{ id: '1', name: 'a' }]
    const result = upsertById(items, { id: '2', name: 'b' })
    expect(result).toEqual([{ id: '1', name: 'a' }, { id: '2', name: 'b' }])
  })

  it('replaces item when id is found', () => {
    const items = [{ id: '1', name: 'a' }, { id: '2', name: 'b' }]
    const result = upsertById(items, { id: '1', name: 'updated' })
    expect(result).toEqual([{ id: '1', name: 'updated' }, { id: '2', name: 'b' }])
  })

  it('does not mutate the original array', () => {
    const items = [{ id: '1', name: 'a' }]
    const result = upsertById(items, { id: '2', name: 'b' })
    expect(items).toHaveLength(1)
    expect(result).not.toBe(items)
  })

  it('works with empty array', () => {
    const result = upsertById([], { id: '1', name: 'a' })
    expect(result).toEqual([{ id: '1', name: 'a' }])
  })
})

describe('sortByUpdatedAtDesc', () => {
  it('sorts by updatedAt descending', () => {
    const items = [
      { id: '1', updatedAt: '2026-01-01T00:00:00Z' },
      { id: '2', updatedAt: '2026-03-01T00:00:00Z' },
      { id: '3', updatedAt: '2026-02-01T00:00:00Z' },
    ]
    const result = sortByUpdatedAtDesc(items)
    expect(result.map((i) => i.id)).toEqual(['2', '3', '1'])
  })

  it('falls back to createdAt when updatedAt is missing', () => {
    const items = [
      { id: '1', createdAt: '2026-01-01T00:00:00Z' },
      { id: '2', createdAt: '2026-03-01T00:00:00Z' },
    ]
    const result = sortByUpdatedAtDesc(items)
    expect(result.map((i) => i.id)).toEqual(['2', '1'])
  })

  it('handles items with no dates (treats as 0)', () => {
    const items = [
      { id: '1' },
      { id: '2', updatedAt: '2026-01-01T00:00:00Z' },
    ]
    const result = sortByUpdatedAtDesc(items)
    expect(result.map((i) => i.id)).toEqual(['2', '1'])
  })

  it('does not mutate the original array', () => {
    const items = [{ id: '1', updatedAt: '2026-01-01T00:00:00Z' }]
    const result = sortByUpdatedAtDesc(items)
    expect(result).not.toBe(items)
  })
})

describe('slugify', () => {
  it('converts to lowercase', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('replaces spaces with hyphens', () => {
    expect(slugify('my project name')).toBe('my-project-name')
  })

  it('removes special characters', () => {
    expect(slugify('hello@world!')).toBe('hello-world')
  })

  it('trims leading and trailing hyphens', () => {
    expect(slugify('--hello--')).toBe('hello')
  })

  it('collapses consecutive special chars to single hyphen', () => {
    expect(slugify('hello   world')).toBe('hello-world')
  })

  it('handles empty string', () => {
    expect(slugify('')).toBe('')
  })
})

describe('makePaperclipId', () => {
  it('starts with the given prefix', () => {
    const id = makePaperclipId('mission')
    expect(id.startsWith('mission_')).toBe(true)
  })

  it('generates unique ids', () => {
    const ids = new Set(Array.from({ length: 20 }, () => makePaperclipId('test')))
    expect(ids.size).toBe(20)
  })

  it('has correct format', () => {
    const id = makePaperclipId('proj')
    expect(id).toMatch(/^proj_[a-z0-9]+$/)
  })
})

describe('nowIso', () => {
  it('returns a valid ISO 8601 string', () => {
    const iso = nowIso()
    expect(new Date(iso).toISOString()).toBe(iso)
  })

  it('returns approximately the current time', () => {
    const before = Date.now()
    const iso = nowIso()
    const after = Date.now()
    const time = new Date(iso).getTime()
    expect(time).toBeGreaterThanOrEqual(before)
    expect(time).toBeLessThanOrEqual(after)
  })
})
