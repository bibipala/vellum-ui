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
  /**
   * Source code of the example, ready to copy: the imports it uses, the declarations of the example file it uses
   * (such as sample data), and the function itself.
   */
  readonly code: string
}

/**
 * A mode of a component whose props are a union, such as single and multiple selection of Select: TypeScript
 * picks the mode from the props that are passed.
 * @zh 属性是联合类型的组件的一种用法，如 Select 的单选与多选：TypeScript 按传入的属性确定是哪一种。
 */
export interface ComponentModeDoc {
  /** Title of the mode, such as "Multiple selection: `multiple`". */
  readonly title: DocText
  /** Empty in both languages when the mode has no description. */
  readonly description: DocText
  /** The props that differ between the modes, as they are in this mode. */
  readonly props: readonly ComponentPropDoc[]
}

/**
 * A static member of a component: a sub-component such as `Form.Item`, or a function such as `Form.useForm`.
 * @zh 组件的静态成员：子组件（如 `Form.Item`）或函数（如 `Form.useForm`）。
 */
export interface ComponentMemberDoc {
  /** Full name, such as `Form.Item`. */
  readonly name: string
  /** Description of the member. */
  readonly summary: DocText
  /** Signature of a function member, or `null` for a sub-component. */
  readonly signature: string | null
  /** Props of a sub-component (shared by all modes when it has modes); empty for a function. */
  readonly props: readonly ComponentPropDoc[]
  /** Modes of a sub-component whose props are a union; otherwise empty. */
  readonly modes: readonly ComponentModeDoc[]
  /** Whether it accepts the props shared by all primitives (see `ComponentDoc.base`). */
  readonly base: boolean
  /** Name of the native element attributes interface it extends, or `null`. */
  readonly native: string | null
}

/**
 * A type of this library that the props, members or signature of a component refer to.
 * @zh 组件的属性、静态成员或签名引用的本库类型。
 */
export interface ComponentTypeDoc {
  /** Name with its type parameters, such as `SelectOption<V>`. */
  readonly name: string
  /** Description of the type. */
  readonly summary: DocText
  /** Source of a type alias (`type Name = …`), or `null` for an interface. */
  readonly definition: string | null
  /** Fields of an interface, in declaration order; empty for a type alias. */
  readonly fields: readonly ComponentPropDoc[]
  /**
   * The values of a type alias that resolves to a union of literals but is not written as one (such as
   * `IconName`); otherwise empty.
   */
  readonly values: readonly string[]
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
  /** Signature of a hook, such as `useMessage(): MessageApi`, or `null` for a component. */
  readonly signature: string | null
  /**
   * Own props (the options of a hook), in declaration order. When the props are a union, only the props shared by
   * all modes; the others are in `modes`.
   */
  readonly props: readonly ComponentPropDoc[]
  /** Modes of a component whose props are a union (see ComponentModeDoc); otherwise empty. */
  readonly modes: readonly ComponentModeDoc[]
  /** Whether the component accepts the props shared by all primitives: `testId`, `aria-label`, `role`, `id`. */
  readonly base: boolean
  /** Name of the native element attributes interface it extends (such as `ButtonHTMLAttributes`), or `null`. */
  readonly native: string | null
  /** Static members, such as `Form.Item` and `Form.useForm`, in declaration order. */
  readonly members: readonly ComponentMemberDoc[]
  /** Types of this library referred to by the props, modes, members and signature, in the order they are found. */
  readonly types: readonly ComponentTypeDoc[]
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
