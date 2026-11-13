/**
 * Pages written in Markdown: the overview (home), guides, the API reference, the design tokens and the recipes. The
 * text comes from the package; the title becomes the page title and the links point to the routes of the site.
 * Recipe pages also render the recipe itself above its code.
 */
import {
  Button,
  type DocLanguage,
  EmptyState,
  ErrorState,
  HotkeysProvider,
  LocaleProvider,
  Markdown,
} from 'vellum-ui'
import { Article, NO_CONTEXT, type PageContext } from '../article.tsx'
import { markdownFiles, recipeLoaders } from '../content.ts'
import { ExampleBoundary, WithModule } from '../parts.tsx'
import {
  docFileOf,
  hrefOf,
  languageOf,
  type PreparedMarkdown,
  prepareMarkdown,
  type SitePage,
} from '../routes.ts'
import styles from '../site.module.css'
import { TEXT } from '../text.ts'

/** Prepared pages by file: the text of a page does not change while the site runs. */
const prepared = new Map<string, PreparedMarkdown>()

/** The prepared Markdown of a page, or null when the package has no such file. */
export function markdownOf(lang: DocLanguage, page: SitePage): PreparedMarkdown | null {
  const file = docFileOf(lang, page)
  const text = file === null ? undefined : markdownFiles.get(file)
  if (file === null || text === undefined) return null
  let md = prepared.get(file)
  if (!md) {
    md = prepareMarkdown(text, file)
    prepared.set(file, md)
  }
  return md
}

/**
 * Splits off the lede: the first paragraph, when the page starts with plain text (not a heading, list, table, quote,
 * code or HTML). Guides open with their summary, the overview with its introduction.
 */
export function splitLede(body: string): [string | null, string] {
  const text = body.trimStart()
  const end = text.search(/\n\s*\n/)
  const first = end < 0 ? text : text.slice(0, end)
  if (!first || /^(?:#|\||[-*+] |\d+\. |>|```|~~~|<)/.test(first)) return [null, body]
  return [first.trim(), end < 0 ? '' : text.slice(end).trimStart()]
}

/** Pages written as reading text use the prose column; references (API, tokens) the wider one. */
const widthOf = (page: SitePage) =>
  page.kind === 'api' || page.kind === 'tokens' ? 'reference' : 'prose'

export function MarkdownPage(props: {
  readonly lang: DocLanguage
  readonly page: SitePage
  readonly context: PageContext
  readonly title: string
  readonly body: string
}) {
  const [lede, rest] = splitLede(props.body)
  return (
    <Article
      lang={props.lang}
      page={props.page}
      context={props.context}
      title={props.title}
      lede={lede && <Markdown content={lede} />}
      width={widthOf(props.page)}
    >
      <Markdown content={rest} />
    </Article>
  )
}

/** Splits a recipe page before its first code block: the description goes above the live recipe, the code below. */
function splitAtCode(body: string): [string, string] {
  const m = /^(?:```|~~~)/m.exec(body)
  return m ? [body.slice(0, m.index).trim(), body.slice(m.index)] : [body, '']
}

export function RecipePage(props: {
  readonly lang: DocLanguage
  readonly page: SitePage
  readonly context: PageContext
  readonly name: string
  readonly title: string
  readonly body: string
}) {
  const t = TEXT[props.lang]
  const [intro, code] = splitAtCode(props.body)
  const [lede, rest] = splitLede(intro)
  const loader = recipeLoaders.get(props.name)
  return (
    <Article
      lang={props.lang}
      page={props.page}
      context={props.context}
      title={props.title}
      lede={lede && <Markdown content={lede} />}
      width="wide"
    >
      {rest && <Markdown content={rest} />}
      {loader && (
        // The headings of the live recipe are not part of the outline of this page
        <section aria-label={t.livePreview} className={styles.stage} data-toc-skip="">
          <WithModule
            id={`recipes/${props.name}`}
            loader={loader}
            failedTitle={t.loadFailed}
            failedMessage={t.loadFailedHint}
          >
            {(module) => {
              const Recipe = module[props.name]
              return (
                <ExampleBoundary title={t.exampleFailed} message={t.exampleFailedHint}>
                  {Recipe ? (
                    // As in the examples: the built-in texts follow the page, and the shortcuts of the recipe (such as
                    // Mod+K in AppFrame) stay inside it instead of clashing with those of the site
                    <LocaleProvider locale={languageOf(props.lang).locale}>
                      <HotkeysProvider>
                        <Recipe />
                      </HotkeysProvider>
                    </LocaleProvider>
                  ) : (
                    <ErrorState size="sm" message={t.exampleMissing} />
                  )}
                </ExampleBoundary>
              )
            }}
          </WithModule>
        </section>
      )}
      {code && <Markdown content={code} />}
    </Article>
  )
}

/** A route without a page. */
export function NotFoundPage(props: { readonly lang: DocLanguage }) {
  const t = TEXT[props.lang]
  return (
    <Article
      lang={props.lang}
      page={{ kind: 'missing', path: '' }}
      context={NO_CONTEXT}
      title={t.notFound}
      width="prose"
    >
      <EmptyState
        icon="search"
        title={t.notFoundHint}
        action={
          <Button variant="primary" href={hrefOf({ lang: props.lang, page: { kind: 'home' } })}>
            {t.backHome}
          </Button>
        }
      />
    </Article>
  )
}
