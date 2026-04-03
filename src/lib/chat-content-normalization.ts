/**
 * Shared chat content normalization utilities.
 *
 * Consolidates tag-stripping, MIME-type helpers, and data-URL utilities
 * used across chat-store, chat-screen, and chat-composer.
 */

// ── Tag stripping ────────────────────────────────────────────────

/**
 * Strip <final>...</final> wrapper tags that the server emits as a
 * streaming-completion sentinel in agent chunk events.
 */
export function stripFinalTags(text: string): string {
  let result = text.replace(/^\s*<final>\s*([\s\S]*?)\s*<\/final>\s*$/i, '$1').trim()
  result = stripInternalTags(result)
  return result
}

/**
 * Strip internal model tags (<thinking>, <antThinking>, <thought>,
 * <parameter name="newText">, <relevant_memories>) that can leak into
 * displayed text. Only strips outside code blocks to avoid breaking code samples.
 */
export function stripInternalTags(text: string): string {
  const parts = text.split(/(```[\s\S]*?```)/g)
  return parts.map((part, i) => {
    if (i % 2 === 1) return part // inside code block — leave untouched
    return part
      .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
      .replace(/<antThinking>[\s\S]*?<\/antThinking>/gi, '')
      .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
      .replace(/<parameter name="newText">[\s\S]*?<\/antml:parameter>/gi, '')
      .replace(/<relevant_memories>[\s\S]*?<\/relevant_memories>/gi, '')
      .trim()
  }).join('')
}

// ── MIME type helpers ────────────────────────────────────────────

export function normalizeMimeType(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim().toLowerCase()
}

export function isImageMimeType(value: unknown): boolean {
  const normalized = normalizeMimeType(value)
  return normalized.startsWith('image/')
}

export function isTextMimeType(value: unknown): boolean {
  const normalized = normalizeMimeType(value)
  return normalized.startsWith('text/') || normalized === 'application/json'
}

// ── Data URL helpers ─────────────────────────────────────────────

export function readDataUrlMimeType(value: unknown): string {
  if (typeof value !== 'string') return ''
  const match = /^data:([^;,]+)[^,]*,/i.exec(value.trim())
  return match?.[1]?.trim().toLowerCase() || ''
}

export function stripDataUrlPrefix(value: unknown): string {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  const commaIndex = trimmed.indexOf(',')
  if (trimmed.toLowerCase().startsWith('data:') && commaIndex >= 0) {
    return trimmed.slice(commaIndex + 1).trim()
  }
  return trimmed
}

// ── File extension → MIME maps ───────────────────────────────────

export const IMAGE_EXTENSION_TO_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  heic: 'image/heic',
  heif: 'image/heif',
  tif: 'image/tiff',
  tiff: 'image/tiff',
}

export const TEXT_EXTENSION_TO_MIME: Record<string, string> = {
  md: 'text/markdown',
  txt: 'text/plain',
  json: 'application/json',
  csv: 'text/csv',
  ts: 'text/plain',
  tsx: 'text/plain',
  js: 'text/plain',
  py: 'text/plain',
}

export function inferImageMimeTypeFromFileName(name: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(name.trim())
  if (!match?.[1]) return ''
  return IMAGE_EXTENSION_TO_MIME[match[1].toLowerCase()] || ''
}

export function inferTextMimeTypeFromFileName(name: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(name.trim())
  if (!match?.[1]) return ''
  return TEXT_EXTENSION_TO_MIME[match[1].toLowerCase()] || ''
}

export function isImageFile(file: File): boolean {
  if (isImageMimeType(file.type)) return true
  return inferImageMimeTypeFromFileName(file.name).length > 0
}

export function isTextFile(file: File): boolean {
  if (isTextMimeType(file.type)) return true
  return inferTextMimeTypeFromFileName(file.name).length > 0
}

// ── String normalization ─────────────────────────────────────────

export function normalizeMessageValue(value: unknown): string {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : ''
}
