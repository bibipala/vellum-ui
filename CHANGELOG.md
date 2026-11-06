# Changelog

All notable changes to this project are documented in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to
[Semantic Versioning](https://semver.org/) (0.x: minor versions may contain breaking changes).

## [Unreleased]

### Added

- `Upload` with `Upload.Dropzone`: the file list (progress, "Retry" for failed uploads, "Remove"
  with focus moving to the next file) is rendered by the library. Upload never sends requests by
  itself: set `customRequest` or `action`; without them files are only added to the list. `accept`
  is checked for chosen and dropped files, `maxSize` limits the size, and `onReject` reports
  rejected files. The drop area has a filled background with a dashed outline and turns to a
  subtle accent background while files are dragged over it.
- `Steps` (current step in the accent color, check marks for finished steps, `aria-current`) and
  `Breadcrumb` (current page with `aria-current="page"`, items with only `onClick` rendered as
  buttons, items with `menu` opening a `Dropdown`).
- `Popover`: opened by click, focus moves into it and returns to the trigger after `Esc`.
- `Slider`, `Progress` (line and ring, tabular numbers, no decorative "active" animation),
  `ColorPicker` (the swatch is a keyboard-accessible button), `TimePicker` with
  `TimePicker.RangePicker`, `Cascader` and `AutoComplete` (with `block`).
- `Image`: placeholder while loading and fade-in, a fallback when loading fails, and a preview on
  the neutral viewer background; `src` is passed to `<img>` unchanged.
- Built-in texts `upload.*`, `breadcrumb.label`, `colorPicker.label`, `image.error`.
- `Kbd`: key caps for keyboard shortcuts, written as a list (`['Mod', 'K']`) or like a hotkey
  (`'mod+k'`). `Mod` is ⌘ on macOS and Ctrl elsewhere; on macOS the modifiers are symbols. The
  platform is read when rendering, so server rendering and hydration use the non-macOS keys and
  switch right after hydration.
- `CopyButton` (icon button or with a label) and `copyable` on `CodeBlock`: writes to the
  clipboard with `navigator.clipboard.writeText` and never reads from it; shows a check mark and
  announces "Copied", or shows the failed state and calls `onError` (without `onError` the error
  goes to `reportError`).
- `useHotkeys(keys, handler, options)` with `useRegisteredHotkeys` and `HotkeysProvider`: `mod`
  across platforms, not fired in text fields by default (`allowInInputs`) or while an input method
  is composing, the most recently registered hotkey wins, hotkeys inside a provider win over the
  page's, and registering one combination twice in a scope warns in development. The registry
  lists the hotkeys that have a `description`, for shortcut help.
- `Splitter`: two panes with a handle that can be dragged (pointer events with pointer capture)
  or adjusted with the keyboard (`←` / `→`, `Shift` for larger steps, `Home`, `End`, `Enter`);
  `role="separator"` with `aria-valuenow`; `min`, `max` and an optional `storageKey` to remember
  the size on the device.
- `ContextMenu`: opens the Dropdown menu on right click, `Shift+F10` or the menu key, at the
  pointer or below the focused element, with icons, danger and disabled items, dividers and
  shortcut hints (`Kbd`); focus returns after closing; text fields keep the browser's menu.
- `CommandPalette` and `matchCommands`: fuzzy matching where every word must match, results kept
  together by group, keyboard navigation with `aria-activedescendant`, key hints, an empty state,
  an optional `onSearch` that is debounced and aborted with an `AbortSignal`, and at most `limit`
  results (50) with a line saying how many more there are.
- Built-in texts `copy.*`, `kbd.*`, `splitter.label`, `commandPalette.*`; component tokens
  `kbd-height`, `splitter-handle-size`, `splitter-grip-length`, `command-palette-*`.
- Documentation: the options of a hook (`Use<Name>Options`) are documented in an "Options" table.
- Chart colors (`SemanticColors.chart`, tokens `color-chart-*`): eight categorical colors in a fixed
  order (the first is the accent), a seven-step sequential ramp, a seven-step diverging ramp with a
  neutral midpoint, a de-emphasis color, gridlines and axes, and the text color inside each fill
  (`color-chart-N-on`). Light and dark are separate selections, not a flip. A test checks the
  lightness band, the chroma floor, the color difference of neighboring colors under simulated
  protanopia and deuteranopia (Machado 2009) and for normal vision, and the contrast with the surface.
- Charts built on ECharts (an internal implementation; the props are vellum-ui's own): `LineChart`,
  `AreaChart` (`stacked`), `BarChart` (grouped, `stacked`, `orientation="horizontal"`, `showValues`),
  `PieChart` / `DonutChart` (the tail beyond `maxSlices` is folded into "Other"), `ScatterChart`
  (nearest-point hover) and `Heatmap` (sequential or diverging, with a color scale). Every chart has
  a legend that hides series without recoloring the others, a "Chart / Table" switch (the table
  grows with its rows up to 480 px), keyboard browsing with the same tooltip as hover and a polite
  announcement for screen readers, loading / empty / error states, and recolors on theme and color
  mode changes. Series and category names are rendered as text, never as HTML. Only the chart types
  you import are bundled; SVG renderer; safe to render on the server.
- `ChartContainer`: the card, legend, table view and states of the charts, for custom graphics.
- `Sparkline`: a small trend line without axes for stat tiles and table cells. The history is in the
  de-emphasis color and the last value is an accent dot (or one chart color with `slot`); gaps break
  the line; screen readers read the label and a summary (first, last, low, high).
- `Statistic`: a stat tile with a label, a value (semibold, proportional figures, compact from
  10,000), `prefix` / `suffix`, a change against a named period (arrow and signed text, colored by
  direction and `goodWhen`, read as one sentence), a trend sparkline and a loading skeleton that keeps
  the size.
- `SegmentedBar`: one whole split into parts, `thin` (8 px, `dense` 4 px) or `tall` (28 px, share or
  amount printed where it fits, measured after layout). Parts past `maxItems` fold into "Other";
  every block has a tooltip on hover and keyboard focus (one Tab stop, arrow keys) and an accessible
  name.
- Types `ValueFormat` (`auto`, `number`, `compact`, `percent` or a function) and `ChartColorSlot`;
  constants `CHART_CATEGORICAL_COUNT`, `CHART_RAMP_STEPS`.
- Built-in texts `format.locale`, `format.missing`, `chart.*`, `sparkline.*`, `statistic.*`,
  `segmentedBar.*`; component tokens `chart-table-max-height`, `sparkline-*`, `segmented-bar-*`.
- Documentation: the category `Charts`.
- Streaming: `readTextStream` and `readSSE` read a `fetch` response (or a byte stream) as text or as
  Server-Sent Events (WHATWG parsing: line endings and UTF-8 characters split across chunks,
  heartbeat comments, `id` kept across events, a cut-off last event discarded), cancelled with an
  `AbortSignal`; `StreamResponseError` for non-2xx responses. `useStream({ request, initial, reduce })`
  folds the chunks into a value, with `start`, `stop` (the status changes at once and the partial
  value is kept) and `reset`; restarting or unmounting aborts the request, and dense chunks update
  the value at most once per animation frame.
- `Markdown` (built on `@ant-design/x-markdown`): renders AI replies, also while they stream in
  (half-written syntax shown as finished, a cursor at the end, optional `typewriter`). Raw HTML is
  always shown as text; links work only for http, https, mailto and relative addresses (checked
  after decoding entities and removing invisible characters) and external ones open in a new tab
  with `rel="noopener noreferrer"`; remote images are not loaded unless `allowImage` allows the
  address. Code blocks are `CodeBlock`s; with `sources`, `[1]` becomes a `Citation`. On the server
  it renders the text as plain text and switches to Markdown after hydration.
- `StreamingText`: plain text typed out at the pace the chunks arrive, without splitting
  characters; shown at once when the stream ends or motion is reduced.
- `Reasoning` (thinking, with the measured or given duration; opens while thinking and closes when
  done unless the user toggled it) and `ToolCalls` (steps with status as icon and text, input and
  output collapsed as JSON), built on Ant Design X.
- `Sources` (collapsed to "N sources", with the site's domain) and `Citation` (an inline marker with
  a card on hover and focus); site icons are never fetched.
- `MessageList`: a virtualized list (the number of DOM nodes does not depend on the number of
  messages) that opens at the end and follows new messages and a growing reply. Scrolling up by
  wheel, touch, keyboard or the scroll bar pauses following and shows "Back to latest" with the
  number of new messages; earlier messages inserted at the start (`onReachStart`) do not move the
  visible ones; screen readers hear the finished reply once instead of every chunk.
- `Message` (user messages in a bubble, assistant messages full width; streaming, error with retry
  and stopped states; actions shown on hover and focus without changing the height) and
  `MessageActions` (copy, retry, like and dislike as toggle buttons, custom actions; a toolbar with
  arrow-key navigation).
- `PromptInput` (built on Ant Design X's Sender): grows with the text, `Enter` sends and
  `Shift+Enter` adds a line (not while an input method is composing), the send button becomes "Stop"
  while `generating` (`Esc` stops too), and files can be attached by button, drop or paste and are
  checked against `accept`, `maxSize` and `maxFiles`. The component never uploads or reads the
  files and never reads the clipboard.
- `PromptSuggestions`: suggestions as buttons, wrapped or vertical, with disabled items that explain
  why.
- `CodeBlock`: `language` shows a header with the language and the copy button.
- Built-in texts `markdown.*`, `reasoning.*`, `toolCalls.*`, `sources.*`, `citation.label`,
  `messageList.*`, `message.*`, `messageActions.*`, `promptInput.*`, `promptSuggestions.*`; component
  tokens `stream-cursor-*`, `markdown-quote-bar-width`, `tool-calls-icon-size`, `citation-size`,
  `source-icon-size`, `citation-card-width`, `chat-max-width`, `chat-bubble-max-width`,
  `prompt-attachment-max-width`; icons `brain`, `thumbs-up`, `thumbs-down`, `stop`.
- Documentation: the category `AI`. Performance budgets (wall-clock time) run on their own with
  `pnpm test:perf`.
- `DataTable`: a table with vellum-ui's own column definitions (`DataTableColumn`), always one native
  `<table>` (sticky header and pinned columns with `position: sticky`). Sorting (controlled for
  server-side sorting, or local with `compare`; `aria-sort`), multiple selection (header checkbox
  with a mixed state, `Shift`-click ranges, keys of other pages kept), pinned columns (`pin`),
  resizable columns (drag or keyboard on a `role="separator"` handle; only the columns after it
  move), column settings (show and hide, order, pin, restore defaults) saved on the device with
  `storageKey`, virtual scrolling for large data (`height` or `fill`), loading that keeps the rows
  and appears after 200 ms, empty and error states, `toolbar` and `footer` slots, and `bulkActions`
  (with `totalCount` and `onSelectAll`) that turn the toolbar row into a SelectionBar while rows
  are selected.
- `InlineEdit`: edits a text, number or select value in place, in a table cell, a list or a detail
  page. Click, `Enter` or `F2` to edit; `Enter` or leaving the field saves, `Esc` cancels. Saving is
  optimistic and rolls back with the error shown below the field when `onSave` fails; `validate`
  checks while typing after the first error; numbers are decimal strings, never floating point.
  Viewing and editing have the same size, so table rows do not jump.
- `SelectionBar`: replaces the toolbar in place while items are selected (the same height; the
  content below does not move): the count, "Clear selection", "Select all N" and the actions. The
  count is announced politely; `Esc` clears; focus goes back to where the selection was made.
- Built-in texts `dataTable.*`, `inlineEdit.*`, `selectionBar.*`; component tokens `data-table-*`,
  `inline-edit-*`, `selection-bar-*`; icons `columns`, `pin-start`, `pin-end`.

### Fixed

- Compound components (`Form`, `Input`, `Checkbox`, `Radio`, `TreeSelect`, `DatePicker`,
  `TimePicker`, `Cascader`, `Descriptions`, `Upload`) are marked `/* @__PURE__ */`, so importing one
  export of a module no longer bundles all the others.
- Generated Chinese documentation no longer shows a space where a TSDoc line breaks between two
  Chinese characters.
- Generated documentation names the most specific native element interface of a component (it used
  whichever inherited prop TypeScript listed first).

## [0.1.0] - Unreleased

First version. Not published to npm yet; `pnpm pack` produces an installable tarball with the
layout described under [Package](#package).

### Package

- Build output in `dist/` (`pnpm build`): ES modules, one file per source module so that unused
  components are tree-shaken (Vite library mode); TypeScript declarations (`tsc`); `styles.css`
  with the compiled CSS Modules and the base styles; `global.css` and `fonts.css`.
- `react` and `react-dom` (19+) are peer dependencies. Ant Design, dayjs, `lucide-react`,
  `@tanstack/react-virtual` and the font packages are dependencies and stay external, so an
  application keeps a single copy of each.
- Entry points: `vellum-ui`, `vellum-ui/styles.css` (required), `vellum-ui/global.css`,
  `vellum-ui/fonts.css`, `vellum-ui/docs/components.json`, `vellum-ui/examples/*`.
- The JavaScript does not import CSS; `sideEffects` lists the CSS files only.
- Published files: `dist/`, `docs/components.json`, `examples/`, `README.md`, `LICENSE`,
  `CHANGELOG.md`. Inside a workspace the package resolves to its sources; `publishConfig` points
  `exports`, `main` and `types` to `dist/` when packing or publishing.

### Theme and tokens

- Design tokens in three layers (primitive → semantic → component), emitted as `--vl-*` CSS
  custom properties.
- `ThemeProvider` with light / dark / system color modes, comfortable / compact density and an
  in-app "reduce motion" switch, all switchable at runtime; `useTheme()` to read and change them.
- One built-in theme (`defaultTheme`, accent "clear blue"); `extendTheme` for brand colors,
  per-mode colors and token overrides; colors defined in OKLCH with derived state colors and WCAG
  AA contrast checks.
- Neutral viewer background tokens (`viewer-*`) with chroma-free defaults, overridable by themes.
- Tools: `compileTheme`, `resolveTheme`, `toCssText`, `cssVar`, `toAntdTheme`, OKLCH helpers
  (`oklch`, `formatOklch`, `toHex`, `contrastRatio`, `deriveStates`).

### Components

- Primitives: `Box`, `Center`, `Divider`, `Grid`, `Inline`, `Spacer`, `Stack`, `Text`.
- Basics: `Avatar`, `Button`, `Checkbox`, `CountBadge`, `DatePicker`, `Dropdown`, `Form`,
  `Heading`, `Icon`, `IconButton`, `Input`, `InputNumber`, `LinkButton`, `ListItem`, `Pill`,
  `Radio`, `Segmented`, `Select`, `SettingRow`, `StatusDot`, `Switch`, `Tabs`, `Tooltip`,
  `TreeSelect`.
- Data: `CodeBlock`, `Descriptions`, `Pagination`, `Table`, `Timeline`, `Tree`, `VirtualList`.
- Feedback: `Alert`, `App`, `Drawer`, `EmptyState`, `ErrorState`, `Loading`, `Modal`,
  `PageSkeleton`, `Popconfirm`, `Skeleton`, `useConfirmDanger`, `useMessage` (with undoable
  messages), `useDelayedPending`.
- Page patterns: `Page`, `PageHeader`, `Panel`, `Section`, `SplitView`, `Toolbar`.
- Media: `ImageGrid` (virtualized media grid), `Lightbox` (image viewer).
- Ant Design is an internal implementation detail: no antd component or type is re-exported, and
  components do not accept `style` / `className`.

### Interaction

- Unified state layer for hover and press, keyboard-only focus rings, `disabledReason` on buttons,
  loading indicators and skeletons that appear after 200 ms and stay at least 400 ms, motion
  durations from tokens.
- Keyboard and focus: `Modal`, `Drawer`, `Lightbox` and `useConfirmDanger` move focus into the
  dialog, keep `Tab` inside it and return focus on close (also on the first opening of each
  instance); the danger confirmation focuses "Cancel". `Dropdown` menus opened by click move focus
  into the menu (arrow keys work) and return it to the trigger; `Popconfirm` focuses "Cancel" and
  returns focus to the trigger.
- `Tooltip` appears after 500 ms, switches immediately when moving to a neighbouring tooltip, and
  appears immediately on keyboard focus.
- Filled inputs (`Input`, `InputNumber`, `Select`, `TreeSelect`, `DatePicker`) show the accent
  border and focus halo; focus rings of `Tabs` and `Pagination` appear without a transition;
  buttons with an icon keep their width while loading.
- `Form` validates a field on blur, then on every change once it has shown an error, and focuses
  the first invalid field on submit.

### Testing

- Browser tests for every interactive component (Vitest browser mode with Playwright, headless
  Chromium from `CHROMIUM_PATH`), next to the Node tests; see [Tests](README.md#tests).

### Languages

- Built-in texts in English (`enUS`, default) and Simplified Chinese (`zhCN`); `locale` on
  `ThemeProvider` accepts `'en-US'`, `'zh-CN'` or a custom text table, and switches the locale of
  the wrapped Ant Design components and of dayjs as well; `messages` overrides individual texts.
- `LocaleProvider` switches the built-in texts and the Ant Design locale for part of a page (for
  example a documentation preview) without changing the theme or the global locale of dayjs.

### Styles

- Required styles in `vellum-ui/styles.css` (component styles and base styles), imported once by
  the application; they only target the library's own elements.
- Entrance keyframes `vl-rise`, used by `Page` and available to applications as
  `global(vl-rise)` in CSS Modules.
- Optional page-level stylesheet `vellum-ui/global.css` (body, headings, selection, scrollbars,
  page transitions, color scheme) and optional fonts `vellum-ui/fonts.css` (Inter, JetBrains
  Mono, SIL OFL 1.1).

### Documentation

- Component documentation generated from TSDoc and examples, in English (`docs/en-US/`) and
  Simplified Chinese (`docs/zh-CN/`): an overview and one page per component, each linking to the
  same page in the other language; `docs/README.md` chooses the language.
- Bilingual TSDoc: English is the main text, Chinese goes in `@zh` (`@usageZh`, `@deprecatedZh`);
  `@category` and `@section` use English identifiers. The convention and a glossary are in
  `CONTRIBUTING.md`, and the documentation tests require both languages.
- Machine-readable docs data `vellum-ui/docs/components.json` with every text field as
  `{ en, zh }`, typed by the exported `ComponentDocsJson`; examples `vellum-ui/examples/*` with
  English data.
- Storybook with mode, density and language switches (English by default); the language also
  switches the title and description shown above each example.
- `README.md` in English and `README.zh-CN.md` in Simplified Chinese.
