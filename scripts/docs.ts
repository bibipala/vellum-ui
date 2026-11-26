/**
 * 组件文档生成：一份来源，两种语言，全部输出在本包内。写法见 CONTRIBUTING.md。
 * - 来源：组件函数的 TSDoc（英文正文与 `@zh`、`@category`、`@usage` 与 `@usageZh`）、Props 接口的 TSDoc
 *   （英文正文与 `@zh`、`@default`），以及 `examples/<组件>.examples.tsx` 中导出的示例函数（英文正文与 `@zh`
 *   各自第一行为标题、其余为说明，`@section` 指定章节）。
 * - 产物：
 *   - `docs/README.md` 选择语言的入口；
 *   - `docs/en-US/`、`docs/zh-CN/` 两套结构相同的文档：`README.md` 总览与 `components/<组件>.md`，页首互相链接；
 *   - `stories/generated/<组件>.stories.tsx`：故事名用英文标题，说明由 .storybook/preview.tsx 按工具栏的语言
 *     从 components.json 读取；
 *   - 机器可读的文档数据 `docs/components.json`（ComponentDocsJson，类型见 src/docs.ts；经包导出
 *     `vellum-ui/docs/components.json`，供使用方在自己的文档站或应用内浏览组件）；
 *   - 文档站的内部数据 `site/generated/`（清单与分页数据，不随包发布，见 scripts/docs/render/site.ts）。
 *
 * 这里只负责编排：scripts/docs/ 中按步骤拆分——
 * - `program.ts` 来源与编译器程序；`collect.ts`、`props.ts`、`tsdoc.ts` 从程序中提取组件、API 参考与类型；
 *   `inline.ts` 让示例可以单独复制；`guides.ts`、`recipes.ts` 读取指南与页面配方；
 * - `bilingual.ts` 双语检查与标签取值；`model.ts` 提取得到的模型；
 * - `render/` 由模型渲染各种产物（Markdown、Storybook、components.json、llms.txt，以及文档站的清单与分页数据），
 *   不访问源码；
 * - `files.ts` 比较生成物与磁盘上的文件。
 */
import path from 'node:path'
import { type Collected, collect as collectFrom } from './docs/collect.ts'
import { compareFiles, GENERATED_DIRS } from './docs/files.ts'
import { readGuides } from './docs/guides.ts'
import type { ComponentDoc, DocsModel } from './docs/model.ts'
import { LANGUAGES } from './docs/model.ts'
import { type DocsSource, diskSource } from './docs/program.ts'
import { recipesOf } from './docs/recipes.ts'
import { componentsJson } from './docs/render/json.ts'
import { llmsTxt } from './docs/render/llms.ts'
import {
  apiPage,
  componentPage,
  languageEntry,
  overview,
  recipePage,
  tokensPage,
  typeOwner,
} from './docs/render/markdown.ts'
import { siteData } from './docs/render/site.ts'
import { recipeStories, story } from './docs/render/stories.ts'
import { tokenRows } from './tokens.ts'

export { API_GROUPS, CATEGORIES, CJK, HAN, joinCjkLines, SECTIONS } from './docs/bilingual.ts'
export { GENERATED_DIRS } from './docs/files.ts'
export type {
  ApiEntryDoc,
  ApiGroupDoc,
  ComponentDoc,
  ComponentExampleDoc,
  ComponentMemberDoc,
  ComponentModeDoc,
  ComponentPropDoc,
  ComponentTypeDoc,
  DeprecatedDoc,
  DocEntry,
  DocLanguage,
  DocsModel,
  DocText,
  GuideDoc,
  RecipeDoc,
  RecipeLevel,
} from './docs/model.ts'
export { ENTRIES, LANGUAGES } from './docs/model.ts'
export { type DocsSource, diskSource, memorySource } from './docs/program.ts'
export { SITE_DATA_DIRS, SITE_MANIFEST } from './docs/render/site.ts'
export { typeImports } from './docs/render/ui.ts'

/** 本包根目录；生成文件的键都是相对它的 posix 路径。 */
export const pkgRoot = path.resolve(import.meta.dirname, '..')

/** 机器可读的文档数据：ComponentDocsJson（包导出 `vellum-ui/docs/components.json`）。 */
export const COMPONENTS_JSON = 'docs/components.json'

