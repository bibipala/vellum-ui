# Changelog

All notable changes to this project are documented in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to
[Semantic Versioning](https://semver.org/). From 1.0.0 on, versions follow it strictly: breaking changes to the
public API (everything exported from the package entries, recorded in `etc/vellum-ui.api.md`,
`etc/vellum-ui-charts.api.md` and `etc/vellum-ui-ai.api.md`) come only in a new
major version, and a deprecated API is kept for at least one minor version before it is removed.

## [Unreleased]

### Breaking changes

Every change, with examples, is in "Upgrading to 2.0" in [MIGRATION.md](MIGRATION.md).

- The charts and the AI components have their own entry points and are no longer exported from `vellum-ui`:
  `vellum-ui/charts` (LineChart, AreaChart, BarChart, PieChart, DonutChart, ScatterChart, Heatmap, ChartContainer and
  their types, such as `ChartSeries`) and `vellum-ui/ai` (MessageList, Message, MessageActions, PromptInput,
  PromptSuggestions, Reasoning, ToolCalls, Sources, Citation, StreamingText, Markdown, useStream, `readSSE`,
  `readTextStream`, `StreamResponseError` and their types). Move these imports, for example
  `import { LineChart } from 'vellum-ui/charts'`; TypeScript reports each one. Statistic, Sparkline, SegmentedBar and
  the types `ValueFormat` and `ChartColorSlot` stay in `vellum-ui`. The entries share one copy of the core, so charts
  and AI components follow the `ThemeProvider` from `vellum-ui` as before.
- `echarts` and `@ant-design/x-markdown` are optional peer dependencies instead of dependencies: install `echarts` to
  use `vellum-ui/charts` and `@ant-design/x-markdown` to use `vellum-ui/ai`. An application that uses only
  `vellum-ui` no longer installs ECharts, the Markdown parser and the 20 packages they depend on (in a clean install,
  75 packages and 125 MiB instead of 97 and 201 MiB).
- FilePreview shows Markdown files as text (wrapped, with a copy button) unless it is given `renderMarkdown`, since
  Markdown is now in `vellum-ui/ai`: pass `renderMarkdown={(text) => <Markdown content={text} />}` to keep the
  formatted preview. PromptInput still renders the Markdown files among its attachments.
- Select, TreeSelect and Cascader accept only strings and numbers as values (the new type `SelectValue`): the type
  parameter of the components, of their props and of `SelectOption`, `SelectOptionGroup`, `TreeSelectOption` and
  `CascaderOption` is constrained to it. Object values were lost by Ant Design's selection engine (the field showed
  nothing and `onChange` received `null`); TypeScript now rejects them. Use IDs as values. A multiple selection with
  a literal array, such as `defaultValue={['design']}`, still infers the type of the values.
- InlineEdit declares the type of its value by mode instead of inferring it from the current value: `type="number"`
  passes numbers and `type="number"` with `decimal` passes decimal strings, as InputNumber does; a text passes
  strings (`""` when cleared) and `type="select"` the value of the chosen option. `value`, `min`, `max`, `onSave`,
  `validate` and `render` are typed by mode, `options` is required with `type="select"`, `maxLength` applies only to
  texts and `precision`, `min` and `max` only to numbers. A number field that was cleared (`null`) now saves the
  next value as a number again; it saved a string. The type parameter is the value of the options.
- MessageList with `streaming` requires `getAnnouncement(item)`, which returns the text announced to screen readers
  when the reply is finished. The announcement no longer reads the last row from the page, so it is made also while
  the person reads earlier messages and the last row is not rendered (it was lost), and a reply identical to the
  previous one is announced again (it was not). Message no longer adds the undocumented `data-vl-announce` attribute.
- ChartContainer: `table` is replaced with `getTable`, a function that returns the `ChartTableData`. It is called only
  while the table view is shown, and again when the function changes.
- Test ids: Slider, Select, TreeSelect, Cascader, AutoComplete, DatePicker (and its RangePicker), TimePicker (and
  its RangePicker), VirtualList, Upload and Upload.Dropzone take `testId` instead of `data-testid`, like the other
  components that accept no native attributes; `testId` is rendered as `data-testid`. It is on the same element as
  before, except for Slider, whose slider never rendered `data-testid`, and the range pickers, which rendered it on
  both inputs: there it is on an element that adds no box around the slider or the two inputs.
- Descriptions: `Descriptions.Item` is removed, together with the types `DescriptionsComponent` and
  `DescriptionsItemProps`; give the fields in `items`, which is now required (`DescriptionsItem` has `label` and
  `children`). Descriptions read the props of its direct children, so an Item rendered by another component was
  dropped. Descriptions is now a native description list (`dl`) instead of Ant Design's table: with more than one
  column, the columns have equal widths instead of widths that depend on their content.
- CSS variables that no component used are removed: the hover, press and disabled colors of the accent and status
  colors (`--vl-color-{accent,danger,warning,success,info}-{hover,active,disabled}`), `--vl-color-accent-fill-hover`,
  `-active`, `-disabled` and `-subtle`, and the component tokens `--vl-button-height-md`, `--vl-table-header-bg` and
  `--vl-lightbox-control-size`. The components show hover and press with the shared state layer
  (`data-vl-state`), which your own elements can use too; `deriveStates()` still computes the colors.
