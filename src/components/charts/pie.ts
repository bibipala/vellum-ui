/**
 * 饼图与环形图的 ECharts 选项（纯函数，测试直接检查外观规格）。
 *
 * - 扇区不超过 `maxSlices`（默认 6）：超过时保留最大的 maxSlices − 1 个，其余合并为「其他」，用弱化色；
 *   表格视图仍列出全部原始项；
 * - 颜色按项在 `data` 中的位置（或 `slot`）取，筛掉、合并某些项时其他项不变色；
 * - 相邻扇区之间 2px 表面色间隙（扇区边缘描边：描边一半在扇区内，两侧合起来 2px），不画其他描边；
 * - 扇区上不写数值（图例、提示与表格负责），从 12 点方向顺时针排列，悬停的扇区稍微提亮、不放大。
 */
import type { EChartsCoreOption } from 'echarts/core'
import type { ChartTableData } from './ChartContainer.tsx'
import { animationOption, textStyleOption } from './cartesian.ts'
import { liftColor } from './color.ts'
import type { PlotEnv } from './engine.tsx'
import { CHART_SLOTS, type ChartColorSlot, formatValue, type ValueFormat } from './format.ts'
import type { ChartPalette } from './palette.ts'
import { seriesColor, seriesModels } from './series.ts'
import { type TooltipContent, tooltipBase, tooltipElement } from './tooltip.ts'

/**
 * A slice of a pie or donut chart.
 * @zh 饼图、环形图中的一项。
 */
export interface PieChartDatum {
  /**
   * Identity of the item.
   * @zh 该项的身份。
   */
  readonly key: string
  /**
   * Name of the item in the legend, the tooltip and the table; shown as text, never interpreted as HTML.
   * @zh 名称，用于图例、提示与表格；作为纯文字显示，不会被当作 HTML。
   */
  readonly name: string
  /**
   * The value; zero, negative and missing values draw no slice but are listed in the table.
   * @zh 数值；0、负数与缺失值不画扇区，但会列在表格中。
   */
  readonly value: number
  /**
   * Pins the color of the item to a position of the categorical palette (by default its position in `data`).
   * @zh 把该项的颜色固定为分类色的某个序号（默认按它在 `data` 中的位置）。
   */
  readonly slot?: ChartColorSlot
}

/** 合并后的「其他」的 key。 */
export const OTHER_KEY = '\u0000other'
/** 扇区之间的间隙（像素）。 */
export const SLICE_GAP = 2
/** 默认最多的扇区数。 */
export const DEFAULT_MAX_SLICES = 6

/** 一个扇区。 */
export interface PieSlice {
  readonly key: string
  readonly name: string
  readonly value: number
  readonly color: ChartColorSlot | 'muted'
  /** 「其他」包含的原始项的 key。 */
  readonly members?: readonly string[]
}

/** 饼图的输入。 */
export interface PieModel {
  readonly data: readonly PieChartDatum[]
  readonly hidden: readonly string[]
  readonly maxSlices: number
  readonly donut: boolean
  readonly format: ValueFormat
  readonly locale: string
  readonly missing: string
  /** 「其他」的名称（随语言）。 */
  readonly otherName: string
}

const positive = (v: number) => Number.isFinite(v) && v > 0

/**
 * 扇区：只取正数；超过 maxSlices 时保留最大的 maxSlices − 1 个（保持原来的顺序），其余合并为「其他」放在最后。
 * maxSlices 不超过分类色的数量（8）。
 */
export function pieSlices(
  data: readonly PieChartDatum[],
  maxSlices: number,
  otherName: string,
): PieSlice[] {
  const colors = seriesModels(data)
  const items = data
    .map((d, i) => ({ d, color: colors[i]?.color ?? 'muted', i }))
    .filter((x) => positive(x.d.value))
  const max = Math.max(1, Math.min(CHART_SLOTS, Math.floor(maxSlices)))
  if (items.length <= max)
    return items.map(({ d, color }) => ({ key: d.key, name: d.name, value: d.value, color }))
  const kept = new Set(
    [...items]
      .sort((a, b) => b.d.value - a.d.value || a.i - b.i)
      .slice(0, max - 1)
      .map((x) => x.i),
  )
  const slices: PieSlice[] = items
    .filter((x) => kept.has(x.i))
    .map(({ d, color }) => ({ key: d.key, name: d.name, value: d.value, color }))
  const rest = items.filter((x) => !kept.has(x.i))
  slices.push({
    key: OTHER_KEY,
    name: otherName,
    value: rest.reduce((n, x) => n + x.d.value, 0),
    color: 'muted',
    members: rest.map((x) => x.d.key),
  })
  return slices
}