/** 给 AI 编程智能体的入口文件（包的根目录）。 */
export const LLMS_TXT = 'llms.txt'

export interface GenerateResult {
  /** 随包发布的文档：本包根目录相对路径 → 文件内容。 */
  files: Map<string, string>
  /** 文档站的内部数据（`site/generated/`，不随包发布）：本包根目录相对路径 → 文件内容。 */
  site: Map<string, string>
  components: ComponentDoc[]
  /** 文档不完整之处（缺说明、缺某种语言、缺示例等），测试据此失败。 */
  problems: string[]
}

/** 读取全部带 @category 的导出组件，以及带 @group 的其他导出（API 参考）；默认读取本包。 */
export function collect(source: DocsSource = diskSource(pkgRoot)): Collected {
  return collectFrom(source)
}

/** 文档模型：组件、API 参考与页面配方（同一个程序，只解析一次），指南与设计令牌。 */
export function buildModel(source: DocsSource = diskSource(pkgRoot)): {
  model: DocsModel
  problems: string[]
} {
  const c = collectFrom(source)
  const r = recipesOf(source, c.program, c.checker, new Set(c.components.map((x) => x.name)))
  const g = readGuides(source)
  const tokens = tokenRows()
  const problems = [...c.problems, ...r.problems, ...g.problems]
  for (const t of tokens.unmatched)
    problems.push(`令牌 ${t}: 不属于令牌清单的任何一节（scripts/tokens.ts 的 TOKEN_SECTIONS）`)
  const model: DocsModel = {
    components: c.components,
    api: c.api,
    deprecated: c.deprecated,
    guides: g.guides,
    recipes: r.recipes,
    tokens: tokens.sections,
  }
  return { model, problems }
}

/** 由模型渲染随包发布的全部产物：本包根目录相对路径 → 内容。 */
export function renderDocs(model: DocsModel): Map<string, string> {
  const { components, api, recipes } = model
  const files = new Map<string, string>()
  files.set('docs/README.md', languageEntry(components.length))
  const owner = typeOwner(components)
  for (const { lang, dir } of LANGUAGES) {
    files.set(`docs/${dir}/README.md`, overview(model, lang))
    files.set(`docs/${dir}/tokens.md`, tokensPage(model.tokens, lang))
    for (const c of components)
      files.set(`docs/${dir}/components/${c.name}.md`, componentPage(c, lang, owner))
    for (const g of api)
      if (g.entries.length) files.set(`docs/${dir}/api/${g.slug}.md`, apiPage(g, lang, owner))
    for (const r of recipes) files.set(`docs/${dir}/recipes/${r.name}.md`, recipePage(r, lang))
  }
  for (const c of components)
    if (c.examples.length) files.set(`stories/generated/${c.name}.stories.tsx`, story(c))
  if (recipes.length) files.set('stories/generated/Recipes.stories.tsx', recipeStories(recipes))
  files.set(COMPONENTS_JSON, componentsJson(components))
  files.set(LLMS_TXT, llmsTxt(model))
  return files
}

/** 文档站显示的 Markdown 页面：生成的页面与手写的指南（本包根目录相对路径 → 内容）。 */
function siteMarkdown(model: DocsModel, files: ReadonlyMap<string, string>): Map<string, string> {
  const pages = new Map([...files].filter(([rel]) => rel.endsWith('.md')))
  for (const g of model.guides)
    for (const { lang, dir } of LANGUAGES)
      pages.set(`docs/${dir}/guides/${g.slug}.md`, g.markdown[lang])
  return pages
}

/** 生成全部产物（不写盘）。 */
export function generate(source: DocsSource = diskSource(pkgRoot)): GenerateResult {
  const { model, problems } = buildModel(source)
  const files = renderDocs(model)
  const site = siteData(model, siteMarkdown(model, files))
  return { files, site, components: model.components, problems }
}

/**
 * 生成物与本包中的文件比较：`changed` 是内容不同或还不存在的文件，`stale` 是生成目录中已经不再生成的文件。
 * `pnpm docs:gen`（scripts/docs-gen.ts）据此写入与删除，test/docs.test.ts 据此检查文档是最新的。
 */
export function compareGenerated(
  files: ReadonlyMap<string, string>,
  dirs: readonly string[] = GENERATED_DIRS,
): { changed: string[]; stale: string[] } {
  return compareFiles(files, pkgRoot, dirs)
}
