/**
 * 表单：Form、Form.Item 与表单实例。
 * antd 只作为内部实现，对外的实例、校验规则与属性由本库声明（ADR 0021）。
 * 字段在失焦时校验，出过错的字段改为随输入校验；提交时滚动并聚焦到第一个错误字段（docs/11 §6.2「表单」）。
 */
import { Form as AntForm } from 'antd'
import {
  cloneElement,
  createContext,
  type FormHTMLAttributes,
  isValidElement,
  type JSX,
  type ReactElement,
  type ReactNode,
  type Ref,
  useContext,
  useEffect,
  useState,
} from 'react'

// antd 的属性类型与本库的声明在结构上兼容，但 antd 的泛型与重载让直接传递很繁琐：内部统一转成宽松的对象再交给 antd
type Loose = Record<string, unknown>

/**
 * Values of a form: field name → value.
 * @zh 表单的值：字段名 → 值。
 */
export type FormValues = Record<string, unknown>

/**
 * Name of a field: a string, or a path such as `['address', 'city']` for nested values.
 * @zh 字段名：字符串，或嵌套值的路径，如 `['address', 'city']`。
 */
export type FieldName = string | number | readonly (string | number)[]

/**
 * A validation rule of Form.Item. Several conditions in one rule must all hold; give `message` for the text shown
 * when the rule fails.
 * @zh Form.Item 的校验规则。一条规则中的多个条件必须同时满足；`message` 是规则不满足时显示的文字。
 */
export interface FormRule {
  /**
   * The field must have a value.
   * @zh 必须填写。
   */
  readonly required?: boolean
  /**
   * With `required`, text consisting only of spaces counts as empty.
   * @zh 与 `required` 一起使用：只有空格的文字也算没有填写。
   */
  readonly whitespace?: boolean
  /**
   * Kind of value: an `email` address, a `url`, a `number` or an `integer`.
   * @zh 值的种类：邮箱（`email`）、网址（`url`）、数字（`number`）或整数（`integer`）。
   */
  readonly type?: 'email' | 'url' | 'number' | 'integer'
  /**
   * The text must match this regular expression.
   * @zh 文字必须匹配这个正则表达式。
   */
  readonly pattern?: RegExp
  /**
   * Smallest length of text or arrays, or smallest number.
   * @zh 文字或数组的最小长度，或数字的最小值。
   */
  readonly min?: number
  /**
   * Largest length of text or arrays, or largest number.
   * @zh 文字或数组的最大长度，或数字的最大值。
   */
  readonly max?: number
  /**
   * Exact length of text or arrays.
   * @zh 文字或数组的长度必须等于它。
   */
  readonly len?: number
  /**
   * Custom check: return (or resolve to) an error text when the value is invalid, nothing when it is valid.
   * @zh 自定义校验：值无效时返回（或解析为）错误文字，有效时什么也不返回。
   */
  readonly validator?: (value: unknown) => string | undefined | Promise<string | undefined>
  /**
   * Text shown when the rule fails. Without it, a default text in the language of the ThemeProvider is shown.
   * @zh 规则不满足时显示的文字。省略时显示随 ThemeProvider 语言的默认文字。
   */
  readonly message?: ReactNode
}

/**
 * A field that failed validation.
 * @zh 校验失败的字段。
 */
export interface FormFieldError {
  /**
   * Path of the field.
   * @zh 字段的路径。
   */
  readonly name: readonly (string | number)[]
  /**
   * The error texts.
   * @zh 错误文字。
   */
  readonly errors: readonly string[]
}

/**
 * What `onFinishFailed` receives: the values and the fields that failed validation.
 * @zh `onFinishFailed` 收到的内容：表单的值与校验失败的字段。
 */
export interface FormFinishFailedInfo<V extends object = FormValues> {
  /**
   * The values of the form.
   * @zh 表单的值。
   */
  readonly values: V
  /**
   * The fields that failed validation.
   * @zh 校验失败的字段。
   */
  readonly errorFields: readonly FormFieldError[]
}

/**
 * The form instance returned by `Form.useForm()`: reads and writes values, validates, submits and resets.
 * @zh `Form.useForm()` 返回的表单实例：读写值、校验、提交与重置。
 */
