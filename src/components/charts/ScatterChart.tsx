/**
 * 散点图（ECharts 的 scatter 系列，只引入它自己需要的图表类型与组件）。
 * 外观规格见 scatter.ts；容器、图例、表格视图与状态见 ChartContainer。
 */
import { ScatterChart as ScatterSeriesChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import type { EChartsType } from 'echarts/core'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useT } from '../../i18n/index.ts'
import { type ChartCommonProps, ChartContainer, commonProps } from './ChartContainer.tsx'
import {
  type ChartModule,
  type ChartNav,
  ChartPlot,
  type NavTarget,
  type PlotEnv,
} from './engine.tsx'
import type { ValueFormat } from './format.ts'
import {
  SCATTER_DISTINCT_COLORS,
  SCATTER_HIT_RADIUS,
  type ScatterModel,
  type ScatterSeries,
  scatterOption,
  scatterOrder,
  scatterTable,
  scatterTooltip,
  visibleScatter,
} from './scatter.ts'
import { devWarn, legendItems, seriesModels, warnTooManySeries } from './series.ts'
import { tooltipText } from './tooltip.ts'

const MODULES: readonly ChartModule[] = [ScatterSeriesChart, GridComponent, TooltipComponent]

/**
 * Props of ScatterChart.
 * @zh ScatterChart 属性。
 */
export interface ScatterChartProps extends ChartCommonProps {
  /**
   * The series and their points. Use at most 3 series: in a scatter chart any two points can be neighbors, and
   * only the first 3 chart colors are told apart in every pair.
   * @zh 各系列及其点。最多用 3 个系列：散点图中任意两点都可能相邻，只有前 3 个图表颜色两两都能分清。
   */
  readonly series: readonly ScatterSeries[]
  /**
   * How horizontal values are written on the axis, in the tooltip and in the table.
   * @zh 横轴数值的写法：坐标轴、提示与表格共用。
   * @default 'auto'
   */
  readonly xFormat?: ValueFormat
  /**
   * How vertical values are written on the axis, in the tooltip and in the table.
   * @zh 纵轴数值的写法：坐标轴、提示与表格共用。
   * @default 'auto'
   */
  readonly yFormat?: ValueFormat
  /**
   * Name of the horizontal axis: shown under the axis, in the tooltip and as a table header.
   * @zh 横轴名称：显示在横轴下方，也用于提示与表头。
   */
  readonly xLabel?: string
  /**
   * Name of the vertical axis: shown along the axis, in the tooltip and as a table header.
   * @zh 纵轴名称：沿纵轴显示，也用于提示与表头。
   */
  readonly yLabel?: string
  /**
   * Key of the one series the chart is about: it keeps its color and the others use the muted color.
   * @zh 图表要突出的那个系列的 key：它保持自己的颜色，其余系列用弱化色。
   */
  readonly emphasis?: string
}

/**
 * Scatter chart: the relation between two values, one point per item. Points are 8 px dots with a 2 px ring in
 * the surface color, so overlapping points stay readable.
 *
 * **Interaction**: the pointer does not have to land on a dot: the nearest point within 16 px shows its tooltip
 * and lifts. `Tab` focuses the chart (focus ring only for the keyboard); `←` / `→` move between points in order of
 * their horizontal value with the same tooltip, `Home` / `End` jump to the first and last, `Esc` hides the
 * tooltip. Legend items show and hide series without changing colors; the table view lists every point.
 * @zh 散点图：两个数值之间的关系，每个对象一个点。点是 8px 的实心圆，带 2px 表面色外圈，重叠时仍能分清。
 *
 * **交互**：指针不必正好落在点上：16px 以内最近的点显示提示并提亮。`Tab` 聚焦图表（焦点环只在键盘操作时出现）；
 * `←` / `→` 按横轴数值的顺序在点之间移动并显示同样的提示，`Home` / `End` 跳到首尾，`Esc` 关闭提示。图例项显示、
 * 隐藏系列，不改变颜色；表格视图列出全部点。
 * @category Charts
 * @usage Correlation between two measures (price and sales, size and duration), spotting outliers
 * @usageZh 两个指标的相关性（价格与销量、大小与耗时），发现离群值
 */
