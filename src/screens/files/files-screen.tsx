import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { cn } from '@/lib/utils'
import { usePageTitle } from '@/hooks/use-page-title'
import {
  ScrollAreaCorner,
  ScrollAreaRoot,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog'

import type { FileEntry, FileReadResponse, FilesListResponse, PromptState, ContextMenuState } from './file-utils'
import {
  IGNORED_DIRS,
  getExt,
  isImageFile,
  isCodeFile,
  isMarkdownFile,
  isEditableFile,
  getFileIcon,
  formatBytes,
  formatDate,
  getParentPath,
} from './file-utils'
import { markdownToHtml, highlightCode } from './components/markdown-preview'
import { DiffModal } from './components/file-context-menu'
import { TreeNode, Breadcrumb } from './components/file-tree'

// ──────────────────────────────────────────────────────────────────────────────
// File panel — viewer / editor
// All hooks are called unconditionally at the top.
// ──────────────────────────────────────────────────────────────────────────────

type FilePanelProps = {
  selectedEntry: FileEntry | null
}

function FilePanel({ selectedEntry }: FilePanelProps) {
  const [loadingFile, setLoadingFile] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [dataUrl, setDataUrl] = useState('')
  const [editValue, setEditValue] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const [rawMode, setRawMode] = useState(false)
  const [showDiff, setShowDiff] = useState(false)
  const prevPathRef = useRef<string | null>(null)

  // Derive file type info (safe regardless of selectedEntry nullity)
  const fileName = selectedEntry?.name ?? ''
  const ext = getExt(fileName)
  const isImage = isImageFile(fileName)
  const isMd = isMarkdownFile(fileName)
  const isCode = isCodeFile(fileName)
  const isEditable = isEditableFile(fileName)

  // Always call useMemo unconditionally
  const mdHtml = useMemo(
    () => (isMd && !rawMode && content ? markdownToHtml(content) : ''),
    [isMd, rawMode, content],
  )

  const highlighted = useMemo(
    () => (isCode && !isMd && content ? highlightCode(content, ext) : ''),
    [isCode, isMd, content, ext],
  )

  const loadFile = useCallback(async (path: string) => {
    setLoadingFile(true)
    setFileError(null)
    setContent('')
    setDataUrl('')
    setDirty(false)
    setRawMode(false)
    try {
      const res = await fetch(
        `/api/files?action=read&path=${encodeURIComponent(path)}`,
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as FileReadResponse
      if (data.type === 'image') {
        setDataUrl(data.content)
      } else {
        setContent(data.content)
        setEditValue(data.content)
      }
    } catch (err) {
      setFileError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoadingFile(false)
    }
  }, [])

  useEffect(() => {
    if (!selectedEntry || selectedEntry.type === 'folder') return
    if (prevPathRef.current === selectedEntry.path) return
    prevPathRef.current = selectedEntry.path
    void loadFile(selectedEntry.path)
  }, [selectedEntry, loadFile])

  /** Actually write to disk (called after diff confirmation or if nothing changed) */
  const commitSave = useCallback(async (path: string, value: string) => {
    setSaving(true)
    setShowDiff(false)
    try {
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'write', path, content: value }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setContent(value)
      setDirty(false)
      setSavedOk(true)
      setTimeout(() => setSavedOk(false), 2000)
    } catch (err) {
      setFileError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }, [])

  /** Save button handler — shows diff modal when content has changed */
  const handleSave = useCallback(() => {
    if (!selectedEntry || !dirty) return
    if (editValue !== content) {
      // Show diff first
      setShowDiff(true)
    } else {
      void commitSave(selectedEntry.path, editValue)
    }
  }, [selectedEntry, dirty, editValue, content, commitSave])

  // ── Diff Modal (always rendered so hooks stay consistent) ─────────────────

  const diffModal = (
    <DiffModal
      open={showDiff}
      fileName={selectedEntry?.name ?? ''}
      original={content}
      updated={editValue}
      onSave={() => {
        if (selectedEntry) void commitSave(selectedEntry.path, editValue)
      }}
      onCancel={() => setShowDiff(false)}
    />
  )

  // ── Empty / folder states ──────────────────────────────────────────────────

  if (!selectedEntry) {
    return (
      <>
        {diffModal}
        <div className="flex h-full items-center justify-center text-center text-primary-400 dark:text-neutral-600">
          <div>
            <div className="text-5xl mb-3 opacity-40">📂</div>
            <p className="text-sm">Select a file to preview or edit</p>
          </div>
        </div>
      </>
    )
  }

  if (selectedEntry.type === 'folder') {
    return (
      <>
        {diffModal}
        <div className="flex h-full items-center justify-center text-center text-primary-400 dark:text-neutral-600">
          <div>
            <div className="text-5xl mb-3 opacity-40">📁</div>
            <p className="text-sm font-medium">{selectedEntry.name}</p>
            <p className="text-xs mt-1 opacity-70">Select a file inside to preview</p>
          </div>
        </div>
      </>
    )
  }

  // ── Shared header / footer ─────────────────────────────────────────────────

  const header = (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-primary-200 dark:border-neutral-800 px-4 py-2.5">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-lg">{getFileIcon(selectedEntry)}</span>
        <span className="truncate text-sm font-semibold text-primary-900 dark:text-neutral-100">
          {selectedEntry.name}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {isMd && !isImage && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRawMode((v) => !v)}
          >
            {rawMode ? 'Preview' : 'Raw'}
          </Button>
        )}
        {isEditable && (
          <Button
            size="sm"
            variant={savedOk ? 'outline' : 'default'}
            disabled={!dirty || saving}
            onClick={handleSave}
          >
            {saving ? 'Saving…' : savedOk ? '✓ Saved' : 'Save'}
          </Button>
        )}
      </div>
    </div>
  )

  const footer = (
    <div className="flex shrink-0 items-center gap-4 border-t border-primary-200 dark:border-neutral-800 px-4 py-1.5 text-xs text-primary-400 dark:text-neutral-500">
      {selectedEntry.size !== undefined && (
        <span>{formatBytes(selectedEntry.size)}</span>
      )}
      {selectedEntry.modifiedAt && (
        <span>Modified {formatDate(selectedEntry.modifiedAt)}</span>
      )}
      {dirty && (
        <span className="text-accent-500 font-medium">Unsaved changes</span>
      )}
    </div>
  )

  // ── Loading / error ────────────────────────────────────────────────────────

  if (loadingFile) {
    return (
      <>
        {diffModal}
        <div className="flex h-full flex-col">
          {header}
          <div className="flex flex-1 items-center justify-center text-sm text-primary-400 dark:text-neutral-500">
            Loading…
          </div>
          {footer}
        </div>
      </>
    )
  }

  if (fileError) {
    return (
      <>
        {diffModal}
        <div className="flex h-full flex-col">
          {header}
          <div className="flex flex-1 items-center justify-center p-4 text-sm text-red-600 dark:text-red-400">
            {fileError}
          </div>
          {footer}
        </div>
      </>
    )
  }

  // ── Image ──────────────────────────────────────────────────────────────────

  if (isImage) {
    return (
      <>
        {diffModal}
        <div className="flex h-full flex-col">
          {header}
          <div className="flex flex-1 min-h-0 items-center justify-center overflow-auto p-6">
            {dataUrl ? (
              <img
                src={dataUrl}
                alt={selectedEntry.name}
                className="max-h-full max-w-full rounded-lg border border-primary-200 dark:border-neutral-800 shadow-sm object-contain"
              />
            ) : (
              <div className="text-sm text-primary-400">No preview</div>
            )}
          </div>
          {footer}
        </div>
      </>
    )
  }

  // ── Markdown preview ───────────────────────────────────────────────────────

  if (isMd && !rawMode) {
    return (
      <>
        {diffModal}
        <div className="flex h-full flex-col">
          {header}
          <ScrollAreaRoot className="flex-1 min-h-0">
            <ScrollAreaViewport>
              <div
                className="markdown-preview px-6 py-5 text-sm text-primary-900 dark:text-neutral-200"
                dangerouslySetInnerHTML={{ __html: mdHtml }}
              />
            </ScrollAreaViewport>
            <ScrollAreaScrollbar orientation="vertical">
              <ScrollAreaThumb />
            </ScrollAreaScrollbar>
            <ScrollAreaCorner />
          </ScrollAreaRoot>
          {footer}
        </div>
      </>
    )
  }

  // ── Code viewer (syntax highlighted) — also raw mode for md ───────────────

  if (isCode) {
    const displayHtml = isMd ? highlightCode(content, 'md') : highlighted
    return (
      <>
        {diffModal}
        <div className="flex h-full flex-col">
          {header}
          <ScrollAreaRoot className="flex-1 min-h-0">
            <ScrollAreaViewport>
              <pre
                className="code-viewer px-4 py-4 text-xs font-mono leading-relaxed text-primary-800 dark:text-neutral-300"
                dangerouslySetInnerHTML={{ __html: displayHtml }}
              />
            </ScrollAreaViewport>
            <ScrollAreaScrollbar orientation="vertical">
              <ScrollAreaThumb />
            </ScrollAreaScrollbar>
            <ScrollAreaScrollbar orientation="horizontal">
              <ScrollAreaThumb />
            </ScrollAreaScrollbar>
            <ScrollAreaCorner />
          </ScrollAreaRoot>
          {footer}
        </div>
      </>
    )
  }

  // ── Editable textarea (plain text, raw md, etc.) ───────────────────────────

  return (
    <>
      {diffModal}
      <div className="flex h-full flex-col">
        {header}
        <div className="flex-1 min-h-0 p-3">
          <textarea
            className={cn(
              'h-full w-full resize-none rounded-lg border border-primary-200 dark:border-neutral-800',
              'bg-white dark:bg-neutral-900 px-3 py-2 font-mono text-xs leading-relaxed',
              'text-primary-900 dark:text-neutral-200 placeholder:text-primary-300',
              'focus:outline-none focus:ring-2 focus:ring-accent-500/30',
            )}
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value)
              setDirty(e.target.value !== content)
            }}
            spellCheck={false}
          />
        </div>
        {footer}
      </div>
    </>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Main FilesScreen
