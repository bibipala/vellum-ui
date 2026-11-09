[English](../../en-US/guides/conventions.md) | **简体中文**

# 接口约定

vellum-ui 使用独立的公共 API，包括内部基于 Ant Design 实现的组件。本指南说明通用属性、值格式、回调、无障碍属性与本地化约定，并提供常见接口的 Ant Design 对照表。

## 命名

### 尺寸：`sm`、`md`、`lg`

控件接收 `size: 'sm' | 'md' | 'lg'`（类型 `ControlSize`）：Button、IconButton、Input 及其变体、InputNumber、Select、TreeSelect、Cascader、AutoComplete、DatePicker、TimePicker、ColorPicker、Radio.Group（按钮样式）、Segmented、Pagination、Descriptions、Progress。省略 `size` 时控件随 ThemeProvider 的密度（舒适或紧凑）变化。表格行内、工具栏、面板标题行中用 `sm`，醒目的表单用 `lg`。

有些组件的档位更少：Switch、Steps、CopyButton、Sparkline、EmptyState、ErrorState 取 `sm` 或 `md`；Statistic 取 `md` 或 `lg`。Text 取字号档位（`2xs`、`xs`、`sm`、`md`、`lg`、`xl`）。Avatar 与 Icon 的尺寸是像素数。

### 色调：语义色

`tone` 表达语义色，常见取值包括 `neutral`、`accent`、`success`、`warning`、`danger`、`info`。各组件支持的取值如下：

| 组件 | `tone` |
| --- | --- |
| Button | `danger`（可与任意 `variant` 组合） |
| LinkButton | `accent`（默认）、`danger` |
| Modal、Popconfirm | 确认按钮用 `okTone="danger"` |
| Pill、Timeline 的事件 | `neutral`、`accent`、`success`、`warning`、`danger`、`info` |
| Alert | `info`（默认）、`success`、`warning`、`danger` |
| Progress | `accent`、`success`、`warning`、`danger`（量表；到 100% 时保持原来的色调） |
| StatusDot、Avatar 的 `status` | `success`、`warning`、`danger`、`neutral`、`accent` |
| CountBadge | `neutral`（默认）、`accent` |
| Text | `primary`、`secondary`、`tertiary`，以及 `accent`、`danger`、`warning`、`success` |
| Icon | `inherit`（默认）、`secondary`、`tertiary`、`accent`、`danger`、`success`、`warning` |

菜单项等数据对象可以使用 `danger: true` 等布尔字段，具体以对应的数据接口为准。

### 外观：variant

`variant` 选择外观，从不表达含义：

| 组件 | `variant` |
| --- | --- |
| Button | `primary`（每个区域一个）、`default`、`dashed`、`text` |
| IconButton | `ghost`（默认）、`soft`、`accent` |
| Input、Select、TreeSelect、Cascader、AutoComplete、DatePicker、TimePicker | `filled`（默认）、`borderless` |
| Radio.Group | `default`、`button` |
| Progress | `line`（默认）、`circle` |
| PageSkeleton | `list`、`detail`、`split` |
| SplitView | `panel`（默认）、`flush` |
| SegmentedBar | `thin`、`tall`（必填） |

### 原生名称保持原生含义

与原生属性同名的属性，含义与 HTML 中相同。Button 的 `type` 取 `'button'`（默认值，与裸的 `<button>` 不同）、`'submit'` 或 `'reset'`；Input 的 `type` 是 `email`、`url` 等原生输入类型。

```tsx
<Button variant="primary" type="submit">Save</Button>
```

### 校验状态

输入组件与 Form.Item 接收 `status`，它是校验状态，不是色调：输入组件取 `'error' | 'warning'`，Form.Item 还可以取 `'success' | 'validating'`。Form.Item 会根据 `rules` 给它的控件设置状态；只有在别处完成的校验（如服务端）才需要自己设置：

```tsx
<Form.Item label="Name" name="name" status={taken ? 'error' : undefined} help={taken ? 'This name is already in use' : undefined}>
  <Input />
</Form.Item>
```

规则的 `validator` 接收字段值，返回错误消息；值有效时返回 `undefined`。异步校验返回解析为上述结果的 Promise：`validator: async (value) => (await exists(value) ? 'Already taken' : undefined)`。

## 取值与变化回调

受控输入使用 `value` 与变更回调，非受控输入使用 `defaultValue`。**值类控件的 `onChange` 接收值；Input 及其变体的 `onChange` 接收原生变更事件。**

