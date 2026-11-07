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
  LocaleProvider,
  Markdown,
  Page,
  Panel,
} from 'vellum-ui'
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

export function MarkdownPage(props: {
  readonly lang: DocLanguage
  readonly title: string
  readonly body: string
}) {
  return (
    <Page title={props.title}>
      <Markdown content={props.body} />
    </Page>
  )
}

/** Splits a recipe page before its first code block: the description goes above the live recipe, the code below. */
function splitAtCode(body: string): [string, string] {
  const m = /^(?:```|~~~)/m.exec(body)
  return m ? [body.slice(0, m.index).trim(), body.slice(m.index)] : [body, '']
}

export function RecipePage(props: {
  readonly lang: DocLanguage
  readonly name: string
  readonly title: string
  readonly body: string
}) {
  const t = TEXT[props.lang]
  const [intro, code] = splitAtCode(props.body)
  const loader = recipeLoaders.get(props.name)
  return (
    <Page title={props.title}>
      <Markdown content={intro} />
      {loader && (
        <section aria-label={t.livePreview} className={styles.stage}>
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
                    <LocaleProvider locale={languageOf(props.lang).locale}>
                      <Recipe />
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
    </Page>
  )
}

/** A route without a page. */
export function NotFoundPage(props: { readonly lang: DocLanguage }) {
  const t = TEXT[props.lang]
  return (
    <Page title={t.notFound}>
      <Panel padding={7}>
        <EmptyState
          icon="search"
          title={t.notFoundHint}
          action={
            <Button variant="primary" href={hrefOf({ lang: props.lang, page: { kind: 'home' } })}>
              {t.backHome}
            </Button>
          }
        />
      </Panel>
    </Page>
  )
}
