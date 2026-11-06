/**
 * 图表与数字展示组件共用的部分：数值格式化、分类色序号。
 *
 * 数值只用于显示：金额、数量等业务数据在使用方仍按 Decimal 保存与计算，传给图表前再转成 number。
 */
import { useCallback } from 'react'
import { useT } from '../../i18n/index.ts'

/**
 * How a value is written.
 * - `'auto'`: in full below 10,000, compact from 10,000 on (1,284 · 12.9K · 4.2M).
 * - `'number'`: always in full, with grouping separators.
 * - `'compact'`: always compact.
 * - `'percent'`: the value is a ratio (0.125 → 12.5%).
 * - a function: your own formatting (units, currencies).
 * @zh 数值的写法。
 * - `'auto'`：小于 10,000 时写全，从 10,000 起用紧凑写法（1,284 · 1.3万 · 420万）。
 * - `'number'`：总是写全，带千分位。
 * - `'compact'`：总是用紧凑写法。
 * - `'percent'`：数值是比例（0.125 → 12.5%）。
 * - 函数：自定义写法（单位、货币）。
 */
export type ValueFormat = 'auto' | 'number' | 'compact' | 'percent' | ((value: number) => string)

/**
 * Position of a series in the categorical chart palette, from 1 to 8 (tokens `color-chart-1` … `color-chart-8`).
 * Pin it when the same entity appears in several charts, so that it keeps its color everywhere.
 * @zh 系列在图表分类色中的序号，1 到 8（令牌 `color-chart-1` … `color-chart-8`）。同一个对象出现在多个图表中时
 * 固定它的序号，让它在各处都是同一个颜色。
 */
export type ChartColorSlot = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

/** 分类色的数量。第 9 个及以后的系列不生成新颜色，用弱化色（调用方应合并为「其他」或拆成多个小图）。 */
export const CHART_SLOTS = 8

/** 从 10,000 起，`auto` 改用紧凑写法。 */
export const COMPACT_FROM = 10_000

/** 第 n 个系列（从 0 开始）的颜色令牌名（不含 `--vl-` 前缀）。超过 8 个时为弱化色。 */
export function seriesColorToken(index: number, slot?: ChartColorSlot): string {
  const n = slot ?? index + 1
  return n >= 1 && n <= CHART_SLOTS ? `color-chart-${n}` : 'color-chart-muted'
}

const formatters = new Map<string, Intl.NumberFormat>()

function numberFormat(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`
  let f = formatters.get(key)
  if (!f) {
    f = new Intl.NumberFormat(locale, options)
    formatters.set(key, f)
  }
  return f
}

/**
 * 按写法格式化一个数值。`locale` 是 BCP 47 语言标签（取自文本表的 `format.locale`）。
 * 空值与非有限数（NaN、Infinity）返回 `missing`。
 */
export function formatValue(
  value: number | null | undefined,
  format: ValueFormat,
  locale: string,
  missing: string,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return missing
  if (typeof format === 'function') return format(value)
  switch (format) {
    case 'percent':
      return numberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(value)
    case 'compact':
      return numberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
    case 'number':
      return numberFormat(locale, { maximumFractionDigits: 2 }).format(value)
    default:
      return Math.abs(value) < COMPACT_FROM
        ? numberFormat(locale, { maximumFractionDigits: 2 }).format(value)
        : numberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
  }
}

/** 当前语言下的数值格式化函数（语言取自 ThemeProvider / LocaleProvider 的文本表）。 */
export function useFormatValue(
  format: ValueFormat = 'auto',
): (value: number | null | undefined) => string {
  const t = useT()
  const locale = t('format.locale')
  const missing = t('format.missing')
  return useCallback(
    (value: number | null | undefined) => formatValue(value, format, locale, missing),
    [format, locale, missing],
  )
}
