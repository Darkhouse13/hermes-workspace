import { useEffect, useRef, useState } from 'react'

const WORDS_PER_TICK = 4
const TICK_INTERVAL_MS = 50

function isWhitespaceCharacter(value: string): boolean {
  return /\s/.test(value)
}

export function countWords(text: string): number {
  let count = 0
  let inWord = false

  for (const character of text) {
    if (isWhitespaceCharacter(character)) {
      if (inWord) {
        count += 1
        inWord = false
      }
      continue
    }
    inWord = true
  }

  if (inWord) {
    count += 1
  }

  return count
}

export function getWordBoundaryIndex(text: string, wordCount: number): number {
  if (text.length === 0 || wordCount <= 0) return 0

  let count = 0
  let index = 0
  let inWord = false

  while (index < text.length) {
    const character = text[index] ?? ''
    if (isWhitespaceCharacter(character)) {
      if (inWord) {
        count += 1
        if (count >= wordCount) {
          return index
        }
        inWord = false
      }
    } else {
      inWord = true
    }
    index += 1
  }

  if (inWord) {
    count += 1
    if (count >= wordCount) {
      return text.length
    }
  }

  return text.length
}

interface UseMessageStreamingRevealOptions {
  fullText: string
  remoteStreamingText: string | undefined
  remoteStreamingActive: boolean
  simulateStreaming: boolean
  streamingKey: string | null | undefined
}

interface UseMessageStreamingRevealResult {
  displayText: string
  effectiveIsStreaming: boolean
  revealProgress: number
}

export function useMessageStreamingReveal({
  fullText,
  remoteStreamingText,
  remoteStreamingActive,
  simulateStreaming,
  streamingKey,
}: UseMessageStreamingRevealOptions): UseMessageStreamingRevealResult {
  const initialDisplayText = remoteStreamingActive
    ? (remoteStreamingText ?? fullText)
    : fullText
  const [displayText, setDisplayText] = useState(() => initialDisplayText)
  const [revealedWordCount, setRevealedWordCount] = useState(() =>
    remoteStreamingActive || simulateStreaming
      ? 0
      : countWords(initialDisplayText),
  )
  const [revealedText, setRevealedText] = useState(() =>
    remoteStreamingActive || simulateStreaming ? '' : initialDisplayText,
  )
  const revealTimerRef = useRef<number | null>(null)
  const targetWordCountRef = useRef(countWords(initialDisplayText))
  const previousTextRef = useRef(initialDisplayText)
  const previousTextLengthRef = useRef(initialDisplayText.length)

  useEffect(() => {
    if (remoteStreamingActive) {
      setDisplayText(remoteStreamingText ?? fullText)
      return
    }

    setDisplayText((current) => (current === fullText ? current : fullText))
  }, [remoteStreamingActive, remoteStreamingText, fullText])

  // Reset word count when simulate streaming starts for a new message
  useEffect(() => {
    if (simulateStreaming && !remoteStreamingActive) {
      setRevealedWordCount(0)
    }
  }, [streamingKey, simulateStreaming, remoteStreamingActive])

  useEffect(() => {
    return () => {
      if (revealTimerRef.current !== null) {
        window.clearInterval(revealTimerRef.current)
      }
    }
  }, [])

  // Simulate streaming is only active while words are still being revealed
  const totalWords = countWords(displayText)
  const revealComplete = revealedWordCount >= totalWords && totalWords > 0
  const effectiveIsStreaming =
    remoteStreamingActive || (simulateStreaming && !revealComplete)
  const assistantDisplayText = effectiveIsStreaming ? revealedText : displayText

  useEffect(() => {
    const innerTotalWords = countWords(displayText)
    const previousText = previousTextRef.current
    const previousLength = previousTextLengthRef.current
    const textGrew =
      displayText.length > previousLength &&
      displayText.startsWith(previousText)
    const textChanged = displayText !== previousText

    targetWordCountRef.current = innerTotalWords
    previousTextRef.current = displayText
    previousTextLengthRef.current = displayText.length

    if (!effectiveIsStreaming) {
      if (revealTimerRef.current !== null) {
        window.clearInterval(revealTimerRef.current)
        revealTimerRef.current = null
      }
      setRevealedWordCount(innerTotalWords)
      return
    }

    if (textChanged && !textGrew) {
      setRevealedWordCount(innerTotalWords)
      return
    }

    if (revealTimerRef.current !== null) {
      return
    }

    // Don't start animation if already fully revealed
    setRevealedWordCount((currentWordCount) => {
      if (currentWordCount >= innerTotalWords) {
        return currentWordCount
      }

      function tick() {
        setRevealedWordCount((localCurrentWordCount) => {
          const targetWordCount = targetWordCountRef.current
          if (localCurrentWordCount >= targetWordCount) {
            if (revealTimerRef.current !== null) {
              window.clearInterval(revealTimerRef.current)
              revealTimerRef.current = null
            }
            return localCurrentWordCount
          }

          const nextWordCount = Math.min(
            targetWordCount,
            localCurrentWordCount + WORDS_PER_TICK,
          )

          if (
            nextWordCount >= targetWordCount &&
            revealTimerRef.current !== null
          ) {
            window.clearInterval(revealTimerRef.current)
            revealTimerRef.current = null
          }

          return nextWordCount
        })
      }

      revealTimerRef.current = window.setInterval(tick, TICK_INTERVAL_MS)
      return currentWordCount
    })
  }, [displayText, effectiveIsStreaming])

  useEffect(() => {
    if (!effectiveIsStreaming) {
      setRevealedText((currentText) =>
        currentText === displayText ? currentText : displayText,
      )
      return
    }

    const boundaryIndex = getWordBoundaryIndex(displayText, revealedWordCount)
    const nextRevealedText = displayText.slice(0, boundaryIndex)
    setRevealedText((currentText) =>
      currentText === nextRevealedText ? currentText : nextRevealedText,
    )
  }, [displayText, effectiveIsStreaming, revealedWordCount])

  const revealProgress = totalWords > 0 ? revealedWordCount / totalWords : 1

  return {
    displayText: assistantDisplayText,
    effectiveIsStreaming,
    revealProgress,
  }
}
