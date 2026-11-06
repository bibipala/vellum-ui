/**
 * 系列的颜色与身份（纯函数）：颜色按系列在数组中的位置取（或用 `slot` 固定），隐藏、筛选某个系列时其他系列不变色；
 * 第 9 个起用弱化色，绝不生成新颜色；`emphasis` 突出一个系列，其余用弱化色。
 */
import type { ChartLegendItem } from './ChartContainer.tsx'
import { CHART_SLOTS, type ChartColorSlot, seriesColorToken } from './format.ts'
import { type ChartPalette, tokenColor } from './palette.ts'

// 打包工具会把 process.env.NODE_ENV 替换为常量（antd 与 React 同样依赖这一点）；这里只声明用到的部分
declare const process: { readonly env: { readonly NODE_ENV?: string } }

/**
 * A series of a chart.
 * @zh 图表中的一个系列。
 */
export interface ChartSeries<K extends string = string> {
  /**
   * Field of the rows that holds the values of this series; also the identity of the series.
   * @zh 行数据中保存该系列数值的字段名，也是系列的身份。
   */
  readonly key: K
  /**
   * Name of the series in the legend, the tooltip and the table header; shown as text, never interpreted as HTML.
   * @zh 系列名称，用于图例、提示与表头；作为纯文字显示，不会被当作 HTML。
   */
  readonly name: string
  /**
   * Pins the color of the series to a position of the categorical palette (by default its position in the array).
   * @zh 把系列的颜色固定为分类色的某个序号（默认按它在数组中的位置）。
   */
  readonly slot?: ChartColorSlot
}

/** 系列的颜色与身份。 */
export interface SeriesModel {
  readonly key: string
  readonly name: string
  /** 在使用方数组中的位置。 */
  readonly index: number
  /** 图例中的颜色：分类色序号或弱化色。 */
  readonly color: ChartColorSlot | 'muted'
  /** 是否是被突出的系列（`emphasis`）。 */
  readonly emphasized: boolean
}

/** 每个系列的颜色：位置或 slot；第 9 个起、或有被突出的系列时其余系列为弱化色。 */
export function seriesModels(
  series: readonly {
    readonly key: string
    readonly name: string
    readonly slot?: ChartColorSlot
  }[],
  emphasis?: string,
): SeriesModel[] {
  const focus = emphasis !== undefined && series.some((s) => s.key === emphasis) ? emphasis : null
  return series.map((s, index) => {
    const token = seriesColorToken(index, s.slot)
    const slot =
      token === 'color-chart-muted' ? 'muted' : (Number(token.slice(12)) as ChartColorSlot)
    const muted = focus !== null && s.key !== focus
    return {
      key: s.key,
      name: s.name,
      index,
      color: muted ? 'muted' : slot,
      emphasized: focus === s.key,
    }
  })
}

/** 系列颜色在配色中的取值。 */
export function seriesColor(p: ChartPalette, s: Pick<SeriesModel, 'color'>): string {
  return s.color === 'muted' ? p.muted : tokenColor(p, `color-chart-${s.color}`)
}

/** 图例项。 */
export function legendItems(
  models: readonly SeriesModel[],
  marker: NonNullable<ChartLegendItem['marker']>,
): ChartLegendItem[] {
  return models.map((s) => ({ key: s.key, name: s.name, color: s.color, marker }))
}

/** 开发模式下的提示（生产构建中整段被去掉）。 */
export function devWarn(message: string) {
  if (process.env.NODE_ENV !== 'production') console.warn(`[vellum-ui] ${message}`)
}

/** 超过 8 个系列：提醒合并为「其他」或拆成多个小图（不生成新颜色，第 9 个起是弱化色）。 */
export function warnTooManySeries(component: string, count: number) {
  if (count > CHART_SLOTS)
    devWarn(
      `${component}: ${count} series, but there are only ${CHART_SLOTS} chart colors; series 9 and later use the muted color. Fold the smallest ones into "Other" or split the chart into small multiples.`,
    )
}
