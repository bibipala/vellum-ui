/**
 * 文本与数字输入：Input（含 Password、Search、TextArea）与 InputNumber。
 * antd 只作为内部实现，对外的属性由本库声明（ADR 0021）。输入类组件统一为填充式（中性底、不描边，聚焦时显示强调色细边与光环），
 * 由 ThemeProvider 的 ConfigProvider 设定。
 */
import { Input as AntInput, InputNumber as AntInputNumber, type GetRef } from 'antd'
import type {
  ChangeEvent,
  InputHTMLAttributes,
  JSX,
  KeyboardEvent,
  ReactNode,
  Ref,
  TextareaHTMLAttributes,
} from 'react'
import { useImperativeHandle, useRef } from 'react'
import type { ControlSize } from './basic.tsx'
import { Icon } from './Icon.tsx'
import styles from './inputs.module.css'
import { type NativeProps, toAntSize, withInjected } from './internal.ts'

/**
 * Where to put the cursor when focusing a text field: at the `start`, at the `end`, or select `all` of the text.
 * @zh 聚焦文本框时光标的位置：开头（`start`）、末尾（`end`），或选中全部文字（`all`）。
 */
export interface FocusOptions {
  /**
   * Cursor position after focusing.
   * @zh 聚焦后光标的位置。
   */
  readonly cursor?: 'start' | 'end' | 'all'
}

/**
 * Handle of Input (and Password, Search): focus, blur, select, and the native element.
 * @zh Input（及 Password、Search）的句柄：聚焦、失焦、选中文字，以及原生元素。
 */
export interface InputRef {
  /**
   * Focuses the field; `cursor` places the cursor or selects the text.
   * @zh 聚焦输入框；`cursor` 指定光标位置或选中文字。
   */
  focus(options?: FocusOptions): void
  /**
   * Removes the focus.
   * @zh 移除焦点。
   */
  blur(): void
  /**
   * Selects all text.
   * @zh 选中全部文字。
   */
  select(): void
  /**
   * The native `<input>` element.
   * @zh 原生的 `<input>` 元素。
   */
  readonly input: HTMLInputElement | null
}

/**
 * Handle of Input.TextArea: focus, blur, and the native element.
 * @zh Input.TextArea 的句柄：聚焦、失焦，以及原生元素。
 */
export interface TextAreaRef {
  /**
   * Focuses the field; `cursor` places the cursor or selects the text.
   * @zh 聚焦输入框；`cursor` 指定光标位置或选中文字。
   */
  focus(options?: FocusOptions): void
  /**
   * Removes the focus.
   * @zh 移除焦点。
   */
  blur(): void
  /**
   * The native `<textarea>` element.
   * @zh 原生的 `<textarea>` 元素。
   */
  readonly textarea: HTMLTextAreaElement | null
}

/** 单行输入框共有的自有属性。 */
interface FieldOwnProps {
  /**
   * Current text (controlled).
   * @zh 当前文字（受控）。
   */
  readonly value?: string
  /**
   * Initial text (uncontrolled).
   * @zh 初始文字（非受控）。
   */
  readonly defaultValue?: string
  /**
   * Called on every change of the text, with the native change event (`e.target.value`).
   * @zh 文字每次变化时调用，参数是原生的变更事件（`e.target.value`）。
   */
  readonly onChange?: (event: ChangeEvent<HTMLInputElement>) => void
  /**
   * Called when `Enter` is pressed.
   * @zh 按下 `Enter` 时调用。
   */
  readonly onPressEnter?: (event: KeyboardEvent<HTMLInputElement>) => void
  /**
   * Size: `sm` in table rows and toolbars, `lg` for prominent forms. Without it, the size follows the density.
   * @zh 尺寸：`sm` 用于表格行内与工具栏，`lg` 用于醒目的表单。省略时随密度。
   */
  readonly size?: ControlSize
  /**
   * Validation status, usually set by Form.Item: `error` or `warning` colors the field.
   * @zh 校验状态，通常由 Form.Item 设置：`error`、`warning` 时输入框显示对应的颜色。
   */
  readonly status?: 'error' | 'warning'
  /**
   * Appearance: `filled` (neutral background, the default) or `borderless` (no background, for fields inside
   * other surfaces such as a command palette).
   * @zh 外观：`filled` 填充式（中性底，默认），`borderless` 无底色（用于命令面板等其他表面内部）。
   * @default 'filled'
   */
  readonly variant?: 'filled' | 'borderless'
  /**
   * Shows a clear button while the field has text.
   * @zh 有文字时显示清除按钮。
   */
  readonly allowClear?: boolean
  /**
   * Content after the text, inside the field, such as a unit.
   * @zh 文字后面、框内的内容，如单位。
   */
  readonly suffix?: ReactNode
}

