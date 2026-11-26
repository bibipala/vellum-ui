# Upgrading to 2.0

**English** | [简体中文](#升级到-20)

2.0 moves the charts and the AI components to their own entry points, makes their dependencies optional, and changes
the props of a few components; each change is explained below. TypeScript reports them as type errors, except the
dependencies to install (see [Install ECharts and the Markdown parser yourself](#install-echarts-and-the-markdown-parser-yourself)),
Markdown files in FilePreview (see [FilePreview renders Markdown files with `renderMarkdown`](#filepreview-renders-markdown-files-with-rendermarkdown)),
the test ids (see [Test ids are `testId`](#test-ids-are-testid)) and Ant Design's `App.useApp()` inside App
(see [App no longer provides Ant Design's App services](#app-no-longer-provides-ant-designs-app-services)): upgrade,
run the type checker and fix the errors with the sections below. Three changes concern CSS, which no type checker sees: Ant Design's styles moved
into cascade layers, and some CSS variables and the `vl-rise` keyframes were removed; search your stylesheets for
them. The appearance of the components is unchanged, except the column widths of Descriptions with more than one
column. For the complete release notes, see the [changelog](CHANGELOG.md).

## Charts and AI components have their own entry points

The charts and the AI components are no longer exported from `vellum-ui`; import them from `vellum-ui/charts` and
`vellum-ui/ai`. Each component page shows the import.

| Entry | What moved there |
| --- | --- |
| `vellum-ui/charts` | LineChart, AreaChart, BarChart, PieChart, DonutChart, ScatterChart, Heatmap and ChartContainer, their props types, and `ChartCommonProps`, `ChartLegendItem`, `ChartTableColumn`, `ChartTableData`, `ChartSeries`, `ChartXValue`, `HeatmapCell`, `PieChartDatum`, `ScatterPoint`, `ScatterSeries` |
| `vellum-ui/ai` | MessageList, Message, MessageActions, PromptInput, PromptSuggestions, Reasoning, ToolCalls, Sources, Citation, StreamingText, Markdown, useStream, `readSSE`, `readTextStream` and `StreamResponseError`, their props types, and `MessageListHandle`, `MessageAuthor`, `MessageStatus`, `MessageFeedback`, `PromptInputHandle`, `PromptInputSubmit`, `PromptInputRejectReason`, `PromptSuggestion`, `ToolCallItem`, `ToolCallStatus`, `SourceItem`, `UseStreamOptions`, `StreamState`, `StreamStatus`, `ReadStreamOptions`, `ServerSentEvent`, `StreamSource` |

Everything else stays in `vellum-ui`: Statistic, Sparkline and SegmentedBar (they draw without ECharts) with the
types `ValueFormat` and `ChartColorSlot` they share with the charts, CodeBlock, CopyButton, FilePreview and the chart
color tokens. The three entries share one copy of the core, so charts and AI components follow the `ThemeProvider`
from `vellum-ui` as before. TypeScript reports each import to move ("Module 'vellum-ui' has no exported member
'LineChart'"). Move the names to the new entries:

```tsx
// Before (1.x)
import { Button, LineChart, Markdown, type ChartSeries, type ValueFormat } from 'vellum-ui'

// After (2.0)
import { Button, type ValueFormat } from 'vellum-ui'
import { Markdown } from 'vellum-ui/ai'
import { LineChart, type ChartSeries } from 'vellum-ui/charts'
```

To find the files to change before running the type checker:

```sh
# Files that import from vellum-ui and use a chart, then an AI export (review each match)
grep -rlE "from 'vellum-ui'" src | xargs grep -lwE "(LineChart|AreaChart|BarChart|PieChart|DonutChart|ScatterChart|Heatmap|ChartContainer|ChartCommonProps|ChartLegendItem|ChartTableColumn|ChartTableData|ChartSeries|ChartXValue|HeatmapCell|PieChartDatum|ScatterPoint|ScatterSeries)(Props)?"
grep -rlE "from 'vellum-ui'" src | xargs grep -lwE "(MessageList|Message|MessageActions|MessageFeedback|MessageAuthor|MessageStatus|PromptInput|PromptSuggestions?|Reasoning|ToolCalls|ToolCallItem|ToolCallStatus|Sources|Citation|SourceItem|StreamingText|Markdown|useStream|StreamState|StreamStatus|UseStreamOptions|readSSE|readTextStream|StreamResponseError|ServerSentEvent|StreamSource|ReadStreamOptions)(Props|Handle)?"
```

CSS needs no change: `vellum-ui/styles.css` still contains the styles of all components. To leave out the styles
of the entries you do not use, you can import `vellum-ui/core.css` instead, then `vellum-ui/charts.css` and
`vellum-ui/ai.css` for the entries you use (`styles.css` is these three in this order; import one or the other); see
[The library's stylesheets](docs/en-US/guides/custom-styles.md#the-librarys-stylesheets).

## Install ECharts and the Markdown parser yourself

`echarts` and `@ant-design/x-markdown` are optional peer dependencies instead of dependencies, so an application
that uses only `vellum-ui` no longer installs them (a clean install of such an application: 75 packages and 125 MiB
instead of 97 and 201 MiB). Install the ones for the entries you use:

```sh
pnpm add echarts # for vellum-ui/charts
pnpm add @ant-design/x-markdown # for vellum-ui/ai
```

The bundler resolves them for the whole entry, so `vellum-ui/ai` needs `@ant-design/x-markdown` also when you do not
render a Markdown. TypeScript does not report a missing one; the bundler does (with Vite, for example:
`"CustomChart" is not exported by "__vite-optional-peer-dep:echarts/charts:vellum-ui"`).

## FilePreview renders Markdown files with `renderMarkdown`

FilePreview is in `vellum-ui`, and Markdown, which needs `@ant-design/x-markdown`, is now in `vellum-ui/ai`, so
FilePreview no longer renders Markdown files by itself: without the new `renderMarkdown`, a `.md` file is shown as
text, wrapped, with a copy button, like a `.txt` file. TypeScript does not report this. To keep the formatted preview,
pass Markdown to FilePreview or FilePreview.Inline:

```tsx
// After (2.0)
import { FilePreview } from 'vellum-ui'
import { Markdown } from 'vellum-ui/ai'

<FilePreview {...props} renderMarkdown={(text) => <Markdown content={text} />} />
```

PromptInput passes it to the preview of its attachments itself.

## Ant Design's styles are in cascade layers

ThemeProvider now puts the CSS that Ant Design generates at runtime into the cascade layer `antd`. CSS outside
any layer, including vellum-ui's and usually yours, takes precedence over CSS in a layer, whatever the specificity
of its selectors or the order in which it loads. The default keyboard focus ring of vellum-ui (and of
`global.css`) is in the layer `vellum-defaults`, before `antd`.

- **Your rules win over Ant Design's.** A rule that lost before because its selector was less specific than Ant
  Design's now applies. For example, Ant Design's styles for every link on the page (the color of `a:hover` and
  `a:active`, no underline on hover and focus) no longer override the color and underline that your own rules
  give a link. Overrides that you made more specific only to beat Ant Design keep working and can be simplified.
- **Global resets now reach into the components.** Rules outside a layer that target every element or a tag, such
  as `* { margin: 0; padding: 0 }`, `button { background: none }` or `a { color: inherit }`, now also override the
  Ant Design-based components. Search your global stylesheets for them, and put them in a layer declared before
  Ant Design's: `@layer reset, vellum-defaults, antd;` and then `@layer reset { … }`.
- **If you use cascade layers yourself**, such as those of Tailwind CSS v4, declare the order once at the start
  of your first stylesheet, for example `@layer theme, base, vellum-defaults, antd, components, utilities;`
  (keep `vellum-defaults` before `antd`). Without it,
  Ant Design's layer is created when it first injects styles, usually after your stylesheets, and wins over all
  of your layers, as Ant Design's styles did before.

See [Precedence over Ant Design](docs/en-US/guides/custom-styles.md#precedence-over-ant-design-cascade-layers)
in the custom styles guide.

## Select, TreeSelect and Cascader values are strings or numbers

The value of an option of Select, TreeSelect and Cascader is now a string or a number: the new type `SelectValue`.
Ant Design's selection engine reads an object value as a record of a label and a value, so an object value was lost:
the field showed nothing and `onChange` received `null`. TypeScript now rejects object values. Keep records in your
own lookup and use their IDs as values:

```tsx
// 1.x: accepted by TypeScript, but the field stays empty
<Select<Project>
  value={project}
  options={projects.map((p) => ({ value: p, label: p.name }))}
  onChange={setProject}
/>

// 2.0: the value is the ID
<Select
  value={project?.id ?? null}
  options={projects.map((p) => ({ value: p.id, label: p.name }))}
  onChange={(id) => setProject(projects.find((p) => p.id === id) ?? null)}
/>
```

A component of your own that is generic over the value, such as `function Field<V>(props: SelectProps<V>)`, needs the
same constraint: `function Field<V extends SelectValue>(props: SelectProps<V>)`.

## InlineEdit declares how a number is passed

InlineEdit with `type="number"` chose how to save a number from the current value: a number was saved as a number
and a decimal string as a string, so after the field had been cleared (`null`) the next value was saved as a
string. The representation is now declared, as with InputNumber: `type="number"` passes numbers, and `type="number"`
with `decimal` passes decimal strings. `value`, `min`, `max`, `onSave`, `validate` and `render` take the type of the
mode, so TypeScript reports a decimal string passed without `decimal`:

```tsx
// 1.x: a decimal string, and a number
<InlineEdit type="number" label="Price" value={price} min="0" onSave={setPrice} />
<InlineEdit<number> type="number" label="Count" value={count} onSave={setCount} />

// 2.0
<InlineEdit type="number" decimal label="Price" value={price} min="0" onSave={setPrice} />
<InlineEdit type="number" label="Count" value={count} onSave={setCount} />
```

The other modes are declared as well. A text passes a string to `onSave` and `validate` (`""` when cleared, never
`null`), and a choice (`type="select"`) passes the value of the chosen option. `options` is required with
`type="select"`; `maxLength` is accepted only for a text, and `precision`, `min` and `max` only with `type="number"`.
The type parameter of InlineEdit and InlineEditOption is now only the value of the options, a `SelectValue`.
`InlineEditValue` is deprecated: use `SelectValue` for the options.

## MessageList announces finished replies with `getAnnouncement`

With `streaming`, MessageList announced a finished reply by reading the text of the last row in the page. While the
person was reading earlier messages, that row was not rendered (the list is virtualized) and nothing was announced,
and a reply identical to the previous one was not announced either. The text now comes from your data:
`getAnnouncement` receives the last item and returns the text to announce. It is required with `streaming`:

```tsx
// 1.x
<MessageList items={messages} getKey={(m) => m.id} renderItem={renderMessage} streaming={generating} />

// 2.0
<MessageList
  items={messages}
  getKey={(m) => m.id}
  renderItem={renderMessage}
  streaming={generating}
  getAnnouncement={(m) => (m.status === 'error' ? 'The reply failed.' : m.text)}
/>
```

For a reply in Markdown, return its text without the markup when you have it, since screen readers may read the
markup characters. Return `undefined` to announce nothing. Message no longer marks its content with the
undocumented `data-vl-announce` attribute.

## ChartContainer builds the table view on demand: `getTable`

The `table` prop of ChartContainer is replaced with `getTable`, a function that returns the same `ChartTableData`.
It is called only while the table view is shown, and again when the function changes, so the table is no longer
built on every update of the chart; a long table renders only the rows in view. Pass a function that keeps its
identity while the data stays the same: declared outside the component, or with `useCallback`.

```tsx
// 1.x
<ChartContainer title="Storage" table={{ columns, rows: quotas.map(toRow) }}>
  {graphic}
</ChartContainer>

// 2.0
const getTable = useCallback(() => ({ columns, rows: quotas.map(toRow) }), [quotas])

<ChartContainer title="Storage" getTable={getTable}>
  {graphic}
</ChartContainer>
```

The charts of the library (LineChart, BarChart, ScatterChart, PieChart, Heatmap and the others) do this
themselves; nothing changes for them.

## Test ids are `testId`

Components that accept no native attributes take `testId`, rendered as `data-testid`. In 2.0 this also applies to
the components that declared a `data-testid` prop: Slider, Select, TreeSelect, Cascader, AutoComplete, DatePicker,
DatePicker.RangePicker, TimePicker, TimePicker.RangePicker, VirtualList, Upload and Upload.Dropzone. TypeScript does
not report `data-testid` (attributes with a hyphen are not checked), so search your code for it.

```tsx
// 1.x
<Select aria-label="Owner" data-testid="owner" options={owners} />

// 2.0
<Select aria-label="Owner" testId="owner" options={owners} />
```

The attribute is where it was, except for Slider and the range pickers:

| Component | `data-testid` is on |
| --- | --- |
| Select, TreeSelect, Cascader, AutoComplete | the root element of the field, as before |
| DatePicker, TimePicker | the input, as before |
| DatePicker.RangePicker, TimePicker.RangePicker | an element that adds no box around the two inputs (`display: contents`). Before, both inputs had the same test id |
| Slider | an element that adds no box around the slider. Before, the attribute was not rendered |
| VirtualList | the scrolling element, as before |
| Upload, Upload.Dropzone | the hidden file input, where tests set the files (such as Playwright's `setInputFiles`), as before |

An element with `display: contents` has no box of its own: find the inputs inside it, for example
`getByTestId('period').getByRole('textbox').first()`, rather than clicking it. `id`, `aria-label`,
`aria-labelledby` and `aria-describedby` of Slider stay; the accessible names go to the handles.

## Descriptions takes its fields in `items`

`Descriptions.Item` is removed. Descriptions read the props of its direct children, so an Item rendered by
another component, or wrapped in one, was silently dropped. Give the fields in `items`, which is now required; to
show a field only in some cases, leave it out of the array. The types `DescriptionsComponent` and
`DescriptionsItemProps` are removed as well: `DescriptionsItem` has the `label` and `children` of a field.

```tsx
// 1.x
<Descriptions column={1} size="sm">
  <Descriptions.Item label="Date">{day}</Descriptions.Item>
  {note && <Descriptions.Item label="Note">{note}</Descriptions.Item>}
</Descriptions>

// 2.0
<Descriptions
  column={1}
  size="sm"
  items={[
    { key: 'date', label: 'Date', children: day },
    ...(note ? [{ key: 'note', label: 'Note', children: note }] : []),
  ]}
/>
```

Descriptions is now a native description list (`dl`, with a `dt` and a `dd` per field) instead of Ant Design's
table, so screen readers read each name with its value. With more than one column, the columns now have equal
widths; Ant Design's table sized them by their content. Divider, Timeline and the empty state of Select and the
other pickers are also native elements now; they look the same.

## Fewer CSS variables

2.0 removes CSS variables that no component used, or that only one component used and that did not change with
the density. Search your stylesheets and inline styles for the names below.

The hover, press and disabled colors of the accent and status colors are removed: `--vl-color-accent-hover`,
`-active`, `-disabled`; the same three for `--vl-color-danger`, `--vl-color-warning`, `--vl-color-success` and
`--vl-color-info`; and `--vl-color-accent-fill-hover`, `-active`, `-disabled` and `-subtle`. The components show
hover and press with the shared state layer, not with separate colors; give your own clickable elements the same
layer with `data-vl-state` (see [Custom styles](docs/en-US/guides/custom-styles.md#clickable-custom-elements-data-vl-state)).
Show a disabled state with `opacity` or the disabled text color. If you need the colors themselves, compute them
with `deriveStates()`. The subtle backgrounds (`-subtle`) and the text colors (`-text`) of the accent and status
colors stay.

```css
/* 1.x */
.tag:hover {
  background: var(--vl-color-accent-hover);
}

/* 2.0: the shared state layer, <button className={styles.tag} data-vl-state=""> */
.tag {
  background: var(--vl-color-accent);
}
```

These component tokens are removed. Use the value they had, or a token that stays:

| Removed | Use instead |
| --- | --- |
| `--vl-button-height-md`, `--vl-inline-edit-height` | `--vl-control-height-md` |
| `--vl-app-shell-rail-width` | `calc(var(--vl-control-height-md) + 2 * var(--vl-space-3))` |
| `--vl-table-header-bg` | `transparent` |
| `--vl-table-row-hover-bg` | `--vl-color-fill-hover` |
| `--vl-drawer-inset`, `--vl-inline-edit-padding-x`, `--vl-data-table-inset` | `--vl-space-2` (8 px) |
| `--vl-selection-bar-bleed-y` | `--vl-space-1` (4 px) |
| `--vl-drawer-offscreen` | `calc(100% + var(--vl-space-2) + var(--vl-space-6))` |
| `--vl-image-tile-radius` | `--vl-radius-lg` |
| `--vl-segmented-bar-radius` | `--vl-radius-xs` (4 px) |
| `--vl-nav-item-gap` | 2 px |
| `--vl-nav-icon-size`, `--vl-tool-calls-icon-size`, `--vl-source-icon-size` | 16 px |
| `--vl-state-icon-size` | 56 px |
| `--vl-code-height-sm`, `-md`, `-lg` | 160 px, 320 px, 560 px |
| `--vl-popconfirm-text-width`, `--vl-citation-card-width`, `--vl-data-table-settings-width` | 320 px |
| `--vl-lightbox-control-size` | 40 px |
| `--vl-message-max-width` | 560 px |
| `--vl-splitter-grip-length` | 24 px |
| `--vl-command-palette-width`, `--vl-command-palette-list-height` | 640 px, 440 px |
| `--vl-sparkline-dot-size`, `--vl-sparkline-point-size` | 8 px, 4 px |
| `--vl-segmented-bar-height-dense`, `-thin`, `-tall`, `--vl-segmented-bar-hit-size` | 4 px, 8 px, 28 px, 24 px |
| `--vl-chart-table-max-height` | 480 px |
| `--vl-progress-line-sm`, `-md`, `-lg` | 4 px, 8 px, 12 px |
| `--vl-progress-circle-sm`, `-md`, `-lg` | 48 px, 80 px, 120 px |
| `--vl-markdown-quote-bar-width` | 3 px |
| `--vl-chat-bubble-max-width` | 80% |
| `--vl-prompt-attachment-max-width` | 240 px |

The component tokens that change with the density, that several components share, or that your layouts may need
to line up with stay, such as `--vl-control-height-md`, `--vl-page-width-default`, `--vl-split-aside-md`,
`--vl-grid-column-md`, `--vl-chat-max-width` and `--vl-status-dot-size`. The [token reference](docs/en-US/tokens.md)
lists them all.

## Entrance motion is a transition: `vl-rise` is removed

The `vl-rise` keyframes in `styles.css` are removed. Page and the pills of MessageList now enter with a transition
that starts from `@starting-style`, which can turn back when the element changes again halfway. Give your own
elements the same transition:

```css
/* 1.x */
.card {
  animation: global(vl-rise) var(--vl-motion-duration-slow) var(--vl-motion-ease-standard) both;
}

/* 2.0 */
.card {
  transition:
    opacity var(--vl-motion-duration-slow) var(--vl-motion-ease-standard),
    transform var(--vl-motion-duration-slow) var(--vl-motion-ease-standard);
}

@starting-style {
  .card {
    opacity: 0;
    transform: translateY(var(--vl-space-1));
  }
}
```

See [Entrance motion](docs/en-US/guides/custom-styles.md#entrance-motion) in the custom styles guide. The page
transition of `global.css` (`view-transition-name: vl-main`) is unchanged: View Transitions accept only keyframe
animations, so its keyframes `vl-fade-in` and `vl-fade-out` stay.

## App no longer provides Ant Design's App services

App used to render Ant Design's `App` inside it. It now provides the library's own services only: its root has no
`ant-app` class, and Ant Design's `App.useApp()` called inside it returns empty `message`, `notification` and
`modal` services. TypeScript does not report this; search your code for `App.useApp` and `ant-app`.

```tsx
// Before (1.x)
const { message } = AntApp.useApp()
message.success('Saved')

// After (2.0)
const message = useMessage()
message.success('Saved')
```

For confirmations, use useConfirmDanger. If a part of the application must keep Ant Design's services, wrap that part
in Ant Design's `App` yourself.

## 升级到 2.0

[English](#upgrading-to-20) | **简体中文**

2.0 把图表与 AI 组件移到了各自的入口，它们的依赖改为可选，并修改了少数组件的属性，下面逐项说明。除了要安装的依赖
（见[自己安装 ECharts 与 Markdown 解析器](#自己安装-echarts-与-markdown-解析器)）、FilePreview 中的 Markdown 文件（见
[FilePreview 用 `renderMarkdown` 渲染 Markdown 文件](#filepreview-用-rendermarkdown-渲染-markdown-文件)）、测试定位（见[测试定位改用 `testId`](#测试定位改用-testid)）和在 App 中调用
Ant Design 的 `App.useApp()`（见[App 不再提供 Ant Design App 的服务](#app-不再提供-ant-design-app-的服务)），TypeScript 都会报类型错误：升级后运行类型检查，按下面各节修改报错的地方。有三处变化与 CSS 有关，类型检查发现不了：
Ant Design 的样式放进了级联层，删除了一些 CSS 变量与关键帧 `vl-rise`，请在样式表中搜索它们。除了多列的
Descriptions 的列宽，组件的外观不变。完整发布说明见[变更记录](CHANGELOG.md)（英文）。

### 图表与 AI 组件有了自己的入口

图表与 AI 组件不再从 `vellum-ui` 导出，改从 `vellum-ui/charts` 与 `vellum-ui/ai` 导入。每个组件页都写明了导入语句。

| 入口 | 移过去的导出 |
| --- | --- |
| `vellum-ui/charts` | LineChart、AreaChart、BarChart、PieChart、DonutChart、ScatterChart、Heatmap、ChartContainer 及其属性类型，以及 `ChartCommonProps`、`ChartLegendItem`、`ChartTableColumn`、`ChartTableData`、`ChartSeries`、`ChartXValue`、`HeatmapCell`、`PieChartDatum`、`ScatterPoint`、`ScatterSeries` |
| `vellum-ui/ai` | MessageList、Message、MessageActions、PromptInput、PromptSuggestions、Reasoning、ToolCalls、Sources、Citation、StreamingText、Markdown、useStream、`readSSE`、`readTextStream`、`StreamResponseError` 及其属性类型，以及 `MessageListHandle`、`MessageAuthor`、`MessageStatus`、`MessageFeedback`、`PromptInputHandle`、`PromptInputSubmit`、`PromptInputRejectReason`、`PromptSuggestion`、`ToolCallItem`、`ToolCallStatus`、`SourceItem`、`UseStreamOptions`、`StreamState`、`StreamStatus`、`ReadStreamOptions`、`ServerSentEvent`、`StreamSource` |

其余导出都留在 `vellum-ui`：Statistic、Sparkline、SegmentedBar（不用 ECharts 绘制）及它们与图表共用的类型 `ValueFormat`、
`ChartColorSlot`，CodeBlock、CopyButton、FilePreview，以及图表配色的令牌。三个入口共用一份核心，图表与 AI 组件照旧跟随
从 `vellum-ui` 导入的 `ThemeProvider`。TypeScript 会对每个需要移动的导入报错（"Module 'vellum-ui' has no exported member
'LineChart'"）。把这些名称移到新的入口：

```tsx
// 之前（1.x）
import { Button, LineChart, Markdown, type ChartSeries, type ValueFormat } from 'vellum-ui'

// 之后（2.0）
import { Button, type ValueFormat } from 'vellum-ui'
import { Markdown } from 'vellum-ui/ai'
import { LineChart, type ChartSeries } from 'vellum-ui/charts'
```

运行类型检查之前，可以这样找出要改的文件：

```sh
# 从 vellum-ui 导入、并用到图表（第一条）或 AI 导出（第二条）的文件，逐个检查
grep -rlE "from 'vellum-ui'" src | xargs grep -lwE "(LineChart|AreaChart|BarChart|PieChart|DonutChart|ScatterChart|Heatmap|ChartContainer|ChartCommonProps|ChartLegendItem|ChartTableColumn|ChartTableData|ChartSeries|ChartXValue|HeatmapCell|PieChartDatum|ScatterPoint|ScatterSeries)(Props)?"
grep -rlE "from 'vellum-ui'" src | xargs grep -lwE "(MessageList|Message|MessageActions|MessageFeedback|MessageAuthor|MessageStatus|PromptInput|PromptSuggestions?|Reasoning|ToolCalls|ToolCallItem|ToolCallStatus|Sources|Citation|SourceItem|StreamingText|Markdown|useStream|StreamState|StreamStatus|UseStreamOptions|readSSE|readTextStream|StreamResponseError|ServerSentEvent|StreamSource|ReadStreamOptions)(Props|Handle)?"
```

CSS 不需要改：`vellum-ui/styles.css` 仍然包含全部组件的样式。不想带上没有用到的入口的样式时，可以改为导入
`vellum-ui/core.css`，再按用到的入口加上 `vellum-ui/charts.css`、`vellum-ui/ai.css`（`styles.css` 就是这三个文件依次
合并的结果，两种方式选一种），见[组件库的样式表](docs/zh-CN/guides/custom-styles.md#组件库的样式表)。

### 自己安装 ECharts 与 Markdown 解析器

`echarts` 与 `@ant-design/x-markdown` 从依赖改为可选的 peer 依赖，只用 `vellum-ui` 的应用不再安装它们（这样的应用全新
安装：75 个包、125 MiB，原来是 97 个包、201 MiB）。按用到的入口安装：

```sh
pnpm add echarts # for vellum-ui/charts
pnpm add @ant-design/x-markdown # for vellum-ui/ai
```

打包器会为整个入口解析它们，所以即使不渲染 Markdown，用 `vellum-ui/ai` 也需要安装 `@ant-design/x-markdown`。缺少时
TypeScript 不报错，打包器会报错（例如 Vite：`"CustomChart" is not exported by "__vite-optional-peer-dep:echarts/charts:vellum-ui"`）。

### FilePreview 用 `renderMarkdown` 渲染 Markdown 文件

FilePreview 在 `vellum-ui` 中，而需要 `@ant-design/x-markdown` 的 Markdown 现在在 `vellum-ui/ai` 中，所以 FilePreview 不再
自己渲染 Markdown 文件：不传新增的 `renderMarkdown` 时，`.md` 文件与 `.txt` 文件一样显示原文（自动换行，带复制按钮）。
TypeScript 不会报告这一点。要保留排版后的预览，把 Markdown 传给 FilePreview 或 FilePreview.Inline：

```tsx
// 之后（2.0）
import { FilePreview } from 'vellum-ui'
import { Markdown } from 'vellum-ui/ai'

<FilePreview {...props} renderMarkdown={(text) => <Markdown content={text} />} />
```

PromptInput 预览附件时自己会传入它。

### Ant Design 的样式在级联层里

ThemeProvider 现在把 Ant Design 在运行时生成的样式放进级联层（cascade layer）`antd`。
不在层里的样式（包括 vellum-ui 的，通常也包括你的）总是优先于层里的，与选择器的优先级、样式加载的先后无关。
vellum-ui（以及 `global.css`）默认的键盘焦点环在层 `vellum-defaults` 里，排在 `antd` 之前。

- **你的规则压过 Ant Design 的。** 以前因为选择器的优先级低于 Ant Design 而不生效的规则，现在会生效。例如 Ant Design
  给页面上所有链接的样式（`a:hover`、`a:active` 的颜色，悬停与聚焦时去掉下划线）不再覆盖你自己的规则给链接设置的
  颜色与下划线。只是为了压过 Ant Design 而提高优先级的覆盖仍然有效，可以简化。
- **全局重置会伸进组件里。** 不在层里、针对所有元素或某个标签的规则，如 `* { margin: 0; padding: 0 }`、
  `button { background: none }`、`a { color: inherit }`，现在也会覆盖基于 Ant Design 的组件。请在全局样式表中查找
  这类规则，把它们放进声明在 Ant Design 之前的层里：先写 `@layer reset, vellum-defaults, antd;`，再写
  `@layer reset { … }`。
- **自己也用级联层时**（如 Tailwind CSS v4 的层），在第一个样式表的开头声明一次顺序，例如
  `@layer theme, base, vellum-defaults, antd, components, utilities;`（`vellum-defaults` 写在 `antd` 之前）。
  不声明时，Ant Design 在第一次注入样式时才创建它的层，
  通常在你的样式表之后，所以和以前一样优先于你所有的层。

见自定义样式指南的[与 Ant Design 的优先级](docs/zh-CN/guides/custom-styles.md#与-ant-design-的优先级级联层)。

### Select、TreeSelect、Cascader 的值是字符串或数字

Select、TreeSelect、Cascader 选项的值现在只能是字符串或数字，即新的类型 `SelectValue`。Ant Design 的选择引擎把对象值
当作「文字与值」的记录读取，所以对象值会丢失：框中什么都不显示，`onChange` 收到 `null`。现在 TypeScript 会拒绝对象值。
记录请放在自己的查找表中，用它们的 ID 作为值：

```tsx
// 1.x：TypeScript 不报错，但框中一直是空的
<Select<Project>
  value={project}
  options={projects.map((p) => ({ value: p, label: p.name }))}
  onChange={setProject}
/>

// 2.0：值是 ID
<Select
  value={project?.id ?? null}
  options={projects.map((p) => ({ value: p.id, label: p.name }))}
  onChange={(id) => setProject(projects.find((p) => p.id === id) ?? null)}
/>
```

自己写的、对值泛型的组件（如 `function Field<V>(props: SelectProps<V>)`）也要加同样的约束：
`function Field<V extends SelectValue>(props: SelectProps<V>)`。

### InlineEdit 显式声明数字的传递方式

`type="number"` 的 InlineEdit 以前按当前的值决定怎样保存数字：值是 number 时保存 number，是十进制字符串时保存字符串，
所以字段被清空（`null`）之后，下一次保存的就变成了字符串。现在由用法声明，与 InputNumber 一致：`type="number"` 传
number，`type="number"` 加 `decimal` 传十进制字符串。`value`、`min`、`max`、`onSave`、`validate` 与 `render` 都按用法
取类型，没有 `decimal` 却传十进制字符串时 TypeScript 会报错：

```tsx
// 1.x：十进制字符串与 number
<InlineEdit type="number" label="Price" value={price} min="0" onSave={setPrice} />
<InlineEdit<number> type="number" label="Count" value={count} onSave={setCount} />

// 2.0
<InlineEdit type="number" decimal label="Price" value={price} min="0" onSave={setPrice} />
<InlineEdit type="number" label="Count" value={count} onSave={setCount} />
```

其他用法也一样显式声明。文字传给 `onSave` 与 `validate` 的是字符串（清空时为 `""`，不会是 `null`）；选择
（`type="select"`）传选中的选项的值。`type="select"` 时 `options` 必填；`maxLength` 只用于文字，`precision`、`min`、
`max` 只用于 `type="number"`。InlineEdit 与 InlineEditOption 的类型参数现在只是选项的值，即 `SelectValue`。
`InlineEditValue` 不再推荐使用：选项请用 `SelectValue`。

### MessageList 用 `getAnnouncement` 播报完成的回复

`streaming` 时，MessageList 以前读取页面中最后一行的文字来播报完成的回复。用户在阅读上方的消息时，这一行没有渲染
（列表是虚拟化的），什么都不会播报；与上一条完全相同的回复也不会播报。现在文字来自你的数据：`getAnnouncement`
收到最后一条消息，返回要播报的文字。有 `streaming` 时它是必填的：

```tsx
// 1.x
<MessageList items={messages} getKey={(m) => m.id} renderItem={renderMessage} streaming={generating} />

// 2.0
<MessageList
  items={messages}
  getKey={(m) => m.id}
  renderItem={renderMessage}
  streaming={generating}
  getAnnouncement={(m) => (m.status === 'error' ? 'The reply failed.' : m.text)}
/>
```

Markdown 格式的回复，有不带标记的文字时返回它，否则读屏可能读出标记符号。返回 `undefined` 时不播报。Message
不再给内容加没有文档的 `data-vl-announce` 属性。

### ChartContainer 按需生成表格视图：`getTable`

ChartContainer 的 `table` 属性换成 `getTable`：一个返回同样的 `ChartTableData` 的函数。它只在显示表格视图时调用，
函数变化时再调用，所以图表每次更新时不再生成表格；很长的表格只渲染可见的行。数据不变时函数的身份也要不变：
定义在组件之外，或者用 `useCallback`。

```tsx
// 1.x
<ChartContainer title="Storage" table={{ columns, rows: quotas.map(toRow) }}>
  {graphic}
</ChartContainer>

// 2.0
const getTable = useCallback(() => ({ columns, rows: quotas.map(toRow) }), [quotas])

<ChartContainer title="Storage" getTable={getTable}>
  {graphic}
</ChartContainer>
```

组件库自己的图表（LineChart、BarChart、ScatterChart、PieChart、Heatmap 等）已经这样做，使用它们的代码不用改。

### 测试定位改用 `testId`

不接受原生属性的组件用 `testId` 作为测试定位，输出为 `data-testid`。2.0 起，原来声明了 `data-testid` 属性的组件也改用
它：Slider、Select、TreeSelect、Cascader、AutoComplete、DatePicker、DatePicker.RangePicker、TimePicker、
TimePicker.RangePicker、VirtualList、Upload 与 Upload.Dropzone。TypeScript 不检查带连字符的属性，不会报
`data-testid` 的错，请在代码中搜索它。

```tsx
// 1.x
<Select aria-label="Owner" data-testid="owner" options={owners} />

// 2.0
<Select aria-label="Owner" testId="owner" options={owners} />
```

除了 Slider 与范围选择，属性的位置不变：

| 组件 | `data-testid` 所在的元素 |
| --- | --- |
| Select、TreeSelect、Cascader、AutoComplete | 选择器的根元素，与以前相同 |
| DatePicker、TimePicker | 输入框，与以前相同 |
| DatePicker.RangePicker、TimePicker.RangePicker | 包住两个输入框、不生成盒子的元素（`display: contents`）。以前两个输入框带同一个测试定位 |
| Slider | 包住滑块、不生成盒子的元素。以前这个属性没有渲染 |
| VirtualList | 滚动元素，与以前相同 |
| Upload、Upload.Dropzone | 隐藏的文件输入框，测试在这里设置要上传的文件（如 Playwright 的 `setInputFiles`），与以前相同 |

`display: contents` 的元素没有自己的盒子：在它里面查找输入框，如 `getByTestId('period').getByRole('textbox').first()`，
不要点击它本身。Slider 的 `id`、`aria-label`、`aria-labelledby`、`aria-describedby` 照旧，读屏名称放在手柄上。

### Descriptions 用 `items` 给出字段

删除了 `Descriptions.Item`。Descriptions 读取直接子元素的属性，由其他组件渲染、或包在其他组件里的 Item 会被悄悄丢掉。
请用 `items` 给出字段，它现在是必填的；只在某些情况下显示的字段，不满足条件时不放进数组。类型
`DescriptionsComponent` 与 `DescriptionsItemProps` 也一并删除：`DescriptionsItem` 包含字段的 `label` 与 `children`。

```tsx
// 1.x
<Descriptions column={1} size="sm">
  <Descriptions.Item label="Date">{day}</Descriptions.Item>
  {note && <Descriptions.Item label="Note">{note}</Descriptions.Item>}
</Descriptions>

// 2.0
<Descriptions
  column={1}
  size="sm"
  items={[
    { key: 'date', label: 'Date', children: day },
    ...(note ? [{ key: 'note', label: 'Note', children: note }] : []),
  ]}
/>
```

Descriptions 现在是原生的描述列表（`dl`，每个字段一组 `dt` 与 `dd`），而不是 Ant Design 的表格，读屏逐个读出名称与
对应的值。多于一列时各列等宽；Ant Design 的表格按内容分配列宽。Divider、Timeline 以及 Select 等选择器的空状态也改为
原生元素，外观不变。

### 删除了一些 CSS 变量

2.0 删除了没有组件使用的 CSS 变量，以及只有一个组件使用、又不随密度变化的 CSS 变量。请在样式表与行内样式中搜索
下面的名称。

删除了强调色与状态色的悬停、按下、禁用色：`--vl-color-accent-hover`、`-active`、`-disabled`；`--vl-color-danger`、
`--vl-color-warning`、`--vl-color-success`、`--vl-color-info` 各自的这三个；以及 `--vl-color-accent-fill-hover`、
`-active`、`-disabled`、`-subtle`。组件的悬停、按下用共用的状态层，没有单独的颜色；自己的可点击元素加
`data-vl-state` 使用同一个状态层（见[自定义样式](docs/zh-CN/guides/custom-styles.md#可点击的自定义元素data-vl-state)）。
禁用状态用 `opacity` 或禁用文字色表示。确实需要这些颜色时，用 `deriveStates()` 计算。强调色与状态色的浅底
（`-subtle`）与作为文字时的颜色（`-text`）保留。

```css
/* 1.x */
.tag:hover {
  background: var(--vl-color-accent-hover);
}

/* 2.0：共用的状态层，<button className={styles.tag} data-vl-state=""> */
.tag {
  background: var(--vl-color-accent);
}
```

删除了下面这些组件令牌。改用它们原来的取值，或保留的令牌：

| 删除的 | 改用 |
| --- | --- |
| `--vl-button-height-md`、`--vl-inline-edit-height` | `--vl-control-height-md` |
| `--vl-app-shell-rail-width` | `calc(var(--vl-control-height-md) + 2 * var(--vl-space-3))` |
| `--vl-table-header-bg` | `transparent` |
| `--vl-table-row-hover-bg` | `--vl-color-fill-hover` |
| `--vl-drawer-inset`、`--vl-inline-edit-padding-x`、`--vl-data-table-inset` | `--vl-space-2`（8px） |
| `--vl-selection-bar-bleed-y` | `--vl-space-1`（4px） |
| `--vl-drawer-offscreen` | `calc(100% + var(--vl-space-2) + var(--vl-space-6))` |
| `--vl-image-tile-radius` | `--vl-radius-lg` |
| `--vl-segmented-bar-radius` | `--vl-radius-xs`（4px） |
| `--vl-nav-item-gap` | 2px |
| `--vl-nav-icon-size`、`--vl-tool-calls-icon-size`、`--vl-source-icon-size` | 16px |
| `--vl-state-icon-size` | 56px |
| `--vl-code-height-sm`、`-md`、`-lg` | 160px、320px、560px |
| `--vl-popconfirm-text-width`、`--vl-citation-card-width`、`--vl-data-table-settings-width` | 320px |
| `--vl-lightbox-control-size` | 40px |
| `--vl-message-max-width` | 560px |
| `--vl-splitter-grip-length` | 24px |
| `--vl-command-palette-width`、`--vl-command-palette-list-height` | 640px、440px |
| `--vl-sparkline-dot-size`、`--vl-sparkline-point-size` | 8px、4px |
| `--vl-segmented-bar-height-dense`、`-thin`、`-tall`、`--vl-segmented-bar-hit-size` | 4px、8px、28px、24px |
| `--vl-chart-table-max-height` | 480px |
| `--vl-progress-line-sm`、`-md`、`-lg` | 4px、8px、12px |
| `--vl-progress-circle-sm`、`-md`、`-lg` | 48px、80px、120px |
| `--vl-markdown-quote-bar-width` | 3px |
| `--vl-chat-bubble-max-width` | 80% |
| `--vl-prompt-attachment-max-width` | 240px |

随密度变化的、几个组件共用的，以及使用方的布局可能需要对齐的组件令牌保留，如 `--vl-control-height-md`、
`--vl-page-width-default`、`--vl-split-aside-md`、`--vl-grid-column-md`、`--vl-chat-max-width`、`--vl-status-dot-size`。
完整的列表见[设计令牌](docs/zh-CN/tokens.md)。

### 进场改用过渡：删除了 `vl-rise`

删除了 `styles.css` 中的关键帧 `vl-rise`。Page 与 MessageList 的胶囊现在用从 `@starting-style` 开始的过渡进场，元素
进场途中又发生变化时可以折返。自己的元素用同样的过渡：

```css
/* 1.x */
.card {
  animation: global(vl-rise) var(--vl-motion-duration-slow) var(--vl-motion-ease-standard) both;
}

/* 2.0 */
.card {
  transition:
    opacity var(--vl-motion-duration-slow) var(--vl-motion-ease-standard),
    transform var(--vl-motion-duration-slow) var(--vl-motion-ease-standard);
}

@starting-style {
  .card {
    opacity: 0;
    transform: translateY(var(--vl-space-1));
  }
}
```

见自定义样式指南的[进场动画](docs/zh-CN/guides/custom-styles.md#进场动画)。`global.css` 的页面切换
（`view-transition-name: vl-main`）不变：View Transitions 只接受关键帧动画，它的关键帧 `vl-fade-in` 与 `vl-fade-out`
保留。

### App 不再提供 Ant Design App 的服务

App 以前在内部渲染 Ant Design 的 `App`，现在只提供本库自己的服务：根元素不再有 `ant-app` 类名，在其中调用
Ant Design 的 `App.useApp()` 得到的 `message`、`notification`、`modal` 是空的。TypeScript 不会报告这一点，请在代码中
搜索 `App.useApp` 与 `ant-app`。

```tsx
// 之前（1.x）
const { message } = AntApp.useApp()
message.success('Saved')

// 之后（2.0）
const message = useMessage()
message.success('Saved')
```

确认操作用 useConfirmDanger。某一部分确实需要 Ant Design 的服务时，自己用 Ant Design 的 `App` 包住那一部分。

---

# Migrating to 1.0

**English** | [简体中文](#简体中文)

Migrate applications using vellum-ui 0.x to the independent public API in 1.0. Component props no longer expose
Ant Design types. For the complete release notes, see the [changelog](CHANGELOG.md).

## Before you start

- In TypeScript, almost every change in this guide is a type error: each component now accepts exactly the props on
  its documentation page. Upgrade, run the type checker, and fix the errors with the tables below.
- A few changes are not visible to the type checker. They are listed under [Behavior changes](#behavior-changes);
  search your code and tests for them.
- If your application imports types from antd or dayjs only to type vellum-ui props (`Dayjs` for DatePicker,
  `MenuProps` for Dropdown and so on), remove those imports.

## The principle

In 0.x, many components passed antd's props through: their types were antd's types without `style` and
`className`. In 1.0 every component declares its own props.

- Each component accepts only the props listed on its documentation page. Any other antd prop is gone, for example
  `getPopupContainer`, `centered`, Drawer `placement`, Breadcrumb `separator`, Steps `type` or Pagination
  `pageSizeOptions`.
- No type from antd, `@ant-design/*`, `rc-*` or dayjs is part of the public API: not in props, callback arguments,
  values, refs or static members. Application code depends on vellum-ui contracts rather than underlying implementation types.
- Names follow the same rules across the library:

| Concept | 1.0 | 0.x (antd) |
| --- | --- | --- |
| Size | `size="sm"`, `"md"`, `"lg"` (type `ControlSize`) | `small` / `middle` / `large`, or `small` / `default` |
| Semantic color | `tone`, with values from `neutral`, `accent`, `info`, `success`, `warning`, `danger` | `type="error"`, `danger`, `color` |
| Appearance | `variant` | `type="primary"`, `optionType="button"` |
| Native names | keep their native meaning: Button `type="submit"` | `htmlType="submit"` |
| Validation status | `status="error"` or `"warning"` | `validateStatus` on Form.Item |
| Values | `onChange(value)`; switches and checkboxes `onChange(checked)`; text inputs keep the native change event | `onChange(event)`, `onChange(value, option)` |
| Overlays | `open` / `defaultOpen` / `onOpenChange(open)` | (unchanged) |
| Dates and times | ISO strings such as `'2026-11-07'` and `'14:30'` | dayjs objects |
| Decimals | decimal strings: InputNumber `decimal` | `stringMode` |
| No value | `null`, in `value` and in `onChange` (Select, TreeSelect, Cascader, DatePicker, TimePicker, InputNumber); text inputs use `''` | `undefined` or `null`, depending on the component |
| Test ids | `testId` on components that take no native attributes | `data-testid` |

## Common cases

### Button

```tsx
// 0.x
<Button type="primary" htmlType="submit" size="small">Save</Button>
<Button danger icon={<Icon name="trash" />}>Delete</Button>

// 1.0
<Button variant="primary" type="submit" size="sm">Save</Button>
<Button tone="danger" icon="trash">Delete</Button>
```

### Select with several values

```tsx
const labels = [
  { value: 'design', label: 'Design' },
  { value: 'research', label: 'Research' },
]

// 0.x
<Select mode="multiple" value={selected} onChange={(value: string[]) => setSelected(value)} options={labels} />

// 1.0: onChange receives the values only
<Select multiple value={selected} onChange={setSelected} options={labels} />
```

### DatePicker value

```tsx
// 0.x
import dayjs, { type Dayjs } from 'dayjs'

<DatePicker
  value={dueDate ? dayjs(dueDate) : null}
  onChange={(date: Dayjs | null) => setDueDate(date ? date.format('YYYY-MM-DD') : null)}
/>

// 1.0: the value is an ISO string such as '2026-11-07', or null
<DatePicker value={dueDate} onChange={setDueDate} />
```

### Form.Item status and custom rules

```tsx
// 0.x
<Form.Item
  label="Name"
  name="name"
  validateStatus={taken ? 'error' : undefined}
  help={taken ? 'This name is already in use' : undefined}
  rules={[
    {
      validator: (_, value) =>
        value === 'admin' ? Promise.reject(new Error('This name is reserved')) : Promise.resolve(),
    },
  ]}
>
  <Input />
</Form.Item>

// 1.0: `status`; a validator receives the value and returns the error text (or a promise of it)
<Form.Item
  label="Name"
  name="name"
  status={taken ? 'error' : undefined}
  help={taken ? 'This name is already in use' : undefined}
  rules={[{ validator: (value) => (value === 'admin' ? 'This name is reserved' : undefined) }]}
>
  <Input />
</Form.Item>
```

### Modal OK button

```tsx
// 0.x
<Modal
  open={open}
  title="Delete project"
  okText="Delete"
  okButtonProps={{ danger: true, disabled: !confirmed }}
  confirmLoading={deleting}
  destroyOnHidden
  onOk={remove}
  onCancel={close}
>
  {content}
</Modal>

// 1.0: the content is always unmounted after closing
<Modal
  open={open}
  title="Delete project"
  okText="Delete"
  okTone="danger"
  okDisabled={!confirmed}
  okLoading={deleting}
  okTestId="confirm-delete"
  onOk={remove}
  onCancel={close}
>
  {content}
</Modal>
```

## Component by component

Each table lists what changed; props that are not mentioned keep their name and meaning. "Not available" lists the
antd props that are used most often and are gone.

### Button

| 0.x | 1.0 |
| --- | --- |
| `type="primary"`, `"default"`, `"dashed"`, `"text"` | `variant="primary"`, `"default"` (default), `"dashed"`, `"text"` |
| `danger` | `tone="danger"`, with any `variant` |
| `htmlType="submit"` | `type="submit"`; the default is `button` |
| `size="small"`, `"middle"`, `"large"` | `size="sm"`, `"md"`, `"lg"` |
| `loading={{ delay: 300 }}` | `loading` (boolean) |
| `icon={<Icon name="plus" />}` | `icon="plus"`: an icon name, like IconButton and menu items; its size follows `size` |

Not available: `color`, `shape`, `ghost`, `iconPosition`. Use LinkButton for accent-colored text links and
IconButton for buttons with only an icon.

### Form and Form.Item

| 0.x | 1.0 |
| --- | --- |
| `layout` defaults to `horizontal` | `layout` defaults to `vertical` (labels above the fields); pass `layout="horizontal"` to keep labels on the left |
| Form.Item `validateStatus` | `status`: `'error'`, `'warning'`, `'success'` or `'validating'` |
| rule `validator: (rule, value) => Promise` | `validator: (value) => string \| undefined`, or a promise of it: return the error text |
| rule as a function, `({ getFieldValue }) => ({ … })` | an object rule; read other fields with `form.getFieldValue(name)` inside its `validator` |
| rule `type: 'string'`, `'array'`, …; `enum`, `transform`, `warningOnly` | `type: 'email'`, `'url'`, `'number'` or `'integer'`; the others are not available |
| `Form.useWatch(name, form)` | `onValuesChange(changed, values)` on Form, or keep the value in your own state |
| `Form.List` | not available: keep the entries in your own state; Form.Item names can be paths such as `['members', 0, 'email']` |
| `Form.ErrorList` | not available: errors appear below each Form.Item; show errors of the whole form with Alert |
| `Form.useForm(form)` | `Form.useForm()` |
| `getFieldsValue(true)`, `getFieldsValue(names)` | `getFieldsValue()` |
| `onFinishFailed({ values, errorFields, outOfDate })` | `onFinishFailed({ values, errorFields })`; each error field is `{ name, errors }` |

The form instance (`FormInstance`) has `getFieldsValue`, `getFieldValue`, `setFieldsValue`, `setFieldValue`,
`resetFields`, `validateFields`, `submit` and `scrollToField`. Submitting always scrolls to and focuses the first
invalid field.

Not available: Form `labelCol`, `wrapperCol`, `colon`, `size`, `fields`, `onFieldsChange`, `preserve`,
`validateMessages`, `scrollToFirstError`; Form.Item `dependencies` (a rule that reads another field is checked
when its own field changes, not when the other one does), `shouldUpdate`, `noStyle`, `normalize`,
`getValueFromEvent`, `tooltip`, `hasFeedback`; the instance methods `getFieldError`, `setFields`, `isFieldTouched`.

### Input, Input.Password, Input.Search, Input.TextArea

| 0.x | 1.0 |
| --- | --- |
| `size="small"`, `"middle"`, `"large"` | `size="sm"`, `"md"`, `"lg"` |
| `variant="outlined"`, `"underlined"` | `variant="filled"` (default) or `"borderless"` |
| `addonBefore`, `addonAfter` | not available: use `prefix` and `suffix` inside the field |
| `showCount`, `count` | `showCount` is a boolean; with `maxLength`, displays current and maximum lengths. Custom `count` configuration is not available. |
| `type="number"`, `type="password"` | InputNumber, Input.Password |
| Input.Search `onSearch(value, event, info)` | `onSearch(value, info)` |
| Input.Password `visibilityToggle={{ … }}`, `iconRender` | `visibilityToggle` (boolean) |
| Input.TextArea ref `resizableTextArea.textArea` | ref `textarea` (`TextAreaRef`) |
| `InputRef` (antd's) | `InputRef`: `focus({ cursor })`, `blur()`, `select()` and the native `input` |

`onChange` of text inputs still receives the native change event (`e.target.value`).

Fields also accept `variant="outlined"` (since 1.1; it was the default in 1.1 and 1.2). Since 1.3 the default is
`filled` again, drawn as a borderless well; set `variant="outlined"` to keep the bordered appearance; see the current [API conventions](docs/en-US/guides/conventions.md#variant-appearance).

### InputNumber

| 0.x | 1.0 |
| --- | --- |
| `stringMode`, `InputNumber<string>` | `decimal`: the value, `min`, `max` and `step` are decimal strings such as `"1280.50"` |
| `InputNumber<number>` | `InputNumber` (no type parameter); the value is a number |
| `size="small"`, … | `size="sm"`, … |
| `prefix`, `addonBefore`, `addonAfter`, `formatter`, `parser` | not available; `suffix` shows a unit |

The value is `null` when the field is empty, as before.

### Select

| 0.x | 1.0 |
| --- | --- |
| `mode="multiple"` | `multiple`: the value is an array |
| `mode="tags"` | not available |
| `onChange(value, option)` | `onChange(value)`; a single select with `allowClear` receives `null` when cleared |
| options with any fields | `SelectOption`: `{ value, label, disabled }`; groups `SelectOptionGroup`: `{ label, options }` |
| `filterOption`, `optionFilterProp` | not available: `showSearch` filters the options by their `label` |
| `SelectProps<V, O>` | `SelectProps<V>`; `V` is `string` by default |
| `SelectRef` with `scrollTo` | `SelectRef`: `focus()`, `blur()` |

`null` means "nothing selected" in `value` and `defaultValue`.

Not available: `labelInValue`, `onSearch`, `notFoundContent`, `optionRender`, `popupRender`, `maxTagCount`,
`suffixIcon`, `virtual`.

Select, TreeSelect, Cascader, AutoComplete, DatePicker and TimePicker accept only these attributes besides their own
props (`FieldAttributes`): `id`, `aria-label`, `aria-labelledby`, `aria-describedby`, `data-testid`, `autoFocus`,
`onFocus`, `onBlur`, `onKeyDown`.

### TreeSelect

| 0.x | 1.0 |
| --- | --- |
| `treeData` | `options`: `TreeSelectOption` `{ value, title, children, disabled, selectable }` |
| `treeDefaultExpandAll` | `defaultExpandAll` |
| `treeCheckable` | `multiple checkable` |
| `showCheckedStrategy={TreeSelect.SHOW_PARENT}` | `showChecked="parent"` (`all`, `parent` or `child`; default `child`) |
| `onChange(value, labels, extra)` | `onChange(value)` |
| `TreeSelectNode`, `TreeSelectComponent` | `TreeSelectOption` |

`showSearch` filters the nodes by their `title`. Not available: `loadData`, `treeLine`, `treeExpandedKeys`,
`fieldNames`, `labelInValue`, `treeCheckStrictly`.

### Cascader

| 0.x | 1.0 |
| --- | --- |
| `showCheckedStrategy={Cascader.SHOW_CHILD}` | `showChecked="child"` (`parent` or `child`; default `parent`) |
| `onChange(value, selectedOptions)` | `onChange(value)`: the path, `null` when cleared; with `multiple`, the paths |
| `CascaderOptionType`, `CascaderComponent` | `CascaderOption`: `{ value, label, children, disabled }` |
| `ref` | not available |

Not available: `changeOnSelect`, `expandTrigger`, `displayRender`, `loadData`, `fieldNames`, the object form of
`showSearch`.

### AutoComplete

| 0.x | 1.0 |
| --- | --- |
| `onChange(value, option)`, `onSelect(value, option)` | `onChange(value)` (an empty string when cleared), `onSelect(value)` |
| options | `AutoCompleteOption`: `{ value, label }` |
| `filterOption(input, option)` | `filterOption`: `true` (contains the text, ignoring case) or `(text, option) => boolean` |
| `ref` (`AutoCompleteRef`), a custom input as children | not available |

### Checkbox, Radio, Switch, Segmented

| 0.x | 1.0 |
| --- | --- |
| Checkbox `onChange={(e) => set(e.target.checked)}` | `onChange={set}`: receives `checked` |
| Checkbox.Group with Checkbox children | `options` (required): values or `{ value, label, disabled }` |
| Radio.Group `onChange={(e) => set(e.target.value)}` | `onChange={set}`: receives the value |
| Radio.Group `optionType="button"` | `variant="button"` |
| Radio.Group `buttonStyle` | not available |
| Radio `value` is `string \| number` | `value` has the type of the group's value (`Radio<V>`) |
| `RadioButtonProps` | `RadioProps` (for Radio and Radio.Button) |
| Switch `onChange(checked, event)` | `onChange(checked)` |
| Switch `size="small"` | `size="sm"` |
| Switch `checkedChildren`, `unCheckedChildren` | not available |
| Segmented `size="small"`, `"large"` | `size="sm"`, `"lg"` |
| Segmented option objects | `{ value, label, icon, title, disabled }`; `icon` is an icon name (`icon: 'grid'`, not an element); an option with only an icon needs `title` |

Refs point to the native elements: Checkbox and Radio to the `<input>`, Switch to the `<button role="switch">`,
Segmented to its root element.

### DatePicker and TimePicker

| 0.x | 1.0 |
| --- | --- |
| `value`, `defaultValue` as dayjs objects (`DateValue`) | ISO strings, `null` when empty: `'2026-11-07'`; `'2026-11'` with `picker="month"`; `'2026'` with `picker="year"`; `'2026-11-07T14:30:00+08:00'` (local offset) with `showTime` |
| `onChange(date, dateString)` | `onChange(value)`; `null` when cleared |
| RangePicker `onChange(dates, dateStrings)` | `onChange([start, end])`, or `null` |
| `disabledDate(current: Dayjs)` | `disabledDate(date: string)`, with the date as `YYYY-MM-DD` |
| `picker="week"`, `"quarter"` | not available |
| `showTime={{ … }}` | `showTime` (boolean) |
| TimePicker value as a dayjs object (`TimeValue`) | `'14:30:00'`, or `'14:30'` when `format` has no seconds |
| TimePicker `hourStep`, `secondStep`, `use12Hours` | not available; `minuteStep` remains |

DatePicker's `format` changes only what the field shows. For TimePicker and its RangePicker, a format without
seconds also changes the value and `onChange` output to `HH:mm`; otherwise they use `HH:mm:ss`.
Not available: `presets`, `minDate`, `maxDate`, `disabledTime`, `renderExtraFooter`, `needConfirm`, `ref`.

### Slider and ColorPicker

| 0.x | 1.0 |
| --- | --- |
| `SliderSingleProps`, `SliderRangeProps` | `SliderProps` |
| Slider `range={{ draggableTrack: true }}` | `range` (boolean) |
| Slider `marks` with `{ style, label }` | `marks`: value → text |
| Slider `tooltip`, `vertical`, `dots`, `included`, `reverse` | not available |
| ColorPicker `value` as a color object or string (`ColorValue`) | a hex string such as `'#2d6bf3'` |
| ColorPicker `onChange(color, css)` | `onChange(hex)`: lowercase hex, with alpha when the color is not opaque |
| ColorPicker `presets` | `ColorPreset[]`: `{ label, colors }` |

Not available: ColorPicker `format`, `onChangeComplete`, `allowClear`, `trigger`, `placement`, `ref`.

### Upload

| 0.x | 1.0 |
| --- | --- |
| `beforeUpload`, `return Upload.LIST_IGNORE` | `accept` and `maxSize`: files that fail them are not added to the list, and `onReject(file, reason)` is called; `maxCount` limits the list |
| `UploadChangeParam` | `UploadChangeInfo`: `{ file, fileList }` |
| `customRequest` options: `onProgress({ percent })` | `onProgress(percent)`; return `{ abort() }` so that "Remove" cancels the request |
| `UploadFile<T>` | `UploadFile`: `uid`, `name`, `size`, `type`, `status`, `percent`, `response`, `error`, `originFileObj`, `url` |
| `headers`, `data`, `withCredentials`, `method` with `action` | not available: send the file yourself with `customRequest` |
| `ref` (`UploadRef`) | not available |

Not available: `listType`, `itemRender`, `iconRender`, `directory`, `openFileDialogOnClick`.

### Modal

| 0.x | 1.0 |
| --- | --- |
| `okButtonProps={{ disabled }}` | `okDisabled` |
| `okButtonProps={{ loading }}`, `confirmLoading` | `okLoading` |
| `okButtonProps={{ danger: true }}`, `okType="danger"` | `okTone="danger"` |
| a test id on the OK button | `okTestId` |
| `destroyOnHidden` | not available: the content is always unmounted after closing |
| `onOk(event)`, `onCancel(event)` | `onOk()`, `onCancel()` |
| `footer` as a function | `footer`: a node, or `null` for no footer |

Kept: `open`, `title`, `okText`, `footer`, `closable`, `maskClosable`, `width`, `flush`, `aria-label`. Not available:
`cancelText`, `cancelButtonProps`, `centered`, `afterClose`, `afterOpenChange`, `keyboard`, `getContainer`, `zIndex`.

### Drawer

| 0.x | 1.0 |
| --- | --- |
| `size={480}` or `width={480}` | `width={480}` (a number in pixels or a CSS length) |
| `data-testid` | `testId` |
| `placement` | not available: the drawer opens from the right |
| `footer`, `extra` | not available: put the actions in the content |
| `destroyOnHidden` | not available: the content is kept after closing |

### Dropdown

| 0.x | 1.0 |
| --- | --- |
| menu item `icon: <Icon name="edit" />` | `icon: 'edit'`: an icon name |
| | menu item `shortcut: 'mod+d'` shows the key caps; it is only a hint, register the key with `useHotkeys` |
| `menu.selectable` and `menu.selectedKeys` | `menu.selectedKeys` |
| `menu.onClick({ key, keyPath, domEvent })` | `menu.onClick({ key })` |
| submenus (`children`), groups (`type: 'group'`) | not available |
| `ref` | not available |

The menu types are `DropdownMenu`, `DropdownMenuItem`, `DropdownMenuAction` and `DropdownMenuDivider`. Not available:
`disabled`, `arrow`, `popupRender`, `getPopupContainer`, `destroyOnHidden`. ContextMenu is unchanged.

```tsx
// 1.0
<Dropdown
  trigger={['click']}
  menu={{
    items: [
      { key: 'duplicate', label: 'Duplicate', icon: 'copy', shortcut: 'mod+d' },
      { type: 'divider' },
      { key: 'delete', label: 'Delete', icon: 'trash', danger: true },
    ],
    onClick: ({ key }) => run(key),
  }}
>
  <IconButton icon="more" label="More actions" />
</Dropdown>
```

### Tooltip, Popover, Popconfirm

| 0.x | 1.0 |
| --- | --- |
| Tooltip `open`, `onOpenChange` | not available: Tooltip is uncontrolled |
| Tooltip `color`, `arrow`, `mouseLeaveDelay` | not available; `title`, `placement`, `mouseEnterDelay` and `trigger` remain |
| Popover | `title`, `content`, `trigger`, `placement`, `open`, `defaultOpen`, `onOpenChange` |
| Popconfirm `okButtonProps={{ danger: true }}` | `okTone="danger"` |
| Popconfirm `cancelText`, `icon`, `showCancel`, `placement`, `open` | not available |
| `ref` on all three | not available |

### Alert

| 0.x | 1.0 |
| --- | --- |
| `type="info"`, `"success"`, `"warning"`, `"error"` | `tone="info"` (default), `"success"`, `"warning"`, `"danger"` |
| `message` | `title` (required) |
| `closable={{ onClose }}` | `closable` and `onClose` |
| `action`, `banner`, `icon` | not available |

### Descriptions, Tabs, Pagination, Divider, Skeleton

| 0.x | 1.0 |
| --- | --- |
| Descriptions `size="small"` | `size="sm"` |
| Descriptions `items` | `DescriptionsItem`: `{ key, label, children }`; `span` is not available |
| Descriptions `column={{ xs: 1, md: 2 }}` | `column={2}`, or leave it out to follow the window width |
| Descriptions `bordered`, `layout`, `title`, `extra` | not available |
| Tabs `items` | `TabsItem`: `{ key, label, children }` |
| Tabs `activeKey` | unchanged: `activeKey` (controlled) or `defaultActiveKey`, with `onChange(key)` |
| Tabs `type="card"`, `tabBarExtraContent`, item `disabled` and `icon` | not available |
| Pagination `size="small"` | `size="sm"` |
| Pagination `showTotal(total, range)` | `showTotal(total)` |
| Pagination `pageSizeOptions`, `showQuickJumper`, `simple`, `onShowSizeChange` | not available; `onChange(page, pageSize)` reports both |
| Divider `type="vertical"`, `orientation`, `titlePlacement`, `dashed` | not available; `children` and `plain` remain |
| Skeleton `avatar={{ … }}`, `round` | `avatar` (boolean); `active`, `title`, `paragraph`, `loading` and `children` remain |

### Timeline

| 0.x | 1.0 |
| --- | --- |
| item `children` | `content` |
| item `color="green"` | `tone="success"`: `neutral`, `accent` (default), `info`, `success`, `warning`, `danger` |
| item `label`, `dot`, `icon`; `mode`, `pending`, `reverse` | not available |

### Tree

| 0.x | 1.0 |
| --- | --- |
| `treeData` | `options` (like Select and TreeSelect) |
| `TreeDataNode` (antd's) | `TreeDataNode`: `{ key, title, children, disabled }` with string keys; nodes may carry other fields |
| `onSelect(keys, info)`, `onCheck(checked, info)`, `onExpand(keys, info)` | `onSelect(keys)`, `onCheck(keys)`, `onExpand(keys)` with `string[]` |
| `draggable={{ icon: false }}` or a function | `draggable` (boolean); the whole node can be dragged |
| `onDrop(info)` with `dragNode`, `node`, `dropPosition`, `dropToGap` | `onDrop({ node, target, position })`: the original nodes and `'before'`, `'inside'` or `'after'` |
| `data-testid` | `testId` |

Not available: `defaultExpandedKeys`, `showLine`, `showIcon`, `titleRender`, `loadData`, `checkStrictly`,
`multiple`, `height`, `fieldNames`.

### Steps and Breadcrumb

| 0.x | 1.0 |
| --- | --- |
| Steps `size="small"` | `size="sm"` (`sm` or `md`) |
| Steps item `subTitle`, `icon`, `status` | not available: items are `{ title, content, disabled }` |
| Steps `initial`, `type`, `iconRender`, `percent`, `progressDot` | not available |
| Breadcrumb item `menu` (antd menu props) | `menu`: a `DropdownMenu` (`items` with icon names, `onClick({ key })`) |
| Breadcrumb menu item `path` | not available: navigate in `menu.onClick` |
| Breadcrumb `separator`, `itemRender`, `params`, item `path`, the type parameter of `BreadcrumbProps` | not available |

### Progress

| 0.x | 1.0 |
| --- | --- |
| `type="line"`, `"circle"` | `variant="line"`, `"circle"` |
| `type="dashboard"` | not available |
| `size="small"`, `"default"` or a number | `size="sm"`, `"md"`, `"lg"` |
| `showInfo` | `showValue` |
| `status="exception"` | `status="error"` (read as "60%, failed") |
| `status="normal"` | leave `status` out |
| | `tone="accent"`, `"success"`, `"warning"`, `"danger"` for meters such as storage use |
| `format`, `steps`, `strokeLinecap`, `percentPosition` | not available |

### App, Image, LineChart

| 0.x | 1.0 |
| --- | --- |
| App `component`, `notification` | not available; App takes `children` and `message` |
| Image: antd's image props (`onClick`, `crossOrigin`, `srcSet`, …) | only `src`, `alt`, `placeholder`, `fallback`, `preview`, `fit`, `radius`, `width`, `height`, `loading` |
| LineChart value axis always starts at 0 | fits the data; add `includeZero` to keep 0 |

## Removed exports

| Removed | Use instead |
| --- | --- |
| Table, `TableProps` | DataTable (`DataTableProps`, `DataTableColumn`) |
| `DEFAULT_THEME` | `DEFAULT_THEME_ID` (the ID string; `defaultTheme` is the theme object) |
| Text `weight="bold"`, the token `--vl-font-weight-bold`, `fontWeightScale.bold` | `semibold` (it had the same weight, 600) |
| Numeric | `<Text numeric>` |
| `toAntdTheme` | nothing: ThemeProvider configures antd itself |
| Form.List, Form.ErrorList, Form.useWatch, `FormListProps`, `FormErrorListProps` | see [Form and Form.Item](#form-and-formitem) |
| `DateValue`, `TimeValue` | ISO strings (`string`) |
| `ColorValue` | hex strings (`string`) |
| `UploadChangeParam` | `UploadChangeInfo` |
| `UploadRef` | nothing |
| `Upload.LIST_IGNORE` | `accept`, `maxSize`, `maxCount`, `onReject` |
| `TreeSelectNode`, `TreeSelectComponent` | `TreeSelectOption` |
| `CascaderOptionType`, `CascaderComponent` | `CascaderOption` |
| `TreeSelect.SHOW_ALL`, `SHOW_PARENT`, `SHOW_CHILD`; `Cascader.SHOW_PARENT`, `SHOW_CHILD` | `showChecked="all"`, `"parent"`, `"child"` |
| `AutoCompleteRef` | nothing |
| `RadioButtonProps` | `RadioProps` |
| `SliderSingleProps`, `SliderRangeProps` | `SliderProps` |
| `ComponentDoc.antd`, the `antd` field of `components.json` | nothing: every prop of a component is in `props`; `base` and `native` remain |

New types for the library's own props: `ControlSize`, `ChoiceOption`, `FieldAttributes`, `FocusOptions`,
`SelectOption`, `SelectOptionGroup`, `TreeSelectOption`, `CascaderOption`, `AutoCompleteOption`, `ColorPreset`,
`FormRule`, `FormValues`, `FieldName`, `FormFieldError`, `FormFinishFailedInfo`, `UploadFileStatus`,
`UploadChangeInfo`, `DropdownMenu`, `DropdownMenuItem`, `DropdownMenuAction`, `DropdownMenuDivider`,
`DescriptionsItem`, `TabsItem`, `TimelineItem`, `TreeDropInfo`, `LineAreaChartProps`.

## Refs and test ids

- Components that render one main element (Button, Input and its variants, InputNumber, Checkbox, Radio, Switch,
  Segmented, Form) accept that element's native attributes, such as `id`, `aria-*`, `data-*` and event handlers.
  Their refs point to the native element or to a handle declared by the library (`InputRef`, `TextAreaRef`,
  `InputNumberRef`, `SelectRef`).
- Overlays and containers (Modal, Drawer, Dropdown, Tooltip, Popover, Popconfirm, Alert, Descriptions, Tabs,
  Pagination, Timeline, Tree, Steps, Breadcrumb, App, Image) accept no native attributes and no refs. Drawer, Tree
  and Pill take `testId`, and Modal takes `okTestId` for its OK button. For the others, find elements in tests by role and
  accessible name, or wrap the component in a Box with `testId`.

## Behavior changes

These changes are not type errors. Search your code and tests for them.

- **Modal unmounts its content after closing.** State created inside the dialog resets (in 0.x this required
  `destroyOnHidden`). State held outside it, including a page-level `Form.useForm()` instance, persists. To reset
  a new-entry form, call `form.resetFields()` while Form is mounted, before closing after cancellation or a
  successful submission. See the [form dialog recipe](docs/en-US/recipes/FormDialog.md).
- **Toolbar is no longer `role="toolbar"`.** It has no role, or `role="group"` when it has an `aria-label`, because
  its controls are reached with `Tab` and not with the arrow keys. Tests that use `getByRole('toolbar')` should give
  the toolbar an `aria-label` and use `getByRole('group', { name: … })`. The bar of SelectionBar is a group named
  "Bulk actions" (the built-in text `selectionBar.label`).
- **Progress with a `tone` keeps that tone at 100%.** Without `tone` and `status`, it still turns into `success` at
  100%. A meter such as storage use therefore stays `warning` or `danger` when it is full.
- **LineChart fits its value axis to the data.** It no longer forces 0 onto the axis, so changes are easier to see.
  Add `includeZero` where the distance from zero matters. AreaChart and BarChart still start at 0.
- **Charts and Markdown load their engines on first render.** ECharts (only the modules of the chart types in use)
  and the Markdown renderer are separate chunks, loaded with `import()` the first time a chart or a Markdown renders.
  Until then, a chart keeps its final size and shows a loading indicator after 200 ms, and Markdown shows the text
  as plain text. If loading fails, a chart shows an error state with "Retry" and Markdown keeps the plain text.
  Server rendering is unchanged. In tests, wait for the rendered content (for example with `findBy…` or
  `expect.poll`) instead of checking it right after rendering.
- **Select and TreeSelect search by text.** With `showSearch`, options are filtered by their `label` (TreeSelect
  nodes by their `title`); antd filtered by `value` by default.
- **CopyButton's failure icon** has a different class name: lucide-react 1.69 renamed `circle-alert` to
  `circle-exclamation-point` (same glyph). Update tests that select the icon by its class.

## Checklist

1. Upgrade vellum-ui and remove the antd and dayjs type imports that were only used for vellum-ui props.
2. Run the type checker and fix every error with the tables above.
3. Check the behavior changes: state inside Modal, `getByRole('toolbar')`, Progress with `tone` at 100%, LineChart
   axes, tests that expect a chart or formatted Markdown right after rendering.
4. If you render the documentation from `components.json`, stop reading the `antd` field.

---

## 简体中文

[English](#migrating-to-10) | **简体中文**

本指南帮助 vellum-ui 0.x 应用迁移到 1.0 的独立公共 API。组件属性不再暴露 Ant Design 类型，完整发布说明见
[变更记录](CHANGELOG.md)（英文）。

### 开始之前

- 使用 TypeScript 时，本指南中的几乎所有变化都会表现为类型错误：每个组件只接受其文档页上列出的属性。升级后运行类型检查，
  对照下面的表格逐个修改。
- 少数变化类型检查发现不了，列在[行为变化](#行为变化)中，请在代码与测试中逐项查找。
- 如果应用导入 antd 或 dayjs 的类型只是为了给 vellum-ui 的属性标注类型（如 DatePicker 用的 `Dayjs`、Dropdown 用的
  `MenuProps`），删掉这些导入。

### 原则

0.x 中许多组件直接透传 antd 的属性：属性类型就是 antd 的类型去掉 `style` 与 `className`。1.0 中每个组件都声明自己的属性。

- 每个组件只接受其文档页上列出的属性，antd 的其他属性一律不再提供，例如 `getPopupContainer`、`centered`、Drawer 的
  `placement`、Breadcrumb 的 `separator`、Steps 的 `type`、Pagination 的 `pageSizeOptions`。
- 公共接口中不出现 antd、`@ant-design/*`、`rc-*`、dayjs 的类型：属性、回调参数、值、ref、静态成员都不出现。应用代码依赖
  vellum-ui 的接口约定，与底层实现类型解耦。
- 整个组件库使用同一套命名规则：

| 概念 | 1.0 | 0.x（antd） |
| --- | --- | --- |
| 尺寸 | `size="sm"`、`"md"`、`"lg"`（类型 `ControlSize`） | `small` / `middle` / `large`，或 `small` / `default` |
| 语义色 | `tone`，取值为 `neutral`、`accent`、`info`、`success`、`warning`、`danger` | `type="error"`、`danger`、`color` |
| 外观 | `variant` | `type="primary"`、`optionType="button"` |
| 原生名称 | 保持原生含义：Button 的 `type="submit"` | `htmlType="submit"` |
| 校验状态 | `status="error"` 或 `"warning"` | Form.Item 的 `validateStatus` |
| 值 | `onChange(value)`；开关与复选框 `onChange(checked)`；文本输入仍收到原生的变更事件 | `onChange(event)`、`onChange(value, option)` |
| 弹层开关 | `open` / `defaultOpen` / `onOpenChange(open)` | （不变） |
| 日期与时间 | ISO 字符串，如 `'2026-11-07'`、`'14:30'` | dayjs 对象 |
| 小数 | 十进制字符串：InputNumber 的 `decimal` | `stringMode` |
| 没有值 | `null`，`value` 与 `onChange` 中都是（Select、TreeSelect、Cascader、DatePicker、TimePicker、InputNumber）；文本输入用 `''` | 按组件不同，是 `undefined` 或 `null` |
| 测试定位 | 不接收原生属性的组件用 `testId` | `data-testid` |

### 常见情况

#### Button

```tsx
// 0.x
<Button type="primary" htmlType="submit" size="small">Save</Button>
<Button danger icon={<Icon name="trash" />}>Delete</Button>

// 1.0
<Button variant="primary" type="submit" size="sm">Save</Button>
<Button tone="danger" icon="trash">Delete</Button>
```

#### 多选的 Select

```tsx
const labels = [
  { value: 'design', label: 'Design' },
  { value: 'research', label: 'Research' },
]

// 0.x
<Select mode="multiple" value={selected} onChange={(value: string[]) => setSelected(value)} options={labels} />

// 1.0：onChange 只收到值
<Select multiple value={selected} onChange={setSelected} options={labels} />
```

#### DatePicker 的值

```tsx
// 0.x
import dayjs, { type Dayjs } from 'dayjs'

<DatePicker
  value={dueDate ? dayjs(dueDate) : null}
  onChange={(date: Dayjs | null) => setDueDate(date ? date.format('YYYY-MM-DD') : null)}
/>

// 1.0：值是 ISO 字符串，如 '2026-11-07'，或者 null
<DatePicker value={dueDate} onChange={setDueDate} />
```

#### Form.Item 的状态与自定义规则

```tsx
// 0.x
<Form.Item
  label="Name"
  name="name"
  validateStatus={taken ? 'error' : undefined}
  help={taken ? 'This name is already in use' : undefined}
  rules={[
    {
      validator: (_, value) =>
        value === 'admin' ? Promise.reject(new Error('This name is reserved')) : Promise.resolve(),
    },
  ]}
>
  <Input />
</Form.Item>

// 1.0：用 status；validator 收到值，返回错误文字（或解析为它的 Promise）
<Form.Item
  label="Name"
  name="name"
  status={taken ? 'error' : undefined}
  help={taken ? 'This name is already in use' : undefined}
  rules={[{ validator: (value) => (value === 'admin' ? 'This name is reserved' : undefined) }]}
>
  <Input />
</Form.Item>
```

#### Modal 的确认按钮

```tsx
// 0.x
<Modal
  open={open}
  title="Delete project"
  okText="Delete"
  okButtonProps={{ danger: true, disabled: !confirmed }}
  confirmLoading={deleting}
  destroyOnHidden
  onOk={remove}
  onCancel={close}
>
  {content}
</Modal>

// 1.0：关闭后内容总是卸载
<Modal
  open={open}
  title="Delete project"
  okText="Delete"
  okTone="danger"
  okDisabled={!confirmed}
  okLoading={deleting}
  okTestId="confirm-delete"
  onOk={remove}
  onCancel={close}
>
  {content}
</Modal>
```

### 逐个组件

每张表列出变化的部分；没有提到的属性名称与含义不变。「不再提供」列出最常用、已经去掉的 antd 属性。

#### Button

| 0.x | 1.0 |
| --- | --- |
| `type="primary"`、`"default"`、`"dashed"`、`"text"` | `variant="primary"`、`"default"`（默认）、`"dashed"`、`"text"` |
| `danger` | `tone="danger"`，可与任意 `variant` 组合 |
| `htmlType="submit"` | `type="submit"`；默认 `button` |
| `size="small"`、`"middle"`、`"large"` | `size="sm"`、`"md"`、`"lg"` |
| `loading={{ delay: 300 }}` | `loading`（布尔值） |
| `icon={<Icon name="plus" />}` | `icon="plus"`：写图标名，与 IconButton、菜单项一致；大小随 `size` |

不再提供：`color`、`shape`、`ghost`、`iconPosition`。强调色的文字链接用 LinkButton，只有图标的按钮用 IconButton。

#### Form 与 Form.Item

| 0.x | 1.0 |
| --- | --- |
| `layout` 默认 `horizontal` | `layout` 默认 `vertical`（标签在字段上方）；要标签在左，传 `layout="horizontal"` |
| Form.Item 的 `validateStatus` | `status`：`'error'`、`'warning'`、`'success'` 或 `'validating'` |
| 规则 `validator: (rule, value) => Promise` | `validator: (value) => string \| undefined`，或解析为它的 Promise：返回错误文字 |
| 函数形式的规则 `({ getFieldValue }) => ({ … })` | 对象形式的规则；在 `validator` 中用 `form.getFieldValue(name)` 读取其他字段 |
| 规则的 `type: 'string'`、`'array'` 等，以及 `enum`、`transform`、`warningOnly` | `type: 'email'`、`'url'`、`'number'` 或 `'integer'`；其余不再提供 |
| `Form.useWatch(name, form)` | Form 的 `onValuesChange(changed, values)`，或者把值放在自己的状态中 |
| `Form.List` | 不再提供：条目放在自己的状态中；Form.Item 的 `name` 可以是路径，如 `['members', 0, 'email']` |
| `Form.ErrorList` | 不再提供：错误显示在各个 Form.Item 下方；整个表单的错误用 Alert 显示 |
| `Form.useForm(form)` | `Form.useForm()` |
| `getFieldsValue(true)`、`getFieldsValue(names)` | `getFieldsValue()` |
| `onFinishFailed({ values, errorFields, outOfDate })` | `onFinishFailed({ values, errorFields })`；每个错误字段是 `{ name, errors }` |

表单实例（`FormInstance`）提供 `getFieldsValue`、`getFieldValue`、`setFieldsValue`、`setFieldValue`、`resetFields`、
`validateFields`、`submit` 与 `scrollToField`。提交时总是滚动并聚焦到第一个错误字段。

不再提供：Form 的 `labelCol`、`wrapperCol`、`colon`、`size`、`fields`、`onFieldsChange`、`preserve`、
`validateMessages`、`scrollToFirstError`；Form.Item 的 `dependencies`（读取其他字段的规则在本字段变化时校验，其他字段
变化时不会重新校验）、`shouldUpdate`、`noStyle`、`normalize`、`getValueFromEvent`、`tooltip`、`hasFeedback`；实例方法
`getFieldError`、`setFields`、`isFieldTouched`。

#### Input、Input.Password、Input.Search、Input.TextArea

| 0.x | 1.0 |
| --- | --- |
| `size="small"`、`"middle"`、`"large"` | `size="sm"`、`"md"`、`"lg"` |
| `variant="outlined"`、`"underlined"` | `variant="filled"`（默认）或 `"borderless"` |
| `addonBefore`、`addonAfter` | 不再提供：用框内的 `prefix` 与 `suffix` |
| `showCount`、`count` | `showCount` 为布尔值；配合 `maxLength` 显示当前与最大字数。不支持自定义 `count` 配置。 |
| `type="number"`、`type="password"` | InputNumber、Input.Password |
| Input.Search 的 `onSearch(value, event, info)` | `onSearch(value, info)` |
| Input.Password 的 `visibilityToggle={{ … }}`、`iconRender` | `visibilityToggle`（布尔值） |
| Input.TextArea 的 ref `resizableTextArea.textArea` | ref 的 `textarea`（`TextAreaRef`） |
| `InputRef`（antd 的） | `InputRef`：`focus({ cursor })`、`blur()`、`select()` 与原生的 `input` |

文本输入的 `onChange` 仍然收到原生的变更事件（`e.target.value`）。

输入控件也支持 `variant="outlined"`（1.1 起；1.1、1.2 以它为默认值）。从 1.3 起默认值重新是 `filled`，外观是不描边的
凹槽；要保留描边外观时显式设置 `variant="outlined"`；
参见当前的 [API 约定](docs/zh-CN/guides/conventions.md#外观variant)。

#### InputNumber

| 0.x | 1.0 |
| --- | --- |
| `stringMode`、`InputNumber<string>` | `decimal`：值、`min`、`max`、`step` 都是十进制字符串，如 `"1280.50"` |
| `InputNumber<number>` | `InputNumber`（没有类型参数）；值是 number |
| `size="small"` 等 | `size="sm"` 等 |
| `prefix`、`addonBefore`、`addonAfter`、`formatter`、`parser` | 不再提供；单位用 `suffix` 显示 |

框为空时值是 `null`，与以前相同。

#### Select

| 0.x | 1.0 |
| --- | --- |
| `mode="multiple"` | `multiple`：值是数组 |
| `mode="tags"` | 不再提供 |
| `onChange(value, option)` | `onChange(value)`；带 `allowClear` 的单选在清除时收到 `null` |
| 带任意字段的选项 | `SelectOption`：`{ value, label, disabled }`；分组 `SelectOptionGroup`：`{ label, options }` |
| `filterOption`、`optionFilterProp` | 不再提供：`showSearch` 按选项的 `label` 筛选 |
| `SelectProps<V, O>` | `SelectProps<V>`；`V` 默认为 `string` |
| 带 `scrollTo` 的 `SelectRef` | `SelectRef`：`focus()`、`blur()` |

`value` 与 `defaultValue` 中的 `null` 表示「没有选择」。

不再提供：`labelInValue`、`onSearch`、`notFoundContent`、`optionRender`、`popupRender`、`maxTagCount`、
`suffixIcon`、`virtual`。

Select、TreeSelect、Cascader、AutoComplete、DatePicker、TimePicker 在自有属性之外只接受这些属性（`FieldAttributes`）：
`id`、`aria-label`、`aria-labelledby`、`aria-describedby`、`data-testid`、`autoFocus`、`onFocus`、`onBlur`、`onKeyDown`。

#### TreeSelect

| 0.x | 1.0 |
| --- | --- |
| `treeData` | `options`：`TreeSelectOption` `{ value, title, children, disabled, selectable }` |
| `treeDefaultExpandAll` | `defaultExpandAll` |
| `treeCheckable` | `multiple checkable` |
| `showCheckedStrategy={TreeSelect.SHOW_PARENT}` | `showChecked="parent"`（`all`、`parent` 或 `child`，默认 `child`） |
| `onChange(value, labels, extra)` | `onChange(value)` |
| `TreeSelectNode`、`TreeSelectComponent` | `TreeSelectOption` |

`showSearch` 按节点的 `title` 筛选。不再提供：`loadData`、`treeLine`、`treeExpandedKeys`、`fieldNames`、
`labelInValue`、`treeCheckStrictly`。

#### Cascader

| 0.x | 1.0 |
| --- | --- |
| `showCheckedStrategy={Cascader.SHOW_CHILD}` | `showChecked="child"`（`parent` 或 `child`，默认 `parent`） |
| `onChange(value, selectedOptions)` | `onChange(value)`：路径，清除时为 `null`；`multiple` 时是路径的数组 |
| `CascaderOptionType`、`CascaderComponent` | `CascaderOption`：`{ value, label, children, disabled }` |
| `ref` | 不再提供 |

不再提供：`changeOnSelect`、`expandTrigger`、`displayRender`、`loadData`、`fieldNames`、对象形式的 `showSearch`。

#### AutoComplete

| 0.x | 1.0 |
| --- | --- |
| `onChange(value, option)`、`onSelect(value, option)` | `onChange(value)`（清除时为空字符串）、`onSelect(value)` |
| 选项 | `AutoCompleteOption`：`{ value, label }` |
| `filterOption(input, option)` | `filterOption`：`true`（包含输入的文字，不区分大小写），或 `(text, option) => boolean` |
| `ref`（`AutoCompleteRef`）、以子元素自定义输入框 | 不再提供 |

#### Checkbox、Radio、Switch、Segmented

| 0.x | 1.0 |
| --- | --- |
| Checkbox 的 `onChange={(e) => set(e.target.checked)}` | `onChange={set}`：收到 `checked` |
| 以 Checkbox 作为子元素的 Checkbox.Group | `options`（必填）：直接是值，或 `{ value, label, disabled }` |
| Radio.Group 的 `onChange={(e) => set(e.target.value)}` | `onChange={set}`：收到值 |
| Radio.Group 的 `optionType="button"` | `variant="button"` |
| Radio.Group 的 `buttonStyle` | 不再提供 |
| Radio 的 `value` 只能是 `string \| number` | `value` 的类型与 Radio.Group 的值相同（`Radio<V>`） |
| `RadioButtonProps` | `RadioProps`（Radio 与 Radio.Button 共用） |
| Switch 的 `onChange(checked, event)` | `onChange(checked)` |
| Switch 的 `size="small"` | `size="sm"` |
| Switch 的 `checkedChildren`、`unCheckedChildren` | 不再提供 |
| Segmented 的 `size="small"`、`"large"` | `size="sm"`、`"lg"` |
| Segmented 的选项对象 | `{ value, label, icon, title, disabled }`；`icon` 是图标名（`icon: 'grid'`，不是元素）；只有图标的选项必须提供 `title` |

ref 指向原生元素：Checkbox 与 Radio 指向 `<input>`，Switch 指向 `<button role="switch">`，Segmented 指向根元素。

#### DatePicker 与 TimePicker

| 0.x | 1.0 |
| --- | --- |
| dayjs 对象形式的 `value`、`defaultValue`（`DateValue`） | ISO 字符串，为空时是 `null`：`'2026-11-07'`；`picker="month"` 时 `'2026-11'`；`picker="year"` 时 `'2026'`；`showTime` 时 `'2026-11-07T14:30:00+08:00'`（本地时区偏移） |
| `onChange(date, dateString)` | `onChange(value)`；清除时是 `null` |
| RangePicker 的 `onChange(dates, dateStrings)` | `onChange([start, end])`，或 `null` |
| `disabledDate(current: Dayjs)` | `disabledDate(date: string)`，参数是 `YYYY-MM-DD` 格式的日期 |
| `picker="week"`、`"quarter"` | 不再提供 |
| `showTime={{ … }}` | `showTime`（布尔值） |
| dayjs 对象形式的 TimePicker 值（`TimeValue`） | `'14:30:00'`；`format` 不含秒时为 `'14:30'` |
| TimePicker 的 `hourStep`、`secondStep`、`use12Hours` | 不再提供；保留 `minuteStep` |

DatePicker 的 `format` 只改变框中显示的格式。TimePicker 及其 RangePicker 的格式不含秒时，值与 `onChange`
输出也改为 `HH:mm`；否则使用 `HH:mm:ss`。
不再提供：`presets`、`minDate`、`maxDate`、`disabledTime`、`renderExtraFooter`、`needConfirm`、`ref`。

#### Slider 与 ColorPicker

| 0.x | 1.0 |
| --- | --- |
| `SliderSingleProps`、`SliderRangeProps` | `SliderProps` |
| Slider 的 `range={{ draggableTrack: true }}` | `range`（布尔值） |
| Slider 中带 `{ style, label }` 的 `marks` | `marks`：值 → 文字 |
| Slider 的 `tooltip`、`vertical`、`dots`、`included`、`reverse` | 不再提供 |
| ColorPicker 中颜色对象或字符串形式的 `value`（`ColorValue`） | 十六进制字符串，如 `'#2d6bf3'` |
| ColorPicker 的 `onChange(color, css)` | `onChange(hex)`：小写的十六进制字符串，颜色不透明时不带透明度 |
| ColorPicker 的 `presets` | `ColorPreset[]`：`{ label, colors }` |

不再提供：ColorPicker 的 `format`、`onChangeComplete`、`allowClear`、`trigger`、`placement`、`ref`。

#### Upload

| 0.x | 1.0 |
| --- | --- |
| `beforeUpload`、`return Upload.LIST_IGNORE` | `accept` 与 `maxSize`：不符合的文件不加入文件列表，并调用 `onReject(file, reason)`；`maxCount` 限制列表中的文件数 |
| `UploadChangeParam` | `UploadChangeInfo`：`{ file, fileList }` |
| `customRequest` 参数中的 `onProgress({ percent })` | `onProgress(percent)`；返回 `{ abort() }`，「移除」就能取消请求 |
| `UploadFile<T>` | `UploadFile`：`uid`、`name`、`size`、`type`、`status`、`percent`、`response`、`error`、`originFileObj`、`url` |
| 与 `action` 一起用的 `headers`、`data`、`withCredentials`、`method` | 不再提供：用 `customRequest` 自己发送文件 |
| `ref`（`UploadRef`） | 不再提供 |

不再提供：`listType`、`itemRender`、`iconRender`、`directory`、`openFileDialogOnClick`。

#### Modal

| 0.x | 1.0 |
| --- | --- |
| `okButtonProps={{ disabled }}` | `okDisabled` |
| `okButtonProps={{ loading }}`、`confirmLoading` | `okLoading` |
| `okButtonProps={{ danger: true }}`、`okType="danger"` | `okTone="danger"` |
| 确认按钮上的测试定位 | `okTestId` |
| `destroyOnHidden` | 不再提供：关闭后内容总是卸载 |
| `onOk(event)`、`onCancel(event)` | `onOk()`、`onCancel()` |
| 函数形式的 `footer` | `footer`：一个节点，或者 `null` 表示没有底部 |

保留：`open`、`title`、`okText`、`footer`、`closable`、`maskClosable`、`width`、`flush`、`aria-label`。不再提供：
`cancelText`、`cancelButtonProps`、`centered`、`afterClose`、`afterOpenChange`、`keyboard`、`getContainer`、`zIndex`。

#### Drawer

| 0.x | 1.0 |
| --- | --- |
| `size={480}` 或 `width={480}` | `width={480}`（像素数或 CSS 长度） |
| `data-testid` | `testId` |
| `placement` | 不再提供：抽屉从右侧滑出 |
| `footer`、`extra` | 不再提供：把操作放在内容中 |
| `destroyOnHidden` | 不再提供：关闭后内容保留 |

#### Dropdown

| 0.x | 1.0 |
| --- | --- |
| 菜单项的 `icon: <Icon name="edit" />` | `icon: 'edit'`：图标名 |
| | 菜单项的 `shortcut: 'mod+d'` 显示按键帽；它只是提示，快捷键本身用 `useHotkeys` 注册 |
| `menu.selectable` 与 `menu.selectedKeys` | `menu.selectedKeys` |
| `menu.onClick({ key, keyPath, domEvent })` | `menu.onClick({ key })` |
| 子菜单（`children`）、分组（`type: 'group'`） | 不再提供 |
| `ref` | 不再提供 |

菜单的类型是 `DropdownMenu`、`DropdownMenuItem`、`DropdownMenuAction` 与 `DropdownMenuDivider`。不再提供：
`disabled`、`arrow`、`popupRender`、`getPopupContainer`、`destroyOnHidden`。ContextMenu 没有变化。

```tsx
// 1.0
<Dropdown
  trigger={['click']}
  menu={{
    items: [
      { key: 'duplicate', label: 'Duplicate', icon: 'copy', shortcut: 'mod+d' },
      { type: 'divider' },
      { key: 'delete', label: 'Delete', icon: 'trash', danger: true },
    ],
    onClick: ({ key }) => run(key),
  }}
>
  <IconButton icon="more" label="More actions" />
</Dropdown>
```

#### Tooltip、Popover、Popconfirm

| 0.x | 1.0 |
| --- | --- |
| Tooltip 的 `open`、`onOpenChange` | 不再提供：Tooltip 是非受控的 |
| Tooltip 的 `color`、`arrow`、`mouseLeaveDelay` | 不再提供；保留 `title`、`placement`、`mouseEnterDelay`、`trigger` |
| Popover | `title`、`content`、`trigger`、`placement`、`open`、`defaultOpen`、`onOpenChange` |
| Popconfirm 的 `okButtonProps={{ danger: true }}` | `okTone="danger"` |
| Popconfirm 的 `cancelText`、`icon`、`showCancel`、`placement`、`open` | 不再提供 |
| 三者的 `ref` | 不再提供 |

#### Alert

| 0.x | 1.0 |
| --- | --- |
| `type="info"`、`"success"`、`"warning"`、`"error"` | `tone="info"`（默认）、`"success"`、`"warning"`、`"danger"` |
| `message` | `title`（必填） |
| `closable={{ onClose }}` | `closable` 与 `onClose` |
| `action`、`banner`、`icon` | 不再提供 |

#### Descriptions、Tabs、Pagination、Divider、Skeleton

| 0.x | 1.0 |
| --- | --- |
| Descriptions 的 `size="small"` | `size="sm"` |
| Descriptions 的 `items` | `DescriptionsItem`：`{ key, label, children }`；不再提供 `span` |
| Descriptions 的 `column={{ xs: 1, md: 2 }}` | `column={2}`，或者省略，随窗口宽度变化 |
| Descriptions 的 `bordered`、`layout`、`title`、`extra` | 不再提供 |
| Tabs 的 `items` | `TabsItem`：`{ key, label, children }` |
| Tabs 的 `activeKey` | 不变：`activeKey`（受控）或 `defaultActiveKey`，配合 `onChange(key)` |
| Tabs 的 `type="card"`、`tabBarExtraContent`、标签的 `disabled` 与 `icon` | 不再提供 |
| Pagination 的 `size="small"` | `size="sm"` |
| Pagination 的 `showTotal(total, range)` | `showTotal(total)` |
| Pagination 的 `pageSizeOptions`、`showQuickJumper`、`simple`、`onShowSizeChange` | 不再提供；`onChange(page, pageSize)` 同时给出两者 |
| Divider 的 `type="vertical"`、`orientation`、`titlePlacement`、`dashed` | 不再提供；保留 `children` 与 `plain` |
| Skeleton 的 `avatar={{ … }}`、`round` | `avatar`（布尔值）；保留 `active`、`title`、`paragraph`、`loading`、`children` |

#### Timeline

| 0.x | 1.0 |
| --- | --- |
| 事件的 `children` | `content` |
| 事件的 `color="green"` | `tone="success"`：`neutral`、`accent`（默认）、`info`、`success`、`warning`、`danger` |
| 事件的 `label`、`dot`、`icon`；`mode`、`pending`、`reverse` | 不再提供 |

#### Tree

| 0.x | 1.0 |
| --- | --- |
| `treeData` | `options`（与 Select、TreeSelect 一致） |
| `TreeDataNode`（antd 的） | `TreeDataNode`：`{ key, title, children, disabled }`，key 是字符串；节点上可以带其他字段 |
| `onSelect(keys, info)`、`onCheck(checked, info)`、`onExpand(keys, info)` | `onSelect(keys)`、`onCheck(keys)`、`onExpand(keys)`，参数是 `string[]` |
| `draggable={{ icon: false }}` 或函数 | `draggable`（布尔值）；整个节点都可以拖动 |
| 带 `dragNode`、`node`、`dropPosition`、`dropToGap` 的 `onDrop(info)` | `onDrop({ node, target, position })`：原来的节点对象，以及 `'before'`、`'inside'` 或 `'after'` |
| `data-testid` | `testId` |

不再提供：`defaultExpandedKeys`、`showLine`、`showIcon`、`titleRender`、`loadData`、`checkStrictly`、`multiple`、
`height`、`fieldNames`。

#### Steps 与 Breadcrumb

| 0.x | 1.0 |
| --- | --- |
| Steps 的 `size="small"` | `size="sm"`（`sm` 或 `md`） |
| Steps 中步骤的 `subTitle`、`icon`、`status` | 不再提供：步骤是 `{ title, content, disabled }` |
| Steps 的 `initial`、`type`、`iconRender`、`percent`、`progressDot` | 不再提供 |
| Breadcrumb 项的 `menu`（antd 的菜单属性） | `menu`：一个 `DropdownMenu`（`items` 中的图标是图标名，`onClick({ key })`） |
| Breadcrumb 菜单项的 `path` | 不再提供：在 `menu.onClick` 中跳转 |
| Breadcrumb 的 `separator`、`itemRender`、`params`、项的 `path`、`BreadcrumbProps` 的类型参数 | 不再提供 |

#### Progress

| 0.x | 1.0 |
| --- | --- |
| `type="line"`、`"circle"` | `variant="line"`、`"circle"` |
| `type="dashboard"` | 不再提供 |
| `size="small"`、`"default"` 或数字 | `size="sm"`、`"md"`、`"lg"` |
| `showInfo` | `showValue` |
| `status="exception"` | `status="error"`（读屏读作「60%，失败」） |
| `status="normal"` | 省略 `status` |
| | `tone="accent"`、`"success"`、`"warning"`、`"danger"`，用于存储用量等量表 |
| `format`、`steps`、`strokeLinecap`、`percentPosition` | 不再提供 |

#### App、Image、LineChart

| 0.x | 1.0 |
| --- | --- |
| App 的 `component`、`notification` | 不再提供；App 只有 `children` 与 `message` |
| Image：antd 的图片属性（`onClick`、`crossOrigin`、`srcSet` 等） | 只有 `src`、`alt`、`placeholder`、`fallback`、`preview`、`fit`、`radius`、`width`、`height`、`loading` |
| LineChart 的数值轴总是从 0 开始 | 按数据范围；需要包含 0 时加 `includeZero` |

### 删除的导出

| 删除 | 改用 |
| --- | --- |
| Table、`TableProps` | DataTable（`DataTableProps`、`DataTableColumn`） |
| `DEFAULT_THEME` | `DEFAULT_THEME_ID`（主题 ID 字符串；`defaultTheme` 是主题对象） |
| Text 的 `weight="bold"`、令牌 `--vl-font-weight-bold`、`fontWeightScale.bold` | `semibold`（字重本来就相同，都是 600） |
| Numeric | `<Text numeric>` |
| `toAntdTheme` | 无：ThemeProvider 自己配置 antd |
| Form.List、Form.ErrorList、Form.useWatch、`FormListProps`、`FormErrorListProps` | 见上文 Form 与 Form.Item |
| `DateValue`、`TimeValue` | ISO 字符串（`string`） |
| `ColorValue` | 十六进制字符串（`string`） |
| `UploadChangeParam` | `UploadChangeInfo` |
| `UploadRef` | 无 |
| `Upload.LIST_IGNORE` | `accept`、`maxSize`、`maxCount`、`onReject` |
| `TreeSelectNode`、`TreeSelectComponent` | `TreeSelectOption` |
| `CascaderOptionType`、`CascaderComponent` | `CascaderOption` |
| `TreeSelect.SHOW_ALL`、`SHOW_PARENT`、`SHOW_CHILD`；`Cascader.SHOW_PARENT`、`SHOW_CHILD` | `showChecked="all"`、`"parent"`、`"child"` |
| `AutoCompleteRef` | 无 |
| `RadioButtonProps` | `RadioProps` |
| `SliderSingleProps`、`SliderRangeProps` | `SliderProps` |
| `ComponentDoc.antd`、`components.json` 的 `antd` 字段 | 无：组件的每个属性都在 `props` 中；`base` 与 `native` 保留 |

为组件库自有属性新增的类型：`ControlSize`、`ChoiceOption`、`FieldAttributes`、`FocusOptions`、`SelectOption`、
`SelectOptionGroup`、`TreeSelectOption`、`CascaderOption`、`AutoCompleteOption`、`ColorPreset`、`FormRule`、
`FormValues`、`FieldName`、`FormFieldError`、`FormFinishFailedInfo`、`UploadFileStatus`、`UploadChangeInfo`、
`DropdownMenu`、`DropdownMenuItem`、`DropdownMenuAction`、`DropdownMenuDivider`、`DescriptionsItem`、`TabsItem`、
`TimelineItem`、`TreeDropInfo`、`LineAreaChartProps`。

### ref 与测试定位

- 渲染一个主要元素的组件（Button、Input 及其变体、InputNumber、Checkbox、Radio、Switch、Segmented、Form）接收这个
  元素的原生属性，如 `id`、`aria-*`、`data-*` 与事件处理函数。它们的 ref 指向原生元素，或者组件库声明的句柄
  （`InputRef`、`TextAreaRef`、`InputNumberRef`、`SelectRef`）。
- 弹层与容器（Modal、Drawer、Dropdown、Tooltip、Popover、Popconfirm、Alert、Descriptions、Tabs、Pagination、
  Timeline、Tree、Steps、Breadcrumb、App、Image）不接收原生属性，也不接收 ref。Drawer、Tree 与 Pill 有 `testId`，Modal 的
  确认按钮用 `okTestId`。其他组件在测试中按角色与读屏名称查找元素，或者用带 `testId` 的 Box 包住组件。

### 行为变化

这些变化不会表现为类型错误，请在代码与测试中查找。

- **Modal 关闭后卸载内容。** 对话框内部创建的状态会重置（0.x 中需加 `destroyOnHidden`）；外部持有的状态，包括
  页面级 `Form.useForm()` 实例，会继续保留。新建表单需要清空时，在取消或提交成功后、关闭之前，趁 Form 仍挂载调用
  `form.resetFields()`。见[表单弹窗配方](docs/zh-CN/recipes/FormDialog.md)。
- **Toolbar 不再是 `role="toolbar"`。** 它默认没有角色，有 `aria-label` 时是 `role="group"`，因为其中的控件用 `Tab`
  逐个到达，而不是用方向键。用 `getByRole('toolbar')` 的测试，请给工具栏加 `aria-label`，改用
  `getByRole('group', { name: … })`。SelectionBar 的栏是一个分组，名称为内置文本 `selectionBar.label`（「批量操作」）。
- **带 `tone` 的 Progress 到 100% 时保持原来的色调。** 没有 `tone` 与 `status` 时，到 100% 仍然变为 `success`。
  因此存储用量这类量表满了时仍是 `warning` 或 `danger`。
- **LineChart 的数值轴按数据范围。** 不再强制包含 0，变化更容易看出。与 0 的距离有意义时加 `includeZero`。AreaChart
  与 BarChart 仍从 0 开始。
- **图表与 Markdown 在第一次渲染时加载引擎。** ECharts（只含用到的图表类型的模块）与 Markdown 渲染器是单独的分块，
  在第一次渲染图表或 Markdown 时用 `import()` 加载。加载完成之前，图表保持最终的尺寸，200ms 后显示加载指示；Markdown
  以纯文本显示。加载失败时，图表显示带「重试」的错误状态，Markdown 保持纯文本。服务端渲染不变。测试中请等待渲染出的
  内容（例如用 `findBy…` 或 `expect.poll`），不要在渲染后立即检查。
- **Select 与 TreeSelect 按文字搜索。** 有 `showSearch` 时按选项的 `label`（TreeSelect 按节点的 `title`）筛选；antd
  默认按 `value` 筛选。
- **CopyButton 失败时的图标** 类名变了：lucide-react 1.69 把 `circle-alert` 改名为 `circle-exclamation-point`（图形
  相同）。按类名选取这个图标的测试需要更新。

### 检查清单

1. 升级 vellum-ui，删掉只为 vellum-ui 属性而导入的 antd 与 dayjs 类型。
2. 运行类型检查，对照上面的表格修正所有错误。
3. 检查行为变化：Modal 中的状态、`getByRole('toolbar')`、带 `tone` 的 Progress 到 100% 时、LineChart 的数值轴、
   在渲染后立即检查图表或 Markdown 格式的测试。
4. 如果用 `components.json` 渲染文档，不再读取 `antd` 字段。
