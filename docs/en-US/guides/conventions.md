**English** | [简体中文](../../zh-CN/guides/conventions.md)

# Conventions

The API conventions of vellum-ui that hold for every component: sizes, tones and variants; native attributes; values and change callbacks; how "no value", dates, times, decimals and colors are written; open state; native attributes, refs and test ids; the texts of the library; and a table of the Ant Design habits that do not work here, with what to write instead. Read it before writing code: the props are the library's own, not antd's, even where a component is implemented with antd.

## Names

### Size: `sm`, `md`, `lg`

Controls take `size: 'sm' | 'md' | 'lg'` (the type `ControlSize`): Button, IconButton, Input and its variants, InputNumber, Select, TreeSelect, Cascader, AutoComplete, DatePicker, TimePicker, ColorPicker, Radio.Group (button style), Segmented, Pagination, Descriptions, Progress. Without `size`, controls follow the density of ThemeProvider (comfortable or compact). Use `sm` in table rows, toolbars and panel headers, `lg` for prominent forms.

Some components have fewer steps: Switch, Steps, CopyButton, Sparkline, EmptyState and ErrorState take `sm` or `md`; Statistic takes `md` or `lg`. Text takes font steps (`2xs`, `xs`, `sm`, `md`, `lg`, `xl`). Avatar and Icon take a size in pixels.

### Tone: semantic color

`tone` is a semantic color. The vocabulary is `neutral`, `accent`, `success`, `warning`, `danger` and `info`; each component accepts the part that makes sense for it:

| Component | `tone` |
| --- | --- |
| Button | `danger` (with any `variant`) |
| LinkButton | `accent` (default), `danger` |
| Modal, Popconfirm | `okTone="danger"` for the OK button |
| Pill, Timeline items | `neutral`, `accent`, `success`, `warning`, `danger`, `info` |
| Alert | `info` (default), `success`, `warning`, `danger` |
| Progress | `accent`, `success`, `warning`, `danger` (a meter; it keeps its tone at 100%) |
| StatusDot, Avatar `status` | `success`, `warning`, `danger`, `neutral`, `accent` |
| CountBadge | `neutral` (default), `accent` |
| Text | `primary`, `secondary`, `tertiary`, and `accent`, `danger`, `warning`, `success` |
| Icon | `inherit` (default), `secondary`, `tertiary`, `accent`, `danger`, `success`, `warning` |

Menu items and data objects use boolean fields such as `danger: true`: those are data, not props.

### Variant: appearance

`variant` chooses an appearance, never a meaning:

| Component | `variant` |
| --- | --- |
| Button | `primary` (one per area), `default`, `dashed`, `text` |
| IconButton | `ghost` (default), `soft`, `accent` |
| Input, Select, TreeSelect, Cascader, AutoComplete, DatePicker, TimePicker | `filled` (default), `borderless` |
| Radio.Group | `default`, `button` |
| Progress | `line` (default), `circle` |
| PageSkeleton | `list`, `detail`, `split` |
| SplitView | `panel` (default), `flush` |
| SegmentedBar | `thin`, `tall` (required) |

### Native names keep their native meaning

A prop with the name of a native attribute means what it means in HTML. Button `type` is `'button'` (the default, unlike a bare `<button>`), `'submit'` or `'reset'`; Input `type` is a native input type such as `email` or `url`.

```tsx
<Button variant="primary" type="submit">Save</Button>
```

### Validation status

Inputs and Form.Item take `status`, a validation state, not a tone: inputs take `'error' | 'warning'`, Form.Item also `'success' | 'validating'`. Form.Item sets it on its control from `rules`; set it yourself only for checks done elsewhere, such as on the server:

```tsx
<Form.Item label="Name" name="name" status={taken ? 'error' : undefined} help={taken ? 'This name is already in use' : undefined}>
  <Input />
</Form.Item>
```

A rule's `validator` receives the value and returns the error text, nothing when the value is valid, or a promise of either: `validator: async (value) => (await exists(value) ? 'Already taken' : undefined)`.

## Values and change callbacks

