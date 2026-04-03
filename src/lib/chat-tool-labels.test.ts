import { describe, expect, it } from 'vitest'
import {
  TOOL_STATUS_MAP,
  TOOL_EMOJIS,
  TOOL_DISPLAY_LABELS,
  getToolStatusLabel,
  getToolEmoji,
  getToolVerb,
  formatToolDisplayLabel,
} from './chat-tool-labels'

// ---------------------------------------------------------------------------
// TOOL_STATUS_MAP
// ---------------------------------------------------------------------------

describe('TOOL_STATUS_MAP', () => {
  it('has entries for known tools', () => {
    expect(TOOL_STATUS_MAP.web_search).toBe('Searching the web…')
    expect(TOOL_STATUS_MAP.exec).toBe('Running code…')
    expect(TOOL_STATUS_MAP.Read).toBe('Reading file…')
    expect(TOOL_STATUS_MAP.Write).toBe('Writing file…')
    expect(TOOL_STATUS_MAP.memory_search).toBe('Searching memory…')
  })
})

// ---------------------------------------------------------------------------
// getToolStatusLabel
// ---------------------------------------------------------------------------

describe('getToolStatusLabel', () => {
  it('returns mapped label for known tool', () => {
    expect(getToolStatusLabel('web_search')).toBe('Searching the web…')
  })

  it('returns "Working…" for unknown tool', () => {
    expect(getToolStatusLabel('unknown_tool')).toBe('Working…')
  })
})

// ---------------------------------------------------------------------------
// TOOL_EMOJIS
// ---------------------------------------------------------------------------

describe('TOOL_EMOJIS', () => {
  it('has entries for common tools', () => {
    expect(TOOL_EMOJIS.web_search).toBe('🔍')
    expect(TOOL_EMOJIS.exec).toBe('💻')
    expect(TOOL_EMOJIS.Read).toBe('📖')
    expect(TOOL_EMOJIS.Write).toBe('✏️')
    expect(TOOL_EMOJIS.memory).toBe('🧠')
    expect(TOOL_EMOJIS.browser).toBe('🌐')
    expect(TOOL_EMOJIS.todo).toBe('✅')
  })
})

// ---------------------------------------------------------------------------
// getToolEmoji
// ---------------------------------------------------------------------------

describe('getToolEmoji', () => {
  it('returns exact match from map', () => {
    expect(getToolEmoji('web_search')).toBe('🔍')
    expect(getToolEmoji('exec')).toBe('💻')
    expect(getToolEmoji('Read')).toBe('📖')
  })

  it('falls back to search emoji for names containing "search"', () => {
    expect(getToolEmoji('custom_search')).toBe('🔍')
  })

  it('falls back to read emoji for names containing "read"', () => {
    expect(getToolEmoji('read_docs')).toBe('📖')
  })

  it('falls back to read emoji for names containing "Read"', () => {
    expect(getToolEmoji('ReadFile')).toBe('📖')
  })

  it('falls back to write emoji for names containing "write"', () => {
    expect(getToolEmoji('write_output')).toBe('✏️')
  })

  it('falls back to write emoji for names containing "edit"', () => {
    expect(getToolEmoji('edit_config')).toBe('✏️')
  })

  it('falls back to exec emoji for names containing "exec"', () => {
    expect(getToolEmoji('exec_command')).toBe('💻')
  })

  it('falls back to exec emoji for names containing "terminal"', () => {
    expect(getToolEmoji('open_terminal')).toBe('💻')
  })

  it('falls back to memory emoji for names containing "memory"', () => {
    expect(getToolEmoji('load_memory')).toBe('🧠')
  })

  it('falls back to browser emoji for names containing "browser"', () => {
    expect(getToolEmoji('browser_action')).toBe('🌐')
  })

  it('falls back to skill emoji for names containing "skill"', () => {
    expect(getToolEmoji('use_skill')).toBe('📦')
  })

  it('returns default lightning bolt for unknown tools', () => {
    expect(getToolEmoji('completely_unknown')).toBe('⚡')
  })
})

// ---------------------------------------------------------------------------
// getToolVerb
// ---------------------------------------------------------------------------

describe('getToolVerb', () => {
  it('returns "Searching" for search tools', () => {
    expect(getToolVerb('web_search')).toBe('Searching')
  })

  it('returns "Reading" for read tools', () => {
    expect(getToolVerb('read_file')).toBe('Reading')
    expect(getToolVerb('Read')).toBe('Reading')
  })

  it('returns "Writing" for write tools', () => {
    expect(getToolVerb('write_file')).toBe('Writing')
    expect(getToolVerb('Write')).toBe('Writing')
    expect(getToolVerb('edit_file')).toBe('Writing')
  })

  it('returns "Executing" for exec tools', () => {
    expect(getToolVerb('exec')).toBe('Executing')
    expect(getToolVerb('terminal')).toBe('Executing')
  })

  it('returns "Remembering" for memory tools', () => {
    // Note: memory_search matches "search" first due to check order
    expect(getToolVerb('memory_search')).toBe('Searching')
    expect(getToolVerb('load_memory')).toBe('Remembering')
  })

  it('returns "Browsing" for browser tools', () => {
    expect(getToolVerb('browser_navigate')).toBe('Browsing')
  })

  it('returns "Loading skill" for skill tools', () => {
    expect(getToolVerb('skill_view')).toBe('Loading skill')
  })

  it('returns "Working" for unknown tools', () => {
    expect(getToolVerb('unknown')).toBe('Working')
  })
})

