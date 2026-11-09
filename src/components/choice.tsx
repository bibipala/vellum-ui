/**
 * 选择类控件：Checkbox、Radio、Switch、Segmented。
 * antd 只作为内部实现，对外的属性由本库声明（ADR 0021）：值类控件的 `onChange` 直接收到新值。
 */
import {
  Checkbox as AntCheckbox,
  Radio as AntRadio,
  Segmented as AntSegmented,
  Switch as AntSwitch,
} from 'antd'
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  JSX,
  MouseEvent,
  ReactNode,
  Ref,
} from 'react'
import type { ControlSize } from './basic.tsx'
import { Icon, type IconName } from './Icon.tsx'
import { type NativeProps, toAntSize } from './internal.ts'

// antd 的属性类型与本库的声明在结构上兼容，但 antd 的泛型与重载让直接传递很繁琐：内部统一转成宽松的对象再交给 antd
type Loose = Record<string, unknown>

/**
 * An option of Checkbox.Group, Radio.Group or Segmented.
 * @zh Checkbox.Group、Radio.Group、Segmented 的一个选项。
 */
export interface ChoiceOption<V> {
  /**
   * Value of the option.
   * @zh 选项的值。
   */
  readonly value: V
  /**
   * Text of the option.
   * @zh 选项的文字。
   */
  readonly label: ReactNode
  /**
   * The option cannot be chosen.
   * @zh 选项不可选。
   */
  readonly disabled?: boolean
}

// —— Checkbox ——

/** Checkbox 自有的属性。 */
interface CheckboxOwnProps {
  /**
   * Checked (controlled).
   * @zh 是否勾选（受控）。
   */
  readonly checked?: boolean
  /**
   * Initially checked (uncontrolled).
   * @zh 初始是否勾选（非受控）。
   */
  readonly defaultChecked?: boolean
  /**
   * Partly checked, such as a "select all" box when only some items are selected. Only the appearance changes;
   * `checked` still decides the value.
   * @zh 部分勾选，如只选中了一部分时的「全选」框。只改变外观，值仍由 `checked` 决定。
   */
  readonly indeterminate?: boolean
  /**
   * Called with the new checked state.
   * @zh 勾选状态变化时调用，参数是新的勾选状态。
   */
  readonly onChange?: (checked: boolean) => void
  /**
   * Label next to the box; clicking it toggles the box.
   * @zh 复选框旁边的文字，点击它也会切换勾选。
   */
  readonly children?: ReactNode
  /**
   * The native `<input type="checkbox">`.
   * @zh 原生的 `<input type="checkbox">`。
   */
  readonly ref?: Ref<HTMLInputElement>
}

/**
 * Props of Checkbox.
 * @zh Checkbox 属性。
 */
export interface CheckboxProps
  extends CheckboxOwnProps,
    Omit<NativeProps<InputHTMLAttributes<HTMLInputElement>, CheckboxOwnProps>, 'type' | 'color'> {}

/** Checkbox.Group 自有的属性。 */
interface CheckboxGroupOwnProps<V> {
  /**
   * The options: plain values (shown as text) or option objects.
   * @zh 选项：直接是值（显示为文字），或选项对象。
   */
  readonly options: readonly (V | ChoiceOption<V>)[]
  /**
   * Values of the checked options (controlled).
   * @zh 已勾选的选项的值（受控）。
   */
  readonly value?: readonly V[]
  /**
   * Initially checked values (uncontrolled).
   * @zh 初始勾选的值（非受控）。
   */
  readonly defaultValue?: readonly V[]
  /**
   * Called with the values of the checked options, in the order of `options`.
   * @zh 勾选变化时调用，参数是已勾选的选项的值，按 `options` 的顺序。
   */
  readonly onChange?: (value: V[]) => void
  /**
   * Disables all options.
   * @zh 禁用全部选项。
   */
  readonly disabled?: boolean
  /**
   * Name of the native checkboxes, for form submission.
   * @zh 原生复选框的 name，用于表单提交。
   */
  readonly name?: string
}

/**
 * Props of Checkbox.Group.
 * @zh Checkbox.Group 属性。
 */
export interface CheckboxGroupProps<V = string>
  extends CheckboxGroupOwnProps<V>,
    Omit<
      NativeProps<HTMLAttributes<HTMLDivElement>, CheckboxGroupOwnProps<V>>,
      'defaultChecked' | 'color'
    > {}

function CheckboxRoot({ onChange, ...rest }: CheckboxProps) {
  return (
    <AntCheckbox
      {...(rest as Loose)}
      onChange={onChange ? (e) => onChange(e.target.checked) : undefined}
    />
  )
}