/** 显示中的扇区。 */
export function visibleSlices(m: PieModel): PieSlice[] {
  return pieSlices(m.data, m.maxSlices, m.otherName).filter((s) => !m.hidden.includes(s.key))
}

const share = (m: PieModel, value: number, total: number) =>
  formatValue(total > 0 ? value / total : null, 'percent', m.locale, m.missing)

/** 某个扇区的提示：名称作标题，数值在前、占比在后（占比按显示中的扇区计算）。 */
export function pieTooltip(m: PieModel, p: ChartPalette | null, index: number): TooltipContent {
  const slices = visibleSlices(m)
  const s = slices[index]
  if (!s) return { rows: [] }
  const total = slices.reduce((n, x) => n + x.value, 0)
  return {
    title: s.name,
    rows: [
      {
        color: p ? seriesColor(p, s) : '',
        value: formatValue(s.value, m.format, m.locale, m.missing),
        name: share(m, s.value, total),
      },
    ],
  }
}

/** 读屏播报：名称、数值、占比。 */
export function pieAnnouncement(m: PieModel, index: number): string {
  const t = pieTooltip(m, null, index)
  const row = t.rows[0]
  return row ? `${t.title}, ${row.value}, ${row.name}` : ''
}

/** 表格视图：全部原始项（含合并进「其他」的、不画扇区的），占比按全部正数项的总和计算。 */
export function pieTable(
  m: PieModel,
  headers: { readonly name: string; readonly value: string; readonly share: string },
): ChartTableData {
  const total = m.data.reduce((n, d) => n + (positive(d.value) ? d.value : 0), 0)
  return {
    columns: [
      { key: 'name', title: headers.name },
      { key: 'value', title: headers.value, numeric: true },
      { key: 'share', title: headers.share, numeric: true },
    ],
    rows: m.data.map((d) => ({
      name: d.name,
      value: formatValue(Number.isFinite(d.value) ? d.value : null, m.format, m.locale, m.missing),
      share: positive(d.value) ? share(m, d.value, total) : m.missing,
    })),
  }
}

/** 外半径、环形图的内半径（相对图形区域较短边的一半）。 */
export const PIE_RADIUS = '88%'
export const DONUT_INNER_RADIUS = '60%'

/** 生成饼图 / 环形图的选项。 */
export function pieOption(m: PieModel, env: PlotEnv): EChartsCoreOption {
  const p = env.palette
  const slices = visibleSlices(m)
  return {
    ...animationOption(p),
    ...textStyleOption(p),
    tooltip: {
      ...tooltipBase(p),
      trigger: 'item',
      formatter: (params: unknown) => {
        const { dataIndex = -1 } = (params ?? {}) as { dataIndex?: number }
        return tooltipElement(pieTooltip(m, p, dataIndex))
      },
    },
    series: [
      {
        type: 'pie',
        id: 'slices',
        radius: m.donut ? [DONUT_INNER_RADIUS, PIE_RADIUS] : [0, PIE_RADIUS],
        center: ['50%', '50%'],
        startAngle: 90,
        clockwise: true,
        avoidLabelOverlap: false,
        label: { show: false },
        labelLine: { show: false },
        // 扇区之间 2px 表面色间隙；只有一个扇区时没有相邻的扇区
        itemStyle: { borderColor: p.surface, borderWidth: slices.length > 1 ? SLICE_GAP : 0 },
        emphasis: { scale: false, focus: 'none' },
        data: slices.map((s) => {
          const color = seriesColor(p, s)
          return {
            id: s.key,
            name: s.name,
            value: s.value,
            itemStyle: { color },
            emphasis: { itemStyle: { color: liftColor(color) } },
          }
        }),
      },
    ],
  }
}
