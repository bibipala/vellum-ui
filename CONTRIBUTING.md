# Contributing to vellum-ui

**English** | [简体中文](#简体中文)

This guide covers bilingual documentation, public API conventions and releases. Development commands are in
the [README](README.md#development). Keep changes focused, update the relevant documentation and tests, and
run `pnpm check` before submitting a pull request.

## Bilingual documentation

The documentation is generated from the code by `pnpm docs:gen` (`scripts/docs.ts`):

| Source | English | Chinese |
| --- | --- | --- |
| Component function | main text of the TSDoc | `@zh` |
| Common uses | `@usage` | `@usageZh` |
| Each prop of the props interface | main text of the TSDoc | `@zh` |
| Example function in `examples/<Component>.examples.tsx` | main text: first line is the title, the rest is the description | `@zh`: first line is the title, the rest is the description |
| Mode: a member of a props union (such as single and multiple selection) | main text: first line is the title, the rest is the description | `@zh`: the same |
| Static member (`Form.Item`, `Input.Search`, `Form.useForm`) in the `<Name>Component` interface | main text of the TSDoc | `@zh` |
| Type used by the props (`SelectOption`, `FormRule`, …) and each of its fields | main text of the TSDoc | `@zh` |
| Export other than a component or hook (API reference), with `@group` | main text of the TSDoc | `@zh` |
| Page recipe in `examples/recipes/<Name>.recipe.tsx` | main text: first line is the title, the rest is the description | `@zh`: the same |
| Deprecated export | `@deprecated` | `@deprecatedZh` |

Write English in the TSDoc body for editor tooltips, and Chinese in `@zh`, `@usageZh` and `@deprecatedZh`.
Update both languages together.

The output is `docs/en-US/**` and `docs/zh-CN/**` (an overview, one page per component, the API reference in
`api/`, the page recipes in `recipes/` and the design tokens in `tokens.md`, with a language switch at the top of
each page), `docs/components.json` (every text field as `{ "en": …, "zh": … }`), `llms.txt` (the entry point for AI
coding agents) and the Storybook stories in `stories/generated/`. Update the TSDoc or examples and run
`pnpm docs:gen`; do not edit generated files. The documentation and examples ship with the package, so consumers
can read version-matched documentation in `node_modules/vellum-ui/`. Storybook stories remain development files.

The guides in `docs/<language>/guides/` are written by hand, in both languages with the same file names. The
first `#` heading and following paragraph become the title and summary in the overview and `llms.txt`. Keep
summary links independent of the source page. Use short examples in guides and complete, type-checked recipes
for full pages.

Every export must be documented: a component or hook with `@category` (a page of its own), any other value with
`@group` (a section of the API reference). `pnpm docs:check` reports exports without either.

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
   * Heading level: 1 page title, 2 block title, 3 subsection title, 4 body-sized heading.
   * @zh 标题级别：1 页面标题、2 区块标题、3 小节标题、4 与正文同字号的标题。
   * @default 2
   */
  readonly level?: 1 | 2 | 3 | 4
}
```

Every own prop of a component is documented in both languages, one by one, including props of components that are
implemented with Ant Design. A component that renders one main element (a button, an input, a switch) may also
accept that element's native attributes (`id`, `aria-*`, `data-*`, event handlers) through the internal `NativeProps`
helper; those are not listed, and the page names the attribute interface instead (such as `ButtonHTMLAttributes`).
Overlays and containers accept no native attributes: they take `testId` (rendered as `data-testid`) when they need
a test hook, and `aria-label` when they need an accessible name.

### The public API is the library's own

Components may be implemented with antd, but their public props must not reference types from antd,
`@ant-design/*`, `rc-*`, `@rc-component/*` or dayjs: not in props, callback arguments, values, refs or static
members. `pnpm docs:check` and `pnpm api:check` fail otherwise. Write the own props in an unexported
`<Name>OwnProps` interface, and let the exported `<Name>Props` extend it (and `NativeProps<…, <Name>OwnProps>` for a
component that renders one element). Add a prop only when there is a real use for it; antd's other features stay
hidden. Names follow these rules (names that already follow them stay as they are):

| Concept | Rule |
| --- | --- |
| Size | `size: 'sm' \| 'md' \| 'lg'` (`ControlSize`); convert to antd's names inside the component with `toAntSize` |
| Semantic color | `tone`, with values from `neutral`, `accent`, `success`, `warning`, `danger`, `info` |
| Appearance | `variant`, such as Button `variant="primary"` |
| Native names | a prop with the name of a native attribute keeps its native meaning, such as Button `type="submit"` |
| Validation status | `status: 'error' \| 'warning'` on inputs: a status, not a tone |
| Values | `value` / `defaultValue` / `onChange(value)`; switches `checked` / `onChange(checked)`; text inputs pass the native change event |
| Overlays | `open` / `defaultOpen` / `onOpenChange(open)` |
| Dates, times, decimals | ISO strings (`'2026-11-07'`, `'14:30'`, date-times with the local offset); decimals as strings |
| Refs | the native element, or a handle declared by the library (such as `{ focus(), blur() }`) |

Data interfaces may define boolean flags, such as `danger` on a menu item.

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
- Examples are copied as they are, so the page shows each one complete: the imports it uses, the declarations of
  the file it uses (sample data at the top level of the file), and the function. Declarations imported from the
  `.ts` helpers next to the examples (`_stream.ts`, `stories/sample.ts`) are inlined. Import only from `vellum-ui`
  and `react`; the one exception is `DemoFrame` from `./_frame.tsx`, a fixed-height container that the page
  explains. `test/docs.test.ts` type-checks every example and recipe on its own, as it appears on the page.

### Modes, static members and types

- **Modes**: when the props of a component are a union (single and multiple selection of Select, number and
  decimal string of InputNumber), the props that all members share are in the main table and the others are listed
  per mode. Give each member interface a TSDoc whose first line is the title, naming the prop that selects the
  mode: `` Multiple selection: `multiple` ``.
- **Static members**: document each member of the `<Name>Component` interface (`readonly Item: (props:
  FormItemProps) => JSX.Element`). A sub-component gets its props table from its props type; a function member
  (`Form.useForm`) is shown with its signature.
- **Types**: the exported types that the props, members or hook signature refer to are listed on the page, with
  their fields, so each field needs a description in both languages.
- **API reference**: exports that are neither components nor hooks (ThemeProvider, `extendTheme`, `cssVar`,
  `iconNames`, …) take `@group` with one of `Theme`, `Colors`, `Localization`, `Keyboard shortcuts`, `Streaming`,
  `Utilities`; the generated page shows the description and the signature, so describe the parameters and the
  return value in the text.

### Tags that are not translated

| Tag | Value |
| --- | --- |
| `@category` | `Primitives`, `Basic`, `Data`, `Charts`, `AI`, `Feedback`, `Patterns` or `Media` (see the table below) |
| `@section` | `Basic usage` (default when omitted), `Variants`, `States` or `Advanced` |
| `@group` | `Theme`, `Colors`, `Localization`, `Keyboard shortcuts`, `Streaming` or `Utilities` |
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
| appearance | 外观 | `variant` |
| control size | 控件尺寸 | `ControlSize`: `sm` / `md` / `lg` |
| validation status | 校验状态 | `status` of inputs and Form.Item |
| meter | 量表 | a Progress with `tone`, such as storage use |
| test id | 测试定位 | `testId`, rendered as `data-testid` |
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

## Releases

`.github/workflows/release.yml` publishes stable `v<version>` tags to npm. It runs only in the public upstream
repository. Tags must exactly match `package.json` and point to a commit on `main`. Prereleases need a separate
dist-tag policy and are rejected. The check job installs the lockfile, installs Chromium, runs `pnpm check`,
then builds with `pnpm pack` and inspects the tarball. The publish job downloads that same artifact; only the
`npm publish` step receives a credential. It publishes with provenance and lifecycle scripts disabled.

### One-time account setup

Complete component and documentation acceptance before enabling publication:

1. Make `bibipala/vellum-ui` public. In Settings → Pages, choose **GitHub Actions** as the source; run the Pages
   workflow if the latest push happened while the repository was private.
2. On npm, create a **granular access token** with package **Read and write** access and **Bypass two-factor
   authentication** enabled. Do not choose **Stage-only**: this workflow publishes directly. Creating the first
   unscoped package may require **All Packages** because the package cannot yet be selected. After the first
   release, revoke that token and replace it with one limited to `vellum-ui`. Choose a short expiry and rotate it
   before it expires; leave organization permissions at **No access**. Never paste a token into an issue or chat.
3. Store the token as an Actions secret named **NPM_TOKEN**. A repository secret under Settings → Secrets and
   variables → Actions is supported. For environment-specific controls, create **npm** under Settings →
   Environments, add the secret there and restrict deployment tags to `v*`. An environment secret takes precedence
   over a repository secret with the same name. Required reviewers are optional; publication waits for any
   configured review. Use a secret, not a variable, and never commit the token.

Sources: [npm CI/CD](https://docs.npmjs.com/using-private-packages-in-a-ci-cd-workflow),
[granular tokens](https://docs.npmjs.com/creating-and-viewing-access-tokens),
[provenance](https://docs.npmjs.com/generating-provenance-statements).

### Release a version

Update `package.json` and `CHANGELOG.md`, check the API and documentation, and merge the verified commit into
`main`. In a standalone checkout (Node 24+, pnpm as specified by `packageManager`, Chromium installed):

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm pack --pack-destination release
npm publish ./release/vellum-ui-1.0.1.tgz --dry-run --access public --ignore-scripts
# After account setup and acceptance; substitute the version for later releases:
git push origin main
git tag -a v1.0.1 -m "Release 1.0.1"
git push origin v1.0.1
```

`prepack` builds the package. Do not run `npm publish` on the source directory: npm does not apply pnpm's
`publishConfig.exports`, `main` and `types` overrides, which would publish broken entry points. The tarball must
contain `dist`, both languages of `docs`, and `llms.txt`. `scripts/release.ts` checks the tag and packed entries.
On Linux, tests default to `/usr/bin/chromium`; set `CHROMIUM_PATH` for another browser location. CI installs
Playwright Chromium and supplies its executable path explicitly.

Create each tag at the final verified commit. Never move a pushed tag. When a workflow fails before npm
publication, fix account configuration if needed and rerun that tag's workflow.
Reruns use the original commit and workflow. If repository code or the workflow needs a fix, release a new
patch version with a new tag, even if npm never received the previous version. Prefix local tarball paths
with `./` (or use an absolute path); npm can interpret `release/package.tgz` as a GitHub repository.
After npm has accepted a version, do not unpublish or republish it; check `pnpm view vellum-ui@1.0.1 version` and
the workflow log before deciding whether a new patch version is needed. A local dry-run does not verify token
permissions, GitHub environment settings or provenance issuance; the first real workflow run verifies those.

## 简体中文

[English](#contributing-to-vellum-ui) | **简体中文**

本指南说明双语文档、公共 API 约定与发布流程。开发命令见 [README](README.zh-CN.md#开发)。
提交 pull request 前，请保持改动范围明确，更新相关文档与测试，并运行 `pnpm check`。

### 双语文档

文档由 `pnpm docs:gen`（`scripts/docs.ts`）从代码生成：

| 来源 | 英文 | 中文 |
| --- | --- | --- |
| 组件函数 | TSDoc 正文 | `@zh` |
| 常见用途 | `@usage` | `@usageZh` |
| 属性接口的每个属性 | TSDoc 正文 | `@zh` |
| `examples/<组件>.examples.tsx` 中的示例函数 | 正文：第一行是标题，其余是说明 | `@zh`：第一行是标题，其余是说明 |
| 用法：属性联合类型中的一员（如单选与多选） | 正文：第一行是标题，其余是说明 | `@zh`：同左 |
| `<名称>Component` 接口中的静态成员（`Form.Item`、`Input.Search`、`Form.useForm`） | TSDoc 正文 | `@zh` |
| 属性用到的类型（`SelectOption`、`FormRule` 等）及其每个字段 | TSDoc 正文 | `@zh` |
| 组件与 hook 以外的导出（API 参考），加 `@group` | TSDoc 正文 | `@zh` |
| `examples/recipes/<名称>.recipe.tsx` 中的页面配方 | 正文：第一行是标题，其余是说明 | `@zh`：同左 |
| 不推荐使用的导出 | `@deprecated` | `@deprecatedZh` |

英文写在 TSDoc 正文中，供编辑器提示使用；中文写在 `@zh`、`@usageZh` 与 `@deprecatedZh` 中。两种语言同步更新。

产物是 `docs/en-US/**` 与 `docs/zh-CN/**`（总览、每个组件一页、`api/` 中的 API 参考、`recipes/` 中的页面配方与
`tokens.md` 设计令牌，页首有语言切换）、`docs/components.json`（每个文字字段都是 `{ "en": …, "zh": … }`）、
`llms.txt`（AI 编程智能体入口）以及 `stories/generated/` 中的 Storybook 故事。修改 TSDoc 或示例后运行
`pnpm docs:gen`，不直接编辑生成文件。文档与示例随包发布，使用方可在 `node_modules/vellum-ui/` 中读取与安装版本
一致的文档；Storybook 故事仅用于开发。

`docs/<语言>/guides/` 中的指南是手写的，两种语言文件名相同。第一个 `#` 标题是标题，它后面的一段是简介，都会出现在
总览与 `llms.txt` 中；简介中的链接不应依赖原页面位置。指南提供简短示例，完整页面使用可通过类型检查的配方。

每个导出都要有文档：组件与 hook 用 `@category`（单独一页），其他值用 `@group`（API 参考中的一节）。两者都没有时
`pnpm docs:check` 报错。

### 写法

- **组件**：英文正文 + `@zh` 中文；`@category` 分类；`@usage` 英文常见用途 + `@usageZh` 中文常见用途（示例见上文
  英文部分）。正文第一句用于总览表格，写成完整的简短描述。两种语言都用空行分段；行内标记只用 `` `代码` `` 与
  `**加粗**`。
- **属性**：英文正文 + `@zh` 中文，`@default` 照旧。组件的每个自有属性都逐个写两种语言的说明，用 Ant Design 实现的
  组件也一样。渲染一个主要元素的组件（按钮、输入框、开关）可以通过内部工具 `NativeProps` 接收这个元素的原生属性
  （`id`、`aria-*`、`data-*`、事件处理函数），这些不逐个列出，文档页改为写明原生属性的接口（如 `ButtonHTMLAttributes`）。
  弹层与容器不接收原生属性：需要测试定位时用 `testId`（输出为 `data-testid`），需要读屏名称时接收 `aria-label`。
- **公共接口由组件库自己声明**：组件内部可以用 antd 实现，但公开的属性不得引用 antd、`@ant-design/*`、`rc-*`、
  `@rc-component/*`、dayjs 的类型，属性、回调参数、值、ref、静态成员都不行，否则 `pnpm docs:check` 与
  `pnpm api:check` 失败。自有属性写在不导出的 `<名称>OwnProps` 接口中，导出的 `<名称>Props` 继承它（渲染单个元素的
  组件再加上 `NativeProps<…, <名称>OwnProps>`）。只在确有用途时增加属性，antd 的其余能力不暴露。命名规则（已经符合的
  名称保持不变）：
  - 尺寸：`size: 'sm' | 'md' | 'lg'`（`ControlSize`），在组件内部用 `toAntSize` 换算为 antd 的名称；
  - 语义色：`tone`，取值为 `neutral`、`accent`、`success`、`warning`、`danger`、`info`；
  - 外观：`variant`，如 Button 的 `variant="primary"`；
  - 原生名称：与原生属性同名的属性保持原生含义，如 Button 的 `type="submit"`；
  - 校验状态：输入类组件用 `status: 'error' | 'warning'`，它是状态，不是色调；
  - 值：`value` / `defaultValue` / `onChange(value)`；开关类 `checked` / `onChange(checked)`；文本输入收到原生的变更事件；
  - 弹层开关：`open` / `defaultOpen` / `onOpenChange(open)`；
  - 日期、时间与小数：ISO 字符串（`'2026-11-07'`、`'14:30'`，日期时间带本地时区偏移）；小数用字符串；
  - ref：指向原生元素，或组件库声明的句柄（如 `{ focus(), blur() }`）。

  数据接口可以定义布尔字段，例如菜单项的 `danger`。
- **示例**：英文正文第一行是标题、其余是说明；`@zh` 同样第一行是中文标题、其余是中文说明；`@section` 指定章节。
  说明可以省略，但一种语言有，另一种也必须有。标题与章节同名（如 "Basic usage" / 「基本用法」）时文档中不再
  重复小标题。
- **示例代码只有一份**：界面数据统一用**英文中性数据**（项目名、人名、文件名），不用真实业务数据。来自组件库自身
  的文字（空状态、「加载中」、「撤销」、封装的 Ant Design 组件的文字）随 `ThemeProvider` 的 `locale` 切换语言。
  示例中的注释用英文。
- **示例会被原样复制**，所以页面上每个示例都是完整的：用到的导入、文件中用到的声明（文件顶层的示例数据）和示例
  函数。从示例旁的 `.ts` 辅助模块（`_stream.ts`、`stories/sample.ts`）导入的声明会内联进来。只从 `vellum-ui` 与
  `react` 导入；唯一的例外是 `./_frame.tsx` 中的 `DemoFrame`（固定高度的容器，页面上有说明）。`test/docs.test.ts`
  会把每个示例和页面配方按页面上的样子单独做类型检查。
- **用法**：组件的属性是联合类型时（Select 的单选与多选、InputNumber 的数字与十进制字符串），各员共有的属性在主表，
  其余的按用法列出。每个成员接口的 TSDoc 第一行是标题，写明选择这种用法的属性：`` Multiple selection: `multiple` ``。
- **静态成员**：`<名称>Component` 接口中的每个成员都要写说明（`readonly Item: (props: FormItemProps) => JSX.Element`）。
  子组件的属性表来自它的属性类型；函数成员（`Form.useForm`）显示签名。
- **类型**：属性、静态成员与 hook 签名引用的导出类型会连同字段列在组件页中，每个字段都要有两种语言的说明。
- **API 参考**：既不是组件也不是 hook 的导出（ThemeProvider、`extendTheme`、`cssVar`、`iconNames` 等）加 `@group`，
  取 `Theme`、`Colors`、`Localization`、`Keyboard shortcuts`、`Streaming`、`Utilities` 之一；页面显示说明与签名，
  参数与返回值在正文中说明。
- **不翻译的标签**：`@category` 取 `Primitives`、`Basic`、`Data`、`Charts`、`AI`、`Feedback`、`Patterns`、`Media`；`@section` 取
  `Basic usage`（省略时的默认值）、`Variants`、`States`、`Advanced`；`@group` 取 `Theme`、`Colors`、`Localization`、
  `Keyboard shortcuts`、`Streaming`、`Utilities`；`@default` 是源代码（如 `'default'`、`2`）。
  中文显示名见上文的对照表。
- **英文写法**：美式拼写，标题用句首大写（"Loading and disabled"），现在时；单位前加空格（"200 ms"）；按键用
  反引号（`Tab`、`Enter`、`Esc`）；组件名不加反引号，属性与取值加反引号；界面文字用直双引号（"Undo"）。
- **检查**：英文中不得出现汉字与全角标点，`@zh` 中必须有汉字，两种语言都不能缺；`test/docs.test.ts` 会检查。
  两种语言都按上文的术语表用词。

### 发布

`.github/workflows/release.yml` 在公开的上游仓库收到 `v<版本>` 标签后自动发布 npm。标签必须与
`package.json` 的稳定版本完全相同，且提交已在 `main` 上。预发布版本尚未定义 dist-tag 策略，暂不接受。
检查 job 按锁文件安装、安装 Chromium、执行完整 `pnpm check`、用 `pnpm pack` 构建并检查安装包；发布 job
下载同一产物，只有最后的 `npm publish` 步骤读取令牌，附加来源证明并禁用生命周期脚本。

首次配置（组件与智能体使用体验验收通过后）：

1. 将 `bibipala/vellum-ui` 公开，在 Settings → Pages 选择 **GitHub Actions**；最近一次推送若发生在私有状态，
   手动运行 Pages 工作流。
2. 在 npm 创建 **granular access token**：包权限 **Read and write**，勾选 **Bypass two-factor authentication**，
   不选 **Stage-only**。首次发布的非作用域包尚不存在，可能需要临时选 **All Packages**；首发后撤销该令牌，
   换成只允许 `vellum-ui` 的令牌。选较短有效期、到期前轮换；组织权限保持 **No access**。不要在聊天中发送令牌。
3. 将令牌保存为名为 **NPM_TOKEN** 的 Actions secret。支持在 Settings → Secrets and variables → Actions
   添加仓库级密钥。需要环境级控制时，在 Settings → Environments 创建 **npm**，添加同名环境密钥并将可部署标签
   限制为 `v*`。环境密钥优先于同名仓库密钥。人工审核可选，配置后发布会等待审核。使用 Secret 而非 Variable，
   令牌不写入仓库。

更新版本与 CHANGELOG、完成检查、合入 main 后推送 main，再推送版本标签。完整命令及 npm 官方文档见上方
[Releases](#releases)。`prepack` 自动构建；必须先 `pnpm pack` 再发布 tgz，直接从源码目录 `npm publish` 不会
应用 pnpm 的入口覆盖，会发布无法使用的入口。Linux 测试默认用 `/usr/bin/chromium`，其他路径设置 `CHROMIUM_PATH`。

在最终验证过的提交上创建版本标签，已推送标签不可移动。npm 发布前失败可修复账号配置后重跑原标签；重跑仍使用原提交及工作流。
若需修改仓库代码或工作流，即使前一版本未发布到 npm，也应使用新的补丁版本和标签。本地 tarball 路径必须以
`./` 开头或使用绝对路径，否则 npm 可能将 `release/package.tgz` 当作 GitHub 仓库。npm 已接收的版本不能重发，先查
`pnpm view vellum-ui@1.0.1 version` 和工作流日志。dry-run 不验证令牌权限、GitHub 环境配置或来源证明签发，
这些必须由首次真实工作流运行确认。
