/**
 * 组件库内部共用的类型与工具，不从入口导出。
 * antd 只作为内部实现：封装组件的属性类型去掉 antd 定制外观的入口，使用方在类型层面就不能传样式。
 */

/** antd 组件上定制外观的属性。 */
export type StyleKeys =
  | 'style'
  | 'className'
  | 'rootClassName'
  | 'classNames'
  | 'styles'
  | 'prefixCls'

/** 弹层类组件（提示、气泡确认、下拉菜单）上已弃用的外观入口。 */
export type OverlayStyleKeys =
  | 'overlayClassName'
  | 'overlayStyle'
  | 'overlayInnerStyle'
  | 'openClassName'

/** 下拉类输入（选择器、日期）上已弃用的弹层外观入口。 */
export type PopupStyleKeys = 'popupClassName' | 'popupStyle' | 'dropdownClassName' | 'dropdownStyle'

/** antd 泛型参数的默认值：表单值、选项值的类型由调用方推断，与 antd 保持一致。 */
// biome-ignore lint/suspicious/noExplicitAny: 与 antd 的泛型默认值一致，否则未指定泛型的调用处（如 Form.useForm()）会失去类型推断
export type AnyValue = any

/** antd 的尺寸名称。本库对外统一用 `sm` / `md` / `lg`（ADR 0021），在这里换算。 */
type AntSize = 'small' | 'middle' | 'large'

/** 把本库的尺寸换算为 antd 的尺寸；省略时交给 antd 的默认值（随 ThemeProvider 的组件尺寸）。 */
export function toAntSize(size: 'sm' | 'md' | 'lg' | undefined): AntSize | undefined {
  return size === 'sm' ? 'small' : size === 'lg' ? 'large' : size === 'md' ? 'middle' : undefined
}

/**
 * 原生元素的属性，去掉定制外观的入口（`className`、`style`）与组件自有的同名属性（ADR 0021 §4）。
 * 渲染一个主要元素的组件（按钮、输入框、开关等）用它接收 `id`、`aria-*`、`data-*` 与事件。
 */
export type NativeProps<Attrs, Own> = Omit<Attrs, 'className' | 'style' | keyof Own>

/**
 * 合并组件自身的类名与运行时注入的类名。Dropdown、Tooltip 等通过 cloneElement 给子元素加类名（如
 * `ant-dropdown-trigger`）；使用方不能传 className，但这些运行时注入的类名必须保留，且不能覆盖组件自身的样式类。
 */
export function withInjected(own: string | undefined, rest: object): string | undefined {
  const injected = (rest as { className?: unknown }).className
  return typeof injected === 'string' && injected ? `${own ?? ''} ${injected}`.trim() : own
}

/**
 * 把错误交给全局的错误处理（控制台、错误监控）：调用方没有提供错误回调时（CopyButton 的 `onError`、
 * InlineEdit 的 `onError`），异常不能被悄悄吞掉。
 */
export function reportError(error: unknown): void {
  if (typeof globalThis.reportError === 'function') globalThis.reportError(error)
  else console.error(error)
}
