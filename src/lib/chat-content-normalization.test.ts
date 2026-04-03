import { describe, expect, it } from 'vitest'
import {
  stripFinalTags,
  stripInternalTags,
  normalizeMimeType,
  isImageMimeType,
  isTextMimeType,
  readDataUrlMimeType,
  stripDataUrlPrefix,
  inferImageMimeTypeFromFileName,
  inferTextMimeTypeFromFileName,
  normalizeMessageValue,
  IMAGE_EXTENSION_TO_MIME,
  TEXT_EXTENSION_TO_MIME,
} from './chat-content-normalization'

// ---------------------------------------------------------------------------
// stripFinalTags
// ---------------------------------------------------------------------------

describe('stripFinalTags', () => {
  it('strips <final>...</final> wrapper', () => {
    expect(stripFinalTags('<final>hello</final>')).toBe('hello')
  })

  it('strips with whitespace around tags', () => {
    expect(stripFinalTags('  <final>  hello world  </final>  ')).toBe('hello world')
  })

  it('is case-insensitive', () => {
    expect(stripFinalTags('<FINAL>hello</FINAL>')).toBe('hello')
  })

  it('returns text unchanged when no final tags', () => {
    expect(stripFinalTags('just text')).toBe('just text')
  })

  it('handles empty string', () => {
    expect(stripFinalTags('')).toBe('')
  })

  it('handles multiline content inside final tags', () => {
    expect(stripFinalTags('<final>line1\nline2</final>')).toBe('line1\nline2')
  })

  it('also strips internal tags from the result', () => {
    expect(stripFinalTags('<final><thinking>secret</thinking>visible</final>')).toBe('visible')
  })
})

// ---------------------------------------------------------------------------
// stripInternalTags
// ---------------------------------------------------------------------------

describe('stripInternalTags', () => {
  it('strips <thinking> tags', () => {
    expect(stripInternalTags('before<thinking>internal</thinking>after')).toBe('beforeafter')
  })

  it('strips <antThinking> tags', () => {
    expect(stripInternalTags('a<antThinking>b</antThinking>c')).toBe('ac')
  })

  it('strips <thought> tags', () => {
    expect(stripInternalTags('a<thought>b</thought>c')).toBe('ac')
  })

  it('strips <relevant_memories> tags', () => {
    expect(stripInternalTags('x<relevant_memories>y</relevant_memories>z')).toBe('xz')
  })

  it('preserves content inside code blocks', () => {
    const input = '```\n<thinking>keep this</thinking>\n```'
    expect(stripInternalTags(input)).toContain('<thinking>keep this</thinking>')
  })

  it('strips tags outside code blocks but preserves inside', () => {
    const input = '<thinking>remove</thinking>text```\n<thinking>keep</thinking>\n```'
    const result = stripInternalTags(input)
    expect(result).not.toContain('remove')
    expect(result).toContain('<thinking>keep</thinking>')
    expect(result).toContain('text')
  })

  it('returns text unchanged when no internal tags', () => {
    expect(stripInternalTags('plain text')).toBe('plain text')
  })

  it('handles empty string', () => {
    expect(stripInternalTags('')).toBe('')
  })

  it('is case-insensitive', () => {
    expect(stripInternalTags('<THINKING>x</THINKING>')).toBe('')
  })
})

// ---------------------------------------------------------------------------
// normalizeMimeType
// ---------------------------------------------------------------------------

describe('normalizeMimeType', () => {
  it('lowercases and trims', () => {
    expect(normalizeMimeType('  Image/PNG  ')).toBe('image/png')
  })

  it('returns empty string for non-strings', () => {
    expect(normalizeMimeType(null)).toBe('')
    expect(normalizeMimeType(undefined)).toBe('')
    expect(normalizeMimeType(42)).toBe('')
  })

  it('handles empty string', () => {
    expect(normalizeMimeType('')).toBe('')
  })
})

// ---------------------------------------------------------------------------
// isImageMimeType
// ---------------------------------------------------------------------------

