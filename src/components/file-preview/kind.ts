/**
 * 文件预览：按类型（MIME）与扩展名判断用哪种方式显示，以及读取文本内容（只读开头一段）。
 * 只认浏览器自己能显示的格式：图片、音视频、文本；其余（PDF、Office、压缩包……）显示文件卡片，或交给应用的 render。
 */
import type { IconName } from '../Icon.tsx'

/** 预览方式。 */
export type PreviewKind = 'image' | 'video' | 'audio' | 'markdown' | 'json' | 'text' | 'other'

/** 判断时用到的字段（FilePreviewItem 的一部分）。 */
export interface KindSource {
  readonly name: string
  readonly type?: string
  readonly file?: Blob
}

/** 浏览器普遍能显示的图片格式。TIFF、HEIC 不在其中：Chromium 不支持。 */
const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'bmp', 'ico'])
const UNSUPPORTED_IMAGE_TYPES = new Set(['image/tiff', 'image/heic', 'image/heif'])
const VIDEO_EXT = new Set(['mp4', 'm4v', 'webm', 'ogv', 'mov'])
const AUDIO_EXT = new Set(['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac', 'opus', 'weba'])
const MARKDOWN_EXT = new Set(['md', 'markdown', 'mdx'])
const JSON_EXT = new Set(['json', 'jsonc', 'json5', 'geojson', 'har', 'ipynb', 'webmanifest'])
/** 按纯文本显示的扩展名：代码、配置、日志、数据。 */
const TEXT_EXT = new Set([
  'txt',
  'log',
  'csv',
  'tsv',
  'ndjson',
  'jsonl',
  'yaml',
  'yml',
  'toml',
  'ini',
  'cfg',
  'conf',
  'env',
  'properties',
  'xml',
  'html',
  'htm',
  'css',
  'scss',
  'less',
  'js',
  'mjs',
  'cjs',
  'jsx',
  'ts',
  'mts',
  'cts',
  'tsx',
  'vue',
  'svelte',
  'py',
  'rb',
  'go',
  'rs',
  'java',
  'kt',
  'kts',
  'scala',
  'swift',
  'c',
  'h',
  'cc',
  'cpp',
  'hpp',
  'cs',
  'php',
  'lua',
  'pl',
  'r',
  'sh',
  'bash',
  'zsh',
  'fish',
  'ps1',
  'bat',
  'sql',
  'graphql',
  'gql',
  'proto',
  'diff',
  'patch',
  'srt',
  'vtt',
  'pem',
  'crt',
  'gitignore',
  'dockerignore',
  'editorconfig',
])
/** 没有扩展名、按整个文件名认出的文本文件。 */
const TEXT_NAMES = new Set([
  'dockerfile',
  'makefile',
  'license',
  'readme',
  'changelog',
  'procfile',
  'gemfile',
  'rakefile',
  'vagrantfile',
])
const ARCHIVE_EXT = new Set(['zip', 'tar', 'gz', 'tgz', 'bz2', 'xz', '7z', 'rar', 'zst'])

/** 扩展名（小写，不含点）；没有扩展名时为空字符串。以点开头的文件名（`.env`）把点后面的部分当作扩展名。 */
export function extensionOf(name: string): string {
  const base = name.slice(name.lastIndexOf('/') + 1).toLowerCase()
  const dot = base.lastIndexOf('.')
  return dot < 0 ? '' : base.slice(dot + 1)
}

function typeOf(source: KindSource): string {
  return (source.type ?? source.file?.type ?? '').toLowerCase().split(';')[0]?.trim() ?? ''
}

/** 文本类的 MIME：text/*、JSON、XML、YAML、JavaScript 等。 */
function textType(type: string): 'markdown' | 'json' | 'text' | null {
  if (type === 'text/markdown' || type === 'text/x-markdown') return 'markdown'
  if (type === 'application/json' || type.endsWith('+json')) return 'json'
  if (
    type.startsWith('text/') ||
    type.endsWith('+xml') ||
    [
      'application/xml',
      'application/javascript',
      'application/x-javascript',
      'application/ecmascript',
      'application/typescript',
      'application/x-yaml',
      'application/yaml',
      'application/toml',
      'application/x-sh',
      'application/sql',
      'application/graphql',
      'application/x-ndjson',
    ].includes(type)
  )
    return 'text'
  return null
}

