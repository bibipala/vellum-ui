/**
 * 选择器：Select 与 TreeSelect。
 * antd 只作为内部实现，对外的属性、选项与值的类型由本库声明（ADR 0021）。
 */
import { Select as AntSelect, TreeSelect as AntTreeSelect } from 'antd'
import type { FocusEvent, KeyboardEvent, ReactNode, Ref } from 'react'
import type { ControlSize } from './basic.tsx'
import styles from './inputs.module.css'
import { toAntSize, withInjected } from './internal.ts'

// antd 的属性类型与本库的声明在结构上兼容，但 antd 的泛型与重载让直接传递很繁琐：内部统一转成宽松的对象再交给 antd
type Loose = Record<string, unknown>

/**
 * Attributes shared by composite inputs (Select, TreeSelect, Cascader, AutoComplete, date and time pickers): the
 * id, accessible names, the test id and focus events.
 * @zh 复合输入组件（Select、TreeSelect、Cascader、AutoComplete、日期与时间选择）共有的属性：id、读屏名称、测试定位与焦点事件。
 */
export interface FieldAttributes {
  /**
   * Id of the input element, so that a `<label for>` can point to it (Form.Item sets it).
   * @zh 输入元素的 id，供 `<label for>` 指向（Form.Item 会设置）。
   */
  readonly id?: string
  /**
   * Accessible name, when there is no visible label.
   * @zh 读屏名称，没有可见的标签时提供。
   */
  readonly 'aria-label'?: string
  /**
   * Id of the element that labels the input.
   * @zh 作为标签的元素的 id。
   */
  readonly 'aria-labelledby'?: string
  /**
   * Id of the element that describes the input, such as a hint.
   * @zh 说明这个输入的元素（如提示文字）的 id。
   */
  readonly 'aria-describedby'?: string
  /**
   * Test id, output as `data-testid`.
   * @zh 测试定位，输出为 `data-testid`。
   */
  readonly 'data-testid'?: string
  /**
   * Focuses the input when it mounts.
   * @zh 挂载时聚焦。
   */
  readonly autoFocus?: boolean
  /**
   * Called when the input gets the focus.
   * @zh 获得焦点时调用。
   */
  readonly onFocus?: (event: FocusEvent<HTMLElement>) => void
  /**
   * Called when the input loses the focus.
   * @zh 失去焦点时调用。
   */
  readonly onBlur?: (event: FocusEvent<HTMLElement>) => void
  /**
   * Called on key presses in the input.
   * @zh 在输入框中按键时调用。
   */
  readonly onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void
}

/**
 * Handle of Select and TreeSelect: focus and blur.
 * @zh Select、TreeSelect 的句柄：聚焦与失焦。
 */
export interface SelectRef {
  /**
   * Focuses the input.
   * @zh 聚焦。
   */
  focus(): void
  /**
   * Removes the focus.
   * @zh 移除焦点。
   */
  blur(): void
}

/**
 * An option of Select.
 * @zh Select 的一个选项。
 */
export interface SelectOption<V> {
  /**
   * Value of the option.
   * @zh 选项的值。
   */
  readonly value: V
  /**
   * Text of the option, also shown in the field when selected.
   * @zh 选项的文字，选中后也显示在框中。
   */
  readonly label: ReactNode
  /**
   * The option cannot be selected.
   * @zh 选项不可选。
   */
  readonly disabled?: boolean
}

/**
 * A group of options of Select, with a heading.
 * @zh Select 的一组选项，带分组标题。
 */
export interface SelectOptionGroup<V> {
  /**
   * Heading of the group.
   * @zh 分组标题。
   */
  readonly label: ReactNode
  /**
   * Options in the group.
   * @zh 组内的选项。
   */
  readonly options: readonly SelectOption<V>[]
}