/** 原生 input 元素的属性中，自有属性已经覆盖或不适用的项。 */
type InputNativeKeys = 'size' | 'prefix' | 'type' | 'color'

/** Input 自有的属性。 */
interface InputOwnProps extends FieldOwnProps {
  /**
   * Content before the text, inside the field, such as an icon.
   * @zh 文字前面、框内的内容，如图标。
   */
  readonly prefix?: ReactNode
  /**
   * Native input type, such as `email`, `tel` or `url`. The date and time types show the browser's own picker;
   * prefer DatePicker and TimePicker for a consistent look.
   * @zh 原生输入类型，如 `email`、`tel`、`url`。日期与时间类型显示浏览器自带的选择器；外观要统一时用 DatePicker、TimePicker。
   * @default 'text'
   */
  readonly type?:
    | 'text'
    | 'email'
    | 'tel'
    | 'url'
    | 'search'
    | 'date'
    | 'datetime-local'
    | 'time'
    | 'month'
  /**
   * Tabular numbers for numeric input such as amounts, quantities and reference numbers: every digit has the same
   * width, which makes values easy to align and check (same as `<Text numeric>`).
   * @zh 等宽数字：金额、数量、编号等数字输入，数字位宽一致便于对齐与核对（与 `<Text numeric>` 一致）。
   */
  readonly numeric?: boolean
  /**
   * Handle of the field.
   * @zh 输入框的句柄。
   */
  readonly ref?: Ref<InputRef>
}

/**
 * Props of Input.
 * @zh Input 属性。
 */
export interface InputProps
  extends InputOwnProps,
    Omit<NativeProps<InputHTMLAttributes<HTMLInputElement>, InputOwnProps>, InputNativeKeys> {}

/** Input.Password 自有的属性。 */
interface InputPasswordOwnProps extends FieldOwnProps {
  /**
   * Shows the button that toggles between hidden and visible text.
   * @zh 显示切换明文与密文的按钮。
   * @default true
   */
  readonly visibilityToggle?: boolean
  /**
   * Handle of the field.
   * @zh 输入框的句柄。
   */
  readonly ref?: Ref<InputRef>
}

/**
 * Props of Input.Password.
 * @zh Input.Password 属性。
 */
export interface InputPasswordProps
  extends InputPasswordOwnProps,
    Omit<
      NativeProps<InputHTMLAttributes<HTMLInputElement>, InputPasswordOwnProps>,
      InputNativeKeys
    > {}

/**
 * Where a search of Input.Search comes from.
 * @zh Input.Search 的一次搜索来自哪里。
 */
export interface InputSearchInfo {
  /**
   * `input`: `Enter` was pressed; `clear`: the clear button was clicked.
   * @zh `input`：按了回车；`clear`：点了清除按钮。
   */
  readonly source: 'input' | 'clear'
}

/** Input.Search 自有的属性。 */
interface InputSearchOwnProps extends FieldOwnProps {
  /**
   * Search: called with the current text when `Enter` is pressed, and with an empty string when the clear button of
   * `allowClear` is clicked (`info.source` is `clear`). `Enter` while composing text with an input method, and while
   * `loading`, does not search.
   * @zh 搜索：按回车时以当前文字调用；`allowClear` 时点清除按钮以空字符串调用（`info.source` 为 `clear`）。
   * 输入法组字过程中的回车、`loading` 期间的回车不触发。
   */
  readonly onSearch?: (value: string, info: InputSearchInfo) => void
  /**
   * Searching: the search icon in the field becomes a spinning loading indicator, and `Enter` does not search again
   * meanwhile.
   * @zh 搜索中：框内的搜索图标换成转动的加载指示，期间回车不重复触发。
   */
  readonly loading?: boolean
  /**
   * Handle of the field.
   * @zh 输入框的句柄。
   */
  readonly ref?: Ref<InputRef>
}

