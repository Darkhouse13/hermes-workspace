import { useMemo, useState } from 'react'
import type { ChatAttachment } from '../types'
import { CodeBlock } from '@/components/prompt-kit/code-block'
import { Markdown } from '@/components/prompt-kit/markdown'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function attachmentSource(attachment: ChatAttachment | undefined): string {
  if (!attachment) return ''
  const candidates = [attachment.previewUrl, attachment.dataUrl, attachment.url]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate
    }
  }
  return ''
}

export function attachmentExtension(attachment: ChatAttachment): string {
  const name = typeof attachment.name === 'string' ? attachment.name : ''
  const fromName = name.split('.').pop()?.trim().toLowerCase() || ''
  if (fromName) return fromName

  const source = attachmentSource(attachment)
  const fileName = source.split('?')[0]?.split('#')[0]?.split('/').pop() || ''
  return fileName.split('.').pop()?.trim().toLowerCase() || ''
}

export function isImageAttachment(attachment: ChatAttachment): boolean {
  const contentType =
    typeof attachment.contentType === 'string'
      ? attachment.contentType.trim().toLowerCase()
      : ''
  if (contentType.startsWith('image/')) return true

  const ext = attachmentExtension(attachment)
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif'].includes(ext)
}

export function isMarkdownAttachment(attachment: ChatAttachment): boolean {
  const ext = attachmentExtension(attachment)
  if (ext === 'md' || ext === 'markdown' || ext === 'mdx') return true

  const contentType =
    typeof attachment.contentType === 'string'
      ? attachment.contentType.trim().toLowerCase()
      : ''
  return contentType.includes('markdown')
}

export function decodeAttachmentText(attachment: ChatAttachment): string {
  const candidates = [attachment.dataUrl, attachment.previewUrl, attachment.url]

  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || candidate.trim().length === 0) continue
    const trimmed = candidate.trim()

    if (!trimmed.startsWith('data:')) {
      return trimmed
    }

    const commaIndex = trimmed.indexOf(',')
    if (commaIndex < 0) continue

    const metadata = trimmed.slice(0, commaIndex).toLowerCase()
    const payload = trimmed.slice(commaIndex + 1)

    try {
      if (metadata.includes(';base64')) {
        return decodeURIComponent(escape(atob(payload)))
      }
      return decodeURIComponent(payload)
    } catch {
      continue
    }
  }

  return ''
}

export function MarkdownDocumentCard({
  title,
  content,
  openHref,
  className,
}: {
  title: string
  content: string
  openHref?: string
  className?: string
}) {
  const [viewMode, setViewMode] = useState<'preview' | 'source'>('preview')
  const hasContent = content.trim().length > 0

  return (
    <div
      className={cn(
        'w-full max-w-[42rem] overflow-hidden rounded-2xl border border-primary-200 bg-primary-50/70',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3 border-b border-primary-200 px-3 py-2.5">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-primary-900">{title}</div>
          <div className="text-[11px] text-primary-600">Markdown document</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {hasContent ? (
            <div className="flex items-center rounded-lg border border-primary-200 bg-primary-100/70 p-0.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  'h-7 px-2.5 text-xs',
                  viewMode === 'preview' &&
                    'bg-primary-200 text-primary-900 hover:bg-primary-200',
                )}
                onClick={() => setViewMode('preview')}
              >
                Preview
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  'h-7 px-2.5 text-xs',
                  viewMode === 'source' &&
                    'bg-primary-200 text-primary-900 hover:bg-primary-200',
                )}
                onClick={() => setViewMode('source')}
              >
                Source
              </Button>
            </div>
          ) : null}
          {openHref ? (
            <a
              href={openHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary-700 underline decoration-primary-300 underline-offset-4 hover:decoration-primary-500"
            >
              Open
            </a>
          ) : null}
        </div>
      </div>

      <div className="max-h-[26rem] overflow-auto p-3">
        {hasContent ? (
          viewMode === 'preview' ? (
            <Markdown className="text-sm">{content}</Markdown>
          ) : (
            <CodeBlock content={content} language="markdown" className="my-0" />
          )
        ) : (
          <div className="text-sm text-primary-600">
            Preview unavailable for this markdown content.
          </div>
        )}
      </div>
    </div>
  )
}

function MarkdownAttachmentCard({ attachment }: { attachment: ChatAttachment }) {
  const source = attachmentSource(attachment)
  const content = useMemo(() => decodeAttachmentText(attachment), [attachment])
  const ext = attachmentExtension(attachment)

  return (
    <MarkdownDocumentCard
      title={`${attachment.name || 'Markdown attachment'}${ext ? ` • ${ext.toUpperCase()}` : ''}`}
      content={content}
      openHref={source || undefined}
    />
  )
}

interface InlineImage {
  id: string
  src: string
}

export function MessageAttachments({
  attachments,
  inlineImages,
}: {
  attachments: ChatAttachment[]
  inlineImages?: InlineImage[]
}) {
  const hasAttachments = attachments.length > 0
  const hasInlineImages = (inlineImages?.length ?? 0) > 0

  if (!hasAttachments && !hasInlineImages) return null

  return (
    <>
      {hasAttachments && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((attachment) => {
            const source = attachmentSource(attachment)
            const ext = attachmentExtension(attachment)
            const imageAttachment = isImageAttachment(attachment)
            const markdownAttachment = isMarkdownAttachment(attachment)

            if (imageAttachment) {
              return (
                <a
                  key={attachment.id}
                  href={source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-lg border border-primary-200 hover:border-primary-400 transition-colors max-w-full"
                >
                  <img
                    src={source}
                    alt={attachment.name || 'Attached image'}
                    className="max-h-64 w-auto max-w-full object-contain"
                    loading="lazy"
                  />
                </a>
              )
            }

            if (markdownAttachment) {
              const mdContent = decodeAttachmentText(attachment)
              // Only render preview if actual content exists (base64 is stripped on history reload)
              if (mdContent.trim().length > 0) {
                return (
                  <MarkdownAttachmentCard
                    key={attachment.id || attachment.name || source}
                    attachment={attachment}
                  />
                )
              }
              // Fall through to generic attachment link
            }

            return (
              <a
                key={attachment.id}
                href={source}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full items-center gap-2 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-700 hover:border-primary-400"
              >
                <span>📄</span>
                <span className="truncate">{attachment.name || 'Attachment'}</span>
                <span className="rounded bg-primary-100 px-1.5 py-0.5 text-[10px] uppercase text-primary-600">
                  {ext || 'file'}
                </span>
              </a>
            )
          })}
        </div>
      )}
      {hasInlineImages && inlineImages && (
        <div className="flex flex-wrap gap-2">
          {inlineImages.map((img) => (
            <a
              key={img.id}
              href={img.src}
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-hidden rounded-lg border border-primary-200 hover:border-primary-400 transition-colors max-w-full"
            >
              <img
                src={img.src}
                alt="Shared image"
                className="max-h-64 w-auto max-w-full object-contain"
                loading="lazy"
              />
            </a>
          ))}
        </div>
      )}
    </>
  )
}
