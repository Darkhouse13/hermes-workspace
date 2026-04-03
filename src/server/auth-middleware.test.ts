import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createSessionCookie,
  generateSessionToken,
  getSessionTokenFromCookie,
  isAuthenticated,
  isPasswordProtectionEnabled,
  isValidSessionToken,
  revokeSessionToken,
  storeSessionToken,
  verifyPassword,
  evictExpiredTokens,
  _clearAllTokens,
  _getTokenCount,
} from './auth-middleware'

beforeEach(() => {
  _clearAllTokens()
  vi.restoreAllMocks()
})

describe('generateSessionToken', () => {
  it('returns a 64-character hex string', () => {
    const token = generateSessionToken()
    expect(token).toMatch(/^[a-f0-9]{64}$/)
  })

  it('generates unique tokens on each call', () => {
    const tokens = new Set(Array.from({ length: 10 }, () => generateSessionToken()))
    expect(tokens.size).toBe(10)
  })
})

describe('storeSessionToken / isValidSessionToken / revokeSessionToken', () => {
  it('stored token is valid', () => {
    const token = generateSessionToken()
    storeSessionToken(token)
    expect(isValidSessionToken(token)).toBe(true)
  })

  it('unknown token is invalid', () => {
    expect(isValidSessionToken('nonexistent-token')).toBe(false)
  })

  it('revoked token is invalid', () => {
    const token = generateSessionToken()
    storeSessionToken(token)
    revokeSessionToken(token)
    expect(isValidSessionToken(token)).toBe(false)
  })

  it('multiple tokens can be stored independently', () => {
    const t1 = generateSessionToken()
    const t2 = generateSessionToken()
    storeSessionToken(t1)
    storeSessionToken(t2)
    expect(isValidSessionToken(t1)).toBe(true)
    expect(isValidSessionToken(t2)).toBe(true)
    revokeSessionToken(t1)
    expect(isValidSessionToken(t1)).toBe(false)
    expect(isValidSessionToken(t2)).toBe(true)
  })
})

describe('isPasswordProtectionEnabled', () => {
  const originalEnv = process.env.HERMES_PASSWORD

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.HERMES_PASSWORD
    } else {
      process.env.HERMES_PASSWORD = originalEnv
    }
  })

  it('returns false when HERMES_PASSWORD is not set', () => {
    delete process.env.HERMES_PASSWORD
    expect(isPasswordProtectionEnabled()).toBe(false)
  })

  it('returns false when HERMES_PASSWORD is empty string', () => {
    process.env.HERMES_PASSWORD = ''
    expect(isPasswordProtectionEnabled()).toBe(false)
  })

  it('returns true when HERMES_PASSWORD is set', () => {
    process.env.HERMES_PASSWORD = 'my-secret'
    expect(isPasswordProtectionEnabled()).toBe(true)
  })
})

describe('verifyPassword', () => {
  const originalEnv = process.env.HERMES_PASSWORD

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.HERMES_PASSWORD
    } else {
      process.env.HERMES_PASSWORD = originalEnv
    }
  })

  it('returns false when no password is configured', () => {
    delete process.env.HERMES_PASSWORD
    expect(verifyPassword('anything')).toBe(false)
  })

  it('returns true for matching password', () => {
    process.env.HERMES_PASSWORD = 'correct-password'
    expect(verifyPassword('correct-password')).toBe(true)
  })

  it('returns false for wrong password', () => {
    process.env.HERMES_PASSWORD = 'correct-password'
    expect(verifyPassword('wrong-password')).toBe(false)
  })

  it('returns false for different-length passwords', () => {
    process.env.HERMES_PASSWORD = 'short'
    expect(verifyPassword('much-longer-password')).toBe(false)
  })
})

describe('getSessionTokenFromCookie', () => {
  it('returns null for null header', () => {
    expect(getSessionTokenFromCookie(null)).toBeNull()
  })

  it('returns null when hermes-auth cookie is not present', () => {
    expect(getSessionTokenFromCookie('other-cookie=value')).toBeNull()
  })

  it('extracts token from single cookie', () => {
    expect(getSessionTokenFromCookie('hermes-auth=abc123')).toBe('abc123')
  })

  it('extracts token from multiple cookies', () => {
    expect(getSessionTokenFromCookie('foo=bar; hermes-auth=abc123; baz=qux')).toBe('abc123')
  })
})

