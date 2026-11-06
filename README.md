# vellum-ui

**English** | [简体中文](README.zh-CN.md)

A React component library built on top of [Ant Design](https://ant.design/), with a design-token
system, a runtime theme engine and built-in interaction guidelines.

> *Vellum* is the translucent tracing paper used by designers and painters. The visual direction
> of the library is the same idea: clear, layered surfaces instead of borders and heavy shadows.

**Status:** early development (0.x, not yet published to npm). The API may change between minor
versions until 1.0. See the [changelog](CHANGELOG.md).

**Repository:** development currently happens inside another repository. The standalone repository
at <https://github.com/bibipala/vellum-ui> (the `repository` and `homepage` fields of
`package.json`) has not been created yet.

## Features

- **Design tokens in three layers**: primitive → semantic → component. Every token is emitted as
  a CSS custom property with the `--vl-` prefix; components only reference semantic tokens.
- **Runtime theme engine**: light / dark / follow-the-system, accent color, comfortable or
  compact density and "reduce motion", all switchable at runtime without a reload. State colors
  (hover, active, subtle backgrounds) are derived in OKLCH, and text contrast is checked against
  WCAG AA.
- **Components**: layout primitives (`Stack`, `Inline`, `Grid`, `Box`, …), text, buttons
  (including `CopyButton`), key caps (`Kbd`), forms and inputs (including `Upload`, `Slider`,
  `ColorPicker`, `TimePicker`, `Cascader`, `AutoComplete`), menus (`Dropdown`, `ContextMenu`),
  navigation (`Steps`, `Breadcrumb`), data display (`Table`, `DataTable`, `InlineEdit`, `SelectionBar`, `Tree`,
  `Descriptions`, `VirtualList`), charts (`LineChart`, `AreaChart`, `BarChart`, `PieChart`, `DonutChart`,
  `ScatterChart`, `Heatmap`, `Sparkline`, `Statistic`, `SegmentedBar`), AI and streaming
  (`MessageList`, `Message`, `MessageActions`, `PromptInput`, `PromptSuggestions`, `Markdown`,
  `StreamingText`, `Reasoning`, `ToolCalls`, `Sources`, `Citation`, `useStream`), feedback (`useMessage`, `Popover`, `Progress`, `EmptyState`, `ErrorState`,
  `Loading`, `PageSkeleton`), page patterns (`Page`, `Panel`, `SplitView`, `Splitter`, `Toolbar`,
  `CommandPalette`, keyboard shortcuts with `useHotkeys`) and media (`Image`, `ImageGrid`,
  `Lightbox`).
- **Interaction guidelines built in**: one state layer for hover and press, a consistent keyboard
  focus ring, delayed loading indicators that do not flash, and motion durations from tokens.
- **Languages**: English (default) and Simplified Chinese built in, or your own text table. The
  language of the wrapped Ant Design components and of dayjs follows along.
- **Bilingual documentation**: every component has a page with examples and props in English and
  Simplified Chinese, generated from the TSDoc; Storybook and the machine-readable
  `components.json` carry both languages.
- **No global styles by default**: the required styles only target the library's own elements;
  page-level styles are an optional stylesheet.
- **Ant Design as an implementation detail**: wrapped components keep antd's names and props, but
  appearance comes from the theme and `style` / `className` are not part of the public props.

## Installation

```sh
pnpm add vellum-ui react react-dom
```

Until the first release is on npm, build a tarball from this package and install that instead:

```sh
pnpm build && pnpm pack          # in this package: vellum-ui-0.1.0.tgz
pnpm add /path/to/vellum-ui-0.1.0.tgz react react-dom   # in your project (npm install works too)
```

- `react` and `react-dom` (19+) are peer dependencies. Ant Design, dayjs, the icon set
  (`lucide-react`), `@tanstack/react-virtual` and the fonts are regular dependencies; they are not
  bundled into the package, so your application keeps a single copy of each.
- The package contains ES modules (one file per source module, so unused components are
  tree-shaken), TypeScript declarations and plain CSS files. Use a bundler that handles CSS imports
  (Vite, webpack, Rspack, Next.js, …).

## Usage

