/// <reference types="vite/client" />
/**
 * The documentation the site presents, read from the package at build time with Vite's `import.meta.glob`: the
 * component data (`docs/components.json`), the Markdown pages (overview, guides, recipes, API reference, tokens), and
 * loaders for the examples and recipes, which are only downloaded when their page is opened.
 *
 * Guides and recipes are found by file name, so pages added to `docs/<lang>/guides/` and `examples/recipes/` appear
 * without changing the site; with none of them, their navigation groups are simply absent.
 */
import type { ComponentType } from 'react'
import type { ComponentDocsJson, DocLanguage, DocText } from 'vellum-ui'
import componentsJson from '../docs/components.json' with { type: 'json' }
import { headingsOf, LANGUAGES, prepareMarkdown, type SitePage } from './routes.ts'

/** All documented components and hooks, ordered by category and then by name. */
export const components: ComponentDocsJson = componentsJson

/** Categories in the order of the components (the `en` text is the identifier). */
export const categories: readonly DocText[] = [
  ...new Map(components.map((c) => [c.category.en, c.category])).values(),
]

/** Package-relative path of a globbed file: the keys start with `../` (relative to this folder). */
const packagePath = (key: string) => key.replace(/^\.\.\//, '')

/**
 * Markdown pages: package path → text. Component pages are rendered from `components.json` instead, so their
 * Markdown files are not part of the bundle (they are published as static files).
 */
export const markdownFiles: ReadonlyMap<string, string> = new Map(
  Object.entries(
    import.meta.glob<string>(
      [
        '../docs/*/README.md',
        '../docs/*/tokens.md',
        '../docs/*/api/*.md',
        '../docs/*/guides/*.md',
        '../docs/*/recipes/*.md',
      ],
      { query: '?raw', import: 'default', eager: true },
    ),
  ).map(([key, text]) => [packagePath(key), text]),
)

/** Exports of an example or recipe module. */
export type ExampleModule = Readonly<Record<string, ComponentType | undefined>>

/** File name without the folder and suffix: `../examples/Select.examples.tsx` → `Select`. */
const nameOf = (key: string, suffix: string) => key.slice(key.lastIndexOf('/') + 1, -suffix.length)

const loaders = (modules: Record<string, () => Promise<ExampleModule>>, suffix: string) =>
  new Map(Object.entries(modules).map(([key, load]) => [nameOf(key, suffix), load]))

/** Example modules by component name, loaded when the page of the component is opened. */
export const exampleLoaders: ReadonlyMap<string, () => Promise<ExampleModule>> = loaders(
  import.meta.glob<ExampleModule>('../examples/*.examples.tsx'),
  '.examples.tsx',
)

/** Recipe modules by name (`examples/recipes/<Name>.recipe.tsx`, exporting one function `<Name>`). */
export const recipeLoaders: ReadonlyMap<string, () => Promise<ExampleModule>> = loaders(
  import.meta.glob<ExampleModule>('../examples/recipes/*.recipe.tsx'),
  '.recipe.tsx',
)

/** A page written in Markdown, in both languages. */
export interface MarkdownPageInfo {
  readonly page: SitePage
  readonly title: DocText
  /** The `##` headings in both languages (the API reference: one per export), for search and anchors. */
  readonly headings: Readonly<Record<DocLanguage, readonly string[]>>
}

const fileIn = (lang: DocLanguage, rest: string) =>
  `docs/${LANGUAGES.find((l) => l.lang === lang)?.dir ?? ''}/${rest}`

function info(page: SitePage, rest: string): MarkdownPageInfo | null {
  const en = markdownFiles.get(fileIn('en', rest))
  const zh = markdownFiles.get(fileIn('zh', rest))
  if (en === undefined || zh === undefined) return null
  const pen = prepareMarkdown(en, fileIn('en', rest))
  const pzh = prepareMarkdown(zh, fileIn('zh', rest))
  return {
    page,
    title: { en: pen.title, zh: pzh.title },
    headings: { en: headingsOf(pen.body), zh: headingsOf(pzh.body) },
  }
}

/**
 * The pages of one folder (`guides`, `recipes`, `api`) that exist in both languages, in the order the overview
 * lists them (the generator decides that order); pages the overview does not list follow by name.
 */
function folder(name: 'guides' | 'recipes' | 'api', page: (slug: string) => SitePage) {
  const prefix = fileIn('en', `${name}/`)
  const slugs = [...markdownFiles.keys()]
    .filter((f) => f.startsWith(prefix) && !f.slice(prefix.length).includes('/'))
    .map((f) => f.slice(prefix.length, -'.md'.length))
  const overview = markdownFiles.get(fileIn('en', 'README.md')) ?? ''
  const listed = [...overview.matchAll(new RegExp(`\\]\\(${name}/([^)#]+)\\.md`, 'g'))].map(
    (m) => m[1] as string,
  )
  const rank = (s: string) => {
    const i = listed.indexOf(s)
    return i < 0 ? listed.length : i
  }
  return slugs
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .map((s) => info(page(s), `${name}/${s}.md`))
    .filter((p): p is MarkdownPageInfo => p !== null)
}

export const homePage = info({ kind: 'home' }, 'README.md')
export const tokensPage = info({ kind: 'tokens' }, 'tokens.md')
export const guidePages = folder('guides', (slug) => ({ kind: 'guide', slug }))
export const recipePages = folder('recipes', (name) => ({ kind: 'recipe', name }))
export const apiPages = folder('api', (slug) => ({ kind: 'api', slug }))
