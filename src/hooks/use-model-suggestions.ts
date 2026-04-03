/**
 * Phase 4.1: Smart Model Suggestions
 *
 * Client-side heuristics to suggest cheaper/better models
 * Opt-in only (requires settings toggle)
 */

type Suggestion = {
  currentModel: string
  suggestedModel: string
  reason: string
  costImpact?: string
}

type Message = {
  role: string
  content: string
  [key: string]: unknown
}

const _AUTO_DISMISS_MS = 15 * 1000 // 15 seconds

export function useModelSuggestions(_opts: {
  currentModel: string
  sessionKey: string
  messages: Array<Message>
  availableModels: Array<string>
}) {
  // DISABLED: was causing infinite re-render loop (Maximum update depth exceeded)
  // TODO: fix the dependency array / memoization and re-enable
  return {
    suggestion: null as Suggestion | null,
    dismiss: () => {},
    dismissForSession: () => {},
  }
}

// Preserve for future auto-dismiss feature
void _AUTO_DISMISS_MS
