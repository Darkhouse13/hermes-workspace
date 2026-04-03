import fs from 'node:fs/promises'
import path from 'node:path'
import { createLogger } from './logger'

const log = createLogger('paperclip-store')

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true })
}

export async function readJsonOrDefault<T>(
  filePath: string,
  fallback: T,
): Promise<T> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content) as T
  } catch (err) {
    log.debug('Failed to read/parse JSON file, using fallback', { file: filePath, error: String(err) })
    return fallback
  }
}

export async function writeJsonPretty(filePath: string, value: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath))
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8')
}

export async function readTextOrDefault(
  filePath: string,
  fallback = '',
): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf-8')
  } catch {
    return fallback
  }
}

export async function writeText(filePath: string, value: string): Promise<void> {
  await ensureDir(path.dirname(filePath))
  await fs.writeFile(filePath, value, 'utf-8')
}

export async function appendMarkdownSection(
  filePath: string,
  heading: string,
  body: string,
): Promise<void> {
  const current = await readTextOrDefault(filePath, '')
  const next = `${current.trimEnd()}\n\n## ${heading}\n\n${body.trim()}\n`
  await writeText(filePath, next.trimStart())
}

export function upsertById<T extends { id: string }>(
  items: Array<T>,
  nextItem: T,
): Array<T> {
  const index = items.findIndex((item) => item.id === nextItem.id)
  if (index === -1) return [...items, nextItem]
  const clone = [...items]
  clone[index] = nextItem
  return clone
}

export function sortByUpdatedAtDesc<T extends { updatedAt?: string; createdAt?: string }>(
  items: Array<T>,
): Array<T> {
  return [...items].sort((a, b) => {
    const aTime = Date.parse(a.updatedAt || a.createdAt || '') || 0
    const bTime = Date.parse(b.updatedAt || b.createdAt || '') || 0
    return bTime - aTime
  })
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function makePaperclipId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