| 控件 | `value` | `onChange` 收到 |
| --- | --- | --- |
| Input、Input.Password、Input.Search、Input.TextArea | `string` | `ChangeEvent`（`e.target.value`） |
| Input.Search | | 按 `Enter` 与清除时调用 `onSearch(value, { source })` |
| AutoComplete、PromptInput | `string` | 文字 |
| Checkbox、Switch | `checked: boolean` | `checked` |
| Checkbox.Group | `V[]` | `V[]` |
| Radio.Group、Segmented | `V` | `V` |
| Select | `V \| null`；`multiple` 时 `V[]` | 值；带 `allowClear` 的单选清除时收到 `null` |
| TreeSelect | `V \| null`；`multiple` 时 `V[]` | 值或值的数组 |
| Cascader | 路径 `V[] \| null`；`multiple` 时 `V[][]` | 路径或路径的数组 |
| InputNumber | `number \| null`；`decimal` 时 `string \| null` | 同左 |
| Slider | `number`；`range` 时 `[number, number]` | 同左（另有 `onChangeComplete`） |
| DatePicker、TimePicker | `string \| null`（ISO） | 同左 |
| DatePicker.RangePicker、TimePicker.RangePicker | `[string, string] \| null` | 同左 |
| ColorPicker | 十六进制 `string` | 小写的十六进制 |
| Tabs | `activeKey`（受控）或 `defaultActiveKey`：标签的 `key` | `onChange(key)` |
| Pagination | `current` | `onChange(page, pageSize)` |

Form.Item 向字段控件提供 `value` 与 `onChange`，控件上无需重复设置。Checkbox 与 Switch 需在 Form.Item 上设置 `valuePropName="checked"`。

选项是普通对象：Select（分组为 `{ label, options }`）、Checkbox.Group、Radio.Group、Segmented 用 `{ value, label, disabled }`；TreeSelect 用 `{ value, title, children, disabled, selectable }`；Cascader 用 `{ value, label, children, disabled }`。Select、TreeSelect、Cascader、Checkbox.Group 以值的类型为类型参数（默认 `string`）；Segmented 会推断，也可以显式写出：`<Segmented<Range> … />`。

### 「没有值」是 `null`

Select、TreeSelect、Cascader、InputNumber、DatePicker、TimePicker 用 `null` 表示「没有值」，`value`、`defaultValue` 与 `onChange` 中都是。文本输入（包括 AutoComplete）用空字符串 `''`。

```tsx
const [status, setStatus] = useState<Status | null>(null)
<Select allowClear options={STATUS_OPTIONS} value={status} onChange={setStatus} />
```

### 日期与时间是 ISO 字符串

日期与时间的值均为 ISO 字符串，可直接存储或传输。`format` 仅影响显示格式。

| 选择器 | 值 |
| --- | --- |
| DatePicker | `'2026-11-07'` |
| DatePicker `picker="month"` | `'2026-11'` |
| DatePicker `picker="year"` | `'2026'` |
| DatePicker `showTime` | `'2026-11-07T14:30:00+08:00'`（本地时区偏移） |
| TimePicker | `'14:30:00'`；`format` 不含秒（`format="HH:mm"`）时为 `'14:30'` |
| RangePicker（两种） | 同样格式的 `[开始, 结束]` |

`disabledDate` 收到 `'YYYY-MM-DD'` 格式的日期，ISO 日期可以直接按字符串比较：`disabledDate={(date) => date < today}`。

### 小数是字符串

金额等精确数值，InputNumber 加 `decimal`：值、`min`、`max`、`step` 都是十进制字符串，值不经过浮点。

```tsx
<InputNumber decimal min="0" step="0.01" precision={2} value={price} onChange={setPrice} />
// price: string | null，如 "1280.50"
```

不加 `decimal` 时值是 `number`（天数、端口、计数）。

### 颜色是十六进制字符串

ColorPicker 接收十六进制字符串（`'#2d6bf3'`），新颜色以小写的十六进制传出，不透明时不带透明度，否则带上（`'#2d6bf380'`）。

## 弹层开关

可以受控的弹层接收 `open`、`onOpenChange(open)`，有些还接收 `defaultOpen`：Dropdown、Popover（也有 `defaultOpen`）、Select 与 TreeSelect（也有 `defaultOpen`）、ColorPicker、ContextMenu（只有 `onOpenChange`）、CommandPalette（`open` 与 `onOpenChange` 必填），以及 Image 的预览（`preview={{ open, onOpenChange }}`）。

