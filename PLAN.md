# Hermes Workspace — Refactoring Plan

**Date:** 2026-04-03
**Codebase:** ~62K lines, 336 files, v0.1.0
**Status:** Past prototype, approaching production readiness

---

## Priority 1 — Urgent (Do Now)

These are blocking issues for production deployment or carry outsized risk relative to fix effort.

### 1.1 Move Misplaced Dependencies to devDependencies

**Problem:** 4 packages are in production `dependencies` that don't belong there. `playwright`, `playwright-extra`, and `puppeteer-extra-plugin-stealth` add ~100MB+ to the production install. `@types/react-grid-layout` is a type-only package. None of these are imported anywhere in `src/`.

**Evidence:** Grep for `playwright`, `puppeteer-extra-plugin-stealth`, `react-grid-layout` across `src/` returns zero results. Also `ws` has no imports.

**Fix:**
```bash
pnpm remove playwright playwright-extra puppeteer-extra-plugin-stealth @types/react-grid-layout ws
pnpm add -D playwright playwright-extra puppeteer-extra-plugin-stealth
# @types/react-grid-layout and ws can be dropped entirely — unused
```

**Effort:** 10 minutes
**Risk:** None — these packages are not imported

---

### 1.2 Add Token Expiration to In-Memory Auth

**Problem:** `src/server/auth-middleware.ts` stores session tokens in a `Set<string>` with no TTL, no persistence, no max-size cap. Server restart = all users logged out. Under sustained traffic, the Set grows unbounded.

**Fix:**
1. Replace `Set<string>` with `Map<string, { createdAt: number; expiresAt: number }>`.
2. Add a cleanup interval (every 5 minutes, evict expired tokens).
3. Add a max-size cap (e.g., 10,000 tokens). Evict oldest on overflow.
4. Set token TTL to match the existing cookie `Max-Age` of 30 days.
5. Add existing tests for the new expiration behavior.

**Location:** `src/server/auth-middleware.ts` (70 lines)
**Tests:** `src/server/auth-middleware.test.ts` (201 lines) — extend with TTL tests

**Effort:** 1-2 hours
**Risk:** Low — existing tests cover the auth flow; extend them

---

### 1.3 Cap Rate Limiter Memory

**Problem:** `src/server/rate-limit.ts` uses an unbounded `Map<string, { timestamps: number[] }>`. An attacker can create entries for unlimited unique IPs, growing the Map without bound. The existing 5-minute cleanup only removes stale *entries*, not keys created during the current window.

**Fix:**
1. Add `MAX_TRACKED_KEYS = 100_000` constant.
2. Reject requests from new keys when the map is full (fail-closed).
3. Add test for the cap behavior.

**Location:** `src/server/rate-limit.ts` (94 lines)
**Tests:** `src/server/rate-limit.test.ts` (152 lines) — extend

**Effort:** 30 minutes
**Risk:** Very low

---

### 1.4 Add Timeout Cleanup to Event Bus Subscribers

**Problem:** `src/server/chat-event-bus.ts` stores SSE subscribers in a `Set` with no timeout. If a client disconnects uncleanly (network drop, browser crash), the subscriber callback remains in memory forever.

**Fix:**
1. Track `subscribedAt` timestamp per subscriber.
2. Add a cleanup interval (every 60 seconds, remove subscribers older than 25 hours).
3. Optional: add a max subscriber count (e.g., 10,000).

**Location:** `src/server/chat-event-bus.ts` (79 lines)

**Effort:** 30 minutes
**Risk:** Low

---

## Priority 2 — Medium (Next Sprint)

These improve maintainability and developer velocity. They compound if left unaddressed.

### 2.1 Break Up Chat Mega-Files

**Problem:** 6 files in the chat subsystem total 10,905 lines. `chat-screen.tsx` alone (2,507 lines) is larger than all 7 server modules combined. At this scale, components are hard to reason about, review, test, and safely modify.

**The 14 files over 1,000 lines (not just 6):**

| File | Lines | Priority |
|------|-------|----------|
| `screens/chat/chat-screen.tsx` | 2,507 | Critical |
| `screens/chat/components/chat-composer.tsx` | 2,187 | Critical |
| `screens/chat/components/message-item.tsx` | 1,959 | Critical |
| `screens/chat/components/chat-message-list.tsx` | 1,900 | Critical |
| `lib/workspace-checkpoints.ts` | ~1,900 | Medium |
| `screens/settings/providers-screen.tsx` | 1,646 | Medium |
| `routeTree.gen.ts` | 1,474 | Skip (generated) |
| `screens/files/files-screen.tsx` | 1,294 | Medium |
| `screens/chat/components/chat-sidebar.tsx` | 1,201 | High |
| `stores/chat-store.ts` | 1,151 | Critical |
| `components/onboarding/hermes-onboarding.tsx` | 1,107 | Low |
| `screens/skills/skills-screen.tsx` | 1,011 | Low |
| `routes/settings/index.tsx` | 982 | Low |

