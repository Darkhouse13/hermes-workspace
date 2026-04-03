// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export type FileEntry = {
  name: string
  path: string
  type: 'file' | 'folder'
  size?: number
  modifiedAt?: string
  children?: Array<FileEntry>
}

export type FilesListResponse = {
  root: string
  base: string
  entries: Array<FileEntry>
}

export type FileReadResponse = {
  type: 'text' | 'image'
  path: string
  content: string
}

export type PromptState = {
  mode: 'rename' | 'new-folder'
  targetPath: string
  defaultValue?: string
}

export type ContextMenuState = {
  x: number
  y: number
  entry: FileEntry
}

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

export const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.turbo',
  '.cache',
  '__pycache__',
  '.venv',
  'dist',
])

export const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'])
export const CODE_EXTS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'json', 'css', 'html',
  'yml', 'yaml', 'sh', 'py', 'env',
])

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

export function getExt(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : ''
}

export function isImageFile(name: string): boolean {
  return IMAGE_EXTS.has(getExt(name))
}

export function isCodeFile(name: string): boolean {
  return CODE_EXTS.has(getExt(name))
}

export function isMarkdownFile(name: string): boolean {
  const ext = getExt(name)
  return ext === 'md' || ext === 'mdx'
}

export function isEditableFile(name: string): boolean {
  return !isImageFile(name)
}

export function getFileIcon(entry: FileEntry): string {
  if (entry.type === 'folder') return '📁'
  const ext = getExt(entry.name)
  if (ext === 'md' || ext === 'mdx') return '📄'
  if (ext === 'json') return '📋'
  if (ext === 'ts' || ext === 'tsx' || ext === 'js' || ext === 'jsx') return '📜'
  if (IMAGE_EXTS.has(ext)) return '🖼'
  return '📃'
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function getParentPath(pathValue: string): string {
  const parts = pathValue.replace(/\\/g, '/').split('/').filter(Boolean)
  if (parts.length <= 1) return ''
  return parts.slice(0, -1).join('/')
}