- Component tokens that only one component used, with a fixed value or one derived from other tokens, are removed;
  the components keep the same values in their own styles: `--vl-table-row-hover-bg`, `--vl-nav-item-gap`,
  `--vl-nav-icon-size`, `--vl-state-icon-size`, `--vl-code-height-{sm,md,lg}`, `--vl-popconfirm-text-width`,
  `--vl-drawer-inset`, `--vl-drawer-offscreen`, `--vl-image-tile-radius`, `--vl-message-max-width`,
  `--vl-splitter-grip-length`, `--vl-command-palette-width`, `--vl-command-palette-list-height`,
  `--vl-sparkline-dot-size`, `--vl-sparkline-point-size`, `--vl-segmented-bar-height-{dense,thin,tall}`,
  `--vl-segmented-bar-hit-size`, `--vl-segmented-bar-radius`, `--vl-chart-table-max-height`,
  `--vl-progress-line-{sm,md,lg}`, `--vl-progress-circle-{sm,md,lg}`, `--vl-markdown-quote-bar-width`,
  `--vl-tool-calls-icon-size`, `--vl-source-icon-size`, `--vl-citation-card-width`, `--vl-chat-bubble-max-width`,
  `--vl-prompt-attachment-max-width`, `--vl-inline-edit-height`, `--vl-inline-edit-padding-x`,
  `--vl-selection-bar-bleed-y`, `--vl-data-table-inset`, `--vl-data-table-settings-width` and
  `--vl-app-shell-rail-width`. The tokens that change with the density, that several components share or that
  layouts line up with stay. MIGRATION.md lists what to use instead of each.
- The `vl-rise` keyframes are removed from `styles.css`. Page and the pills of MessageList enter with a transition
  from `@starting-style` instead; give your own elements the same transition (see the custom styles guide). The
  page transition keyframes of `global.css` (`vl-fade-in`, `vl-fade-out`) stay.

- App no longer renders Ant Design's `App`: its root has no `ant-app` class, and Ant Design's own `App.useApp()`
  called inside it returns empty `message`, `notification` and `modal` services. Use useMessage and
  useConfirmDanger, or wrap the part that needs them in Ant Design's `App`.

### Added

- Exit duration tokens, derived from the motion durations of the theme and zero with "reduce motion":
  `--vl-motion-duration-exit-fast` (120 ms, popups, tooltips, tab content), `--vl-motion-duration-exit` (140 ms,
  messages and floating bars) and `--vl-motion-duration-exit-slow` (200 ms, drawers and other large panels). The
  components that already left with these durations now use them.
- Focus tokens `--vl-focus-ring-width` and `--vl-focus-ring-offset` (2 px each) and `--vl-focus-halo-width`
  (3 px): the keyboard focus ring and the halo of focused inputs of all components, including those based on
  Ant Design, use them.
- `--vl-radius-xs` (4 px), the radius of small squares such as checkboxes, and `--vl-shadow-raised-pressed`, the
  shadow of a pressed solid button.
- `--vl-color-mask`, the translucent dark mask behind dialogs and drawers (32 % opacity in light mode, 60 % in
  dark mode): the color the Ant Design-based Modal and Drawer already used, now available to your own overlays.
- `SelectValue`, the type of the values of Select, TreeSelect, Cascader and of the options of InlineEdit: a string or
  a number.
- InlineEdit `decimal` (with `type="number"`): the value is passed as a decimal string, as with InputNumber.
- Icon components are accepted wherever an icon name is: `icon` of Button, IconButton, LinkButton, Pill, Avatar,
  EmptyState, Segmented options, and Nav, Dropdown, ContextMenu, CommandPalette and PromptSuggestions items, such
  as `icon={Plus}` with `import { Plus } from 'lucide-react'`, and Icon `icon` (`<Icon icon={Plus} />`). They are
  drawn with the same size, stroke width and `tone` as names, and any Lucide icon works, not only the registered
  names. The new type `IconComponent` (with `IconComponentProps`) describes them without Lucide's types, so a
  component of another icon set, or an SVG of your own, works too. Names keep working. See "Icons: names or
  components" in the building pages guide.

- Stylesheets per entry: `vellum-ui/core.css` (the components of `vellum-ui` and the base styles), and
  `vellum-ui/charts.css` and `vellum-ui/ai.css` (only the styles of those entries). Import `core.css` followed by
  those of the entries you use to leave out the others (`core.css` is 177 KB, `styles.css` 223 KB, uncompressed).
  `styles.css` still contains all styles: it is the three files in this order.
- FilePreview `renderMarkdown`, which renders the text of Markdown files, such as with Markdown from `vellum-ui/ai`.
- `entry` in `components.json` (`ComponentDoc` and `ComponentTypeDoc`): the entry point to import a component or a
  type from. Each component page shows its import from that entry, and `llms.txt` lists the three entries.

### Changed

