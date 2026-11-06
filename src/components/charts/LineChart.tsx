/**
 * 折线图与面积图（ECharts 的 line 系列，只引入它自己需要的图表类型与组件）。
 * 外观规格见 line.ts；容器、图例、表格视图与状态见 ChartContainer。
 */
import { LineChart as LineSeries } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useT } from '../../i18n/index.ts'
import { type ChartCommonProps, ChartContainer, commonProps } from './ChartContainer.tsx'
import { type ChartXValue, cartesianData, cartesianTable } from './cartesian.ts'
import { type ChartModule, type ChartNav, ChartPlot, type PlotEnv } from './engine.tsx'
import type { ValueFormat } from './format.ts'
import { type LineModel, lineOption, lineTooltip, visibleSeries } from './line.ts'
import { type ChartSeries, legendItems, seriesModels, warnTooManySeries } from './series.ts'
import { tooltipText } from './tooltip.ts'

const MODULES: readonly ChartModule[] = [LineSeries, GridComponent, TooltipComponent]

/**
 * Props of LineChart.
 * @zh LineChart 属性。
 */
export interface LineChartProps<T extends object = Record<string, unknown>>
  extends ChartCommonProps {
  /**
   * The rows: one per category (x), with a field per series.
   * @zh 行数据：每个类别（x）一行，每个系列一个字段。
   */
  readonly data: readonly T[]
  /**
   * Field of the rows that holds the category (a text, a number or a date).
   * @zh 行数据中保存类别的字段（文字、数字或日期）。
   */
  readonly x: keyof T & string
  /**
   * The series, in legend order. Colors follow the position in this array (or `slot`), so hiding or filtering a
   * series never changes the color of the others. From the 9th series on, the muted color is used.
   * @zh 各系列，按图例顺序。颜色按在数组中的位置（或 `slot`）分配，隐藏、筛掉某个系列不会让其他系列变色。
   * 第 9 个起用弱化色。
   */
  readonly series: readonly ChartSeries<keyof T & string>[]
  /**
   * How values are written on the value axis, in the tooltip and in the table.
   * @zh 数值的写法：数值轴、提示与表格共用。
   * @default 'auto'
   */
  readonly format?: ValueFormat
  /**
   * Writes a category, such as a date; by default `String(value)` (dates as `YYYY-MM-DD`).
   * @zh 类别的写法，如日期；默认 `String(value)`（日期为 `YYYY-MM-DD`）。
   */
  readonly xFormat?: (value: ChartXValue) => string
  /**
   * Name of the categories: the header of the first column of the table view. "Category" by default (follows
   * `locale`).
   * @zh 类别的名称：表格视图第一列的表头。默认「类别」（随 `locale`）。
   */
  readonly xLabel?: string
  /**
   * Key of the one series the chart is about: it keeps its color and the others use the muted color.
   * @zh 图表要突出的那个系列的 key：它保持自己的颜色，其余系列用弱化色。
   */
  readonly emphasis?: keyof T & string
}

/**
 * Props of AreaChart.
 * @zh AreaChart 属性。
 */
export interface AreaChartProps<T extends object = Record<string, unknown>>
  extends LineChartProps<T> {
  /**
   * Stacks the series: each area starts where the previous one ends, and the top line is the total.
   * @zh 堆叠：每个面积从上一个的顶端开始，最上面的线是总和。
   */
  readonly stacked?: boolean
}

/** 折线与面积共用的实现（类型参数在入口处已经检查过，这里按字段名处理）。 */
interface LineBaseProps extends ChartCommonProps {
  readonly data: readonly object[]
  readonly x: string
  readonly series: readonly ChartSeries[]
  readonly format?: ValueFormat
  readonly xFormat?: (value: ChartXValue) => string
  readonly xLabel?: string
  readonly emphasis?: string
  readonly stacked?: boolean
  readonly area: boolean
  readonly component: string
}

