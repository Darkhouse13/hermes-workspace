// ──────────────────────────────────────────────────────────────────────────────
// Simple markdown -> HTML (no deps)
// ──────────────────────────────────────────────────────────────────────────────

export function markdownToHtml(md: string): string {
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Fenced code blocks
  html = html.replace(/```[\w]*\n([\s\S]*?)```/g, (_m, code: string) => {
    return `<pre class="md-code-block"><code>${code}</code></pre>`
  })

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>')

  // Headers
  html = html.replace(/^#{6}\s+(.+)$/gm, '<h6 class="md-h6">$1</h6>')
  html = html.replace(/^#{5}\s+(.+)$/gm, '<h5 class="md-h5">$1</h5>')
  html = html.replace(/^#{4}\s+(.+)$/gm, '<h4 class="md-h4">$1</h4>')
  html = html.replace(/^#{3}\s+(.+)$/gm, '<h3 class="md-h3">$1</h3>')
  html = html.replace(/^#{2}\s+(.+)$/gm, '<h2 class="md-h2">$1</h2>')
  html = html.replace(/^#{1}\s+(.+)$/gm, '<h1 class="md-h1">$1</h1>')

  // Bold / italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>')
  html = html.replace(/_(.+?)_/g, '<em>$1</em>')

  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>')

  // Horizontal rules
  html = html.replace(/^---+$/gm, '<hr class="md-hr" />')

  // Blockquotes (re-escaped)
  html = html.replace(/^&gt;\s+(.+)$/gm, '<blockquote class="md-blockquote">$1</blockquote>')

  // Unordered lists
  html = html.replace(/^[-*+]\s+(.+)$/gm, '<li class="md-li">$1</li>')
  html = html.replace(/(<li[^>]*>.*<\/li>\n?)+/g, (m) => `<ul class="md-ul">${m}</ul>`)

  // Links
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="md-link">$1</a>',
  )

  // Paragraphs
  const lines = html.split('\n')
  const result: Array<string> = []
  for (const line of lines) {
    if (
      line.trim() === '' ||
      line.startsWith('<h') ||
      line.startsWith('<ul') ||
      line.startsWith('<ol') ||
      line.startsWith('<li') ||
      line.startsWith('<pre') ||
      line.startsWith('<blockquote') ||
      line.startsWith('<hr')
    ) {
      result.push(line)
    } else {
      result.push(`<p class="md-p">${line}</p>`)
    }
  }
  return result.join('\n')
}

// ──────────────────────────────────────────────────────────────────────────────
// Line-by-line diff (no external lib)
// ──────────────────────────────────────────────────────────────────────────────

export type DiffLineKind = 'unchanged' | 'added' | 'removed'

export type DiffLine = {
  kind: DiffLineKind
  text: string
  leftNum: number | null   // original line number
  rightNum: number | null  // new line number
}

/**
 * Very simple LCS-based diff. Produces a list of DiffLine entries that can be
 * rendered in a split/unified view.
 */
export function computeDiff(original: string, updated: string): Array<DiffLine> {
  const aLines = original.split('\n')
  const bLines = updated.split('\n')
  const m = aLines.length
  const n = bLines.length

  // Build LCS table
  const dp: Array<Array<number>> = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (aLines[i - 1] === bLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // Backtrack
  const result: Array<DiffLine> = []
  let i = m
  let j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && aLines[i - 1] === bLines[j - 1]) {
      result.push({ kind: 'unchanged', text: aLines[i - 1], leftNum: i, rightNum: j })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ kind: 'added', text: bLines[j - 1], leftNum: null, rightNum: j })
      j--
    } else {
      result.push({ kind: 'removed', text: aLines[i - 1], leftNum: i, rightNum: null })
      i--
    }
  }
  return result.reverse()
}

// ──────────────────────────────────────────────────────────────────────────────
// Basic syntax highlighting (CSS-class only, no library)
// ──────────────────────────────────────────────────────────────────────────────

export const KEYWORDS = new Set([
  'import', 'export', 'default', 'from', 'const', 'let', 'var', 'function',
  'return', 'if', 'else', 'for', 'while', 'class', 'extends', 'new', 'this',
  'type', 'interface', 'async', 'await', 'try', 'catch', 'throw', 'null',
  'undefined', 'true', 'false', 'typeof', 'instanceof', 'void', 'in', 'of',
  'break', 'continue', 'switch', 'case', 'delete',
])

export function highlightCode(code: string, ext: string): string {
  if (ext === 'json') {
    return code
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/("(?:[^"\\]|\\.)*")(\s*:)/g, '<span class="hl-key">$1</span>$2')
      .replace(/:\s*("(?:[^"\\]|\\.)*")/g, ': <span class="hl-str">$1</span>')
      .replace(/:\s*(-?\d+\.?\d*)/g, ': <span class="hl-num">$1</span>')
      .replace(/:\s*(true|false|null)/g, ': <span class="hl-kw">$1</span>')
  }

  const escaped = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Strings (single + double + template)
  let out = escaped.replace(
    /(["'`])(?:(?!\1)[^\\]|\\.)*?\1/g,
    '<span class="hl-str">$&</span>',
  )

  // Line comments
  out = out.replace(/(\/\/[^\n]*)/g, '<span class="hl-comment">$1</span>')

  // Block comments
  out = out.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="hl-comment">$1</span>')

  // Keywords and type names
  out = out.replace(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g, (match) => {
    if (KEYWORDS.has(match)) return `<span class="hl-kw">${match}</span>`
    if (/^[A-Z]/.test(match)) return `<span class="hl-type">${match}</span>`
    return match
  })

  // Numbers
  out = out.replace(
    /(?<![a-zA-Z_$])\b(\d+\.?\d*)\b/g,
    '<span class="hl-num">$1</span>',
  )

  return out
}