Controls are controlled with `value` and `onChange(value)` or uncontrolled with `defaultValue`. **Value inputs pass the value itself; text inputs pass the native change event.**

| Control | `value` | `onChange` receives |
| --- | --- | --- |
| Input, Input.Password, Input.Search, Input.TextArea | `string` | the `ChangeEvent` (`e.target.value`) |
| Input.Search | | `onSearch(value, { source })` on `Enter` and on clearing |
| AutoComplete, PromptInput | `string` | the text |
| Checkbox, Switch | `checked: boolean` | `checked` |
| Checkbox.Group | `V[]` | `V[]` |
| Radio.Group, Segmented | `V` | `V` |
| Select | `V \| null`; with `multiple`, `V[]` | the value; a single Select with `allowClear` receives `null` when cleared |
| TreeSelect | `V \| null`; with `multiple`, `V[]` | the value or values |
| Cascader | the path `V[] \| null`; with `multiple`, `V[][]` | the path or paths |
| InputNumber | `number \| null`; with `decimal`, `string \| null` | the same |
| Slider | `number`; with `range`, `[number, number]` | the same (also `onChangeComplete`) |
| DatePicker, TimePicker | `string \| null` (ISO) | the same |
| DatePicker.RangePicker, TimePicker.RangePicker | `[string, string] \| null` | the same |
| ColorPicker | hex `string` | lowercase hex |
| Tabs | `activeKey` (controlled) or `defaultActiveKey`: the `key` of the tab | `onChange(key)` |
| Pagination | `current` | `onChange(page, pageSize)` |

Inside Form.Item, leave `value` and `onChange` out: Form.Item passes them. For Checkbox and Switch, set `valuePropName="checked"` on the Form.Item.

Options are plain objects: `{ value, label, disabled }` for Select (groups `{ label, options }`), Checkbox.Group, Radio.Group and Segmented; `{ value, title, children, disabled, selectable }` for TreeSelect; `{ value, label, children, disabled }` for Cascader. Select, TreeSelect, Cascader and Checkbox.Group take the type of the value as a type parameter (`string` by default); Segmented infers it, or takes it explicitly: `<Segmented<Range> … />`.

### "No value" is `null`

Select, TreeSelect, Cascader, InputNumber, DatePicker and TimePicker use `null` for "no value", in `value`, `defaultValue` and `onChange`. Text inputs, including AutoComplete, use the empty string `''`.

```tsx
const [status, setStatus] = useState<Status | null>(null)
<Select allowClear options={STATUS_OPTIONS} value={status} onChange={setStatus} />
```

### Dates and times are ISO strings

Values never are date objects; they can be stored and sent to a server as they are. `format` only changes what the field shows.

| Picker | Value |
| --- | --- |
| DatePicker | `'2026-11-07'` |
| DatePicker `picker="month"` | `'2026-11'` |
| DatePicker `picker="year"` | `'2026'` |
| DatePicker `showTime` | `'2026-11-07T14:30:00+08:00'` (local offset) |
| TimePicker | `'14:30:00'`; `'14:30'` when `format` has no seconds (`format="HH:mm"`) |
| RangePicker (both) | `[start, end]` in the same formats |

`disabledDate` receives the date as `'YYYY-MM-DD'`, so ISO dates compare as strings: `disabledDate={(date) => date < today}`.

### Decimals are strings

For amounts and other exact numbers, InputNumber takes `decimal`: the value, `min`, `max` and `step` are decimal strings, and the value never goes through floating point.

```tsx
<InputNumber decimal min="0" step="0.01" precision={2} value={price} onChange={setPrice} />
// price: string | null, such as "1280.50"
```

Without `decimal`, the value is a `number` (days, ports, counts).

### Colors are hex strings

ColorPicker takes a hex string (`'#2d6bf3'`) and passes the new color as lowercase hex, with alpha when it is not opaque (`'#2d6bf380'`).

## Open state