- The components draw their own fixed icons (sort arrows, close buttons, chevrons, status icons, …) from the Lucide
  icons they use instead of looking them up by name. Components that show only such icons no longer bundle all 126
  registered icons: Drawer, Modal, PageHeader, Steps, Tree, Progress, Statistic, Input.Search, InlineEdit,
  MessageList, Reasoning and Sources (Progress alone, for example, is 15 KiB minified instead of 69 KiB). Components
  that accept icon names (Icon, Button, IconButton, …), and those that use them, still include the registered icons.
  Icon `name` is optional, since `icon` can be given instead; with neither, Icon renders an empty space of the same
  size. The rendered icons are the same.

- App no longer creates Ant Design's message and notification services, which vellum-ui never used: its messages
  (useMessage) are its own, and useConfirmDanger now gets its dialogs from one holder created by the outermost App
  and shared by nested Apps (a confirmation opened inside a nested App stays open, and still resolves, when that
  App unmounts). Ant Design's message and notification code is no longer in your bundle. The root element is still
  a `div` that gives the application the theme's body text (font, size, line height and text color, also without
  `global.css`) and the scope of Ant Design's CSS variables, so links styled by Ant Design's global rules look the
  same.
  Calling the function returned by useConfirmDanger outside App rejects with an error that says so.
- Reasoning, ToolCalls and PromptInput are implemented by vellum-ui instead of being built on Ant Design X (Think,
  ThoughtChain and Sender), and look the same. `@ant-design/x` is no longer a dependency, so Mermaid,
  react-syntax-highlighter and about 130 packages they depend on are no longer installed with vellum-ui;
  `@ant-design/x-markdown`, the parser behind Markdown, remains. Expanding and collapsing Reasoning or the details
  of a ToolCalls step now turns back from where it is when toggled again halfway, as Sources does. The panel that
  `aria-controls` points to is always in the page (ToolCalls rendered it only once a step was first expanded); its
  content is still rendered when it is first expanded, and stays, hidden from screen readers and `Tab`, when it is
  collapsed again. ToolCalls is an ordered list of steps, and only the title button toggles a step (the empty space
  after the title did too). Clicking the
  padding around the text field of PromptInput focuses the field. Their DOM no longer contains Ant Design X's
  elements and class names (`ant-think`, `ant-thought-chain`, `ant-sender`).
- Divider, Timeline, Descriptions and the built-in empty state of Select and the other pickers are rendered with
  their own native elements instead of Ant Design's, and look the same (except the column widths of Descriptions,
  see above). Divider is an `hr`, or, with text, a separator whose accessible name is its text; Timeline is an
  ordered list; Descriptions is a description list of names and values instead of a layout table.
- Page and the "Back to latest" pill of MessageList enter with an interruptible transition instead of a one-shot
  animation. After its entrance, Page no longer keeps an identity transform, which made it the containing block of
  everything inside it: elements with `position: fixed` in a Page are placed against the window again, and the
  stacking of `z-index` inside it is no longer confined to the page content. The "Back to latest" pill, and the
  pill shown while earlier messages load, now fade out when they are hidden (they disappeared at once) and turn
  back from where they are when shown again halfway; while fading out they no longer take clicks or the focus.
- The charts (LineChart, AreaChart, BarChart, ScatterChart, PieChart, Heatmap) no longer format the data of their
  table view on every update: the table is built when the table view is shown. A table view with more than 100 rows
  renders only the rows in view, with the header and the row count (`aria-rowcount`) of the whole table.
- Messages enter and leave with transitions instead of one-shot animations. Showing a message again with the same
  `key` while it is leaving brings it back from where it is, and closing a message while it is still sliding in
  fades it out from where it is, without jumping. A message is removed when its exit has actually ended, so a
  theme or CSS that slows down the motion durations no longer cuts it short; with "reduce motion" a closed message
  is removed at once instead of staying invisible in place for 140 ms. A leaving message no longer takes clicks.
- AppShell, narrow layout: the mask behind the sidebar drawer now fades out when the drawer closes (it
  disappeared at once), and turns back from where it is when the drawer is toggled quickly (it restarted its fade
  from transparent). The drawer closes faster than it opens (200 ms instead of 280 ms).
- AppShell, wide layout: collapsing or expanding the sidebar no longer resizes the main area on every frame, which
  relaid out the page and ran the resize work of every DataTable, ImageGrid, Splitter and Nav in it each frame (3 to
  6 frames in 280 ms in WebKitGTK, the engine of Tauri on Linux). The columns now change at once and the main area
  slides along the spring from where it was, with the newly shown labels of the sidebar uncovered along its edge;
  toggling again halfway turns back from where it is, and "reduce motion" changes the columns at once. Content
  aligned to the end of the main area, such as actions on the right, is in its new place from the start and slides
  with the rest.
