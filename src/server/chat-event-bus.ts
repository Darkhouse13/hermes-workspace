import { hasActiveSendRun } from './send-run-tracker'

export interface ChatSSEEvent {
  event: string
  data: Record<string, unknown>
}

type ChatSSESubscriber = (event: ChatSSEEvent) => void

// ─── Singleton state (survives Vite HMR via globalThis) ─────────────────

const BUS_KEY = '__hermes_chat_event_bus__' as const
const MAX_SUBSCRIBERS = 10_000
const SUBSCRIBER_TTL_MS = 25 * 60 * 60 * 1000 // 25 hours
const CLEANUP_INTERVAL_MS = 60 * 1000 // 60 seconds

interface SubscriberMeta {
  subscribedAt: number
}

interface BusState {
  subscribers: Map<ChatSSESubscriber, SubscriberMeta>
  started: boolean
  cleanupInterval?: ReturnType<typeof setInterval>
}

function getBus(): BusState {
  if (!(globalThis as any)[BUS_KEY]) {
    const bus: BusState = {
      subscribers: new Map<ChatSSESubscriber, SubscriberMeta>(),
      started: false,
    }
    // Periodic cleanup of stale subscribers
    bus.cleanupInterval = setInterval(() => {
      const now = Date.now()
      for (const [sub, meta] of bus.subscribers) {
        if (now - meta.subscribedAt > SUBSCRIBER_TTL_MS) {
          bus.subscribers.delete(sub)
        }
      }
    }, CLEANUP_INTERVAL_MS)
    if (typeof bus.cleanupInterval.unref === 'function') {
      bus.cleanupInterval.unref()
    }
    ;(globalThis as any)[BUS_KEY] = bus
  }
  return (globalThis as any)[BUS_KEY]
}

function broadcast(event: string, data: Record<string, unknown>): void {
  const bus = getBus()
  const evt: ChatSSEEvent = { event, data }
  for (const sub of bus.subscribers.keys()) {
    try {
      sub(evt)
    } catch {
      // subscriber error — don't crash the bus
    }
  }
}

export function publishChatEvent(event: string, data: Record<string, unknown>): void {
  const runId = typeof data.runId === 'string' ? data.runId : undefined
  if (hasActiveSendRun(runId)) return
  broadcast(event, data)
}

export function ensureBusStarted(): void {
  const bus = getBus()
  if (bus.started) return
  bus.started = true
}

export function subscribeToChatEvents(
  subscriber: ChatSSESubscriber,
  sessionKeyFilter?: string,
): () => void {
  const bus = getBus()

  // Wrap subscriber with session key filter if provided
  const wrappedSubscriber: ChatSSESubscriber = sessionKeyFilter
    ? (event) => {
        const eventSessionKey = event.data.sessionKey as string | undefined
        if (eventSessionKey && eventSessionKey !== sessionKeyFilter) return
        const runId = typeof event.data.runId === 'string' ? event.data.runId : undefined
        if (hasActiveSendRun(runId)) return
        subscriber(event)
      }
    : (event) => {
        const runId = typeof event.data.runId === 'string' ? event.data.runId : undefined
        if (hasActiveSendRun(runId)) return
        subscriber(event)
      }

  // Enforce max subscriber cap
  if (bus.subscribers.size >= MAX_SUBSCRIBERS) {
    // Evict the oldest subscriber
    let oldestSub: ChatSSESubscriber | null = null
    let oldestTime = Infinity
    for (const [sub, meta] of bus.subscribers) {
      if (meta.subscribedAt < oldestTime) {
        oldestTime = meta.subscribedAt
        oldestSub = sub
      }
    }
    if (oldestSub) bus.subscribers.delete(oldestSub)
  }

  bus.subscribers.set(wrappedSubscriber, { subscribedAt: Date.now() })
  return () => {
    bus.subscribers.delete(wrappedSubscriber)
  }
}
