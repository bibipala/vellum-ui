/**
 * 热力图的 ECharts 选项（纯函数，测试直接检查外观规格）。
 *
 * - 格子用自定义系列逐个画矩形，相邻格子之间 2px 真实间隙（露出背后的表面），小圆角；缺失的格子不画；
 * - 颜色：顺序色阶（`color-chart-seq-1..7`）从最小值到最大值插值；发散色阶（`color-chart-div-1..7`）以中点
 *   （默认 0）为第 4 级，两侧取到中点距离较大的一侧，色阶对称。插值在 OKLab 中进行，与色标的 CSS 渐变一致；
 * - 悬停或键盘指向的格子加一圈主要文字色的描边（不改变格子的颜色：颜色本身就是数值）；
 * - 两条类别轴，第一行在最上面；不画网格线与轴线。
 */
import type { EChartsCoreOption } from 'echarts/core'
import type { ChartTableData } from './ChartContainer.tsx'
import { AXIS_LABEL_MARGIN, animationOption, gridOption, textStyleOption } from './cartesian.ts'
import { rampColor } from './color.ts'
import type { PlotEnv } from './engine.tsx'
import { formatValue, type ValueFormat } from './format.ts'
import type { ChartPalette } from './palette.ts'
import { type TooltipContent, tooltipBase, tooltipElement } from './tooltip.ts'

/**
 * A cell of a heatmap.
 * @zh 热力图中的一个格子。
 */
export interface HeatmapCell {
  /**
   * Column: one of `xCategories`.
   * @zh 列：`xCategories` 中的一项。
   */
  readonly x: string
  /**
   * Row: one of `yCategories`.
   * @zh 行：`yCategories` 中的一项。
   */
  readonly y: string
  /**
   * The value; a missing value draws no cell.
   * @zh 数值；缺失时不画格子。
   */
  readonly value: number | null
}

/** 相邻格子之间的间隙、格子的圆角（像素）。 */
export const CELL_GAP = 2
export const CELL_RADIUS = 2

/** 热力图的输入。 */
export interface HeatmapModel {
  readonly xCategories: readonly string[]
  readonly yCategories: readonly string[]
  readonly data: readonly HeatmapCell[]
  readonly scale: 'sequential' | 'diverging'
  readonly midpoint: number
  readonly format: ValueFormat
  readonly locale: string
  readonly missing: string
  readonly xLabel?: string
  readonly yLabel?: string
  readonly valueLabel?: string
}

/** 色阶的数值范围：顺序色是数据的最小、最大值；发散色以中点对称。 */
export interface HeatmapDomain {
  readonly min: number
  readonly max: number
  /** 发散色的中点；顺序色为 undefined。 */
  readonly mid?: number
}

/** 能画出来的格子：列、行的位置与数值（类别不存在、数值缺失的不算）。 */
export interface PlacedCell {
  readonly col: number
  readonly row: number
  readonly value: number
}

/** 按列、行定位格子；同一个位置出现多次时取最后一个。 */
export function placeCells(m: HeatmapModel): PlacedCell[] {
  const xi = new Map(m.xCategories.map((c, i) => [c, i]))
  const yi = new Map(m.yCategories.map((c, i) => [c, i]))
  const byPos = new Map<string, PlacedCell>()
  for (const d of m.data) {
    const col = xi.get(d.x)
    const row = yi.get(d.y)
    if (col === undefined || row === undefined) continue
    if (typeof d.value !== 'number' || !Number.isFinite(d.value)) continue
    byPos.set(`${col}:${row}`, { col, row, value: d.value })
  }
  return [...byPos.values()]
}

/** 色阶的数值范围。 */
export function heatmapDomain(m: HeatmapModel, cells: readonly PlacedCell[]): HeatmapDomain {
  const values = cells.map((c) => c.value)
  const lo = values.length ? Math.min(...values) : 0
  const hi = values.length ? Math.max(...values) : 0
  if (m.scale === 'sequential') return { min: lo, max: hi }
  const d = Math.max(Math.abs(lo - m.midpoint), Math.abs(hi - m.midpoint))
  return { min: m.midpoint - d, max: m.midpoint + d, mid: m.midpoint }
}

/** 数值在色阶上的位置（0–1）：范围为 0 时在正中。 */
export function heatmapPosition(value: number, domain: HeatmapDomain): number {
  const span = domain.max - domain.min
  if (!(span > 0)) return 0.5
  return Math.min(1, Math.max(0, (value - domain.min) / span))
}

/** 数值的颜色：沿顺序色阶或发散色阶在 OKLab 中插值。 */
export function heatmapColor(
  value: number,
  domain: HeatmapDomain,
  scale: HeatmapModel['scale'],
  p: Pick<ChartPalette, 'sequential' | 'diverging'>,
): string {
  return rampColor(
    scale === 'sequential' ? p.sequential : p.diverging,
    heatmapPosition(value, domain),
  )
}

