/**
 * 饼图与环形图（ECharts 的 pie 系列，只引入它自己需要的图表类型与组件）。
 * 外观规格见 pie.ts；容器、图例、表格视图与状态见 ChartContainer。
 */
import { PieChart as PieSeries } from 'echarts/charts'
import { TooltipComponent } from 'echarts/components'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useT } from '../../i18n/index.ts'
import { type ChartCommonProps, ChartContainer, commonProps } from './ChartContainer.tsx'
import { type ChartModule, type ChartNav, ChartPlot, type PlotEnv } from './engine.tsx'
import { CHART_SLOTS, type ValueFormat } from './format.ts'
import {
  DEFAULT_MAX_SLICES,
  type PieChartDatum,
  type PieModel,
  pieAnnouncement,
  pieOption,
  pieSlices,
  pieTable,
  visibleSlices,
} from './pie.ts'
import { devWarn } from './series.ts'

const MODULES: readonly ChartModule[] = [PieSeries, TooltipComponent]

/**
 * Props of PieChart and DonutChart.
 * @zh PieChart 与 DonutChart 属性。
 */
export interface PieChartProps extends ChartCommonProps {
  /**
   * The items. Colors follow the position in this array (or `slot`), so hiding or folding items never changes
   * the color of the others.
   * @zh 各项。颜色按在数组中的位置（或 `slot`）分配，隐藏、合并某些项不会让其他项变色。
   */
  readonly data: readonly PieChartDatum[]
  /**
   * Most slices drawn: beyond it, the largest `maxSlices - 1` items are kept and the rest are folded into
   * "Other" (muted color). The table view still lists every item. At most 8.
   * @zh 最多画几个扇区：超过时保留最大的 `maxSlices - 1` 项，其余合并为「其他」（弱化色）。表格视图仍列出全部项。最多 8。
   * @default 6
   */
  readonly maxSlices?: number
  /**
   * How values are written in the tooltip and the table.
   * @zh 数值的写法：提示与表格共用。
   * @default 'auto'
   */
  readonly format?: ValueFormat
  /**
   * Header of the name column of the table view, "Category" by default (follows `locale`).
   * @zh 表格视图名称列的表头，默认「类别」（随 `locale`）。
   */
  readonly nameLabel?: string
  /**
   * Header of the value column of the table view, "Value" by default (follows `locale`).
   * @zh 表格视图数值列的表头，默认「数值」（随 `locale`）。
   */
  readonly valueLabel?: string
}

/**
 * Props of DonutChart: the same as PieChart.
 * @zh DonutChart 属性：与 PieChart 相同。
 */
export type DonutChartProps = PieChartProps

function PieBase(props: PieChartProps & { readonly donut: boolean }) {
  const t = useT()
  const locale = t('format.locale')
  const missing = t('format.missing')
  const otherName = t('chart.other')
  const format = props.format ?? 'auto'
  const { data, donut } = props
  const maxSlices = props.maxSlices ?? DEFAULT_MAX_SLICES
  const [hidden, setHidden] = useState<readonly string[]>([])
  const component = donut ? 'DonutChart' : 'PieChart'
  useEffect(() => {
    if (maxSlices > CHART_SLOTS)
      devWarn(
        `${component}: maxSlices is ${maxSlices}, but at most ${CHART_SLOTS} slices are drawn.`,
      )
    if (data.some((d) => Number.isFinite(d.value) && d.value < 0))
      devWarn(`${component}: negative values draw no slice. Use a BarChart for values below zero.`)
  }, [component, maxSlices, data])

  const model = useMemo<PieModel>(
    () => ({ data, hidden, maxSlices, donut, format, locale, missing, otherName }),
    [data, hidden, maxSlices, donut, format, locale, missing, otherName],
  )
  const slices = useMemo(() => pieSlices(data, maxSlices, otherName), [data, maxSlices, otherName])
  const build = useCallback((env: PlotEnv) => pieOption(model, env), [model])
  const nav = useMemo<ChartNav>(() => {
    const count = visibleSlices(model).length
    return {
      cols: count,
      rows: 1,
      keys: { colNext: 'ArrowRight', colPrev: 'ArrowLeft' },
      target: (col) =>
        col >= 0 && col < count
          ? { seriesIndex: 0, dataIndex: col, highlight: true, text: pieAnnouncement(model, col) }
          : null,
    }
  }, [model])
  const table = useMemo(
    () =>
      pieTable(model, {
        name: props.nameLabel ?? t('chart.table.category'),
        value: props.valueLabel ?? t('chart.table.value'),
        share: t('chart.table.share'),
      }),
    [model, props.nameLabel, props.valueLabel, t],
  )
  const kind = t(donut ? 'chart.kind.donut' : 'chart.kind.pie')
  return (
    <ChartContainer
      {...commonProps(props)}
      legend={slices.map((s) => ({ key: s.key, name: s.name, color: s.color, marker: 'square' }))}
      hiddenKeys={hidden}
      onHiddenKeysChange={setHidden}
      table={table}
      empty={slices.length === 0}
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
 * Pie chart: one whole split into a few parts (at most 6 by default; the rest is folded into "Other"). Read at a
 * glance only: to compare close values use a BarChart, and for part-to-whole prefer SegmentedBar.
 *
 * **Interaction**: each slice is its own hover target and lifts slightly; the tooltip shows its value and share.
 * `Tab` focuses the chart (focus ring only for the keyboard); `←` / `→` move between slices with the same
 * tooltip, `Home` / `End` jump to the first and last, `Esc` hides the tooltip. Legend items hide and show slices
 * (the shares are recomputed) without changing colors; the table view lists every item, folded ones included.
 * @zh 饼图：一个整体分成少数几部分（默认最多 6 个，其余合并为「其他」），只用于一眼看出大致比例：
 * 比较相近的数值用柱状图，部分占整体首选 SegmentedBar。
 *
 * **交互**：每个扇区是自己的悬停区域，悬停时稍微提亮，提示显示数值与占比。`Tab` 聚焦图表（焦点环只在键盘操作时
 * 出现）；`←` / `→` 在扇区之间移动并显示同样的提示，`Home` / `End` 跳到首尾，`Esc` 关闭提示。图例项隐藏、显示扇区
 * （占比随之重算），不改变颜色；表格视图列出全部项，包括合并进「其他」的。
 * @category Charts
 * @usage A rough split of one whole into a few parts (storage by file type, traffic by source)
 * @usageZh 一个整体粗略分成几部分（按文件类型的存储、按来源的流量）
 */
export function PieChart(props: PieChartProps) {
  return <PieBase {...props} donut={false} />
}

/**
 * Donut chart: a pie chart drawn as a ring. The same rules apply: a few parts of one whole, read at a glance; to
 * compare close values use a BarChart, and for part-to-whole prefer SegmentedBar.
 *
 * **Interaction**: the same as PieChart: each slice is a hover target, `←` / `→`, `Home` / `End` and `Esc` on
 * the keyboard, legend toggles and the table view.
 * @zh 环形图：画成圆环的饼图。规则与饼图相同：一个整体的少数几部分，只用于一眼看出大致比例；比较相近的数值用
 * 柱状图，部分占整体首选 SegmentedBar。
 *
 * **交互**：与 PieChart 相同：每个扇区是悬停区域，键盘 `←` / `→`、`Home` / `End`、`Esc`，图例切换与表格视图。
 * @category Charts
 * @usage The same uses as PieChart, when a ring fits the layout better
 * @usageZh 与 PieChart 相同的用途，版面上圆环更合适时
 */
export function DonutChart(props: DonutChartProps) {
  return <PieBase {...props} donut />
}
