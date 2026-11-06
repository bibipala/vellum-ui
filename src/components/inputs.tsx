/**
 * 输入组件：表单、输入框、数字输入、选择器、树选择、复选、单选、开关、日期、分段控件。
 * antd 只作为内部实现；属性类型去掉 style / className 等外观入口，外观由 ThemeProvider 的令牌与本文件的样式统一定义。
 * 输入类组件统一为填充式（中性底、不描边，聚焦时显示强调色细边与光环），由 ThemeProvider 的 ConfigProvider 设定。
 */
import {
  Checkbox as AntCheckbox,
  type CheckboxProps as AntCheckboxProps,
  DatePicker as AntDatePicker,
  type DatePickerProps as AntDatePickerProps,
  Form as AntForm,
  type FormInstance as AntFormInstance,
  type FormItemProps as AntFormItemProps,
  type FormProps as AntFormProps,
  Input as AntInput,
  InputNumber as AntInputNumber,
  type InputNumberProps as AntInputNumberProps,
  type InputProps as AntInputProps,
  type InputRef as AntInputRef,
  Radio as AntRadio,
  type RadioGroupProps as AntRadioGroupProps,
  type RadioProps as AntRadioProps,
  Segmented as AntSegmented,
  type SegmentedProps as AntSegmentedProps,
  Select as AntSelect,
  type SelectProps as AntSelectProps,
  Switch as AntSwitch,
  type SwitchProps as AntSwitchProps,
  TreeSelect as AntTreeSelect,
  type TreeSelectProps as AntTreeSelectProps,
  type CheckboxRef,
  type GetProps,
  type GetRef,
  type RadioRef,
  type RefSelectProps,
} from 'antd'
import type { CheckboxGroupProps as AntCheckboxGroupProps } from 'antd/es/checkbox/index.js'
import type { BaseOptionType, DefaultOptionType } from 'antd/es/select/index.js'
import {
  type ChangeEvent,
  cloneElement,
  createContext,
  isValidElement,
  type JSX,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
  type RefAttributes,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { Icon } from './Icon.tsx'
import styles from './inputs.module.css'
import { type AnyValue, type PopupStyleKeys, type StyleKeys, withInjected } from './internal.ts'

// —— Form ——

/** 表单实例：`Form.useForm()` 的返回值，用于读写字段、触发校验与提交。 */
export type FormInstance<Values = AnyValue> = AntFormInstance<Values>

/** Form 属性。 */
export interface FormProps<Values = AnyValue>
  extends Omit<AntFormProps<Values>, StyleKeys | 'children'> {
  /**
   * Contents of the form: Form.Item fields, the submit button and so on.
   * @zh 表单内容：Form.Item 与提交按钮等。
   */
  readonly children?: ReactNode
}

/** Form.Item 属性。 */
export interface FormItemProps<Values = AnyValue>
  extends Omit<AntFormItemProps<Values>, StyleKeys> {}

type AntFormListProps = GetProps<typeof AntForm.List>
/** Form.List 属性。 */
export interface FormListProps extends Omit<AntFormListProps, StyleKeys> {}

type AntFormErrorListProps = GetProps<typeof AntForm.ErrorList>
/** Form.ErrorList 属性。 */
export interface FormErrorListProps extends Omit<AntFormErrorListProps, StyleKeys> {}

/** 使用方是否在 Form 上指定了 validateTrigger：指定了就照原样使用，不再按「先失焦、出错后随输入」调整。 */
const CustomTriggerContext = createContext(false)

/** 提交时滚动到第一个错误字段并聚焦（docs/11 §6.2「表单」）。 */
const SCROLL_TO_FIRST_ERROR = { focus: true, block: 'center' } as const

function FormRoot<Values = AnyValue>({
  scrollToFirstError = SCROLL_TO_FIRST_ERROR,
  ...rest
}: FormProps<Values>) {
  return (
    <CustomTriggerContext.Provider value={rest.validateTrigger !== undefined}>
      <AntForm<Values> {...rest} scrollToFirstError={scrollToFirstError} />
    </CustomTriggerContext.Provider>
  )
}

type AnyProps = Record<string, unknown>

/** 把 Form.Item 注入的属性交给真正的控件：事件处理函数与控件自己的合并（先 Form.Item 的，再控件的），引用也合并。 */
function mergeInjected(own: AnyProps, injected: AnyProps): AnyProps {
  const out: AnyProps = { ...own, ...injected }
  for (const [key, fn] of Object.entries(injected)) {
    const mine = own[key]
    if (key === 'ref' || typeof fn !== 'function' || typeof mine !== 'function') continue
    out[key] = (...args: unknown[]) => {
      ;(fn as (...a: unknown[]) => void)(...args)
      ;(mine as (...a: unknown[]) => void)(...args)
    }
  }
  const refs = [injected.ref, own.ref].filter(Boolean) as Ref<unknown>[]
  if (refs.length > 1)
    out.ref = (value: unknown) => {
      for (const r of refs)
        if (typeof r === 'function') r(value)
        else if (r) (r as { current: unknown }).current = value
    }
  return out
}

/**
 * 夹在 Form.Item 与控件之间：读取该字段当前是否有错误（Form.Item.useStatus），通知 FormItem 切换校验时机；
 * Form.Item 注入的取值、事件与引用原样交给控件。
 */
function ErrorProbe({
  onError,
  control,
  ...injected
}: { readonly onError: () => void; readonly control: ReactElement<AnyProps> } & AnyProps) {
  const { errors } = AntForm.Item.useStatus()
  const hasError = errors.length > 0
  useEffect(() => {
    if (hasError) onError()
  }, [hasError, onError])
  return cloneElement(control, mergeInjected(control.props, injected))
}

function FormItem<Values = AnyValue>({ children, ...rest }: FormItemProps<Values>) {
  const customTrigger = useContext(CustomTriggerContext)
  // 出过错的字段改为随输入校验（改正时错误立即消失）；此前只在失焦时校验，输入过程中不打断
  const [errored, setErrored] = useState(false)
  const [markErrored] = useState(() => () => setErrored(true))
  const plain =
    customTrigger ||
    rest.validateTrigger !== undefined ||
    rest.name === undefined ||
    !rest.rules?.length ||
    !isValidElement<AnyProps>(children)
  if (plain) return <AntForm.Item<Values> {...rest}>{children}</AntForm.Item>
  return (
    <AntForm.Item<Values> {...rest} validateTrigger={errored ? ['onBlur', 'onChange'] : 'onBlur'}>
      <ErrorProbe onError={markErrored} control={children} />
    </AntForm.Item>
  )
}

function FormList(props: FormListProps) {
  return <AntForm.List {...props} />
}

function FormErrorList(props: FormErrorListProps) {
  return <AntForm.ErrorList {...props} />
}

function useForm<Values = AnyValue>(form?: FormInstance<Values>): [FormInstance<Values>] {
  return AntForm.useForm<Values>(form)
}

/** Form 及其静态成员。 */
export interface FormComponent {
  /** 渲染表单。 */
  <Values = AnyValue>(props: FormProps<Values>): JSX.Element
  /** 表单项：标签、校验规则与错误提示。 */
  readonly Item: <Values = AnyValue>(props: FormItemProps<Values>) => JSX.Element
  /** 动态增减的一组字段。 */
  readonly List: (props: FormListProps) => JSX.Element
  /** 显示一组错误信息（配合 Form.List 的整体校验）。 */
  readonly ErrorList: (props: FormErrorListProps) => JSX.Element
  /** 创建表单实例。 */
  readonly useForm: <Values = AnyValue>(form?: FormInstance<Values>) => [FormInstance<Values>]
  /** 订阅字段值的变化。 */
  readonly useWatch: typeof AntForm.useWatch
}

/**
 * Collects, validates and submits data. Fields go in `Form.Item`, `Form.useForm()` returns the form instance and
 * `Form.List` manages fields that are added and removed dynamically. Fields are validated on blur, and submitting
 * scrolls to and focuses the first invalid field.
 *
 * **Interaction**: a field is validated on blur and does not interrupt typing; once it has shown an error, it is
 * validated on every change, so the error disappears as soon as it is corrected; errors appear below the field.
 * Submitting validates all fields, then scrolls to and focuses the first invalid one. When `validateTrigger` is set
 * on Form or Form.Item, validation follows it instead.
 * @zh 表单：收集、校验与提交数据。字段放在 `Form.Item` 中，`Form.useForm()` 取得表单实例，`Form.List` 管理动态增减的字段。
 * 表单在失焦时校验，提交时滚动并聚焦到第一个错误字段。
 *
 * **交互**：字段在失焦时校验，输入过程中不打断；出过错的字段改为随输入校验，改正后错误立即消失；错误显示在字段下方；
 * 提交时校验全部字段，滚动并聚焦到第一个错误字段。在 Form 或 Form.Item 上指定 `validateTrigger` 时按指定的时机校验。
 * @category Basic
 * @usage Create and edit dialogs, settings pages, sign-in
 * @usageZh 新建与编辑弹窗、设置页、登录
 */
export const Form: FormComponent = /* @__PURE__ */ Object.assign(FormRoot, {
  Item: FormItem,
  List: FormList,
  ErrorList: FormErrorList,
  useForm,
  useWatch: AntForm.useWatch,
})

// —— Input ——

/** 输入框的引用：`focus()`、`blur()`、`select()`、`input`（原生元素）。 */
export type InputRef = AntInputRef

/** Input 属性。 */
export interface InputProps extends Omit<AntInputProps, StyleKeys>, RefAttributes<InputRef> {
  /**
   * Tabular numbers for numeric input such as amounts, quantities and reference numbers: every digit has the same
   * width, which makes values easy to align and check (same as `<Text numeric>`).
   * @zh 等宽数字：金额、数量、编号等数字输入，数字位宽一致便于对齐与核对（与 `<Text numeric>` 一致）。
   */
  readonly numeric?: boolean
}

type AntPasswordProps = GetProps<typeof AntInput.Password>
/** Input.Password 属性。 */
export interface InputPasswordProps
  extends Omit<AntPasswordProps, StyleKeys | 'ref'>,
    RefAttributes<InputRef> {}

/** Input.Search 的 `onSearch` 回调的来源：回车（`input`）或点清除按钮（`clear`）。 */
export interface InputSearchInfo {
  /** `input`：按回车；`clear`：点清除按钮。 */
  readonly source?: 'clear' | 'input'
}

/**
 * Input.Search 属性。
 *
 * 不附着搜索按钮：搜索图标放在框内前面，回车触发 `onSearch`。antd 的 `enterButton`、
 * `searchIcon` 不支持（类型中已去掉），从 antd 迁移时直接删掉 `enterButton` 即可，回车搜索的行为不变。
 * 前置图标固定为搜索图标，因此也不接受 `prefix`。
 */
export interface InputSearchProps
  extends Omit<AntInputProps, StyleKeys | 'prefix'>,
    RefAttributes<InputRef> {
  /**
   * 搜索：按回车时以当前文字触发；`allowClear` 时点清除按钮以空字符串触发（`info.source` 为 `clear`）。
   * 输入法组字过程中的回车、`loading` 期间的回车不触发。
   */
  readonly onSearch?: (
    value: string,
    event?: ChangeEvent<HTMLInputElement> | KeyboardEvent<HTMLInputElement>,
    info?: InputSearchInfo,
  ) => void
  /** 搜索中：框内的搜索图标换成转动的加载指示，期间回车不重复触发。 */
  readonly loading?: boolean
}

type AntTextAreaProps = GetProps<typeof AntInput.TextArea>
/** 多行输入框的引用。 */
export type TextAreaRef = GetRef<typeof AntInput.TextArea>
/** Input.TextArea 属性。 */
export interface InputTextAreaProps
  extends Omit<AntTextAreaProps, StyleKeys | 'ref'>,
    RefAttributes<TextAreaRef> {}

function InputRoot({ numeric, ...rest }: InputProps) {
  return <AntInput {...rest} className={withInjected(numeric ? styles.numeric : undefined, rest)} />
}

function InputPassword(props: InputPasswordProps) {
  return <AntInput.Password {...props} />
}

function InputSearch({
  onSearch,
  loading,
  onPressEnter,
  onChange,
  onCompositionStart,
  onCompositionEnd,
  ...rest
}: InputSearchProps) {
  // 输入法组字时的回车用于确认候选词，不是搜索（与 antd 的 Input.Search 一致，用组字事件判断）
  const composing = useRef(false)
  return (
    <AntInput
      // type=search：读屏识别为搜索框；antd 已隐藏浏览器自带的清除按钮
      type="search"
      enterKeyHint="search"
      {...rest}
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
        onSearch?.(e.currentTarget.value, e, { source: 'input' })
      }}
      onChange={(e) => {
        // antd 的清除按钮以 click 事件调用 onChange，此时输入框的值已是空字符串
        if (e.type === 'click') onSearch?.(e.target.value, e, { source: 'clear' })
        onChange?.(e)
      }}
    />
  )
}

