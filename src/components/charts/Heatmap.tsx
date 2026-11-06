/**
 * 热力图：两个类别维度上的数值，用顺序或发散色阶表示（ECharts 的自定义系列逐个画格子）。
 * 外观规格见 heatmap-model.ts；色标自己用 React 渲染；容器、表格视图与状态见 ChartContainer。
 */
import { CustomChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { useCallback, useMemo } from 'react'
import { useT } from '../../i18n/index.ts'
import { type ChartCommonProps, ChartContainer, commonProps } from './ChartContainer.tsx'
import { type ChartModule, type ChartNav, ChartPlot, type PlotEnv } from './engine.tsx'
import { useFormatValue, type ValueFormat } from './format.ts'
import styles from './heatmap.module.css'
import {
  type HeatmapCell,
  type HeatmapModel,
  heatmapDomain,
  heatmapOption,
  heatmapTable,
  heatmapTooltip,
  placeCells,
} from './heatmap-model.ts'
import { tooltipText } from './tooltip.ts'

const MODULES: readonly ChartModule[] = [CustomChart, GridComponent, TooltipComponent]

/**
 * Props of Heatmap.
 * @zh Heatmap 属性。
 */
export interface HeatmapProps extends ChartCommonProps {
  /**
   * The columns, left to right.
   * @zh 各列，从左到右。
   */
  readonly xCategories: readonly string[]
  /**
   * The rows, top to bottom.
   * @zh 各行，从上到下。
   */
  readonly yCategories: readonly string[]
  /**
   * The cells; a cell whose `x` or `y` is not a category, or whose value is missing, is not drawn.
   * @zh 各格子；`x`、`y` 不是已有类别或数值缺失的格子不画。
   */
  readonly data: readonly HeatmapCell[]
  /**
   * `sequential`: one hue from the smallest to the largest value (magnitude); `diverging`: two opposite hues on
   * both sides of `midpoint`, gray at the midpoint (above or below a baseline).
   * @zh `sequential`：单一色相，从最小值到最大值（大小）；`diverging`：`midpoint` 两侧冷暖相对的两种色相，中点为灰色
   * （高于或低于基线）。
   * @default 'sequential'
   */
  readonly scale?: 'sequential' | 'diverging'
  /**
   * The value of the neutral middle of a diverging scale; the scale is symmetric around it.
   * @zh 发散色阶中性中点的数值；色阶以它为中心对称。
   * @default 0
   */
  readonly midpoint?: number
  /**
   * How values are written in the color scale, the tooltip and the table.
   * @zh 数值的写法：色标、提示与表格共用。
   * @default 'auto'
   */
  readonly format?: ValueFormat
  /**
   * Name of the columns: the header of the first column of the table view.
   * @zh 列的名称：表格视图第一列的表头。
   */
  readonly xLabel?: string
  /**
   * Name of the rows: the header of the second column of the table view.
   * @zh 行的名称：表格视图第二列的表头。
   */
  readonly yLabel?: string
  /**
   * Name of the values, in the tooltip and as the header of the value column. "Value" by default in the table
   * (follows `locale`).
   * @zh 数值的名称，用于提示与表格的数值列表头。表格中默认「数值」（随 `locale`）。
   */
  readonly valueLabel?: string
}

/**
 * Heatmap: values over two sets of categories (such as weekdays and hours), colored on a sequential scale for
 * magnitude or a diverging scale around a midpoint. A color scale with the smallest and largest values (and the
 * midpoint) is always shown under the cells.
 *
 * **Interaction**: each cell is its own hover target and gets an outline (its color is the value, so it does not
 * change); the tooltip shows the column, the row and the value. `Tab` focuses the chart (focus ring only for the
 * keyboard); the four arrow keys move between cells, skipping empty ones, with the same tooltip; `Home` / `End`
 * jump to the first and last cell of the row and `Esc` hides the tooltip. The table view lists every cell.
 * @zh 热力图：两组类别（如星期与小时）上的数值，用顺序色阶表示大小，或用发散色阶表示高于、低于中点。格子下方始终
 * 显示色标，标出最小值、最大值（与中点）。
 *
 * **交互**：每个格子是自己的悬停区域，悬停时加一圈描边（颜色就是数值，所以不变）；提示显示列、行与数值。`Tab`
 * 聚焦图表（焦点环只在键盘操作时出现）；四个方向键在格子之间移动（跳过空格子）并显示同样的提示，`Home` / `End`
 * 跳到这一行的第一个与最后一个格子，`Esc` 关闭提示。表格视图列出全部格子。
 * @category Charts
 * @usage Activity by weekday and hour, change compared with a target by team and month (diverging)
 * @usageZh 按星期与小时的活跃度，各团队每月相对目标的变化（发散）
 */
export function Heatmap(props: HeatmapProps) {
  const t = useT()
  const locale = t('format.locale')
  const missing = t('format.missing')
  const scale = props.scale ?? 'sequential'
  const midpoint = props.midpoint ?? 0
  const format = props.format ?? 'auto'
  const fmt = useFormatValue(format)
  const { xCategories, yCategories, data, xLabel, yLabel, valueLabel } = props

  const model = useMemo<HeatmapModel>(
    () => ({
      xCategories,
      yCategories,
      data,
      scale,
      midpoint,
      format,
      locale,
      missing,
      xLabel,
      yLabel,
      valueLabel,
    }),
    [
      xCategories,
      yCategories,
      data,
      scale,
      midpoint,
      format,
      locale,
      missing,
      xLabel,
      yLabel,
      valueLabel,
    ],
  )
  const cells = useMemo(() => placeCells(model), [model])
  const domain = useMemo(() => heatmapDomain(model, cells), [model, cells])
  const build = useCallback((env: PlotEnv) => heatmapOption(model, env), [model])
  const nav = useMemo<ChartNav>(() => {
    const index = new Map(cells.map((c, i) => [`${c.col}:${c.row}`, i]))
    return {
      cols: xCategories.length,
      rows: yCategories.length,
      keys: {
        colNext: 'ArrowRight',
        colPrev: 'ArrowLeft',
        rowNext: 'ArrowDown',
        rowPrev: 'ArrowUp',
      },
      target: (col, row) => {
        const i = index.get(`${col}:${row}`)
        return i === undefined
          ? null
          : {
              seriesIndex: 0,
              dataIndex: i,
              highlight: true,
              text: tooltipText(heatmapTooltip(model, null, cells[i], domain)),
            }
      },
    }
  }, [model, cells, domain, xCategories.length, yCategories.length])
  const table = useMemo(() => heatmapTable(model, t('chart.table.value')), [model, t])
  const kind = t('chart.kind.heatmap')
  const min = fmt(domain.min)
  const max = fmt(domain.max)
  const mid = domain.mid === undefined ? undefined : fmt(domain.mid)
  return (
    <ChartContainer {...commonProps(props)} table={table} empty={cells.length === 0}>
      <div className={styles.heatmap}>
        <ChartPlot
          modules={MODULES}
          build={build}
          nav={nav}
          label={props.title ?? kind}
          kind={kind}
          hint={t('chart.keys.grid')}
        />
        <figure
          className={styles.scale}
          role="img"
          aria-label={
            mid === undefined
              ? t('chart.scale', { min, max })
              : t('chart.scale.diverging', { min, max, mid })
          }
        >
          <div className={styles.ramp} data-scale={scale} />
          <div className={styles.ticks} aria-hidden>
            <span>{min}</span>
            {mid !== undefined && <span>{mid}</span>}
            <span>{max}</span>
          </div>
        </figure>
      </div>
    </ChartContainer>
  )
}