Overlays that can be controlled take `open`, `onOpenChange(open)` and, for some, `defaultOpen`: Dropdown, Popover (`defaultOpen` too), Select and TreeSelect (`defaultOpen` too), ColorPicker, ContextMenu (`onOpenChange` only), CommandPalette (`open` and `onOpenChange` required), and the preview of Image (`preview={{ open, onOpenChange }}`).

Dialogs are always controlled and do not close by themselves: Modal takes `open`, `onOk` and `onCancel`; Drawer `open` and `onClose`; Lightbox `open` and `onClose`. Set `open` to `false` yourself, in `onOk` after the action has succeeded. Modal unmounts its content after closing, so a form inside it starts from `initialValues` every time it opens; Drawer keeps its content.

Tooltip and Popconfirm are uncontrolled.

## Native attributes, refs and test ids

- **Components that render one main element** accept that element's native attributes (`id`, `aria-*`, `data-*`, event handlers such as `onClick`), except `style` and `className`, and their ref points to the native element or to a handle of the library:

  | Component | Native attributes of | Ref |
  | --- | --- | --- |
  | Button | `<button>` | `HTMLButtonElement` (or `HTMLAnchorElement` with `href`) |
  | IconButton, LinkButton | `<button>` | |
  | Input, Input.Password, Input.Search | `<input>` | `InputRef`: `focus({ cursor })`, `blur()`, `select()`, `input` |
  | Input.TextArea | `<textarea>` | `TextAreaRef`: `focus()`, `blur()`, `textarea` |
  | InputNumber | `<input>` | `InputNumberRef`: `focus()`, `blur()`, `nativeElement` |
  | Checkbox, Radio | `<input>` | `HTMLInputElement` |
  | Switch | `<button role="switch">` | `HTMLButtonElement` |
  | Segmented | `<div>` | `HTMLDivElement` |
  | Checkbox.Group, Radio.Group | `<div>` | |
  | Form | `<form>` | `HTMLFormElement` |

- **Composite inputs** (Select, TreeSelect, Cascader, AutoComplete, DatePicker, TimePicker) accept only `id`, `aria-label`, `aria-labelledby`, `aria-describedby`, `data-testid`, `autoFocus`, `onFocus`, `onBlur` and `onKeyDown` (the type `FieldAttributes`). Select and TreeSelect take a ref of type `SelectRef` (`focus()`, `blur()`); the others take no ref.
- **Layout components, patterns and most display components** (Stack, Page, Panel, DataTable, EmptyState, ListItem, charts, …) accept `testId` (rendered as `data-testid`), `aria-label`, `role` and `id`.
- **Overlays and containers** (Modal, Drawer, Dropdown, Tooltip, Popover, Popconfirm, Alert, Descriptions, Tabs, Pagination, Timeline, Steps, Breadcrumb, App, Image) accept no native attributes and no refs. Drawer and Tree take `testId`; Modal takes `okTestId` for its OK button and `aria-label` when it has no title. In tests, find the others by role and accessible name, or wrap them in a Box with `testId`.

Every component page lists what the component accepts besides its own props.

## Texts of the library

Texts that come from the library itself (empty states, "Retry", "Undo", "Loading", the texts of pickers and pagination, the default accessible names) follow the `locale` of ThemeProvider: `'en-US'` (default), `'zh-CN'`, or your own text table, where missing keys fall back to English. `messages` overrides single texts. Switching `locale` also switches the locale of the wrapped Ant Design components and the global locale of dayjs. Your own texts come from your application's translations.

## If you know Ant Design

Many components are implemented with Ant Design, but their props are not antd's. These antd habits do not work; TypeScript rejects most of them.