/**
 * Props of Input.Search. The search icon is always at the start of the field, so there is no `prefix`.
 * @zh Input.Search 属性。搜索图标固定在框内前面，因此没有 `prefix`。
 */
export interface InputSearchProps
  extends InputSearchOwnProps,
    Omit<
      NativeProps<InputHTMLAttributes<HTMLInputElement>, InputSearchOwnProps>,
      InputNativeKeys
    > {}

/** Input.TextArea 自有的属性。 */
interface InputTextAreaOwnProps {
  /**
   * Current text (controlled).
   * @zh 当前文字（受控）。
   */
  readonly value?: string
  /**
   * Initial text (uncontrolled).
   * @zh 初始文字（非受控）。
   */
  readonly defaultValue?: string
  /**
   * Called on every change of the text, with the native change event (`e.target.value`).
   * @zh 文字每次变化时调用，参数是原生的变更事件（`e.target.value`）。
   */
  readonly onChange?: (event: ChangeEvent<HTMLTextAreaElement>) => void
  /**
   * Grows with the content: `true`, or the smallest and largest number of rows.
   * @zh 随内容增高：`true`，或最少与最多的行数。
   */
  readonly autoSize?: boolean | { readonly minRows?: number; readonly maxRows?: number }
  /**
   * Validation status, usually set by Form.Item.
   * @zh 校验状态，通常由 Form.Item 设置。
   */
  readonly status?: 'error' | 'warning'
  /**
   * Appearance: `filled` (neutral background, the default) or `borderless`.
   * @zh 外观：`filled` 填充式（中性底，默认）或 `borderless` 无底色。
   * @default 'filled'
   */
  readonly variant?: 'filled' | 'borderless'
  /**
   * Shows a clear button while the field has text.
   * @zh 有文字时显示清除按钮。
   */
  readonly allowClear?: boolean
  /**
   * Handle of the field.
   * @zh 输入框的句柄。
   */
  readonly ref?: Ref<TextAreaRef>
}

/**
 * Props of Input.TextArea.
 * @zh Input.TextArea 属性。
 */
export interface InputTextAreaProps
  extends InputTextAreaOwnProps,
    Omit<
      NativeProps<TextareaHTMLAttributes<HTMLTextAreaElement>, InputTextAreaOwnProps>,
      'color'
    > {}

// antd 的属性类型与本库的声明在结构上兼容，但 antd 的泛型与重载让直接传递很繁琐：内部统一转成宽松的对象再交给 antd
type Loose = Record<string, unknown>

function InputRoot({ numeric, size, ...rest }: InputProps) {
  return (
    <AntInput
      {...(rest as Loose)}
      size={toAntSize(size)}
      className={withInjected(numeric ? styles.numeric : undefined, rest)}
    />
  )
}

function InputPassword({ size, ...rest }: InputPasswordProps) {
  return <AntInput.Password {...(rest as Loose)} size={toAntSize(size)} />
}

function InputSearch({
  onSearch,
  loading,
  onPressEnter,
  onChange,
  onCompositionStart,
  onCompositionEnd,
  size,
  ...rest
}: InputSearchProps) {
  // 输入法组字时的回车用于确认候选词，不是搜索（与 antd 的 Input.Search 一致，用组字事件判断）
  const composing = useRef(false)
  return (
    <AntInput
      // type=search：读屏识别为搜索框；antd 已隐藏浏览器自带的清除按钮
      type="search"
      enterKeyHint="search"
      {...(rest as Loose)}
      size={toAntSize(size)}
      prefix={
        <span className={styles.searchIcon} aria-hidden="true">
          {loading ? (
            <span className={styles.spin}>
              <Icon name="loader" />
            </span>
          ) : (
            <Icon name="search" />
          )}
        </span>
      }
      onCompositionStart={(e) => {
        composing.current = true
        onCompositionStart?.(e)
      }}
      onCompositionEnd={(e) => {
        composing.current = false
        onCompositionEnd?.(e)
      }}
      onPressEnter={(e) => {
        if (composing.current || loading) return
        onPressEnter?.(e)
        onSearch?.(e.currentTarget.value, { source: 'input' })
      }}
      onChange={(e) => {
        // antd 的清除按钮以 click 事件调用 onChange，此时输入框的值已是空字符串
        if (e.type === 'click') onSearch?.(e.target.value, { source: 'clear' })
        onChange?.(e)
      }}
    />
  )
}