```tsx
import 'vellum-ui/styles.css' // required, once: the styles of the components
import 'vellum-ui/fonts.css' // optional: Inter and JetBrains Mono
import 'vellum-ui/global.css' // optional: page-level styles, see below
import { App, Button, Stack, ThemeProvider } from 'vellum-ui'

export function Root() {
  return (
    <ThemeProvider defaultColorMode="system" locale="en-US">
      <App>
        <Stack>
          <Button type="primary">Save</Button>
        </Stack>
      </App>
    </ThemeProvider>
  )
}
```

Wrap the application once in `ThemeProvider`, and in `App` if you use `useMessage` or
`useConfirmDanger`. `ThemeProvider` writes the compiled tokens to a `<style>` element and sets
`data-vl-theme`, `data-vl-mode`, `data-vl-density` and `data-vl-reduced-motion` on the document
root.

### ThemeProvider props

| Prop | Description |
| --- | --- |
| `theme` | Theme definition, default `defaultTheme`. Build your own with `extendTheme`. |
| `colorMode` / `defaultColorMode` / `onColorModeChange` | `'light'`, `'dark'` or `'system'` (controlled or uncontrolled). |
| `density` / `defaultDensity` / `onDensityChange` | `'comfortable'` or `'compact'`. |
| `locale` | `'en-US'` (default), `'zh-CN'`, or a custom text table (missing keys fall back to English). |
| `messages` | Override individual texts on top of `locale`. |
| `reducedMotion` | In-app "reduce motion" switch; the system setting always applies. |
| `defaultViewerStage` | Default background of `Lightbox`: `'mid'`, `'dark'` or `'black'`. |

`useTheme()` reads and changes the current mode, density and viewer background at runtime.

### Languages

```tsx
<ThemeProvider locale="zh-CN">…</ThemeProvider>

// A language that is not built in: provide the texts you have, the rest stays English.
<ThemeProvider locale={{ 'spin.loading': 'Chargement', 'error.retry': 'Réessayer' }}>…</ThemeProvider>
```

The built-in tables are exported as `enUS` and `zhCN`; the keys are listed by the `MessageKey`
type. Switching `locale` also switches the locale of the wrapped Ant Design components and the
global locale of dayjs (`en` or `zh-cn`).

To show part of a page in another language (for example a documentation preview), wrap it in
`LocaleProvider`. It switches the built-in texts and the locale of the wrapped Ant Design components
inside it, and keeps the theme, mode and density of the surrounding `ThemeProvider` and the global
locale of dayjs:

```tsx
<LocaleProvider locale="en-US">{preview}</LocaleProvider>
```

### Styles

