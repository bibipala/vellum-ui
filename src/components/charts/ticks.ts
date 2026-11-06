/**
 * 数值轴的刻度（纯函数）：刻度取整（1、2、2.5、5 × 10ⁿ），并决定整条轴用全写还是紧凑写法。
 *
 * 刻度由这里计算后交给 ECharts（min / max / interval），而不是让 ECharts 自己取：「轴的最大值 ≥ 10,000 时
 * 整条轴用紧凑写法」需要在格式化之前知道轴的最大值；同一份结果也用于测试。
 */
import { COMPACT_FROM, formatValue, type ValueFormat } from './format.ts'

/** 一条数值轴的范围与刻度间隔。 */
export interface AxisTicks {
  readonly min: number
  readonly max: number
  readonly step: number
}

const NICE = [1, 2, 2.5, 5, 10] as const

/** 去掉浮点误差：按刻度间隔的小数位取整。 */
function snap(v: number, step: number): number {
  const digits = Math.max(0, -Math.floor(Math.log10(step)) + 2)
  return Number(v.toFixed(Math.min(20, digits)))
}

/**
 * 取整的刻度。
 * @param lo - 数据最小值。
 * @param hi - 数据最大值。
 * @param count - 期望的刻度间隔数（实际可能多一两个）。
 * @param options - `zero`：范围包含 0（柱状图、面积图的基线）；`integer`：数据都是整数时不出现小数刻度。
 */
export function niceTicks(
  lo: number,
  hi: number,
  count: number,
  options: { readonly zero?: boolean; readonly integer?: boolean } = {},
): AxisTicks {
  let a = Number.isFinite(lo) ? lo : 0
  let b = Number.isFinite(hi) ? hi : 0
  if (a > b) [a, b] = [b, a]
  if (options.zero) {
    a = Math.min(a, 0)
    b = Math.max(b, 0)
  }
  if (a === b) {
    // 只有一个值（或全是 0）：给出以它为端点的一段范围
    if (a === 0) b = 1
    else if (a > 0) a = options.zero ? 0 : a - Math.abs(a) * 0.5
    else b = options.zero ? 0 : b + Math.abs(b) * 0.5
    if (a === b) b = a + 1
  }
  const raw = (b - a) / Math.max(1, count)
  const mag = 10 ** Math.floor(Math.log10(raw))
  const norm = raw / mag
  let step = (NICE.find((n) => norm <= n) ?? 10) * mag
  if (options.integer && step < 1) step = 1
  const min = snap(Math.floor(a / step + 1e-9) * step, step)
  const max = snap(Math.ceil(b / step - 1e-9) * step, step)
  return { min, max: max === min ? snap(min + step, step) : max, step: snap(step, step) }
}

/** 轴上每个刻度的取值（含两端）。 */
export function tickValues(t: AxisTicks): number[] {
  const out: number[] = []
  const n = Math.round((t.max - t.min) / t.step)
  for (let i = 0; i <= n; i++) out.push(snap(t.min + i * t.step, t.step))
  return out
}

/**
 * 整条轴用同一种写法：`auto` 时轴的最大绝对值 ≥ 10,000 用紧凑写法（0 · 10K · 20K），否则写全（0 · 1,000 · 2,000）。
 * 其他写法（百分比、自定义函数等）照用。
 */
export function axisFormat(format: ValueFormat, ticks: AxisTicks): ValueFormat {
  if (format !== 'auto') return format
  return Math.max(Math.abs(ticks.min), Math.abs(ticks.max)) >= COMPACT_FROM ? 'compact' : 'number'
}

/** 刻度文字的格式化函数。 */
export function axisLabeler(
  format: ValueFormat,
  ticks: AxisTicks,
  locale: string,
): (value: number) => string {
  const f = axisFormat(format, ticks)
  return (value) => formatValue(value, f, locale, '')
}

/** 期望的刻度间隔数：大约每 56px 一个刻度，至少 2 个、最多 8 个。 */
export function tickCount(lengthPx: number, spacingPx = 56): number {
  return Math.max(2, Math.min(8, Math.round(lengthPx / spacingPx)))
}
