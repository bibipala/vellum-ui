/**
 * The page of a component or hook, from `docs/components.json`: summary, common uses, import, live examples with
 * their code, props (by mode where they differ), static members and the types they use. Hooks show their signature
 * and options instead of props.
 */
import { type ReactNode, useState } from 'react'
import {
  Box,
  Button,
  CodeBlock,
  type ComponentDoc,
  type ComponentExampleDoc,
  type ComponentModeDoc,
  type ComponentPropDoc,
  type ComponentTypeDoc,
  DataTable,
  type DataTableColumn,
  type DocLanguage,
  ErrorState,
  Heading,
  HotkeysProvider,
  Icon,
  Inline,
  LocaleProvider,
  Page,
  Pill,
  Stack,
  Text,
} from 'vellum-ui'
import { type ExampleModule, exampleLoaders } from '../content.ts'
import { ExampleBoundary, inline, Prose, WithModule } from '../parts.tsx'
import { docFileOf, languageOf } from '../routes.ts'
import { TEXT } from '../text.ts'

type Lang = { readonly lang: DocLanguage }

/** The sections of the examples, in order; the `en` title identifies a section. */
function sectionsOf(examples: readonly ComponentExampleDoc[]) {
  return [...new Map(examples.map((e) => [e.section.en, e.section])).values()]
}

function ExampleView(
  props: Lang & {
    readonly example: ComponentExampleDoc
    readonly module: ExampleModule
    /** A section with one example whose title is the section's shows no subheading (as the generated pages). */
    readonly showTitle: boolean
  },
) {
  const t = TEXT[props.lang]
  const { example, lang } = props
  const [showCode, setShowCode] = useState(false)
  const Demo = props.module[example.name]
  return (
    <Stack gap={3} testId={`example-${example.name}`}>
      {(props.showTitle || example.description[lang]) && (
        <Stack gap={1}>
          {props.showTitle && <Heading level={3}>{example.title[lang]}</Heading>}
          {example.description[lang] && (
            <Prose text={example.description[lang]} tone="secondary" size="sm" />
          )}
        </Stack>
      )}
      {/* The canvas color behind the example, as on a real page */}
      <Box surface="canvas" radius="lg" padding={5}>
        <ExampleBoundary title={t.exampleFailed} message={t.exampleFailedHint}>
          {Demo ? (
            // The built-in texts of the example follow the language of the page; its hotkeys stay inside it
            <LocaleProvider locale={languageOf(lang).locale}>
              <HotkeysProvider>
                <Demo />
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
          onClick={() => setShowCode((v) => !v)}
        >
          {showCode ? t.hideCode : t.showCode}
        </Button>
      </Inline>
      {showCode && <CodeBlock copyable language="tsx" code={example.code} maxHeight="lg" />}
    </Stack>
  )
}

/**
 * A block of the page with an `h2` title. Not Section: its title is an `h2` at body size, and the page needs a
 * third level (examples, modes, types) below it; Heading has the levels and their sizes.
 */
function Block(props: {
  readonly title: ReactNode
  readonly description?: ReactNode
  readonly children?: ReactNode
}) {
  return (
    <Stack as="section" gap={4}>
      <Stack gap={1}>
        <Heading level={2}>{props.title}</Heading>
        {props.description && (
          <Text as="p" tone="secondary" size="sm">
            {props.description}
          </Text>
        )}
      </Stack>
      {props.children}
    </Stack>
  )
}

function Examples(props: Lang & { readonly doc: ComponentDoc }) {
  const t = TEXT[props.lang]
  const { doc, lang } = props
  const loader = exampleLoaders.get(doc.name)
  if (!loader || doc.examples.length === 0) return <Text tone="secondary">{t.noExamples}</Text>
  const usesFrame = doc.examples.some((e) => e.code.includes('DemoFrame'))
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
            const list = doc.examples.filter((e) => e.section.en === section.en)
            return (
              <Block key={section.en} title={section[lang]}>
                {list.map((e) => (
                  <ExampleView
                    key={e.name}
                    example={e}
                    module={module}
                    lang={lang}
                    showTitle={list.length > 1 || e.title[lang] !== section[lang]}
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
    readonly rows: readonly ComponentPropDoc[]
    readonly label: string
    readonly nameTitle: string
  },
) {
  const t = TEXT[props.lang]
  const { lang } = props
  const columns: readonly DataTableColumn<ComponentPropDoc>[] = [
    { key: 'name', title: props.nameTitle, render: (p) => mono(p.name), width: 220 },
    { key: 'type', title: t.colType, render: (p) => mono(p.type), width: 260 },
    {
      key: 'description',
      title: t.colDescription,
      render: (p) => <Text size="sm">{inline(p.description[lang])}</Text>,
    },
    {
      key: 'default',
      title: t.colDefault,
      render: (p) => (p.default ? mono(p.default) : '—'),
      width: 120,
    },
    {
      key: 'required',
      title: t.colRequired,
      render: (p) => (p.required ? t.yes : t.no),
      width: 96,
    },
  ]
  // The page is already a surface: the table needs no Panel around it
  return (
    <DataTable<ComponentPropDoc>
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
    readonly rows: readonly ComponentPropDoc[]
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
  props: Lang & { readonly name: string; readonly modes: readonly ComponentModeDoc[] },
) {
  const t = TEXT[props.lang]
  const { lang } = props
  if (!props.modes.length) return null
  return (
    <Block title={t.modes} description={t.modesIntro(props.name)}>
      {props.modes.map((m) => (
        <Stack key={m.title.en} gap={3}>
          <Heading level={3}>{inline(m.title[lang])}</Heading>
          {m.description[lang] && <Prose text={m.description[lang]} tone="secondary" size="sm" />}
          <PropsTable rows={m.props} lang={lang} label={m.title[lang]} nameTitle={t.colName} />
        </Stack>
      ))}
    </Block>
  )
}

function Types(props: Lang & { readonly types: readonly ComponentTypeDoc[] }) {
  const t = TEXT[props.lang]
  const { lang } = props
  if (!props.types.length) return null
  return (
    <Block title={t.types} description={inline(t.typesIntro)}>
      {props.types.map((type) => (
        <Stack key={type.name} gap={3} testId={`type-${type.name.replace(/<.*/, '')}`}>
          <Heading level={3}>{type.name}</Heading>
          {type.summary[lang] && <Prose text={type.summary[lang]} tone="secondary" size="sm" />}
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

export function ComponentPage(props: Lang & { readonly doc: ComponentDoc }) {
  const t = TEXT[props.lang]
  const { doc, lang } = props
  const hook = doc.signature !== null
  const markdown = docFileOf(lang, { kind: 'component', name: doc.name })
  return (
    <Page
      title={doc.name}
      actions={
        <Inline gap={2}>
          <Pill>{doc.category[lang]}</Pill>
          {markdown && (
            <Button variant="text" size="sm" icon="file-text" href={markdown}>
              {t.markdownSource}
            </Button>
          )}
        </Inline>
      }
    >
      <Stack gap={7}>
        <Stack gap={3}>
          <Prose text={doc.summary[lang]} />
          {doc.usage[lang] && (
            <Text as="p" tone="secondary">
              <Text weight="semibold" tone="secondary">
                {t.commonUses}
              </Text>
              {lang === 'en' ? ' ' : ''}
              {inline(doc.usage[lang])}
            </Text>
          )}
        </Stack>
        <Block title={t.import}>
          <CodeBlock
            copyable
            language="ts"
            code={`import { ${doc.name} } from 'vellum-ui'`}
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
            <Prose text={m.summary[lang]} tone="secondary" />
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
    </Page>
  )
}