**Strategy — Extract in layers, bottom-up:**

**Phase A: Shared Utilities (no dependencies, safe to extract first)**
1. `lib/chat-content-normalization.ts` — tag stripping, MIME type helpers (from chat-screen + chat-composer, ~90 lines). Consolidates duplicated MIME logic.
2. `lib/chat-tool-labels.ts` — `TOOL_STATUS_MAP`, `TOOL_EMOJIS`, `getToolEmoji()`, `formatToolDisplayLabel()` (from chat-message-list + message-item, ~75 lines). Currently duplicated.
3. `lib/chat-message-identity.ts` — `getMessageId()`, `getMessageTimestamp()`, `getClientNonce()`, `messageMultipartSignature()` (from chat-store, ~100 lines). Used by dedup, sorting, and display logic.

**Phase B: Hooks (extract business logic from components)**
4. `screens/chat/hooks/use-chat-send-message.ts` — the sendMessage pipeline from chat-screen (~270 lines). Contains message validation, attachment processing, API call, optimistic update.
5. `screens/chat/hooks/use-chat-display-messages.ts` — message filtering + dedup from chat-screen (~130 lines).
6. `screens/chat/hooks/use-composer-attachments.ts` — attachment state, drop handling, file reading from chat-composer (~275 lines).
7. `screens/chat/hooks/use-message-streaming-reveal.ts` — word reveal animation from message-item (~165 lines).
8. `screens/chat/hooks/use-chat-scroll-behavior.ts` — scroll tracking + auto-scroll from chat-message-list (~40 lines).

**Phase C: Sub-components (extract rendering)**
9. `screens/chat/components/message-tool-section.tsx` — ToolCallCard + ThinkingBubble from message-item (~200 lines).
10. `screens/chat/components/message-attachments.tsx` — attachment + inline image rendering from message-item (~80 lines).

**Phase D: Store decomposition**
11. `lib/chat-message-dedup.ts` — dedup + merge logic from chat-store (~200 lines). The 7-factor dedup algorithm is the most complex code in the repo.
12. `lib/chat-streaming-assembly.ts` — final message building from streaming state (~130 lines).

**Expected result:**
- `chat-screen.tsx`: 2,507 → ~1,200 lines
- `chat-composer.tsx`: 2,187 → ~1,300 lines
- `message-item.tsx`: 1,959 → ~1,200 lines
- `chat-message-list.tsx`: 1,900 → ~1,100 lines
- `chat-store.ts`: 1,151 → ~750 lines
- 12 new focused modules, each 40-275 lines, each independently testable

**Effort:** 3-5 days
**Risk:** Medium — refactoring live UI. Mitigate by extracting utilities/hooks first (no JSX changes), then components. Run the full test suite + manual smoke after each phase.

---

### 2.2 Eliminate `any` Types in Chat Subsystem

**Problem:** 165 manual `any` usages (excluding generated code). The chat subsystem accounts for ~100 of these. The root cause is that `ChatMessage` and `ChatStreamEvent` types don't include all the properties that code actually accesses (e.g., `attachments`, `__optimisticId`, `__streamToolCalls`, `__execNotification`, `__isNarration`).

**Top offenders:**

| File | Count | Root Cause |
|------|-------|-----------|
| `chat-store.ts` | 32 | Missing fields on ChatMessage, event types |
| `chat-message-list.tsx` | 27 | Same + timestamp variant access |
| `message-item.tsx` | 16 | Content block union types, metadata fields |
| `chat-screen.tsx` | 15 | Same patterns |
| `usage-meter.tsx` | 10 | Polymorphic API response shapes |
| `use-chat-history.ts` | 8 | Cached query type narrowing |

**Strategy:**

**Step 1: Extend `ChatMessage` type** (in `src/screens/chat/types.ts`)
Add all actually-used optional properties:
```typescript
interface ChatMessage {
  // existing fields...
  attachments?: ChatAttachment[]
  inlineImages?: Array<{ type: string; source: { data: string; media_type: string } }>
  __optimisticId?: string
  __streamToolCalls?: StreamToolCall[]
  __streamingStatus?: 'streaming' | 'complete'
  __execNotification?: { text: string; emoji?: string }
  __isNarration?: boolean
  __historyIndex?: number
  __realtimeSequence?: number
}
```

