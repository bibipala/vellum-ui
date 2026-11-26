/**
 * 文档站的内部数据（`site/generated/`，不随包发布，类型见 site/manifest.ts）：
 * - `manifest.json`：页面的顺序、各页两种语言的标题与 `##` 标题（搜索与锚点）、配方的难度、组件的入口与搜索用的
 *   文字（说明与常见用途）。文档站打开任何页面时只加载它；
 * - `components/<语言>/<组件>.json`：一个组件页的数据，只有这种语言的文字，不含示例代码；打开组件页时加载；
 * - `code/<组件>.json`：组件各示例的代码；点「显示代码」时加载。
 * Markdown 页面（总览、指南、配方、API 参考、令牌）由文档站按路由与语言直接加载 docs/ 中的文件。
 *
 * 标题与 `##` 标题用文档站自己的 prepareMarkdown、headingsOf 从页面的 Markdown 读出，与文档站显示的完全一致。
 */
import type {
  Localized,
  SiteComponentDoc,
  SiteExampleCode,
  SiteManifest,
  SiteMarkdownInfo,
} from '../../../site/manifest.ts'
import { headingsOf, prepareMarkdown } from '../../../site/routes.ts'
import { type DocLanguage, type DocsModel, type DocText, LANGUAGES } from '../model.ts'

/** 文档站数据所在的目录（相对本包根目录）。 */
export const SITE_DATA_DIR = 'site/generated'
export const SITE_MANIFEST = `${SITE_DATA_DIR}/manifest.json`

/** 文档站的分页数据目录：这些目录下不再生成的文件视为过时。 */
export const SITE_DATA_DIRS = [
  ...LANGUAGES.map((l) => `${SITE_DATA_DIR}/components/${l.lang}`),
  `${SITE_DATA_DIR}/code`,
]

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`

const isText = (value: object): value is DocText => {
  const keys = Object.keys(value)
  return (
    keys.length === 2 &&
    keys.includes('en') &&
    keys.includes('zh') &&
    Object.values(value).every((v) => typeof v === 'string')
  )
}

/** 把每个 `{ en, zh }` 换成一种语言的文字，其余原样保留（键的顺序不变）。 */
export function localize<T>(value: T, lang: DocLanguage): Localized<T> {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk)
    if (v === null || typeof v !== 'object') return v
    if (isText(v)) return v[lang]
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]))
  }
  return walk(value) as Localized<T>
}

/**
 * 文档站的数据：本包根目录相对路径 → 内容。`markdown` 是文档站显示的 Markdown 页面（本包根目录相对路径 → 内容），
 * 其中生成的页面来自 renderDocs，指南来自模型。
 */
export function siteData(
  model: DocsModel,
  markdown: ReadonlyMap<string, string>,
): Map<string, string> {
  const info = (rest: string): SiteMarkdownInfo => {
    const of = (dir: string) => {
      const file = `docs/${dir}/${rest}`
      const text = markdown.get(file)
      if (text === undefined) throw new Error(`文档站的清单需要 ${file}`)
      const { title, body } = prepareMarkdown(text, file)
      return { title, headings: headingsOf(body) }
    }
    const [en, zh] = LANGUAGES.map((l) => of(l.dir))
    return {
      title: { en: en?.title ?? '', zh: zh?.title ?? '' },
      headings: { en: en?.headings ?? [], zh: zh?.headings ?? [] },
    }
  }
  const manifest: SiteManifest = {
    home: info('README.md'),
    tokens: info('tokens.md'),
    guides: model.guides.map((g) => ({ slug: g.slug, ...info(`guides/${g.slug}.md`) })),
    recipes: model.recipes.map((r) => ({
      name: r.name,
      level: r.level,
      ...info(`recipes/${r.name}.md`),
    })),
    api: model.api
      .filter((g) => g.entries.length)
      .map((g) => ({ slug: g.slug, ...info(`api/${g.slug}.md`) })),
    // 有组件的分类，按组件的顺序（组件已按分类排序）
    categories: [...new Map(model.components.map((c) => [c.category.en, c.category])).values()],
    components: model.components.map((c) => ({
      name: c.name,
      entry: c.entry,
      category: c.category.en,
      summary: c.summary,
      usage: c.usage,
    })),
  }
  const files = new Map<string, string>([[SITE_MANIFEST, json(manifest)]])
  for (const c of model.components) {
    // 分类与说明在清单中；示例代码单独一个文件
    const { category: _, summary: __, examples, ...rest } = c
    const page = {
      ...rest,
      examples: examples.map(({ code: _, ...e }) => e),
      demoFrame: examples.some((e) => e.code.includes('DemoFrame')),
    }
    for (const { lang } of LANGUAGES) {
      const doc: SiteComponentDoc = localize(page, lang)
      files.set(`${SITE_DATA_DIR}/components/${lang}/${c.name}.json`, json(doc))
    }
    if (examples.length) {
      const code: SiteExampleCode = Object.fromEntries(examples.map((e) => [e.name, e.code]))
      files.set(`${SITE_DATA_DIR}/code/${c.name}.json`, json(code))
    }
  }
  return files
}
