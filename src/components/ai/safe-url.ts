/**
 * AI 输出中的链接与图片地址是不可信的：只放行协议白名单（http、https、mailto）与相对地址，其余（`javascript:`、
 * `data:`、`vbscript:`、`file:` 等）一律不当作链接。判断时先解码 HTML 实体、去掉空白与控制字符（浏览器解析地址时
 * 会忽略其中一部分），再看冒号之前的部分；解码与去除都比浏览器更激进，宁可把可疑的地址当成文字，也不放行。
 * 组件库内部使用（Markdown、Sources、Citation），不从入口导出。
 */

/** 放行的协议（小写，不含冒号）。 */
const ALLOWED_SCHEMES = new Set(['http', 'https', 'mailto'])

/** 判断用的 HTML 实体：数字实体（分号可省略）与可能拼出协议的命名实体。 */
const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  colon: ':',
  tab: '\t',
  newline: '\n',
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  sol: '/',
  period: '.',
  lpar: '(',
  rpar: ')',
}

function decodeEntities(value: string): string {
  // 反复解码，直到不再变化：`&amp;#106;` 这类双重编码也按最坏情况解开
  let current = value
  for (let i = 0; i < 4; i++) {
    const next = current.replace(
      /&(?:#x([0-9a-f]+)|#(\d+)|([a-z]+));?/gi,
      (m, hex: string | undefined, dec: string | undefined, name: string | undefined) => {
        const code = hex ? Number.parseInt(hex, 16) : dec ? Number.parseInt(dec, 10) : Number.NaN
        if (Number.isFinite(code))
          return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ''
        return (name && NAMED_ENTITIES[name.toLowerCase()]) ?? m
      },
    )
    if (next === current) break
    current = next
  }
  return current
}

/**
 * 地址中的空白、控制字符与零宽字符（码位区间）：判断协议前全部去掉（浏览器只忽略其中一部分，多去掉只会更保守）。
 * 用码位写出，源码中不出现这些不可见字符。
 */
const INVISIBLE_RANGES: readonly (readonly [number, number])[] = [
  [0x0000, 0x0020],
  [0x007f, 0x00a0],
  [0x00ad, 0x00ad],
  [0x061c, 0x061c],
  [0x115f, 0x1160],
  [0x17b4, 0x17b5],
  [0x180e, 0x180e],
  [0x2000, 0x200f],
  [0x2028, 0x202f],
  [0x205f, 0x206f],
  [0x3000, 0x3000],
  [0x3164, 0x3164],
  [0xfeff, 0xfeff],
  [0xffa0, 0xffa0],
]

const isInvisible = (code: number) =>
  INVISIBLE_RANGES.some(([from, to]) => code >= from && code <= to)

function stripInvisible(value: string): string {
  let out = ''
  for (const ch of value) if (!isInvisible(ch.codePointAt(0) ?? 0)) out += ch
  return out
}

/** 一个可以渲染成链接的地址。 */
export interface SafeLink {
  /** 原样的地址（去掉首尾空白），用作 `href` / `src`。 */
  readonly href: string
  /** 外部链接：http、https 或以 `//` 开头的地址，在新标签页打开。 */
  readonly external: boolean
}

/**
 * 判断地址能否作为链接：http、https、mailto 与相对地址可以，其他协议、空地址、非字符串都不行（返回 null）。
 */
export function safeLink(raw: unknown): SafeLink | null {
  if (typeof raw !== 'string') return null
  const href = raw.trim()
  if (!href) return null
  const normalized = stripInvisible(decodeEntities(href))
  if (!normalized) return null
  if (normalized.startsWith('//')) return { href, external: true }
  // 冒号出现在第一个 `/`、`?`、`#` 之前，就是带协议的地址（`a:b` 这类相对路径也按带协议处理，更保守）
  const colon = normalized.indexOf(':')
  const boundary = normalized.search(/[/?#]/)
  if (colon === -1 || (boundary !== -1 && boundary < colon)) return { href, external: false }
  const scheme = normalized.slice(0, colon).toLowerCase()
  if (!ALLOWED_SCHEMES.has(scheme)) return null
  return { href, external: scheme !== 'mailto' }
}

/**
 * 图片地址：只有 http、https 与相对地址（`data:` 等不行；mailto 不是图片）。
 */
export function safeImageSrc(raw: unknown): string | null {
  const link = safeLink(raw)
  if (!link) return null
  return /^mailto:/i.test(stripInvisible(decodeEntities(link.href))) ? null : link.href
}

/**
 * 站点域名（去掉开头的 `www.`），用于来源列表与引用的说明；不是 http、https 的地址返回空字符串。
 */
export function hostOf(raw: unknown): string {
  const link = safeLink(raw)
  if (!link?.external) return ''
  try {
    const url = new URL(link.href.startsWith('//') ? `https:${link.href}` : link.href)
    return url.hostname.replace(/^www\./i, '')
  } catch {
    return ''
  }
}
