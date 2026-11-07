# vellum-ui

[English](README.md) | **简体中文**

基于 [Ant Design](https://ant.design/) 的 React 组件库，带有设计令牌体系、运行时主题引擎和内置的交互规范。

> *Vellum* 是设计师与画家使用的半透明描图纸。组件库的视觉方向也是这个意思：用清透、分层的表面，而不是描边和厚重的阴影。

**状态**：1.0.0（2026-11-07），第一个发布版本；尚未发布到 npm（见[安装](#安装)）。1.0 起接口遵循语义化版本。从 0.x
升级见 [MIGRATION.md](MIGRATION.md#简体中文)；全部变更见[变更记录](CHANGELOG.md)（英文）。

**仓库**：<https://github.com/bibipala/vellum-ui>

## 特性

- **三层设计令牌**：原始 → 语义 → 组件。每个令牌都输出为 `--vl-` 前缀的 CSS 变量；组件只引用语义令牌。
- **运行时主题引擎**：浅色 / 深色 / 跟随系统、强调色、舒适或紧凑两种密度、「减少动态效果」，都可以在运行时切换，无需
  刷新。状态色（悬停、按下、浅底）在 OKLCH 色彩空间派生，并按 WCAG AA 校验文字对比度。
- **组件**：布局原语（`Stack`、`Inline`、`Grid`、`Box` 等）、文字、按钮（含 `CopyButton`）、按键帽（`Kbd`）、表单与输入
  （含 `Upload`、`Slider`、`ColorPicker`、`TimePicker`、`Cascader`、`AutoComplete`）、菜单（`Dropdown`、`ContextMenu`）、
  导航（`Steps`、`Breadcrumb`）、数据展示（`DataTable`、`InlineEdit`、`SelectionBar`、`Tree`、`Descriptions`、`VirtualList`）、图表（`LineChart`、`AreaChart`、`BarChart`、`PieChart`、`DonutChart`、`ScatterChart`、`Heatmap`、`Sparkline`、`Statistic`、`SegmentedBar`）、AI 与流式（`MessageList`、`Message`、`MessageActions`、`PromptInput`、`PromptSuggestions`、`Markdown`、`StreamingText`、`Reasoning`、`ToolCalls`、`Sources`、`Citation`、`useStream`）、反馈（`useMessage`、`Popover`、
  `Progress`、`EmptyState`、`ErrorState`、`Loading`、`PageSkeleton`）、页面模式（`Page`、`Panel`、`SplitView`、`Splitter`、
  `Toolbar`、`CommandPalette`，以及键盘快捷键 `useHotkeys`）与看图（`Image`、`ImageGrid`、`Lightbox`）。
- **内置交互规范**：悬停与按下使用统一的状态层，键盘焦点环一致，加载指示延迟出现、不闪，动效时长来自令牌。
- **语言**：内置英文（默认）与简体中文，也可以传入自己的文本表。封装的 Ant Design 组件与 dayjs 的语言随之切换。
- **双语文档**：每个组件都有英文与简体中文的文档页（示例与属性表），从 TSDoc 生成；Storybook 与机器可读的
  `components.json` 同时包含两种语言。
- **默认不改全局样式**：必需的样式只作用于组件库自己的元素；页面级样式是一份可选的样式表。
- **接口是自己的，Ant Design 在内部**：许多组件用 Ant Design 实现，但属性、值与回调由 vellum-ui 声明，公共接口中没有
  antd 的类型。因此升级 antd 或改为自己实现某个组件，都不影响使用方。整个组件库命名一致（`size` 取 `sm` / `md` / `lg`，
  语义色用 `tone`，外观用 `variant`），日期是 ISO 字符串；`style` / `className` 不属于公开属性，外观来自主题。

## 安装

```sh
pnpm add vellum-ui react react-dom
```

发布到 npm 之前，先在本包中生成安装包，再安装它：

```sh
pnpm build && pnpm pack          # 在本包中：生成 vellum-ui-<版本>.tgz
pnpm add /path/to/vellum-ui-<版本>.tgz react react-dom   # 在你的项目中（npm install 同样可以）
```

- `react` 与 `react-dom`（19+）是 peer 依赖。Ant Design、Ant Design X、ECharts、dayjs、图标库（`lucide-react`）、
  `@tanstack/react-virtual` 与字体是普通依赖；它们不会打进包内，你的应用中每个依赖只有一份。ECharts 与 Markdown 渲染器
  在第一次渲染图表或 Markdown 时才用 `import()` 加载，你的打包器会把它们放进单独的分块。
- 包内是 ES 模块（每个源码模块一个文件，没有用到的组件可以被 tree-shaking 去掉）、TypeScript 声明和普通 CSS 文件。
  请使用能处理 CSS 导入的打包器（Vite、webpack、Rspack、Next.js 等）。

## 使用

```tsx
import 'vellum-ui/styles.css' // 必需，导入一次：组件的样式
import 'vellum-ui/fonts.css' // 可选：Inter 与 JetBrains Mono
import 'vellum-ui/global.css' // 可选：页面级样式，见下文
import { App, Button, Stack, ThemeProvider } from 'vellum-ui'

export function Root() {
  return (
    <ThemeProvider defaultColorMode="system" locale="en-US">
      <App>
        <Stack>
          <Button variant="primary">Save</Button>
        </Stack>
      </App>
    </ThemeProvider>
  )
}
```

在应用最外层包一次 `ThemeProvider`；用到 `useMessage` 或 `useConfirmDanger` 时再包一层 `App`。`ThemeProvider` 把
编译后的令牌写入一个 `<style>` 元素，并在文档根元素上设置 `data-vl-theme`、`data-vl-mode`、`data-vl-density` 与
`data-vl-reduced-motion`。

### ThemeProvider 属性

| 属性 | 说明 |
| --- | --- |
| `theme` | 主题定义，默认 `defaultTheme`。用 `extendTheme` 定制自己的主题。 |
| `colorMode` / `defaultColorMode` / `onColorModeChange` | `'light'`、`'dark'` 或 `'system'`（受控或非受控）。 |
| `density` / `defaultDensity` / `onDensityChange` | `'comfortable'` 或 `'compact'`。 |
| `locale` | `'en-US'`（默认）、`'zh-CN'`，或自定义的文本表（缺少的键用英文补齐）。 |
| `messages` | 在 `locale` 的基础上覆盖个别文本。 |
| `reducedMotion` | 应用内的「减少动态效果」开关；系统设置始终生效。 |
| `defaultViewerStage` | `Lightbox` 的默认背景：`'mid'`、`'dark'` 或 `'black'`。 |

`useTheme()` 在运行时读取并切换当前的明暗模式、密度与看图背景。

### 语言

```tsx
<ThemeProvider locale="zh-CN">…</ThemeProvider>

// 没有内置的语言：提供已有的文本，其余保持英文。
<ThemeProvider locale={{ 'spin.loading': 'Chargement', 'error.retry': 'Réessayer' }}>…</ThemeProvider>
```

内置的文本表导出为 `enUS` 与 `zhCN`；全部键见 `MessageKey` 类型。切换 `locale` 时，封装的 Ant Design 组件的语言包与
dayjs 的全局语言（`en` 或 `zh-cn`）一起切换。

要让页面中的一部分以另一种语言显示（例如文档中的预览），用 `LocaleProvider` 包住它。它切换其中的内置文本与封装的
Ant Design 组件的语言包，主题、明暗与密度沿用外层的 `ThemeProvider`，也不改变 dayjs 的全局语言：

```tsx
<LocaleProvider locale="en-US">{preview}</LocaleProvider>
```

### 样式

| 样式表 | 导入 | 内容 |
| --- | --- | --- |
| `vellum-ui/styles.css` | 必需，导入一次 | 组件的样式（编译后的 CSS Modules）与基础样式：状态层（`[data-vl-state]`）、组件的焦点环、对封装的 Ant Design 组件的修正、等宽数字、「减少动态效果」变量、进入动画关键帧 `vl-rise`。只作用于组件库自己的元素与 `--vl-*` 变量。 |
| `vellum-ui/global.css` | 可选 | `:root` 的配色方案与字体渲染、`body`、`h1`–`h4`、`::selection`、细滚动条、页面上所有可聚焦元素的焦点环，以及 `view-transition-name: vl-main` 元素的页面切换动效。 |
| `vellum-ui/fonts.css` | 可选 | Inter 与 JetBrains Mono（见[字体](#字体)）。 |

- JavaScript 模块不导入 CSS。请自己导入 `styles.css`，并放在你自己的样式之前，同等优先级时你的规则生效。由于 JavaScript
  不导入任何 CSS，组件在没有 CSS 处理流程的环境中（服务端渲染、Node 中的单元测试）也能加载。
- `package.json` 的 `sideEffects` 列出了这些 CSS 文件，打包器会保留这些只为副作用的导入；JavaScript 没有副作用。
- 整个页面都用 vellum-ui 搭建时导入 `global.css`；组件放在一个已有页面中、需要保留原有样式时不要导入。
- 在自己的 CSS Modules 中复用进入动画时，以全局名称引用关键帧：
  `animation: global(vl-rise) var(--vl-motion-duration-slow) var(--vl-motion-ease-standard) both;`。不写 `global()`
  时，CSS Modules 会把 `vl-rise` 改名为局部名称，动画悄无声息地失效。

## 主题定制

主题提供两套语义颜色（浅色与深色）以及颜色以外的尺度。从内置主题出发，覆盖需要的部分：

```ts
import { defaultTheme, extendTheme, oklch } from 'vellum-ui'

export const brandTheme = extendTheme(defaultTheme, {
  id: 'brand',
  nameKey: 'theme.brand', // 在文本表中查找
  // 两种模式
  colors: { accent: oklch(0.55, 0.17, 150), accentFill: oklch(0.55, 0.17, 150) },
  // 只用于深色模式
  dark: { accent: oklch(0.7, 0.15, 150) },
  // 编译后的令牌，不带 --vl- 前缀
  tokens: { 'radius-lg': '10px' },
})
```

- 颜色用 OKLCH 定义；悬停、按下、禁用与浅底等变体在两种模式下自动派生。
- `tokens` 直接覆盖编译后的令牌。组件令牌（控件高度等随密度变化的尺寸）不受覆盖影响。
- **看图背景**（`viewer-*` 令牌，即看图舞台）：`Lightbox` 与 `ImageGrid` 的说明浮层默认使用中性、无彩度的背景，不随
  强调色和明暗模式变化，因为带色调的背景会改变人对图片颜色的感知。默认值导出为 `viewerStageTokens`；主题可以通过
  `tokens` 覆盖它们（应用可以在自己的封装中禁止这样做）。
- `compileTheme`、`resolveTheme`、`toCssText` 与 `cssVar` 供工具与测试使用。ThemeProvider 按同一个主题配置其中的
  Ant Design 组件；Ant Design 的主题配置不属于公共接口。

## 组件

见[组件总览](docs/zh-CN/README.md)（[English](docs/en-US/README.md)）。文档有英文与简体中文两种，随包发布
（`node_modules/vellum-ui/docs/`），因此总是与安装的版本一致：

- **指南**（`docs/zh-CN/guides/`）：怎样搭页面、接口约定（包括这里不适用的 Ant Design 习惯），以及什么时候、怎样
  自己写 CSS。
- **组件页**：引入方式、可以原样复制的完整示例、属性（因用法而异的属性按用法分组，如单选与多选）、`Form.Item`
  等静态成员，以及属性用到的类型。
- **页面配方**（`docs/zh-CN/recipes/`）：只用组件搭成的完整页面（列表、详情、主从、设置、表单弹窗、仪表盘、聊天）。
- **API 参考**（`docs/zh-CN/api/`）：ThemeProvider、主题与颜色函数、本地化、快捷键、流式与工具；以及**设计令牌**
  （`docs/zh-CN/tokens.md`）。

页面、数据与 Storybook 故事由 TSDoc 与示例生成，写法见 [CONTRIBUTING.md](CONTRIBUTING.md#简体中文)。

### 给 AI 编程智能体

[`llms.txt`](llms.txt) 是给编程智能体的入口：使用本库时的代码规则，以及全部指南、页面配方、组件页与 API 页的索引，
路径相对于包的根目录（英文）。在使用 vellum-ui 的项目中，把类似下面的一句加进智能体的说明（`AGENTS.md`、
`CLAUDE.md` 等）：

```md
The UI is built with vellum-ui. Before writing UI code, read `node_modules/vellum-ui/llms.txt` and follow its rules;
look up each component in the pages it links to.
```

示例在 `vellum-ui/examples/*.examples.tsx` 中；它们是从 `vellum-ui` 导入组件的 TypeScript 源码，渲染时需要能编译
`.tsx` 的打包器（如 Vite）。示例中的数据是英文；来自组件库自身的文字随 `locale` 切换。

### 文档数据

同一份文档也以机器可读的形式提供：`vellum-ui/docs/components.json`，用于在你自己的应用中展示文档。它的类型导出为
`ComponentDocsJson`：

```ts
import json from 'vellum-ui/docs/components.json' with { type: 'json' }
import type { ComponentDocsJson, DocLanguage } from 'vellum-ui'

const docs: ComponentDocsJson = json
const lang: DocLanguage = 'zh' // 或 'en'
for (const c of docs) console.log(c.name, c.category[lang], c.summary[lang])
```

- 文件是 `ComponentDoc` 数组，先按分类、再按名称排序。
- 每个文字字段都是 `DocText`，即 `{ "en": "…", "zh": "…" }`：`category`、`summary`、`usage`、每个属性的
  `description`，以及每个示例的 `title`、`description`、`section`。`category`（`Primitives`、`Basic`、`Data`、
  `Charts`、`AI`、`Feedback`、`Patterns`、`Media`）与 `section`（`Basic usage`、`Variants`、`States`、`Advanced`）的 `en` 同时作为
  标识。
- 其他字段不翻译：`name`；属性的 `name`、`type`、`default`（源代码或 `null`）与 `required`；示例的 `name`（导出的
  函数名）与 `code`；以及 `base` 与 `native`，说明组件在自有属性之外还接受哪些属性（所有原语共有的属性、原生元素的
  属性）。组件的每个自有属性都列在 `props` 中。
- 组件的属性是联合类型时，`props` 是各用法共有的属性，其余的按用法列在 `modes` 中（`title`、`description`、
  `props`）。`members` 是静态成员（`Form.Item` 带属性，`Form.useForm` 带 `signature`），`types` 是属性引用的本库类型
  （带 `fields`，类型别名带 `definition`），`signature` 是 hook 的签名（组件为 `null`）。这些类型都已导出：
  `ComponentModeDoc`、`ComponentMemberDoc`、`ComponentTypeDoc`。

结构示例见[英文版 README](README.md#documentation-data)。

## 开发

```sh
pnpm storybook        # 组件演示，http://127.0.0.1:3620（工具栏：明暗、密度、语言）
pnpm docs:gen         # 重新生成 docs/（en-US、zh-CN、components.json）与 stories/generated/
pnpm test             # 全部测试：node 与 browser 两组（见下文）
pnpm typecheck
pnpm build            # 构建到 dist/
pnpm pack             # 按发布时的文件结构生成安装包
pnpm api:update       # 有意修改公共接口后，重新生成接口报告 etc/vellum-ui.api.md
pnpm check            # lint、typecheck、test、docs:check 与 api:check
```

**接口报告**：`etc/vellum-ui.api.md`（API Extractor）记录公共接口，使接口的变化在审查中可见，版本号遵循语义化版本。
报告过期，或者其中导入了 antd、`@ant-design/*`、`rc-*`、`@rc-component/*`、dayjs 的类型时，`pnpm api:check` 失败：
公共接口由组件库自己声明。

### 文档站

文档同时是一个网站，用 vellum-ui 自己搭建（`site/`）：每个组件页带实时示例，以及指南、页面配方、API 参考与令牌，
英文与简体中文，带搜索（`Mod+K`）、明暗模式与密度。

```sh
pnpm site:dev         # http://127.0.0.1:3621
pnpm site:build       # 输出到 site/dist/（静态文件；链接用 hash，如 #/zh/components/Select）
pnpm site:preview     # 在 http://127.0.0.1:3622 上提供 site/dist/
```

`site:build` 还会把 `llms.txt`、`README.md`、`MIGRATION.md` 与 `docs/` 按包内相同的路径复制到 `site/dist/`，
`llms.txt` 中的链接在站点上同样有效。工作流 `.github/workflows/pages.yml` 在每次推送到 `main` 时构建站点并发布到
GitHub Pages（Pages 的来源选「GitHub Actions」）。它只在仓库公开时运行：仓库目前是私有的，站点尚未上线。

### 测试

`vitest.config.ts` 定义了两组[项目](https://vitest.dev/guide/projects)，`pnpm test` 运行两组：

| 项目 | 文件 | 运行环境 |
| --- | --- | --- |
| `node` | `test/**/*.test.ts(x)` | Node：令牌、守卫、文档与包清单检查、服务端渲染的结构、状态机 |
| `browser` | `test/browser/**/*.browser.test.tsx` | 经 Playwright 运行的无头 Chromium：键盘、焦点、悬停、弹层、动效与时序 |

```sh
pnpm test --project node       # 只跑 Node 测试
pnpm test --project browser    # 只跑浏览器测试
CHROMIUM_PATH=/path/to/chrome pnpm test --project browser
pnpm test:perf                 # 性能预算（见下文），不包含在 pnpm test 中
```

- **性能预算**：`test/browser/perf/` 中的测试测量挂钟时间（长任务、帧间隔），例如流式渲染约 10 KB 的 Markdown 时没有
  超过 50ms 的长任务。挂钟时间只有在没有其他测试同时占用 CPU 时才可靠，所以由 `vitest.perf.config.ts` 单独、逐个文件
  运行（`pnpm test:perf`）。改动流式渲染、消息列表等对性能敏感的代码后要运行。

- **浏览器**：测试使用已安装的 Chromium 内核浏览器，Playwright 不下载浏览器（不要运行 `playwright install`）。用
  `CHROMIUM_PATH` 指定可执行文件。Linux 下默认 `/usr/bin/chromium`；Windows 与 macOS 必须设置，例如
  `C:\Program Files\Google\Chrome\Application\chrome.exe` 或
  `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`。
- 组件渲染在 `ThemeProvider` 与 `App` 之内，并加载组件库的样式（`test/browser/render.tsx`），状态层、焦点环与过渡都是
  真实效果。不加载 `global.css`：组件不得依赖它。
- 时序（提示的延迟、消息条的时长、延迟出现的加载指示）只对 `setTimeout` 与 `Date` 使用假定时器；动画与
  `requestAnimationFrame` 保持真实。`userEvent` 命令执行期间，Vitest 会按它的真实耗时推进假定时器，所以时序断言从交互
  之前或之后取的时间点算起（`render.tsx` 中的 `clock()`）；「立即出现」在 `settle()` 之后立即检查，而不是用
  `expect.poll`（它每次重试都会推进假定时器）。
- 新增或改变的交互行为需要浏览器测试：键盘、焦点、悬停、弹层的打开与关闭、动效。

每个组件的示例在 `examples/<组件>.examples.tsx` 中；文档与 Storybook 故事由示例以及组件与属性的 TSDoc 生成，英文与
中文两种语言（见 [CONTRIBUTING.md](CONTRIBUTING.md#简体中文)）。生成器只写本包内的文件。

**Storybook**：工具栏中的语言（默认 English）同时切换组件的文字，以及每个示例上方显示的标题与说明。侧栏中的故事名
是英文标题。

**开发时用源码，发布时用构建产物。** 在工作区中直接使用本包的源码：`package.json` 的 `exports` 指向 `src/`，使用它的
工具（类型检查、测试运行器、Storybook、应用的打包器）都不需要先构建。此时每个组件与 `ThemeProvider` 各自导入自己的
CSS，`vellum-ui/styles.css` 解析为一个空的占位文件。`pnpm pack` 与 `pnpm publish` 用 `publishConfig` 中的值替换
`exports`、`main` 与 `types`，指向 `dist/`：

| 路径 | 内容 |
| --- | --- |
| `dist/index.js`、`dist/**/*.js` | ES 模块，每个源码模块一个（Vite 库模式）；依赖与 peer 依赖不打包 |
| `dist/index.d.ts`、`dist/**/*.d.ts` | 类型声明（`tsc`） |
| `dist/styles.css` | 编译后的 CSS Modules 与基础样式，合并为一个文件 |
| `dist/global.css`、`dist/fonts.css` | 可选的样式表，原样复制 |

发布的文件是 `dist/`、`docs/components.json`、`examples/`、`README.md`、`README.zh-CN.md`、`LICENSE` 与
`CHANGELOG.md`（`files` 字段）。新增入口时，`exports` 与 `publishConfig.exports` 都要加上；`test/package.test.ts`
检查两者一致。

## 字体

`vellum-ui/fonts.css` 通过 `@import` 从依赖 `@fontsource-variable/*` 加载 [Inter](https://rsms.me/inter/) 与
[JetBrains Mono](https://www.jetbrains.com/lp/mono/)；你的打包器会把字体文件复制进构建产物，离线也能使用。两种字体都
采用 SIL Open Font License 1.1 许可（见各 `@fontsource-variable/*` 包中的 `LICENSE` 文件）。中日韩文字使用各平台的
系统字体。

## 许可证

[MIT](LICENSE)