function InputTextArea({ ref, ...props }: InputTextAreaProps) {
  const inner = useRef<GetRef<typeof AntInput.TextArea>>(null)
  // antd 的引用把原生元素藏在 resizableTextArea.textArea 里：对外给出本库的句柄
  useImperativeHandle(
    ref,
    () => ({
      focus: (options) => inner.current?.focus(options),
      blur: () => inner.current?.blur(),
      get textarea() {
        return inner.current?.resizableTextArea?.textArea ?? null
      },
    }),
    [],
  )
  return <AntInput.TextArea ref={inner} {...(props as Loose)} />
}

/**
 * Input and its static members.
 * @zh Input 及其静态成员。
 */
export interface InputComponent {
  /** 渲染单行输入框。 */
  (props: InputProps): JSX.Element
  /** 密码输入：可切换明文显示。 */
  readonly Password: (props: InputPasswordProps) => JSX.Element
  /** 搜索输入：框内前置搜索图标，回车触发 `onSearch`（不附着搜索按钮）。 */
  readonly Search: (props: InputSearchProps) => JSX.Element
  /** 多行输入：`autoSize` 随内容增高。 */
  readonly TextArea: (props: InputTextAreaProps) => JSX.Element
}

/**
 * Single-line text input. Use `Input.Password` for passwords, `Input.Search` for searching and `Input.TextArea`
 * for multi-line text. Filled input: neutral background without a border; on focus it shows a thin accent border
 * and a focus halo.
 *
 * `Input.Search` shows the search icon at the start of the field and has no attached button: pressing `Enter`
 * searches, and clearing the field with `allowClear` also calls `onSearch`.
 * @zh 输入框：单行文本输入。`Input.Password` 输入密码，`Input.Search` 用于搜索，`Input.TextArea` 输入多行文本。
 * 填充式外观：中性底、不描边，聚焦时显示强调色细边与光环。
 *
 * `Input.Search` 的搜索图标在框内前面，没有附着的按钮：按回车搜索，`allowClear` 时清空也会触发 `onSearch`。
 * @category Basic
 * @usage Form fields, search fields in toolbars, entering a name in a dialog
 * @usageZh 表单字段、工具栏中的搜索框、弹窗内的名称输入
 */
export const Input: InputComponent = /* @__PURE__ */ Object.assign(InputRoot, {
  Password: InputPassword,
  Search: InputSearch,
  TextArea: InputTextArea,
})

// —— InputNumber ——

/**
 * Handle of InputNumber: focus, blur, and the native element.
 * @zh InputNumber 的句柄：聚焦、失焦，以及原生元素。
 */
export interface InputNumberRef {
  /**
   * Focuses the field; `cursor` places the cursor or selects the text.
   * @zh 聚焦输入框；`cursor` 指定光标位置或选中文字。
   */
  focus(options?: FocusOptions): void
  /**
   * Removes the focus.
   * @zh 移除焦点。
   */
  blur(): void
  /**
   * The outer element of the field.
   * @zh 输入框的外层元素。
   */
  readonly nativeElement?: HTMLElement | null
}

/** InputNumber 的两种取值方式共有的属性。 */
interface InputNumberCommonProps {
  /**
   * Number of decimal places shown and kept.
   * @zh 显示并保留的小数位数。
   */
  readonly precision?: number
  /**
   * Shows the step buttons.
   * @zh 显示步进按钮。
   * @default true
   */
  readonly controls?: boolean
  /**
   * Size: `sm` in table rows and toolbars, `lg` for prominent forms. Without it, the size follows the density.
   * @zh 尺寸：`sm` 用于表格行内与工具栏，`lg` 用于醒目的表单。省略时随密度。
   */
  readonly size?: ControlSize
  /**
   * Validation status, usually set by Form.Item.
   * @zh 校验状态，通常由 Form.Item 设置。
   */
  readonly status?: 'error' | 'warning'
  /**
   * Content after the number, inside the field, such as a unit.
   * @zh 数字后面、框内的内容，如单位。
   */
  readonly suffix?: ReactNode
  /**
   * Handle of the field.
   * @zh 输入框的句柄。
   */
  readonly ref?: Ref<InputNumberRef>
}

