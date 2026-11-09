/**
 * 设置行给控件命名：SettingRow 把标题与说明的 id 放进上下文，放在 `control` 中的表单控件读取它，
 * 作为自己的 `aria-labelledby` 与 `aria-describedby`。按钮等自带文字的控件不读取，名称仍是自己的文字。
 * 组件库内部使用，不从入口导出。
 */
import { createContext, useContext } from 'react'

/** 外层提供的标签：标题元素的 id，以及说明元素的 id（没有说明时省略）。 */
export interface FieldLabel {
  readonly labelledBy: string
  readonly describedBy?: string
}

/** SettingRow 只包住 `control`；其余位置（如 `children` 中的子设置）没有这个上下文。 */
export const FieldLabelContext = createContext<FieldLabel | null>(null)

/** 控件自己的读屏属性。 */
interface OwnAria {
  readonly 'aria-label'?: string
  readonly 'aria-labelledby'?: string
  readonly 'aria-describedby'?: string
}

/**
 * 控件要追加的读屏属性：控件自己有 `aria-label` 或 `aria-labelledby` 时不改名称；
 * 说明追加在控件自己的 `aria-describedby` 之后。`hasOwnLabel` 为 true（如带文字的 Checkbox）时也不改名称。
 * 返回的对象展开在控件自己的属性之后。
 */
export function useFieldLabel(
  own: OwnAria,
  hasOwnLabel = false,
): { 'aria-labelledby'?: string; 'aria-describedby'?: string } {
  const label = useContext(FieldLabelContext)
  if (!label) return {}
  const named = hasOwnLabel || Boolean(own['aria-label'] || own['aria-labelledby'])
  const describedBy = label.describedBy
    ? [own['aria-describedby'], label.describedBy].filter(Boolean).join(' ')
    : own['aria-describedby']
  return {
    ...(named ? {} : { 'aria-labelledby': label.labelledBy }),
    ...(describedBy ? { 'aria-describedby': describedBy } : {}),
  }
}
