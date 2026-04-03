import { cn } from '@/lib/utils'
import type { FileEntry } from '../file-utils'
import { IGNORED_DIRS, getFileIcon } from '../file-utils'

// ──────────────────────────────────────────────────────────────────────────────
// Directory tree node
// ──────────────────────────────────────────────────────────────────────────────

export type TreeNodeProps = {
  entry: FileEntry
  depth: number
  expanded: Set<string>
  selectedPath: string | null
  onToggle: (path: string) => void
  onSelect: (entry: FileEntry) => void
  onContextMenu: (e: React.MouseEvent, entry: FileEntry) => void
}

export function TreeNode({
  entry,
  depth,
  expanded,
  selectedPath,
  onToggle,
  onSelect,
  onContextMenu,
}: TreeNodeProps) {
  const isExpanded = expanded.has(entry.path)
  const isSelected = selectedPath === entry.path
  const icon = getFileIcon(entry)
  const paddingLeft = 12 + depth * 16

  const handleClick = () => {
    if (entry.type === 'folder') {
      onToggle(entry.path)
    } else {
      onSelect(entry)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, entry)}
        className={cn(
          'flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-sm transition-colors',
          isSelected
            ? 'bg-accent-500/15 text-accent-600 dark:text-accent-400'
            : 'text-primary-900 dark:text-neutral-200 hover:bg-primary-200 dark:hover:bg-neutral-800',
        )}
        style={{ paddingLeft }}
      >
        {entry.type === 'folder' ? (
          <span
            className={cn(
              'shrink-0 text-primary-400 transition-transform duration-150 text-xs',
              isExpanded ? 'rotate-90' : 'rotate-0',
            )}
          >
            ▶
          </span>
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <span className="shrink-0 text-base leading-none">{icon}</span>
        <span className="truncate">{entry.name}</span>
      </button>

      {entry.type === 'folder' && isExpanded && entry.children ? (
        <div>
          {entry.children
            .filter((c) => !IGNORED_DIRS.has(c.name))
            .map((child) => (
              <TreeNode
                key={child.path}
                entry={child}
                depth={depth + 1}
                expanded={expanded}
                selectedPath={selectedPath}
                onToggle={onToggle}
                onSelect={onSelect}
                onContextMenu={onContextMenu}
              />
            ))}
        </div>
      ) : null}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Breadcrumb
// ──────────────────────────────────────────────────────────────────────────────

export function Breadcrumb({ path }: { path: string }) {
  const parts = path ? path.split('/').filter(Boolean) : []
  return (
    <div className="flex items-center gap-1 truncate text-xs text-primary-500 dark:text-neutral-400 min-w-0">
      <span className="shrink-0">workspace</span>
      {parts.map((part, i) => (
        <span key={i} className="flex items-center gap-1 min-w-0">
          <span className="shrink-0 text-primary-300 dark:text-neutral-600">/</span>
          <span
            className={cn(
              'truncate',
              i === parts.length - 1
                ? 'text-primary-700 dark:text-neutral-300 font-medium'
                : '',
            )}
          >
            {part}
          </span>
        </span>
      ))}
    </div>
  )
}