describe('isImageMimeType', () => {
  it('returns true for image/png', () => {
    expect(isImageMimeType('image/png')).toBe(true)
  })

  it('returns true for image/jpeg', () => {
    expect(isImageMimeType('image/jpeg')).toBe(true)
  })

  it('returns true for image/gif', () => {
    expect(isImageMimeType('image/gif')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isImageMimeType('Image/PNG')).toBe(true)
  })

  it('returns false for text/plain', () => {
    expect(isImageMimeType('text/plain')).toBe(false)
  })

  it('returns false for non-strings', () => {
    expect(isImageMimeType(null)).toBe(false)
    expect(isImageMimeType(undefined)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// isTextMimeType
// ---------------------------------------------------------------------------

describe('isTextMimeType', () => {
  it('returns true for text/plain', () => {
    expect(isTextMimeType('text/plain')).toBe(true)
  })

  it('returns true for text/markdown', () => {
    expect(isTextMimeType('text/markdown')).toBe(true)
  })

  it('returns true for application/json', () => {
    expect(isTextMimeType('application/json')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isTextMimeType('TEXT/PLAIN')).toBe(true)
  })

  it('returns false for image/png', () => {
    expect(isTextMimeType('image/png')).toBe(false)
  })

  it('returns false for application/pdf', () => {
    expect(isTextMimeType('application/pdf')).toBe(false)
  })

  it('returns false for non-strings', () => {
    expect(isTextMimeType(null)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// readDataUrlMimeType
// ---------------------------------------------------------------------------

describe('readDataUrlMimeType', () => {
  it('extracts mime from data URL with base64', () => {
    expect(readDataUrlMimeType('data:image/png;base64,abc123')).toBe('image/png')
  })

  it('extracts mime from data URL without base64', () => {
    expect(readDataUrlMimeType('data:text/plain,hello')).toBe('text/plain')
  })

  it('lowercases the mime type', () => {
    expect(readDataUrlMimeType('data:Image/PNG;base64,abc')).toBe('image/png')
  })

  it('returns empty string for non-data URLs', () => {
    expect(readDataUrlMimeType('https://example.com')).toBe('')
  })

  it('returns empty string for non-strings', () => {
    expect(readDataUrlMimeType(null)).toBe('')
    expect(readDataUrlMimeType(undefined)).toBe('')
    expect(readDataUrlMimeType(42)).toBe('')
  })

  it('returns empty string for empty string', () => {
    expect(readDataUrlMimeType('')).toBe('')
  })
})

// ---------------------------------------------------------------------------
// stripDataUrlPrefix
// ---------------------------------------------------------------------------

describe('stripDataUrlPrefix', () => {
  it('strips data URL prefix', () => {
    expect(stripDataUrlPrefix('data:image/png;base64,abc123')).toBe('abc123')
  })

  it('strips data URL prefix without base64 flag', () => {
    expect(stripDataUrlPrefix('data:text/plain,hello world')).toBe('hello world')
  })

  it('returns non-data strings unchanged', () => {
    expect(stripDataUrlPrefix('plain text')).toBe('plain text')
  })

  it('returns empty string for non-strings', () => {
    expect(stripDataUrlPrefix(null)).toBe('')
    expect(stripDataUrlPrefix(undefined)).toBe('')
  })

  it('returns empty string for empty string', () => {
    expect(stripDataUrlPrefix('')).toBe('')
  })

  it('trims whitespace', () => {
    expect(stripDataUrlPrefix('  data:text/plain,hello  ')).toBe('hello')
  })
})

// ---------------------------------------------------------------------------
// inferImageMimeTypeFromFileName
// ---------------------------------------------------------------------------

describe('inferImageMimeTypeFromFileName', () => {
  it('returns image/png for .png', () => {
    expect(inferImageMimeTypeFromFileName('photo.png')).toBe('image/png')
  })

  it('returns image/jpeg for .jpg', () => {
    expect(inferImageMimeTypeFromFileName('photo.jpg')).toBe('image/jpeg')
  })

  it('returns image/jpeg for .jpeg', () => {
    expect(inferImageMimeTypeFromFileName('photo.jpeg')).toBe('image/jpeg')
  })

  it('returns image/gif for .gif', () => {
    expect(inferImageMimeTypeFromFileName('anim.gif')).toBe('image/gif')
  })

  it('returns image/webp for .webp', () => {
    expect(inferImageMimeTypeFromFileName('photo.webp')).toBe('image/webp')
  })

  it('returns image/svg+xml for .svg', () => {
    expect(inferImageMimeTypeFromFileName('icon.svg')).toBe('image/svg+xml')
  })

  it('is case-insensitive for extensions', () => {
    expect(inferImageMimeTypeFromFileName('photo.PNG')).toBe('image/png')
  })

  it('returns empty string for non-image extensions', () => {
    expect(inferImageMimeTypeFromFileName('doc.txt')).toBe('')
  })

  it('returns empty string for no extension', () => {
    expect(inferImageMimeTypeFromFileName('noext')).toBe('')
  })

  it('returns empty string for empty string', () => {
    expect(inferImageMimeTypeFromFileName('')).toBe('')
  })
})

// ---------------------------------------------------------------------------
// inferTextMimeTypeFromFileName
// ---------------------------------------------------------------------------

describe('inferTextMimeTypeFromFileName', () => {
  it('returns text/markdown for .md', () => {
    expect(inferTextMimeTypeFromFileName('readme.md')).toBe('text/markdown')
  })

  it('returns text/plain for .txt', () => {
    expect(inferTextMimeTypeFromFileName('notes.txt')).toBe('text/plain')
  })

  it('returns application/json for .json', () => {
    expect(inferTextMimeTypeFromFileName('config.json')).toBe('application/json')
  })

  it('returns text/csv for .csv', () => {
    expect(inferTextMimeTypeFromFileName('data.csv')).toBe('text/csv')
  })

  it('returns text/plain for .ts', () => {
    expect(inferTextMimeTypeFromFileName('app.ts')).toBe('text/plain')
  })

  it('returns text/plain for .tsx', () => {
    expect(inferTextMimeTypeFromFileName('component.tsx')).toBe('text/plain')
  })

  it('returns empty string for unknown extension', () => {
    expect(inferTextMimeTypeFromFileName('data.xyz')).toBe('')
  })

  it('is case-insensitive', () => {
    expect(inferTextMimeTypeFromFileName('README.MD')).toBe('text/markdown')
  })
})

// ---------------------------------------------------------------------------
// normalizeMessageValue
// ---------------------------------------------------------------------------

describe('normalizeMessageValue', () => {
  it('trims and returns string', () => {
    expect(normalizeMessageValue('  hello  ')).toBe('hello')
  })

  it('returns empty string for empty string', () => {
    expect(normalizeMessageValue('')).toBe('')
  })

  it('returns empty string for whitespace-only string', () => {
    expect(normalizeMessageValue('   ')).toBe('')
  })

  it('returns empty string for non-strings', () => {
    expect(normalizeMessageValue(null)).toBe('')
    expect(normalizeMessageValue(undefined)).toBe('')
    expect(normalizeMessageValue(42)).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('IMAGE_EXTENSION_TO_MIME', () => {
  it('maps common image extensions', () => {
    expect(IMAGE_EXTENSION_TO_MIME.png).toBe('image/png')
    expect(IMAGE_EXTENSION_TO_MIME.jpg).toBe('image/jpeg')
    expect(IMAGE_EXTENSION_TO_MIME.gif).toBe('image/gif')
    expect(IMAGE_EXTENSION_TO_MIME.webp).toBe('image/webp')
    expect(IMAGE_EXTENSION_TO_MIME.svg).toBe('image/svg+xml')
  })
})

describe('TEXT_EXTENSION_TO_MIME', () => {
  it('maps common text extensions', () => {
    expect(TEXT_EXTENSION_TO_MIME.md).toBe('text/markdown')
    expect(TEXT_EXTENSION_TO_MIME.txt).toBe('text/plain')
    expect(TEXT_EXTENSION_TO_MIME.json).toBe('application/json')
    expect(TEXT_EXTENSION_TO_MIME.csv).toBe('text/csv')
  })
})