- ThemeProvider puts the CSS that Ant Design generates at runtime into the cascade layer `antd`. CSS outside any
  layer, including your application's, now takes precedence over Ant Design's
  styles regardless of selector specificity or load order; for example, Ant Design's styles for all links on the
  page no longer override the hover color or underline of your own links. Global resets and tag selectors outside
  a layer (such as `* { margin: 0 }` or `button {}`) now also apply inside Ant Design-based components; put them in
  a layer declared before `antd`. The default keyboard focus ring of vellum-ui and `global.css` is in the layer
  `vellum-defaults`, before `antd`; name it when you declare your own layer order. The components look the same.
  See "Upgrading to 2.0" in MIGRATION.md and the custom styles guide. `@ant-design/cssinjs`, already installed
  with antd, is now a direct dependency.
- New component tokens for the size of Switch: `--vl-switch-track-width`, `--vl-switch-track-width-sm`,
  `--vl-switch-handle-size`, `--vl-switch-handle-size-sm` and `--vl-switch-track-padding`. They have the sizes
  Switch already had, and Switch no longer depends on Ant Design's internal CSS variables to place its handle.
- Ant Design-based components read more of their colors from the theme's CSS variables instead of a copy made
  when the theme is compiled: the state, selection, focus halo, text and surface colors of Button, the inputs and
  pickers, Select, Cascader, Menu, Tabs, Tree, Pagination, Slider, Segmented, Tag, Breadcrumb, Descriptions, Modal
  and Message. A theme applied to part of the page with `toCssText(vars, selector)`, and local overrides of these
  variables, now reach them as well. Colors from which Ant Design derives others, such as the accent and status
  colors, still come from the theme of ThemeProvider. The components look the same.
- VirtualList and MessageList no longer recompute the positions of all items on every render while scrolling,
  also when `getKey` is an inline function. They recompute them when `items` changes.
- ImageGrid no longer checks every item for a caption on each render while scrolling.
- ToolCalls formats the input and output of a step only when its details are expanded, and not again while they
  stay the same, so large tool results no longer slow down unrelated chat updates.
- FilePreview remembers the dimensions of at most 200 recently shown images, used to place them at once when they
  are shown again. It no longer remembers them for `blob:` URLs, which are revoked when the file is no longer
  shown.
- Switching the viewer background (`useTheme().setViewerStage`) no longer rerenders mounted DataTables, charts or
  Ant Design-based components; they rerender only when the theme, color mode or density they use changes.
  `useTheme()` returns the same values as before, and `setColorMode` and `setDensity` now keep the same identity
  while ThemeProvider is mounted.
- DataTable no longer checks every row against the selection on each render while scrolling a selectable table.
  When the parent passes a new inline `rowKey` on every render (for example with controlled `selectedKeys`),
  selecting a row no longer recomputes the keys of all rows.

### Deprecated

- `InlineEditValue`: each mode of InlineEdit declares its own value type; use `SelectValue` for the options of
  `type="select"`.

### Fixed

- FilePreview and Image previews open an SVG at its own size in Safari and other recent WebKit versions after it was
  shown as a thumbnail; they opened at the thumbnail's size. The size is now read from the SVG's `width` and
  `height` when the file can be read (data URLs, local files and same-origin URLs).
- Expanded Reasoning text stays within the component: it ran 24 px past its right edge, so long reasoning wrapped
  later than the column it was in.
- Timeline colors each event's dot by its `tone` (success, warning, danger, info, neutral). In 1.x every dot was
  drawn in the accent color, whatever its tone.
- Loading, PageSkeleton and Skeleton follow "reduce motion": the spinner stops, with its four dots opaque so that
  the stopped indicator is clearly visible, and the skeletons no longer shimmer. The loading icons of Button,
  Switch and Select (`loading`) stop as well. The transitions of the Ant Design-based components, such as hover
  colors, also follow the motion duration tokens, so "reduce motion" turns them off.
- Charts sharing a failed lazy load now all recover when one chart is retried successfully.
- SegmentedBar measures its labels again after loading finishes, including when the items stay the same, and
  keeps fitting them as the bar resizes.
- FilePreview clears old media errors and image dimensions when a file's source changes with the same ID, so
  replacement images, video and audio load normally.
- Cancelling a swipe in FilePreview returns it to its original position without switching files. Starting a
  pinch during a swipe or drag to close restores the track and background before zooming.
- Heatmaps, scatter plots and bars with value labels no longer throw an error when finding the range or label
  space for large datasets.
- Checkbox, Radio and Radio.Button refs now point to their native input elements, as declared, so native
  properties and methods work.
- Select, TreeSelect and Cascader keep `value={null}` controlled in single and multiple selection. Rejected
  changes no longer appear in the field, and the placeholder remains visible.
- Messages reopened with the same key inside `onClose` are no longer removed by the previous close operation.
- Dialog focus loops skip controls hidden with `visibility` and disabled controls with `tabindex`, including
  controls in disabled fieldsets. Popup entry focus uses the same checks.
- Form preserves React 19 callback-ref cleanup functions when field refs change or fields unmount.
- Nav places its selected indicator correctly when items are reordered or regrouped without changing the
  navigation's size. Selection changes still animate.
- The name-confirmation input of `useConfirmDanger` has an accessible name from its localized instruction;
  clicking the instruction focuses the input.
- Tooltips on Dropdown and Popover triggers stay hidden while their popup is open, so they no longer cover
  menu items or other actions, including the documentation site's Appearance menu.
