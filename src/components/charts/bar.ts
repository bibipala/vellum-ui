/**
 * 柱状图的 ECharts 选项（纯函数，测试直接检查外观规格）。
 *
 * 柱用自定义系列（custom）逐个画矩形，而不用 ECharts 的 bar 系列：
 * - 柱宽不超过 24px，一组柱最多占类别宽度的 70%，其余是空白；
 * - 相邻柱、堆叠的段之间是 2px 的真实间隙（露出背后的表面），不画描边。bar 系列只能用表面色描边模拟间隙，
 *   描边会盖住基线与坐标轴；
 * - 只有数据端 4px 圆角、基线端直角，负值、横向相应翻转；堆叠时只有最外端的段圆角。bar 系列的圆角对每一段都生效。
 * 悬停的柱稍微提亮；每根柱自己是触发区域（命中范围包含两侧的间隙，并在数据端外多出 4px）。
 */
import type { EChartsCoreOption } from 'echarts/core'
import {
  allIntegers,
  animationOption,
  type CartesianData,
  categoryAxis,
  extent,
  gridOption,
  HORIZONTAL_TICK_SPACING,
  plotLength,
  stackedExtent,
  textStyleOption,
  valueAxis,
  valueTicks,
} from './cartesian.ts'
import { liftColor } from './color.ts'
import type { PlotEnv } from './engine.tsx'
import { formatValue, type ValueFormat } from './format.ts'
import type { ChartPalette } from './palette.ts'
import { type SeriesModel, seriesColor } from './series.ts'
import type { AxisTicks } from './ticks.ts'
import { type TooltipContent, tooltipBase, tooltipElement } from './tooltip.ts'

/** 柱宽上限、间隙、数据端圆角（像素），一组柱最多占类别宽度的比例。 */
export const BAR_MAX_WIDTH = 24
export const BAR_GAP = 2
export const BAR_RADIUS = 4
export const BAR_GROUP_SHARE = 0.7
/** 命中范围在数据端外多出的像素。 */
const HIT_OVERSHOOT = 4
/** 柱端数值与柱之间的距离（像素）。 */
const LABEL_OFFSET = 4

/** 柱状图的输入。 */
export interface BarModel {
  readonly data: CartesianData
  /** 全部系列（按使用方数组的顺序），含被隐藏的。 */
  readonly series: readonly SeriesModel[]
  readonly hidden: readonly string[]
  readonly orientation: 'vertical' | 'horizontal'
  readonly stacked: boolean
  readonly showValues: boolean
  readonly format: ValueFormat
  readonly locale: string
  readonly missing: string
}

/** 一根柱（或堆叠中的一段）在数值轴上的范围。 */
export interface BarSegment {
  readonly value: number
  readonly start: number
  readonly end: number
  /** 数据端圆角：分组时每根柱都有；堆叠时只有最外端的段。 */
  readonly rounded: boolean
  /** 数据端外侧还有段：留出 2px 间隙。 */
  readonly gapAfter: boolean
  /** 柱端标注（`showValues`；堆叠时是这一侧的总和，标在最外端的段上）。 */
  readonly label?: string
}

/** 显示中的系列（按使用方数组的顺序）。 */
export function visibleBars(m: Pick<BarModel, 'series' | 'hidden'>): SeriesModel[] {
  return m.series.filter((s) => !m.hidden.includes(s.key))
}

/** 每个显示中的系列（行）在每个类别（列）上的段；没有值（缺失或 0）时为 null。 */
export function barSegments(m: BarModel): (BarSegment | null)[][] {
  const visible = visibleBars(m)
  const n = m.data.categories.length
  const out: (BarSegment | null)[][] = visible.map(() => new Array<BarSegment | null>(n).fill(null))
  const fmt = (v: number) => formatValue(v, m.format, m.locale, m.missing)
  for (let c = 0; c < n; c++) {
    let pos = 0
    let neg = 0
    let lastPos = -1
    let lastNeg = -1
    visible.forEach((s, r) => {
      const v = m.data.values[s.index]?.[c] ?? null
      if (v === null || v === 0) return
      const row = out[r] as (BarSegment | null)[]
      if (!m.stacked) {
        row[c] = {
          value: v,
          start: 0,
          end: v,
          rounded: true,
          gapAfter: false,
          label: m.showValues ? fmt(v) : undefined,
        }
        return
      }
      const from = v > 0 ? pos : neg
      row[c] = { value: v, start: from, end: from + v, rounded: false, gapAfter: true }
      if (v > 0) {
        pos += v
        lastPos = r
      } else {
        neg += v
        lastNeg = r
      }
    })
    if (!m.stacked) continue
    // 最外端的段：数据端圆角、外侧没有间隙，柱端标注这一侧的总和
    for (const [r, total] of [
      [lastPos, pos],
      [lastNeg, neg],
    ] as const) {
      const row = out[r]
      const seg = row?.[c]
      if (!row || !seg) continue
      row[c] = {
        ...seg,
        rounded: true,
        gapAfter: false,
        label: m.showValues ? fmt(total) : undefined,
      }
    }
  }
  return out
}

