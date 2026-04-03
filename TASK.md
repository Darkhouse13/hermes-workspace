# Hermes Workspace — Task List

**Reference:** See `PLAN.md` for rationale, research, and implementation details.

---

## Legend

- `[ ]` — Not started
- `[~]` — In progress
- `[x]` — Complete
- `[!]` — Blocked

---

## P1 — Urgent

### T-001: Move misplaced dependencies to devDependencies
- [x] Remove `playwright`, `playwright-extra`, `puppeteer-extra-plugin-stealth` from dependencies
- [x] Re-add `playwright`, `playwright-extra`, `puppeteer-extra-plugin-stealth` as devDependencies
- [x] Remove `@types/react-grid-layout` entirely (unused)
- [x] Remove `ws` entirely (unused)
- [x] Run `pnpm install` and verify lockfile
- [x] Run `pnpm build` to confirm no breakage
- **Files:** `package.json`, `pnpm-lock.yaml`
- **Effort:** 10 minutes

### T-002: Add token expiration to auth middleware
- [x] Replace `Set<string>` with `Map<string, { createdAt: number; expiresAt: number }>`
- [x] Set TTL to 30 days (match cookie `Max-Age`)
- [x] Add cleanup interval (every 5 minutes, evict expired tokens)
- [x] Add `MAX_TOKENS = 10_000` cap; evict oldest on overflow
- [x] Update `isValidSessionToken()` to check expiration
- [x] Update `createSessionToken()` to store metadata
- [x] Add tests for token expiration in `auth-middleware.test.ts`
- [x] Add test for max-cap eviction behavior
- **Files:** `src/server/auth-middleware.ts`, `src/server/auth-middleware.test.ts`
- **Effort:** 1-2 hours

### T-003: Cap rate limiter memory
- [x] Add `MAX_TRACKED_KEYS = 100_000` constant to `rate-limit.ts`
- [x] Reject new keys when map is full (fail-closed)
- [x] Add test for cap behavior in `rate-limit.test.ts`
- **Files:** `src/server/rate-limit.ts`, `src/server/rate-limit.test.ts`
- **Effort:** 30 minutes

### T-004: Add timeout cleanup to event bus subscribers
- [x] Add `subscribedAt` timestamp to subscriber metadata
- [x] Add cleanup interval (every 60s, remove subscribers older than 25 hours)
- [x] Add optional max subscriber count (10,000)
- **Files:** `src/server/chat-event-bus.ts`
- **Effort:** 30 minutes

---

## P2 — Medium

### T-005: Create structured logger
- [x] Create `src/server/logger.ts` with `createLogger(module)` factory
- [x] Support 4 levels: `debug`, `info`, `warn`, `error`
- [x] Output JSON format: `{ level, module, message, timestamp, metadata? }`
- [x] Add `LOG_LEVEL` env var (default: `info` in prod, `debug` in dev)
- [x] Add to `.env.example`
- **Files:** `src/server/logger.ts` (new), `.env.example`
- **Effort:** 1 hour

