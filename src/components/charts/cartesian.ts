/**
 * 直角坐标图（折线、面积、柱状）共用的部分（纯函数）：从行数据取出类别与数值、坐标轴与网格的外观、基础选项、
 * 表格视图的数据。
 *
 * 坐标轴外观（dataviz 的 marks-and-anatomy）：网格线 1px 实线（`color-chart-grid`），类别轴基线 `color-chart-axis`，
 * 坐标轴文字用第三级文字色与 `font-size-xs`，数值轴不画轴线与刻度线；只有一个数值轴。
 */
import type { ChartTableData } from './ChartContainer.tsx'
import { formatValue, type ValueFormat } from './format.ts'
import type { ChartPalette } from './palette.ts'
import type { SeriesModel } from './series.ts'
import { type AxisTicks, axisLabeler, niceTicks, tickCount } from './ticks.ts'

/**
 * A value of the category field (x): a text, a number or a date. Dates and numbers are written with `xFormat`
 * (otherwise as `String(value)`).
 * @zh 类别字段（x）的取值：文字、数字或日期。日期与数字用 `xFormat` 写出（否则为 `String(value)`）。
 */
export type ChartXValue = string | number | Date

/** 行数据中取出的类别与数值。 */
export interface CartesianData {
  /** 类别的文字（坐标轴、提示、表格共用）。 */
  readonly categories: readonly string[]
  /** 每个系列（按使用方数组的顺序）在每个类别上的数值；缺失、非有限数为 null。 */
  readonly values: readonly (readonly (number | null)[])[]
}

const field = (row: object, key: string): unknown => (row as Record<string, unknown>)[key]

/** 类别的文字：`xFormat`，否则日期写 ISO 日期、其余 `String()`。 */
export function categoryLabel(value: unknown, xFormat?: (value: ChartXValue) => string): string {
  if (value === null || value === undefined) return ''
  if (xFormat && (typeof value === 'string' || typeof value === 'number' || value instanceof Date))
    return xFormat(value)
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value)
}

/** 数值：只接受有限的 number，其余（缺失、文字、NaN）视为缺失。 */
export const numberOrNull = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null

/** 从行数据取出类别与每个系列的数值。 */
export function cartesianData(
  data: readonly object[],
  x: string,
  series: readonly { readonly key: string }[],
  xFormat?: (value: ChartXValue) => string,
): CartesianData {
  return {
    categories: data.map((row) => categoryLabel(field(row, x), xFormat)),
    values: series.map((s) => data.map((row) => numberOrNull(field(row, s.key)))),
  }
}