- The type declarations no longer import `base.css`, which is not in the package (its rules are part of
  `styles.css`). Projects that enable `noUncheckedSideEffectImports` failed to type-check against them.
- MessageList and ImageGrid keep the focused element, such as a message action, a citation link or a tile,
  rendered when it scrolls out of view, so keyboard focus no longer falls back to the page. ImageGrid also keeps
  the focus on the same tile when the number of columns changes.
- FilePreview's title-bar strip now drags the window in Tauri apps. The strip above the toolbar (as tall as
  `--vl-titlebar-height`, which a Tauri app sets itself) is now an element with `data-tauri-drag-region` as well as
  `app-region: drag`; Tauri ignores `app-region`. Lightbox has the same strip.

## [1.7.0] - 2026-11-14

### Added

- FilePreview: previews files in a full-window viewer. Images, video, audio and text (code, JSON, Markdown, logs)
  are shown directly; other files get a card with their name and size, and `render` shows them in your own way (such
  as PDF with a PDF library). Text is read up to its first 256 KB and JSON is formatted. `onDownload` and `actions`
  add buttons to the toolbar. Images open out of their thumbnail and fly back into it when closing (the element that
  was pressed, or one with the same `data-vl-preview-id`, which the tiles of ImageGrid now have), zoom with the
  wheel, a pinch, `+` / `-` or a double click, and are dragged when zoomed; files are switched with `←` / `→` or by
  swiping, and dragging up or down closes the viewer.
- `FilePreview.Inline`: the same preview as an area of the page, such as the pane next to a file list, with a
  "Full screen" button.
- PromptInput: clicking an attached file opens it in FilePreview (read on the device, never uploaded).
- Icons: `file`, `file-archive`, `file-audio`, `file-code`, `file-video`, `maximize`, `zoom-in` and `zoom-out`.
- Texts `filePreview.*` for the new viewer.

### Changed

- Lightbox is now FilePreview with images only: it gains zooming, gestures and opening from the thumbnail, its
  background choice is a row of swatches, and its buttons are icon buttons. The props are unchanged.
- Image: the preview is FilePreview with this one image instead of the preview of Ant Design: it grows out of the
  image and flies back, zooms with the wheel, a pinch, `+` / `-` or a double click, and closes by dragging. The props
  (including `preview.src`, `preview.open` and `preview.onOpenChange`) are unchanged.

### Fixed

- WebKitGTK: an SVG that is already shown as a thumbnail no longer opens at the size of the thumbnail in the
  preview (WebKit reports the displayed size as its natural size there; the preview now measures it separately).

## [1.6.0] - 2026-11-14

### Added

- Fluid motion across the library: things appear from where they were triggered, move and settle along a spring,
  and can be interrupted at any time, turning back from where they are. A new guide, [Motion](docs/en-US/guides/motion.md),
  explains the principles and how to keep the same feel in your own styles.
- Spring tokens: `motion-ease-spring` / `motion-duration-spring` for things that appear, move or change size, and
  `motion-ease-spring-bounce` / `motion-duration-spring-bounce` for small indicators, which overshoot slightly. A
  theme describes them with physical parameters, `motionSpring` and `motionSpringBounce` in `SemanticScale`
  (`{ response, damping }`, optional, `defaultSpring` and `defaultSpringBounce` by default); `compileTheme` turns
  them into a CSS `linear()` easing and the time the spring takes to settle. `springEasing` does the same for
  animations in scripts. Browsers without `linear()` fall back to similar Bézier curves.

### Changed

- Popups (Dropdown, Select, DatePicker, Cascader, TreeSelect, AutoComplete, Tooltip, Popover, Popconfirm) and Modal
  use transitions instead of one-shot keyframe animations: closing one halfway through opening sends it back from
  where it is. They grow out of the side of the trigger (the scale origin follows the placement; Modal grows out of
  the point that was clicked) along the spring, and no longer take clicks while they leave.
- Switch knobs, check marks and radio dots land along the bouncy spring (the check mark no longer waits for the box
  to change color); the Segmented thumb, the Tabs underline, Drawer, the sidebar of AppShell, Progress, messages
  and expanding panels (collapse panels, trees, Reasoning, ToolCalls) move along the spring.
- Nav: the selected background slides to the new current item instead of jumping; it follows at once when the
  layout changes.
- Tabs: switching tabs fades the new content in with a slight rise while the previous content fades out.
- Sources: the list expands and collapses with its height along the spring and can turn back halfway; the collapsed
  list is hidden with `visibility: hidden` instead of the `hidden` attribute.
- Lightbox: closing fades it out before it unmounts (opening it again meanwhile turns it back), switching images
  slides the new one in from the side you move toward, and the image enters once it has loaded.

### Fixed

- Switch no longer pauses halfway when toggled with a mouse. On press, antd stretched the knob towards the other end
  (an `inset` transition on the main thread); after release the knob stopped for a few frames while the click was
  handled, then went on. The knob no longer stretches on press and slides once after release.

## [1.5.0] - 2026-11-13

### Added