/**
 * 一组柱的宽度与每根柱相对类别中心的偏移（像素）。
 * @param band - 类别宽度（像素）。
 * @param count - 一组中的柱数（堆叠时为 1）。
 */
export function barLayout(band: number, count: number): { width: number; offsets: number[] } {
  const k = Math.max(1, count)
  const width = Math.max(
    1,
    Math.min(BAR_MAX_WIDTH, (Math.abs(band) * BAR_GROUP_SHARE - (k - 1) * BAR_GAP) / k),
  )
  const total = k * width + (k - 1) * BAR_GAP
  return {
    width,
    offsets: Array.from({ length: k }, (_, i) => -total / 2 + i * (width + BAR_GAP)),
  }
}

/** 圆角 [左上, 右上, 右下, 左下]：只有数据端圆角，基线端直角；负值、横向相应翻转。 */
export function barRadius(
  orientation: BarModel['orientation'],
  negative: boolean,
  r: number,
): [number, number, number, number] {
  if (orientation === 'vertical') return negative ? [0, 0, r, r] : [r, r, 0, 0]
  return negative ? [r, 0, 0, r] : [0, r, r, 0]
}

/** renderItem 用到的 ECharts 接口（只用坐标换算）。 */
export interface BarRenderApi {
  coord(value: [number, number]): number[]
  size(value: [number, number]): number[] | number
}

/** 一个数据项的图形：命中区域、柱、柱端标注。 */
export interface BarGraphic {
  readonly type: 'group'
  readonly children: readonly Record<string, unknown>[]
}

/** 生成一个系列（第 row 行）的 renderItem。 */
export function barRenderer(
  m: BarModel,
  segments: readonly (BarSegment | null)[],
  row: number,
  rows: number,
  color: string,
  p: ChartPalette,
) {
  const vertical = m.orientation === 'vertical'
  const lifted = liftColor(color)
  return (params: { dataIndex: number }, api: BarRenderApi): BarGraphic | null => {
    const seg = segments[params.dataIndex]
    if (!seg) return null
    const c = params.dataIndex
    const at = (v: number) => api.coord(vertical ? [c, v] : [v, c])
    const size = api.size(vertical ? [1, 0] : [0, 1])
    const band = Array.isArray(size) ? (size[vertical ? 0 : 1] ?? 0) : size
    const { width, offsets } = barLayout(band, m.stacked ? 1 : rows)
    const offset = offsets[m.stacked ? 0 : row] ?? 0
    const a = at(seg.start)
    const b = at(seg.end)
    const axis = vertical ? 1 : 0
    const from = a[axis] ?? 0
    const rawTo = b[axis] ?? 0
    const dir = Math.sign(rawTo - from) || (seg.value < 0 ? (vertical ? 1 : -1) : vertical ? -1 : 1)
    const len = Math.max(0, Math.abs(rawTo - from) - (seg.gapAfter ? BAR_GAP : 0))
    const to = from + dir * len
    const cross = (a[vertical ? 0 : 1] ?? 0) + offset
    const lo = Math.min(from, to)
    const r = seg.rounded ? Math.min(BAR_RADIUS, width / 2, len) : 0
    const shape = vertical
      ? { x: cross, y: lo, width, height: len, r: barRadius(m.orientation, seg.value < 0, r) }
      : {
          x: lo,
          y: cross,
          width: len,
          height: width,
          r: barRadius(m.orientation, seg.value < 0, r),
        }
    // 命中范围：两侧各含一半间隙，数据端外多出 4px
    const hitLen = len + HIT_OVERSHOOT
    const hitLo = dir < 0 ? from - hitLen : from
    const hit = vertical
      ? { x: cross - BAR_GAP / 2, y: hitLo, width: width + BAR_GAP, height: hitLen }
      : { x: hitLo, y: cross - BAR_GAP / 2, width: hitLen, height: width + BAR_GAP }
    const children: Record<string, unknown>[] = [
      { type: 'rect', shape: hit, style: { fill: 'rgba(0,0,0,0)' }, z2: 0 },
      {
        type: 'rect',
        shape,
        style: { fill: color },
        z2: 1,
        transition: ['shape'],
        enterFrom: vertical ? { shape: { y: from, height: 0 } } : { shape: { x: from, width: 0 } },
        emphasis: { style: { fill: lifted } },
      },
    ]
    if (seg.label !== undefined) {
      const text = seg.label
      // 放不下的标注不画（数值仍在提示与表格中）：纵向柱的标注不能比柱位宽，横向柱的标注不能比柱位高
      const textWidth = text.length * p.fontSize * 0.6
      const fits = vertical ? textWidth <= width + BAR_GAP * 2 + 8 : width + BAR_GAP >= p.fontSize
      if (fits)
        children.push({
          type: 'text',
          silent: true,
          z2: 2,
          style: {
            text,
            fill: p.textSecondary,
            fontSize: p.fontSize,
            fontFamily: p.fontFamily,
            ...(vertical
              ? {
                  x: cross + width / 2,
                  y: to + dir * LABEL_OFFSET,
                  align: 'center',
                  verticalAlign: dir < 0 ? 'bottom' : 'top',
                }
              : {
                  x: to + dir * LABEL_OFFSET,
                  y: cross + width / 2,
                  align: dir < 0 ? 'right' : 'left',
                  verticalAlign: 'middle',
                }),
          },
        })
    }
    return { type: 'group', children }
  }
}