export function ScatterChart(props: ScatterChartProps) {
  const t = useT()
  const locale = t('format.locale')
  const missing = t('format.missing')
  const { series, emphasis, xLabel, yLabel } = props
  const xFormat = props.xFormat ?? 'auto'
  const yFormat = props.yFormat ?? 'auto'
  const [hidden, setHidden] = useState<readonly string[]>([])
  const models = useMemo(() => seriesModels(series, emphasis), [series, emphasis])
  useEffect(() => {
    warnTooManySeries('ScatterChart', series.length)
    if (series.length > SCATTER_DISTINCT_COLORS && series.length <= 8)
      devWarn(
        `ScatterChart: ${series.length} series. In a scatter chart any two points can be neighbors, and only the first ${SCATTER_DISTINCT_COLORS} chart colors are told apart in every pair. Fold the rest into "Other" or split the chart into small multiples.`,
      )
  }, [series.length])

  const model = useMemo<ScatterModel>(
    () => ({ series, models, hidden, xFormat, yFormat, xLabel, yLabel, locale, missing }),
    [series, models, hidden, xFormat, yFormat, xLabel, yLabel, locale, missing],
  )
  const build = useCallback((env: PlotEnv) => scatterOption(model, env), [model])
  const nav = useMemo<ChartNav>(() => {
    const order = scatterOrder(model)
    return {
      cols: order.length,
      rows: 1,
      keys: { colNext: 'ArrowRight', colPrev: 'ArrowLeft' },
      target: (col) => {
        const at = order[col]
        return at
          ? {
              ...at,
              highlight: true,
              text: tooltipText(scatterTooltip(model, null, at.seriesIndex, at.dataIndex)),
            }
          : null
      },
    }
  }, [model])
  // 最近点查找：点的像素位置在图表尺寸不变时缓存
  const nearest = useMemo(() => {
    let cache: {
      w: number
      h: number
      pts: { s: number; i: number; x: number; y: number }[]
    } | null = null
    return (chart: EChartsType, x: number, y: number): NavTarget | null => {
      const w = chart.getWidth()
      const h = chart.getHeight()
      if (!cache || cache.w !== w || cache.h !== h) {
        const pts: { s: number; i: number; x: number; y: number }[] = []
        visibleScatter(model).forEach(({ s: sr }, s) => {
          sr.points.forEach((pt, i) => {
            if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) return
            const px = chart.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [pt.x, pt.y])
            if (Array.isArray(px)) pts.push({ s, i, x: px[0] ?? 0, y: px[1] ?? 0 })
          })
        })
        cache = { w, h, pts }
      }
      let best: { s: number; i: number } | null = null
      let bestD = SCATTER_HIT_RADIUS * SCATTER_HIT_RADIUS
      for (const pt of cache.pts) {
        const d = (pt.x - x) ** 2 + (pt.y - y) ** 2
        if (d <= bestD) {
          bestD = d
          best = pt
        }
      }
      return best
        ? {
            seriesIndex: best.s,
            dataIndex: best.i,
            highlight: true,
            text: tooltipText(scatterTooltip(model, null, best.s, best.i)),
          }
        : null
    }
  }, [model])
  const table = useMemo(
    () => scatterTable(model, { series: t('chart.table.series'), label: t('chart.table.label') }),
    [model, t],
  )
  const kind = t('chart.kind.scatter')
  return (
    <ChartContainer
      {...commonProps(props)}
      legend={legendItems(models, 'dot')}
      hiddenKeys={hidden}
      onHiddenKeysChange={setHidden}
      table={table}
      empty={series.every((s) => s.points.length === 0)}
    >
      <ChartPlot
        modules={MODULES}
        build={build}
        nav={nav}
        nearest={nearest}
        label={props.title ?? kind}
        kind={kind}
        hint={t('chart.keys')}
      />
    </ChartContainer>
  )
}