/** 以 number 取值（默认）：天数、端口、数量等整数或普通数值。 */
interface InputNumberAsNumber extends InputNumberCommonProps {
  /**
   * Passes the value as a decimal string instead of a number. Use it for exact values such as amounts: the value
   * never goes through floating point, and `min`, `max` and `step` are strings too.
   * @zh 以十进制字符串而不是 number 传递值。金额等精确值用它：值不经过浮点，`min`、`max`、`step` 也是字符串。
   */
  readonly decimal?: false
  /**
   * Current value (controlled); `null` when empty.
   * @zh 当前值（受控）；为空时是 `null`。
   */
  readonly value?: number | null
  /**
   * Initial value (uncontrolled).
   * @zh 初始值（非受控）。
   */
  readonly defaultValue?: number | null
  /**
   * Called with the new value; `null` when the field is emptied.
   * @zh 值变化时调用；清空时是 `null`。
   */
  readonly onChange?: (value: number | null) => void
  /**
   * Smallest value.
   * @zh 最小值。
   */
  readonly min?: number
  /**
   * Largest value.
   * @zh 最大值。
   */
  readonly max?: number
  /**
   * Step of the buttons and the arrow keys.
   * @zh 步进按钮与方向键的步长。
   * @default 1
   */
  readonly step?: number
}

/** 以十进制字符串取值：金额等精确值。 */
interface InputNumberAsDecimal extends InputNumberCommonProps {
  /**
   * Passes the value as a decimal string.
   * @zh 以十进制字符串传递值。
   */
  readonly decimal: true
  /**
   * Current value as a decimal string (controlled), such as `"1280.50"`; `null` when empty.
   * @zh 当前值（受控），十进制字符串，如 `"1280.50"`；为空时是 `null`。
   */
  readonly value?: string | null
  /**
   * Initial value (uncontrolled).
   * @zh 初始值（非受控）。
   */
  readonly defaultValue?: string | null
  /**
   * Called with the new value as a decimal string; `null` when the field is emptied.
   * @zh 值变化时调用，参数是十进制字符串；清空时是 `null`。
   */
  readonly onChange?: (value: string | null) => void
  /**
   * Smallest value, as a decimal string.
   * @zh 最小值，十进制字符串。
   */
  readonly min?: string
  /**
   * Largest value, as a decimal string.
   * @zh 最大值，十进制字符串。
   */
  readonly max?: string
  /**
   * Step, as a decimal string such as `"0.01"`.
   * @zh 步长，十进制字符串，如 `"0.01"`。
   */
  readonly step?: string
}

/** 原生 input 元素的属性中，InputNumber 自有属性已经覆盖或不适用的项。 */
type InputNumberNativeKeys =
  | keyof InputNumberAsNumber
  | keyof InputNumberAsDecimal
  | 'type'
  | 'color'
  | 'prefix'

/**
 * Props of InputNumber: a number by default, or a decimal string with `decimal`.
 * @zh InputNumber 属性：默认以 number 取值，`decimal` 时以十进制字符串取值。
 */
export type InputNumberProps = (InputNumberAsNumber | InputNumberAsDecimal) &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'style' | InputNumberNativeKeys>

/**
 * Numeric input with step buttons and tabular numbers. For exact values such as amounts and quantities, add
 * `decimal`: the value is passed as a decimal string and never goes through floating point.
 * @zh 数字输入框：带步进按钮，数字使用等宽字形。金额、数量等精确值加 `decimal`：以十进制字符串传递，不经过浮点。
 * @category Basic
 * @usage Numeric settings such as days, time limits, quantities and sort order
 * @usageZh 天数、时限、数量、排序号等数值设置
 */
export function InputNumber(props: InputNumberProps) {
  const { decimal, size, ...rest } = props
  return (
    <AntInputNumber
      {...(rest as Loose)}
      stringMode={decimal === true}
      size={toAntSize(size)}
      className={withInjected(styles.numeric, rest)}
    />
  )
}
