/**
 * Pages written in Markdown: the overview (home), guides, the API reference, the design tokens and the recipes. The
 * text comes from the package; the title becomes the page title and the links point to the routes of the site.
 * Recipe pages also render the recipe itself above its code.
 *
 * The title is known from the manifest and shows at once; the text of the page (its lede and body) is downloaded for
 * the route and language when the page opens.
 */
import type { ReactNode } from 'react'
import {
  Button,
  type DocLanguage,
  EmptyState,
  ErrorState,
  HotkeysProvider,
  Loading,
  LocaleProvider,
} from 'vellum-ui'
import { Markdown } from 'vellum-ui/ai'
import {
  Article,
  ArticleLede,
  type ArticleWidth,
  NO_CONTEXT,
  type PageContext,
} from '../article.tsx'
import { recipeLoaders } from '../content.ts'
import { Download, Downloaded, download, ExampleBoundary, WithModule } from '../parts.tsx'
import {
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

function preparedOf(file: string, text: string): PreparedMarkdown {
  let md = prepared.get(file)
  if (!md) {
    md = prepareMarkdown(text, file)
    prepared.set(file, md)
  }
  return md
}

/** The Markdown file of a page in one language and its download (see markdownLoaderOf in content.ts). */
export interface MarkdownSource {
  readonly file: string
  readonly load: () => Promise<string>
}

/**
 * Downloads the Markdown of a page and shows it in the header (the lede) and the body: `body` receives the prepared
 * text without the lede.
 */
function MarkdownArticle(props: {
  readonly lang: DocLanguage
  readonly page: SitePage
  readonly context: PageContext
  readonly title: string
  readonly source: MarkdownSource
  readonly width: ArticleWidth
  /** Splits the body before the lede is taken from it (a recipe keeps its code apart). */
  readonly split?: (body: string) => readonly [string, string]
  readonly body: (rest: string, after: string) => ReactNode
}) {
  const t = TEXT[props.lang]
  const { file } = props.source
  const parts = (text: string) => {
    const [before, after] = props.split
      ? props.split(preparedOf(file, text).body)
      : [preparedOf(file, text).body, '']
    const [lede, rest] = splitLede(before)
    return { lede, rest, after }
  }
  return (
    <Download id={`markdown/${file}`} loader={props.source.load}>
      <Article
        lang={props.lang}
        page={props.page}
        context={props.context}
        title={props.title}
        ledeSlot={
          <Downloaded<string>>
            {(text) => {
              const { lede } = parts(text)
              return (
                lede && (
                  <ArticleLede>
                    <Markdown content={lede} />
                  </ArticleLede>
                )
              )
            }}
          </Downloaded>
        }
        width={props.width}
      >
        <Downloaded<string>
          fallback={<Loading />}
          failed={{ title: t.loadFailed, message: t.loadFailedHint }}
        >
          {(text) => {
            const { rest, after } = parts(text)
            return props.body(rest, after)
          }}
        </Downloaded>
      </Article>
    </Download>
  )
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
  readonly source: MarkdownSource
}) {
  return (
    <MarkdownArticle
      lang={props.lang}
      page={props.page}
      context={props.context}
      title={props.title}
      source={props.source}
      width={widthOf(props.page)}
      body={(rest) => <Markdown content={rest} />}
    />
  )
}

/** Splits a recipe page before its first code block: the description goes above the live recipe, the code below. */
function splitAtCode(body: string): readonly [string, string] {
  const m = /^(?:```|~~~)/m.exec(body)
  return m ? [body.slice(0, m.index).trim(), body.slice(m.index)] : [body, '']
}

export function RecipePage(props: {
  readonly lang: DocLanguage
  readonly page: SitePage
  readonly context: PageContext
  readonly name: string
  readonly title: string
  readonly source: MarkdownSource
}) {
  const t = TEXT[props.lang]
  const loader = recipeLoaders.get(props.name)
  const recipeId = `recipes/${props.name}`
  // The live recipe downloads together with the text, not after it
  if (loader) void download(recipeId, loader).catch(() => {})
  return (
    <MarkdownArticle
      lang={props.lang}
      page={props.page}
      context={props.context}
      title={props.title}
      source={props.source}
      width="wide"
      split={splitAtCode}
      body={(rest, code) => (
        <>
          {rest && <Markdown content={rest} />}
          {loader && (
            // The headings of the live recipe are not part of the outline of this page
            <section aria-label={t.livePreview} className={styles.stage} data-toc-skip="">
              <WithModule
                id={recipeId}
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
        </>
      )}
    />
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
