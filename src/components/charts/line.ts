/**
 * 折线图与面积图的 ECharts 选项（纯函数，测试直接检查外观规格）。
 *
 * 线 2px、圆角连接与端点；数据点默认不显示，悬停或键盘聚焦时显示 8px 圆点带 2px 表面色外圈（符号 10px、
 * 描边 2px：描边一半在内，露出的圆点直径 8px，外圈 2px）；面积填充约 10% 不透明度（堆叠时同样淡）。
 * 竖向十字线吸附到最近的 x，提示列出该 x 上全部显示中的系列。
 */
import type { EChartsCoreOption } from 'echarts/core'
import {
  allIntegers,
  animationOption,
  type CartesianData,
  categoryAxis,
  extent,
  gridOption,
  plotLength,
  stackedExtent,
  textStyleOption,
  valueAxis,
  valueTicks,
} from './cartesian.ts'
import type { PlotEnv } from './engine.tsx'
import { formatValue, type ValueFormat } from './format.ts'
import type { ChartPalette } from './palette.ts'
import { type SeriesModel, seriesColor } from './series.ts'
import { type TooltipContent, tooltipBase, tooltipElement } from './tooltip.ts'

/** 折线 / 面积图的输入。 */
export interface LineModel {
  readonly data: CartesianData
  /** 全部系列（按使用方数组的顺序），含被隐藏的。 */
  readonly series: readonly SeriesModel[]
  readonly hidden: readonly string[]
  readonly area: boolean
  readonly stacked: boolean
  readonly format: ValueFormat
  readonly locale: string
  readonly missing: string
}

/** 线宽、数据点尺寸（含外圈）、外圈宽度、面积不透明度。 */
export const LINE_WIDTH = 2
export const DOT_SYMBOL_SIZE = 10
export const DOT_RING_WIDTH = 2
export const AREA_OPACITY = 0.1

/** 显示中的系列（按使用方数组的顺序）。 */
export function visibleSeries(m: Pick<LineModel, 'series' | 'hidden'>): SeriesModel[] {
  return m.series.filter((s) => !m.hidden.includes(s.key))
}

/** 某个类别上的提示内容：类别作标题，每个显示中的系列一行（`p` 为 null 时只要文字，如读屏播报）。 */
export function lineTooltip(m: LineModel, p: ChartPalette | null, index: number): TooltipContent {
  return {
    title: m.data.categories[index] ?? '',
    rows: visibleSeries(m).map((s) => ({
      color: p ? seriesColor(p, s) : '',
      value: formatValue(m.data.values[s.index]?.[index], m.format, m.locale, m.missing),
      name: s.name,
    })),
  }
}

/** 生成折线 / 面积图的选项。 */
export function lineOption(m: LineModel, env: PlotEnv): EChartsCoreOption {
  const p = env.palette
  const visible = visibleSeries(m)
  const n = m.data.categories.length
  const shown = visible.map((s) => m.data.values[s.index] ?? [])
  const range = m.area && m.stacked ? stackedExtent(shown, n) : extent(shown.flat())
  const ticks = valueTicks(range, plotLength(env.height), {
    zero: true,
    integer: allIntegers(shown.flat()),
  })
  return {
    ...animationOption(p),
    ...textStyleOption(p),
    grid: gridOption(),
    xAxis: categoryAxis(p, m.data.categories, false),
    yAxis: valueAxis(p, ticks, m.format, m.locale),
    tooltip: {
      ...tooltipBase(p),
      trigger: 'axis',
      axisPointer: {
        type: 'line',
        snap: true,
        // 十字线在系列之下：不压在数据点上
        z: 1,
        lineStyle: { color: p.axis, width: 1, type: 'solid' },
        label: { show: false },
      },
      formatter: (params: unknown) => {
        const first = (Array.isArray(params) ? params[0] : params) as
          | { dataIndex?: number }
          | undefined
        return tooltipElement(lineTooltip(m, p, first?.dataIndex ?? -1))
      },
    },
    series: visible.map((s) => {
      const color = seriesColor(p, s)
      const values = m.data.values[s.index] ?? []
      return {
        type: 'line',
        id: s.key,
        name: s.name,
        data: values,
        color,
        // 被突出的系列画在最上面
        z: s.emphasized ? 3 : 2,
        stack: m.stacked ? 'total' : undefined,
        connectNulls: false,
        smooth: false,
        // 数据点默认不显示；只有一个点时没有线，必须显示
        showSymbol: values.filter((v) => v !== null).length === 1,
        symbol: 'circle',
        symbolSize: DOT_SYMBOL_SIZE,
        lineStyle: { color, width: LINE_WIDTH, cap: 'round', join: 'round', type: 'solid' },
        itemStyle: { color, borderColor: p.surface, borderWidth: DOT_RING_WIDTH, opacity: 1 },
        areaStyle: m.area ? { color, opacity: AREA_OPACITY } : undefined,
        emphasis: {
          focus: 'none',
          scale: false,
          lineStyle: { width: LINE_WIDTH },
          itemStyle: { color, borderColor: p.surface, borderWidth: DOT_RING_WIDTH },
          areaStyle: m.area ? { opacity: AREA_OPACITY } : undefined,
        },
      }
    }),
  }
}
