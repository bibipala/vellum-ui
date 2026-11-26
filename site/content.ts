/// <reference types="vite/client" />
/**
 * The documentation the site presents. Only the manifest (`site/generated/manifest.json`, see manifest.ts) is part of
 * the first download: the order of the pages, their titles and headings, the levels of the recipes and what search
 * needs about each component. Everything else is downloaded when its page opens, per route and language, through
 * Vite's `import.meta.glob`: the Markdown pages of `docs/<lang>/`, the data of a component page, the code of its
 * examples ("Show code"), and the example and recipe modules.
 *
 * `pnpm docs:gen` writes the manifest and the component data from the same model as the published documentation, so
 * pages added to `docs/<lang>/guides/` and `examples/recipes/` appear after generating; with none of them, their
 * navigation groups are simply absent.
 */
import type { ComponentType } from 'react'
import type { DocLanguage, DocText } from 'vellum-ui'
import manifestJson from './generated/manifest.json' with { type: 'json' }
import type {
  SiteComponentDoc,
  SiteComponentInfo,
  SiteExampleCode,
  SiteManifest,
  SiteMarkdownInfo,
} from './manifest.ts'
import { docFileOf, type SitePage } from './routes.ts'

/** What the site knows before any page has opened. */
export const manifest: SiteManifest = manifestJson

/** All documented components and hooks, ordered by category and then by name. */
export const components: readonly SiteComponentInfo[] = manifest.components

/** Categories in the order of the components (the `en` text is the identifier). */
export const categories: readonly DocText[] = manifest.categories

/** The category of a component. */
export const categoryOf = (c: SiteComponentInfo): DocText =>
  categories.find((x) => x.en === c.category) ?? { en: c.category, zh: c.category }

/** Package-relative path of a globbed file: the keys start with `../` (relative to this folder). */
const packagePath = (key: string) => key.replace(/^\.\.\//, '')

/**
 * Markdown pages: package path → download. Component pages are rendered from their data instead, so their Markdown
 * files are not part of the site (they are published as static files).
 */
export const markdownLoaders: ReadonlyMap<string, () => Promise<string>> = new Map(
  Object.entries(
    import.meta.glob<string>(
      [
        '../docs/*/README.md',
        '../docs/*/tokens.md',
        '../docs/*/api/*.md',
        '../docs/*/guides/*.md',
        '../docs/*/recipes/*.md',
      ],
      { query: '?raw', import: 'default' },
    ),
  ).map(([key, load]) => [packagePath(key), load]),
)

/** File name without the folder and suffix: `../examples/Select.examples.tsx` → `Select`. */
const nameOf = (key: string, suffix: string) => key.slice(key.lastIndexOf('/') + 1, -suffix.length)

const loaders = <T>(modules: Record<string, () => Promise<T>>, suffix: string) =>
  new Map(Object.entries(modules).map(([key, load]) => [nameOf(key, suffix), load]))

const componentDocs = import.meta.glob<SiteComponentDoc>('./generated/components/*/*.json', {
  import: 'default',
})

/** The data of the page of a component in one language, downloaded when the page opens. */
export const componentDocLoader = (
  lang: DocLanguage,
  name: string,
): (() => Promise<SiteComponentDoc>) | undefined =>
  componentDocs[`./generated/components/${lang}/${name}.json`]

/** The code of the examples of a component by component name, downloaded when "Show code" is used. */
export const codeLoaders: ReadonlyMap<string, () => Promise<SiteExampleCode>> = loaders(
  import.meta.glob<SiteExampleCode>('./generated/code/*.json', { import: 'default' }),
  '.json',
)

/** Exports of an example or recipe module. */
export type ExampleModule = Readonly<Record<string, ComponentType | undefined>>

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

const info = (page: SitePage, m: SiteMarkdownInfo): MarkdownPageInfo => ({
  page,
  title: m.title,
  headings: m.headings,
})

export const homePage: MarkdownPageInfo | null = info({ kind: 'home' }, manifest.home)
export const tokensPage: MarkdownPageInfo | null = info({ kind: 'tokens' }, manifest.tokens)
/** Guides, recipes and API pages in the order of the overview (the generator decides that order). */
export const guidePages: readonly MarkdownPageInfo[] = manifest.guides.map((g) =>
  info({ kind: 'guide', slug: g.slug }, g),
)
export const recipePages: readonly MarkdownPageInfo[] = manifest.recipes.map((r) =>
  info({ kind: 'recipe', name: r.name }, r),
)
export const apiPages: readonly MarkdownPageInfo[] = manifest.api.map((a) =>
  info({ kind: 'api', slug: a.slug }, a),
)

/** The level of each recipe, from its `@level`. Recipes the manifest does not list are `basic`. */
export type RecipeLevel = 'basic' | 'advanced' | 'scenario'
const RECIPE_LEVELS: readonly RecipeLevel[] = ['basic', 'advanced', 'scenario']
export const recipeLevels: ReadonlyMap<string, RecipeLevel> = new Map(
  manifest.recipes.map((r) => [r.name, RECIPE_LEVELS.find((l) => l === r.level) ?? 'basic']),
)
export const recipeLevelOf = (name: string): RecipeLevel => recipeLevels.get(name) ?? 'basic'

/** The Markdown page of a route, or null when it has none (component pages, missing pages). */
export function markdownPageOf(page: SitePage): MarkdownPageInfo | null {
  switch (page.kind) {
    case 'home':
      return homePage
    case 'tokens':
      return tokensPage
    case 'guide':
      return guidePages.find((p) => p.page.kind === 'guide' && p.page.slug === page.slug) ?? null
    case 'recipe':
      return recipePages.find((p) => p.page.kind === 'recipe' && p.page.name === page.name) ?? null
    case 'api':
      return apiPages.find((p) => p.page.kind === 'api' && p.page.slug === page.slug) ?? null
    default:
      return null
  }
}

/** The download of the Markdown of a page in one language, or undefined when the page has no Markdown file. */
export function markdownLoaderOf(
  lang: DocLanguage,
  page: SitePage,
): { readonly file: string; readonly load: () => Promise<string> } | undefined {
  const file = docFileOf(lang, page)
  const load = file === null ? undefined : markdownLoaders.get(file)
  return file !== null && load ? { file, load } : undefined
}