function CheckboxGroup<V = string>({ options, onChange, ...rest }: CheckboxGroupProps<V>) {
  return (
    <AntCheckbox.Group<V>
      {...(rest as Loose)}
      options={options as ChoiceOption<V>[]}
      onChange={onChange ? (values) => onChange(values) : undefined}
    />
  )
}

/**
 * Checkbox and its static members.
 * @zh Checkbox 及其静态成员。
 */
export interface CheckboxComponent {
  /**
   * Renders a single checkbox.
   * @zh 渲染单个复选框。
   */
  (props: CheckboxProps): JSX.Element
  /**
   * A group of checkboxes built from `options`; its value is the array of the values of the checked options, in
   * the order of `options`. Use it for a multiple choice among a few options that should all stay visible, such as
   * permissions or notification channels; with many options, use Select with `multiple`.
   * @zh 由 `options` 生成的一组复选框；值是已勾选的选项的值组成的数组，按 `options` 的顺序。用于在少量、需要全部
   * 展示的选项中多选，如权限、通知渠道；选项多时用 `multiple` 的 Select。
   */
  readonly Group: <V = string>(props: CheckboxGroupProps<V>) => JSX.Element
}

/**
 * Checkbox for multiple choices, or a single yes/no choice such as "Also delete the data". Use `Checkbox.Group`
 * for a group of options. Settings that take effect immediately use Switch; choices that take effect on submit use
 * Checkbox.
 * @zh 复选框：多选或单个开关式的勾选（如「同时删除数据」）。一组选项用 `Checkbox.Group`。
 * 立即生效的开关用 Switch；需要提交才生效的勾选用 Checkbox。
 * @category Basic
 * @usage Boolean form fields, permission checkboxes, bulk selection
 * @usageZh 表单中的布尔字段、权限勾选、批量选择
 */
export const Checkbox: CheckboxComponent = /* @__PURE__ */ Object.assign(CheckboxRoot, {
  Group: CheckboxGroup,
})

// —— Radio ——

/** Radio 自有的属性。 */
interface RadioOwnProps<V> {
  /**
   * Value of this option inside a Radio.Group; the same type as the group's value.
   * @zh 在 Radio.Group 中这个选项的值，类型与 Radio.Group 的值相同。
   */
  readonly value?: V
  /**
   * Selected (controlled; usually set by Radio.Group).
   * @zh 是否选中（受控；通常由 Radio.Group 设置）。
   */
  readonly checked?: boolean
  /**
   * Label next to the circle.
   * @zh 圆圈旁边的文字。
   */
  readonly children?: ReactNode
  /**
   * The native `<input type="radio">`.
   * @zh 原生的 `<input type="radio">`。
   */
  readonly ref?: Ref<HTMLInputElement>
}

/**
 * Props of Radio and Radio.Button.
 * @zh Radio 与 Radio.Button 属性。
 */
export interface RadioProps<V = string>
  extends RadioOwnProps<V>,
    Omit<
      NativeProps<InputHTMLAttributes<HTMLInputElement>, RadioOwnProps<V>>,
      'type' | 'color' | 'onChange' | 'defaultChecked' | 'defaultValue'
    > {}

/** Radio.Group 自有的属性。 */
interface RadioGroupOwnProps<V> {
  /**
   * The options: plain values (shown as text) or option objects. Instead of `options`, Radio or Radio.Button
   * elements can be given as children.
   * @zh 选项：直接是值（显示为文字），或选项对象。也可以不用 `options`，而以 Radio 或 Radio.Button 作为子元素。
   */
  readonly options?: readonly (V | ChoiceOption<V>)[]
  /**
   * Value of the selected option (controlled).
   * @zh 选中的选项的值（受控）。
   */
  readonly value?: V
  /**
   * Initially selected value (uncontrolled).
   * @zh 初始选中的值（非受控）。
   */
  readonly defaultValue?: V
  /**
   * Called with the value of the newly selected option.
   * @zh 选中的选项变化时调用，参数是新选中的选项的值。
   */
  readonly onChange?: (value: V) => void
  /**
   * Disables all options.
   * @zh 禁用全部选项。
   */
  readonly disabled?: boolean
  /**
   * Shows `options` as buttons (like Radio.Button). For switching views, prefer Segmented.
   * @zh 以按钮的样式显示 `options`（与 Radio.Button 相同）。切换视图优先用 Segmented。
   * @default 'default'
   */
  readonly variant?: 'default' | 'button'
  /**
   * Size of button-style options.
   * @zh 按钮样式的选项的尺寸。
   */
  readonly size?: ControlSize
  /**
   * Name of the native radios, for form submission.
   * @zh 原生单选框的 name，用于表单提交。
   */
  readonly name?: string
  /**
   * Radio or Radio.Button elements, when `options` is not used.
   * @zh 不用 `options` 时，作为子元素的 Radio 或 Radio.Button。
   */
  readonly children?: ReactNode
}

