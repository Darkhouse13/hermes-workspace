import { describe, expect, it } from 'vitest'
import { getMemoryWorkspaceRoot, resolveMemoryFilePath } from './memory-browser'

describe('getMemoryWorkspaceRoot', () => {
  it('returns an absolute path', () => {
    const root = getMemoryWorkspaceRoot()
    expect(root.startsWith('/')).toBe(true)
  })

  it('ends with .hermes', () => {
    const root = getMemoryWorkspaceRoot()
    expect(root.endsWith('.hermes')).toBe(true)
  })
})

describe('resolveMemoryFilePath', () => {
  describe('path traversal prevention', () => {
    it('rejects empty path', () => {
      expect(() => resolveMemoryFilePath('')).toThrow('Path is required')
    })

    it('rejects whitespace-only path', () => {
      expect(() => resolveMemoryFilePath('   ')).toThrow('Path is required')
    })

    it('rejects absolute paths', () => {
      expect(() => resolveMemoryFilePath('/etc/passwd')).toThrow('Absolute paths are not allowed')
    })

    it('rejects path traversal with ..', () => {
      expect(() => resolveMemoryFilePath('../../etc/passwd.md')).toThrow('Path traversal is not allowed')
    })

    it('rejects path traversal mid-path', () => {
      expect(() => resolveMemoryFilePath('memory/../../../etc/passwd.md')).toThrow('Path traversal is not allowed')
    })

    it('rejects non-.md files', () => {
      expect(() => resolveMemoryFilePath('memory/test.txt')).toThrow('Only Markdown files are allowed')
    })

    it('rejects .js files', () => {
      expect(() => resolveMemoryFilePath('memory/test.js')).toThrow('Only Markdown files are allowed')
    })

    it('rejects files with no extension', () => {
      expect(() => resolveMemoryFilePath('memory/test')).toThrow('Only Markdown files are allowed')
    })
  })

  describe('valid paths', () => {
    it('accepts MEMORY.md', () => {
      const result = resolveMemoryFilePath('MEMORY.md')
      expect(result.relativePath).toBe('MEMORY.md')
      expect(result.fullPath).toContain('MEMORY.md')
    })

    it('accepts memory/notes.md', () => {
      const result = resolveMemoryFilePath('memory/notes.md')
      expect(result.relativePath).toBe('memory/notes.md')
    })

    it('accepts memories/2024-01-01.md', () => {
      const result = resolveMemoryFilePath('memories/2024-01-01.md')
      expect(result.relativePath).toBe('memories/2024-01-01.md')
    })

    it('normalizes backslashes to forward slashes', () => {
      const result = resolveMemoryFilePath('memory\\notes.md')
      expect(result.relativePath).toBe('memory/notes.md')
    })
  })

  describe('resolved path boundary', () => {
    it('resolved path starts with workspace root', () => {
      const root = getMemoryWorkspaceRoot()
      const result = resolveMemoryFilePath('MEMORY.md')
      expect(result.fullPath.startsWith(root)).toBe(true)
    })
  })
})
