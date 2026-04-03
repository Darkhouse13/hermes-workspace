import { useCallback, useRef, useState } from 'react'
import {
  normalizeMimeType,
  isImageMimeType,
  isTextMimeType,
  inferImageMimeTypeFromFileName,
  inferTextMimeTypeFromFileName,
  isImageFile,
  isTextFile,
} from '@/lib/chat-content-normalization'
import { toast } from '@/components/ui/toast'

// ── Types ────────────────────────────────────────────────────────

export type ComposerAttachment = {
  id: string
  name: string
  contentType: string
  size: number
  dataUrl?: string
  previewUrl?: string
  kind?: 'image' | 'file' | 'audio'
}

// ── Constants ────────────────────────────────────────────────────

const MAX_ATTACHMENT_FILE_SIZE = 50 * 1024 * 1024
const MAX_IMAGE_DIMENSION = 1920
const IMAGE_QUALITY = 0.85
const MAX_TRANSPORT_IMAGE_SIZE = 1 * 1024 * 1024

// ── Pure helpers ─────────────────────────────────────────────────

export function formatFileSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return ''
  const units = ['B', 'KB', 'MB', 'GB'] as const
  let value = size
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  const precision = value >= 100 || unitIndex === 0 ? 0 : 1
  return `${value.toFixed(precision)} ${units[unitIndex]}`
}

export function hasAttachableData(dt: DataTransfer | null): boolean {
  if (!dt) return false
  const items = Array.from(dt.items)
  if (
    items.some(
      (item) =>
        item.kind === 'file' &&
        (isImageMimeType(item.type) || isTextMimeType(item.type) || item.type.trim().length === 0),
    )
  )
    return true
  const files = Array.from(dt.files)
  return files.some(
    (file) => isImageFile(file) || isTextFile(file) || file.type.trim().length === 0,
  )
}

export function collectFilesFromDataTransfer(dt: DataTransfer | null): Array<File> {
  if (!dt) return []
  const files: Array<File> = []
  const seen = new Set<string>()
  const pushFile = (file: File | null) => {
    if (!file) return
    const key = `${file.name}:${file.size}:${file.lastModified}:${file.type}`
    if (seen.has(key)) return
    seen.add(key)
    files.push(file)
  }
  for (const item of Array.from(dt.items)) {
    if (item.kind !== 'file') continue
    pushFile(item.getAsFile())
  }
  for (const file of Array.from(dt.files)) {
    pushFile(file)
  }
  return files
}

async function readFileAsDataUrl(file: File): Promise<string | null> {
  return await new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : null)
    }
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(file)
  })
}

async function readFileAsText(file: File): Promise<string | null> {
  return await new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : null)
    }
    reader.onerror = () => resolve(null)
    reader.readAsText(file)
  })
}

function isCanvasSupported(): boolean {
  if (typeof document === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('2d'))
  } catch {
    return false
  }
}

function estimateDataUrlBytes(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(',')
  const base64 = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl
  if (!base64) return 0
  const padding =
    base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding)
}

function readDataUrlMimeType(dataUrl: string): string | null {
  const match = /^data:([^;]+);base64,/.exec(dataUrl)
  return match?.[1]?.trim() || null
}

async function compressImageToDataUrl(file: File): Promise<string> {
  if (!isCanvasSupported()) {
    throw new Error('Image compression not available')
  }
  return await new Promise((resolve, reject) => {
    const image = new Image()
    const objectUrl = URL.createObjectURL(file)
    const cleanup = () => URL.revokeObjectURL(objectUrl)
    image.onload = () => {
      try {
        let width = image.width
        let height = image.height
        if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
          if (width > height) {
            height = Math.round((height * MAX_IMAGE_DIMENSION) / width)
            width = MAX_IMAGE_DIMENSION
          } else {
            width = Math.round((width * MAX_IMAGE_DIMENSION) / height)
            height = MAX_IMAGE_DIMENSION
          }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d')
        if (!context) {
          cleanup()
          reject(new Error('Failed to get canvas context'))
          return
        }
        context.drawImage(image, 0, 0, width, height)
        let quality = IMAGE_QUALITY
        let dataUrl = canvas.toDataURL('image/jpeg', quality)
        let bytes = estimateDataUrlBytes(dataUrl)
        while (bytes > MAX_TRANSPORT_IMAGE_SIZE && quality > 0.4) {
          quality -= 0.08
          dataUrl = canvas.toDataURL('image/jpeg', quality)
          bytes = estimateDataUrlBytes(dataUrl)
        }
        cleanup()
        resolve(dataUrl)
      } catch (error) {
        cleanup()
        reject(error instanceof Error ? error : new Error('Compression failed'))
      }
    }
    image.onerror = () => {
      cleanup()
      reject(new Error('Failed to load image'))
    }
    image.src = objectUrl
  })
}

// ── Hook ─────────────────────────────────────────────────────────

export interface UseComposerAttachmentsDeps {
  disabled: boolean
  focusPromptRef: React.RefObject<(() => void) | null>
}

