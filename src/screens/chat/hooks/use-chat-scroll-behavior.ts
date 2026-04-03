import { useCallback, useEffect, useRef, useState } from 'react'

const NEAR_BOTTOM_THRESHOLD = 200

interface UseChatScrollBehaviorResult {
  anchorRef: React.RefObject<HTMLDivElement | null>
  isNearBottom: boolean
  isNearBottomRef: React.MutableRefObject<boolean>
  stickToBottomRef: React.MutableRefObject<boolean>
  scrollToBottom: (behavior?: ScrollBehavior) => void
  handleUserScroll: (metrics: {
    scrollTop: number
    scrollHeight: number
    clientHeight: number
  }) => void
  setIsNearBottom: React.Dispatch<React.SetStateAction<boolean>>
}

export function useChatScrollBehavior(): UseChatScrollBehaviorResult {
  const anchorRef = useRef<HTMLDivElement | null>(null)
  const lastScrollTopRef = useRef(0)
  const isNearBottomRef = useRef(true)
  const [isNearBottom, setIsNearBottom] = useState(true)
  const stickToBottomRef = useRef(true)

  const handleUserScroll = useCallback(function handleUserScroll(metrics: {
    scrollTop: number
    scrollHeight: number
    clientHeight: number
  }) {
    const distanceFromBottom =
      metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight
    const nearBottom = distanceFromBottom <= NEAR_BOTTOM_THRESHOLD
    const wasScrollingUp = metrics.scrollTop < lastScrollTopRef.current - 5
    lastScrollTopRef.current = metrics.scrollTop

    if (wasScrollingUp && !nearBottom) {
      stickToBottomRef.current = false
      isNearBottomRef.current = false
    } else if (nearBottom) {
      stickToBottomRef.current = true
      isNearBottomRef.current = true
    }
  }, [])

  const scrollToBottom = useCallback(function scrollToBottom(
    behavior: ScrollBehavior = 'auto',
  ) {
    const anchor = anchorRef.current
    if (!anchor) return
    const viewport = anchor.closest('[data-chat-scroll-viewport]')
    if (viewport) {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior })
    }
  }, [])

  // Sync near-bottom ref to state every 500ms for button visibility
  useEffect(() => {
    const timer = window.setInterval(() => {
      setIsNearBottom((prev) => {
        const current = isNearBottomRef.current
        return prev === current ? prev : current
      })
    }, 500)
    return () => window.clearInterval(timer)
  }, [])

  return {
    anchorRef,
    isNearBottom,
    isNearBottomRef,
    stickToBottomRef,
    scrollToBottom,
    handleUserScroll,
    setIsNearBottom,
  }
}
