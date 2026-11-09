# Changelog

All notable changes to this project are documented in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to
[Semantic Versioning](https://semver.org/). From 1.0.0 on, versions follow it strictly: breaking changes to the
public API (everything exported from the package entry, recorded in `etc/vellum-ui.api.md`) come only in a new
major version, and a deprecated API is kept for at least one minor version before it is removed.

## [1.0.0] - 2026-11-07

The first release. The public props of every component are now the library's own: no type from antd,
`@ant-design/*`, `rc-*` or dayjs is part of the API, sizes are `sm` / `md` / `lg`, semantic colors are `tone`,
value callbacks receive the value, and dates and times are ISO strings. Applications also load less code: charts
and Markdown load their engines on first render, and importing one input component no longer pulls in the others
(in one application built on the library, the shared UI chunk loaded at startup went from 3.02 MB, 829 KB gzip,
to 1.42 MB, 379 KB gzip). Version 0.1.0 was never released, so this section lists everything that changed since it.
Upgrading from 0.x is described in [MIGRATION.md](MIGRATION.md).

### Breaking changes

Every change, with examples, is in [MIGRATION.md](MIGRATION.md).

- Components implemented with antd declare their own props: each accepts only the props on its documentation page,
  and the other antd props are gone. Overlays and containers accept no refs or native attributes; tests use
  `testId` and `okTestId`.
- Sizes are `sm` / `md` / `lg` (`ControlSize`) everywhere.
- Button: `variant` (was `type`), `tone="danger"` (was `danger`), and `type` is the native button type (was
  `htmlType`).
- Value callbacks receive the value: Checkbox, Radio.Group, Switch, Segmented, Select, TreeSelect, Cascader,
  AutoComplete, Slider and ColorPicker. Input.Search calls `onSearch(value, info)`.
- Values: DatePicker and TimePicker use ISO strings, InputNumber with `decimal` uses decimal strings (was
  `stringMode`), and ColorPicker uses hex strings.
- "No value" is `null` in `value` and `onChange` of Select, TreeSelect, Cascader, DatePicker, TimePicker and
  InputNumber (Select, TreeSelect and Cascader used to report `undefined` when cleared); AutoComplete reports an
  empty string.
- Renamed: Select `multiple` (was `mode="multiple"`); TreeSelect `options`, `defaultExpandAll`, `checkable`,
  `showChecked`; Cascader `showChecked`; Form.Item `status` (was `validateStatus`); Modal `okDisabled`, `okLoading`,
  `okTone`, `okTestId` (was `okButtonProps`, `confirmLoading`); Popconfirm `okTone`; Drawer `width`, `testId`;
  Alert `tone` (`danger` was `error`); Timeline item `content` and `tone`; Progress `variant`, `showValue`,
  `status="error"`.
- Changed types: Form rules (`validator(value)` returns the error text) and the form instance, Dropdown menus (icon
  names, `selectedKeys`), Tree callbacks (`string[]`) and `onDrop` (`TreeDropInfo`), Steps and Breadcrumb items,
  Upload files and `customRequest`.
- Removed: Table and `TableProps`, Numeric, `toAntdTheme`, Form.List, Form.ErrorList, Form.useWatch, Upload's
  `beforeUpload`, `Upload.LIST_IGNORE` and ref, the static `SHOW_*` members of TreeSelect and Cascader, and the
  types listed under [Removed](#removed).
- Behavior: Modal always unmounts its content after closing; Toolbar is no longer `role="toolbar"`; Progress with
  a `tone` keeps that tone at 100%; LineChart no longer forces 0 onto its value axis; charts and Markdown show a
  placeholder until their engine has loaded.
- Documentation data: `ComponentDoc.antd` and the `antd` field of `components.json` are removed.

### Added

- Types for the library's own props, values and callbacks: `ControlSize`, `ChoiceOption`, `FieldAttributes`,
  `FocusOptions`, `SelectOption`, `SelectOptionGroup`, `TreeSelectOption`, `CascaderOption`, `AutoCompleteOption`,
  `ColorPreset`, `FormRule`, `FormValues`, `FieldName`, `FormFieldError`, `FormFinishFailedInfo`,
  `UploadFileStatus`, `UploadChangeInfo`, `DropdownMenu`, `DropdownMenuItem`, `DropdownMenuAction`,
  `DropdownMenuDivider`, `DescriptionsItem`, `TabsItem`, `TimelineItem`, `TreeDropInfo` and `LineAreaChartProps`
  (the props shared by LineChart and AreaChart). Every prop is documented in English and Chinese.
- Dropdown menu items take `shortcut`, shown with Kbd at the end of the item. Segmented options can have an `icon`
  and a `title` (required for an option with only an icon).
- API report: `etc/vellum-ui.api.md` (API Extractor) records the public API, so that changes show up in reviews.
  `pnpm api:update` writes it; `pnpm api:check`, part of `pnpm check`, fails when it is out of date or when it
  imports a type from antd, `@ant-design/*`, `rc-*`, `@rc-component/*` or dayjs. `pnpm docs:check` reports a
  component whose props extend an antd interface or use types from these libraries.
- Upload with Upload.Dropzone: the file list (progress, "Retry" for failed uploads, "Remove" with focus moving to
  the next file) is rendered by the library. Upload never sends requests by itself: set `customRequest` or
  `action`; without them files are only added to the list. `accept` is checked for chosen and dropped files,
  `maxSize` limits the size, and `onReject` reports rejected files. `customRequest` may return `{ abort() }`, so
  that "Remove" cancels the request. The drop area has a filled background with a dashed outline and turns to a
  subtle accent background while files are dragged over it.
- Steps (current step in the accent color, check marks for finished steps, `aria-current`) and Breadcrumb (current
  page with `aria-current="page"`, items with only `onClick` rendered as buttons, items with `menu` opening a
  Dropdown).
- Popover: when it is opened by click, focus moves into it and returns to the trigger after `Esc`.
- Slider, ColorPicker (the swatch is a keyboard-accessible button), TimePicker with TimePicker.RangePicker, Cascader
  and AutoComplete (with `block`).
- Progress, implemented by the library: a bar or a ring (`variant`) in three sizes (`sm` / `md` / `lg`: lines of
  4 / 8 / 12 px, rings of 48 / 80 / 120 px), with tabular numbers and no decorative "active" animation. `status`
  (`success` or `error`) shows a check or a cross and is read as "60%, failed"; `tone` (`accent`, `success`,
  `warning`, `danger`) colors meters such as storage use. The value takes the width of "100%", so the bar does not
  change length with the value; right-to-left layouts fill from the right.
- Meter colors for Progress: tokens `color-meter-<tone>` and `color-meter-<tone>-track` for `accent`, `success`,
  `warning` and `danger`, in both modes. The track is the same hue one step toward the background (3:1 against the
  fill), not a neutral gray; the fill is deepened or lifted until it reaches 3.75:1 against the surface and the
  canvas, which makes the light-mode warning a deeper amber.
- Image: placeholder while loading and fade-in, a fallback when loading fails, and a preview on the neutral viewer
  background; `src` is passed to `<img>` unchanged.
- Built-in texts `upload.*`, `breadcrumb.label`, `colorPicker.label`, `image.error`, `progress.success`,
  `progress.error`; component tokens `progress-line-sm` / `-md` / `-lg` and `progress-circle-sm` / `-md` / `-lg`.
- Kbd: key caps for keyboard shortcuts, written as a list (`['Mod', 'K']`) or like a hotkey (`'mod+k'`). `Mod` is
  ⌘ on macOS and Ctrl elsewhere; on macOS the modifiers are symbols. The platform is read when rendering, so server
  rendering and hydration use the non-macOS keys and switch right after hydration.
- CopyButton (icon button or with a label) and `copyable` on CodeBlock: writes to the clipboard with
  `navigator.clipboard.writeText` and never reads from it; shows a check mark and announces "Copied", or shows the
  failed state and calls `onError` (without `onError` the error goes to `reportError`).
- `useHotkeys(keys, handler, options)` with `useRegisteredHotkeys` and HotkeysProvider: `mod` across platforms,
  not fired in text fields by default (`allowInInputs`) or while an input method is composing, the most recently
  registered hotkey wins, hotkeys inside a provider win over the page's, and registering one combination twice in a
  scope warns in development. The registry lists the hotkeys that have a `description`, for shortcut help.
- Splitter: two panes with a handle that can be dragged (pointer events with pointer capture) or adjusted with the
  keyboard (`←` / `→`, `Shift` for larger steps, `Home`, `End`, `Enter`); `role="separator"` with
  `aria-valuenow`; `min`, `max` and an optional `storageKey` to remember the size on the device.
- ContextMenu: opens the Dropdown menu on right click, `Shift+F10` or the menu key, at the pointer or below the
  focused element, with icons, danger and disabled items, dividers and shortcut hints (Kbd); focus returns after
  closing; text fields keep the browser's menu.
- CommandPalette and `matchCommands`: fuzzy matching where every word must match, results kept together by group,
  keyboard navigation with `aria-activedescendant`, key hints, an empty state, an optional `onSearch` that is
  debounced and aborted with an `AbortSignal`, and at most `limit` results (50) with a line saying how many more
  there are.
- Built-in texts `copy.*`, `kbd.*`, `splitter.label`, `commandPalette.*`; component tokens `kbd-height`,
  `splitter-handle-size`, `splitter-grip-length`, `command-palette-*`.
- Documentation: the options of a hook (`Use<Name>Options`) are documented in an "Options" table.
- Chart colors (`SemanticColors.chart`, tokens `color-chart-*`): eight categorical colors in a fixed order (the
  first is the accent), a seven-step sequential ramp, a seven-step diverging ramp with a neutral midpoint, a
  de-emphasis color, gridlines and axes, and the text color inside each fill (`color-chart-N-on`). Light and dark
  are separate selections, not a flip. A test checks the lightness band, the chroma floor, the color difference of
  neighboring colors under simulated protanopia and deuteranopia (Machado 2009) and for normal vision, and the
  contrast with the surface.
- Charts, with ECharts as an internal implementation (the props are vellum-ui's own): LineChart (`includeZero`),
  AreaChart (`stacked`), BarChart (grouped, `stacked`, `orientation="horizontal"`, `showValues`), PieChart /
  DonutChart (the tail beyond `maxSlices` is folded into "Other"), ScatterChart (nearest-point hover) and Heatmap
  (sequential or diverging, with a color scale). Every chart has a legend that hides series without recoloring the
  others, a "Chart / Table" switch (a native table with a sticky header that grows with its rows up to 480 px),
  keyboard browsing with the same tooltip as hover and a polite announcement for screen readers, loading / empty /
  error states, and recolors on theme and color mode changes. Series and category names are rendered as text,
  never as HTML. ECharts is loaded on first render, with only the modules of the chart types in use: until then
  the plot area keeps its final size and shows a loading indicator after 200 ms, while the title, legend, view
  switch and table view are already usable; a failed load shows an error state with "Retry". SVG renderer; safe to
  render on the server.
- ChartContainer: the card, legend, table view and states of the charts, for custom graphics.
- Sparkline: a small trend line without axes for stat tiles and table cells. The history is in the de-emphasis
  color and the last value is an accent dot (or one chart color with `slot`); gaps break the line; screen readers
  read the label and a summary (first, last, low, high).
- Statistic: a stat tile with a label, a value (semibold, proportional figures, compact from 10,000), `prefix` /
  `suffix`, a change against a named period (arrow and signed text, colored by direction and `goodWhen`, read as
  one sentence), a trend sparkline and a loading skeleton that keeps the size.
- SegmentedBar: one whole split into parts, `thin` (8 px, `dense` 4 px) or `tall` (28 px, share or amount printed
  where it fits, measured after layout). Parts past `maxItems` fold into "Other"; every block has a tooltip on hover
  and keyboard focus (one Tab stop, arrow keys) and an accessible name.
- Types `ValueFormat` (`auto`, `number`, `compact`, `percent` or a function) and `ChartColorSlot`; constants
  `CHART_CATEGORICAL_COUNT`, `CHART_RAMP_STEPS`.
- Built-in texts `format.locale`, `format.missing`, `chart.*`, `sparkline.*`, `statistic.*`, `segmentedBar.*`;
  component tokens `chart-table-max-height`, `chart-table-cell-padding-y` / `-x`, `sparkline-*`,
  `segmented-bar-*`.
- Documentation: the category `Charts`.
- Streaming: `readTextStream` and `readSSE` read a `fetch` response (or a byte stream) as text or as Server-Sent
  Events (WHATWG parsing: line endings and UTF-8 characters split across chunks, heartbeat comments, `id` kept
  across events, a cut-off last event discarded), cancelled with an `AbortSignal`; `StreamResponseError` for
  non-2xx responses. `useStream({ request, initial, reduce })` folds the chunks into a value, with `start`, `stop`
  (the status changes at once and the partial value is kept) and `reset`; restarting or unmounting aborts the
  request, and dense chunks update the value at most once per animation frame.
- Markdown (built on `@ant-design/x-markdown`): renders AI replies, also while they stream in (half-written syntax
  shown as finished, a cursor at the end, optional `typewriter`). Raw HTML is always shown as text; links work only
  for http, https, mailto and relative addresses (checked after decoding entities and removing invisible
  characters) and external ones open in a new tab with `rel="noopener noreferrer"`; remote images are not loaded
  unless `allowImage` allows the address. Code blocks are CodeBlocks; with `sources`, `[1]` becomes a Citation. The
  renderer is loaded on first render: on the server and until it has loaded, the text is shown as escaped plain
  text (line breaks kept, a cursor while streaming), then as Markdown; if loading fails, the plain text stays and
  the cause is logged.
- StreamingText: plain text typed out at the pace the chunks arrive, without splitting characters; shown at once
  when the stream ends or motion is reduced.
- Reasoning (thinking, with the measured or given duration; opens while thinking and closes when done unless the
  user toggled it) and ToolCalls (steps with status as icon and text, input and output collapsed as JSON), built on
  Ant Design X.
- Sources (collapsed to "N sources", with the site's domain) and Citation (an inline marker with a card on hover
  and focus); site icons are never fetched.
- MessageList: a virtualized list (the number of DOM nodes does not depend on the number of messages) that opens at
  the end and follows new messages and a growing reply. Scrolling up by wheel, touch, keyboard or the scroll bar
  pauses following and shows "Back to latest" with the number of new messages; earlier messages inserted at the
  start (`onReachStart`) do not move the visible ones; screen readers hear the finished reply once instead of every
  chunk.
- Message (user messages in a bubble, assistant messages full width; streaming, error with retry and stopped
  states; actions shown on hover and focus without changing the height) and MessageActions (copy, retry, like and
  dislike as toggle buttons, custom actions; a toolbar with arrow-key navigation).
- PromptInput (built on Ant Design X's Sender): grows with the text, `Enter` sends and `Shift+Enter` adds a line
  (not while an input method is composing), the send button becomes "Stop" while `generating` (`Esc` stops too),
  and files can be attached by button, drop or paste and are checked against `accept`, `maxSize` and `maxFiles`.
  The component never uploads or reads the files and never reads the clipboard.
- PromptSuggestions: suggestions as buttons, wrapped or vertical, with disabled items that explain why.
- CodeBlock: `language` shows a header with the language and the copy button.
- Built-in texts `markdown.*`, `reasoning.*`, `toolCalls.*`, `sources.*`, `citation.label`, `messageList.*`,
  `message.*`, `messageActions.*`, `promptInput.*`, `promptSuggestions.*`; component tokens `stream-cursor-*`,
  `markdown-quote-bar-width`, `tool-calls-icon-size`, `citation-size`, `source-icon-size`, `citation-card-width`,
  `chat-max-width`, `chat-bubble-max-width`, `prompt-attachment-max-width`; icons `brain`, `thumbs-up`,
  `thumbs-down`, `stop`.
- Documentation: the category `AI`. Performance budgets (wall-clock time) run on their own with `pnpm test:perf`.
- DataTable: a table with vellum-ui's own column definitions (`DataTableColumn`), always one native `<table>`
  (sticky header and pinned columns with `position: sticky`). Sorting (controlled for server-side sorting, or local
  with `compare`; `aria-sort`), multiple selection (header checkbox with a mixed state, `Shift`-click ranges, keys
  of other pages kept), pinned columns (`pin`), resizable columns (drag or keyboard on a `role="separator"` handle;
  only the columns after it move), column settings (show and hide, order, pin, restore defaults) saved on the
  device with `storageKey`, virtual scrolling for large data (`height` or `fill`), loading that keeps the rows and
  appears after 200 ms, empty and error states, `toolbar` and `footer` slots, and `bulkActions` (with `totalCount`
  and `onSelectAll`) that turn the toolbar row into a SelectionBar while rows are selected.
- InlineEdit: edits a text, number or select value in place, in a table cell, a list or a detail page. Click,
  `Enter` or `F2` to edit; `Enter` or leaving the field saves, `Esc` cancels. Saving is optimistic and rolls back
  with the error shown below the field when `onSave` fails; `validate` checks while typing after the first error;
  numbers are decimal strings, never floating point. Viewing and editing have the same size, so table rows do not
  jump.
- SelectionBar: replaces the toolbar in place while items are selected (the same height; the content below does
  not move): the count, "Clear selection", "Select all N" and the actions. The count is announced politely; `Esc`
  clears; focus goes back to where the selection was made.
- Built-in texts `dataTable.*`, `inlineEdit.*`, `selectionBar.*`; component tokens `data-table-*`,
  `inline-edit-*`, `selection-bar-*`; icons `columns`, `pin-start`, `pin-end`.
- SettingRow names its control: the form controls of the library placed in `control` (Switch, Checkbox without
  text, Segmented, Input and its variants, InputNumber, Select, TreeSelect, Cascader, AutoComplete, DatePicker,
  TimePicker, Slider, ColorPicker) take the title as their accessible name and the description as their
  accessible description; their own `aria-label` or `aria-labelledby` wins, and buttons keep their text.
- Skeleton: the same 200 ms delayed appearance as Loading and PageSkeleton, and `immediate`.
- InputNumber `block`; with a `suffix`, the field grows by the width of the suffix instead of clipping the value.
- Input, Input.Password, Input.Search and Input.TextArea: `showCount` (with `maxLength`, "12 / 100"), read by screen
  readers as the description of the field ("12 of 100 characters"). Built-in texts `input.count`,
  `input.countNoMax`.
- SegmentedBar `loading`, like Statistic: a skeleton of the same size that appears after 200 ms.
- Tabs `activeKey` (controlled), with `onChange(key)`.
- Page and PageHeader: `back` (`PageBack`: `label`, `href`, `onClick`), an icon button before the title, and
  `titleRef`, the `<h1>` (focusable from code with `tabIndex={-1}`) to focus after a client-side navigation.
- Grid.Item with `span` (1–6 or `full`) for cells that span columns; types `GridComponent`, `GridItemProps`.
- Section `level` (2, 3 or 4) and Heading `level={4}`: Section titles use the levels and sizes of Heading.
- ListItem `href` (the row is a link) and `current` (`aria-current`); `onClick` receives the click event.
- Button `rel`; with `target="_blank"` and no `rel`, links get `rel="noopener noreferrer"`.
- Slider `aria-describedby`.

### Changed

- The components implemented with antd (forms and inputs, overlays, data display, navigation, App, Image) declare
  their own props; see [Breaking changes](#breaking-changes).
- The input components are split into separate modules (form, input, select, choice and date), so importing one
  no longer pulls in the others through static members read at module level. ThemeProvider with one component
  (minified, gzip, React external; ThemeProvider alone is 67.5 KiB): Checkbox 154.4 → 85.4 KiB, Switch
  154.7 → 74.4 KiB, Input 187.0 → 122.6 KiB, Select 152.7 → 113.3 KiB, DatePicker 194.5 → 134.4 KiB.
- Charts load ECharts with `import()` the first time a chart renders, only the modules of the chart types in use.
  An application with ThemeProvider and LineChart: the entry chunk goes from about 470 KiB to 239 KiB (gzip), with
  ECharts (about 168 KiB) in chunks loaded on demand.
- The "Chart / Table" view is a native `<table>` styled with tokens (hairline row separators, tertiary header
  text, tabular numbers, a sticky header), labelled by the chart title, instead of antd's Table. ThemeProvider with
  ChartContainer: 298.0 → 231.7 KiB (gzip).
- Markdown loads its renderer on first render. ThemeProvider with Markdown: entry chunk 217.6 → 173.1 KiB (gzip),
  with the renderer in a separate 46 KiB chunk.
- LineChart fits its value axis to the data with rounded ticks; 0 is included when the data crosses it, or with
  `includeZero`. AreaChart always starts at 0.
- Progress is implemented by the library instead of antd's Progress, with the meter colors above; its track is no
  longer a neutral gray. With a `tone`, it does not turn into success at 100%. ThemeProvider with Progress:
  166.0 → 138.4 KiB (gzip).
- Modal always unmounts its content after closing (this was the `destroyOnHidden` option).
- Select and TreeSelect with `showSearch` filter the options by their text (`label`, `title`) instead of their
  value.
- Dependencies: antd 6.7.0 (was 6.6.8) and lucide-react 1.69.0 (was 1.65.0). lucide-react renamed `circle-alert`
  to `circle-exclamation-point` (the same glyph), so the class name of CopyButton's failure icon changes. With
  antd 6.7, the "Previous" and "Next" controls of Pagination are buttons, and keyboard focus lands on them.
- The standalone lockfile is re-resolved: it no longer contains packages left over from the repository it was
  copied from.
- Section titles are Heading level 2 by default (xl; they were md semibold, smaller than Heading level 3). Use
  `level={4}` for the previous size, such as in drawers and panels.

### Removed

- Table and `TableProps`: use DataTable. The internal implementation, its styles and the antd theme settings for
  Table and Progress are gone too.
- Numeric (deprecated): use `<Text numeric>`.
- `toAntdTheme` is no longer exported.
- Form.List, Form.ErrorList, Form.useWatch, and the types `FormListProps` and `FormErrorListProps`.
- Upload's `beforeUpload`, `Upload.LIST_IGNORE` and ref (`UploadRef`): use `accept`, `maxSize`, `maxCount` and
  `onReject`.
- The static members `TreeSelect.SHOW_ALL`, `SHOW_PARENT`, `SHOW_CHILD` and `Cascader.SHOW_PARENT`, `SHOW_CHILD`
  (use `showChecked`), with the types `TreeSelectComponent` and `CascaderComponent`.
- The types `DateValue`, `TimeValue` and `ColorValue` (values are strings), `UploadChangeParam` (now
  `UploadChangeInfo`), `TreeSelectNode` (now `TreeSelectOption`), `CascaderOptionType` (now `CascaderOption`),
  `AutoCompleteRef`, `RadioButtonProps` (Radio.Button uses `RadioProps`), `SliderSingleProps` and
  `SliderRangeProps` (use `SliderProps`).
- Progress `type="dashboard"`, `format`, `steps`, `strokeLinecap`, `percentPosition` and `status="normal"`.
- `ComponentDoc.antd` and the `antd` field of `components.json`: every prop of a component is listed in `props`.

### Fixed

- Switch: `onClick` receives the click event (rc-switch passed the checked state first).
- SegmentedOption, the type of Segmented's options, is exported.
- Toolbar no longer declares `role="toolbar"`, which promises arrow-key navigation that it does not have (its
  controls are reached with `Tab`, and it usually contains a search field); it is a labeled group when it has an
  `aria-label`. The bar of SelectionBar is therefore a group named "Bulk actions". MessageActions, a real toolbar
  with arrow keys, is unchanged.
- DataTable keeps the focused row mounted while virtual scrolling, so the focus is not lost when the row scrolls
  out of the rendered range.
- Charts apply "reduce motion" as soon as the preference changes (the system setting or ThemeProvider
  `reducedMotion`), instead of after a remount or a theme change.
- `node scripts/build.ts` works without pnpm: it runs the package's own `tsc` (`tsc.cmd` on Windows) instead of
  looking it up on `PATH`.
- Compound components (Form, Input, Checkbox, Radio, DatePicker, TimePicker, Descriptions, Upload) are marked
  `/* @__PURE__ */`, so importing one export of a module no longer bundles all the others.
- Generated documentation shows union types written over several lines without a leading `|`.
- Generated Chinese documentation no longer shows a space where a TSDoc line breaks between two Chinese
  characters.
- Generated documentation names the most specific native element interface of a component (it used whichever
  inherited prop TypeScript listed first).
- Skeleton showed nothing when `loading` was omitted, despite its documented default `true`.
- Segmented options with only an icon had no accessible name: `title` is now read by screen readers.
- Slider put `aria-label` and `aria-labelledby` on its outer element; they are now on the handle.

## [0.1.0] - never released

The first version. It was never published: it was used from source and as a tarball built with `pnpm pack` (layout
under [Package](#package)). Everything listed here is part of 1.0.0, with the changes listed above.

### Package

- Build output in `dist/` (`pnpm build`): ES modules, one file per source module so that unused components are
  tree-shaken (Vite library mode); TypeScript declarations (`tsc`); `styles.css` with the compiled CSS Modules and
  the base styles; `global.css` and `fonts.css`.
- `react` and `react-dom` (19+) are peer dependencies. Ant Design, dayjs, `lucide-react`,
  `@tanstack/react-virtual` and the font packages are dependencies and stay external, so an application keeps a
  single copy of each.
- Entry points: `vellum-ui`, `vellum-ui/styles.css` (required), `vellum-ui/global.css`, `vellum-ui/fonts.css`,
  `vellum-ui/docs/components.json`, `vellum-ui/examples/*`.
- The JavaScript does not import CSS; `sideEffects` lists the CSS files only.
- Published files: `dist/`, `docs/components.json`, `examples/`, `README.md`, `LICENSE`, `CHANGELOG.md`. Inside a
  workspace the package resolves to its sources; `publishConfig` points `exports`, `main` and `types` to `dist/`
  when packing or publishing.

### Theme and tokens

- Design tokens in three layers (primitive → semantic → component), emitted as `--vl-*` CSS custom properties.
- ThemeProvider with light / dark / system color modes, comfortable / compact density and an in-app "reduce
  motion" switch, all switchable at runtime; `useTheme()` to read and change them.
- One built-in theme (`defaultTheme`, accent "clear blue"); `extendTheme` for brand colors, per-mode colors and
  token overrides; colors defined in OKLCH with derived state colors and WCAG AA contrast checks.
- Neutral viewer background tokens (`viewer-*`) with chroma-free defaults, overridable by themes.
- Tools: `compileTheme`, `resolveTheme`, `toCssText`, `cssVar`, `toAntdTheme`, OKLCH helpers (`oklch`,
  `formatOklch`, `toHex`, `contrastRatio`, `deriveStates`).

### Components

- Primitives: Box, Center, Divider, Grid, Inline, Spacer, Stack, Text.
- Basics: Avatar, Button, Checkbox, CountBadge, DatePicker, Dropdown, Form, Heading, Icon, IconButton, Input,
  InputNumber, LinkButton, ListItem, Pill, Radio, Segmented, Select, SettingRow, StatusDot, Switch, Tabs, Tooltip,
  TreeSelect.
- Data: CodeBlock, Descriptions, Pagination, Table, Timeline, Tree, VirtualList.
- Feedback: Alert, App, Drawer, EmptyState, ErrorState, Loading, Modal, PageSkeleton, Popconfirm, Skeleton,
  `useConfirmDanger`, `useMessage` (with undoable messages), `useDelayedPending`.
- Page patterns: Page, PageHeader, Panel, Section, SplitView, Toolbar.
- Media: ImageGrid (virtualized media grid), Lightbox (image viewer).
- Ant Design is an internal implementation detail: no antd component or type is re-exported, and components do not
  accept `style` / `className`.

### Interaction

- Unified state layer for hover and press, keyboard-only focus rings, `disabledReason` on buttons, loading
  indicators and skeletons that appear after 200 ms and stay at least 400 ms, motion durations from tokens.
- Keyboard and focus: Modal, Drawer, Lightbox and `useConfirmDanger` move focus into the dialog, keep `Tab` inside
  it and return focus on close (also on the first opening of each instance); the danger confirmation focuses
  "Cancel". Dropdown menus opened by click move focus into the menu (arrow keys work) and return it to the trigger;
  Popconfirm focuses "Cancel" and returns focus to the trigger.
- Tooltip appears after 500 ms, switches immediately when moving to a neighbouring tooltip, and appears
  immediately on keyboard focus.
- Filled inputs (Input, InputNumber, Select, TreeSelect, DatePicker) show the accent border and focus halo; focus
  rings of Tabs and Pagination appear without a transition; buttons with an icon keep their width while loading.
- Form validates a field on blur, then on every change once it has shown an error, and focuses the first invalid
  field on submit.

### Testing

- Browser tests for every interactive component (Vitest browser mode with Playwright, headless Chromium from
  `CHROMIUM_PATH`), next to the Node tests; see [Tests](README.md#tests).

### Languages

- Built-in texts in English (`enUS`, default) and Simplified Chinese (`zhCN`); `locale` on ThemeProvider accepts
  `'en-US'`, `'zh-CN'` or a custom text table, and switches the locale of the wrapped Ant Design components and of
  dayjs as well; `messages` overrides individual texts.
- LocaleProvider switches the built-in texts and the Ant Design locale for part of a page (for example a
  documentation preview) without changing the theme or the global locale of dayjs.

### Styles

- Required styles in `vellum-ui/styles.css` (component styles and base styles), imported once by the application;
  they only target the library's own elements.
- Entrance keyframes `vl-rise`, used by Page and available to applications as `global(vl-rise)` in CSS Modules.
- Optional page-level stylesheet `vellum-ui/global.css` (body, headings, selection, scrollbars, page transitions,
  color scheme) and optional fonts `vellum-ui/fonts.css` (Inter, JetBrains Mono, SIL OFL 1.1).

### Documentation

- Component documentation generated from TSDoc and examples, in English (`docs/en-US/`) and Simplified Chinese
  (`docs/zh-CN/`): an overview and one page per component, each linking to the same page in the other language;
  `docs/README.md` chooses the language.
- Bilingual TSDoc: English is the main text, Chinese goes in `@zh` (`@usageZh`, `@deprecatedZh`); `@category` and
  `@section` use English identifiers. The convention and a glossary are in `CONTRIBUTING.md`, and the documentation
  tests require both languages.
- Machine-readable docs data `vellum-ui/docs/components.json` with every text field as `{ en, zh }`, typed by the
  exported `ComponentDocsJson`; examples `vellum-ui/examples/*` with English data.
- Storybook with mode, density and language switches (English by default); the language also switches the title
  and description shown above each example.
- `README.md` in English and `README.zh-CN.md` in Simplified Chinese.