export function useComposerAttachments(deps: UseComposerAttachmentsDeps) {
  const [attachments, setAttachments] = useState<Array<ComposerAttachment>>([])
  const [attachmentProcessingCount, setAttachmentProcessingCount] = useState(0)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null)
  const dragCounterRef = useRef(0)
  const attachmentInputRef = useRef<HTMLInputElement | null>(null)

  const resetDragState = useCallback(() => {
    dragCounterRef.current = 0
    setIsDraggingOver(false)
  }, [])

  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const addAttachments = useCallback(
    async (files: Array<File>) => {
      if (deps.disabled) return
      setAttachmentProcessingCount((n) => n + 1)

      const timestamp = Date.now()
      const prepared = await Promise.all(
        files.map(async (file, index): Promise<ComposerAttachment | null> => {
          const imageFile = isImageFile(file)
          const textFile = isTextFile(file)
          if (!imageFile && !textFile && file.type.trim().length > 0) {
            return null
          }

          if (file.size > MAX_ATTACHMENT_FILE_SIZE) {
            toast(
              `"${file.name || 'file'}" is ${formatFileSize(file.size)}. Max upload input size is ${formatFileSize(MAX_ATTACHMENT_FILE_SIZE)}.`,
              { type: 'warning' },
            )
            return null
          }

          if (textFile) {
            const textContent = await readFileAsText(file)
            if (textContent === null) return null
            const name =
              file.name && file.name.trim().length > 0
                ? file.name.trim()
                : `pasted-text-${timestamp}-${index + 1}.txt`
            const textBytes = new TextEncoder().encode(textContent).length
            return {
              id: crypto.randomUUID(),
              name,
              contentType:
                (isTextMimeType(file.type) ? normalizeMimeType(file.type) : '') ||
                inferTextMimeTypeFromFileName(name) ||
                'text/plain',
              size: textBytes,
              dataUrl: textContent,
              kind: 'file',
            }
          }

          const compressedDataUrl = await compressImageToDataUrl(file).catch(() => null)
          const dataUrl = compressedDataUrl || (await readFileAsDataUrl(file))
          if (!dataUrl) return null

          const dataUrlMime = readDataUrlMimeType(dataUrl)
          if (!isImageMimeType(dataUrlMime || '')) {
            return null
          }

          const transportBytes = estimateDataUrlBytes(dataUrl)
          if (transportBytes > MAX_TRANSPORT_IMAGE_SIZE) {
            toast(
              `Image compressed to ${(transportBytes / (1024 * 1024)).toFixed(2)}mb — still over the 1mb limit. Try a smaller screenshot.`,
              { type: 'warning' },
            )
            return null
          }

          const name =
            file.name && file.name.trim().length > 0
              ? file.name.trim()
              : `pasted-image-${timestamp}-${index + 1}.jpg`
          const detectedMimeType =
            dataUrlMime ||
            (isImageMimeType(file.type) ? normalizeMimeType(file.type) : '') ||
            inferImageMimeTypeFromFileName(name) ||
            'image/jpeg'
          return {
            id: crypto.randomUUID(),
            name,
            contentType: detectedMimeType,
            size: transportBytes,
            dataUrl,
            previewUrl: dataUrl,
            kind: 'image',
          }
        }),
      )

      const valid = prepared.filter(
        (a): a is ComposerAttachment => a !== null,
      )

      const skippedCount = prepared.length - valid.length
      if (skippedCount > 0) {
        toast(
          skippedCount === 1
            ? '1 file could not be attached.'
            : `${skippedCount} files could not be attached.`,
          { type: 'warning' },
        )
      }

      if (valid.length === 0) {
        setAttachmentProcessingCount((n) => Math.max(0, n - 1))
        return
      }

      setAttachments((prev) => [...prev, ...valid])
      setAttachmentProcessingCount((n) => Math.max(0, n - 1))
      deps.focusPromptRef.current?.()
    },
    [deps.disabled],
  )

  const clearAttachments = useCallback(() => {
    setAttachments([])
  }, [])

  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      if (deps.disabled) return
      const files = collectFilesFromDataTransfer(event.clipboardData)
      if (files.length === 0) return
      const text = event.clipboardData.getData('text/plain')
      if (text.trim().length === 0) {
        event.preventDefault()
      }
      void addAttachments(files)
    },
    [addAttachments, deps.disabled],
  )

  const handleDragEnter = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (deps.disabled) return
      if (!hasAttachableData(event.dataTransfer)) return
      event.preventDefault()
      dragCounterRef.current += 1
      setIsDraggingOver(true)
      event.dataTransfer.dropEffect = 'copy'
    },
    [deps.disabled],
  )

  const handleDragLeave = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (deps.disabled) return
      if (event.currentTarget.contains(event.relatedTarget as Node)) return
      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1)
      if (dragCounterRef.current === 0) {
        setIsDraggingOver(false)
      }
    },
    [deps.disabled],
  )

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (deps.disabled) return
      event.preventDefault()
      if (hasAttachableData(event.dataTransfer)) {
        event.dataTransfer.dropEffect = 'copy'
      }
    },
    [deps.disabled],
  )

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (deps.disabled) return
      event.preventDefault()
      const files = collectFilesFromDataTransfer(event.dataTransfer)
      resetDragState()
      if (files.length === 0) return
      void addAttachments(files)
    },
    [addAttachments, deps.disabled, resetDragState],
  )

  const handleOpenAttachmentPicker = useCallback(() => {
    attachmentInputRef.current?.click()
  }, [])

  const handleAttachmentInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files
      if (!files || files.length === 0) return
      void addAttachments(Array.from(files))
      event.target.value = ''
    },
    [addAttachments],
  )

  return {
    attachments,
    setAttachments,
    attachmentProcessingCount,
    isDraggingOver,
    previewImage,
    setPreviewImage,
    attachmentInputRef,
    addAttachments,
    clearAttachments,
    handleRemoveAttachment,
    handlePaste,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleOpenAttachmentPicker,
    handleAttachmentInputChange,
    resetDragState,
  }
}