/** Select 与 TreeSelect 共有的属性。 */
interface PickerCommonProps extends FieldAttributes {
  /**
   * Text shown while nothing is selected.
   * @zh 没有选择时显示的文字。
   */
  readonly placeholder?: string
  /**
   * Lets the user type to filter the options by their text.
   * @zh 可以输入文字筛选选项。
   */
  readonly showSearch?: boolean
  /**
   * Disables the field.
   * @zh 禁用。
   */
  readonly disabled?: boolean
  /**
   * Shows a loading indicator, such as while the options are fetched.
   * @zh 显示加载指示，如正在获取选项时。
   */
  readonly loading?: boolean
  /**
   * Fills the width of the container. Inside Form.Item the field fills the width already; use it outside forms
   * when the field must be as wide as other inputs.
   * @zh 占满容器宽度。在 Form.Item 中本来就占满宽度；表单以外需要与其他输入框等宽时使用。
   */
  readonly block?: boolean
  /**
   * Size: `sm` in table rows and toolbars, `lg` for prominent forms. Without it, the size follows the density.
   * @zh 尺寸：`sm` 用于表格行内与工具栏，`lg` 用于醒目的表单。省略时随密度。
   */
  readonly size?: ControlSize
  /**
   * Appearance: `filled` (neutral background, the default) or `borderless`.
   * @zh 外观：`filled` 填充式（中性底，默认）或 `borderless` 无底色。
   * @default 'filled'
   */
  readonly variant?: 'filled' | 'borderless'
  /**
   * Validation status, usually set by Form.Item.
   * @zh 校验状态，通常由 Form.Item 设置。
   */
  readonly status?: 'error' | 'warning'
  /**
   * The list of options is open (controlled).
   * @zh 选项列表是否打开（受控）。
   */
  readonly open?: boolean
  /**
   * The list of options is open initially.
   * @zh 选项列表初始是否打开。
   */
  readonly defaultOpen?: boolean
  /**
   * Called when the list of options opens or closes.
   * @zh 选项列表打开或关闭时调用。
   */
  readonly onOpenChange?: (open: boolean) => void
  /**
   * Handle of the field.
   * @zh 选择器的句柄。
   */
  readonly ref?: Ref<SelectRef>
}

/** Select 单选与多选共有的属性。 */
interface SelectCommonProps<V> extends PickerCommonProps {
  /**
   * The options, optionally in groups.
   * @zh 选项，可以分组。
   */
  readonly options?: readonly (SelectOption<V> | SelectOptionGroup<V>)[]
  /**
   * Called when an option is chosen, even if it was already selected (unlike `onChange`).
   * @zh 选择一个选项时调用，即使它本来就是选中的（与 `onChange` 不同）。
   */
  readonly onSelect?: (value: V) => void
  /**
   * The list of options is as wide as the field (`true`, the default) or as wide as its content (`false`).
   * @zh 选项列表与框同宽（`true`，默认）或按内容宽度（`false`）。
   * @default true
   */
  readonly popupMatchSelectWidth?: boolean
  /**
   * Content before the selection, inside the field, such as an icon.
   * @zh 选中内容前面、框内的内容，如图标。
   */
  readonly prefix?: ReactNode
}

/**
 * Single selection (default)
 * `value` is one value. There is no clear button, so `onChange` always receives the value of an option.
 * @zh 单选（默认）
 * `value` 是一个值。没有清除按钮，`onChange` 收到的总是某个选项的值。
 */
interface SelectSingleProps<V> extends SelectCommonProps<V> {
  /**
   * Shows a clear button while something is selected; `onChange` then receives `null` when cleared.
   * @zh 有选中内容时显示清除按钮；清除时 `onChange` 收到 `null`。
   */
  readonly allowClear?: false
  /**
   * Allows selecting several options; the value becomes an array.
   * @zh 可以选择多个选项，值变为数组。
   */
  readonly multiple?: false
  /**
   * Value of the selected option (controlled); `null` or `undefined` when nothing is selected.
   * @zh 选中的选项的值（受控）；没有选择时为 `null` 或 `undefined`。
   */
  readonly value?: V | null
  /**
   * Initially selected value (uncontrolled).
   * @zh 初始选中的值（非受控）。
   */
  readonly defaultValue?: V | null
  /**
   * Called with the new value.
   * @zh 值变化时调用。
   */
  readonly onChange?: (value: V) => void
}

/**
 * Single selection that can be cleared: `allowClear`
 * `value` is one value; a clear button appears while something is selected, and `onChange` receives `null` when
 * the field is cleared.
 * @zh 可以清除的单选：`allowClear`
 * `value` 是一个值；有选中内容时显示清除按钮，清除时 `onChange` 收到 `null`。
 */