Modal、Drawer 与 Lightbox 均为受控组件。Modal 提供 `open`、`onOk`、`onCancel`；Drawer 与 Lightbox 提供 `open`、`onClose`。应用需将 `open` 设为 `false` 才能关闭弹层。在 `onOk` 中，应等待操作成功后再关闭。

Modal 关闭后卸载内容；Drawer 保留内容。Modal 外持有的状态（包括页面级的 `Form.useForm()` 实例）会保留。如需每次新建表单都恢复 `initialValues`，应在 Form 仍挂载时调用 `form.resetFields()`：取消或提交成功后、`setOpen(false)` 之前。不要在首次挂载前重置，此时实例尚未连接。见[表单弹窗配方](../recipes/FormDialog.md)。

Tooltip 与 Popconfirm 是非受控的。

## 原生属性、ref 与测试定位

- **渲染一个主要元素的组件**接收这个元素的原生属性（`id`、`aria-*`、`data-*`、`onClick` 等事件处理函数），`style` 与 `className` 除外；它们的 ref 指向原生元素或组件库声明的句柄：

  | 组件 | 原生属性来自 | ref |
  | --- | --- | --- |
  | Button | `<button>` | `HTMLButtonElement`（有 `href` 时是 `HTMLAnchorElement`） |
  | IconButton、LinkButton | `<button>` | |
  | Input、Input.Password、Input.Search | `<input>` | `InputRef`：`focus({ cursor })`、`blur()`、`select()`、`input` |
  | Input.TextArea | `<textarea>` | `TextAreaRef`：`focus()`、`blur()`、`textarea` |
  | InputNumber | `<input>` | `InputNumberRef`：`focus()`、`blur()`、`nativeElement` |
  | Checkbox、Radio | `<input>` | `HTMLInputElement` |
  | Switch | `<button role="switch">` | `HTMLButtonElement` |
  | Segmented | `<div>` | `HTMLDivElement` |
  | Checkbox.Group、Radio.Group | `<div>` | |
  | Form | `<form>` | `HTMLFormElement` |

- **复合输入组件**（Select、TreeSelect、Cascader、AutoComplete、DatePicker、TimePicker）只接收 `id`、`aria-label`、`aria-labelledby`、`aria-describedby`、`data-testid`、`autoFocus`、`onFocus`、`onBlur`、`onKeyDown`（类型 `FieldAttributes`）。Select 与 TreeSelect 接收 `SelectRef` 类型的 ref（`focus()`、`blur()`），其他的不接收 ref。
- **布局组件、模式组件与大多数展示组件**（Stack、Page、Panel、DataTable、EmptyState、ListItem、图表等）接收 `testId`（输出为 `data-testid`）、`aria-label`、`role`、`id`。
- **弹层与容器**（Modal、Drawer、Dropdown、Tooltip、Popover、Popconfirm、Alert、Descriptions、Tabs、Pagination、Timeline、Steps、Breadcrumb、App、Image）不接收原生属性，也不接收 ref。Drawer 与 Tree 接收 `testId`；Modal 的确认按钮用 `okTestId`，没有标题时用 `aria-label`。测试中按角色与读屏名称查找其他组件，或者用带 `testId` 的 Box 包住它们。

各组件的参考页列出了支持的原生属性与 ref。

## 组件库自身的文字

组件库文案（空状态、操作标签、选择器与分页标签、默认无障碍名称）随 ThemeProvider 的 `locale` 切换：`'en-US'`（默认）、`'zh-CN'` 或自定义文本表。缺少的键回退到英文，`messages` 可覆盖单个条目。切换 `locale` 同时切换所封装的 Ant Design 组件语言与 dayjs 的全局语言。应用文案由应用的翻译提供。

## 如果你熟悉 Ant Design

迁移 Ant Design 代码时，使用下表中的 vellum-ui API。大部分不支持的 Ant Design 属性会被 TypeScript 拒绝。