function InputTextArea(props: InputTextAreaProps) {
  return <AntInput.TextArea {...props} />
}

/** Input 及其静态成员。 */
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

/** 数字输入框的引用。 */
export type InputNumberRef = GetRef<typeof AntInputNumber>

/** InputNumber 属性。 */
export interface InputNumberProps<T extends string | number = string | number>
  extends Omit<AntInputNumberProps<T>, StyleKeys>,
    RefAttributes<InputNumberRef> {}

/**
 * Numeric input with step buttons and tabular numbers. For exact values such as amounts and quantities, use
 * `stringMode`: the value is passed as a string and never goes through floating point.
 * @zh 数字输入框：带步进按钮，数字使用等宽字形。金额、数量等精确值用 `stringMode`，以字符串传递，不经过浮点。
 * @category Basic
 * @usage Numeric settings such as days, time limits, quantities and sort order
 * @usageZh 天数、时限、数量、排序号等数值设置
 */
export function InputNumber<T extends string | number = string | number>(
  props: InputNumberProps<T>,
) {
  return <AntInputNumber<T> {...props} className={withInjected(styles.numeric, props)} />
}

// —— Select ——

/** 选择器的引用：`focus()`、`blur()`、`scrollTo()`。 */
export type SelectRef = RefSelectProps