interface SelectClearableProps<V> extends SelectCommonProps<V> {
  /**
   * Shows a clear button while something is selected; `onChange` then receives `null` when cleared.
   * @zh 有选中内容时显示清除按钮；清除时 `onChange` 收到 `null`。
   */
  readonly allowClear: boolean
  /**
   * Allows selecting several options; the value becomes an array.
   * @zh 可以选择多个选项，值变为数组。
   */
  readonly multiple?: false
  /**
   * Value of the selected option (controlled); `null` or `undefined` when nothing is selected.
   * @zh 选中的选项的值（受控）；没有选择时为 `null` 或 `undefined`。
   */
  readonly value?: V | null
  /**
   * Initially selected value (uncontrolled).
   * @zh 初始选中的值（非受控）。
   */
  readonly defaultValue?: V | null
  /**
   * Called with the new value; `null` when cleared.
   * @zh 值变化时调用；清除时为 `null`。
   */
  readonly onChange?: (value: V | null) => void
}

/**
 * Multiple selection: `multiple`
 * `value` is an array; the selected options are shown as tags in the field, and `onChange` receives the array of
 * values in the order they were selected (an empty array when all are removed).
 * @zh 多选：`multiple`
 * `value` 是数组；选中的选项以标签显示在框中，`onChange` 收到按选择先后排列的值数组（全部移除时为空数组）。
 */
interface SelectMultipleProps<V> extends SelectCommonProps<V> {
  /**
   * Shows a clear button while something is selected.
   * @zh 有选中内容时显示清除按钮。
   */
  readonly allowClear?: boolean
  /**
   * Allows selecting several options; the value becomes an array.
   * @zh 可以选择多个选项，值变为数组。
   */
  readonly multiple: true
  /**
   * Values of the selected options (controlled).
   * @zh 选中的选项的值（受控）。
   */
  readonly value?: readonly V[] | null
  /**
   * Initially selected values (uncontrolled).
   * @zh 初始选中的值（非受控）。
   */
  readonly defaultValue?: readonly V[] | null
  /**
   * Called with the new values.
   * @zh 值变化时调用。
   */
  readonly onChange?: (value: V[]) => void
}

/**
 * Props of Select: one value by default, an array of values with `multiple`.
 * @zh Select 属性：默认选择一个值，`multiple` 时选择多个值（数组）。
 */
export type SelectProps<V = string> =
  | SelectSingleProps<V>
  | SelectClearableProps<V>
  | SelectMultipleProps<V>

/**
 * Selects one or several (`multiple`) values from a list of options; add `showSearch` when there are many
 * options.
 * @zh 选择器：从一组选项中选择一个或多个（`multiple`），选项多时加 `showSearch`。
 * @category Basic
 * @usage Filters, enumerated form fields, choosing members and roles
 * @usageZh 筛选条件、表单中的枚举字段、成员与角色选择
 */
export function Select<V = string>(props: SelectProps<V>) {
  const { block, size, multiple, value, defaultValue, onChange, ...rest } = props
  return (
    <AntSelect
      {...(rest as Loose)}
      // 清除时 antd 给 undefined；本库的「没有值」一律是 null（与 DatePicker、InputNumber 一致）
      onChange={
        onChange ? (v: unknown) => (onChange as (v: unknown) => void)(v ?? null) : undefined
      }
      // 受控时 null 表示「没有选择」；antd 的单选用 undefined 才显示占位文字
      value={value === null ? undefined : (value as unknown)}
      defaultValue={defaultValue === null ? undefined : (defaultValue as unknown)}
      mode={multiple ? 'multiple' : undefined}
      size={toAntSize(size)}
      // 选项按文字筛选：antd 默认按 value 筛选，界面上看到的是文字
      optionFilterProp="label"
      className={withInjected(block ? styles.block : undefined, rest)}
    />
  )
}

// —— TreeSelect ——

/**
 * A node of TreeSelect.
 * @zh TreeSelect 的一个节点。
 */
export interface TreeSelectOption<V> {
  /**
   * Value of the node.
   * @zh 节点的值。
   */
  readonly value: V
  /**
   * Text of the node.
   * @zh 节点的文字。
   */
  readonly title: ReactNode
  /**
   * Child nodes.
   * @zh 子节点。
   */
  readonly children?: readonly TreeSelectOption<V>[]
  /**
   * The node cannot be selected or checked.
   * @zh 节点不可选、不可勾选。
   */
  readonly disabled?: boolean
  /**
   * The node can be expanded but not selected, such as a group heading.
   * @zh 节点可以展开但不能选择，如分组标题。
   */
  readonly selectable?: boolean
}