| Ant Design API | vellum-ui API |
| --- | --- |
| `import { … } from 'antd'`、`@ant-design/icons`、`lucide-react` | 全部从 `vellum-ui` 导入；图标按名称引用：`<Icon name="trash" />`，凡是有 `icon` 属性的组件（Button、IconButton、LinkButton、Pill、EmptyState、Avatar、Segmented 的选项、菜单项）都写 `icon="trash"` |
| `<ConfigProvider theme={…}>` | `<ThemeProvider theme={extendTheme(defaultTheme, { … })}>` |
| 静态调用 `message.success()`、`Modal.confirm()`；`App.useApp()` | 在 `<App>` 之内用 `useMessage()` 与 `useConfirmDanger()` |
| `style`、`className`、`classNames`、`styles` | 语义参数；用 Stack、Inline、Grid、Box 排版 |
| `size="small"`、`"middle"`、`"large"` | `size="sm"`、`"md"`、`"lg"` |
| Button 的 `type="primary"`、`"dashed"`、`"text"` | `variant="primary"`、`"dashed"`、`"text"` |
| Button 的 `type="link"` | LinkButton |
| Button 的 `danger` | `tone="danger"` |
| Button 的 `htmlType="submit"` | `type="submit"` |
| Button 的 `loading={{ delay }}` | `loading`（布尔值） |
| Button 的 `shape`、`ghost`、`iconPosition`；只有图标的 Button | 带 `icon` 与 `label` 的 IconButton |
| Form.Item 的 `validateStatus` | `status` |
| 规则 `validator: (rule, value) => Promise.reject(new Error(text))` | `validator: (value) => text`（或解析为它的 Promise） |
| `Form.List`、`Form.useWatch`、`dependencies`、`shouldUpdate` | 自己的状态；`onValuesChange`；在 `validator` 中用 `form.getFieldValue(name)` |
| Checkbox 的 `onChange={(e) => set(e.target.checked)}` | `onChange={set}` |
| Radio.Group 的 `onChange={(e) => set(e.target.value)}`、`optionType="button"` | `onChange={set}`、`variant="button"` |
| Select 的 `mode="multiple"` | `multiple` |
| Select 的 `mode="tags"`、`labelInValue`、`filterOption`、`optionRender` | 不提供；`showSearch` 按文字筛选 |
| `onChange(value, option)` | `onChange(value)` |
| Select、InputNumber 为空时的 `undefined` | `null` |
| TreeSelect 的 `treeData`、`treeCheckable`、`showCheckedStrategy` | `options`、`multiple checkable`、`showChecked="parent"` |
| DatePicker、TimePicker 的 dayjs 值 | ISO 字符串：`'2026-11-07'`、`'14:30'` |
| `onChange(date, dateString)` | `onChange(value)` |
| `disabledDate={(d) => d.isBefore(dayjs())}` | `disabledDate={(date) => date < today}`，比较 `'YYYY-MM-DD'` 字符串 |
| InputNumber 的 `stringMode` | `decimal` |
| Input 的 `addonBefore`、`addonAfter` | `prefix`、`suffix` |
| Modal 的 `okButtonProps={{ danger, disabled, loading }}`、`confirmLoading` | `okTone="danger"`、`okDisabled`、`okLoading` |
| Modal 的 `destroyOnHidden` | 不需要：关闭后内容总是卸载 |
| 由 `onOk(event)` 关闭对话框 | `onOk()`；成功后自己把 `open` 设为 `false` |
| Drawer 的 `placement`、`footer`、`extra` | 不提供：抽屉从右侧滑出；操作放在内容中 |
| Dropdown 菜单项的 `icon: <Icon />`、`onClick({ key, domEvent })`、子菜单 | `icon: '图标名'`、`onClick({ key })`；没有子菜单 |
| Alert 的 `type="error"`、`message` | `tone="danger"`、`title` |
| Progress 的 `type="circle"`、`status="exception"`、`showInfo` | `variant="circle"`、`status="error"`、`showValue` |
| `Table`、`TableProps`、表格上的 `pagination` | 用自己的列定义的 DataTable；Pagination 放在 `footer` |
| `Tag` | Pill |
| `Badge` | CountBadge、StatusDot、Avatar 的 `status` |
| `Card` | Panel（数字用 Statistic，图表用图表组件） |
| `Space`、`Flex`、`Row` / `Col` | Stack、Inline、Grid |
| `Empty`、`Result` | EmptyState、ErrorState |
| `Spin` | Loading、PageSkeleton、Skeleton |
| `Layout`、`Menu` | 应用框架用 AppShell 与 Nav；页面用 Page、SplitView |
| `Typography.Text type="secondary"`、`code` | `<Text tone="secondary">`、`<Text mono>` |
| 带 `precision` 的 `Statistic` | 带 `format` 的 Statistic |
| Drawer、Tree 上的 `data-testid` | `testId` |

逐个组件的完整变化见 [MIGRATION.md](../../../MIGRATION.md)。
