/**
 * 散点图的 ECharts 选项（纯函数，测试直接检查外观规格）。
 *
 * - 点是 8px 实心圆，带 2px 表面色外圈（符号 10px、描边 2px），重叠时仍能分清；
 * - 两条数值轴都是取整的刻度（不强制包含 0），网格线 1px 实线；横轴基线用坐标轴色；
 * - 命中：点很小，按「离指针最近、且在 16px 以内」的点命中（命中范围直径 32px），而不是要求指针正好落在点上；
 *   ECharts 自己的悬停关闭，由图形区域根据指针位置显示提示；
 * - 散点是「任意两点都可能相邻」的图形，只有前 3 个分类色两两都能分清：超过 3 个系列时开发模式下提醒。
 */
import type { EChartsCoreOption } from 'echarts/core'
import type { ChartTableData } from './ChartContainer.tsx'
import {
  AXIS_LABEL_MARGIN,
  animationOption,
  HORIZONTAL_TICK_SPACING,
  plotLength,
  textStyleOption,
} from './cartesian.ts'
import { liftColor } from './color.ts'
import type { PlotEnv } from './engine.tsx'
import { type ChartColorSlot, formatValue, type ValueFormat } from './format.ts'
import type { ChartPalette } from './palette.ts'
import { type SeriesModel, seriesColor } from './series.ts'
import { type AxisTicks, axisLabeler, niceTicks, tickCount } from './ticks.ts'
import { type TooltipContent, tooltipBase, tooltipElement } from './tooltip.ts'

/**
 * A point of a scatter chart.
 * @zh 散点图中的一个点。
 */
export interface ScatterPoint {
  /**
   * Horizontal value.
   * @zh 横轴的值。
   */
  readonly x: number
  /**
   * Vertical value.
   * @zh 纵轴的值。
   */
  readonly y: number
  /**
   * Name of the point in the tooltip and the table, such as the item it stands for; shown as text.
   * @zh 点的名称（提示与表格中），如它代表的对象；作为纯文字显示。
   */
  readonly label?: string
}

/**
 * A series of a scatter chart.
 * @zh 散点图中的一个系列。
 */
export interface ScatterSeries {
  /**
   * Identity of the series.
   * @zh 系列的身份。
   */
  readonly key: string
  /**
   * Name of the series in the legend, the tooltip and the table; shown as text, never interpreted as HTML.
   * @zh 系列名称，用于图例、提示与表格；作为纯文字显示，不会被当作 HTML。
   */
  readonly name: string
  /**
   * Pins the color of the series to a position of the categorical palette (by default its position in the array).
   * @zh 把系列的颜色固定为分类色的某个序号（默认按它在数组中的位置）。
   */
  readonly slot?: ChartColorSlot
  /**
   * The points.
   * @zh 各个点。
   */
  readonly points: readonly ScatterPoint[]
}

/** 点的符号尺寸（含外圈）、外圈宽度、命中半径（像素）。 */
export const SCATTER_SYMBOL_SIZE = 10
export const SCATTER_RING_WIDTH = 2
export const SCATTER_HIT_RADIUS = 16
/** 任意两点都能分清的颜色数（散点、气泡这类图形）。 */
export const SCATTER_DISTINCT_COLORS = 3

/** 散点图的输入。 */
export interface ScatterModel {
  readonly series: readonly ScatterSeries[]
  /** 系列的颜色与身份（与 series 一一对应）。 */
  readonly models: readonly SeriesModel[]
  readonly hidden: readonly string[]
  readonly xFormat: ValueFormat
  readonly yFormat: ValueFormat
  readonly xLabel?: string
  readonly yLabel?: string
  readonly locale: string
  readonly missing: string
}

/** 显示中的系列与它在 series 中的位置。 */
export function visibleScatter(m: ScatterModel): { s: ScatterSeries; model: SeriesModel }[] {
  return m.series
    .map((s, i) => ({ s, model: m.models[i] as SeriesModel }))
    .filter(({ s }) => !m.hidden.includes(s.key))
}

const finitePoint = (p: ScatterPoint) => Number.isFinite(p.x) && Number.isFinite(p.y)

/** 键盘浏览的顺序：显示中的全部点按 x（其次 y）排序。 */
export function scatterOrder(m: ScatterModel): { seriesIndex: number; dataIndex: number }[] {
  const out: { seriesIndex: number; dataIndex: number; x: number; y: number }[] = []
  visibleScatter(m).forEach(({ s }, seriesIndex) => {
    s.points.forEach((p, dataIndex) => {
      if (finitePoint(p)) out.push({ seriesIndex, dataIndex, x: p.x, y: p.y })
    })
  })
  return out
    .sort((a, b) => a.x - b.x || a.y - b.y || a.seriesIndex - b.seriesIndex)
    .map(({ seriesIndex, dataIndex }) => ({ seriesIndex, dataIndex }))
}

/** 两条轴的刻度。 */
export function scatterTicks(m: ScatterModel, env: Pick<PlotEnv, 'width' | 'height'>) {
  const pts = visibleScatter(m).flatMap(({ s }) => s.points.filter(finitePoint))
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const lo = (v: number[]) => (v.length ? Math.min(...v) : 0)
  const hi = (v: number[]) => (v.length ? Math.max(...v) : 0)
  return {
    x: niceTicks(lo(xs), hi(xs), tickCount(env.width * 0.8, HORIZONTAL_TICK_SPACING)),
    y: niceTicks(lo(ys), hi(ys), tickCount(plotLength(env.height))),
  }
}