/** Select 属性。 */
export interface SelectProps<
  V = AnyValue,
  O extends BaseOptionType | DefaultOptionType = DefaultOptionType,
> extends Omit<AntSelectProps<V, O>, StyleKeys | PopupStyleKeys>,
    RefAttributes<SelectRef> {
  /**
   * Fills the width of the container. Use it for selects in form fields, and outside forms when the select must be
   * as wide as other inputs.
   * @zh 占满容器宽度。表单项中的选择器、表单以外需要与其他输入框等宽时使用。
   */
  readonly block?: boolean
}

/**
 * Selects one or several (`mode="multiple"`) values from a list of options; add `showSearch` when there are many
 * options.
 * @zh 选择器：从一组选项中选择一个或多个（`mode="multiple"`），选项多时加 `showSearch`。
 * @category Basic
 * @usage Filters, enumerated form fields, choosing members and roles
 * @usageZh 筛选条件、表单中的枚举字段、成员与角色选择
 */
export function Select<
  V = AnyValue,
  O extends BaseOptionType | DefaultOptionType = DefaultOptionType,
>({ block, ...rest }: SelectProps<V, O>) {
  return (
    <AntSelect<V, O> {...rest} className={withInjected(block ? styles.block : undefined, rest)} />
  )
}

// —— TreeSelect ——

