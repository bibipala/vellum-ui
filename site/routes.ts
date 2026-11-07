/**
 * Routes of the documentation site and the mapping between routes and the Markdown files of the package.
 *
 * The site uses hash routing (GitHub Pages has no server rewrites) with the language first, so that every page can
 * be linked in both languages: `#/en/components/Select`, `#/zh/api/theme`, `#/en/guides/conventions#modes`. A second
 * `#` inside the hash is an anchor: the heading of the page whose slug it is.
 *
 * Pure functions only (no DOM, no Vite): the browser code, the build step and the tests share them.
 */
import type { DocLanguage } from 'vellum-ui'

/** A language of the site: the route segment, the folder under `docs/`, its label and the locale of the library. */
export interface SiteLanguage {
  readonly lang: DocLanguage
  readonly dir: string
  readonly label: string
  readonly locale: 'en-US' | 'zh-CN'
  /** Value of the `lang` attribute of the document. */
  readonly htmlLang: string
}

export const LANGUAGES: readonly SiteLanguage[] = [
  { lang: 'en', dir: 'en-US', label: 'English', locale: 'en-US', htmlLang: 'en' },
  { lang: 'zh', dir: 'zh-CN', label: '简体中文', locale: 'zh-CN', htmlLang: 'zh-CN' },
]

export const languageOf = (lang: DocLanguage): SiteLanguage =>
  LANGUAGES.find((l) => l.lang === lang) ?? (LANGUAGES[0] as SiteLanguage)

export const isLanguage = (value: string): value is DocLanguage =>
  LANGUAGES.some((l) => l.lang === value)

/** A page of the site, without its language. */
export type SitePage =
  | { readonly kind: 'home' }
  | { readonly kind: 'component'; readonly name: string }
  | { readonly kind: 'guide'; readonly slug: string }
  | { readonly kind: 'recipe'; readonly name: string }
  | { readonly kind: 'api'; readonly slug: string }
  | { readonly kind: 'tokens' }
  /** A path that is not a page; shown as "not found". */
  | { readonly kind: 'missing'; readonly path: string }

/** A route: the language, the page and an optional anchor (the slug of a heading). */
export interface Route {
  readonly lang: DocLanguage
  readonly page: SitePage
  readonly anchor: string | null
}

/** Folders of `docs/<lang>/` whose files are one page each, and the page they map to. */
const FOLDERS = {
  components: (name: string): SitePage => ({ kind: 'component', name }),
  guides: (slug: string): SitePage => ({ kind: 'guide', slug }),
  recipes: (name: string): SitePage => ({ kind: 'recipe', name }),
  api: (slug: string): SitePage => ({ kind: 'api', slug }),
} as const

const isFolder = (s: string): s is keyof typeof FOLDERS => Object.hasOwn(FOLDERS, s)

/** Path of a page inside the language: `''`, `components/Select`, `tokens`. */
export function pagePath(page: SitePage): string {
  switch (page.kind) {
    case 'home':
      return ''
    case 'component':
      return `components/${page.name}`
    case 'guide':
      return `guides/${page.slug}`
    case 'recipe':
      return `recipes/${page.name}`
    case 'api':
      return `api/${page.slug}`
    case 'tokens':
      return 'tokens'
    case 'missing':
      return page.path
  }
}

/** The page of a path inside the language (the inverse of pagePath). */
export function pageOfPath(path: string): SitePage {
  const parts = path.split('/').filter(Boolean)
  const [first = '', second, ...rest] = parts
  if (parts.length === 0) return { kind: 'home' }
  if (parts.length === 1 && first === 'tokens') return { kind: 'tokens' }
  if (second !== undefined && rest.length === 0 && isFolder(first)) return FOLDERS[first](second)
  return { kind: 'missing', path: parts.join('/') }
}

/** The hash of a route, such as `#/en/components/Select` or `#/zh/api/theme#extendtheme`. */
export function hrefOf(route: {
  readonly lang: DocLanguage
  readonly page: SitePage
  readonly anchor?: string | null
}): string {
  const path = pagePath(route.page)
    .split('/')
    .map((s) => encodeURIComponent(s))
    .join('/')
  return `#/${route.lang}${path ? `/${path}` : ''}${route.anchor ? `#${encodeURIComponent(route.anchor)}` : ''}`
}

/**
 * Parses `location.hash`. Returns null when the hash does not start with a language (empty, `#/`, an old or a
 * foreign link): the site then redirects to the same path in the preferred language.
 */