// ──────────────────────────────────────────────────────────────────────────────

export function FilesScreen() {
  usePageTitle('Files')

  const [entries, setEntries] = useState<Array<FileEntry>>([])
  const [treeLoading, setTreeLoading] = useState(false)
  const [treeError, setTreeError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [selectedEntry, setSelectedEntry] = useState<FileEntry | null>(null)

  // CRUD state
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [promptState, setPromptState] = useState<PromptState | null>(null)
  const [promptValue, setPromptValue] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<FileEntry | null>(null)

  const loadTree = useCallback(async () => {
    setTreeLoading(true)
    setTreeError(null)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    try {
      const res = await fetch('/api/files?action=list&maxDepth=0', { signal: controller.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status} — check that HERMES_WORKSPACE_DIR is set`)
      const data = (await res.json()) as FilesListResponse
      setEntries(Array.isArray(data.entries) ? data.entries : [])
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setTreeError('Could not load files — request timed out. Check that HERMES_WORKSPACE_DIR is set.')
      } else {
        setTreeError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      clearTimeout(timeoutId)
      setTreeLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTree()
  }, [loadTree])

  // Close context menu on outside click / escape
  useEffect(() => {
    if (!contextMenu) return
    const handleClick = () => setContextMenu(null)
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null)
    }
    window.addEventListener('click', handleClick)
    window.addEventListener('contextmenu', handleClick)
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('click', handleClick)
      window.removeEventListener('contextmenu', handleClick)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [contextMenu])

  const handleToggle = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const handleSelect = useCallback((entry: FileEntry) => {
    setSelectedEntry(entry)
  }, [])

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, entry: FileEntry) => {
      e.preventDefault()
      setContextMenu({ x: e.clientX, y: e.clientY, entry })
    },
    [],
  )

  // ── CRUD actions ────────────────────────────────────────────────────────────

  const handleDeleteConfirmed = useCallback(async () => {
    if (!deleteConfirm) return
    await fetch('/api/files', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'delete', path: deleteConfirm.path }),
    })
    if (selectedEntry?.path === deleteConfirm.path) {
      setSelectedEntry(null)
    }
    setDeleteConfirm(null)
    await loadTree()
  }, [deleteConfirm, selectedEntry, loadTree])

  const handleDownload = useCallback(async (entry: FileEntry) => {
    const res = await fetch(
      `/api/files?action=download&path=${encodeURIComponent(entry.path)}`,
    )
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = entry.name
    anchor.click()
    URL.revokeObjectURL(url)
  }, [])

  const openRenamePrompt = useCallback((entry: FileEntry) => {
    setPromptState({ mode: 'rename', targetPath: entry.path, defaultValue: entry.name })
    setPromptValue(entry.name)
  }, [])

  const openNewFolderPrompt = useCallback(() => {
    setPromptState({ mode: 'new-folder', targetPath: '' })
    setPromptValue('')
  }, [])

  const handlePromptSubmit = useCallback(async () => {
    if (!promptState) return
    const value = promptValue.trim()
    if (!value) return

    if (promptState.mode === 'rename') {
      const parent = getParentPath(promptState.targetPath)
      const nextPath = parent ? `${parent}/${value}` : value
      await fetch('/api/files', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'rename',
          from: promptState.targetPath,
          to: nextPath,
        }),
      })
    } else {
      // new-folder
      const nextPath = promptState.targetPath
        ? `${promptState.targetPath}/${value}`
        : value
      await fetch('/api/files', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'mkdir', path: nextPath }),
      })
    }

    setPromptState(null)
    setPromptValue('')
    await loadTree()
  }, [promptState, promptValue, loadTree])

  const selectedPath = selectedEntry?.path ?? null

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-primary-50/95 dark:bg-neutral-950">
      {/* ── Left panel — directory tree ─────────────────────────────────── */}
      <aside
        className={cn(
          'flex h-full w-[260px] shrink-0 flex-col overflow-hidden',
          'rounded-xl border border-primary-200 bg-primary-50/95 shadow-sm',
          'dark:border-neutral-800 dark:bg-neutral-900/80',
          'm-2 mr-0',
        )}
      >
        {/* Tree header */}
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-primary-200 dark:border-neutral-800 px-3">
          <Breadcrumb path={selectedEntry?.path ?? ''} />
          <div className="flex shrink-0 items-center gap-0.5 ml-2">
            <button
              type="button"
              onClick={openNewFolderPrompt}
              title="New folder"
              className="rounded p-1 text-sm text-primary-400 hover:bg-primary-200 dark:hover:bg-neutral-800 hover:text-primary-600 dark:hover:text-neutral-300 transition-colors leading-none"
            >
              📁+
            </button>
            <button
              type="button"
              onClick={() => void loadTree()}
              title="Refresh"
              className="rounded p-1 text-lg text-primary-400 hover:bg-primary-200 dark:hover:bg-neutral-800 hover:text-primary-600 dark:hover:text-neutral-300 transition-colors leading-none"
            >
              ↺
            </button>
          </div>
        </div>

        {/* Tree body */}
        <ScrollAreaRoot className="flex-1 min-h-0">
          <ScrollAreaViewport className="px-1 py-1">
            {treeLoading ? (
              <div className="px-3 py-2 text-xs text-primary-400 dark:text-neutral-500">
                Loading…
              </div>
            ) : treeError ? (
              <div className="px-3 py-2 text-xs text-red-500">{treeError}</div>
            ) : entries.length === 0 ? (
              <div className="px-3 py-2 text-xs text-primary-400 dark:text-neutral-500">
                Workspace is empty
              </div>
            ) : (
              entries
                .filter((e) => !IGNORED_DIRS.has(e.name))
                .map((entry) => (
                  <TreeNode
                    key={entry.path}
                    entry={entry}
                    depth={0}
                    expanded={expanded}
                    selectedPath={selectedPath}
                    onToggle={handleToggle}
                    onSelect={handleSelect}
                    onContextMenu={handleContextMenu}
                  />
                ))
            )}
          </ScrollAreaViewport>
          <ScrollAreaScrollbar orientation="vertical">
            <ScrollAreaThumb />
          </ScrollAreaScrollbar>
          <ScrollAreaCorner />
        </ScrollAreaRoot>
      </aside>

      {/* ── Right panel — file viewer / editor ─────────────────────────── */}
      <main
        className={cn(
          'flex h-full flex-1 min-w-0 flex-col overflow-hidden',
          'rounded-xl border border-primary-200 bg-primary-50/95 shadow-sm',
          'dark:border-neutral-800 dark:bg-neutral-900/80',
          'm-2',
        )}
      >
        <FilePanel selectedEntry={selectedEntry} />
      </main>

      {/* ── Context menu ──────────────────────────────────────────────────── */}
      {contextMenu ? (
        <div
          className="fixed z-50 min-w-[160px] rounded-lg bg-primary-50 dark:bg-neutral-900 p-1 text-sm text-primary-900 dark:text-neutral-100 shadow-lg outline outline-primary-900/10 dark:outline-neutral-700"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 hover:bg-primary-100 dark:hover:bg-neutral-800"
            onClick={() => {
              openRenamePrompt(contextMenu.entry)
              setContextMenu(null)
            }}
          >
            ✏️ Rename
          </button>
          {contextMenu.entry.type === 'folder' ? (
            <button
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 hover:bg-primary-100 dark:hover:bg-neutral-800"
              onClick={() => {
                setPromptState({ mode: 'new-folder', targetPath: contextMenu.entry.path })
                setPromptValue('')
                setContextMenu(null)
              }}
            >
              📁 New folder inside
            </button>
          ) : (
            <button
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 hover:bg-primary-100 dark:hover:bg-neutral-800"
              onClick={() => {
                void handleDownload(contextMenu.entry)
                setContextMenu(null)
              }}
            >
              ⬇️ Download
            </button>
          )}
          <button
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
            onClick={() => {
              setDeleteConfirm(contextMenu.entry)
              setContextMenu(null)
            }}
          >
            🗑️ Delete
          </button>
        </div>
      ) : null}

      {/* ── Rename / New-folder prompt dialog ─────────────────────────────── */}
      <DialogRoot
        open={Boolean(promptState)}
        onOpenChange={(open) => {
          if (!open) setPromptState(null)
        }}
      >
        <DialogContent>
          <div className="p-5 space-y-3">
            <DialogTitle>
              {promptState?.mode === 'rename' ? 'Rename' : 'New Folder'}
            </DialogTitle>
            <DialogDescription>
              {promptState?.mode === 'rename'
                ? 'Enter a new name.'
                : 'Enter a folder name to create.'}
            </DialogDescription>
            <input
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handlePromptSubmit()
              }}
              className="w-full rounded-md border border-primary-200 dark:border-neutral-700 bg-primary-50 dark:bg-neutral-900 px-3 py-2 text-sm text-primary-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-300"
              autoFocus
            />
            <div className="flex justify-end gap-2 pt-2">
              <DialogClose render={<Button variant="outline">Cancel</Button>} />
              <Button onClick={() => void handlePromptSubmit()}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </DialogRoot>

      {/* ── Delete confirm dialog ──────────────────────────────────────────── */}
      <DialogRoot
        open={Boolean(deleteConfirm)}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirm(null)
        }}
      >
        <DialogContent>
          <div className="p-5 space-y-3">
            <DialogTitle>Delete {deleteConfirm?.type === 'folder' ? 'Folder' : 'File'}</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <strong>{deleteConfirm?.name}</strong>?
              {deleteConfirm?.type === 'folder' && ' This will delete all contents inside.'}
              {' '}This action cannot be undone.
            </DialogDescription>
            <div className="flex justify-end gap-2 pt-2">
              <DialogClose render={<Button variant="outline">Cancel</Button>} />
              <Button
                variant="destructive"
                onClick={() => void handleDeleteConfirmed()}
              >
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </DialogRoot>
    </div>
  )
}
