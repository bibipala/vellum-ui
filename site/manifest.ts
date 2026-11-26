/**
 * The data of the documentation site that `pnpm docs:gen` writes into `site/generated/` (scripts/docs/render/site.ts),
 * next to the published documentation. Internal to the site: not part of the package.
 *
 * - `manifest.json` is all the site needs before a page opens: the order of the pages, their localized titles and
 *   `##` headings (search and anchors), the level of each recipe, and for each component its entry and the texts that
 *   search matches (summary and common uses).
 * - `components/<lang>/<Name>.json` is the page of one component in one language, without the code of its examples.
 * - `code/<Name>.json` is the code of the examples of one component, shown when "Show code" is used.
 *
 * The Markdown pages (overview, guides, recipes, API reference, tokens) are the files of `docs/<lang>/`, loaded per
 * route and language.
 */
import type { ComponentDoc, ComponentExampleDoc, DocLanguage, DocText } from 'vellum-ui'

/** A Markdown page: its title (the first `#` heading) and its `##` headings, in both languages. */
export interface SiteMarkdownInfo {
  readonly title: DocText
  readonly headings: Readonly<Record<DocLanguage, readonly string[]>>
}

/** What search and the navigation know about a component before its page is opened. */
export interface SiteComponentInfo {
  readonly name: string
  /** The entry that exports it, such as `vellum-ui/charts`. */
  readonly entry: string
  /** The `en` text of its category (the identifier of the category). */
  readonly category: string
  readonly summary: DocText
  readonly usage: DocText
}

export interface SiteManifest {
  readonly home: SiteMarkdownInfo
  readonly tokens: SiteMarkdownInfo
  /** In the order of the overview. */
  readonly guides: readonly (SiteMarkdownInfo & { readonly slug: string })[]
  /** Basic, then advanced, then scenarios; by name within a level. */
  readonly recipes: readonly (SiteMarkdownInfo & {
    readonly name: string
    readonly level: string
  })[]
  readonly api: readonly (SiteMarkdownInfo & { readonly slug: string })[]
  /** The categories that have components, in order. */
  readonly categories: readonly DocText[]
  /** By category, then by name. */
  readonly components: readonly SiteComponentInfo[]
}

/** A documentation type with every `{ en, zh }` text replaced by the text of one language. */
export type Localized<T> = T extends DocText
  ? string
  : T extends readonly (infer U)[]
    ? readonly Localized<U>[]
    : T extends object
      ? { readonly [K in keyof T]: Localized<T[K]> }
      : T

/** The page of a component in one language (`components/<lang>/<Name>.json`). */
export type SiteComponentDoc = Localized<
  Omit<ComponentDoc, 'category' | 'summary' | 'examples'>
> & {
  readonly examples: readonly Localized<Omit<ComponentExampleDoc, 'code'>>[]
  /** An example uses DemoFrame: the page explains it below the examples. */
  readonly demoFrame: boolean
}

/** The code of the examples of a component by example name (`code/<Name>.json`). */
export type SiteExampleCode = Readonly<Record<string, string>>