/** 树选择的节点数据。 */
export type TreeSelectNode = NonNullable<AntTreeSelectProps['treeData']>[number]

/** TreeSelect 属性。 */
export interface TreeSelectProps<V = AnyValue, O extends TreeSelectNode = TreeSelectNode>
  extends Omit<AntTreeSelectProps<V, O>, StyleKeys | PopupStyleKeys>,
    RefAttributes<SelectRef> {
  /**
   * Fills the width of the container. Use it for tree selects in form fields, and outside forms when the tree
   * select must be as wide as other inputs.
   * @zh 占满容器宽度。表单项中的树选择、表单以外需要与其他输入框等宽时使用。
   */
  readonly block?: boolean
}

function TreeSelectRoot<V = AnyValue, O extends TreeSelectNode = TreeSelectNode>({
  block,
  ...rest
}: TreeSelectProps<V, O>) {
  return (
    <AntTreeSelect<V, O>
      {...rest}
      className={withInjected(block ? styles.block : undefined, rest)}
    />
  )
}

/** TreeSelect 及其静态成员。 */
export interface TreeSelectComponent {
  /** 渲染树选择。 */
  <V = AnyValue, O extends TreeSelectNode = TreeSelectNode>(
    props: TreeSelectProps<V, O>,
  ): JSX.Element
  /** 回填策略：显示所有选中的节点。 */
  readonly SHOW_ALL: typeof AntTreeSelect.SHOW_ALL
  /** 回填策略：子节点全选时只显示父节点。 */
  readonly SHOW_PARENT: typeof AntTreeSelect.SHOW_PARENT
  /** 回填策略：只显示子节点。 */
  readonly SHOW_CHILD: typeof AntTreeSelect.SHOW_CHILD
}

