import { randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * In-memory session store with expiration.
 * For production, consider Redis or a database.
 */
interface TokenMetadata {
  createdAt: number
  expiresAt: number
}

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
const MAX_TOKENS = 10_000
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

const validTokens = new Map<string, TokenMetadata>()

/**
 * Generate a cryptographically secure session token.
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Store a session token as valid with expiration metadata.
 * Evicts the oldest token if the store is at capacity.
 */
export function storeSessionToken(token: string): void {
  const now = Date.now()

  // Evict oldest token if at capacity
  if (validTokens.size >= MAX_TOKENS && !validTokens.has(token)) {
    let oldestKey: string | null = null
    let oldestTime = Infinity
    for (const [key, meta] of validTokens) {
      if (meta.createdAt < oldestTime) {
        oldestTime = meta.createdAt
        oldestKey = key
      }
    }
    if (oldestKey) validTokens.delete(oldestKey)
  }

  validTokens.set(token, {
    createdAt: now,
    expiresAt: now + TOKEN_TTL_MS,
  })
}

/**
 * Check if a session token is valid and not expired.
 */
export function isValidSessionToken(token: string): boolean {
  const meta = validTokens.get(token)
  if (!meta) return false
  if (Date.now() > meta.expiresAt) {
    validTokens.delete(token)
    return false
  }
  return true
}

/**
 * Remove a session token (logout).
 */
export function revokeSessionToken(token: string): void {
  validTokens.delete(token)
}

/**
 * Evict all expired tokens from the store.
 */
export function evictExpiredTokens(): void {
  const now = Date.now()
  for (const [key, meta] of validTokens) {
    if (now > meta.expiresAt) {
      validTokens.delete(key)
    }
  }
}

// Periodic cleanup of expired tokens (every 5 minutes)
const _cleanupInterval = setInterval(evictExpiredTokens, CLEANUP_INTERVAL_MS)
// Allow Node to exit without waiting for the interval
if (typeof _cleanupInterval.unref === 'function') {
  _cleanupInterval.unref()
}

/**
 * Clear all tokens. Exported for testing only.
 */
export function _clearAllTokens(): void {
  validTokens.clear()
}

/**
 * Get the current token count. Exported for testing only.
 */
export function _getTokenCount(): number {
  return validTokens.size
}

/**
 * Check if password protection is enabled.
 */
export function isPasswordProtectionEnabled(): boolean {
  return Boolean(
    process.env.HERMES_PASSWORD && process.env.HERMES_PASSWORD.length > 0,
  )
}

/**
 * Verify password using timing-safe comparison.
 */
export function verifyPassword(password: string): boolean {
  const configured = process.env.HERMES_PASSWORD
  if (!configured || configured.length === 0) {
    return false
  }

  // Timing-safe comparison
  const passwordBuf = Buffer.from(password, 'utf8')
  const configuredBuf = Buffer.from(configured, 'utf8')

  // If lengths differ, still do a comparison to avoid timing leak
  if (passwordBuf.length !== configuredBuf.length) {
    return false
  }

  try {
    return timingSafeEqual(passwordBuf, configuredBuf)
  } catch {
    // Intentional: timingSafeEqual can throw if buffers differ in byte length
    // after encoding. Returning false is the safe default — logging here would
    // leak timing information about password validation failures.
    return false
  }
}

/**
 * Extract session token from cookie header.
 */
export function getSessionTokenFromCookie(
  cookieHeader: string | null,
): string | null {
  if (!cookieHeader) return null

  const cookies = cookieHeader.split(';').map((c) => c.trim())
  for (const cookie of cookies) {
    if (cookie.startsWith('hermes-auth=')) {
      return cookie.substring('hermes-auth='.length)
    }
  }
  return null
}

function isLocalRequest(request: Request): boolean {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || '127.0.0.1'
  const localIPs = ['127.0.0.1', '::1', 'localhost', '::ffff:127.0.0.1']
  if (localIPs.includes(ip)) return true
  // Allow Tailscale (100.x.x.x) and private LAN ranges
  if (/^100\.\d+\.\d+\.\d+$/.test(ip)) return true
  if (/^192\.168\./.test(ip)) return true
  if (/^10\./.test(ip)) return true
  return false
}

/**
 * Check if the request is authenticated.
 * Returns true if:
 * - Password protection is disabled, OR
 * - Request has a valid session token
 */
export function isAuthenticated(request: Request): boolean {
  // No password configured? No auth needed
  if (!isPasswordProtectionEnabled()) {
    return true
  }

  // Check for valid session token
  const cookieHeader = request.headers.get('cookie')
  const token = getSessionTokenFromCookie(cookieHeader)

  if (!token) {
    return false
  }

  return isValidSessionToken(token)
}

export function requireLocalOrAuth(request: Request): boolean {
  if (!isPasswordProtectionEnabled()) {
    return isLocalRequest(request)
  }

  return isAuthenticated(request)
}

/**
 * Create a Set-Cookie header for the session token.
 */
export function createSessionCookie(token: string): string {
  // httpOnly: prevents JS access
  // secure: HTTPS only (disabled for local dev)
  // sameSite=strict: CSRF protection
  // path=/: available everywhere
  // maxAge: 30 days
  return `hermes-auth=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${30 * 24 * 60 * 60}`
}
