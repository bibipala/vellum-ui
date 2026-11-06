/**
 * 输入组件的汇总入口（组件库内部使用）：各组件分别在 form、input、select、choice、date 中实现。
 * 分成多个文件是为了摇树：只用到其中一个组件时，打包工具不会带上其他组件（以前全部写在这个文件里，
 * 模块顶层读取 antd 的静态成员，只引入 Checkbox 也会带上 Form、TreeSelect）。
 */
export * from './choice.tsx'
export * from './date.tsx'
export * from './form.tsx'
export * from './input.tsx'
export * from './select.tsx'