describe('isAuthenticated', () => {
  const originalEnv = process.env.HERMES_PASSWORD

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.HERMES_PASSWORD
    } else {
      process.env.HERMES_PASSWORD = originalEnv
    }
  })

  it('returns true when password protection is disabled', () => {
    delete process.env.HERMES_PASSWORD
    const req = new Request('http://localhost')
    expect(isAuthenticated(req)).toBe(true)
  })

  it('returns false when password is set but no cookie', () => {
    process.env.HERMES_PASSWORD = 'secret'
    const req = new Request('http://localhost')
    expect(isAuthenticated(req)).toBe(false)
  })

  it('returns true when password is set and valid session token in cookie', () => {
    process.env.HERMES_PASSWORD = 'secret'
    const token = generateSessionToken()
    storeSessionToken(token)
    const req = new Request('http://localhost', {
      headers: { cookie: `hermes-auth=${token}` },
    })
    expect(isAuthenticated(req)).toBe(true)
  })

  it('returns false when password is set and invalid token in cookie', () => {
    process.env.HERMES_PASSWORD = 'secret'
    const req = new Request('http://localhost', {
      headers: { cookie: 'hermes-auth=invalid-token' },
    })
    expect(isAuthenticated(req)).toBe(false)
  })
})

describe('createSessionCookie', () => {
  it('contains the token value', () => {
    const cookie = createSessionCookie('my-token')
    expect(cookie).toContain('hermes-auth=my-token')
  })

  it('contains HttpOnly flag', () => {
    const cookie = createSessionCookie('token')
    expect(cookie).toContain('HttpOnly')
  })

  it('contains SameSite=Strict', () => {
    const cookie = createSessionCookie('token')
    expect(cookie).toContain('SameSite=Strict')
  })

  it('contains Path=/', () => {
    const cookie = createSessionCookie('token')
    expect(cookie).toContain('Path=/')
  })

  it('contains Max-Age for 30 days', () => {
    const cookie = createSessionCookie('token')
    expect(cookie).toContain(`Max-Age=${30 * 24 * 60 * 60}`)
  })
})

describe('token expiration', () => {
  it('rejects expired tokens', () => {
    const token = generateSessionToken()
    storeSessionToken(token)

    // Advance time past 30 days
    const thirtyOneDays = 31 * 24 * 60 * 60 * 1000
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + thirtyOneDays)

    expect(isValidSessionToken(token)).toBe(false)
  })

  it('accepts tokens within TTL', () => {
    const token = generateSessionToken()
    storeSessionToken(token)

    // Advance time within 30 days
    const twentyNineDays = 29 * 24 * 60 * 60 * 1000
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + twentyNineDays)

    expect(isValidSessionToken(token)).toBe(true)
  })

  it('evictExpiredTokens removes only expired tokens', () => {
    const oldToken = generateSessionToken()
    storeSessionToken(oldToken)

    // Advance time past expiration for old token
    const thirtyOneDays = 31 * 24 * 60 * 60 * 1000
    const futureNow = Date.now() + thirtyOneDays
    vi.spyOn(Date, 'now').mockReturnValue(futureNow)

    // Store a new token at the future time (so it's not expired)
    const newToken = generateSessionToken()
    storeSessionToken(newToken)

    expect(_getTokenCount()).toBe(2)
    evictExpiredTokens()
    expect(_getTokenCount()).toBe(1)
    expect(isValidSessionToken(newToken)).toBe(true)
  })
})

describe('max token cap', () => {
  it('evicts the oldest token when at capacity', () => {
    const baseNow = Date.now()

    // Store the first token at baseNow
    vi.spyOn(Date, 'now').mockReturnValue(baseNow)
    const firstToken = 'first-token'
    storeSessionToken(firstToken)

    // Store 9,999 more tokens at baseNow + 1
    vi.spyOn(Date, 'now').mockReturnValue(baseNow + 1)
    for (let i = 1; i < 10_000; i++) {
      storeSessionToken(`token-${i}`)
    }

    expect(_getTokenCount()).toBe(10_000)

    // Store one more — should evict the oldest (firstToken, created at baseNow)
    vi.spyOn(Date, 'now').mockReturnValue(baseNow + 2)
    storeSessionToken('overflow-token')

    expect(_getTokenCount()).toBe(10_000)
    expect(isValidSessionToken(firstToken)).toBe(false)
    expect(isValidSessionToken('overflow-token')).toBe(true)
  })
})
