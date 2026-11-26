/**
 * The page of a component or hook: summary, common uses, import, live examples with their code, props (by mode where
 * they differ), static members and the types they use. Hooks show their signature and options instead of props.
 *
 * The title and summary come from the manifest and show at once; the rest of the page is the data of the component in
 * the language of the page (`site/generated/components/<lang>/<Name>.json`), downloaded with the examples module when
 * the page opens. The code of the examples is downloaded when "Show code" is used.
 */
import { type ReactNode, useState } from 'react'
import {
  Box,
  Button,
  CodeBlock,
  type ComponentModeDoc,
  type ComponentPropDoc,
  type ComponentTypeDoc,
  DataTable,
  type DataTableColumn,
  type DocLanguage,
  ErrorState,
  Heading,
  HotkeysProvider,
  Inline,
  LocaleProvider,
  Section,
  Stack,
  Text,
} from 'vellum-ui'
import { Article, type PageContext } from '../article.tsx'
import { codeLoaders, componentDocLoader, type ExampleModule, exampleLoaders } from '../content.ts'
import type { Localized, SiteComponentDoc, SiteComponentInfo } from '../manifest.ts'
import { download, ExampleBoundary, inline, Prose, WithModule } from '../parts.tsx'
import { docFileOf, languageOf } from '../routes.ts'
import { TEXT, typeImports } from '../text.ts'

type Lang = { readonly lang: DocLanguage }
type ExampleDoc = SiteComponentDoc['examples'][number]
type PropDoc = Localized<ComponentPropDoc>

/** The sections of the examples, in order (each title is one section). */
function sectionsOf(examples: readonly ExampleDoc[]) {
  return [...new Set(examples.map((e) => e.section))]
}

/** The code of one example, downloaded with the code of the other examples of the component. */
function ExampleCode(props: Lang & { readonly component: string; readonly example: string }) {
  const t = TEXT[props.lang]
  const loader = codeLoaders.get(props.component)
  if (!loader) return <ErrorState size="sm" message={t.exampleMissing} />
  return (
    <WithModule
      id={`code/${props.component}`}
      loader={loader}
      failedTitle={t.loadFailed}
      failedMessage={t.loadFailedHint}
    >
      {(code) => (
        <CodeBlock copyable language="tsx" code={code[props.example] ?? ''} maxHeight="lg" />
      )}
    </WithModule>
  )
}

function ExampleView(
  props: Lang & {
    readonly component: string
    readonly example: ExampleDoc
    readonly module: ExampleModule
    /** A section with one example whose title is the section's shows no subheading (as the generated pages). */
    readonly showTitle: boolean
  },
) {
  const t = TEXT[props.lang]
  const { example, lang } = props
  const [showCode, setShowCode] = useState(false)
  const Demo = props.module[example.name]
  // Pointing at or focusing "Show code" starts the download, so the code is usually there by the click
  const prefetch = () => {
    const loader = codeLoaders.get(props.component)
    if (loader) void download(`code/${props.component}`, loader).catch(() => {})
  }
  return (
    <Stack gap={3} testId={`example-${example.name}`}>
      {(props.showTitle || example.description) && (
        <Stack gap={1}>
          {props.showTitle && <Heading level={3}>{example.title}</Heading>}
          {example.description && <Prose text={example.description} tone="secondary" size="sm" />}
        </Stack>
      )}
      {/* The canvas color behind the example, as on a real page */}
      <Box surface="canvas" radius="lg" padding={5}>
        <ExampleBoundary title={t.exampleFailed} message={t.exampleFailedHint}>
          {Demo ? (
            // The built-in texts of the example follow the language of the page; its hotkeys stay inside it. The
            // headings of the example are not part of the outline of the page
            <LocaleProvider locale={languageOf(lang).locale}>
              <HotkeysProvider>
                <div data-toc-skip="">
                  <Demo />
                </div>
              </HotkeysProvider>
            </LocaleProvider>
          ) : (
            <ErrorState size="sm" message={t.exampleMissing} />
          )}
        </ExampleBoundary>
      </Box>
      <Inline>
        <Button
          variant="text"
          size="sm"
          icon="code"
          aria-expanded={showCode}
          onPointerEnter={prefetch}
          onFocus={prefetch}
          onClick={() => setShowCode((v) => !v)}
        >
          {showCode ? t.hideCode : t.showCode}
        </Button>
      </Inline>
      {showCode && <ExampleCode component={props.component} example={example.name} lang={lang} />}
    </Stack>
  )
}

