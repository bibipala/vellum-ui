/**
 * 指标卡增减的方向与颜色（纯函数）。颜色 = 方向 × 是否向好：向好为成功色，变差为危险色，`goodWhen: 'none'` 或
 * 没有变化时为次要文字色。方向总是同时用箭头与正负号表达，颜色只是辅助（docs/11 §4：状态色总要配图标与文字）。
 */

/** 增减方向。 */
export type DeltaDirection = 'up' | 'down' | 'flat'

/** 增减的语气：向好、变差、中性。 */
export type DeltaTone = 'good' | 'bad' | 'neutral'

/** 哪个方向是好的：`up` 越大越好（收入），`down` 越小越好（错误数、耗时），`none` 不评价好坏。 */
export type DeltaGoodWhen = 'up' | 'down' | 'none'

/** 显示用的负号：真正的减号（U+2212），比连字符宽，与加号对称。 */
export const MINUS_SIGN = '−'

/**
 * 增减方向。按格式化后的文字判断「没有变化」：0.0004 按百分比写成「0%」时算持平，不显示「+0%」与上升箭头。
 * @param value 增减值
 * @param shown 绝对值格式化后的文字
 * @param zero 0 格式化后的文字
 */
export function deltaDirection(value: number, shown: string, zero: string): DeltaDirection {
  if (!Number.isFinite(value) || value === 0 || shown === zero) return 'flat'
  return value > 0 ? 'up' : 'down'
}

/** 增减的语气：方向 × 哪个方向是好的。 */
export function deltaTone(direction: DeltaDirection, goodWhen: DeltaGoodWhen): DeltaTone {
  if (direction === 'flat' || goodWhen === 'none') return 'neutral'
  return direction === goodWhen ? 'good' : 'bad'
}

/** 带正负号的显示文字：`+12.5%`、`−3.2%`；持平时不带符号。 */
export function signedText(direction: DeltaDirection, shown: string): string {
  return direction === 'up' ? `+${shown}` : direction === 'down' ? `${MINUS_SIGN}${shown}` : shown
}