/** 某个系列（显示中的第 row 个）在某个类别上的提示内容（`p` 为 null 时只要文字）。 */
export function barTooltip(
  m: BarModel,
  p: ChartPalette | null,
  row: number,
  col: number,
): TooltipContent {
  const s = visibleBars(m)[row]
  if (!s) return { rows: [] }
  return {
    title: m.data.categories[col] ?? '',
    rows: [
      {
        color: p ? seriesColor(p, s) : '',
        value: formatValue(m.data.values[s.index]?.[col], m.format, m.locale, m.missing),
        name: s.name,
      },
    ],
  }
}

/** 数值轴：分组按单个值、堆叠按累计范围取刻度，始终包含 0；柱端有标注时留出文字的空间。 */
export function barTicks(
  m: BarModel,
  segments: (BarSegment | null)[][],
  lengthPx: number,
  fontSize: number,
): AxisTicks {
  const visible = visibleBars(m)
  const shown = visible.map((s) => m.data.values[s.index] ?? [])
  const range = m.stacked ? stackedExtent(shown, m.data.categories.length) : extent(shown.flat())
  let ticks = valueTicks(range, lengthPx, {
    zero: true,
    integer: allIntegers(shown.flat()),
    spacing: m.orientation === 'horizontal' ? HORIZONTAL_TICK_SPACING : undefined,
  })
  if (!m.showValues) return ticks
  const labels = segments.flat().flatMap((s) => (s?.label ? [s.label] : []))
  if (labels.length === 0) return ticks
  const longest = Math.max(...labels.map((l) => l.length))
  // 纵向需要一行文字的高度，横向需要最长标注的宽度
  const need =
    (m.orientation === 'vertical' ? fontSize : longest * fontSize * 0.6) + LABEL_OFFSET + 4
  for (let i = 0; i < 2; i++) {
    const ppu = lengthPx / (ticks.max - ticks.min)
    const top = (ticks.max - range[1]) * ppu
    const bottom = range[0] < 0 ? (range[0] - ticks.min) * ppu : need
    if (top >= need && bottom >= need) break
    ticks = {
      ...ticks,
      max: top < need ? ticks.max + ticks.step : ticks.max,
      min: bottom < need ? ticks.min - ticks.step : ticks.min,
    }
  }
  return ticks
}

/** 生成柱状图的选项。 */
export function barOption(m: BarModel, env: PlotEnv): EChartsCoreOption {
  const p = env.palette
  const vertical = m.orientation === 'vertical'
  const visible = visibleBars(m)
  const segments = barSegments(m)
  const length = vertical ? plotLength(env.height) : Math.max(0, env.width * 0.65)
  const ticks = barTicks(m, segments, length, p.fontSize)
  const value = valueAxis(p, ticks, m.format, m.locale)
  const category = categoryAxis(
    p,
    m.data.categories,
    true,
    vertical
      ? {}
      : {
          // 横向：第一个类别在最上面；类别名太长时省略（完整的名字在提示与表格中）
          inverse: true,
          axisLabel: {
            color: p.textTertiary,
            fontSize: p.fontSize,
            fontFamily: p.fontFamily,
            margin: 8,
            width: Math.round(env.width * 0.3),
            overflow: 'truncate',
          },
        },
  )
  return {
    ...animationOption(p),
    ...textStyleOption(p),
    grid: gridOption({ right: vertical ? 8 : 16 }),
    xAxis: vertical ? category : value,
    yAxis: vertical ? value : category,
    tooltip: {
      ...tooltipBase(p),
      trigger: 'item',
      formatter: (params: unknown) => {
        const { seriesIndex = -1, dataIndex = -1 } = (params ?? {}) as {
          seriesIndex?: number
          dataIndex?: number
        }
        return tooltipElement(barTooltip(m, p, seriesIndex, dataIndex))
      },
    },
    series: visible.map((s, row) => {
      const segs = segments[row] ?? []
      return {
        type: 'custom',
        id: s.key,
        name: s.name,
        coordinateSystem: 'cartesian2d',
        encode: vertical ? { x: 0, y: [1, 2] } : { x: [1, 2], y: 0 },
        data: segs.map((seg, c) => [c, seg?.start ?? 0, seg?.end ?? 0]),
        renderItem: barRenderer(m, segs, row, visible.length, seriesColor(p, s), p),
        z: s.emphasized ? 3 : 2,
        emphasis: { focus: 'none' },
      }
    }),
  }
}