/**
 * Props of Radio.Group.
 * @zh Radio.Group 属性。
 */
export interface RadioGroupProps<V = string>
  extends RadioGroupOwnProps<V>,
    Omit<
      NativeProps<HTMLAttributes<HTMLDivElement>, RadioGroupOwnProps<V>>,
      'defaultChecked' | 'color'
    > {}

function RadioRoot<V = string>(props: RadioProps<V>) {
  return <AntRadio {...(props as Loose)} />
}

function RadioButton<V = string>(props: RadioProps<V>) {
  return <AntRadio.Button {...(props as Loose)} />
}

function RadioGroup<V = string>({ onChange, variant, size, ...rest }: RadioGroupProps<V>) {
  return (
    <AntRadio.Group
      {...(rest as Loose)}
      optionType={variant === 'button' ? 'button' : undefined}
      size={toAntSize(size)}
      onChange={onChange ? (e) => onChange(e.target.value as V) : undefined}
    />
  )
}

/**
 * Radio and its static members.
 * @zh Radio 及其静态成员。
 */
export interface RadioComponent {
  /**
   * Renders a single radio button; usually a child of Radio.Group.
   * @zh 渲染单个单选项；通常作为 Radio.Group 的子元素。
   */
  <V = string>(props: RadioProps<V>): JSX.Element
  /**
   * A group of mutually exclusive options; its value is the value of the selected option. Give the options with
   * `options`, or as Radio or Radio.Button children; `variant="button"` shows `options` as buttons.
   * @zh 一组互斥的选项；值是选中的选项的值。选项用 `options` 给出，或以 Radio、Radio.Button 作为子元素；
   * `variant="button"` 把 `options` 显示为按钮。
   */
  readonly Group: <V = string>(props: RadioGroupProps<V>) => JSX.Element
  /**
   * A radio option styled as a button, used as a child of Radio.Group (the same look as `variant="button"`). To
   * switch between two or three views, prefer Segmented.
   * @zh 按钮样式的单选项，作为 Radio.Group 的子元素使用（外观与 `variant="button"` 相同）。在两三个视图之间切换时
   * 优先用 Segmented。
   */
  readonly Button: <V = string>(props: RadioProps<V>) => JSX.Element
}

/**
 * Radio buttons choose one of a few mutually exclusive options when all of them should stay visible (use Select
 * when there are many). Usually used through `Radio.Group`.
 * @zh 单选：在少量互斥选项中选一个，选项需要全部展示时使用（选项多时用 Select）。通常以 `Radio.Group` 使用。
 * @category Basic
 * @usage Mutually exclusive options such as access level, storage type or visibility
 * @usageZh 授权级别、存储类型、可见范围等互斥选项
 */
export const Radio: RadioComponent = /* @__PURE__ */ Object.assign(RadioRoot, {
  Group: RadioGroup,
  Button: RadioButton,
})

// —— Switch ——

/** Switch 自有的属性。 */
interface SwitchOwnProps {
  /**
   * On (controlled).
   * @zh 是否打开（受控）。
   */
  readonly checked?: boolean
  /**
   * Initially on (uncontrolled).
   * @zh 初始是否打开（非受控）。
   */
  readonly defaultChecked?: boolean
  /**
   * Called with the new state when the switch is toggled.
   * @zh 切换时调用，参数是新的状态。
   */
  readonly onChange?: (checked: boolean) => void
  /**
   * Shows a loading indicator in the handle and ignores clicks, such as while the change is saved.
   * @zh 在滑块中显示加载指示并忽略点击，如保存修改期间。
   */
  readonly loading?: boolean
  /**
   * Size: `sm` inside lists and tables.
   * @zh 尺寸：`sm` 用于列表与表格行内。
   * @default 'md'
   */
  readonly size?: 'sm' | 'md'
  /**
   * The native `<button role="switch">`.
   * @zh 原生的 `<button role="switch">`。
   */
  readonly ref?: Ref<HTMLButtonElement>
}

/**
 * Props of Switch.
 * @zh Switch 属性。
 */
export interface SwitchProps
  extends SwitchOwnProps,
    Omit<
      NativeProps<ButtonHTMLAttributes<HTMLButtonElement>, SwitchOwnProps>,
      'type' | 'color' | 'value' | 'defaultValue' | 'children'
    > {}

/**
 * Switch for an on/off setting that takes effect immediately. Options that take effect on submit use Checkbox.
 * Update optimistically when toggled; if the change fails, roll it back and show a message.
 * @zh 开关：立即生效的二元设置。需要提交才生效的选项用 Checkbox。
 * 切换时请乐观更新，失败后回滚并用消息条提示。
 * @category Basic
 * @usage Toggles in setting rows, enabling and disabling, showing disabled records
 * @usageZh 设置行的开关、启用与停用、显示已停用的记录
 */