/** TreeSelect 单选与多选共有的属性。 */
interface TreeSelectCommonProps<V> extends PickerCommonProps {
  /**
   * The tree of nodes.
   * @zh 节点树。
   */
  readonly options: readonly TreeSelectOption<V>[]
  /**
   * Expands all nodes when the list opens.
   * @zh 打开时展开全部节点。
   */
  readonly defaultExpandAll?: boolean
}

/**
 * Single selection (default)
 * `value` is the value of one node. There is no clear button, so `onChange` always receives the value of a node.
 * @zh 单选（默认）
 * `value` 是一个节点的值。没有清除按钮，`onChange` 收到的总是某个节点的值。
 */
interface TreeSelectSingleProps<V> extends TreeSelectCommonProps<V> {
  /**
   * Shows a clear button while something is selected; `onChange` then receives `null` when cleared.
   * @zh 有选中内容时显示清除按钮；清除时 `onChange` 收到 `null`。
   */
  readonly allowClear?: false
  /**
   * Allows selecting several nodes; the value becomes an array.
   * @zh 可以选择多个节点，值变为数组。
   */
  readonly multiple?: false
  /**
   * With `multiple`, shows a checkbox in front of each node; checking a parent checks its children.
   * @zh 与 `multiple` 一起使用：每个节点前显示复选框，勾选父节点会勾选其子节点。
   */
  readonly checkable?: false
  /**
   * With `checkable`: which checked nodes the field shows — `all`, only the `parent` when all its children are
   * checked, or only the `child` nodes.
   * @zh 与 `checkable` 一起使用：框中显示哪些勾选的节点——全部（`all`）、子节点全选时只显示父节点（`parent`）、只显示子节点（`child`）。
   */
  readonly showChecked?: undefined
  /**
   * Value of the selected node (controlled).
   * @zh 选中的节点的值（受控）。
   */
  readonly value?: V | null
  /**
   * Initially selected value (uncontrolled).
   * @zh 初始选中的值（非受控）。
   */
  readonly defaultValue?: V | null
  /**
   * Called with the new value.
   * @zh 值变化时调用。
   */
  readonly onChange?: (value: V) => void
}

/**
 * Single selection that can be cleared: `allowClear`
 * `value` is the value of one node; a clear button appears while something is selected, and `onChange` receives
 * `null` when the field is cleared.
 * @zh 可以清除的单选：`allowClear`
 * `value` 是一个节点的值；有选中内容时显示清除按钮，清除时 `onChange` 收到 `null`。
 */
interface TreeSelectClearableProps<V> extends TreeSelectCommonProps<V> {
  /**
   * Shows a clear button while something is selected; `onChange` then receives `null` when cleared.
   * @zh 有选中内容时显示清除按钮；清除时 `onChange` 收到 `null`。
   */
  readonly allowClear: boolean
  /**
   * Allows selecting several nodes; the value becomes an array.
   * @zh 可以选择多个节点，值变为数组。
   */
  readonly multiple?: false
  /**
   * With `multiple`, shows a checkbox in front of each node; checking a parent checks its children.
   * @zh 与 `multiple` 一起使用：每个节点前显示复选框，勾选父节点会勾选其子节点。
   */
  readonly checkable?: false
  /**
   * With `checkable`: which checked nodes the field shows — `all`, only the `parent` when all its children are
   * checked, or only the `child` nodes.
   * @zh 与 `checkable` 一起使用：框中显示哪些勾选的节点——全部（`all`）、子节点全选时只显示父节点（`parent`）、只显示子节点（`child`）。
   */
  readonly showChecked?: undefined
  /**
   * Value of the selected node (controlled).
   * @zh 选中的节点的值（受控）。
   */
  readonly value?: V | null
  /**
   * Initially selected value (uncontrolled).
   * @zh 初始选中的值（非受控）。
   */
  readonly defaultValue?: V | null
  /**
   * Called with the new value; `null` when cleared.
   * @zh 值变化时调用；清除时为 `null`。
   */
  readonly onChange?: (value: V | null) => void
}

