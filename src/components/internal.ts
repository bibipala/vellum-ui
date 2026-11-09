/**
 * 组件库内部共用的类型与工具，不从入口导出。
 * 统一尺寸换算、原生属性边界、运行时类名合并与错误报告。
 */

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
