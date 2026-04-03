import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Must use fake timers before importing the module (it has a setInterval at module scope)
beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

// Dynamic import to avoid module-level side effects before fake timers are set
const {
  rateLimit,
  getClientIp,
  rateLimitResponse,
  requireJsonContentType,
  safeErrorMessage,
  _clearRateLimitStore,
  _getTrackedKeyCount,
} = await import('./rate-limit')

describe('rateLimit', () => {
  it('allows requests under the limit', () => {
    expect(rateLimit('test-allow', 3, 60_000)).toBe(true)
    expect(rateLimit('test-allow', 3, 60_000)).toBe(true)
  })

  it('blocks requests at the limit', () => {
    expect(rateLimit('test-block', 2, 60_000)).toBe(true)
    expect(rateLimit('test-block', 2, 60_000)).toBe(true)
    expect(rateLimit('test-block', 2, 60_000)).toBe(false)
  })

  it('allows requests after the window expires', () => {
    expect(rateLimit('test-expire', 1, 1_000)).toBe(true)
    expect(rateLimit('test-expire', 1, 1_000)).toBe(false)
    vi.advanceTimersByTime(1_100)
    expect(rateLimit('test-expire', 1, 1_000)).toBe(true)
  })

  it('different keys have independent limits', () => {
    expect(rateLimit('key-a', 1, 60_000)).toBe(true)
    expect(rateLimit('key-a', 1, 60_000)).toBe(false)
    expect(rateLimit('key-b', 1, 60_000)).toBe(true)
  })
})

describe('getClientIp', () => {
  it('extracts first IP from x-forwarded-for header', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    })
    expect(getClientIp(req)).toBe('1.2.3.4')
  })

  it('returns "local" when no header present', () => {
    const req = new Request('http://localhost')
    expect(getClientIp(req)).toBe('local')
  })

  it('handles single IP in x-forwarded-for', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '10.0.0.1' },
    })
    expect(getClientIp(req)).toBe('10.0.0.1')
  })
})

describe('rateLimitResponse', () => {
  it('returns a Response with status 429', () => {
    const res = rateLimitResponse()
    expect(res.status).toBe(429)
  })

  it('returns JSON body with error message', async () => {
    const res = rateLimitResponse()
    const body = await res.json()
    expect(body.error).toContain('Too many requests')
  })

  it('has application/json content-type', () => {
    const res = rateLimitResponse()
    expect(res.headers.get('content-type')).toBe('application/json')
  })
})

describe('requireJsonContentType', () => {
  it('returns null for GET requests', () => {
    const req = new Request('http://localhost', { method: 'GET' })
    expect(requireJsonContentType(req)).toBeNull()
  })

  it('returns null for HEAD requests', () => {
    const req = new Request('http://localhost', { method: 'HEAD' })
    expect(requireJsonContentType(req)).toBeNull()
  })

  it('returns null for OPTIONS requests', () => {
    const req = new Request('http://localhost', { method: 'OPTIONS' })
    expect(requireJsonContentType(req)).toBeNull()
  })

  it('returns null for POST with application/json', () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    })
    expect(requireJsonContentType(req)).toBeNull()
  })

  it('returns null for POST with application/json; charset=utf-8', () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
    })
    expect(requireJsonContentType(req)).toBeNull()
  })

  it('returns 415 Response for POST without content-type', () => {
    const req = new Request('http://localhost', { method: 'POST' })
    const res = requireJsonContentType(req)
    expect(res).not.toBeNull()
    expect(res!.status).toBe(415)
  })

  it('returns 415 Response for POST with text/plain', () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
    })
    const res = requireJsonContentType(req)
    expect(res).not.toBeNull()
    expect(res!.status).toBe(415)
  })
})

describe('rate limit memory cap', () => {
  beforeEach(() => {
    _clearRateLimitStore()
  })

  it('rejects new keys when store is at capacity (fail-closed)', () => {
    // Fill up to MAX_TRACKED_KEYS (100,000)
    for (let i = 0; i < 100_000; i++) {
      rateLimit(`cap-key-${i}`, 100, 60_000)
    }
    expect(_getTrackedKeyCount()).toBe(100_000)

    // New key should be rejected (fail-closed)
    expect(rateLimit('overflow-key', 100, 60_000)).toBe(false)
    expect(_getTrackedKeyCount()).toBe(100_000)
  })

  it('still allows existing keys when at capacity', () => {
    for (let i = 0; i < 100_000; i++) {
      rateLimit(`cap-key-${i}`, 100, 60_000)
    }

    // Existing key should still work
    expect(rateLimit('cap-key-0', 100, 60_000)).toBe(true)
  })
})

describe('safeErrorMessage', () => {
  const originalEnv = process.env.NODE_ENV

  afterEach(() => {
    process.env.NODE_ENV = originalEnv
  })

  it('returns error message in development', () => {
    process.env.NODE_ENV = 'development'
    expect(safeErrorMessage(new Error('test error'))).toBe('test error')
  })

  it('returns generic message in production', () => {
    process.env.NODE_ENV = 'production'
    expect(safeErrorMessage(new Error('secret details'))).toBe('Internal server error')
  })

  it('handles non-Error objects', () => {
    process.env.NODE_ENV = 'development'
    expect(safeErrorMessage('string error')).toBe('string error')
  })
})
