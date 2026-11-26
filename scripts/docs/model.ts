/**
 * 文档模型：提取得到、交给各个渲染器的可序列化数据，以及包的入口与文档语言。
 * 组件的部分（ComponentDoc 等）就是公开的 components.json 的类型，定义在 src/docs.ts。
 */
import type {
  ComponentDoc,
  ComponentExampleDoc,
  ComponentMemberDoc,
  ComponentModeDoc,
  ComponentPropDoc,
  ComponentTypeDoc,
  DocLanguage,
  DocText,
} from '../../src/docs.ts'
import type { TokenRow, TokenSection } from '../tokens.ts'

export type {
  ComponentDoc,
  ComponentExampleDoc,
  ComponentMemberDoc,
  ComponentModeDoc,
  ComponentPropDoc,
  ComponentTypeDoc,
  DocLanguage,
  DocText,
}

/** 导入组件的入口（包的子路径）。components.json 中是字符串（JSON 模块的值推断为 string）。 */
export type DocEntry = 'vellum-ui' | 'vellum-ui/charts' | 'vellum-ui/ai'

/**
 * 包的三个入口与它们的源文件：核心、图表（需要 echarts）、AI 与流式（Markdown 需要 @ant-design/x-markdown）。
 * 每个导出只属于一个入口，页面上的导入语句写它的入口。
 */
export const ENTRIES: readonly { name: DocEntry; file: string }[] = [
  { name: 'vellum-ui', file: 'src/index.ts' },
  { name: 'vellum-ui/charts', file: 'src/charts.ts' },
  { name: 'vellum-ui/ai', file: 'src/ai.ts' },
]
export const CORE_ENTRY: DocEntry = 'vellum-ui'

/** hook：名字以 use 开头（useMessage、useHotkeys）。它的属性表是选项表，标题为「选项」。 */
export const isHook = (name: string) => /^use[A-Z]/.test(name)

/** 文档的语言与输出目录。 */
export const LANGUAGES: readonly { lang: DocLanguage; dir: string; label: string }[] = [
  { lang: 'en', dir: 'en-US', label: 'English' },
  { lang: 'zh', dir: 'zh-CN', label: '简体中文' },
]

/** 不推荐使用的导出：替代说明在 `@deprecated`（英文）与 `@deprecatedZh`（中文）中。 */
export interface DeprecatedDoc {
  name: string
  note: DocText
}

/** API 参考中的一项：组件以外的导出。 */
export interface ApiEntryDoc {
  name: string
  /** 导入它的入口。 */
  entry: DocEntry
  group: string
  /** 类：属性表是字段表。 */
  isClass: boolean
  summary: DocText
  /** 函数、常量的签名；类的声明头。 */
  signature: string
  /** 组件（如 ThemeProvider）的属性、类的字段。 */
  props: ComponentPropDoc[]
  modes: ComponentModeDoc[]
}

/** API 参考的一页：一个分组的导出与它们引用的类型。 */
export interface ApiGroupDoc {
  slug: string
  title: DocText
  intro: DocText
  entries: ApiEntryDoc[]
  types: ComponentTypeDoc[]
}

/** 一篇手写的指南：`docs/<语言>/guides/<slug>.md`，标题是第一个 `# `，简介是标题后的第一段。 */
export interface GuideDoc {
  slug: string
  title: DocText
  summary: DocText
  /** 全文（文档站的清单从中读取 `##` 标题）。 */
  markdown: DocText
}

/**
 * 配方的难度：`basic` 是一个页面、一种做法，适合先读；`advanced` 组合多种做法（应用框架、异步状态、浮层）；
 * `scenario` 是某个领域的完整产品界面，用组件库的组件配合自己的 CSS Module，各有自己的外观。
 */
export type RecipeLevel = 'basic' | 'advanced' | 'scenario'
export const RECIPE_LEVELS: readonly RecipeLevel[] = ['basic', 'advanced', 'scenario']

/** 一个页面配方：`examples/recipes/<名称>.recipe.tsx` 中唯一导出的函数。 */
export interface RecipeDoc {
  name: string
  title: DocText
  description: DocText
  /** 难度，来自 TSDoc 的 `@level`。 */
  level: RecipeLevel
  code: string
  /** 配方引入的同目录 CSS Module（自定义样式）：文件名与内容，页面中列在代码之后。 */
  styles: { file: string; css: string }[]
  /** 用到的有文档的组件。 */
  components: string[]
}

/** 设计令牌清单的一节与它的令牌（scripts/tokens.ts 的 tokenRows）。 */
export interface TokenGroup {
  section: TokenSection
  rows: TokenRow[]
}

/** 全部文档的模型：渲染器只读它，不再访问源码与编译器。 */
export interface DocsModel {
  components: ComponentDoc[]
  api: ApiGroupDoc[]
  deprecated: DeprecatedDoc[]
  guides: GuideDoc[]
  recipes: RecipeDoc[]
  tokens: readonly TokenGroup[]
}