/**
 * Selects nodes from hierarchical data such as teams or folders. Supports multiple selection (`multiple` /
 * `treeCheckable`); how checked nodes are shown in the field is set with the static members such as
 * `SHOW_PARENT`.
 * @zh 树选择：从树形数据（团队、文件夹）中选择节点。可多选（`multiple` / `treeCheckable`），回填策略用静态成员 `SHOW_PARENT` 等。
 * @category Basic
 * @usage Choosing a team, a parent folder or a category
 * @usageZh 选择团队、上级文件夹、分类
 */
export const TreeSelect: TreeSelectComponent = /* @__PURE__ */ Object.assign(TreeSelectRoot, {
  SHOW_ALL: AntTreeSelect.SHOW_ALL,
  SHOW_PARENT: AntTreeSelect.SHOW_PARENT,
  SHOW_CHILD: AntTreeSelect.SHOW_CHILD,
})

// —— Checkbox ——

/** Checkbox 属性。 */
export interface CheckboxProps
  extends Omit<AntCheckboxProps, StyleKeys>,
    RefAttributes<CheckboxRef> {}

/** Checkbox.Group 属性。 */
export interface CheckboxGroupProps<T = AnyValue>
  extends Omit<AntCheckboxGroupProps<T>, StyleKeys>,
    RefAttributes<HTMLDivElement> {}

function CheckboxRoot(props: CheckboxProps) {
  return <AntCheckbox {...props} />
}

function CheckboxGroup<T = AnyValue>(props: CheckboxGroupProps<T>) {
  return <AntCheckbox.Group<T> {...props} />
}

