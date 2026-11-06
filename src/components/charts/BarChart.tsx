/**
 * 柱状图（分组、堆叠、横向）：ECharts 的自定义系列逐个画柱，只引入它自己需要的图表类型与组件。
 * 外观规格见 bar.ts；容器、图例、表格视图与状态见 ChartContainer。
 */
import { CustomChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useT } from '../../i18n/index.ts'
import { type BarModel, barOption, barSegments, barTooltip, visibleBars } from './bar.ts'
import { type ChartCommonProps, ChartContainer, commonProps } from './ChartContainer.tsx'
import { type ChartXValue, cartesianData, cartesianTable } from './cartesian.ts'
import { type ChartModule, type ChartNav, ChartPlot, type PlotEnv } from './engine.tsx'
import type { ValueFormat } from './format.ts'
import { type ChartSeries, legendItems, seriesModels, warnTooManySeries } from './series.ts'
import { tooltipText } from './tooltip.ts'

const MODULES: readonly ChartModule[] = [CustomChart, GridComponent, TooltipComponent]

/**
 * Props of BarChart.
 * @zh BarChart 属性。
 */
export interface BarChartProps<T extends object = Record<string, unknown>>
  extends ChartCommonProps {
  /**
   * The rows: one per category, with a field per series.
   * @zh 行数据：每个类别一行，每个系列一个字段。
   */
  readonly data: readonly T[]
  /**
   * Field of the rows that holds the category: on the horizontal axis, or on the vertical axis with
   * `orientation="horizontal"`.
   * @zh 行数据中保存类别的字段：在横轴上；`orientation="horizontal"` 时在纵轴上。
   */
  readonly x: keyof T & string
  /**
   * The series, in legend order. Colors follow the position in this array (or `slot`), so hiding or filtering a
   * series never changes the color of the others. A single series uses one color for every bar.
   * @zh 各系列，按图例顺序。颜色按在数组中的位置（或 `slot`）分配，隐藏、筛掉某个系列不会让其他系列变色。
   * 只有一个系列时所有柱同一个颜色。
   */
  readonly series: readonly ChartSeries<keyof T & string>[]
  /**
   * `vertical`: columns growing up from the horizontal axis; `horizontal`: bars growing right from the vertical
   * axis, better for long category names or many categories.
   * @zh `vertical`：从横轴向上的柱；`horizontal`：从纵轴向右的条，适合类别名长或类别多的情况。
   * @default 'vertical'
   */
  readonly orientation?: 'vertical' | 'horizontal'
  /**
   * Stacks the series in one bar per category; the end of the bar is the total. Otherwise the series are grouped
   * side by side.
   * @zh 堆叠：每个类别一根柱，柱端是总和；否则各系列并排分组。
   */
  readonly stacked?: boolean
  /**
   * Writes the value at the end of each bar (the total for stacked bars). Values that do not fit are left out;
   * they stay in the tooltip and the table.
   * @zh 在柱端写出数值（堆叠时为总和）。放不下的不写，仍可在提示与表格中读到。
   */
  readonly showValues?: boolean
  /**
   * How values are written on the value axis, at the bar ends, in the tooltip and in the table.
   * @zh 数值的写法：数值轴、柱端、提示与表格共用。
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
 * Bar chart: compares values across categories, as grouped or stacked columns, or as horizontal bars. Bars are at
 * most 24 px thick with a 2 px gap between neighbors and stacked segments; only the data end is rounded.
 *
 * **Interaction**: each bar is its own hover target and lifts slightly; the tooltip shows its category and value.
 * `Tab` focuses the chart (focus ring only for the keyboard); `←` / `→` move between categories (`↑` / `↓` with
 * `orientation="horizontal"`) and `↑` / `↓` between the series of a category (`←` / `→` when horizontal), with
 * the same tooltip; `Home` / `End` jump to the first and last category and `Esc` hides the tooltip. Legend items
 * show and hide series without changing colors; the "Chart / Table" switch shows every value as a table.
 * @zh 柱状图：比较各类别的数值，分组或堆叠的竖柱，或横向的条。柱宽不超过 24px，相邻的柱与堆叠的段之间有 2px
 * 间隙，只有数据端圆角。
 *
 * **交互**：每根柱是自己的悬停区域，悬停时稍微提亮，提示显示类别与数值。`Tab` 聚焦图表（焦点环只在键盘操作时
 * 出现）；`←` / `→` 在类别之间移动（`orientation="horizontal"` 时为 `↑` / `↓`），`↑` / `↓` 在同一类别的系列之间
 * 移动（横向时为 `←` / `→`），显示同样的提示；`Home` / `End` 跳到第一个与最后一个类别，`Esc` 关闭提示。
 * 图例项显示、隐藏系列，不改变颜色；「图表 / 表格」切换以表格列出全部数值。
 * @category Charts
 * @usage Comparing amounts across categories (sales per region), ranked lists (horizontal, largest first), parts
 * of a total over time (stacked)
 * @usageZh 比较各类别的数量（各地区销售额）、排名（横向，从大到小），随时间变化的总量构成（堆叠）
 */
export function BarChart<T extends object>(props: BarChartProps<T>) {
  const t = useT()
  const locale = t('format.locale')
  const missing = t('format.missing')
  const format = props.format ?? 'auto'
  const orientation = props.orientation ?? 'vertical'
  const stacked = props.stacked ?? false
  const showValues = props.showValues ?? false
  const series = props.series as readonly ChartSeries[]
  const emphasis = props.emphasis as string | undefined
  const rowsData = props.data as readonly object[]
  const [hidden, setHidden] = useState<readonly string[]>([])
  const models = useMemo(() => seriesModels(series, emphasis), [series, emphasis])
  const data = useMemo(
    () => cartesianData(rowsData, props.x, series, props.xFormat),
    [rowsData, props.x, series, props.xFormat],
  )
  useEffect(() => warnTooManySeries('BarChart', series.length), [series.length])

  const model = useMemo<BarModel>(
    () => ({
      data,
      series: models,
      hidden,
      orientation,
      stacked,
      showValues,
      format,
      locale,
      missing,
    }),
    [data, models, hidden, orientation, stacked, showValues, format, locale, missing],
  )
  const build = useCallback((env: PlotEnv) => barOption(model, env), [model])
  const nav = useMemo<ChartNav>(() => {
    const segments = barSegments(model)
    const vertical = orientation === 'vertical'
    return {
      cols: data.categories.length,
      rows: visibleBars(model).length,
      keys: vertical
        ? { colNext: 'ArrowRight', colPrev: 'ArrowLeft', rowNext: 'ArrowUp', rowPrev: 'ArrowDown' }
        : { colNext: 'ArrowDown', colPrev: 'ArrowUp', rowNext: 'ArrowRight', rowPrev: 'ArrowLeft' },
      target: (col, row) =>
        segments[row]?.[col]
          ? {
              seriesIndex: row,
              dataIndex: col,
              highlight: true,
              text: tooltipText(barTooltip(model, null, row, col)),
            }
          : null,
    }
  }, [model, orientation, data.categories.length])
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
  const kind = t('chart.kind.bar')
  return (
    <ChartContainer
      {...commonProps(props)}
      legend={legendItems(models, 'square')}
      hiddenKeys={hidden}
      onHiddenKeysChange={setHidden}
      table={table}
      empty={rowsData.length === 0 || series.length === 0}
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