// ---------------------------------------------------------------------------
// TOOL_DISPLAY_LABELS
// ---------------------------------------------------------------------------

describe('TOOL_DISPLAY_LABELS', () => {
  it('has entries for browser actions', () => {
    expect(TOOL_DISPLAY_LABELS.browser_click).toBe('🖱 Click Element')
    expect(TOOL_DISPLAY_LABELS.browser_type).toBe('⌨ Type Text')
  })

  it('has entries for web tools', () => {
    expect(TOOL_DISPLAY_LABELS.web_search).toBe('🌐 Web Search')
  })
})

// ---------------------------------------------------------------------------
// formatToolDisplayLabel
// ---------------------------------------------------------------------------

describe('formatToolDisplayLabel', () => {
  it('returns mapped label for known display tools', () => {
    expect(formatToolDisplayLabel('browser_click')).toBe('🖱 Click Element')
    expect(formatToolDisplayLabel('web_search')).toBe('🌐 Web Search')
  })

  it('is case-insensitive for lookup', () => {
    expect(formatToolDisplayLabel('Browser_Click')).toBe('🖱 Click Element')
    expect(formatToolDisplayLabel('WEB_SEARCH')).toBe('🌐 Web Search')
  })

  // read / read_file with args
  it('formats read with file path arg', () => {
    expect(formatToolDisplayLabel('read', { file_path: '/src/index.ts' })).toBe('read index.ts')
  })

  it('formats read_file with path arg', () => {
    expect(formatToolDisplayLabel('read_file', { path: '/src/utils.ts' })).toBe('read utils.ts')
  })

  it('formats read without args', () => {
    expect(formatToolDisplayLabel('read')).toBe('read file')
  })

  // edit / patch_file with args
  it('formats edit with file path arg', () => {
    expect(formatToolDisplayLabel('edit', { file_path: '/src/main.ts' })).toBe('edit main.ts')
  })

  it('formats patch_file with target_file arg', () => {
    expect(formatToolDisplayLabel('patch_file', { target_file: '/lib/foo.ts' })).toBe('edit foo.ts')
  })

  it('formats edit without args', () => {
    expect(formatToolDisplayLabel('edit')).toBe('edit file')
  })

  // write / write_file / create_file with args
  it('formats write with file path arg', () => {
    expect(formatToolDisplayLabel('write', { file_path: '/out/result.json' })).toBe('write result.json')
  })

  it('formats create_file with path arg', () => {
    expect(formatToolDisplayLabel('create_file', { path: '/new/file.ts' })).toBe('write file.ts')
  })

  it('formats write without args', () => {
    expect(formatToolDisplayLabel('write')).toBe('write file')
  })

  // search_files with args
  it('formats search_files with pattern', () => {
    expect(formatToolDisplayLabel('search_files', { pattern: 'TODO' })).toBe('search "TODO"')
  })

  it('formats search_files with query', () => {
    expect(formatToolDisplayLabel('search_files', { query: 'fixme' })).toBe('search "fixme"')
  })

  it('formats search_files without args', () => {
    expect(formatToolDisplayLabel('search_files')).toBe('search files')
  })

  // browser / browser_navigate
  it('formats browser with action', () => {
    expect(formatToolDisplayLabel('browser', { action: 'click' })).toBe('browser click')
  })

  it('formats browser without args', () => {
    expect(formatToolDisplayLabel('browser')).toBe('browser')
  })

  // terminal / exec
  it('formats exec with short command', () => {
    expect(formatToolDisplayLabel('exec', { command: 'ls -la' })).toBe('exec ls -la')
  })

  it('truncates long exec commands', () => {
    const longCmd = 'a'.repeat(50)
    const result = formatToolDisplayLabel('exec', { command: longCmd })
    expect(result).toBe(`exec ${'a'.repeat(27)}…`)
  })

  it('formats exec without args', () => {
    expect(formatToolDisplayLabel('exec')).toBe('exec')
  })

  // Named fallbacks
  it('returns "memory search" for memory_search', () => {
    expect(formatToolDisplayLabel('memory_search')).toBe('memory search')
  })

  it('returns "save memory" for save_memory', () => {
    expect(formatToolDisplayLabel('save_memory')).toBe('save memory')
  })

  it('returns "memory get" for memory_get', () => {
    expect(formatToolDisplayLabel('memory_get')).toBe('memory get')
  })

  it('returns "web fetch" for web_fetch', () => {
    expect(formatToolDisplayLabel('web_fetch')).toBe('web fetch')
  })

  it('returns "view skill" for skill_view', () => {
    expect(formatToolDisplayLabel('skill_view')).toBe('view skill')
  })

  // Default: replace underscores
  it('replaces underscores with spaces for unmapped tools', () => {
    expect(formatToolDisplayLabel('my_custom_tool')).toBe('my custom tool')
  })

  it('trims the tool name', () => {
    expect(formatToolDisplayLabel('  read  ', { file_path: '/x/y.ts' })).toBe('read y.ts')
  })

  // File path extraction from paths with trailing slashes
  it('extracts file name from path with trailing slash', () => {
    expect(formatToolDisplayLabel('read', { file_path: '/some/dir/' })).toBe('read dir')
  })
})
