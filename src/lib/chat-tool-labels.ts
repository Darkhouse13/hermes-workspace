/**
 * Shared tool label constants and formatting utilities.
 *
 * Consolidates tool status maps, emoji maps, verb derivation, and display
 * label formatting used across chat-message-list and message-item.
 */

// ── Status map (used for streaming status pills) ─────────────────

export const TOOL_STATUS_MAP: Record<string, string> = {
  memory_search: 'Searching memory…',
  memory_get: 'Searching memory…',
  web_search: 'Searching the web…',
  web_fetch: 'Reading page…',
  cron: 'Managing schedules…',
  message: 'Sending message…',
  gateway: 'Managing gateway…',
  canvas: 'Rendering canvas…',
  voice_call: 'Making call…',
  pdf: 'Reading PDF…',
  todo: 'Managing tasks…',
  Read: 'Reading file…',
  read: 'Reading file…',
  Write: 'Writing file…',
  write: 'Writing file…',
  Edit: 'Writing file…',
  edit: 'Writing file…',
  exec: 'Running code…',
  sessions_spawn: 'Spawning agent…',
  sessions_history: 'Checking sessions…',
  sessions_list: 'Checking sessions…',
  browser: 'Browsing web…',
  image: 'Analyzing image…',
  tts: 'Generating audio…',
}

export function getToolStatusLabel(toolName: string): string {
  return TOOL_STATUS_MAP[toolName] ?? 'Working…'
}

// ── Emoji map ────────────────────────────────────────────────────

export const TOOL_EMOJIS: Record<string, string> = {
  web_search: '🔍', search: '🔍', search_files: '🔍', session_search: '🔍',
  web_fetch: '🌐',
  terminal: '💻', exec: '💻', shell: '💻', bash: '💻',
  Read: '📖', read: '📖', read_file: '📖', file_read: '📖',
  pdf: '📄',
  Write: '✏️', write: '✏️', write_file: '✏️', edit: '✏️', Edit: '✏️',
  memory: '🧠', memory_search: '🧠', memory_get: '🧠', save_memory: '🧠',
  browser: '🌐', browser_navigate: '🌐', navigate: '🌐',
  image: '🖼️', vision: '🖼️',
  skill: '📦', skill_view: '📦', skill_load: '📦',
  delegate: '🤖', spawn: '🤖', subagents: '🤖', agents_list: '🤖',
  todo: '✅', cron: '⏰', message: '💬',
  voice_call: '📞', canvas: '🎨', nodes: '📱', gateway: '⚙️',
  lcm_grep: '🔍', lcm_expand: '🔍', lcm_describe: '🔍', lcm_expand_query: '🔍',
  sessions_send: '📤', session_status: '📊', sessions_yield: '⏸️',
  tts: '🗣️',
}

export function getToolEmoji(name: string): string {
  if (TOOL_EMOJIS[name]) return TOOL_EMOJIS[name]
  if (name.includes('search')) return '🔍'
  if (name.includes('read') || name.includes('Read')) return '📖'
  if (name.includes('write') || name.includes('Write') || name.includes('edit')) return '✏️'
  if (name.includes('exec') || name.includes('terminal')) return '💻'
  if (name.includes('memory')) return '🧠'
  if (name.includes('browser')) return '🌐'
  if (name.includes('skill')) return '📦'
  return '⚡'
}

// ── Verb derivation ──────────────────────────────────────────────

export function getToolVerb(name: string): string {
  if (name.includes('search')) return 'Searching'
  if (name.includes('read') || name.includes('Read')) return 'Reading'
  if (name.includes('write') || name.includes('Write') || name.includes('edit')) return 'Writing'
  if (name.includes('exec') || name.includes('terminal')) return 'Executing'
  if (name.includes('memory')) return 'Remembering'
  if (name.includes('browser')) return 'Browsing'
  if (name.includes('skill')) return 'Loading skill'
  return 'Working'
}

// ── Display label formatting (message-item detail view) ──────────