/** A block of the page with an `h2` title; the examples, modes and types inside it use `h3`. */
function Block(props: {
  readonly title: ReactNode
  readonly description?: ReactNode
  readonly children?: ReactNode
}) {
  return (
    <Section title={props.title} description={props.description} gap={4}>
      {props.children}
    </Section>
  )
}

function Examples(props: Lang & { readonly doc: SiteComponentDoc }) {
  const t = TEXT[props.lang]
  const { doc, lang } = props
  const loader = exampleLoaders.get(doc.name)
  if (!loader || doc.examples.length === 0) return <Text tone="secondary">{t.noExamples}</Text>
  const usesFrame = doc.demoFrame
  return (
    <WithModule
      id={`examples/${doc.name}`}
      loader={loader}
      failedTitle={t.loadFailed}
      failedMessage={t.loadFailedHint}
    >
      {(module) => (
        <Stack gap={7}>
          {sectionsOf(doc.examples).map((section) => {
            const list = doc.examples.filter((e) => e.section === section)
            return (
              <Block key={section} title={section}>
                {list.map((e) => (
                  <ExampleView
                    key={e.name}
                    component={doc.name}
                    example={e}
                    module={module}
                    lang={lang}
                    showTitle={list.length > 1 || e.title !== section}
                  />
                ))}
              </Block>
            )
          })}
          {usesFrame && (
            <Text as="p" tone="secondary" size="sm">
              {inline(t.demoFrame)}
            </Text>
          )}
        </Stack>
      )}
    </WithModule>
  )
}

const mono = (value: string) => (
  <Text as="code" mono size="sm">
    {value}
  </Text>
)

/** A props table (also the options of a hook and the fields of a type). */
function PropsTable(
  props: Lang & {
    readonly rows: readonly PropDoc[]
    readonly label: string
    readonly nameTitle: string
  },
) {
  const t = TEXT[props.lang]
  // Fixed widths for the short columns; the description takes the rest of the reading column
  const columns: readonly DataTableColumn<PropDoc>[] = [
    { key: 'name', title: props.nameTitle, render: (p) => mono(p.name), width: 208 },
    { key: 'type', title: t.colType, render: (p) => mono(p.type), width: 184 },
    {
      key: 'description',
      title: t.colDescription,
      render: (p) => <Text size="sm">{inline(p.description)}</Text>,
    },
    {
      key: 'default',
      title: t.colDefault,
      render: (p) => (p.default ? mono(p.default) : '—'),
      width: 104,
    },
    {
      key: 'required',
      title: t.colRequired,
      render: (p) => (p.required ? t.yes : t.no),
      width: 80,
    },
  ]
  // The page is already a surface: the table needs no Panel around it
  return (
    <DataTable<PropDoc>
      aria-label={props.label}
      rowKey={(p) => p.name}
      rows={props.rows}
      columns={columns}
    />
  )
}

/** Props with the notes below them (props shared by primitives, native attributes, no styles). */
function PropsBlock(
  props: Lang & {
    readonly rows: readonly PropDoc[]
    readonly base: boolean
    readonly native: string | null
    /** Components take no `style` / `className`; hooks have no appearance, so the note does not apply. */
    readonly styled: boolean
    readonly label: string
    readonly nameTitle: string
  },
) {
  const t = TEXT[props.lang]
  const notes = [
    props.base ? t.base : null,
    props.native ? t.native(props.native) : null,
    props.styled ? t.noStyle : null,
  ].filter((n): n is string => n !== null)
  return (
    <Stack gap={3}>
      {props.rows.length > 0 ? (
        <PropsTable
          rows={props.rows}
          lang={props.lang}
          label={props.label}
          nameTitle={props.nameTitle}
        />
      ) : (
        <Text tone="secondary">{props.native ? t.noOwnProps : t.noProps}</Text>
      )}
      {notes.length > 0 && (
        <Stack gap={1}>
          {notes.map((n) => (
            <Text key={n} as="p" tone="secondary" size="sm">
              {inline(n)}
            </Text>
          ))}
        </Stack>
      )}
    </Stack>
  )
}

function Modes(
  props: Lang & { readonly name: string; readonly modes: readonly Localized<ComponentModeDoc>[] },
) {
  const t = TEXT[props.lang]
  const { lang } = props
  if (!props.modes.length) return null
  return (
    <Block title={t.modes} description={t.modesIntro(props.name)}>
      {props.modes.map((m) => (
        <Stack key={m.title} gap={3}>
          <Heading level={3}>{inline(m.title)}</Heading>
          {m.description && <Prose text={m.description} tone="secondary" size="sm" />}
          <PropsTable rows={m.props} lang={lang} label={m.title} nameTitle={t.colName} />
        </Stack>
      ))}
    </Block>
  )
}