export function parseHash(hash: string): Route | null {
  const raw = hash.replace(/^#/, '')
  const cut = raw.indexOf('#')
  const pathPart = cut < 0 ? raw : raw.slice(0, cut)
  const anchorPart = cut < 0 ? '' : raw.slice(cut + 1)
  const segments = pathPart
    .split('/')
    .filter(Boolean)
    .map((s) => safeDecode(s))
  const [lang, ...rest] = segments
  if (lang === undefined || !isLanguage(lang)) return null
  return {
    lang,
    page: pageOfPath(rest.join('/')),
    anchor: anchorPart ? safeDecode(anchorPart) : null,
  }
}

/** The path of a hash without its language (for redirecting links that have none). */
export function pathWithoutLanguage(hash: string): string {
  const raw = hash.replace(/^#/, '').split('#')[0] ?? ''
  return raw
    .split('/')
    .filter(Boolean)
    .map((s) => safeDecode(s))
    .join('/')
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

/** The Markdown file of a page in the package (`docs/en-US/components/Select.md`), or null for a missing page. */
export function docFileOf(lang: DocLanguage, page: SitePage): string | null {
  const dir = `docs/${languageOf(lang).dir}`
  switch (page.kind) {
    case 'home':
      return `${dir}/README.md`
    case 'tokens':
      return `${dir}/tokens.md`
    case 'missing':
      return null
    default:
      return `${dir}/${pagePath(page)}.md`
  }
}

/**
 * The page of a Markdown file of the package (a path relative to the package root, with `/`), or null when the file
 * is not a page of the site (such as `docs/README.md`, the entry that only chooses a language).
 */
export function routeOfDocFile(file: string): { lang: DocLanguage; page: SitePage } | null {
  const m = /^docs\/([^/]+)\/(.+)\.md$/.exec(file)
  if (!m) return null
  const language = LANGUAGES.find((l) => l.dir === m[1])
  if (!language) return null
  const rest = m[2] as string
  if (rest === 'README') return { lang: language.lang, page: { kind: 'home' } }
  const page = pageOfPath(rest)
  return page.kind === 'missing' ? null : { lang: language.lang, page }
}

// —— Static files ——

/**
 * Files of the package that the site also publishes as they are, at the same relative paths (the build copies them
 * into `site/dist/`): the entry point for coding agents and the files it links to. The whole `docs/` folder is
 * published too (the Markdown pages and `components.json`).
 */
export const STATIC_FILES: readonly string[] = [
  'llms.txt',
  'README.md',
  'README.zh-CN.md',
  'MIGRATION.md',
  'LICENSE',
]
export const STATIC_DIRS: readonly string[] = ['docs']

/** Whether a package path is published as a static file of the site. */
export const isStaticFile = (path: string): boolean =>
  STATIC_FILES.includes(path) || STATIC_DIRS.some((d) => path.startsWith(`${d}/`))

/** The repository of the library, for links to files that the site does not publish (CONTRIBUTING.md, sources). */
export const REPOSITORY_URL = 'https://github.com/bibipala/vellum-ui'

// —— Markdown ——

/** A Markdown page prepared for the site: its title (the first `#` heading) and the rest. */
export interface PreparedMarkdown {
  readonly title: string
  readonly body: string
}

/**
 * Prepares a Markdown file of the package for the site: drops the generated `<!-- … -->` header and the language
 * switch above the title (the site has its own), takes the first `#` heading as the title, and rewrites the links of
 * the rest (see rewriteLinks).
 */
export function prepareMarkdown(markdown: string, file: string): PreparedMarkdown {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  let i = 0
  let title = ''
  // Above the title only the header comment, the language switch and blank lines are expected
  for (; i < lines.length; i++) {
    const line = (lines[i] ?? '').trim()
    if (line === '' || /^<!--.*-->$/.test(line) || LANGUAGE_SWITCH.test(line)) continue
    const h = /^#\s+(.+?)\s*#*$/.exec(line)
    if (h) {
      title = h[1] as string
      i++
    }
    break
  }
  const body = lines.slice(i).join('\n').trim()
  return { title, body: rewriteLinks(body, file) }
}

/** `**English** | [简体中文](…)`: labels separated by `|`, the current one bold, the others links. */
const LANGUAGE_SWITCH =
  /^(?:\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))(?:\s*\|\s*(?:\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)))+$/

/** A link target in Markdown: `](target)` or `](target "title")`. */
const LINK = /(\]\()([^)\s]+)((?:\s+"[^"]*")?\))/g

/**
 * Rewrites the relative links of a Markdown file of the package (`file`, relative to the package root) for the site:
 * - a page of the site (`../components/Select.md`, `api/theme.md#usetheme`) → its hash route (`#/en/components/Select`);
 * - an anchor in the same page (`#states`) → the route of this page with the anchor;
 * - a file the site publishes (README.md, MIGRATION.md, llms.txt, components.json) → its path from the site root;
 * - any other file of the package → its page in the repository.
 *
 * Absolute addresses (`https:`, `mailto:`) stay as they are; links inside code (fenced blocks and inline code) are
 * not touched.
 */
export function rewriteLinks(markdown: string, file: string): string {
  const here = routeOfDocFile(file)
  const dir = file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : ''
  const rewrite = (target: string): string => {
    if (/^[a-z][a-z\d+.-]*:/i.test(target) || target.startsWith('/')) return target
    const hashAt = target.indexOf('#')
    const pathPart = hashAt < 0 ? target : target.slice(0, hashAt)
    const anchor = hashAt < 0 ? '' : target.slice(hashAt + 1)
    if (!pathPart) return here ? hrefOf({ ...here, anchor: anchor || null }) : target
    const resolved = normalizePath(dir ? `${dir}/${pathPart}` : pathPart)
    if (resolved === null) return target
    const route = routeOfDocFile(resolved)
    if (route) return hrefOf({ ...route, anchor: anchor || null })
    const suffix = anchor ? `#${anchor}` : ''
    if (isStaticFile(resolved)) return `${resolved}${suffix}`
    return `${REPOSITORY_URL}/blob/main/${resolved}${suffix}`
  }
  return mapProse(markdown, (prose) =>
    prose.replace(LINK, (_m, open: string, target: string, close: string) =>
      [open, rewrite(target), close].join(''),
    ),
  )
}

/** Resolves `.` and `..` in a relative posix path; null when it leaves the package. */
function normalizePath(path: string): string | null {
  const out: string[] = []
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') {
      if (!out.length) return null
      out.pop()
    } else out.push(part)
  }
  return out.join('/')
}