export const TOOL_DISPLAY_LABELS: Record<string, string> = {
  browser_click: '🖱 Click Element',
  browser_type: '⌨ Type Text',
  browser_press: '⏎ Press Key',
  browser_scroll: '↕ Scroll',
  browser_back: '← Back',
  browser_get_images: '🖼 Get Images',
  browser_vision: '👁 Vision Capture',
  browser_close: '✕ Close Browser',
  execute_code: '🐍 Execute Code',
  process: '⚙ Process',
  'multi_tool_use.parallel': '⚡ Parallel Tools',
  todo: '☑ Todo',
  cronjob: '⏰ Cron Job',
  delegate_task: '👥 Delegate Task',
  mixture_of_agents: '🧠 Mixture of Agents',
  session_search: '🔍 Search Sessions',
  clarify: '❓ Clarify',
  skill_manage: '📦 Manage Skill',
  vision_analyze: '👁 Analyze Image',
  image_generate: '🎨 Generate Image',
  send_message: '💬 Send Message',
  text_to_speech: '🔊 Text to Speech',
  honcho_profile: '👤 Honcho Profile',
  honcho_search: '🔎 Honcho Search',
  honcho_context: '📋 Honcho Context',
  ha_list_entities: '🏠 HA Entities',
  ha_get_state: '🏠 HA State',
  ha_list_services: '🏠 HA Services',
  web_search: '🌐 Web Search',
  web_extract: '📄 Web Extract',
  browser_navigate: '🌐 Open Page',
  browser_snapshot: '📸 Snapshot',
}

function readStringArg(
  args: Record<string, unknown> | undefined,
  ...keys: Array<string>
): string | null {
  if (!args) return null
  for (const key of keys) {
    const value = args[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return null
}

function fileNameFromPath(value: string): string {
  const normalized = value.trim().replace(/[\\/]+$/, '')
  if (!normalized) return value.trim()
  const parts = normalized.split(/[\\/]/)
  return parts[parts.length - 1] || normalized
}

export function formatToolDisplayLabel(
  name: string,
  args?: Record<string, unknown>,
): string {
  const normalizedName = name.trim()
  const lowerName = normalizedName.toLowerCase()
  const mappedLabel = TOOL_DISPLAY_LABELS[lowerName]
  if (mappedLabel) return mappedLabel

  if (lowerName === 'read' || lowerName === 'read_file') {
    const filePath = readStringArg(args, 'file_path', 'path', 'target_file')
    return filePath ? `read ${fileNameFromPath(filePath)}` : 'read file'
  }

  if (lowerName === 'edit' || lowerName === 'patch_file') {
    const filePath = readStringArg(args, 'file_path', 'path', 'target_file')
    return filePath ? `edit ${fileNameFromPath(filePath)}` : 'edit file'
  }

  if (lowerName === 'write' || lowerName === 'write_file' || lowerName === 'create_file') {
    const filePath = readStringArg(args, 'file_path', 'path', 'target_file')
    return filePath ? `write ${fileNameFromPath(filePath)}` : 'write file'
  }

  if (lowerName === 'search_files') {
    const pattern = readStringArg(args, 'pattern', 'query', 'regex')
    return pattern ? `search "${pattern}"` : 'search files'
  }

  if (lowerName === 'browser' || lowerName === 'browser_navigate') {
    const action = readStringArg(args, 'action', 'url')
    return action ? `browser ${action}` : 'browser'
  }

  if (lowerName === 'terminal' || lowerName === 'exec') {
    const cmd = readStringArg(args, 'command', 'cmd')
    return cmd ? `exec ${cmd.length > 30 ? cmd.slice(0, 27) + '…' : cmd}` : 'exec'
  }

  if (lowerName === 'memory_search') return 'memory search'
  if (lowerName === 'save_memory') return 'save memory'
  if (lowerName === 'memory_get') return 'memory get'
  if (lowerName === 'web_fetch') return 'web fetch'
  if (lowerName === 'skill_view') return 'view skill'

  return lowerName.replace(/_/g, ' ')
}