/**
 * Multiple selection: `multiple`
 * `value` is an array of node values, shown as tags in the field. Add `checkable` for checkboxes, where checking a
 * parent checks all its children; `showChecked` then decides which of the checked nodes are shown and included in
 * the value.
 * @zh 多选：`multiple`
 * `value` 是节点值的数组，以标签显示在框中。加 `checkable` 显示复选框，勾选父节点即勾选它的全部子节点；此时
 * `showChecked` 决定显示哪些勾选的节点、哪些进入值。
 */
interface TreeSelectMultipleProps<V> extends TreeSelectCommonProps<V> {
  /**
   * Shows a clear button while something is selected.
   * @zh 有选中内容时显示清除按钮。
   */
  readonly allowClear?: boolean
  /**
   * Allows selecting several nodes; the value becomes an array.
   * @zh 可以选择多个节点，值变为数组。
   */
  readonly multiple: true
  /**
   * Shows a checkbox in front of each node; checking a parent checks its children.
   * @zh 每个节点前显示复选框，勾选父节点会勾选其子节点。
   */
  readonly checkable?: boolean
  /**
   * With `checkable`: which checked nodes the field shows — `all`, only the `parent` when all its children are
   * checked, or only the `child` nodes.
   * @zh 与 `checkable` 一起使用：框中显示哪些勾选的节点——全部（`all`）、子节点全选时只显示父节点（`parent`）、只显示子节点（`child`）。
   * @default 'child'
   */
  readonly showChecked?: 'all' | 'parent' | 'child'
  /**
   * Values of the selected nodes (controlled).
   * @zh 选中的节点的值（受控）。
   */
  readonly value?: readonly V[] | null
  /**
   * Initially selected values (uncontrolled).
   * @zh 初始选中的值（非受控）。
   */
  readonly defaultValue?: readonly V[] | null
  /**
   * Called with the new values.
   * @zh 值变化时调用。
   */
  readonly onChange?: (value: V[]) => void
}

/**
 * Props of TreeSelect: one node by default, several with `multiple`.
 * @zh TreeSelect 属性：默认选择一个节点，`multiple` 时选择多个。
 */
export type TreeSelectProps<V = string> =
  | TreeSelectSingleProps<V>
  | TreeSelectClearableProps<V>
  | TreeSelectMultipleProps<V>

const SHOW_CHECKED = { all: 'SHOW_ALL', parent: 'SHOW_PARENT', child: 'SHOW_CHILD' } as const

/**
 * Selects nodes from hierarchical data such as teams or folders. With `multiple`, several nodes can be selected,
 * and `checkable` adds checkboxes; `showChecked` decides which checked nodes the field shows.
 * @zh 树选择：从树形数据（团队、文件夹）中选择节点。`multiple` 时可选多个，`checkable` 显示复选框，`showChecked`
 * 决定框中显示哪些勾选的节点。
 * @category Basic
 * @usage Choosing a team, a parent folder or a category
 * @usageZh 选择团队、上级文件夹、分类
 */
export function TreeSelect<V = string>(props: TreeSelectProps<V>) {
  const {
    block,
    size,
    options,
    defaultExpandAll,
    multiple,
    checkable,
    showChecked,
    value,
    defaultValue,
    onChange,
    ...rest
  } = props
  return (
    <AntTreeSelect
      {...(rest as Loose)}
      onChange={
        onChange ? (v: unknown) => (onChange as (v: unknown) => void)(v ?? null) : undefined
      }
      value={value === null ? undefined : (value as unknown)}
      defaultValue={defaultValue === null ? undefined : (defaultValue as unknown)}
      treeData={options as unknown as Loose[]}
      treeDefaultExpandAll={defaultExpandAll}
      multiple={multiple}
      treeCheckable={checkable}
      // 静态成员（AntTreeSelect.SHOW_PARENT 等）的值就是这些字符串；不在模块顶层读取它们，以免打包工具保留整个 TreeSelect
      showCheckedStrategy={showChecked ? SHOW_CHECKED[showChecked] : undefined}
      // 按节点文字筛选（antd 默认按 value）
      treeNodeFilterProp="title"
      size={toAntSize(size)}
      className={withInjected(block ? styles.block : undefined, rest)}
    />
  )
}