/** Applies `fn` to the lines of a Markdown text that are not inside (or delimiting) a fenced code block. */
function mapProseLines(markdown: string, fn: (line: string) => string): string {
  let fence: string | null = null
  return markdown
    .split('\n')
    .map((line) => {
      const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1]
      if (fence !== null) {
        if (marker && marker[0] === fence[0] && marker.length >= fence.length) fence = null
        return line
      }
      if (marker) {
        fence = marker
        return line
      }
      return fn(line)
    })
    .join('\n')
}

/** Applies `fn` to the prose of a Markdown text: everything except fenced code blocks and inline code spans. */
const mapProse = (markdown: string, fn: (prose: string) => string): string =>
  mapProseLines(markdown, (line) => mapOutsideInlineCode(line, fn))

/** Splits a line at inline code spans (a run of backticks up to the next run of the same length). */
function mapOutsideInlineCode(line: string, fn: (prose: string) => string): string {
  let out = ''
  let prose = ''
  let i = 0
  while (i < line.length) {
    if (line[i] !== '`') {
      prose += line[i]
      i++
      continue
    }
    let n = 0
    while (line[i + n] === '`') n++
    const ticks = '`'.repeat(n)
    let close = line.indexOf(ticks, i + n)
    // The closing run must have exactly the same length
    while (close >= 0 && line[close + n] === '`') close = line.indexOf(ticks, close + n + 1)
    if (close < 0) {
      prose += ticks
      i += n
      continue
    }
    out += fn(prose) + line.slice(i, close + n)
    prose = ''
    i = close + n
  }
  return out + fn(prose)
}

/**
 * The anchor of a heading, as GitHub writes it: lower case, punctuation removed, spaces as `-`
 * (`If you know Ant Design` → `if-you-know-ant-design`, `extendTheme` → `extendtheme`).
 */
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-')
}

/** The `##` headings of a Markdown text outside code blocks, in order (for search and anchors). */
export function headingsOf(markdown: string, level = 2): string[] {
  const out: string[] = []
  const heading = new RegExp(`^${'#'.repeat(level)}\\s+(.+?)\\s*#*$`)
  mapProseLines(markdown, (line) => {
    const m = heading.exec(line)
    if (m) out.push((m[1] as string).replace(/`/g, ''))
    return line
  })
  return out
}
