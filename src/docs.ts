/**
 * 组件文档数据 `vellum-ui/docs/components.json` 的类型（由 scripts/docs.ts 生成该文件）。只有类型、没有运行时代码；
 * 使用方导入 JSON 后标注为 ComponentDocsJson，即可得到类型检查。
 */

/**
 * Text of the component documentation in both languages: `en` (English, the main text of the TSDoc) and `zh`
 * (Simplified Chinese, from the `@zh` tags).
 * @zh 组件文档中的一段文字，两种语言：`en` 英文（TSDoc 正文），`zh` 简体中文（`@zh` 标签）。
 */
export interface DocText {
  /** English. */
  readonly en: string
  /** Simplified Chinese. */
  readonly zh: string
}

/**
 * A language of the component documentation: a key of `DocText`.
 * @zh 组件文档的语言：`DocText` 的键。
 */
export type DocLanguage = keyof DocText

/**
 * A prop of a component, from the TSDoc of its props interface.
 * @zh 组件的一个属性，来自属性接口的 TSDoc。
 */
export interface ComponentPropDoc {
  /** Name of the prop. */
  readonly name: string
  /** The type as written in the source; unions of literals defined in this package are expanded. */
  readonly type: string
  /** Description of the prop. */
  readonly description: DocText
  /** Value of the `@default` tag (source code, not translated), or `null`. */
  readonly default: string | null
  /** Whether the prop is required. */
  readonly required: boolean
}

/**
 * An example: an exported function of `vellum-ui/examples/<Component>.examples.tsx`.
 * @zh 一个示例：`vellum-ui/examples/<组件>.examples.tsx` 中导出的函数。
 */
export interface ComponentExampleDoc {
  /** Name of the exported example function. */
  readonly name: string
  /** Title of the example. */
  readonly title: DocText
  /** Empty in both languages when the example has no description. */
  readonly description: DocText
  /**
   * Section of the component page: `Basic usage`, `Variants`, `States` or `Advanced`. The `en` text is the value
   * of the `@section` tag and serves as the identifier.
   */
  readonly section: DocText
  /** Source code of the example function. */
  readonly code: string
}

/**
 * The documentation of one component: an element of `vellum-ui/docs/components.json`.
 * @zh 一个组件的文档：`vellum-ui/docs/components.json` 的元素。
 */
export interface ComponentDoc {
  /** Name of the export, such as `Button` or `useMessage`. */
  readonly name: string
  /**
   * `Primitives`, `Basic`, `Data`, `Charts`, `AI`, `Feedback`, `Patterns` or `Media`. The `en` text is the value of the
   * `@category` tag and serves as the identifier.
   */
  readonly category: DocText
  /** Description of the component; its first sentence is a short summary. */
  readonly summary: DocText
  /** Common uses. */
  readonly usage: DocText
  /** Own props, in declaration order. */
  readonly props: readonly ComponentPropDoc[]
  /** Whether the component accepts the props shared by all primitives: `testId`, `aria-label`, `role`, `id`. */
  readonly base: boolean
  /** Name of the native element attributes interface it extends (such as `ButtonHTMLAttributes`), or `null`. */
  readonly native: string | null
  /** Examples ordered by section (Basic usage, Variants, States, Advanced), in file order within a section. */
  readonly examples: readonly ComponentExampleDoc[]
}

/**
 * Contents of `vellum-ui/docs/components.json`: all documented components, ordered by category and then by
 * name.
 *
 * ```ts
 * import json from 'vellum-ui/docs/components.json' with { type: 'json' }
 * import type { ComponentDocsJson } from 'vellum-ui'
 *
 * const docs: ComponentDocsJson = json
 * for (const c of docs) console.log(c.name, c.category.zh, c.summary.zh)
 * ```
 * @zh `vellum-ui/docs/components.json` 的内容：全部有文档的组件，先按分类、再按名称排序。
 */
export type ComponentDocsJson = readonly ComponentDoc[]
