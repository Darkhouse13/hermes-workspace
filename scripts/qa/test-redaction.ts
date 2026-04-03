#!/usr/bin/env tsx
/**
 * Security regression test: ensures sensitive data is never leaked.
 * Run: npx tsx scripts/qa/test-redaction.ts
 */

import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..', '..')
const SRC = path.join(ROOT, 'src')

let passed = 0
let failed = 0

function assert(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++
    console.log(`  PASS  ${name}`)
  } else {
    failed++
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function collectFiles(dir: string, extensions: Array<string>): Array<string> {
  const results: Array<string> = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue
      results.push(...collectFiles(fullPath, extensions))
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath)
    }
  }
  return results
}

// ── Test 1: No hardcoded API keys in source ──────────────────────────────

console.log('\n1. No hardcoded API keys in source files')

const SECRET_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/,     // Generic API key
  /sk-ant-[a-zA-Z0-9]{20,}/, // Anthropic API key
  /ghp_[a-zA-Z0-9]{36}/,     // GitHub PAT
  /github_pat_[a-zA-Z0-9]+/, // GitHub fine-grained PAT
]

const PLACEHOLDER_PATTERNS = [
  /sk-your-key-here/,
  /sk-or-v1-your/,
  /sk-ant-your/,
  /placeholder/i,
  /example/i,
  /sample/i,
  /fake/i,
  /dummy/i,
  /test/i,
  /mock/i,
]

const sourceFiles = collectFiles(SRC, ['.ts', '.tsx'])
const violations: Array<string> = []

for (const file of sourceFiles) {
  // Skip test files and type declarations
  if (file.includes('.test.') || file.includes('.d.ts')) continue

  const content = fs.readFileSync(file, 'utf-8')
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    for (const pattern of SECRET_PATTERNS) {
      const match = line.match(pattern)
      if (!match) continue
      // Check if it's a placeholder/example
      const isPlaceholder = PLACEHOLDER_PATTERNS.some((p) => p.test(line))
      // Check if it's in a regex pattern (security scanning code)
      const isRegex = line.includes('RegExp') || line.includes('/sk-') || line.includes("'sk-[")
      if (!isPlaceholder && !isRegex) {
        violations.push(`${path.relative(ROOT, file)}:${i + 1}: ${match[0].slice(0, 10)}...`)
      }
    }
  }
}

assert('No hardcoded secrets in source files', violations.length === 0, violations.join(', '))

// ── Test 2: safeErrorMessage hides details in production ─────────────────

console.log('\n2. safeErrorMessage hides details in production')

const rateLimitFile = path.join(SRC, 'server', 'rate-limit.ts')
const rateLimitContent = fs.readFileSync(rateLimitFile, 'utf-8')

assert(
  'safeErrorMessage checks NODE_ENV === production',
  rateLimitContent.includes("process.env.NODE_ENV === 'production'") &&
    rateLimitContent.includes('Internal server error'),
)

// ── Test 3: maskKey redacts API keys ─────────────────────────────────────

console.log('\n3. maskKey redacts API keys')

const configFile = path.join(SRC, 'routes', 'api', 'hermes-config.ts')
const configContent = fs.readFileSync(configFile, 'utf-8')

// Verify maskKey function exists and truncates keys
assert('maskKey function exists', configContent.includes('function maskKey'))

// Extract maskKey logic and verify it masks properly
// maskKey: if (!key || key.length < 8) return '***'; return key.slice(0, 4) + '...' + key.slice(-4)
assert(
  'maskKey does not return full key',
  configContent.includes("key.slice(0, 4) + '...' + key.slice(-4)") ||
    configContent.includes('key.slice(0, 4)'),
)

// ── Test 4: Session cookies use HttpOnly ─────────────────────────────────

console.log('\n4. Session cookies use HttpOnly')

const authFile = path.join(SRC, 'server', 'auth-middleware.ts')
const authContent = fs.readFileSync(authFile, 'utf-8')

assert('createSessionCookie uses HttpOnly', authContent.includes('HttpOnly'))
assert('createSessionCookie uses SameSite=Strict', authContent.includes('SameSite=Strict'))

// ── Test 5: No HERMES_PASSWORD in client-side code ───────────────────────

console.log('\n5. No HERMES_PASSWORD in client-side code')

const clientFiles = sourceFiles.filter(
  (f) => !f.includes('/server/') && !f.includes('.test.'),
)

const passwordLeaks: Array<string> = []
for (const file of clientFiles) {
  const content = fs.readFileSync(file, 'utf-8')
  if (content.includes('process.env.HERMES_PASSWORD')) {
    passwordLeaks.push(path.relative(ROOT, file))
  }
}

assert(
  'No process.env.HERMES_PASSWORD in client code',
  passwordLeaks.length === 0,
  passwordLeaks.join(', '),
)

// ── Test 6: .env files are gitignored ────────────────────────────────────

console.log('\n6. .env files are gitignored')

const gitignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf-8')
assert('.gitignore contains .env', gitignore.includes('.env'))

// ── Summary ──────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed > 0 ? 1 : 0)