/** 一组数值的范围（忽略缺失）；没有数值时为 [0, 0]。 */
export function extent(values: Iterable<number | null>): [number, number] {
  let lo = Number.POSITIVE_INFINITY
  let hi = Number.NEGATIVE_INFINITY
  for (const v of values) {
    if (v === null) continue
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  return Number.isFinite(lo) ? [lo, hi] : [0, 0]
}

/** 全部是整数（刻度不出现小数）。 */
export function allIntegers(values: Iterable<number | null>): boolean {
  for (const v of values) if (v !== null && !Number.isInteger(v)) return false
  return true
}

/** 堆叠后每个类别正向、负向的累计范围。 */
export function stackedExtent(
  values: readonly (readonly (number | null)[])[],
  count: number,
): [number, number] {
  let lo = 0
  let hi = 0
  for (let i = 0; i < count; i++) {
    let pos = 0
    let neg = 0
    for (const row of values) {
      const v = row[i] ?? null
      if (v === null) continue
      if (v >= 0) pos += v
      else neg += v
    }
    hi = Math.max(hi, pos)
    lo = Math.min(lo, neg)
  }
  return [lo, hi]
}

/** 坐标轴文字的公共样式。 */
function axisText(p: ChartPalette) {
  return { color: p.textTertiary, fontSize: p.fontSize, fontFamily: p.fontFamily }
}

/** 坐标轴文字与图形之间的距离（像素）。 */
export const AXIS_LABEL_MARGIN = 8

/** 数值轴：取整的刻度、1px 实线网格，不画轴线与刻度线。 */
export function valueAxis(
  p: ChartPalette,
  ticks: AxisTicks,
  format: ValueFormat,
  locale: string,
  extra: Record<string, unknown> = {},
) {
  return {
    type: 'value',
    min: ticks.min,
    max: ticks.max,
    interval: ticks.step,
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: { show: true, lineStyle: { color: p.grid, width: 1, type: 'solid' } },
    axisLabel: {
      ...axisText(p),
      margin: AXIS_LABEL_MARGIN,
      formatter: axisLabeler(format, ticks, locale),
    },
    ...extra,
  }
}

/** 类别轴：基线用坐标轴色（数值 0 处），不画刻度线，文字重叠时自动隔开显示。 */
export function categoryAxis(
  p: ChartPalette,
  categories: readonly string[],
  boundaryGap: boolean,
  extra: Record<string, unknown> = {},
) {
  return {
    type: 'category',
    data: categories,
    boundaryGap,
    axisLine: { show: true, onZero: true, lineStyle: { color: p.axis, width: 1, type: 'solid' } },
    axisTick: { show: false },
    splitLine: { show: false },
    axisLabel: { ...axisText(p), margin: AXIS_LABEL_MARGIN, hideOverlap: true },
    ...extra,
  }
}

/**
 * 网格：坐标轴文字包含在图形区域之内（ECharts 6 的 outerBounds，相当于以前的 containLabel），
 * 四周留出顶端刻度文字的一半与最后一个类别文字的空间。
 */
export function gridOption(extra: { top?: number; right?: number } = {}) {
  return {
    // 左侧留几像素：坐标轴文字的宽度是估计值，最长的文字不会贴边被裁
    left: 4,
    right: extra.right ?? 8,
    top: extra.top ?? 8,
    // ECharts 估计文字包围盒时不含下伸部（g、y、p），底部多留几像素，类别文字不被裁掉
    bottom: 4,
    outerBoundsMode: 'same',
    outerBoundsContain: 'axisLabel',
  }
}

/** 动画：首次渲染 `motion-duration-slow`、更新 `motion-duration-base`，标准缓动；时长为 0 时关闭。 */
export function animationOption(p: ChartPalette) {
  return {
    animation: p.enterMs > 0 || p.updateMs > 0,
    animationDuration: p.enterMs,
    animationDurationUpdate: p.updateMs,
    animationEasing: p.easing,
    animationEasingUpdate: p.easing,
  }
}

/** 全局文字样式：正文字体、第三级文字色（文字一律用文字色，不用系列颜色）。 */
export function textStyleOption(p: ChartPalette) {
  return { textStyle: { fontFamily: p.fontFamily, color: p.textTertiary, fontSize: p.fontSize } }
}

/** 数值轴的刻度：按长度决定刻度数，`zero` 时包含 0，全是整数时不出现小数刻度。 */
export function valueTicks(
  range: [number, number],
  lengthPx: number,
  options: { zero: boolean; integer: boolean; spacing?: number },
): AxisTicks {
  return niceTicks(range[0], range[1], tickCount(lengthPx, options.spacing), options)
}

/** 横向数值轴的刻度间距（像素）：刻度文字并排，比纵向的间距大。 */
export const HORIZONTAL_TICK_SPACING = 96

/** 图形区域高度的估计：减去类别轴文字的一行与上下留白（只用于决定刻度数）。 */
export const plotLength = (px: number) => Math.max(0, px - 40)

/** 表格视图：首列是类别，其余每个系列一列（包括被隐藏的系列），数值用同一个写法。 */
export function cartesianTable(
  model: CartesianData,
  series: readonly SeriesModel[],
  firstColumn: string,
  format: ValueFormat,
  locale: string,
  missing: string,
): ChartTableData {
  return {
    columns: [
      { key: 'x', title: firstColumn },
      ...series.map((s) => ({ key: `s${s.index}`, title: s.name, numeric: true })),
    ],
    rows: model.categories.map((c, i) => {
      const row: Record<string, string> = { x: c }
      for (const s of series)
        row[`s${s.index}`] = formatValue(model.values[s.index]?.[i], format, locale, missing)
      return row
    }),
  }
}
