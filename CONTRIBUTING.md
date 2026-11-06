# Contributing to vellum-ui

**English** | [简体中文](#简体中文)

Development commands (Storybook, tests, build) are listed in the [README](README.md#development). This file
describes how to write the documentation of components: it is bilingual, English and Simplified Chinese, and both
languages are written in the same TSDoc comment.

## Bilingual documentation

The documentation is generated from the code by `pnpm docs:gen` (`scripts/docs.ts`):

| Source | English | Chinese |
| --- | --- | --- |
| Component function | main text of the TSDoc | `@zh` |
| Common uses | `@usage` | `@usageZh` |
| Each prop of the props interface | main text of the TSDoc | `@zh` |
| Example function in `examples/<Component>.examples.tsx` | main text: first line is the title, the rest is the description | `@zh`: first line is the title, the rest is the description |
| Deprecated export | `@deprecated` | `@deprecatedZh` |

English is the main text: editors show it on hover, and it is the language of the published package. The Chinese
text goes in the `@zh` tag (and in `@usageZh` / `@deprecatedZh`), so both languages stay next to each other and are
changed together.

The output is `docs/en-US/**` and `docs/zh-CN/**` (an overview and one page per component, with a language switch
at the top of each page), `docs/components.json` (every text field as `{ "en": …, "zh": … }`) and the Storybook
stories in `stories/generated/`. Do not edit generated files; change the TSDoc or the examples and run
`pnpm docs:gen`.

### Component

```tsx
/**
 * Buttons trigger an action. Use `variant="primary"` for the main action (at most one per area) and add
 * `tone="danger"` for destructive actions.
 *
 * **Interaction**: the state layer darkens on hover and press; `Tab` shows the focus ring.
 * @zh 按钮。主操作用 `variant="primary"`（每个区域最多一个），危险操作加 `tone="danger"`。
 *
 * **交互**：悬停、按下叠加状态层；`Tab` 聚焦显示焦点环。
 * @category Basic
 * @usage Main action of a page header, form submission, confirming a dialog
 * @usageZh 页面头的主操作、表单提交、弹窗确认
 */
export function Button(props: ButtonProps) {}
```

- The first sentence is used in the overview table: make it a complete, short description.
- Paragraphs are separated by an empty line, in both languages. Inline markup is limited to `` `code` `` and
  `**bold**`.

### Props

```ts
export interface HeadingProps {
  /**
   * Heading level: 1 page title (usually rendered by Page), 2 block title, 3 subsection title.
   * @zh 标题级别：1 页面标题（通常由 Page 生成）、2 区块标题、3 小节标题。
   * @default 2
   */
  readonly level?: 1 | 2 | 3
}
```

Every prop that appears in the documentation needs both languages. Props inherited from Ant Design or from native
elements are not listed one by one.

### Examples

```tsx
/**
 * Loading and disabled
 * Show `loading` while submitting to prevent double submission.
 * @zh 加载与禁用
 * 提交中显示 loading，防止重复提交。
 * @section States
 */
export function States() {}
```

- The title is the first line of each language; the description is optional, but if one language has it, the other
  must have it too.
- An example whose title equals its section (for example "Basic usage" / "基本用法") is shown without a subheading.
- Exactly one copy of the code: the data in examples is **English and neutral** (project names, people, files),
  never real business data. Texts that come from the library itself (empty states, "Loading", "Undo", the texts of
  the wrapped Ant Design components) follow the `locale` of `ThemeProvider` and therefore switch language with
  it. Comments in examples are in English.

### Tags that are not translated

| Tag | Value |
| --- | --- |
| `@category` | `Primitives`, `Basic`, `Data`, `Charts`, `AI`, `Feedback`, `Patterns` or `Media` (see the table below) |
| `@section` | `Basic usage` (default when omitted), `Variants`, `States` or `Advanced` |
| `@default` | source code, such as `'default'` or `2` |

| `@category` | 中文 | `@section` | 中文 |
| --- | --- | --- | --- |
| Primitives | 原语 | Basic usage | 基本用法 |
| Basic | 基础 | Variants | 变体 |
| Data | 数据 | States | 状态 |
| Charts | 图表 | Advanced | 进阶用法 |
| AI | AI 与流式 | | |
| Feedback | 反馈 | | |
| Patterns | 模式 | | |
| Media | 看图 | | |

### Writing English

- US spelling (color, behavior), sentence case in titles ("Loading and disabled"), present tense.
- Units with a space: "200 ms", "4 px". Keys in backticks: `Tab`, `Enter`, `Esc`, `↑` / `↓`.
- Component names in plain text (Button, LinkButton), props and values in backticks (`tone`, `variant="primary"`).
- Quoted UI text uses straight double quotes: "Undo", "Cancel".
- No Chinese characters or full-width punctuation in the English text; the `@zh` text must contain Chinese.
  `test/docs.test.ts` checks both, and that no language is missing.
- Use the terms of the glossary below in both languages.

## Glossary

| English | 中文 | Notes |
| --- | --- | --- |
| design token | 设计令牌 | three layers: primitive / semantic / component (原始 / 语义 / 组件) |
| step (of a scale), spacing step | 档位，间距档位 | `SpaceStep` 0–8 |
| theme | 主题 | |
| color mode: light / dark / system | 明暗模式：浅色 / 深色 / 跟随系统 | |
| accent color | 强调色 | |
| density: comfortable / compact | 密度：舒适 / 紧凑 | |
| reduce motion | 减少动态效果 | |
| surface: canvas / surface / sunken / elevated | 表面：画布 / 面板 / 凹陷 / 浮层 | values of `surface` |
| neutral fill | 中性填充 | |
| subtle background | 浅底 | low-chroma tint of a tone (低饱和底色) |
| hairline border | 发丝描边 | |
| radius | 圆角 | |
| tone | 色调 | `neutral`, `accent`, `success`, `warning`, `danger`, `info` |
| semantic color | 语义色 | |
| state layer | 状态层 | the overlay that darkens on hover and press |
| focus ring | 焦点环 | |
| focus halo | 光环 | around focused filled inputs |
| hover / press | 悬停 / 按下 | |
| keyboard focus | 键盘聚焦 | |
| filled input | 填充式输入 | neutral background, no border |
| viewer stage | 看图舞台 | neutral background for images (`viewer-*` tokens) |
| viewer background | 看图背景 | |
| overlay | 弹层 | dropdowns, popovers, dialogs |
| tooltip | 提示 | |
| message | 消息条 | `useMessage` |
| undo | 撤销 | |
| empty state | 空状态 | |
| error state | 错误状态 | |
| loading indicator | 加载指示 | |
| skeleton / page skeleton | 骨架 / 页面骨架 | |
| delayed appearance | 延迟出现 | no flash for fast loads (防闪) |
| destructive action | 危险操作 | |
| danger confirmation | 危险确认 | `useConfirmDanger` |
| irreversible / reversible | 不可恢复 / 可恢复 | |
| disabled reason | 禁用原因 | `disabledReason` |
| primary action | 主操作 | |
| screen reader | 读屏 | |
| accessible name | 读屏名称 | |
| announce | 播报 | politely / immediately (礼貌 / 立即) |
| page header | 页面头 | |
| toolbar | 工具栏 | |
| panel | 面板 | |
| section | 分组 | the Section component; a section of a docs page is 章节 |
| split view | 主从分栏 | list on the left, details on the right |
| aside | 侧栏 | the left column of SplitView |
| list item | 列表行 | |
| setting row | 设置行 | |
| pill | 胶囊 | |
| count badge | 计数徽标 | |
| status dot | 状态圆点 | |
| status badge | 状态角标 | the dot at the corner of an Avatar |
| accent ring | 外环 | |
| overline | 分组小标题 | |
| tabular numbers | 等宽数字 | `numeric` |
| monospace | 等宽字体 | `mono` |
| truncate | 省略 | |
| flush | 贴边 | |
| fill | 占满 | |
| segmented control | 分段控件 | |
| indicator (of Segmented / Tabs) | 选中滑块 / 选中下划线 | |
| virtualized | 虚拟化 | |
| overscan | 预渲染 | rows or items rendered outside the viewport |
| image grid / tile | 图片网格 / 格子 | |
| caption | 说明文字 | |
| lightbox | 全屏看图 | image viewer |
| preview (of Image) | 预览 | the larger view opened from Image |
| placeholder / fallback | 占位 / 兜底 | while loading / when loading fails |
| drop area | 拖放区 | `Upload.Dropzone` |
| file list | 文件列表 | of Upload |
| retry | 重试 | |
| popover | 气泡卡片 | |
| steps / current step | 步骤条 / 当前步骤 | |
| breadcrumb / current page | 面包屑 / 当前页 | |
| swatch | 色块 | the trigger of ColorPicker |
| handle / track | 手柄 / 轨道 | of Slider |
| key cap | 按键帽 | Kbd |
| keyboard shortcut, hotkey | 快捷键 | `useHotkeys` |
| scope (of hotkeys) | 作用域 | |
| registry (of hotkeys) | 注册表 | |
| input method composition | 输入法组字 | keys pressed while an IME composes text |
| copy button | 复制按钮 | CopyButton |
| splitter / primary pane / grip | 可拖拽分栏 / 主窗格 / 握把 | Splitter; the handle is 手柄 as for Slider |
| context menu | 右键菜单 | ContextMenu |
| command palette / current result | 命令面板 / 当前项 | CommandPalette |
| fuzzy matching | 模糊匹配 | |
| controlled / uncontrolled | 受控 / 非受控 | |
| locale, text table | 语言，文本表 | |
| built-in text | 内置文本 | |
| common uses | 常见用途 | |

---

## 简体中文

[English](#contributing-to-vellum-ui) | **简体中文**

开发命令（Storybook、测试、构建）见 [README](README.zh-CN.md#开发)。本节说明组件文档怎么写：文档是中英双语的，
两种语言写在同一段 TSDoc 里。

### 双语文档

文档由 `pnpm docs:gen`（`scripts/docs.ts`）从代码生成：

| 来源 | 英文 | 中文 |
| --- | --- | --- |
| 组件函数 | TSDoc 正文 | `@zh` |
| 常见用途 | `@usage` | `@usageZh` |
| 属性接口的每个属性 | TSDoc 正文 | `@zh` |
| `examples/<组件>.examples.tsx` 中的示例函数 | 正文：第一行是标题，其余是说明 | `@zh`：第一行是标题，其余是说明 |
| 不推荐使用的导出 | `@deprecated` | `@deprecatedZh` |

英文是正文：编辑器悬停时显示它，它也是发布包的语言。中文写在 `@zh` 标签里（以及 `@usageZh`、`@deprecatedZh`），
两种语言挨在一起，一起修改。

产物是 `docs/en-US/**` 与 `docs/zh-CN/**`（总览和每个组件一页，页首有语言切换）、`docs/components.json`（每个
文字字段都是 `{ "en": …, "zh": … }`）以及 `stories/generated/` 中的 Storybook 故事。不要手改生成的文件；修改
TSDoc 或示例后运行 `pnpm docs:gen`。

### 写法

- **组件**：英文正文 + `@zh` 中文；`@category` 分类；`@usage` 英文常见用途 + `@usageZh` 中文常见用途（示例见上文
  英文部分）。正文第一句用于总览表格，写成完整的简短描述。两种语言都用空行分段；行内标记只用 `` `代码` `` 与
  `**加粗**`。
- **属性**：英文正文 + `@zh` 中文，`@default` 照旧。出现在文档中的每个属性都要有两种语言；继承自 Ant Design 或
  原生元素的属性不逐个列出。
- **示例**：英文正文第一行是标题、其余是说明；`@zh` 同样第一行是中文标题、其余是中文说明；`@section` 指定章节。
  说明可以省略，但一种语言有，另一种也必须有。标题与章节同名（如 "Basic usage" / 「基本用法」）时文档中不再
  重复小标题。
- **示例代码只有一份**：界面数据统一用**英文中性数据**（项目名、人名、文件名），不用真实业务数据。来自组件库自身
  的文字（空状态、「加载中」、「撤销」、封装的 Ant Design 组件的文字）随 `ThemeProvider` 的 `locale` 切换语言。
  示例中的注释用英文。
- **不翻译的标签**：`@category` 取 `Primitives`、`Basic`、`Data`、`Charts`、`AI`、`Feedback`、`Patterns`、`Media`；`@section` 取
  `Basic usage`（省略时的默认值）、`Variants`、`States`、`Advanced`；`@default` 是源代码（如 `'default'`、`2`）。
  中文显示名见上文的对照表。
- **英文写法**：美式拼写，标题用句首大写（"Loading and disabled"），现在时；单位前加空格（"200 ms"）；按键用
  反引号（`Tab`、`Enter`、`Esc`）；组件名不加反引号，属性与取值加反引号；界面文字用直双引号（"Undo"）。
- **检查**：英文中不得出现汉字与全角标点，`@zh` 中必须有汉字，两种语言都不能缺；`test/docs.test.ts` 会检查。
  两种语言都按上文的术语表用词。