/** Checkbox 及其静态成员。 */
export interface CheckboxComponent {
  /** 渲染单个复选框。 */
  (props: CheckboxProps): JSX.Element
  /** 一组复选框：用 `options` 或子元素给出选项，值为选中项的数组。 */
  readonly Group: <T = AnyValue>(props: CheckboxGroupProps<T>) => JSX.Element
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

/** Radio 属性。 */
export interface RadioProps extends Omit<AntRadioProps, StyleKeys>, RefAttributes<RadioRef> {}

/** Radio.Group 属性。 */
export interface RadioGroupProps
  extends Omit<AntRadioGroupProps, StyleKeys>,
    RefAttributes<HTMLDivElement> {}

type AntRadioButtonProps = GetProps<typeof AntRadio.Button>
/** Radio.Button 属性。 */
export interface RadioButtonProps
  extends Omit<AntRadioButtonProps, StyleKeys | 'ref'>,
    RefAttributes<RadioRef> {}

function RadioRoot(props: RadioProps) {
  return <AntRadio {...props} />
}

function RadioGroup(props: RadioGroupProps) {
  return <AntRadio.Group {...props} />
}

function RadioButton(props: RadioButtonProps) {
  return <AntRadio.Button {...props} />
}

/** Radio 及其静态成员。 */
export interface RadioComponent {
  /** 渲染单个单选项。 */
  (props: RadioProps): JSX.Element
  /** 一组单选：用 `options` 或子元素给出选项。 */
  readonly Group: (props: RadioGroupProps) => JSX.Element
  /** 按钮样式的单选项，放在 Radio.Group 中。两三个选项的视图切换优先用 Segmented。 */
  readonly Button: (props: RadioButtonProps) => JSX.Element
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

/** Switch 属性。 */
export interface SwitchProps
  extends Omit<AntSwitchProps, StyleKeys>,
    RefAttributes<HTMLButtonElement> {}

/**
 * Switch for an on/off setting that takes effect immediately. Options that take effect on submit use Checkbox.
 * Update optimistically when toggled; if the change fails, roll it back and show a message.
 * @zh 开关：立即生效的二元设置。需要提交才生效的选项用 Checkbox。
 * 切换时请乐观更新，失败后回滚并用消息条提示。
 * @category Basic
 * @usage Toggles in setting rows, enabling and disabling, showing disabled records
 * @usageZh 设置行的开关、启用与停用、显示已停用的记录
 */
export function Switch(props: SwitchProps) {
  return <AntSwitch {...props} />
}

// —— DatePicker ——

/** 日期值（dayjs 对象）。 */
export type DateValue = Exclude<NonNullable<AntDatePickerProps['value']>, readonly unknown[]>

/** DatePicker 属性。 */
export interface DatePickerProps<V = DateValue, M extends boolean = false>
  extends Omit<AntDatePickerProps<V, M>, StyleKeys | PopupStyleKeys> {}

type AntRangePickerProps = GetProps<typeof AntDatePicker.RangePicker>
/** DatePicker.RangePicker 属性。 */
export interface RangePickerProps
  extends Omit<AntRangePickerProps, StyleKeys | PopupStyleKeys | 'ref'>,
    RefAttributes<GetRef<typeof AntDatePicker.RangePicker>> {}

function DatePickerRoot<V = DateValue, M extends boolean = false>(props: DatePickerProps<V, M>) {
  return <AntDatePicker<V, M> {...props} />
}

function RangePicker(props: RangePickerProps) {
  return <AntDatePicker.RangePicker {...props} />
}

/** DatePicker 及其静态成员。 */
export interface DatePickerComponent {
  /** 渲染日期选择。 */
  <V = DateValue, M extends boolean = false>(props: DatePickerProps<V, M>): JSX.Element
  /** 日期范围选择：开始与结束两个日期。 */
  readonly RangePicker: (props: RangePickerProps) => JSX.Element
}

/**
 * Date picker: picks a date (with a time when `showTime` is set, or a month with `picker="month"`). Use
 * `DatePicker.RangePicker` for a date range.
 * @zh 日期选择：选择日期（`showTime` 时含时间、`picker="month"` 选月份）。日期范围用 `DatePicker.RangePicker`。
 * @category Basic
 * @usage Date filters, due dates, start dates
 * @usageZh 筛选日期、到期日、开始日期
 */
export const DatePicker: DatePickerComponent = /* @__PURE__ */ Object.assign(DatePickerRoot, {
  RangePicker,
})

// —— Segmented ——

/** Segmented 属性。 */
export interface SegmentedProps<V = string | number>
  extends Omit<AntSegmentedProps<V>, StyleKeys>,
    RefAttributes<HTMLDivElement> {}

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
export function Segmented<V = string | number>(props: SegmentedProps<V>) {
  // antd 的根元素 tabIndex=0，但方向键只在内部的单选框上生效：键盘用户要按两次 Tab 才能操作。
  // 根元素移出 Tab 顺序，Tab 直接落到当前选项上
  return <AntSegmented<V> tabIndex={-1} {...props} />
}