**Step 2: Create helper functions** (in `lib/chat-message-identity.ts`)
```typescript
export function getMessageId(msg: ChatMessage): string { /* ordered lookup */ }
export function getMessageTimestamp(msg: ChatMessage): number { /* ordered lookup */ }
```

**Step 3: Add typed event discriminators** (in `chat-store.ts` types)
Replace `(event as any).source` with proper discriminated union types.

**Step 4: Add Zod schema for usage-meter API responses**
Replace `(data as any).inputTokens ?? (data as any).input_tokens` with a validated union type.

**Effort:** 2-3 days
**Risk:** Low — type changes are compile-time only. No runtime behavior change. TypeScript compiler catches regressions.

---

### 2.3 Add Structured Logging to Server Code

**Problem:** 7 `console.log/warn/error` in `src/server/`, 2 in `src/routes/api/`. No log levels, no timestamps, no request correlation. Multi-daemon debugging requires structured output.

**Fix:**
1. Create `src/server/logger.ts` (~50 lines):
   ```typescript
   type LogLevel = 'debug' | 'info' | 'warn' | 'error'
   export function createLogger(module: string) {
     return {
       info: (msg: string, meta?: Record<string, unknown>) => emit('info', module, msg, meta),
       warn: (msg: string, meta?: Record<string, unknown>) => emit('warn', module, msg, meta),
       error: (msg: string, meta?: Record<string, unknown>) => emit('error', module, msg, meta),
       debug: (msg: string, meta?: Record<string, unknown>) => emit('debug', module, msg, meta),
     }
   }
   ```
2. Replace 9 console statements with logger calls.
3. Add `LOG_LEVEL` env var support (default: `info` in prod, `debug` in dev).

**Effort:** 2-3 hours
**Risk:** Very low — purely additive

---

### 2.4 Fix Silent Catch Blocks (Top 10)

**Problem:** 74 `.catch()` patterns across `src/`. Most are fine (`.text().catch(() => '')` is reasonable), but 10 swallow meaningful errors that would help debugging.

**Worst offenders to fix:**

| File | Line | Issue |
|------|------|-------|
| `openai-compat-api.ts` | 28 | `getDefaultModel()` silently returns `'default'` on network failure — breaks model selection |
| `paperclip-projects.ts` | 152 | Directory read failure silently returns 0 counts — masks file system issues |
| `hermes-api.ts` | 328 | Stream parsing error silently discards malformed JSON chunks |
| `hermes-api.ts` | 181 | Gateway health check failure returns `false` without logging which endpoint failed |
| `gateway-capabilities.ts` | 195 | Feature check silently returns `true` on exception — assumes feature exists |
| `memory-browser.ts` | 83 | `readdir` failure silently returns `[]` — masks permission/disk issues |
| `paperclip-store.ts` | 52 | JSON parse failure on config files returns `undefined` silently |
| `paperclip-continuity.ts` | 28 | Date parsing error silently returns empty array |
| `paperclip-missions.ts` | 85 | Mission fetch failure returns empty array — misleading empty state |
| `auth-middleware.ts` | 38 | `timingSafeEqual` catch returns `false` — intentional but unlabeled |

**Fix:** Replace each with `catch((err) => { logger.debug('context', { error: err }); return default; })`. Depends on 2.3 (structured logging) being done first.

**Effort:** 1-2 hours (after logger exists)
**Risk:** Very low — adds logging, preserves existing fallback behavior

---

### 2.5 Extract Process Management from vite.config.ts

**Problem:** `vite.config.ts` is 600 lines. ~290 lines (48%) are daemon lifecycle management (Hermes agent auto-start: lines 17-149, workspace daemon: lines 151-307). Build config files shouldn't own process orchestration. This makes the dev server startup hard to understand and impossible to test.

**Fix:**
1. Create `src/server/process-manager.ts` (~200 lines):
   - `resolveHermesAgentDir()`, `resolveHermesPython()`, `startHermesAgent()` — from vite.config.ts lines 26-149
   - `startWorkspaceDaemon()`, `stopWorkspaceDaemon()`, `restartWorkspaceDaemon()` — from lines 168-307
   - `isPortInUse()`, health check helpers — from lines 317-339
2. Export state container (started flags, child process refs).
3. Keep Vite plugin integration (middleware, proxy) in vite.config.ts — only ~310 lines remain.
4. Add unit tests for process resolution logic (path fallbacks, health checks).

**Effort:** 3-4 hours
**Risk:** Medium — the dev server startup is sensitive. Test thoroughly.

---

## Priority 3 — Light (Backlog)

These are genuine improvements but low urgency. Schedule when there's bandwidth.

### 3.1 Decompose Non-Chat Large Files

**Problem:** 5 non-chat files are over 1,000 lines and will become harder to maintain as features grow.

