/**
 * 行内编辑：在列表、表格单元格与详情中直接编辑一个简单字段（docs/11 §6.1「行内编辑」「乐观更新」）。
 *
 * - 显示状态是一个按钮：点击、Enter、F2 进入编辑，输入框获得焦点并全选文字；
 * - 编辑状态：Enter 保存，Esc 取消并把焦点还给显示按钮，失焦时保存；选择类型选中即保存。值没有变化时不调用 onSave；
 * - 乐观更新：保存时立即显示新值并调用 onSave。它返回的 Promise 未完成时不能再次编辑（不重复提交）；失败时回滚为
 *   原值，以刚才的输入重新打开编辑，在字段下方显示错误。焦点还在这个字段上时回到输入框，用户已经去了别处时不抢焦点；
 * - 校验与 Form 一致：保存时校验，出过错之后随输入校验，错误显示在字段下方；
 * - 尺寸见 inline-edit.module.css：两种状态同高、同样伸出，放在表格中切换时行高不变，文字不移位。
 *
 * 值的类型由用法声明，不从当前的值推断：文字是字符串，数字默认是 number，`decimal` 时是十进制字符串（金额不经过浮点），
 * 选择是选项的值。数字的比较与本地化的写法见 decimal.ts。
 */
import {
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { useT } from '../i18n/index.ts'
import { compareDecimal, formatDecimal, toDecimalText } from './decimal.ts'
import { Icon } from './Icon.tsx'
import styles from './inline-edit.module.css'
import {
  Input,
  InputNumber,
  type InputNumberRef,
  type InputRef,
  Select,
  type SelectRef,
} from './inputs.tsx'
import { reportError } from './internal.ts'
import type { BaseProps } from './layout.tsx'
import loadingCss from './loading.module.css'
import { DisabledReasonTooltip } from './overlays.tsx'
import type { SelectValue } from './select.tsx'
import { useDelayedPending } from './useDelayedPending.ts'

/**
 * Kind of field edited by InlineEdit: `text`, `number` (a localized number, or a decimal string with `decimal`)
 * or `select` (one of the `options`).
 * @zh InlineEdit 编辑的字段类型：`text` 文字、`number` 数字（本地化的数字，`decimal` 时为十进制字符串）、`select` 从
 * `options` 中选择。
 */
export type InlineEditType = 'text' | 'number' | 'select'

/**
 * Value of an InlineEdit: a string or a number.
 * @zh InlineEdit 的取值：字符串或数字。
 * @deprecated Each mode of InlineEditProps declares its own value type; for the options of `type="select"`, use
 * SelectValue.
 * @deprecatedZh InlineEditProps 的每种用法各自声明值的类型；`type="select"` 的选项请用 SelectValue。
 */
export type InlineEditValue = SelectValue

/**
 * An option of an InlineEdit with `type="select"`.
 * @zh `type="select"` 的 InlineEdit 的一个选项。
 */
export interface InlineEditOption<V extends SelectValue = string> {
  /**
   * Value of the option, passed to `onSave` when it is chosen: a string or a number, such as an ID.
   * @zh 选项的值，选中后传给 `onSave`：字符串或数字，如 ID。
   */
  readonly value: V
  /**
   * Text of the option in the list; also what the display state shows for this value, unless `render` is given.
   * @zh 选项在列表中的文字；没有 `render` 时，也是显示状态下这个值显示的内容。
   */
  readonly label: ReactNode
  /**
   * The option cannot be chosen.
   * @zh 选项不可选。
   */
  readonly disabled?: boolean
}

/** InlineEdit 各种用法共有的属性。 */
interface InlineEditCommonProps extends Pick<BaseProps, 'testId'> {
  /**
   * Name of the field, such as "Name". Screen readers read the value button as "Edit Name" and the input as
   * "Name" (required: the value alone does not say what is edited).
   * @zh 字段名，如「名称」。读屏把显示按钮读作「编辑 名称」、把输入框读作「名称」（必填：只有值说不清在编辑什么）。
   */
  readonly label: string
  /**
   * Text shown when the value is empty, also used as the placeholder of the input; "Not set" by default (follows
   * `locale`).
   * @zh 值为空时显示的文字，也是输入框的占位文字；默认「未填写」（随 `locale`）。
   */
  readonly placeholder?: string
  /**
   * Disables editing; the value stays readable.
   * @zh 禁止编辑；值照常可读。
   */
  readonly disabled?: boolean
  /**
   * Disabled reason: shown on hover or keyboard focus while `disabled`, such as "Only the owner can rename the
   * project". With a reason the value can still be focused with `Tab` (`aria-disabled`) and screen readers read the
   * reason (as on Button).
   * @zh 禁用原因：`disabled` 时悬停或键盘聚焦显示，如「只有负责人可以改名」。提供后仍可用 Tab 聚焦（`aria-disabled`），
   * 读屏读出原因（与 Button 一致）。
   */
  readonly disabledReason?: string
  /**
   * Called when saving fails (`onSave` throws or its promise rejects). Return a user-readable text to show it below
   * the field instead of "Couldn't save. Try again." (never the raw exception). Without `onError` the error is
   * reported with `reportError`.
   * @zh 保存失败（`onSave` 抛出异常或返回的 Promise 失败）时调用。返回用户可读的文字时，字段下方显示它而不是「保存失败，
   * 请重试」（不要显示原始异常）。不提供时错误通过 `reportError` 上报。
   */
  // biome-ignore lint/suspicious/noConfusingVoidType: 只记录错误的回调不必返回值（返回 void），需要自定义提示时返回文字
  readonly onError?: (error: unknown) => string | undefined | void
}

/**
 * Text (default)
 * `value` is a string, and `onSave` receives the new text (`""` when the field is cleared).
 * @zh 文字（默认）
 * `value` 是字符串，`onSave` 收到新的文字（清空时为 `""`）。
 */
interface InlineEditTextProps extends InlineEditCommonProps {
  /**
   * Kind of field: `text`, `number` or `select`.
   * @zh 字段类型：`text` 文字、`number` 数字、`select` 选择。
   * @default 'text'
   */
  readonly type?: 'text'
  /**
   * With `type="number"`: passes the value as a decimal string instead of a number.
   * @zh 与 `type="number"` 一起使用：以十进制字符串而不是 number 传递值。
   */
  readonly decimal?: undefined
  /**
   * The saved text; `null`, `undefined` and `""` are empty and show the placeholder.
   * @zh 已保存的文字；`null`、`undefined` 与 `""` 为空，显示占位文字。
   */
  readonly value: string | null | undefined
  /**
   * Saves the new text (`""` when cleared); called only when it has changed and is valid. The new value is shown
   * right away (optimistic update). Return a promise to show the saving state: until it settles the field cannot
   * be edited again; if it rejects, the value rolls back and the field reopens with what was typed and an error
   * below it.
   * @zh 保存新的文字（清空时为 `""`）；只在有变化且校验通过时调用。新值立即显示（乐观更新）。返回 Promise 时显示保存中：
   * 完成之前不能再次编辑；Promise 失败时值回滚，并以刚才的输入重新打开编辑、在字段下方显示错误。
   */
  // biome-ignore lint/suspicious/noConfusingVoidType: 同步保存的回调不返回值（void），异步保存返回 Promise，两种写法都要接受
  readonly onSave: (next: string) => void | Promise<unknown>
  /**
   * Validates the new text before saving: return an error text, or nothing when it is valid. Runs on `Enter` and
   * on blur; after an error, on every change, so the error disappears as soon as it is corrected.
   * @zh 保存前校验新的文字：返回错误文字，通过时什么都不返回。按 `Enter` 与失焦时校验；出过错之后随输入校验，改正后错误立即消失。
   */
  readonly validate?: (next: string) => string | null | undefined
  /**
   * Renders a non-empty value in the display state, for example with a unit or as a Pill. By default the text is
   * shown.
   * @zh 自定义非空值在显示状态下的样子，如带单位、显示为 Pill。默认显示文字。
   */
  readonly render?: (value: string) => ReactNode
  /**
   * Maximum number of characters.
   * @zh 最多可以输入的字数。
   */
  readonly maxLength?: number
}

/**
 * Number: `type="number"`
 * For ordinary numbers such as counts: `value`, `min` and `max` are numbers, and `onSave` receives a number, or
 * `null` when the field is cleared. The number is shown localized.
 * @zh 数字：`type="number"`
 * 用于数量等普通数值：`value`、`min`、`max` 都是 number，`onSave` 收到 number，清空时为 `null`。数字按语言显示。
 */
interface InlineEditNumberProps extends InlineEditCommonProps {
  /**
   * Kind of field: `text`, `number` or `select`.
   * @zh 字段类型：`text` 文字、`number` 数字、`select` 选择。
   */
  readonly type: 'number'
  /**
   * Passes the value as a decimal string instead of a number, as InputNumber does. Use it for exact values such as
   * amounts: the value never goes through floating point.
   * @zh 以十进制字符串而不是 number 传递值，与 InputNumber 相同。金额等精确值用它：值不经过浮点。
   */
  readonly decimal?: false
  /**
   * The saved number; `null` and `undefined` are empty and show the placeholder.
   * @zh 已保存的数字；`null` 与 `undefined` 为空，显示占位文字。
   */
  readonly value: number | null | undefined
  /**
   * Saves the new number, `null` when cleared; called only when it has changed and is valid. The new value is
   * shown right away (optimistic update); a returned promise works as with text.
   * @zh 保存新的数字，清空时为 `null`；只在有变化且校验通过时调用。新值立即显示（乐观更新）；返回 Promise 时与文字相同。
   */
  // biome-ignore lint/suspicious/noConfusingVoidType: 同步保存的回调不返回值（void），异步保存返回 Promise，两种写法都要接受
  readonly onSave: (next: number | null) => void | Promise<unknown>
  /**
   * Validates the new number before saving, after the range check: return an error text, or nothing when it is
   * valid.
   * @zh 在范围检查之后、保存之前校验新的数字：返回错误文字，通过时什么都不返回。
   */
  readonly validate?: (next: number | null) => string | null | undefined
  /**
   * Renders a non-empty value in the display state, for example with a unit. By default the localized number is
   * shown.
   * @zh 自定义非空值在显示状态下的样子，如带单位。默认显示本地化的数字。
   */
  readonly render?: (value: number) => ReactNode
  /**
   * Number of decimal places: the value is shown with exactly this many and rounded to it when saved. Without it,
   * the value is shown as it is.
   * @zh 小数位数：显示时固定为这么多位，保存时按它取舍。不设置时按原值显示。
   */
  readonly precision?: number
  /**
   * Smallest allowed value; smaller values show an error.
   * @zh 允许的最小值；更小的值显示错误。
   */
  readonly min?: number
  /**
   * Largest allowed value; larger values show an error.
   * @zh 允许的最大值；更大的值显示错误。
   */
  readonly max?: number
}

/**
 * Decimal string: `type="number"` with `decimal`
 * For exact values such as amounts and quantities: `value`, `min` and `max` are decimal strings such as
 * `"1250.50"`, `onSave` receives a decimal string (`null` when the field is cleared), and the value never goes
 * through floating point. The number is shown localized.
 * @zh 十进制字符串：`type="number"` 加 `decimal`
 * 用于金额、数量等精确值：`value`、`min`、`max` 都是十进制字符串，如 `"1250.50"`，`onSave` 收到十进制字符串（清空时为
 * `null`），值不经过浮点。数字按语言显示。
 */
interface InlineEditDecimalProps extends InlineEditCommonProps {
  /**
   * Kind of field: `text`, `number` or `select`.
   * @zh 字段类型：`text` 文字、`number` 数字、`select` 选择。
   */
  readonly type: 'number'
  /**
   * Passes the value as a decimal string.
   * @zh 以十进制字符串传递值。
   */
  readonly decimal: true
  /**
   * The saved value as a decimal string, such as `"1250.50"`; `null`, `undefined` and `""` are empty and show the
   * placeholder.
   * @zh 已保存的值，十进制字符串，如 `"1250.50"`；`null`、`undefined` 与 `""` 为空，显示占位文字。
   */
  readonly value: string | null | undefined
  /**
   * Saves the new value as a decimal string, `null` when cleared; called only when it has changed and is valid
   * (`"1250.5"` and `"1250.50"` are the same value). The new value is shown right away (optimistic update); a
   * returned promise works as with text.
   * @zh 保存新的值（十进制字符串），清空时为 `null`；只在有变化且校验通过时调用（`"1250.5"` 与 `"1250.50"` 是同一个值）。
   * 新值立即显示（乐观更新）；返回 Promise 时与文字相同。
   */
  // biome-ignore lint/suspicious/noConfusingVoidType: 同步保存的回调不返回值（void），异步保存返回 Promise，两种写法都要接受
  readonly onSave: (next: string | null) => void | Promise<unknown>
  /**
   * Validates the new value before saving, after the range check: return an error text, or nothing when it is
   * valid.
   * @zh 在范围检查之后、保存之前校验新的值：返回错误文字，通过时什么都不返回。
   */
  readonly validate?: (next: string | null) => string | null | undefined
  /**
   * Renders a non-empty value in the display state, for example with a currency. By default the localized number
   * is shown.
   * @zh 自定义非空值在显示状态下的样子，如带货币单位。默认显示本地化的数字。
   */
  readonly render?: (value: string) => ReactNode
  /**
   * Number of decimal places: the value is shown with exactly this many and rounded to it when saved. Without it,
   * the value is shown as it is.
   * @zh 小数位数：显示时固定为这么多位，保存时按它取舍。不设置时按原值显示。
   */
  readonly precision?: number
  /**
   * Smallest allowed value, as a decimal string; smaller values show an error.
   * @zh 允许的最小值，十进制字符串；更小的值显示错误。
   */
  readonly min?: string
  /**
   * Largest allowed value, as a decimal string; larger values show an error.
   * @zh 允许的最大值，十进制字符串；更大的值显示错误。
   */
  readonly max?: string
}

/**
 * Choice: `type="select"`
 * `value` is the value of one of the `options`; choosing an option saves it, and `onSave` receives its value.
 * @zh 选择：`type="select"`
 * `value` 是 `options` 中某个选项的值；选中即保存，`onSave` 收到选项的值。
 */
interface InlineEditSelectProps<V extends SelectValue> extends InlineEditCommonProps {
  /**
   * Kind of field: `text`, `number` or `select`.
   * @zh 字段类型：`text` 文字、`number` 数字、`select` 选择。
   */
  readonly type: 'select'
  /**
   * With `type="number"`: passes the value as a decimal string instead of a number.
   * @zh 与 `type="number"` 一起使用：以十进制字符串而不是 number 传递值。
   */
  readonly decimal?: undefined
  /**
   * The options; selecting one saves it.
   * @zh 选项；选中即保存。
   */
  readonly options: readonly InlineEditOption<V>[]
  /**
   * Value of the selected option; `null` and `undefined` are empty and show the placeholder.
   * @zh 选中的选项的值；`null` 与 `undefined` 为空，显示占位文字。
   */
  readonly value: V | null | undefined
  /**
   * Saves the chosen option; called only when it differs from the current value. The new value is shown right away
   * (optimistic update); a returned promise works as with text.
   * @zh 保存选中的选项；只在与当前值不同时调用。新值立即显示（乐观更新）；返回 Promise 时与文字相同。
   */
  // biome-ignore lint/suspicious/noConfusingVoidType: 同步保存的回调不返回值（void），异步保存返回 Promise，两种写法都要接受
  readonly onSave: (next: V) => void | Promise<unknown>
  /**
   * Validates the chosen option before saving: return an error text, or nothing when it is valid.
   * @zh 保存前校验选中的选项：返回错误文字，通过时什么都不返回。
   */
  readonly validate?: (next: V) => string | null | undefined
  /**
   * Renders a non-empty value in the display state, for example as a Pill. By default the label of the option is
   * shown.
   * @zh 自定义非空值在显示状态下的样子，如显示为 Pill。默认显示选项的文字。
   */
  readonly render?: (value: V) => ReactNode
}

/**
 * Props of InlineEdit: a text by default, a number or a decimal string with `type="number"`, or a choice with
 * `type="select"`. The mode declares the type of `value` and of what `onSave` receives.
 * @zh InlineEdit 属性：默认编辑文字，`type="number"` 时编辑数字或十进制字符串，`type="select"` 时从选项中选择。
 * 用法决定 `value` 与 `onSave` 收到的值的类型。
 */
export type InlineEditProps<V extends SelectValue = string> =
  | InlineEditTextProps
  | InlineEditNumberProps
  | InlineEditDecimalProps
  | InlineEditSelectProps<V>

/** 组件内部按用法读取属性：值统一为字符串或数字，转换由用法决定（见 fromDraft）。 */
interface LooseProps extends InlineEditCommonProps {
  readonly type?: InlineEditType
  readonly decimal?: boolean
  readonly value: SelectValue | null | undefined
  // biome-ignore lint/suspicious/noConfusingVoidType: 同步保存的回调不返回值（void），异步保存返回 Promise，两种写法都要接受
  readonly onSave: (next: SelectValue | null) => void | Promise<unknown>
  readonly validate?: (next: SelectValue | null) => string | null | undefined
  readonly render?: (value: SelectValue) => ReactNode
  readonly options?: readonly InlineEditOption<SelectValue>[]
  readonly precision?: number
  readonly min?: SelectValue
  readonly max?: SelectValue
  readonly maxLength?: number
}

/** 编辑的方式：文字、数字（number）、十进制字符串、选择。由 `type` 与 `decimal` 决定，不从当前的值推断。 */
type Mode = 'text' | 'number' | 'decimal' | 'select'

/** 编辑中的输入：文字为字符串，数字（两种用法）为十进制字符串或 null，选择为选项的值。 */
type Draft = SelectValue | null

/** 一次编辑（从进入编辑到保存或取消）。 */
interface Session {
  readonly draft: Draft
  readonly error: string | null
  /** 出过错：此后随输入校验（docs/11 §6.2「表单」）。 */
  readonly errored: boolean
  /** 打开时把焦点移到输入框。保存失败后重新打开、而焦点已经去了别处时为 false，不抢焦点。 */
  readonly focus: boolean
}

const isEmpty = (v: unknown) => v === null || v === undefined || v === ''

const isThenable = (v: unknown): v is PromiseLike<unknown> =>
  typeof (v as PromiseLike<unknown> | null)?.then === 'function'

const joinIds = (...ids: (string | undefined)[]) => ids.filter(Boolean).join(' ') || undefined

/**
 * Edits a simple field in place, in lists, table cells and details, without opening a form: a text, a localized
 * number or a choice from options. The new value is shown right away; if saving fails, it rolls back and the error
 * is shown below the field.
 *
 * **Interaction**: in the display state the value is a button; on hover it shows the state layer and an edit
 * icon. Click it, or press `Enter` or `F2`, to edit: the input gets focus with its text selected. `Enter` saves,
 * `Esc` cancels and returns focus to the value, and moving focus away saves; a `select` saves as soon as an option
 * is chosen. Nothing is saved when the value has not changed. While the promise returned by `onSave` is pending,
 * the new value is shown with a loading indicator and the field cannot be edited again; if it rejects, the value
 * rolls back and the field reopens with an error (focus returns to the input if it was still on the field).
 * Validation runs on `Enter` and on blur, then on every change once an error has been shown. Both states have the
 * same height, so switching does not change the height of a table row, and the text stays in place. With "reduce
 * motion" on there are no transitions. Values are rendered as text, never as HTML.
 * @zh 行内编辑：在列表、表格单元格与详情中直接编辑一个简单字段，不必打开表单：文字、本地化的数字或从选项中选择。
 * 新值立即显示；保存失败时回滚，并在字段下方显示错误。
 *
 * **交互**：显示状态下值是一个按钮，悬停叠加状态层并出现编辑图标。点击，或按 `Enter`、`F2` 进入编辑：输入框获得焦点并全选文字。
 * `Enter` 保存，`Esc` 取消并把焦点还给值，焦点离开时保存；`select` 选中即保存。值没有变化时不保存。`onSave` 返回的
 * Promise 未完成时显示新值与加载指示，不能再次编辑；失败时值回滚，字段重新打开并显示错误（焦点还在这个字段上时回到输入框）。
 * 按 `Enter` 与失焦时校验，出过错之后随输入校验。两种状态同高，放在表格行中切换时行高不变，文字不移位。「减少动态效果」
 * 打开时没有过渡。值按文字显示，不当作 HTML。
 * @category Data
 * @usage Renaming in lists and tables, editing quantities, prices and statuses in table cells, fields of a detail page
 * @usageZh 列表与表格中的改名，在表格单元格中修改数量、单价、状态，详情页的字段
 */
export function InlineEdit<V extends SelectValue = string>(props: InlineEditProps<V>) {
  // 各用法的值类型不同；组件内部统一按「字符串或数字」处理，按用法转换（见 fromDraft）
  const p = props as LooseProps
  const t = useT()
  const type = p.type ?? 'text'
  const mode: Mode = type === 'number' ? (p.decimal ? 'decimal' : 'number') : type
  const locale = t('format.locale')
  const valueId = useId()
  const errorId = useId()
  const reasonId = useId()

  // 编辑中的状态同时放在 ref 里：rc-input-number 在同一个按键事件中先 onChange 再冒泡到外层的 keydown，
  // 外层读到的必须是刚才的输入，而不是上一次渲染的值
  const [session, setSession] = useState<Session | null>(null)
  const sessionRef = useRef<Session | null>(null)
  const setEdit = (next: Session | null) => {
    sessionRef.current = next
    setSession(next)
  }

  // 乐观更新：保存中显示的新值；保存成功后、使用方更新 `value` 之前继续显示刚保存的值（不闪回旧值）
  const [pending, setPending] = useState<{ readonly value: Draft } | null>(null)
  const pendingRef = useRef(false)
  const [held, setHeld] = useState<{
    readonly value: Draft
    readonly base: Draft | undefined
  } | null>(null)
  const showSpinner = useDelayedPending(pending !== null)

  const displayRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<InputRef>(null)
  const numberRef = useRef<InputNumberRef>(null)
  const selectRef = useRef<SelectRef>(null)
  // 结束编辑后把焦点还给显示按钮（Enter、Esc、选中：焦点原本在输入框里）
  const refocus = useRef(false)
  // 异步回调中读取最新的属性（onError 等）
  const latest = useRef(p)
  const alive = useRef(true)
  useLayoutEffect(() => {
    latest.current = p
  })
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const heldValid = held !== null && Object.is(held.base, p.value)
  const shown: Draft | undefined = pending ? pending.value : heldValid ? held.value : p.value
  // 使用方的 value 变了（保存后更新、或别处改了），就不再显示刚保存的值
  useEffect(() => {
    if (held && !heldValid) setHeld(null)
  }, [held, heldValid])

  const blocked = Boolean(p.disabled && p.disabledReason)
  const editable = !p.disabled && pending === null

  const toDraft = (v: Draft | undefined): Draft => {
    if (mode === 'number' || mode === 'decimal') return toDecimalText(v)
    if (mode === 'text') return isEmpty(v) ? '' : String(v)
    return v ?? null
  }
  /** 要保存的值：按声明的用法转换（数字模式是 number，十进制模式是字符串），与当前值的类型无关。 */
  const fromDraft = (draft: Draft): Draft => {
    if (mode === 'text') return draft === null ? '' : String(draft)
    if (mode === 'number' || mode === 'decimal') {
      if (draft === null || draft === '') return null
      return mode === 'number' ? Number(draft) : String(draft)
    }
    return draft
  }
  const same = (a: Draft | undefined, b: Draft | undefined) => {
    if (mode === 'text') return (a ?? '') === (b ?? '')
    if (mode === 'number' || mode === 'decimal') {
      const x = toDecimalText(a)
      const y = toDecimalText(b)
      return x === null || y === null ? x === y : compareDecimal(x, y) === 0
    }
    return Object.is(a ?? null, b ?? null)
  }
  const check = (next: Draft): string | null => {
    if ((mode === 'number' || mode === 'decimal') && next !== null) {
      const text = toDecimalText(next)
      const min = toDecimalText(p.min)
      const max = toDecimalText(p.max)
      const below = text !== null && min !== null && compareDecimal(text, min) === -1
      const above = text !== null && max !== null && compareDecimal(text, max) === 1
      if (below || above) {
        const params = {
          min: min === null ? '' : formatDecimal(min, locale),
          max: max === null ? '' : formatDecimal(max, locale),
        }
        return t(
          min !== null && max !== null
            ? 'inlineEdit.range'
            : below
              ? 'inlineEdit.min'
              : 'inlineEdit.max',
          params,
        )
      }
    }
    return p.validate?.(next) || null
  }

  const startEdit = () => {
    if (!editable || blocked || sessionRef.current) return
    setEdit({
      draft: toDraft(shown),
      error: null,
      errored: false,
      focus: true,
    })
  }

  const close = (returnFocus: boolean) => {
    refocus.current = returnFocus
    setEdit(null)
  }

  /**
   * 保存失败：回滚（显示原值），以刚才的输入重新打开编辑并显示错误。焦点还在显示按钮上（或丢到了 body）时回到输入框，
   * 用户已经去了别处时不抢。`movedTo` 是失焦保存时焦点的去处：Promise 可能在焦点真正移过去之前（focusout 期间）就失败了，
   * 那时 activeElement 还是 body。
   */
  const fail = (error: unknown, attempted: Draft, movedTo: Element | null) => {
    const { onError } = latest.current
    let text: string | undefined
    if (onError) {
      const custom = onError(error)
      if (typeof custom === 'string' && custom) text = custom
    } else reportError(error)
    const active = document.activeElement
    const now = active && active !== document.body ? active : movedTo
    const here = !now || now === document.body || now === displayRef.current
    setEdit({
      draft: toDraft(attempted),
      error: text ?? t('inlineEdit.saveFailed'),
      errored: true,
      focus: here,
    })
  }

  const save = (next: Draft, movedTo: Element | null) => {
    const base = p.value
    let result: unknown
    try {
      result = p.onSave(next)
    } catch (error) {
      fail(error, next, movedTo)
      return
    }
    if (!isThenable(result)) {
      setHeld({ value: next, base })
      return
    }
    pendingRef.current = true
    setPending({ value: next })
    result.then(
      () => {
        if (!alive.current) return
        pendingRef.current = false
        setPending(null)
        setHeld({ value: next, base })
      },
      (error: unknown) => {
        if (!alive.current) return
        pendingRef.current = false
        setPending(null)
        fail(error, next, movedTo)
      },
    )
  }

  /**
   * 保存当前输入（或选中的选项）：校验不通过时留在编辑中并显示错误；值没变时直接结束编辑。
   * `movedTo`：失焦触发时焦点的去处（按键与选中触发时为 null，焦点回到显示按钮）。
   */
  const commit = (movedTo: Element | null, picked?: { readonly value: Draft }) => {
    const s = sessionRef.current
    if (!s || pendingRef.current) return
    const draft = picked ? picked.value : s.draft
    const next = fromDraft(draft)
    const message = check(next)
    if (message) {
      setEdit({ ...s, draft, error: message, errored: true })
      return
    }
    const byKey = movedTo === null
    close(byKey)
    if (!same(next, shown)) save(next, movedTo)
  }

  const change = (draft: Draft) => {
    const s = sessionRef.current
    if (!s) return
    setEdit({ ...s, draft, error: s.errored ? check(fromDraft(draft)) : s.error })
  }

  const editing = session !== null
  useLayoutEffect(() => {
    if (editing) {
      if (!sessionRef.current?.focus) return
      // 进入编辑：输入框获得焦点并全选文字（选择类型直接打开选项）
      if (type === 'text') inputRef.current?.focus({ cursor: 'all' })
      else if (type === 'number') numberRef.current?.focus({ cursor: 'all' })
      else selectRef.current?.focus()
    } else if (refocus.current) {
      refocus.current = false
      displayRef.current?.focus()
    }
  }, [editing, type])

  // 显示的内容：编辑时也以不可见的形式保留（见下方的 sizer）
  const empty = isEmpty(shown)
  let content: ReactNode
  if (empty) content = p.placeholder ?? t('inlineEdit.empty')
  else if (p.render) content = p.render(shown as SelectValue)
  else if (type === 'number')
    content = formatDecimal(toDecimalText(shown) ?? String(shown), locale, p.precision)
  else if (type === 'select')
    content = p.options?.find((o) => Object.is(o.value, shown))?.label ?? String(shown)
  else content = String(shown)
  const hint = !p.disabled && (
    <span className={styles.hint} data-busy={showSpinner || undefined} aria-hidden="true">
      {showSpinner ? (
        <span className={loadingCss.spin}>
          <Icon name="loader" size={14} />
        </span>
      ) : (
        <Icon name="edit" size={14} />
      )}
    </span>
  )

  // —— 编辑状态 ——
  if (session) {
    const invalid = session.error !== null
    const a11y = {
      'aria-label': p.label,
      'aria-invalid': invalid || undefined,
      'aria-describedby': invalid ? errorId : undefined,
      status: invalid ? ('error' as const) : undefined,
      placeholder: p.placeholder ?? t('inlineEdit.empty'),
    }
    // 输入法组字时的 Enter / Esc 用于确认或取消候选词
    const composing = (e: KeyboardEvent) => e.nativeEvent.isComposing || e.keyCode === 229
    const cancelOnEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || composing(e)) return false
      // 只取消编辑，不让外层（对话框、批量操作栏）把同一次 Esc 当作关闭
      e.preventDefault()
      e.stopPropagation()
      close(true)
      return true
    }
    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
      if (cancelOnEscape(e) || composing(e)) return
      if (e.key === 'Enter' && type !== 'select') {
        // 阻止表单的隐式提交；数字输入框已在这次按键中写入取整后的值（见 sessionRef）
        e.preventDefault()
        commit(null)
      }
    }
    const onBlur = (e: FocusEvent<HTMLDivElement>) => {
      if (e.currentTarget.contains(e.relatedTarget as Node | null) || !sessionRef.current) return
      // 文字与数字失焦即保存；选择类型选中才保存，失焦等于取消
      if (type === 'select') close(false)
      else commit(e.relatedTarget ?? document.body)
    }
    let control: ReactNode
    if (type === 'number')
      control = (
        <InputNumber
          ref={numberRef}
          {...a11y}
          decimal
          controls={false}
          precision={p.precision}
          value={session.draft === null ? null : String(session.draft)}
          onChange={(v) => change(v)}
        />
      )
    else if (type === 'select')
      control = (
        <Select<SelectValue>
          ref={selectRef}
          {...a11y}
          defaultOpen={session.focus}
          popupMatchSelectWidth={false}
          value={session.draft ?? undefined}
          options={p.options?.map((o) => ({
            value: o.value,
            label: o.label,
            disabled: o.disabled,
          }))}
          // onSelect 而不是 onChange：选中原来的值也要结束编辑（onChange 只在值变化时调用）
          onSelect={(v) => commit(null, { value: v })}
          // 选项打开时 rc-select 自己处理 Esc（关闭选项）并阻止冒泡，外层收不到；它随后调用 onKeyDown，在这里取消编辑
          onKeyDown={cancelOnEscape}
        />
      )
    else
      control = (
        <Input
          ref={inputRef}
          {...a11y}
          maxLength={p.maxLength}
          value={session.draft === null ? '' : String(session.draft)}
          onChange={(e) => change(e.target.value)}
        />
      )
    return (
      <div className={styles.root} data-state="edit" data-type={type} data-testid={p.testId}>
        <div className={styles.frame}>
          {/*
           * 不可见地保留显示时的内容，编辑时占用的宽度与显示时相同：自动布局的表格按内容分配列宽，输入框自身的宽度
           * 会让这一列变宽、其他列变窄，文字随之移位。输入框绝对定位叠在上面，不参与列宽的计算
           */}
          <span className={`${styles.display} ${styles.sizer}`} aria-hidden="true">
            <span className={styles.value}>{content}</span>
            {hint}
          </span>
          {/* biome-ignore lint/a11y/noStaticElementInteractions: 只是收拢输入框的 Enter、Esc 与失焦，交互元素是里面的输入框 */}
          <div className={styles.field} onKeyDown={onKeyDown} onBlur={onBlur}>
            {control}
          </div>
        </div>
        {invalid && (
          <div id={errorId} className={styles.error} role="alert">
            {session.error}
          </div>
        )}
      </div>
    )
  }

  // —— 显示状态 ——
  const button = (
    <button
      ref={displayRef}
      type="button"
      className={styles.display}
      data-vl-state=""
      aria-label={t('inlineEdit.edit', { label: p.label })}
      aria-describedby={joinIds(valueId, blocked ? reasonId : undefined)}
      aria-busy={pending ? true : undefined}
      aria-disabled={blocked || undefined}
      disabled={p.disabled && !blocked}
      onClick={startEdit}
      onKeyDown={(e) => {
        if (e.key !== 'F2') return
        e.preventDefault()
        startEdit()
      }}
    >
      <span id={valueId} className={styles.value} data-empty={empty || undefined}>
        {content}
      </span>
      {hint}
    </button>
  )
  return (
    <div
      className={styles.root}
      data-state="view"
      data-type={type}
      data-pending={pending ? '' : undefined}
      data-testid={p.testId}
    >
      {blocked ? (
        <DisabledReasonTooltip id={reasonId} reason={p.disabledReason ?? ''}>
          {button}
        </DisabledReasonTooltip>
      ) : (
        button
      )}
    </div>
  )
}