function Types(props: Lang & { readonly types: readonly Localized<ComponentTypeDoc>[] }) {
  const t = TEXT[props.lang]
  const { lang } = props
  if (!props.types.length) return null
  return (
    <Block title={t.types} description={inline(t.typesIntro(typeImports(props.types)))}>
      {props.types.map((type) => (
        <Stack key={type.name} gap={3} testId={`type-${type.name.replace(/<.*/, '')}`}>
          <Heading level={3}>{type.name}</Heading>
          {type.summary && <Prose text={type.summary} tone="secondary" size="sm" />}
          {type.definition !== null && (
            <CodeBlock language="ts" code={type.definition} maxHeight="md" />
          )}
          {type.values.length > 0 && (
            <Text as="p" tone="secondary" size="sm">
              {t.values}: {inline(type.values.map((v) => `\`${v}\``).join(', '))}
            </Text>
          )}
          {type.fields.length > 0 && (
            <PropsTable rows={type.fields} lang={lang} label={type.name} nameTitle={t.colField} />
          )}
        </Stack>
      ))}
    </Block>
  )
}

/** The body of a component page, from its data. */
function ComponentBody(props: Lang & { readonly doc: SiteComponentDoc }) {
  const t = TEXT[props.lang]
  const { doc, lang } = props
  const hook = doc.signature !== null
  return (
    <Stack gap={7}>
      {doc.usage && (
        <Text as="p" tone="secondary">
          <Text weight="semibold" tone="secondary">
            {t.commonUses}
          </Text>
          {lang === 'en' ? ' ' : ''}
          {inline(doc.usage)}
        </Text>
      )}
      <Block title={t.import}>
        <CodeBlock
          copyable
          language="ts"
          code={`import { ${doc.name} } from '${doc.entry}'`}
          maxHeight="sm"
        />
      </Block>
      {doc.signature && (
        <Block title={t.signature}>
          <CodeBlock language="ts" code={doc.signature} maxHeight="sm" />
        </Block>
      )}
      <Examples doc={doc} lang={lang} />
      {(!hook || doc.props.length > 0) && (
        <Block title={hook ? t.options : t.props}>
          <PropsBlock
            rows={doc.props}
            base={doc.base}
            native={doc.native}
            styled={!hook}
            label={hook ? t.options : t.props}
            nameTitle={hook ? t.colOption : t.colName}
            lang={lang}
          />
        </Block>
      )}
      <Modes name={doc.name} modes={doc.modes} lang={lang} />
      {doc.members.map((m) => (
        <Block key={m.name} title={m.name}>
          <Prose text={m.summary} tone="secondary" />
          {m.signature !== null ? (
            <CodeBlock language="ts" code={m.signature} maxHeight="sm" />
          ) : (
            <>
              <PropsBlock
                rows={m.props}
                base={m.base}
                native={m.native}
                styled
                label={m.name}
                nameTitle={t.colName}
                lang={lang}
              />
              <Modes name={m.name} modes={m.modes} lang={lang} />
            </>
          )}
        </Block>
      ))}
      <Types types={doc.types} lang={lang} />
    </Stack>
  )
}

/** Fails like a download that could not be made: the page has no data (shown with "Retry"). */
const missing = (name: string) => () =>
  Promise.reject(new Error(`No documentation data for ${name}`))

export function ComponentPage(
  props: Lang & { readonly info: SiteComponentInfo; readonly context: PageContext },
) {
  const t = TEXT[props.lang]
  const { info, lang } = props
  const page = { kind: 'component', name: info.name } as const
  const markdown = docFileOf(lang, page)
  // The examples module downloads together with the data of the page, not after it
  const examples = exampleLoaders.get(info.name)
  if (examples) void download(`examples/${info.name}`, examples).catch(() => {})
  return (
    <Article
      lang={lang}
      page={page}
      context={props.context}
      title={info.name}
      lede={<Prose text={info.summary[lang]} />}
      actions={
        markdown && (
          <Button variant="text" size="sm" icon="file-text" href={markdown}>
            {t.markdownSource}
          </Button>
        )
      }
      width="reference"
    >
      <WithModule
        id={`component/${lang}/${info.name}`}
        loader={componentDocLoader(lang, info.name) ?? missing(info.name)}
        failedTitle={t.loadFailed}
        failedMessage={t.loadFailedHint}
      >
        {(doc) => <ComponentBody doc={doc} lang={lang} />}
      </WithModule>
    </Article>
  )
}