| File | Lines | Decomposition Target |
|------|-------|---------------------|
| `providers-screen.tsx` | 1,646 | Extract `<ProviderCard>`, `<ActiveModelConfig>`, settings definitions, API helpers. Target: ~500 lines. |
| `files-screen.tsx` | 1,294 | Extract `<FileTree>`, `<MarkdownPreview>`, `<FileContextMenu>`, file utilities. Target: ~400 lines. |
| `hermes-onboarding.tsx` | 1,107 | Extract step components. Target: ~400 lines. |
| `skills-screen.tsx` | 1,011 | Extract skill cards, registry logic. Target: ~500 lines. |
| `routes/settings/index.tsx` | 982 | Extract tab panels. Target: ~400 lines. |

**Effort:** 1-2 days total
**Risk:** Low

---

### 3.2 Add Frontend Component Tests

**Problem:** 119 tests exist, but 117 are server-side. The 10,905-line chat subsystem has zero test coverage. The 2 frontend tests are trivial (28 lines combined).

**Strategy:**
1. After the chat decomposition (2.1), the extracted hooks and utilities become independently testable.
2. Priority test targets:
   - `lib/chat-message-dedup.ts` — dedup algorithm (the most complex logic in the codebase)
   - `lib/chat-message-identity.ts` — ID extraction, timestamp resolution
   - `hooks/use-chat-send-message.ts` — message validation, attachment processing
   - `hooks/use-composer-attachments.ts` — file type validation, size limits
3. Extend `vitest.config.ts` coverage scope to include extracted `lib/chat-*.ts` files.

**Effort:** 2-3 days
**Risk:** Low — pure additions

---

### 3.3 Add E2E Test Suite

**Problem:** No integration tests. The multi-daemon architecture (WebSocket/SSE streaming, daemon spawning, chat-to-backend flow) is where the hardest bugs hide. `scripts/dashboard-smoke.mjs` exists but isn't wired into CI.

**Strategy:**
1. Configure Playwright (already in deps) with a `playwright.config.ts`.
2. Start with 3-5 smoke tests:
   - App loads and renders dashboard
   - Chat sends a message and receives a response (mock backend)
   - Session creation and navigation
   - File browser renders file tree
   - Settings page loads providers
3. Add to CI as a separate job (don't block the fast path).

**Effort:** 2-3 days
**Risk:** Medium — requires mock backend or test fixture setup

---

### 3.4 Consolidate Markdown Rendering

**Problem:** Both `marked` (tokenizer) and `react-markdown` + `remark-gfm` (React renderer) are in deps. Both are used in `src/components/prompt-kit/markdown.tsx` — `marked.lexer()` for block tokenization, `ReactMarkdown` for rendering.

**Assessment:** This is intentional — marked handles parsing to identify code blocks for Shiki highlighting, react-markdown handles React rendering. Not truly redundant. **Lower priority than initially assessed.**

**If consolidating:** Replace `marked.lexer()` usage with `remark` plugins (already in the pipeline). This removes one dependency.

**Effort:** 4-6 hours
**Risk:** Medium — markdown rendering is user-facing and subtle

---

### 3.5 Clean Up Remaining `any` Types Outside Chat

**Problem:** ~65 `any` usages remain outside the chat subsystem (excluding 65 in generated `routeTree.gen.ts`).

**Key targets:**
- `types/recharts.d.ts` (11) — type augmentation, acceptable
- `usage-meter.tsx` (10) — needs Zod schema for API responses
- `hooks/use-voice-input.ts` (3) — Web Speech API types
- `hooks/use-chat-stream.ts` (3) — SSE event parsing
- `paperclip` API routes (15 total across 7 files) — request/response typing

**Effort:** 1-2 days
**Risk:** Low

---

## Execution Order

```
Week 1 (Urgent)
  Day 1: 1.1 (deps), 1.2 (auth tokens), 1.3 (rate limiter), 1.4 (event bus)
  Day 2: 2.3 (structured logger), 2.4 (silent catches)

Week 2 (Chat decomposition)
  Day 1: 2.1 Phase A — shared utilities
  Day 2: 2.1 Phase B — hooks extraction
  Day 3: 2.1 Phase C — sub-components
  Day 4: 2.1 Phase D — store decomposition
  Day 5: 2.2 — type safety (ChatMessage extension + helpers)

Week 3 (Infrastructure)
  Day 1-2: 2.5 (vite.config extraction)
  Day 3-5: 3.2 (frontend tests for newly extracted modules)

Week 4+ (Backlog)
  3.1 (non-chat large files)
  3.3 (E2E tests)
  3.4 (markdown consolidation)
  3.5 (remaining any types)
```
