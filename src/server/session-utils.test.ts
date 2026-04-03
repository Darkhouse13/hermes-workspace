import { describe, expect, it } from 'vitest'
import { isSyntheticSessionKey, resolveSessionKey } from './session-utils'

describe('isSyntheticSessionKey', () => {
  it('returns true for "main"', () => {
    expect(isSyntheticSessionKey('main')).toBe(true)
  })

  it('returns true for "new"', () => {
    expect(isSyntheticSessionKey('new')).toBe(true)
  })

  it('returns false for null', () => {
    expect(isSyntheticSessionKey(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isSyntheticSessionKey(undefined)).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isSyntheticSessionKey('')).toBe(false)
  })

  it('returns false for other strings', () => {
    expect(isSyntheticSessionKey('session-123')).toBe(false)
  })

  it('handles whitespace around synthetic keys', () => {
    expect(isSyntheticSessionKey(' main ')).toBe(true)
    expect(isSyntheticSessionKey(' new ')).toBe(true)
  })
})

describe('resolveSessionKey', () => {
  it('resolves via raw when rawSessionKey is provided', async () => {
    const result = await resolveSessionKey({ rawSessionKey: 'session-abc' })
    expect(result).toEqual({ sessionKey: 'session-abc', resolvedVia: 'raw' })
  })

  it('resolves via friendly when rawSessionKey is empty but friendlyId provided', async () => {
    const result = await resolveSessionKey({ rawSessionKey: '', friendlyId: 'my-chat' })
    expect(result).toEqual({ sessionKey: 'my-chat', resolvedVia: 'friendly' })
  })

  it('resolves via default when both are empty', async () => {
    const result = await resolveSessionKey({ rawSessionKey: '', friendlyId: '' })
    expect(result).toEqual({ sessionKey: 'new', resolvedVia: 'default' })
  })

  it('uses custom defaultKey when provided', async () => {
    const result = await resolveSessionKey({ defaultKey: 'main' })
    expect(result).toEqual({ sessionKey: 'main', resolvedVia: 'default' })
  })

  it('trims whitespace from rawSessionKey', async () => {
    const result = await resolveSessionKey({ rawSessionKey: '  session-abc  ' })
    expect(result).toEqual({ sessionKey: 'session-abc', resolvedVia: 'raw' })
  })

  it('trims whitespace from friendlyId', async () => {
    const result = await resolveSessionKey({ friendlyId: '  my-chat  ' })
    expect(result).toEqual({ sessionKey: 'my-chat', resolvedVia: 'friendly' })
  })

  it('prefers raw over friendly', async () => {
    const result = await resolveSessionKey({ rawSessionKey: 'raw-key', friendlyId: 'friendly-key' })
    expect(result).toEqual({ sessionKey: 'raw-key', resolvedVia: 'raw' })
  })
})