export interface FormInstance<V extends object = FormValues> {
  /**
   * All values of the form.
   * @zh 表单的全部值。
   */
  getFieldsValue(): V
  /**
   * Value of one field.
   * @zh 一个字段的值。
   */
  getFieldValue(name: FieldName): unknown
  /**
   * Sets the values of some fields; the others keep their values.
   * @zh 设置部分字段的值，其余字段不变。
   */
  setFieldsValue(values: Partial<V>): void
  /**
   * Sets the value of one field.
   * @zh 设置一个字段的值。
   */
  setFieldValue(name: FieldName, value: unknown): void
  /**
   * Resets the fields (all of them by default) to their initial values and clears the errors.
   * @zh 把字段（默认全部）恢复为初始值并清除错误。
   */
  resetFields(names?: readonly FieldName[]): void
  /**
   * Validates the fields (all of them by default). Resolves to the values when they are valid; rejects with
   * `{ errorFields }` otherwise.
   * @zh 校验字段（默认全部）。全部有效时解析为表单的值，否则以 `{ errorFields }` 拒绝。
   */
  validateFields(names?: readonly FieldName[]): Promise<V>
  /**
   * Submits the form: validates, then calls `onFinish` or `onFinishFailed`.
   * @zh 提交表单：先校验，然后调用 `onFinish` 或 `onFinishFailed`。
   */
  submit(): void
  /**
   * Scrolls a field into view.
   * @zh 把字段滚动到可见区域。
   */
  scrollToField(name: FieldName): void
}

/** Form 自有的属性。 */
interface FormOwnProps<V extends object> {
  /**
   * The form instance from `Form.useForm()`, to read and write the form from outside.
   * @zh `Form.useForm()` 返回的表单实例，用于在表单外部读写。
   */
  readonly form?: FormInstance<V>
  /**
   * Layout of the fields: `vertical` (label above the field, the usual choice), `horizontal` (label on the left)
   * or `inline` (fields in one row, such as a filter bar).
   * @zh 字段的布局：`vertical` 标签在上（通常用它），`horizontal` 标签在左，`inline` 字段排成一行（如筛选栏）。
   * @default 'horizontal'
   */
  readonly layout?: 'vertical' | 'horizontal' | 'inline'
  /**
   * Initial values of the fields.
   * @zh 字段的初始值。
   */
  readonly initialValues?: Partial<V>
  /**
   * Called with the values when the form is submitted and every field is valid.
   * @zh 提交且全部字段有效时调用，参数是表单的值。
   */
  readonly onFinish?: (values: V) => void
  /**
   * Called when the form is submitted but some fields are invalid.
   * @zh 提交但有字段无效时调用。
   */
  readonly onFinishFailed?: (info: FormFinishFailedInfo<V>) => void
  /**
   * Called when the user changes a value, with the changed values and all values.
   * @zh 用户修改值时调用，参数是变化的值与全部的值。
   */
  readonly onValuesChange?: (changed: Partial<V>, values: V) => void
  /**
   * Disables all fields.
   * @zh 禁用全部字段。
   */
  readonly disabled?: boolean
  /**
   * Marks required fields: `true` (the default), `false` for no mark, or `optional` to mark the optional fields
   * instead.
   * @zh 必填标记：`true`（默认）、`false` 不显示，`optional` 改为标记选填的字段。
   * @default true
   */
  readonly requiredMark?: boolean | 'optional'
  /**
   * When fields are validated, for example `onChange`. By default a field is validated on blur, and on every change
   * once it has shown an error.
   * @zh 字段在什么时候校验，如 `onChange`。默认在失焦时校验，出过错之后随输入校验。
   */
  readonly validateTrigger?: string | readonly string[]
  /**
   * Name of the form; it prefixes the ids of the fields.
   * @zh 表单名，作为字段 id 的前缀。
   */
  readonly name?: string
  /**
   * Contents of the form: Form.Item fields, the submit button and so on.
   * @zh 表单内容：Form.Item 与提交按钮等。
   */
  readonly children?: ReactNode
  /**
   * The native `<form>` element.
   * @zh 原生的 `<form>` 元素。
   */
  readonly ref?: Ref<HTMLFormElement>
}

/**
 * Props of Form.
 * @zh Form 属性。
 */
export interface FormProps<V extends object = FormValues>
  extends FormOwnProps<V>,
    Omit<
      FormHTMLAttributes<HTMLFormElement>,
      'className' | 'style' | 'onSubmit' | 'onReset' | keyof FormOwnProps<V>
    > {}