/** 预览方式：先看扩展名（更具体，如 `.md` 的类型常常只是 text/plain），认不出时再看 MIME。 */
export function previewKind(source: KindSource): PreviewKind {
  const ext = extensionOf(source.name)
  const type = typeOf(source)
  if (IMAGE_EXT.has(ext)) return 'image'
  if (VIDEO_EXT.has(ext)) return 'video'
  if (AUDIO_EXT.has(ext)) return 'audio'
  if (MARKDOWN_EXT.has(ext)) return 'markdown'
  if (JSON_EXT.has(ext)) return 'json'
  if (TEXT_EXT.has(ext)) return 'text'
  if (ext === '' && TEXT_NAMES.has(source.name.toLowerCase())) return 'text'
  if (type.startsWith('image/') && !UNSUPPORTED_IMAGE_TYPES.has(type)) return 'image'
  if (type.startsWith('video/')) return 'video'
  if (type.startsWith('audio/')) return 'audio'
  return textType(type) ?? 'other'
}

/** 文件卡片上的图标。 */
export function kindIcon(source: KindSource, kind: PreviewKind): IconName {
  switch (kind) {
    case 'image':
      return 'file-image'
    case 'video':
      return 'file-video'
    case 'audio':
      return 'file-audio'
    case 'markdown':
    case 'text':
      return TEXT_EXT.has(extensionOf(source.name)) &&
        !['txt', 'log', 'csv', 'tsv'].includes(extensionOf(source.name))
        ? 'file-code'
        : 'file-text'
    case 'json':
      return 'file-code'
    default:
      return ARCHIVE_EXT.has(extensionOf(source.name)) ? 'file-archive' : 'file'
  }
}

/** 文本最多读取的字节数：更长的文件只显示开头这一段，并提示「只显示了前 256 KB」。 */
export const TEXT_LIMIT = 256 * 1024

/** 读到的文本：内容、是否被截断、原文件的大小（字节，未知时为 undefined）。 */
export interface TextResult {
  readonly text: string
  readonly truncated: boolean
  readonly total: number | undefined
}

/** 文本里有空字符：其实是二进制文件，按「无法预览」处理。 */
export class BinaryContentError extends Error {}

// stream：在上限处被切断的多字节字符不解码成乱码，直接丢掉
const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes, { stream: true })

function checkText(text: string): string {
  if (text.slice(0, 8192).includes('\u0000')) throw new BinaryContentError()
  return text
}

/** 读取开头 TEXT_LIMIT 字节：Blob 只切出这一段；地址用流读取，读够就停止下载。 */
export async function readText(
  source: { readonly content?: string; readonly file?: Blob; readonly src?: string },
  signal: AbortSignal,
): Promise<TextResult> {
  if (source.content !== undefined) {
    const truncated = source.content.length > TEXT_LIMIT
    return {
      text: truncated ? source.content.slice(0, TEXT_LIMIT) : source.content,
      truncated,
      total: new TextEncoder().encode(source.content).length,
    }
  }
  if (source.file) {
    const blob = source.file
    const buffer = await blob.slice(0, TEXT_LIMIT).arrayBuffer()
    return {
      text: checkText(decode(new Uint8Array(buffer))),
      truncated: blob.size > TEXT_LIMIT,
      total: blob.size,
    }
  }
  if (!source.src) throw new Error('no source')
  const response = await fetch(source.src, { signal })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const length = Number(response.headers.get('content-length'))
  const total = Number.isFinite(length) && length > 0 ? length : undefined
  if (!response.body) {
    const text = await response.text()
    return {
      text: checkText(text.slice(0, TEXT_LIMIT)),
      truncated: text.length > TEXT_LIMIT,
      total,
    }
  }
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0
  let truncated = false
  while (received < TEXT_LIMIT) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    received += value.length
  }
  if (received >= TEXT_LIMIT) {
    // 恰好读到上限时看看后面还有没有内容
    const rest = received > TEXT_LIMIT ? null : await reader.read()
    truncated = received > TEXT_LIMIT || (rest !== null && !rest.done)
    await reader.cancel().catch(() => {})
  }
  const bytes = new Uint8Array(Math.min(received, TEXT_LIMIT))
  let offset = 0
  for (const chunk of chunks) {
    const part = chunk.subarray(0, bytes.length - offset)
    bytes.set(part, offset)
    offset += part.length
    if (offset >= bytes.length) break
  }
  return {
    text: checkText(decode(bytes)),
    truncated,
    total: total ?? (truncated ? undefined : received),
  }
}

/** JSON 排版为两格缩进；不是合法 JSON（如被截断）时原样返回。 */
export function formatJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}