### T-006: Fix top 10 silent catch blocks
- [x] `src/server/openai-compat-api.ts:28` — log `getDefaultModel()` network failure
- [x] `src/server/paperclip-projects.ts:152` — log directory read failure
- [x] `src/server/hermes-api.ts:328` — log stream parsing errors
- [x] `src/server/hermes-api.ts:181` — log which health check endpoint failed
- [x] `src/server/gateway-capabilities.ts:195` — log feature check exception (don't silently return `true`)
- [x] `src/server/memory-browser.ts:83` — log `readdir` failure
- [x] `src/server/paperclip-store.ts:52` — log JSON parse failure on config
- [x] `src/server/paperclip-continuity.ts:28` — log date parsing errors
- [x] `src/server/paperclip-missions.ts:85` — log mission fetch failure
- [x] `src/server/auth-middleware.ts:38` — add comment explaining intentional suppression
- **Depends on:** T-005 (structured logger)
- **Files:** 9 server files listed above
- **Effort:** 1-2 hours

### T-007: Replace console.log with structured logger
- [x] `src/server/gateway-capabilities.ts` — replace 5 console statements
- [x] `src/server/hermes-api.ts` — replace 1 console statement
- [x] `src/server/terminal-sessions.ts` — replace 1 console statement
- [x] `src/routes/api/terminal-stream.ts` — replace 1 console statement
- [x] `src/routes/api/auth.ts` — replace 1 console statement
- **Depends on:** T-005 (structured logger)
- **Files:** 5 files listed above
- **Effort:** 30 minutes

---

### Chat Decomposition — Phase A: Shared Utilities

### T-008: Extract chat content normalization utilities
- [x] Create `src/lib/chat-content-normalization.ts`
- [x] Move `stripFinalTags()` from `chat-store.ts` (~lines 199-228)
- [x] Move MIME type helpers from `chat-screen.tsx` (~lines 113-138)
- [x] Consolidate duplicate MIME helpers from `chat-composer.tsx` (~lines 330-354)
- [x] Update imports in `chat-store.ts`, `chat-screen.tsx`, `chat-composer.tsx`
- [x] Run tests, verify no regressions
- **Files:** `src/lib/chat-content-normalization.ts` (new), 3 source files
- **Effort:** 1-2 hours

### T-009: Extract chat tool label constants
- [x] Create `src/lib/chat-tool-labels.ts`
- [x] Move `TOOL_STATUS_MAP`, `TOOL_EMOJIS`, `getToolEmoji()`, `getToolVerb()` from `chat-message-list.tsx` (~lines 42-114)
- [x] Move `formatToolDisplayLabel()` from `message-item.tsx` (~lines 371-416)
- [x] Remove duplicate tool label logic from `message-item.tsx` if present
- [x] Update imports in `chat-message-list.tsx`, `message-item.tsx`
- **Files:** `src/lib/chat-tool-labels.ts` (new), 2 source files
- **Effort:** 1 hour

### T-010: Extract chat message identity helpers
- [x] Create `src/lib/chat-message-identity.ts`
- [x] Move `getMessageId()`, `getClientNonce()`, `messageMultipartSignature()` from `chat-store.ts` (~lines 295-476)
- [x] Move `getMessageEventTime()`, `getMessageReceiveTime()` from `chat-store.ts`
- [x] `getMessageTimestamp()` already exists in `utils.ts` — kept in place
- [x] Update imports in `chat-store.ts`
- **Files:** `src/lib/chat-message-identity.ts` (new), 3 source files
- **Effort:** 1-2 hours

---

### Chat Decomposition — Phase B: Hook Extraction

### T-011: Extract send message hook from chat-screen
- [x] Create `src/screens/chat/hooks/use-chat-send-message.ts`
- [x] Move the `sendMessage` callback from `chat-screen.tsx` (~150 lines)
- [x] Include message validation, attachment processing, API call, optimistic update
- [x] Export `{ sendMessage }` (state setters passed as deps since used elsewhere)
- [x] Update `chat-screen.tsx` to use the hook
- [ ] Smoke test: send a message, verify streaming works
- **Files:** `src/screens/chat/hooks/use-chat-send-message.ts` (new), `chat-screen.tsx`
- **Effort:** 2-3 hours

### T-012: Extract display messages hook from chat-screen
- [x] Create `src/screens/chat/hooks/use-chat-display-messages.ts`
- [x] Move finalDisplayMessages computation from `chat-screen.tsx` (~130 lines)
- [x] Include message filtering, external message detection, dedup
- [x] Moved 7 helper functions (dedup, signature, timestamp, etc.)
- [x] Export `{ displayMessages }`
- [x] Update `chat-screen.tsx`
- **Depends on:** T-010 (message identity helpers)
- **Files:** `src/screens/chat/hooks/use-chat-display-messages.ts` (new), `chat-screen.tsx`
- **Effort:** 1-2 hours

### T-013: Extract composer attachments hook
- [x] Create `src/screens/chat/hooks/use-composer-attachments.ts`
- [x] Move attachment state, drop handling, file reading, validation from `chat-composer.tsx` (~275 lines)
- [x] Include: file size limits, image resizing, MIME detection, data URL creation
- [x] Export `{ attachments, addAttachments, handleRemoveAttachment, clearAttachments, handleDrop, ... }`
- [x] Update `chat-composer.tsx`
- **Depends on:** T-008 (content normalization — MIME helpers)
- **Files:** `src/screens/chat/hooks/use-composer-attachments.ts` (new), `chat-composer.tsx`
- **Effort:** 2-3 hours

### T-014: Extract message streaming reveal hook
- [x] Create `src/screens/chat/hooks/use-message-streaming-reveal.ts`
- [x] Move word reveal animation logic from `message-item.tsx` (~lines 1104-1268, ~165 lines)
- [x] Include: `countWords`, `getWordBoundaryIndex`, tick interval, display text slicing
- [x] Export `{ displayText, effectiveIsStreaming, revealProgress }`
- [x] Update `message-item.tsx`
- **Files:** `src/screens/chat/hooks/use-message-streaming-reveal.ts` (new), `message-item.tsx`
- **Effort:** 1-2 hours

### T-015: Extract chat scroll behavior hook
- [x] Create `src/screens/chat/hooks/use-chat-scroll-behavior.ts`
- [x] Move scroll tracking + auto-scroll from `chat-message-list.tsx` (~lines 629-661, ~40 lines)
- [x] Include: `handleUserScroll`, `scrollToBottom`, `isNearBottom` ref tracking
- [x] Export `{ scrollRef, isNearBottom, scrollToBottom, handleScroll }`
- [x] Update `chat-message-list.tsx`
- **Files:** `src/screens/chat/hooks/use-chat-scroll-behavior.ts` (new), `chat-message-list.tsx`
- **Effort:** 1 hour

---

### Chat Decomposition — Phase C: Sub-Component Extraction

### T-016: Extract message tool section component
- [x] Create `src/screens/chat/components/message-tool-section.tsx`
- [x] Move `ToolCallCard` + `ThinkingBubble` from `chat-message-list.tsx`
- [x] Include tool status display, elapsed time counter, animation
- [x] Export `ToolCallCard` and `ThinkingBubble` components
- [x] Update `chat-message-list.tsx` to import from new file
- **Depends on:** T-009 (tool labels)
- **Files:** `src/screens/chat/components/message-tool-section.tsx` (new), `message-item.tsx`
- **Effort:** 1-2 hours

### T-017: Extract message attachments component
- [x] Create `src/screens/chat/components/message-attachments.tsx`
- [x] Move attachment + inline image rendering from `message-item.tsx`
- [x] Include: image lazy loading, markdown attachment decoding, file links
- [x] Define props: `attachments: ChatAttachment[]`, `inlineImages?: ImagePart[]`
- [x] Update `message-item.tsx`
- **Files:** `src/screens/chat/components/message-attachments.tsx` (new), `message-item.tsx`
- **Effort:** 1 hour

---

### Chat Decomposition — Phase D: Store Decomposition

### T-018: Extract message dedup logic from chat-store
- [x] Create `src/lib/chat-message-dedup.ts`
- [x] Move 7-factor dedup algorithm from `chat-store.ts` (~lines 508-704, ~200 lines)
- [x] Move optimistic message matching, ID-based dedup, external inbound dedup
- [x] Export dedup functions: `findDuplicateIndex`, `findOptimisticIndex`, `mergeOptimisticMessage`, etc.
- [x] Update `chat-store.ts` to use extracted module
- [x] Add unit tests for dedup edge cases (52 tests in `chat-message-dedup.test.ts`)
- **Depends on:** T-010 (message identity helpers)
- **Files:** `src/lib/chat-message-dedup.ts` (new), `chat-store.ts`
- **Effort:** 2-3 hours

### T-019: Extract streaming assembly from chat-store
- [x] Create `src/lib/chat-streaming-assembly.ts`
- [x] Move final message building from streaming state
- [x] Move final message dedup vs streaming logic (done in T-018)
- [x] Export `{ assembleStreamingMessage, finalizeStreamingMessage }`
- [x] Update `chat-store.ts`
- **Files:** `src/lib/chat-streaming-assembly.ts` (new), `chat-store.ts`
- **Effort:** 1-2 hours

---

### Type Safety

### T-020: Extend ChatMessage type with all used properties
- [x] Add `attachments?: ChatAttachment[]` to ChatMessage
- [x] Add `inlineImages?: Array<{ type: string; source: { data: string; media_type: string } }>`
- [x] Add `__optimisticId?: string`
- [x] Add `__streamToolCalls?: StreamToolCall[]`
- [x] Add `__streamingStatus?: StreamingStatus`
- [x] Add `__execNotification?: ExecNotification`
- [x] Add `__isNarration?: boolean`
- [x] Add `__historyIndex?: number`
- [x] Add `__realtimeSequence?: number`
- [x] Add `StreamToolCall` and `ExecNotification` shared types to types.ts
- [x] Add `__receiveTime`, `__realtimeSource`, `status`, `clientId`, `client_id`, `clientNonce`, `nonce`, `streamToolCalls` properties
- [x] Update `StreamingState.toolCalls` to use `StreamToolCall[]`
- [x] Remove duplicate type definitions from message-item.tsx and use-chat-history.ts
- [x] Run `pnpm typecheck` — fix any new errors from stricter types
- **Files:** `src/screens/chat/types.ts`, `src/screens/chat/components/message-item.tsx`, `src/screens/chat/hooks/use-chat-history.ts`, `src/stores/chat-store.ts`, `src/lib/chat-streaming-assembly.ts`, `src/screens/chat/hooks/use-streaming-message.ts`
- **Effort:** 1-2 hours

### T-021: Replace `any` in chat-store.ts with proper types
- [x] Replace `(part as any).text` with type-narrowed `part.text` (TextContent)
- [x] Replace `(event as any).source` with discriminated union narrowing via `event.type === 'user_message'`
- [x] Add `result?: string` to tool event type; replace `(event as any).result` with `event.result`
- [x] Eliminate remaining `as any` casts (achieved: 0 in this file)
- [x] Run `pnpm typecheck`
- **Depends on:** T-020 (extended ChatMessage type)
- **Files:** `src/stores/chat-store.ts`
- **Effort:** 2-3 hours

### T-022: Replace `any` in chat-message-list.tsx
- [x] Replace `(message as any).streamToolCalls` and `__streamToolCalls` with typed access
- [x] Replace `__historyIndex`, `__realtimeSequence` with typed properties
- [x] Replace message ID accessor chain with direct typed property access
- [x] Replace timestamp accessor chain with direct property access via index signature
- [x] Replace `attachments`, `inlineImages`, `__optimisticId` with typed access
- [x] Eliminate remaining `as any` casts (achieved: 0 in this file)
- **Depends on:** T-010 (identity helpers), T-020 (extended types)
- **Files:** `src/screens/chat/components/chat-message-list.tsx`
- **Effort:** 1-2 hours

### T-023: Replace `any` in message-item.tsx
- [x] Replace timestamp extraction with direct typed property access
- [x] Replace `__execNotification` with typed `message.__execNotification`
- [x] Replace `__isNarration` with typed `message.__isNarration`
- [x] Replace `__streamToolCalls` with typed `message.__streamToolCalls`
- [x] Replace `(toolMessage as any).id` with `toolMessage.id` via index signature
- [x] Eliminate remaining `as any` casts (achieved: 0 in this file)
- **Depends on:** T-010, T-020
- **Files:** `src/screens/chat/components/message-item.tsx`
- **Effort:** 1-2 hours

### T-024: Replace `any` in usage-meter.tsx with proper types
- [x] Replace `(data as any)` in `normalizeModelUsage()` object branch with `Record<string, unknown>`
- [x] Replace `(payload as any)` in `parseSessionStatus()` with typed `Record<string, unknown>`
- [x] Add `asRec()` helper to safely cast intermediate objects
- [x] Eliminate all 13 `as any` casts (achieved: 0 in this file)
- **Files:** `src/components/usage-meter/usage-meter.tsx`
- **Effort:** 1-2 hours

### T-025: Replace `any` in chat-screen.tsx
- [x] Replace `__streamingStatus`, `__optimisticId`, `.id` with typed ChatMessage access
- [x] Replace `historyQuery.data as any` with typed `{ messages?: Array<ChatMessage> }` cast
- [x] Replace `cached as any` with typed cast for query cache data
- [x] Replace `message: any` parameter with `message: ChatMessage`
- [x] Remove unnecessary `as any` on model suggestions message array
- [x] Eliminate remaining `as any` casts (achieved: 0 in this file)
- [x] Run `pnpm typecheck`
- **Depends on:** T-010, T-020
- **Files:** `src/screens/chat/chat-screen.tsx`
- **Effort:** 1 hour

---

### Infrastructure

### T-026: Extract process management from vite.config.ts
- [x] Create `src/server/process-manager.ts`
- [x] Move `resolveHermesAgentDir()`, `resolveHermesPython()` (vite.config.ts lines 26-56)
- [x] Move `startHermesAgent()`, `isHermesAgentHealthy()` (lines 59-149)
- [x] Move `startWorkspaceDaemon()`, `stopWorkspaceDaemon()`, `restartWorkspaceDaemon()` (lines 151-307)
- [x] Move `isPortInUse()`, `hasHealthyWorkspaceDaemon()` (lines 317-339)
- [x] Export `processState` container for process refs and started flags
- [x] Add `stopHermesAgent()`, `shutdownWorkspaceDaemon()`, `autoStartWorkspaceDaemon()` helpers
- [x] Update `vite.config.ts` to import from process-manager
- [x] Run `pnpm typecheck` — no new errors
- [ ] Verify `pnpm dev` starts correctly (full smoke test)
- **Files:** `src/server/process-manager.ts` (new), `vite.config.ts`
- **Effort:** 3-4 hours

---

## P3 — Light (Backlog)

### T-027: Decompose providers-screen.tsx
- [x] Extract `src/screens/settings/components/provider-card.tsx` (~193 lines)
- [x] Extract `src/screens/settings/components/active-model-config.tsx` (~477 lines)
- [x] Extract `src/screens/settings/provider-settings.ts` — settings definitions (~175 lines)
- [x] Extract `src/screens/settings/provider-api.ts` — fetch + normalization (~331 lines)
- [x] Update `providers-screen.tsx` to orchestrate (595 lines, down from 1,646)
- **Files:** `src/screens/settings/providers-screen.tsx` + 4 new files
- **Effort:** 4-6 hours

### T-028: Decompose files-screen.tsx
- [x] Extract `src/screens/files/components/file-tree.tsx` (~119 lines)
- [x] Extract `src/screens/files/components/markdown-preview.ts` (~183 lines)
- [x] Extract `src/screens/files/components/file-context-menu.tsx` (~160 lines)
- [x] Extract `src/screens/files/file-utils.ts` (~116 lines)
- [x] Update `files-screen.tsx` to orchestrate (744 lines, down from 1,295)
- **Files:** `src/screens/files/files-screen.tsx` + 4 new files
- **Effort:** 3-4 hours

### T-029: Add frontend unit tests for extracted modules
- [x] Test `lib/chat-message-dedup.ts` — dedup algorithm edge cases (already existed: 80+ tests)
- [x] Test `lib/chat-message-identity.ts` — ID extraction, timestamp resolution (52 tests)
- [x] Test `lib/chat-content-normalization.ts` — tag stripping, MIME helpers (68 tests)
- [x] Test `lib/chat-tool-labels.ts` — tool label formatting (53 tests)
- [x] Test `lib/chat-streaming-assembly.ts` — streaming assembly (21 tests)
- [x] Extend `vitest.config.ts` coverage scope to include `src/lib/chat-*.ts`
- **Depends on:** T-008 through T-019 (extraction tasks)
- **Files:** 4 new test files, `vitest.config.ts`
- **Effort:** 2-3 days

### T-030: Configure Playwright E2E test suite
- [x] Create `playwright.config.ts`
- [x] Create `e2e/` directory
- [x] Write smoke test: app loads and renders dashboard
- [x] Write smoke test: chat sends message (mock backend)
- [x] Write smoke test: session creation and navigation
- [x] Write smoke test: file browser renders tree
- [x] Write smoke test: settings page loads
- [x] Add E2E job to `.github/workflows/ci.yml` (separate, non-blocking)
- **Depends on:** T-001 (Playwright in devDependencies)
- **Files:** `playwright.config.ts` (new), `e2e/*.spec.ts` (new), `.github/workflows/ci.yml`
- **Effort:** 2-3 days

### T-031: Consolidate markdown rendering pipeline
- [x] Evaluate replacing `marked.lexer()` with remark plugins in `prompt-kit/markdown.tsx`
- [x] ~~If feasible: remove `marked` from dependencies~~ (not feasible — see comment in file)
- [x] If not: document why both are needed (comment in markdown.tsx)
- **Files:** `src/components/prompt-kit/markdown.tsx`, `package.json`
- **Effort:** 4-6 hours

### T-032: Clean up remaining `any` types outside chat
- [x] `usage-meter-compact.tsx` — already clean (0 `any`)
- [x] `hooks/use-voice-input.ts` — replaced 4 `any` with proper Web Speech API interfaces
- [x] `hooks/use-chat-stream.ts` — replaced 3 `any` with specific callback signatures
- [x] `paperclip` API routes — replaced ~15 `as any` across 7 files with proper type unions
- [x] `stores/paperclip-store.ts` — replaced 2 `any` (LaunchRoleRequest + Zustand setter type)
- [x] Target: <20 manual `any` usages outside chat (9 remaining, excluding generated files)
- **Files:** ~12 files
- **Effort:** 1-2 days

### T-033: Decompose remaining 1K+ line files
- [x] `components/onboarding/hermes-onboarding.tsx` (1,107 → 602 lines) — extracted 5 step components
- [x] `screens/skills/skills-screen.tsx` (1,011 → 483 lines) — extracted 5 component files
- [x] `routes/settings/index.tsx` (982 → 366 lines) — extracted 4 component files
- **Files:** 3 source files + 14 new component files
- **Effort:** 1 day

---

## Dependency Graph

```
T-001 (deps) ──────────────────────────────────────── T-030 (E2E)
T-002 (auth tokens) ─┐
T-003 (rate limit)   ├─ standalone
T-004 (event bus)   ─┘
T-005 (logger) ──────── T-006 (silent catches) + T-007 (replace console)
T-008 (normalization) ── T-013 (attachments hook)
T-009 (tool labels) ──── T-016 (tool section component)
T-010 (identity) ──────── T-012 (display messages) + T-018 (dedup) + T-022 + T-023 + T-025
T-020 (extend types) ──── T-021 + T-022 + T-023 + T-025
T-008..T-019 (extraction) ── T-029 (frontend tests)
```

---

## Summary

| Priority | Tasks | Estimated Effort |
|----------|-------|-----------------|
| P1 Urgent | T-001 through T-004 | ~3 hours |
| P2 Medium (logging) | T-005 through T-007 | ~3 hours |
| P2 Medium (chat decomp) | T-008 through T-019 | ~3 days |
| P2 Medium (type safety) | T-020 through T-025 | ~2 days |
| P2 Medium (infrastructure) | T-026 | ~4 hours |
| P3 Light | T-027 through T-033 | ~5-7 days |
| **Total** | **33 tasks** | **~3 weeks** |