export function Switch({ size, onChange, onClick, ...rest }: SwitchProps) {
  return (
    <AntSwitch
      {...(rest as Loose)}
      size={size === 'sm' ? 'small' : undefined}
      onChange={onChange ? (checked) => onChange(checked) : undefined}
      // rc-switch 以 (checked, event) 调用 onClick；原生属性的 onClick 只收到事件
      onClick={onClick ? (_checked, e) => onClick(e as MouseEvent<HTMLButtonElement>) : undefined}
    />
  )
}

// —— Segmented ——

/**
 * An option of Segmented: a ChoiceOption that can also have an icon.
 * @zh Segmented 的一个选项：在 ChoiceOption 之上还可以有图标。
 */
export interface SegmentedOption<V> extends Omit<ChoiceOption<V>, 'label'> {
  /**
   * Text of the option; leave it out for an option with only an icon (then give `title`).
   * @zh 选项的文字；只有图标的选项可以省略（此时要提供 `title`）。
   */
  readonly label?: ReactNode
  /**
   * Icon before the label, by name (like Button and IconButton).
   * @zh 文字前的图标，写图标名（与 Button、IconButton 一致）。
   */
  readonly icon?: IconName
  /**
   * Tooltip of the option; required for an option with only an icon, where it is also the accessible name.
   * @zh 选项的提示；只有图标的选项必须提供，它同时是读屏名称。
   */
  readonly title?: string
}

/** Segmented 自有的属性。 */
interface SegmentedOwnProps<V> {
  /**
   * The options: plain values (shown as text) or option objects.
   * @zh 选项：直接是值（显示为文字），或选项对象。
   */
  readonly options: readonly (V | SegmentedOption<V>)[]
  /**
   * Value of the selected option (controlled).
   * @zh 选中的选项的值（受控）。
   */
  readonly value?: V
  /**
   * Initially selected value (uncontrolled).
   * @zh 初始选中的值（非受控）。
   */
  readonly defaultValue?: V
  /**
   * Called with the value of the newly selected option.
   * @zh 选中的选项变化时调用，参数是新选中的选项的值。
   */
  readonly onChange?: (value: V) => void
  /**
   * Disables all options.
   * @zh 禁用全部选项。
   */
  readonly disabled?: boolean
  /**
   * Size: `sm` in toolbars and panel headers.
   * @zh 尺寸：`sm` 用于工具栏与面板标题栏。
   */
  readonly size?: ControlSize
  /**
   * Fills the width of the container; the options share it equally.
   * @zh 占满容器的宽度，选项平分。
   */
  readonly block?: boolean
  /**
   * The root element.
   * @zh 根元素。
   */
  readonly ref?: Ref<HTMLDivElement>
}

/**
 * Props of Segmented.
 * @zh Segmented 属性。
 */
export interface SegmentedProps<V extends string | number = string>
  extends SegmentedOwnProps<V>,
    Omit<
      NativeProps<HTMLAttributes<HTMLDivElement>, SegmentedOwnProps<V>>,
      'defaultChecked' | 'color'
    > {}

/** 选项中的图标名换成 Icon 元素，交给 antd。 */
function withIcons<V>(options: readonly (V | SegmentedOption<V>)[]) {
  return options.map((o) =>
    typeof o === 'object' && o !== null && 'icon' in o && o.icon
      ? { ...o, icon: <Icon name={o.icon} /> }
      : o,
  )
}

/**
 * Segmented control: switches between two to five mutually exclusive options, with an indicator that slides
 * between them.
 *
 * **Interaction**: the indicator slides to the selected option (200 ms) and the options keep their width; after
 * focusing it with `Tab`, the arrow keys change the selection.
 * @zh 分段控件：两到五个互斥选项的切换，选中滑块在选项之间滑动。
 *
 * **交互**：选中滑块在选项之间滑动（200ms），选项宽度不变；`Tab` 聚焦后用方向键切换选项。
 * @category Basic
 * @usage Switching views (list / grid), time ranges (today / this week / this month)
 * @usageZh 视图切换（列表 / 网格）、时间范围（今天 / 本周 / 本月）
 */
export function Segmented<V extends string | number = string>({
  size,
  options,
  ...rest
}: SegmentedProps<V>) {
  // antd 的根元素 tabIndex=0，但方向键只在内部的单选框上生效：键盘用户要按两次 Tab 才能操作。
  // 根元素移出 Tab 顺序，Tab 直接落到当前选项上
  return (
    <AntSegmented<V>
      tabIndex={-1}
      {...(rest as Loose)}
      options={withIcons(options) as V[]}
      size={toAntSize(size)}
    />
  )
}