/** 某个点的提示：点的名称（多个系列时附系列名）作标题，横轴与纵轴的值各一行。 */
export function scatterTooltip(
  m: ScatterModel,
  p: ChartPalette | null,
  seriesIndex: number,
  dataIndex: number,
): TooltipContent {
  const visible = visibleScatter(m)
  const entry = visible[seriesIndex]
  const point = entry?.s.points[dataIndex]
  if (!entry || !point) return { rows: [] }
  const color = p ? seriesColor(p, entry.model) : ''
  const title =
    point.label === undefined
      ? entry.s.name
      : m.series.length > 1
        ? `${point.label} · ${entry.s.name}`
        : point.label
  return {
    title,
    rows: [
      { color, value: formatValue(point.x, m.xFormat, m.locale, m.missing), name: m.xLabel ?? 'x' },
      { color, value: formatValue(point.y, m.yFormat, m.locale, m.missing), name: m.yLabel ?? 'y' },
    ],
  }
}

/** 表格视图：每个点一行（含隐藏系列的点）；多个系列时有系列列，有点名称时有名称列。 */
export function scatterTable(
  m: ScatterModel,
  headers: { readonly series: string; readonly label: string },
): ChartTableData {
  const many = m.series.length > 1
  const labeled = m.series.some((s) => s.points.some((p) => p.label !== undefined))
  return {
    columns: [
      ...(many ? [{ key: 'series', title: headers.series }] : []),
      ...(labeled ? [{ key: 'label', title: headers.label }] : []),
      { key: 'x', title: m.xLabel ?? 'x', numeric: true },
      { key: 'y', title: m.yLabel ?? 'y', numeric: true },
    ],
    rows: m.series.flatMap((s) =>
      s.points.map((p) => ({
        series: s.name,
        label: p.label ?? '',
        x: formatValue(p.x, m.xFormat, m.locale, m.missing),
        y: formatValue(p.y, m.yFormat, m.locale, m.missing),
      })),
    ),
  }
}

function scatterAxis(
  p: ChartPalette,
  ticks: AxisTicks,
  format: ValueFormat,
  locale: string,
  name: string | undefined,
  horizontal: boolean,
) {
  const text = { color: p.textTertiary, fontSize: p.fontSize, fontFamily: p.fontFamily }
  return {
    type: 'value',
    min: ticks.min,
    max: ticks.max,
    interval: ticks.step,
    // 横轴基线（数值轴的下端）用坐标轴色；纵轴不画轴线
    axisLine: horizontal
      ? { show: true, onZero: false, lineStyle: { color: p.axis, width: 1, type: 'solid' } }
      : { show: false },
    axisTick: { show: false },
    splitLine: { show: true, lineStyle: { color: p.grid, width: 1, type: 'solid' } },
    axisLabel: {
      ...text,
      margin: AXIS_LABEL_MARGIN,
      formatter: axisLabeler(format, ticks, locale),
    },
    name,
    nameLocation: 'middle',
    nameGap: horizontal ? 28 : 44,
    nameTextStyle: { ...text, color: p.textSecondary },
  }
}

/** 生成散点图的选项。 */
export function scatterOption(m: ScatterModel, env: PlotEnv): EChartsCoreOption {
  const p = env.palette
  const ticks = scatterTicks(m, env)
  return {
    ...animationOption(p),
    ...textStyleOption(p),
    grid: {
      left: 4,
      right: 12,
      top: 12,
      bottom: 4,
      outerBoundsMode: 'same',
      // 包含坐标轴名称（xLabel / yLabel）
      outerBoundsContain: 'all',
    },
    xAxis: scatterAxis(p, ticks.x, m.xFormat, m.locale, m.xLabel, true),
    yAxis: scatterAxis(p, ticks.y, m.yFormat, m.locale, m.yLabel, false),
    tooltip: {
      ...tooltipBase(p),
      trigger: 'item',
      // 指针命中由图形区域的最近点查找负责（ChartPlot 的 nearest），ECharts 不自己触发
      triggerOn: 'none',
      formatter: (params: unknown) => {
        const { seriesIndex = -1, dataIndex = -1 } = (params ?? {}) as {
          seriesIndex?: number
          dataIndex?: number
        }
        return tooltipElement(scatterTooltip(m, p, seriesIndex, dataIndex))
      },
    },
    series: visibleScatter(m).map(({ s, model }) => {
      const color = seriesColor(p, model)
      return {
        type: 'scatter',
        id: s.key,
        name: s.name,
        silent: true,
        z: model.emphasized ? 3 : 2,
        symbol: 'circle',
        symbolSize: SCATTER_SYMBOL_SIZE,
        data: s.points.map((pt) => (finitePoint(pt) ? [pt.x, pt.y] : [null, null])),
        itemStyle: { color, borderColor: p.surface, borderWidth: SCATTER_RING_WIDTH, opacity: 1 },
        emphasis: {
          scale: false,
          focus: 'none',
          itemStyle: {
            color: liftColor(color),
            borderColor: p.surface,
            borderWidth: SCATTER_RING_WIDTH,
          },
        },
      }
    }),
  }
}