| antd habit | Write instead |
| --- | --- |
| `import { … } from 'antd'`, `@ant-design/icons`, `lucide-react` | Import everything from `vellum-ui`; icons by name: `<Icon name="trash" />`, and `icon="trash"` on IconButton, LinkButton, Pill, EmptyState, Avatar and menu items; Button and the options of Segmented take an element instead: `icon={<Icon name="plus" />}` |
| `<ConfigProvider theme={…}>` | `<ThemeProvider theme={extendTheme(defaultTheme, { … })}>` |
| `message.success()`, `Modal.confirm()` as static calls; `App.useApp()` | `useMessage()` and `useConfirmDanger()` inside `<App>` |
| `style`, `className`, `classNames`, `styles` | Semantic props; layout with Stack, Inline, Grid, Box |
| `size="small"`, `"middle"`, `"large"` | `size="sm"`, `"md"`, `"lg"` |
| Button `type="primary"`, `"dashed"`, `"text"` | `variant="primary"`, `"dashed"`, `"text"` |
| Button `type="link"` | LinkButton |
| Button `danger` | `tone="danger"` |
| Button `htmlType="submit"` | `type="submit"` |
| Button `loading={{ delay }}` | `loading` (boolean) |
| Button `shape`, `ghost`, `iconPosition`; a Button with only an icon | IconButton with `icon` and `label` |
| Form.Item `validateStatus` | `status` |
| Rule `validator: (rule, value) => Promise.reject(new Error(text))` | `validator: (value) => text` (or a promise of it) |
| `Form.List`, `Form.useWatch`, `dependencies`, `shouldUpdate` | Your own state; `onValuesChange`; `form.getFieldValue(name)` inside a `validator` |
| Checkbox `onChange={(e) => set(e.target.checked)}` | `onChange={set}` |
| Radio.Group `onChange={(e) => set(e.target.value)}`, `optionType="button"` | `onChange={set}`, `variant="button"` |
| Select `mode="multiple"` | `multiple` |
| Select `mode="tags"`, `labelInValue`, `filterOption`, `optionRender` | Not available; `showSearch` filters by label |
| `onChange(value, option)` | `onChange(value)` |
| `undefined` for an empty Select or InputNumber | `null` |
| TreeSelect `treeData`, `treeCheckable`, `showCheckedStrategy` | `options`, `multiple checkable`, `showChecked="parent"` |
| dayjs values for DatePicker and TimePicker | ISO strings: `'2026-11-07'`, `'14:30'` |
| `onChange(date, dateString)` | `onChange(value)` |
| `disabledDate={(d) => d.isBefore(dayjs())}` | `disabledDate={(date) => date < today}` with `'YYYY-MM-DD'` strings |
| InputNumber `stringMode` | `decimal` |
| Input `addonBefore`, `addonAfter` | `prefix`, `suffix` |
| Modal `okButtonProps={{ danger, disabled, loading }}`, `confirmLoading` | `okTone="danger"`, `okDisabled`, `okLoading` |
| Modal `destroyOnHidden` | Not needed: the content is always unmounted after closing |
| Modal `onOk(event)` closing the dialog | `onOk()`; set `open` to `false` yourself after success |
| Drawer `placement`, `footer`, `extra` | Not available: the drawer opens from the right; put the actions in the content |
| Dropdown menu `icon: <Icon />`, `onClick({ key, domEvent })`, submenus | `icon: 'name'`, `onClick({ key })`; no submenus |
| Alert `type="error"`, `message` | `tone="danger"`, `title` |
| Progress `type="circle"`, `status="exception"`, `showInfo` | `variant="circle"`, `status="error"`, `showValue` |
| `Table`, `TableProps`, `pagination` on the table | DataTable with your own columns; Pagination in `footer` |
| `Tag` | Pill |
| `Badge` | CountBadge, StatusDot, Avatar `status` |
| `Card` | Panel (Statistic for a figure, charts for a chart) |
| `Space`, `Flex`, `Row` / `Col` | Stack, Inline, Grid |
| `Empty`, `Result` | EmptyState, ErrorState |
| `Spin` | Loading, PageSkeleton, Skeleton |
| `Layout`, `Menu` | Page, SplitView; your application shell |
| `Typography.Text type="secondary"`, `code` | `<Text tone="secondary">`, `<Text mono>` |
| `Statistic` with `precision` | Statistic with `format` |
| `data-testid` on Drawer, Tree | `testId` |

The full list of changes, component by component, is in [MIGRATION.md](../../../MIGRATION.md).