/** Form.Item 自有的属性。 */
interface FormItemOwnProps {
  /**
   * Name of the field in the form values. Without it, the item is only a label and a layout around its children.
   * @zh 字段在表单值中的名字。省略时 Form.Item 只是包着子元素的标签与布局。
   */
  readonly name?: FieldName
  /**
   * Label of the field.
   * @zh 字段的标签。
   */
  readonly label?: ReactNode
  /**
   * Validation rules.
   * @zh 校验规则。
   */
  readonly rules?: readonly FormRule[]
  /**
   * Shows the required mark. Use `rules` with `required` to actually check it.
   * @zh 显示必填标记。真正的检查要用带 `required` 的 `rules`。
   */
  readonly required?: boolean
  /**
   * Hint below the field; replaced by the error while there is one.
   * @zh 字段下方的提示；有错误时显示错误。
   */
  readonly help?: ReactNode
  /**
   * Additional text below the field, shown together with errors.
   * @zh 字段下方的补充说明，与错误同时显示。
   */
  readonly extra?: ReactNode
  /**
   * Initial value of this field.
   * @zh 这个字段的初始值。
   */
  readonly initialValue?: unknown
  /**
   * Name of the prop of the control that holds the value, such as `checked` for Checkbox and Switch.
   * @zh 控件中存放值的属性名，如 Checkbox 与 Switch 的 `checked`。
   * @default 'value'
   */
  readonly valuePropName?: string
  /**
   * Shows a status without a rule, for checks done elsewhere (such as on the server).
   * @zh 不用规则而直接显示状态，用于在别处（如服务端）完成的检查。
   */
  readonly status?: 'error' | 'warning' | 'success' | 'validating'
  /**
   * When this field is validated; see the `validateTrigger` of Form.
   * @zh 这个字段在什么时候校验；见 Form 的 `validateTrigger`。
   */
  readonly validateTrigger?: string | readonly string[]
  /**
   * Hides the field but keeps its value in the form.
   * @zh 隐藏字段，但它的值仍在表单中。
   */
  readonly hidden?: boolean
  /**
   * The control, such as an Input. With `name`, it receives `value` and `onChange` from the form.
   * @zh 控件，如 Input。有 `name` 时，它从表单接收 `value` 与 `onChange`。
   */
  readonly children?: ReactNode
}

/**
 * Props of Form.Item.
 * @zh Form.Item 属性。
 */
export interface FormItemProps extends FormItemOwnProps {}

/** 使用方是否在 Form 上指定了 validateTrigger：指定了就照原样使用，不再按「先失焦、出错后随输入」调整。 */
const CustomTriggerContext = createContext(false)

/** 提交时滚动到第一个错误字段并聚焦（docs/11 §6.2「表单」）。 */
const SCROLL_TO_FIRST_ERROR = { focus: true, block: 'center' } as const

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

function toAntRule(rule: FormRule): Loose {
  const { validator, ...rest } = rule
  if (!validator) return rest
  return {
    ...rest,
    validator: async (_: unknown, value: unknown) => {
      const error = await validator(value)
      if (error) throw new Error(error)
    },
  }
}

function FormRoot<V extends object = FormValues>({ validateTrigger, ...rest }: FormProps<V>) {
  return (
    <CustomTriggerContext.Provider value={validateTrigger !== undefined}>
      <AntForm
        {...(rest as Loose)}
        validateTrigger={validateTrigger as string | string[] | undefined}
        scrollToFirstError={SCROLL_TO_FIRST_ERROR}
      />
    </CustomTriggerContext.Provider>
  )
}

function FormItem({ children, status, rules, validateTrigger, name, ...rest }: FormItemProps) {
  const customTrigger = useContext(CustomTriggerContext)
  // 出过错的字段改为随输入校验（改正时错误立即消失）；此前只在失焦时校验，输入过程中不打断
  const [errored, setErrored] = useState(false)
  const [markErrored] = useState(() => () => setErrored(true))
  const common = {
    ...rest,
    name: name as Loose['name'],
    validateStatus: status,
    rules: rules?.map(toAntRule),
  } as Loose
  const plain =
    customTrigger ||
    validateTrigger !== undefined ||
    name === undefined ||
    !rules?.length ||
    !isValidElement<AnyProps>(children)
  if (plain)
    return (
      <AntForm.Item {...common} validateTrigger={validateTrigger as string | string[] | undefined}>
        {children}
      </AntForm.Item>
    )
  return (
    <AntForm.Item {...common} validateTrigger={errored ? ['onBlur', 'onChange'] : 'onBlur'}>
      <ErrorProbe onError={markErrored} control={children} />
    </AntForm.Item>
  )
}

function useForm<V extends object = FormValues>(): [FormInstance<V>] {
  const [form] = AntForm.useForm()
  return [form as unknown as FormInstance<V>]
}

/**
 * Form and its static members.
 * @zh Form 及其静态成员。
 */
export interface FormComponent {
  /** 渲染表单。 */
  <V extends object = FormValues>(props: FormProps<V>): JSX.Element
  /** 表单项：标签、校验规则与错误提示。 */
  readonly Item: (props: FormItemProps) => JSX.Element
  /** 创建表单实例。 */
  readonly useForm: <V extends object = FormValues>() => [FormInstance<V>]
}

/**
 * Collects, validates and submits data. Fields go in `Form.Item` and `Form.useForm()` returns the form instance. Fields
 * are validated on blur, and submitting scrolls to and focuses the first invalid field.
 *
 * **Interaction**: a field is validated on blur and does not interrupt typing; once it has shown an error, it is
 * validated on every change, so the error disappears as soon as it is corrected; errors appear below the field.
 * Submitting validates all fields, then scrolls to and focuses the first invalid one. When `validateTrigger` is set
 * on Form or Form.Item, validation follows it instead.
 * @zh 表单：收集、校验与提交数据。字段放在 `Form.Item` 中，`Form.useForm()` 取得表单实例。
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
  useForm,
})