| Stylesheet | Import | Contents |
| --- | --- | --- |
| `vellum-ui/styles.css` | required, once | The styles of the components (compiled CSS Modules) and the base styles: state layer (`[data-vl-state]`), focus rings of the components, fixes for the wrapped Ant Design components, tabular numbers, "reduce motion" variables, the `vl-rise` entrance keyframes. Only targets the library's own elements and `--vl-*` variables. |
| `vellum-ui/global.css` | optional | `:root` color scheme and font rendering, `body`, `h1`–`h4`, `::selection`, thin scrollbars, a focus ring for every focusable element on the page, and a page transition for the element with `view-transition-name: vl-main`. |
| `vellum-ui/fonts.css` | optional | Inter and JetBrains Mono (see [Fonts](#fonts)). |

- The JavaScript modules do not import CSS. Import `styles.css` yourself, before your own styles,
  so that your rules win on equal specificity. Because nothing is imported from JavaScript, the
  components also load in environments without a CSS pipeline (server rendering, unit tests in
  Node).
- The CSS files are listed in `sideEffects` of `package.json`, so bundlers keep these side-effect
  imports; the JavaScript is free of side effects.
- Import `global.css` when the whole page is built with vellum-ui; leave it out when the
  components live inside an existing page whose styles you want to keep.
- To reuse the entrance animation in your own CSS Modules, reference the keyframes as global:
  `animation: global(vl-rise) var(--vl-motion-duration-slow) var(--vl-motion-ease-standard) both;`.
  Written without `global()`, CSS Modules renames `vl-rise` to a local name and the animation
  silently does nothing.

## Theming

A theme provides two sets of semantic colors (light and dark) and the non-color scale. Start
from the built-in theme and override what you need:

```ts
import { defaultTheme, extendTheme, oklch } from 'vellum-ui'

export const brandTheme = extendTheme(defaultTheme, {
  id: 'brand',
  nameKey: 'theme.brand', // looked up in the text table
  // both modes
  colors: { accent: oklch(0.55, 0.17, 150), accentFill: oklch(0.55, 0.17, 150) },
  // dark mode only
  dark: { accent: oklch(0.7, 0.15, 150) },
  // compiled tokens, without the --vl- prefix
  tokens: { 'radius-lg': '10px' },
})
```

- Colors are defined in OKLCH; hover, active, disabled and subtle variants are derived
  automatically for both modes.
- `tokens` overrides compiled tokens directly. Component tokens (control heights and other
  density-dependent sizes) are not affected by overrides.
- **Viewer background** (`viewer-*` tokens): `Lightbox` and the caption overlay of `ImageGrid`
  use a neutral, chroma-free background by default, independent of the accent color and of
  light / dark mode, because a tinted background changes how colors in images are perceived.
  The defaults are exported as `viewerStageTokens`; a theme may override them through `tokens`
  (an application can decide to forbid that in its own wrapper).
- `compileTheme`, `resolveTheme`, `toCssText` and `cssVar` are available for tooling and tests;
  `toAntdTheme` maps a resolved theme to an Ant Design theme config.

## Components

See the [component overview](docs/en-US/README.md) ([简体中文](docs/zh-CN/README.md)): every
component has a page with examples and a property table, in English and in Simplified Chinese, generated
from the TSDoc and the examples. How to write that documentation is described in
[CONTRIBUTING.md](CONTRIBUTING.md).

Examples live in `vellum-ui/examples/*.examples.tsx`; they are TypeScript sources that import from
`vellum-ui`, so rendering them needs a bundler that compiles `.tsx` (for example Vite). The data in
the examples is English; texts that come from the library itself follow `locale`.

### Documentation data

The same documentation is available in machine-readable form as `vellum-ui/docs/components.json`,
for rendering it inside your own application. Its type is exported as `ComponentDocsJson`:

```ts
import json from 'vellum-ui/docs/components.json' with { type: 'json' }
import type { ComponentDocsJson, DocLanguage } from 'vellum-ui'

const docs: ComponentDocsJson = json
const lang: DocLanguage = 'en' // or 'zh'
for (const c of docs) console.log(c.name, c.category[lang], c.summary[lang])
```

- The file is an array of `ComponentDoc`, ordered by category and then by name.
- Every text field is a `DocText`, `{ "en": "…", "zh": "…" }`: `category`, `summary`, `usage`, the
  `description` of each prop, and the `title`, `description` and `section` of each example. The `en`
  values of `category` (`Primitives`, `Basic`, `Data`, `Charts`, `AI`, `Feedback`, `Patterns`, `Media`) and `section`
  (`Basic usage`, `Variants`, `States`, `Advanced`) also serve as identifiers.
- The other fields are not translated: `name`; for props `name`, `type`, `default` (source code or
  `null`) and `required`; for examples `name` (the exported function) and `code`; and `base`, `native`
  and `antd`, which say which props the component accepts besides its own (the props shared by all
  primitives, the attributes of a native element, the props of the wrapped Ant Design component).

```jsonc
{
  "name": "Button",
  "category": { "en": "Basic", "zh": "基础" },
  "summary": { "en": "Buttons trigger an action. …", "zh": "按钮。…" },
  "usage": { "en": "Primary action of a page header, …", "zh": "页面头的主操作、…" },
  "props": [{ "name": "type", "type": "…", "description": { "en": "…", "zh": "…" }, "default": "'default'", "required": false }],
  "base": false,
  "native": null,
  "antd": "ButtonProps",
  "examples": [{ "name": "Basic", "title": { "en": "Basic usage", "zh": "基本用法" }, "description": { "en": "…", "zh": "…" }, "section": { "en": "Basic usage", "zh": "基本用法" }, "code": "export function Basic() { … }" }]
}
```

## Development

```sh
pnpm storybook        # component playground on http://127.0.0.1:3620 (toolbar: mode, density, language)
pnpm docs:gen         # regenerate docs/ (en-US, zh-CN, components.json) and stories/generated/
pnpm test             # all tests: the node project and the browser project (see below)
pnpm typecheck
pnpm build            # build the package into dist/
pnpm pack             # build a tarball with the published file layout
```

### Tests

`vitest.config.ts` defines two [projects](https://vitest.dev/guide/projects), and `pnpm test` runs
both:

| Project | Files | Runs in |
| --- | --- | --- |
| `node` | `test/**/*.test.ts(x)` | Node: tokens, guards, documentation and package checks, server-rendered markup, state machines |
| `browser` | `test/browser/**/*.browser.test.tsx` | Headless Chromium through Playwright: keyboard, focus, hover, overlays, motion and timing |

```sh
pnpm test --project node       # only the Node tests
pnpm test --project browser    # only the browser tests
CHROMIUM_PATH=/path/to/chrome pnpm test --project browser
pnpm test:perf                 # performance budgets (see below), not part of pnpm test
```

- **Performance budgets:** the tests in `test/browser/perf/` measure wall-clock time (long tasks,
  frame intervals), for example no task longer than 50 ms while about 10 KB of Markdown streams
  in. Wall-clock time is only reliable when no other tests compete for the CPU, so
  `vitest.perf.config.ts` runs them on their own, one file at a time (`pnpm test:perf`). Run them
  after changing performance-sensitive code such as streaming rendering or the message list.

- **Browser:** the tests use an installed Chromium-based browser; Playwright does not download
  one (do not run `playwright install`). Set `CHROMIUM_PATH` to its executable. On Linux it
  defaults to `/usr/bin/chromium`; on Windows and macOS it must be set, for example
  `C:\Program Files\Google\Chrome\Application\chrome.exe` or
  `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.
- Components render inside `ThemeProvider` and `App` with the library's styles loaded
  (`test/browser/render.tsx`), so state layers, focus rings and transitions are the real ones.
  `global.css` is not loaded: components must not depend on it.
- Timing (tooltip delay, message durations, delayed loading indicators) uses fake timers for
  `setTimeout` and `Date` only; animations and `requestAnimationFrame` stay real. While a
  `userEvent` command runs, Vitest advances fake timers by its real duration, so timing assertions
  measure from a point taken before or after the interaction (`clock()` in `render.tsx`), and
  "appears immediately" is checked right after `settle()` rather than with `expect.poll` (which
  advances fake timers on every retry).
- New or changed interactive behavior needs a browser test: keyboard, focus, hover, overlays
  opening and closing, motion.

Each component has examples in `examples/<Component>.examples.tsx`; documentation and Storybook
stories are generated from the examples and the TSDoc of the component and its props, in English and
Chinese (see [CONTRIBUTING.md](CONTRIBUTING.md)). The generator only writes inside this package.

**Storybook:** the language in the toolbar (English by default) switches the texts of the components
and the title and description shown above each example. Story names in the sidebar are the English
titles.

**Sources during development, build output when published.** In a workspace the package is used
from source: `exports` in `package.json` points to `src/`, and tools that consume it (type checker,
test runner, Storybook, the application's bundler) need no build step. There, each component and
`ThemeProvider` import their own CSS, so `vellum-ui/styles.css` resolves to an empty placeholder.
`pnpm pack` and `pnpm publish` replace `exports`, `main` and `types` with the values in
`publishConfig`, which point to `dist/`:

| Path | Contents |
| --- | --- |
| `dist/index.js`, `dist/**/*.js` | ES modules, one per source module (Vite library mode); dependencies and peer dependencies stay external |
| `dist/index.d.ts`, `dist/**/*.d.ts` | Type declarations (`tsc`) |
| `dist/styles.css` | Compiled CSS Modules and base styles, merged |
| `dist/global.css`, `dist/fonts.css` | The optional stylesheets, copied as they are |

The published files are `dist/`, `docs/components.json`, `examples/`, `README.md`, `README.zh-CN.md`,
`LICENSE` and `CHANGELOG.md` (the `files` field). When you add an entry point, add it to both `exports` and
`publishConfig.exports`; `test/package.test.ts` checks that they match.

## Fonts

`vellum-ui/fonts.css` loads [Inter](https://rsms.me/inter/) and
[JetBrains Mono](https://www.jetbrains.com/lp/mono/) from the `@fontsource-variable/*`
dependencies through `@import`; your bundler copies the font files into your build, so they work
offline. Both fonts are licensed under the SIL Open Font License 1.1 (see the `LICENSE` file in
each `@fontsource-variable/*` package). CJK text uses the
system fonts of each platform.

## License

[MIT](LICENSE)