function LineBase(props: LineBaseProps) {
  const t = useT()
  const locale = t('format.locale')
  const missing = t('format.missing')
  const format = props.format ?? 'auto'
  const { area, series, emphasis, component } = props
  const stacked = area && (props.stacked ?? false)
  const [hidden, setHidden] = useState<readonly string[]>([])
  const models = useMemo(() => seriesModels(series, emphasis), [series, emphasis])
  const data = useMemo(
    () => cartesianData(props.data, props.x, series, props.xFormat),
    [props.data, props.x, series, props.xFormat],
  )
  useEffect(() => warnTooManySeries(component, series.length), [component, series.length])

  const model = useMemo<LineModel>(
    () => ({ data, series: models, hidden, area, stacked, format, locale, missing }),
    [data, models, hidden, area, stacked, format, locale, missing],
  )
  const build = useCallback((env: PlotEnv) => lineOption(model, env), [model])
  const nav = useMemo<ChartNav>(
    () => ({
      cols: data.categories.length,
      rows: 1,
      keys: { colNext: 'ArrowRight', colPrev: 'ArrowLeft' },
      target: (col) =>
        visibleSeries(model).length > 0 && col >= 0 && col < data.categories.length
          ? {
              // 坐标轴提示：任意一个显示中的系列都能把十字线移到这个类别，提示列出全部系列
              seriesIndex: 0,
              dataIndex: col,
              highlight: false,
              text: tooltipText(lineTooltip(model, null, col)),
            }
          : null,
    }),
    [model, data.categories.length],
  )
  const table = useMemo(
    () =>
      cartesianTable(
        data,
        models,
        props.xLabel ?? t('chart.table.category'),
        format,
        locale,
        missing,
      ),
    [data, models, props.xLabel, t, format, locale, missing],
  )
  const kind = t(area ? 'chart.kind.area' : 'chart.kind.line')
  return (
    <ChartContainer
      {...commonProps(props)}
      legend={legendItems(models, area ? 'square' : 'line')}
      hiddenKeys={hidden}
      onHiddenKeysChange={setHidden}
      table={table}
      empty={props.data.length === 0 || series.length === 0}
    >
      <ChartPlot
        modules={MODULES}
        build={build}
        nav={nav}
        label={props.title ?? kind}
        kind={kind}
        hint={t('chart.keys')}
      />
    </ChartContainer>
  )
}

/**
 * Line chart: one or more series over ordered categories, usually time. Use it for trends; for a single series
 * where the volume matters, AreaChart.
 *
 * **Interaction**: a vertical crosshair follows the pointer and snaps to the nearest category; the tooltip lists
 * every visible series at that category, values first. `Tab` focuses the chart (focus ring only for the
 * keyboard); `←` / `→` move between categories with the same tooltip, `Home` / `End` jump to the first and last,
 * `Esc` hides the tooltip. Legend items show and hide series without changing colors; the "Chart / Table" switch
 * shows every value as a table.
 * @zh 折线图：有序类别（通常是时间）上的一个或多个系列，用于看趋势；单个系列且关心总量时用 AreaChart。
 *
 * **交互**：竖向十字线跟随指针并吸附到最近的类别，提示列出该类别上全部显示中的系列（数值在前）。`Tab` 聚焦图表
 * （焦点环只在键盘操作时出现）；`←` / `→` 在类别之间移动并显示同样的提示，`Home` / `End` 跳到首尾，`Esc` 关闭提示。
 * 图例项显示、隐藏系列，不改变颜色；「图表 / 表格」切换以表格列出全部数值。
 * @category Charts
 * @usage Trends over time (revenue per month, active users per day), comparing a few series over the same period
 * @usageZh 随时间的趋势（每月收入、每日活跃用户），比较同一时期的几个系列
 */
export function LineChart<T extends object>(props: LineChartProps<T>) {
  return <LineBase {...(props as unknown as LineBaseProps)} area={false} component="LineChart" />
}

/**
 * Area chart: a line chart whose areas are filled with a light wash (about 10% opacity). Use it for a single
 * series where the volume matters, or `stacked` for parts that add up to a total over time.
 *
 * **Interaction**: the same as LineChart: a crosshair snapped to the nearest category, a tooltip with every
 * visible series, `←` / `→`, `Home` / `End` and `Esc` on the keyboard, legend toggles and the table view.
 * @zh 面积图：面积用淡色（约 10% 不透明度）填充的折线图。用于关心总量的单个系列，或用 `stacked` 表示随时间
 * 累加为总和的几个部分。
 *
 * **交互**：与 LineChart 相同：吸附到最近类别的十字线、列出全部显示中系列的提示，键盘 `←` / `→`、`Home` / `End`、
 * `Esc`，图例切换与表格视图。
 * @category Charts
 * @usage Volume over time (storage used, requests per hour), parts of a total over time (stacked)
 * @usageZh 随时间的总量（已用存储、每小时请求数），随时间累加的几个部分（堆叠）
 */
export function AreaChart<T extends object>(props: AreaChartProps<T>) {
  return <LineBase {...(props as unknown as LineBaseProps)} area component="AreaChart" />
}
