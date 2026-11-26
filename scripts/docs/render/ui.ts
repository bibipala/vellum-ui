/**
 * 生成页面中的固定文字（两种语言），以及组成这些文字的小工具。
 */
import type { ComponentDoc, ComponentTypeDoc, DocEntry } from '../model.ts'

/** 类型按入口分组（按第一次出现的顺序），名称不带类型参数：类型一节的导入说明。 */
export type TypeImports = readonly (readonly [string, readonly string[]])[]

export function typeImports(types: readonly ComponentTypeDoc[]): TypeImports {
  const groups = new Map<string, string[]>()
  for (const t of types) {
    const names = groups.get(t.entry) ?? []
    names.push(t.name.replace(/<.*$/, ''))
    groups.set(t.entry, names)
  }
  return [...groups]
}

/** 英文的并列：`A`、`A and B`、`A, B and C`。 */
const listEn = (names: readonly string[]) =>
  names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : (names[0] ?? '')

/** 页面中的固定文字。 */
export const UI = {
  en: {
    overviewTitle: 'Components',
    overviewIntro:
      'Browse components by category and use case. Each page includes examples and props. For installation and theming, see the [README](../../README.md).',
    component: 'Component',
    description: 'Description',
    usage: 'Common uses',
    category: 'Category',
    meta: (c: ComponentDoc) => `**Category**: ${c.category.en} · **Common uses**: ${c.usage.en}`,
    import: 'Import',
    props: 'Props',
    propsHead: '| Prop | Type | Description | Default | Required |',
    options: 'Options',
    optionsHead: '| Option | Type | Description | Default | Required |',
    yes: 'Yes',
    no: 'No',
    noOwnProps: 'No props of its own.',
    noProps: 'No props.',
    base: 'Also accepts `testId` (rendered as `data-testid`), `aria-label`, `role` and `id`, like all primitives.',
    native: (n: string) =>
      `Also accepts the attributes of the native element (\`${n}\`), such as \`disabled\` and \`onClick\`.`,
    noStyle:
      'Does not accept `style` or `className`: appearance is adjusted only through the semantic props above and the theme.',
    antdTitle: 'Relationship with Ant Design',
    antdText: [
      'Ant Design implements forms, inputs and overlays internally. vellum-ui defines its own props, values and callbacks, with no Ant Design types in the public API. Use vellum-ui imports and theme settings to keep application code independent of the underlying implementation.',
      "Concepts of antd that duplicate the components of this library are merged under one name: `Tag` → Pill, `Badge` → CountBadge / StatusDot, `Card` → Panel, `Space` → Stack / Inline, `Empty` → EmptyState, `Spin` → Loading; `Avatar` is the library's own letter avatar. `Layout`, `Menu` and `Result` are not exported.",
      'Compose application-specific interfaces from these general-purpose components.',
      'Machine-readable documentation data in both languages (generated from the same source): [`components.json`](../components.json), imported as `vellum-ui/docs/components.json`.',
    ],
    deprecatedTitle: 'Deprecated',
    deprecatedText: 'Still importable, but use the replacement in new code.',
    deprecatedHead: '| Component | Replacement |',
    signature: 'Signature',
    modes: 'Modes',
    modesIntro: (name: string) =>
      `The props of ${name} depend on how it is used. The props in the table above apply to every mode; the props below differ between the modes, and TypeScript checks the combination you pass.`,
    memberProps: 'Props',
    types: 'Types',
    importFrom: (entry: DocEntry) => `Import it from \`${entry}\`.`,
    typesIntro: (groups: TypeImports) =>
      groups.length === 1
        ? `Types of this library used above. Import them with \`import type { … } from '${groups[0]?.[0]}'\`.`
        : `Types of this library used above. Import ${groups
            .map(([entry, names]) => `${listEn(names)} with \`import type { … } from '${entry}'\``)
            .join(', and ')}.`,
    fieldsHead: '| Field | Type | Description | Default | Required |',
    values: 'Values',
    valuesOn: (n: number, link: string) => `${n} values, listed on the ${link} page.`,
    demoFrame:
      '`DemoFrame` is only a fixed-height container of the examples; in a page, put the component in `Page fill` or `Panel fill`.',
    guidesTitle: 'Guides',
    guidesIntro: 'Component composition, API conventions and styling.',
    recipesTitle: 'Recipes',
    recipesIntro:
      'Complete pages to copy and adapt. Start with the basic ones: each shows one page and one way of building it. The advanced ones combine several: an application frame, asynchronous states and overlays. The scenarios are whole products from different fields, each with a look of its own.',
    recipeMeta: (level: string, components: string) =>
      `**Level**: ${level} · **Components used**: ${components}`,
    levels: {
      basic: {
        title: 'Basic',
        intro: 'One page built from a few components, with local state.',
      },
      advanced: {
        title: 'Advanced',
        intro: 'Several patterns working together: navigation, loading and failure, and overlays.',
      },
      scenario: {
        title: 'Scenarios',
        intro:
          'Whole products from different fields, each with a look of its own: the components together with a CSS Module built on the design tokens. They show how far the library stretches beyond the standard pages.',
      },
    },
    apiTitle: 'API reference',
    apiIntro:
      'Exports other than components: theme, colors, localization, shortcuts, streaming and utilities.',
    tokensTitle: 'Design tokens',
    tokensText: 'Theme CSS variables for custom application styles: [design tokens](tokens.md).',
    recipeOf: 'Recipe',
  },
  zh: {
    overviewTitle: '组件总览',
    overviewIntro:
      '按分类与用途查找组件，各组件页提供示例与属性说明。安装与主题配置见 [README](../../README.zh-CN.md)。',
    component: '组件',
    description: '描述',
    usage: '常见用途',
    category: '分类',
    meta: (c: ComponentDoc) => `**分类**：${c.category.zh}　**常见用途**：${c.usage.zh}`,
    import: '引入',
    props: '属性',
    propsHead: '| 属性 | 类型 | 说明 | 默认值 | 必填 |',
    options: '选项',
    optionsHead: '| 选项 | 类型 | 说明 | 默认值 | 必填 |',
    yes: '是',
    no: '否',
    noOwnProps: '没有自有属性。',
    noProps: '没有属性。',
    base: '另外支持所有原语共有的 `testId`（输出为 `data-testid`）、`aria-label`、`role`、`id`。',
    native: (n: string) => `另外支持原生元素的属性（\`${n}\`），如 \`disabled\`、\`onClick\`。`,
    noStyle: '不接受 `style` 与 `className`：外观只能通过上面的语义参数与主题调整。',
    antdTitle: '与 Ant Design 的关系',
    antdText: [
      'Ant Design 用于表单、输入、弹层等组件的内部实现。vellum-ui 独立声明属性、值与回调，公共接口不暴露 Ant Design 类型。应用通过 vellum-ui 导入组件并配置主题，保持与底层实现解耦。',
      'antd 中与自研组件重复的概念已合并，只保留一个名字：`Tag` → Pill，`Badge` → CountBadge / StatusDot，`Card` → Panel，`Space` → Stack / Inline，`Empty` → EmptyState，`Spin` → Loading；`Avatar` 是自研的字母头像。`Layout`、`Menu`、`Result` 不导出。',
      '基于通用组件组合业务界面，业务数据与逻辑由应用管理。',
      '机器可读的文档数据（两种语言，与本目录同源）：[`components.json`](../components.json)，经包导出 `vellum-ui/docs/components.json` 引入。',
    ],
    deprecatedTitle: '不推荐使用',
    deprecatedText: '仍可导入，但新代码请改用替代组件。',
    deprecatedHead: '| 组件 | 替代 |',
    signature: '签名',
    modes: '用法',
    modesIntro: (name: string) =>
      `${name} 的属性随用法不同。上表中的属性适用于所有用法；下面的属性因用法而异，TypeScript 会检查传入的组合。`,
    memberProps: '属性',
    types: '类型',
    importFrom: (entry: DocEntry) => `从 \`${entry}\` 导入。`,
    typesIntro: (groups: TypeImports) =>
      groups.length === 1
        ? `上文用到的本库类型，用 \`import type { … } from '${groups[0]?.[0]}'\` 引入。`
        : `上文用到的本库类型：${groups
            .map(
              ([entry, names]) =>
                `${names.join('、')} 用 \`import type { … } from '${entry}'\` 引入`,
            )
            .join('，')}。`,
    fieldsHead: '| 字段 | 类型 | 说明 | 默认值 | 必填 |',
    values: '取值',
    valuesOn: (n: number, link: string) => `共 ${n} 个取值，列在 ${link} 页中。`,
    demoFrame:
      '`DemoFrame` 只是示例中的固定高度容器；在页面中，把组件放进 `Page fill` 或 `Panel fill`。',
    guidesTitle: '指南',
    guidesIntro: '组件组合、接口约定与样式扩展。',
    recipesTitle: '页面配方',
    recipesIntro:
      '基于组件库的完整页面示例，可复制后按需调整。建议先读入门配方：每个只讲一种页面、一种做法；进阶配方把多种做法组合在一起：应用框架、异步状态与浮层；场景配方是不同领域的完整产品界面，各有自己的外观。',
    recipeMeta: (level: string, components: string) =>
      `**难度**：${level}　**用到的组件**：${components}`,
    levels: {
      basic: {
        title: '入门',
        intro: '用少量组件搭出的单个页面，状态都在页面内部。',
      },
      advanced: {
        title: '进阶',
        intro: '多种做法配合使用：导航、加载与失败，以及浮层。',
      },
      scenario: {
        title: '场景',
        intro:
          '不同领域的完整产品界面，各有自己的外观：组件库的组件配合基于设计令牌的 CSS Module，展示标准页面之外组件库还能做到什么。',
      },
    },
    apiTitle: 'API 参考',
    apiIntro: '组件以外的导出：主题、颜色、本地化、快捷键、流式与工具。',
    tokensTitle: '设计令牌',
    tokensText: '用于应用自定义样式的主题 CSS 变量：[设计令牌](tokens.md)。',
    recipeOf: '页面配方',
  },
} as const

export type Ui = (typeof UI)[keyof typeof UI]

/** 设计令牌页的固定文字。 */
export const TOKENS_UI = {
  en: {
    title: 'Design tokens',
    intro:
      "Every token is a CSS custom property `--vl-<name>`, set on the document root by ThemeProvider; the values below are those of the default theme. In CSS write `var(--vl-color-text-secondary)`; in TypeScript, `cssVar('color-text-secondary')` returns the same expression. The components already use these tokens. Write CSS of your own only for visuals specific to your application ([custom styles](guides/custom-styles.md)), and only with the semantic tokens, never with fixed values.",
    token: 'Token',
    light: 'Light',
    dark: 'Dark',
    value: 'Value',
    comfortable: 'Comfortable',
    compact: 'Compact',
  },
  zh: {
    title: '设计令牌',
    intro:
      "每个令牌都是一个 CSS 自定义属性 `--vl-<名称>`，由 ThemeProvider 设置在文档根元素上；下表是默认主题的取值。CSS 中写 `var(--vl-color-text-secondary)`；TypeScript 中 `cssVar('color-text-secondary')` 返回同样的表达式。组件已经使用这些令牌。只有应用特有的视觉才自己写 CSS（[自定义样式](guides/custom-styles.md)），并且只用语义令牌，不写固定值。",
    token: '令牌',
    light: '浅色',
    dark: '深色',
    value: '取值',
    comfortable: '舒适',
    compact: '紧凑',
  },
} as const