/** 某个格子的提示：「列 · 行」作标题，一行是数值（键是格子自己的颜色）。 */
export function heatmapTooltip(
  m: HeatmapModel,
  p: ChartPalette | null,
  cell: PlacedCell | undefined,
  domain: HeatmapDomain,
): TooltipContent {
  if (!cell) return { rows: [] }
  return {
    title: `${m.xCategories[cell.col] ?? ''} · ${m.yCategories[cell.row] ?? ''}`,
    rows: [
      {
        color: p ? heatmapColor(cell.value, domain, m.scale, p) : '',
        value: formatValue(cell.value, m.format, m.locale, m.missing),
        name: m.valueLabel ?? '',
      },
    ],
  }
}

/** 表格视图：每个格子一行（按行、再按列），三列：列、行、数值。 */
export function heatmapTable(m: HeatmapModel, valueHeader: string): ChartTableData {
  const cells = placeCells(m).sort((a, b) => a.row - b.row || a.col - b.col)
  return {
    columns: [
      { key: 'x', title: m.xLabel ?? 'x' },
      { key: 'y', title: m.yLabel ?? 'y' },
      { key: 'value', title: m.valueLabel ?? valueHeader, numeric: true },
    ],
    rows: cells.map((c) => ({
      x: m.xCategories[c.col] ?? '',
      y: m.yCategories[c.row] ?? '',
      value: formatValue(c.value, m.format, m.locale, m.missing),
    })),
  }
}

/** renderItem 用到的 ECharts 接口（只用坐标换算）。 */
export interface CellRenderApi {
  coord(value: [number, number]): number[]
  size(value: [number, number]): number[] | number
}

/** 生成格子的 renderItem。 */
export function cellRenderer(
  cells: readonly PlacedCell[],
  colors: readonly string[],
  p: ChartPalette,
) {
  return (params: { dataIndex: number }, api: CellRenderApi) => {
    const cell = cells[params.dataIndex]
    if (!cell) return null
    const [cx = 0, cy = 0] = api.coord([cell.col, cell.row])
    const size = api.size([1, 1])
    const [bw = 0, bh = 0] = Array.isArray(size) ? size : [size, size]
    const w = Math.max(0, Math.abs(bw) - CELL_GAP)
    const h = Math.max(0, Math.abs(bh) - CELL_GAP)
    return {
      type: 'rect',
      shape: {
        x: cx - w / 2,
        y: cy - h / 2,
        width: w,
        height: h,
        r: Math.min(CELL_RADIUS, w / 2, h / 2),
      },
      style: { fill: colors[params.dataIndex], stroke: 'none', lineWidth: 0 },
      enterFrom: { style: { opacity: 0 } },
      // 悬停：外加一圈主要文字色的描边，颜色不变（颜色本身就是数值）
      emphasis: { style: { stroke: p.textPrimary, lineWidth: 2 } },
    }
  }
}

/** 生成热力图的选项。 */
export function heatmapOption(m: HeatmapModel, env: PlotEnv): EChartsCoreOption {
  const p = env.palette
  const cells = placeCells(m)
  const domain = heatmapDomain(m, cells)
  const colors = cells.map((c) => heatmapColor(c.value, domain, m.scale, p))
  const text = { color: p.textTertiary, fontSize: p.fontSize, fontFamily: p.fontFamily }
  const axis = (data: readonly string[], extra: Record<string, unknown>) => ({
    type: 'category',
    data,
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: { show: false },
    axisLabel: { ...text, margin: AXIS_LABEL_MARGIN, hideOverlap: true },
    ...extra,
  })
  return {
    ...animationOption(p),
    ...textStyleOption(p),
    grid: gridOption({ top: 4, right: 4 }),
    xAxis: axis(m.xCategories, {}),
    // 第一行在最上面（与表格的阅读顺序一致）
    yAxis: axis(m.yCategories, { inverse: true }),
    tooltip: {
      ...tooltipBase(p),
      trigger: 'item',
      formatter: (params: unknown) => {
        const { dataIndex = -1 } = (params ?? {}) as { dataIndex?: number }
        return tooltipElement(heatmapTooltip(m, p, cells[dataIndex], domain))
      },
    },
    series: [
      {
        type: 'custom',
        id: 'cells',
        coordinateSystem: 'cartesian2d',
        encode: { x: 0, y: 1 },
        data: cells.map((c) => [c.col, c.row, c.value]),
        renderItem: cellRenderer(cells, colors, p),
        emphasis: { focus: 'none' },
      },
    ],
  }
}