- Page recipes come in three levels (`@level` in the recipe's TSDoc), grouped so in the overview, `llms.txt` and the
  navigation of the documentation site: basic, advanced, and scenarios, whole products from different fields with a
  look of their own. Thirteen new recipes: sign-in, getting started and notifications (basic); an application
  frame and a media library (advanced); a workspace home, a kanban board, a storefront product page, an operations
  console, a week calendar, a documentation article and a mobile wallet (scenarios). The page of a recipe that
  imports a CSS Module shows that CSS after the code.
- `Center` takes `width`: `form` (400 px, the new `page-width-form` token) or `narrow` (720 px) turns its content
  into a centered column of that width, for a sign-in form or a welcome page on its own.

### Changed

- Gray colors are written with the hue `none` (`oklch(100% 0 none)` instead of `oklch(100% 0 0)`), so a
  `color-mix(in oklch, …)` of a gray token with a color takes the hue of that color instead of drifting towards red.
- The selection ring of ImageGrid is drawn inside the tile, so it is no longer cut off on tiles at the edges of the
  grid; the first row has room for the hover lift. With `selectedIds`, unselected tiles have `aria-pressed="false"`,
  so screen readers announce every tile as a toggle.

### Documentation site

- Pages are set like an article: the group of the page above a large title, a lede, the body in a reading measure
  (one step larger for guides), "On this page" beside it with the section in view marked while scrolling, and links
  to the previous and next pages at the end.
- The top bar has a button that switches between light and dark mode in one click (the appearance menu still offers
  "System" and the density), a brand mark and a search field.

### Fixed

- Switch no longer drops frames when toggled. Its handle slides with `transform`, which the compositor runs even
  while the page re-renders; Ant Design moved it with `inset-inline-start` and animated the padding and margin of the
  empty inner track, a layout on every frame that stalled whenever the toggle also updated the page. The handle stops
  where it did before.
- Lightbox scales a picture taller or wider than the window down to fit; it ran off the bottom of the window.
- On the documentation site, the shortcuts of a recipe (such as Mod+K) stay inside the recipe, as in the examples.
- The conventions guide said that Drawer keeps its content after closing and has no `footer`; it unmounts its
  content and has a `footer`.

## [1.4.1] - 2026-11-12

### Changed

- Tree and TreeSelect use a line chevron as the expand icon (it was a filled triangle), and Tree has no background
  of its own: it takes the surface it is placed on instead of drawing an unpadded plate.
- CodeBlock, and code blocks in Markdown, have no border: they are a well in the translucent field fill
  (`color-fill-field`), visible on the canvas, on cards and in dark mode.
- Disabled inputs, selects and pickers have a clearly lighter fill than enabled ones, and a fainter placeholder and
  suffix icon, so an empty disabled field can be told from an enabled one.
- The title of a Modal is 16 px above its content (was 8 px), as in Drawer.
- The trigger of an open dropdown menu or popover keeps its hover state while the popup is open.

### Fixed

- The checkboxes of a checkable Tree or TreeSelect are 4 px rounded squares like Checkbox; they were drawn as
  circles and looked like radio buttons.
- The task-list checkboxes of Markdown show checked and unchecked clearly (an accent box with a check mark, or an
  empty box); browsers drew them as almost identical gray boxes.
- The labels at the two ends of a Slider with marks line up with the ends of the track instead of overhanging it.
- An Image with `fit="contain"` fills the space around the picture with the placeholder fill, so its box and rounded
  corners stay visible.

## [1.4.0] - 2026-11-12

### Added

- Tokens `titlebar-height`, `titlebar-inset-left` and `titlebar-inset-right` for the area of the window that the
  system window controls cover when a desktop client (Electron, Tauri) or an installed web app draws its own title
  bar. By default they come from the standard `env(titlebar-area-*)` variables of Window Controls Overlay, which are
  0 in an ordinary browser; a desktop shell that does not provide them sets the three tokens on the root element.
  Drawer and Lightbox then open below the title bar instead of under the window controls (the drawer's close button
  and the viewer's toolbar were covered by them), the header of a full-window AppShell leaves room for the window
  controls on both sides, and its sidebar in the narrow layout starts below the title bar. The title bar strip of
  Lightbox can still drag the window.

### Fixed

- Overlays and popups (Drawer, Modal, dropdowns, select and picker popups, Popover, Tooltip, messages, Lightbox and the
  narrow AppShell sidebar) are `app-region: no-drag`: in a desktop client whose header is a draggable title bar, a
  click on them where they cover the header no longer drags the window instead.
- Switch, Segmented, button-style Radio.Group, the ColorPicker trigger, Pill, CountBadge and LinkButton keep their
  own width inside a Stack or a grid cell instead of being stretched to the full row.
- Selects, TreeSelect, Cascader, AutoComplete, DatePicker, TimePicker and InputNumber use the same horizontal padding
  as Input (14 / 12 / 16 px), so the text of stacked fields starts at the same position; the clear icon of a select
  appears exactly where its arrow is.
- The options of the Cascader popup are 4 px from its edge like other popups (they were 8 px).
- A `fill` EmptyState, ErrorState or Loading no longer overflows its container by its own padding, which pushed its
  content down and clipped it in a scrolling pane.
- In a collapsed Nav, an accent count is a dot at the corner of the icon and a neutral count is hidden (the number is
  in the tooltip and the accessible name); the count badge covered the icon and the item above it.
- The text of a danger button with a light red fill (the default variant with `tone="danger"`, and the text and
  dashed variants) uses `color-danger-text`, which meets 4.5:1; in dark mode it was 3.9:1.

## [1.3.0] - 2026-11-10

### Changed

- Inputs, selects and pickers are borderless by default again (`variant="filled"`), drawn as a well in the
  surface: a light neutral fill with a faint inner shadow (`shadow-field`), a deeper fill on hover, and on focus
  the surface color with an accent border and a softer halo. In the error and warning states the typed text keeps
  the text color. `variant="outlined"` still gives the bordered appearance of 1.1 and 1.2. The ColorPicker trigger
  follows the same appearance, and PromptInput is a borderless surface card with a floating shadow.
- Controls are larger: 36 / 30 / 44 px for `md` / `sm` / `lg` (was 32 / 28 / 40), and 30 / 26 / 36 px in the
  compact density (was 28 / 24 / 32). Buttons have more horizontal padding (18 px at `md`, was 16) and a wider gap
  between icon and text; inputs have 14 px. The control radii are `radius-sm` 8 px and `radius-md` 10 px (were 6
  and 8).
- Solid buttons (primary, and primary with `tone="danger"`) keep a flat fill with a hairline inner rim of light and
  a faint diffuse shadow (`shadow-raised`); pressing removes the shadow.
- Scrollbars are always visible in Chromium and WebKit, with a clearly visible thumb (`color-scrollbar`), in
  `global.css` and in DataTable itself (without `global.css` too): a table whose columns do not fit shows its
  horizontal scrollbar. They no longer use `scrollbar-color` there, which made these browsers fall back to overlay
  scrollbars that hide until scrolling.
- Disabled inputs have a lighter background than enabled ones.

### Added

- Tokens `color-fill-field`, `color-fill-field-hover`, `color-scrollbar`, `color-scrollbar-hover`, `shadow-field`
  and `shadow-raised`.

### Fixed

- The title of a sortable, end-aligned DataTable column sat 2 px above the other column titles.

## [1.2.0] - 2026-11-10

### Changed

- Drawer unmounts its content after it has closed (when the closing animation ends), like Modal, so a form in it
  starts afresh each time the drawer opens. Keep a Drawer or Modal rendered and switch `open`: one that is rendered
  only while it is open (`{show && <Drawer open />}`) disappears at once, without its closing animation, and
  cannot be interrupted. The documentation of `open` now says so.
- DataTable without a footer leaves the table inset (8px) below the last row, so the last row no longer touches
  the bottom edge of a card (Panel `flush`), and the last row has no divider below it.

### Fixed

- Move focus into the drawer panel when a Drawer opens again; it stayed on the drawer's outer element, so screen
  readers did not announce the dialog.
- Keep keyboard focus inside associated popups opened from Modal and Drawer, including nested popups.
- Cancel retried Upload requests when the component unmounts.
- Cancel uploads displaced by `maxCount` and avoid starting requests for files removed from a batch or rejected by a controlled list.
- Keep focus on Lightbox navigation buttons after changing images, and hide background controls when `stage` is fixed.
- Retry ImageGrid image loading when the source URL changes after a failure.
- Handle DataTable column keys that match Object prototype properties when computing and adjusting widths.
- Allow keyboard navigation to enter a sparse Heatmap when its first and last rows contain no data.
- Keep DataTable's Shift-selection anchor on the same row when sorting changes its position.
- Ignore Dayjs bracketed literals when deciding whether a TimePicker value includes seconds.
- Update the bilingual input variant guide and clarify how TimePicker's display format controls seconds in values.
- Clarify that the required stylesheet's Ant Design selectors can affect directly used Ant Design controls on the same page.

## [1.1.0] - 2026-11-10

### Added

- Drawer: `footer` for actions such as Cancel and Save. The footer stays visible while the content scrolls.
- Input, Input.TextArea, InputNumber, Select, TreeSelect, Cascader, AutoComplete, DatePicker and TimePicker accept
  `variant="outlined"`.
- Token `shadow-thumb` (`--vl-shadow-thumb`): the tight shadow of the selected item in a track, used by Segmented and
  button-style Radio.Group (none in dark mode).

### Changed

- Light mode is brighter: the canvas (`color-bg-canvas`) is near white, `neutral-25` (#f9fafb), instead of the
  blue-gray `neutral-50` (#f3f4f6). Text, dividers, outlines and shadows are neutral instead of slightly blue-gray.
  Cards still have no border: `shadow-near` adds a wider, very soft shadow under the tight one, so Panel, SplitView
  panels, ChartContainer and PromptInput stay distinct from the lighter canvas. Code blocks and dark mode keep their
  colors.
- Fields are outlined by default: a surface background with a thin, low-contrast border that darkens on hover and
  turns accent with a halo on focus (error and warning fields get a halo in their status color). Pass
  `variant="filled"` for the previous neutral background without a border. PromptInput uses the same outlined look.
- Drawer is a floating panel with rounded corners, a gap from the window edges and the same shadow as Modal. Its
  motion can be interrupted: closing it halfway through opening, or reopening it while it closes, reverses the slide
  from where the panel is instead of jumping to one end. While it closes, the mask no longer blocks the page. With
  reduced motion it opens and closes without animation.
- Modal fades in and rises slightly instead of zooming from 20%; dropdowns, select lists, date panels and cascaders
  fade in and move 4px from the trigger instead of stretching vertically; Tooltip, Popover and Popconfirm scale from
  0.96 instead of 0.8. Modal and Drawer use the library's close icon, and the mask is lighter.
- Button: more horizontal padding (16px, 12px for `sm`, 20px for `lg`). Secondary buttons and soft IconButtons use a
  translucent neutral fill that stays visible on cards and dark overlays. A danger secondary button is a light red
  fill with red text instead of a red outline. Disabled controls have no border. Clicking a button no longer shows
  antd's wave.
- Form and Descriptions: labels have no colon. Form labels are medium weight, and in the inline layout the gap
  between items is wider than the gap between a label and its control.
- Select: the list of options grows to fit its options (at least as wide as the field), so options of a narrow field
  are not cut off. With more than 100 options it stays as wide as the field to keep the list virtualized. Set
  `popupMatchSelectWidth` to choose. Options in popups have rounded corners concentric with the popup, and the
  selected value of a single select without search no longer fades while the list is open.
- Radio.Group with `variant="button"` looks like Segmented. Checkbox corners are 4px. Popconfirm text wraps at
  320px. ColorPicker's trigger matches outlined fields.

## [1.0.2] - 2026-11-09

### Fixed

- Include the image fixture used by the Image, ImageGrid and Lightbox examples in the npm package, so
  applications can bundle all published examples. Release validation now checks example helper files.

## [1.0.1] - 2026-11-09

### Fixed

- Use explicit local tarball paths in the release workflow so npm reads the built package instead of treating
  the path as a GitHub repository. This release includes all changes listed under 1.0.0, whose publication failed.

## [1.0.0] - Not published

The initial stable version. The public props of every component are now the library's own: no type from antd,
`@ant-design/*`, `rc-*` or dayjs is part of the API, sizes are `sm` / `md` / `lg`, semantic colors are `tone`,
value controls pass values, text inputs pass change events, and dates and times are ISO strings. Applications also load less code: charts
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
- Also renamed or changed before the release: Button and Segmented options take an icon name in `icon` (was an
  element), like the other components; Form's `layout` defaults to `vertical`; Tree takes `options` (was
  `treeData`); `DEFAULT_THEME_ID` (was `DEFAULT_THEME`); Pill takes `testId` (was `data-testid`); Radio's `value`
  has the type of the group's value; Text `weight="bold"`, the `font-weight-bold` token and `fontWeightScale.bold`
  are removed (they were the same as `semibold`); the primitive palettes are frozen.
- Documentation data: `ComponentDoc.antd` and the `antd` field of `components.json` are removed.

### Added

- AppShell and Nav, the application frame and its navigation. AppShell has a `header`, a `sidebar` and the
  main area (`header`, `main` landmarks), fills the window and scrolls the page and the sidebar on their own, and
  starts with a "Skip to content" link. AppShell.Toggle collapses the sidebar to icons (`collapsed`,
  `defaultCollapsed`, `onCollapsedChange`), or hides it with `rail={false}`; below 960 px of width the sidebar becomes a drawer with its own focus
  handling. The main area is named `vl-main`, so the page transition of `global.css` needs no CSS of your own.
  Nav has items with an icon name, a count and an optional `href` (real links), groups with headings,
  `aria-current="page"` on the current item, `↑` / `↓` / `Home` / `End` between items and tooltips when collapsed.
  New component tokens: `app-shell-rail-width`, `nav-item-gap`, `nav-icon-size`. The documentation site uses
  both for its own frame.
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
  accessible description; their own `aria-label` or `aria-labelledby` wins, buttons keep their text, and a control
  in a Form.Item with its own `label` and `name` keeps that label.
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
  their own props; see [Breaking changes](#breaking-changes-1).
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

- Documentation links resolve to the correct language-specific headings, with anchor validation in the checks.
- Removed the duplicate Pages workflow that uploaded source files instead of the built documentation site.
- The form dialog recipe resets its external form instance before closing after cancellation or a successful
  submission, so the next invitation does not contain the previous values. Modal and conventions documentation
  now distinguish unmounted content from state held outside it.
- `llms.txt` explicitly describes text inputs' change events and `Input.Search.onSearch` value callbacks.
- A message with a negative or non-numeric `duration` stayed open; it now uses the default duration (`0` still
  keeps it open).
- Text in a code font (CodeBlock, `Text mono`, Kbd, inline code in Markdown) no longer shows ligatures, so `=>`
  and `!=` read as typed.
- Markdown tables no longer break words in narrow columns, and inline code has less horizontal padding.
- A Form.Item with help or error text left about 2 px above the next label; there is now a step of space.
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
