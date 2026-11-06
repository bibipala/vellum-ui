/**
 * 图表的纯函数部分：颜色换算、刻度、配色读取，以及「props + 已解析的颜色 → ECharts 选项」的外观规格
 * （dataviz 的 marks-and-anatomy：线宽、数据点外圈、面积透明度、网格实线、紧凑刻度、颜色跟着系列走、
 * 超过 8 个系列用弱化色）。配色用默认主题编译出的真实令牌。
 */
import { describe, expect, it, vi } from 'vitest'
import {
  BAR_GAP,
  BAR_MAX_WIDTH,
  BAR_RADIUS,
  type BarModel,
  type BarRenderApi,
  barLayout,
  barOption,
  barRadius,
  barRenderer,
  barSegments,
  barTooltip,
} from '../src/components/charts/bar.ts'
import { cartesianData, cartesianTable } from '../src/components/charts/cartesian.ts'
import {
  formatHex,
  liftColor,
  mixColors,
  parseColor,
  rampColor,
  toHexColor,
} from '../src/components/charts/color.ts'
import type { PlotEnv } from '../src/components/charts/engine.tsx'
import {
  CELL_GAP,
  cellRenderer,
  type HeatmapModel,
  heatmapColor,
  heatmapDomain,
  heatmapOption,
  heatmapTable,
  placeCells,
} from '../src/components/charts/heatmap-model.ts'
import {
  AREA_OPACITY,
  DOT_RING_WIDTH,
  DOT_SYMBOL_SIZE,
  LINE_WIDTH,
  type LineModel,
  lineOption,
  lineTooltip,
} from '../src/components/charts/line.ts'
import { bezierEasing, type ChartPalette, paletteFrom } from '../src/components/charts/palette.ts'
import {
  OTHER_KEY,
  type PieModel,
  pieOption,
  pieSlices,
  pieTable,
  pieTooltip,
} from '../src/components/charts/pie.ts'
import {
  SCATTER_HIT_RADIUS,
  SCATTER_RING_WIDTH,
  SCATTER_SYMBOL_SIZE,
  type ScatterModel,
  scatterOption,
  scatterOrder,
  scatterTable,
  scatterTooltip,
} from '../src/components/charts/scatter.ts'
import { seriesModels, warnTooManySeries } from '../src/components/charts/series.ts'
import {
  axisFormat,
  axisLabeler,
  niceTicks,
  tickCount,
  tickValues,
} from '../src/components/charts/ticks.ts'
import { compileTheme, defaultTheme, resolveTheme, toHex } from '../src/index.ts'

/** 默认主题某个模式下的配色（与浏览器中从 CSS 变量读到的相同）。 */
function themePalette(mode: 'light' | 'dark' = 'light'): ChartPalette {
  const vars = compileTheme(resolveTheme(defaultTheme, mode))
  return paletteFrom((name) => vars[name] ?? '')
}

const env = (palette = themePalette(), width = 640, height = 240): PlotEnv => ({
  palette,
  width,
  height,
})

type AnyRecord = Record<string, unknown>
const seriesOf = (option: AnyRecord) => option.series as AnyRecord[]
const axis = (option: AnyRecord, which: 'xAxis' | 'yAxis') => option[which] as AnyRecord

describe('颜色换算', () => {
  it('解析十六进制、rgb()、oklch()、oklab()；无法解析的写法返回 null', () => {
    expect(parseColor('#2d6bf3')).toEqual({ r: 45, g: 107, b: 243, a: 1 })
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 })
    expect(parseColor('#00000080')?.a).toBeCloseTo(0.502, 2)
    expect(parseColor('rgb(10, 20, 30)')).toEqual({ r: 10, g: 20, b: 30, a: 1 })
    expect(parseColor('rgba(10, 20, 30, 0.5)')).toEqual({ r: 10, g: 20, b: 30, a: 0.5 })
    expect(parseColor('rgb(10 20 30 / 50%)')).toEqual({ r: 10, g: 20, b: 30, a: 0.5 })
    // 令牌的写法：与 tokens/oklch.ts 的换算一致
    const accent = { l: 0.542, c: 0.2, h: 263 }
    expect(toHexColor('oklch(54.2% 0.2 263)')).toBe(toHex(accent))
    expect(toHexColor('oklch(0.542 0.2 263deg)')).toBe(toHex(accent))
    expect(parseColor('oklch(54.2% 0.2 263 / 0.4)')?.a).toBeCloseTo(0.4)
    expect(toHexColor('oklab(0.542 0 0)')).toBe(toHex({ l: 0.542, c: 0, h: 0 }))
    expect(parseColor('rebeccapurple')).toBeNull()
    expect(parseColor('color-mix(in oklab, red, blue)')).toBeNull()
    expect(formatHex({ r: 255, g: 0, b: 0, a: 0.5 })).toBe('#ff000080')
  })

  it('OKLab 插值：两端等于原色，中点在两者之间；色阶按位置插值', () => {
    expect(mixColors('#000000', '#ffffff', 0)).toBe('#000000')
    expect(mixColors('#000000', '#ffffff', 1)).toBe('#ffffff')
    const mid = parseColor(mixColors('#000000', '#ffffff', 0.5)) as { r: number }
    // OKLab 的中灰比 sRGB 的 #808080 亮（感知均匀）
    expect(mid.r).toBeGreaterThan(90)
    expect(mid.r).toBeLessThan(140)
    const stops = ['#000000', '#808080', '#ffffff']
    expect(rampColor(stops, 0)).toBe('#000000')
    expect(rampColor(stops, 0.5)).toBe('#808080')
    expect(rampColor(stops, 1)).toBe('#ffffff')
    expect(rampColor(stops, 2)).toBe('#ffffff')
  })

  it('悬停提亮：亮度提高，色相不变', () => {
    const base = parseColor('#2d6bf3') as { r: number; g: number; b: number }
    const lifted = parseColor(liftColor('#2d6bf3')) as { r: number; g: number; b: number }
    expect(lifted.r + lifted.g + lifted.b).toBeGreaterThan(base.r + base.g + base.b)
    expect(lifted.b).toBeGreaterThan(lifted.r)
  })
})

describe('数值轴的刻度', () => {
  it('取整：1、2、2.5、5 × 10ⁿ，范围包含数据', () => {
    expect(niceTicks(0, 6580, 4, { zero: true })).toEqual({ min: 0, max: 8000, step: 2000 })
    expect(niceTicks(310, 1410, 4, { zero: true })).toEqual({ min: 0, max: 1500, step: 500 })
    expect(niceTicks(0, 0.125, 5, { zero: true })).toEqual({ min: 0, max: 0.125, step: 0.025 })
    expect(niceTicks(0, 0.13, 5, { zero: true })).toEqual({ min: 0, max: 0.15, step: 0.05 })
    expect(niceTicks(-320, 980, 4, { zero: true })).toEqual({ min: -500, max: 1000, step: 500 })
    for (const [lo, hi] of [
      [0, 1],
      [3, 97],
      [-0.4, 0.7],
      [12, 12],
      [1e6, 4.3e6],
    ] as const) {
      const t = niceTicks(lo, hi, 5, { zero: true })
      expect(t.min).toBeLessThanOrEqual(Math.min(lo, 0))
      expect(t.max).toBeGreaterThanOrEqual(hi)
      const mantissa = t.step / 10 ** Math.floor(Math.log10(t.step))
      expect([1, 2, 2.5, 5]).toContain(Number(mantissa.toFixed(6)))
      // 刻度没有浮点误差（如 0.30000000000000004）：小数部分不超过 6 位
      for (const v of tickValues(t)) expect(String(v)).not.toMatch(/\.\d{7,}/)
    }
  })

  it('整数数据不出现小数刻度；全是 0 或只有一个值时也有范围', () => {
    expect(niceTicks(0, 3, 6, { zero: true, integer: true }).step).toBe(1)
    expect(niceTicks(0, 0, 4, { zero: true })).toEqual({ min: 0, max: 1, step: 0.25 })
    const single = niceTicks(40, 40, 4, { zero: true })
    expect(single.min).toBe(0)
    expect(single.max).toBeGreaterThanOrEqual(40)
  })

  it('整条轴一种写法：最大值 ≥ 10,000 用紧凑写法，否则写全', () => {
    const small = niceTicks(0, 9500, 4, { zero: true })
    expect(small.max).toBe(10000)
    // 轴的最大值到了 10,000：整条轴紧凑，而不是 0 · 2,500 · … · 10K 混用
    expect(axisFormat('auto', small)).toBe('compact')
    expect(tickValues(small).map(axisLabeler('auto', small, 'en-US'))).toEqual([
      '0',
      '2.5K',
      '5K',
      '7.5K',
      '10K',
    ])
    const full = niceTicks(0, 6580, 4, { zero: true })
    expect(tickValues(full).map(axisLabeler('auto', full, 'en-US'))).toEqual([
      '0',
      '2,000',
      '4,000',
      '6,000',
      '8,000',
    ])
    expect(axisFormat('percent', full)).toBe('percent')
    expect(tickCount(200)).toBe(4)
    expect(tickCount(10)).toBe(2)
    expect(tickCount(2000)).toBe(8)
  })
})

describe('配色读取', () => {
  it('从令牌得到十六进制颜色，两种模式取各自的令牌；缺少令牌时用默认主题浅色', () => {
    const light = themePalette('light')
    const dark = themePalette('dark')
    const vars = compileTheme(resolveTheme(defaultTheme, 'light'))
    expect(light.categorical).toHaveLength(8)
    expect(light.categorical[0]).toBe(toHexColor(vars['--vl-color-chart-1'] as string))
    expect(light.categorical[0]).not.toBe(dark.categorical[0])
    expect(light.sequential).toHaveLength(7)
    expect(light.diverging).toHaveLength(7)
    for (const c of [...light.categorical, light.muted, light.grid, light.axis, light.surface])
      expect(c).toMatch(/^#[0-9a-f]{6}$/)
    expect(light.fontSize).toBe(12)
    expect(light.enterMs).toBe(280)
    expect(light.updateMs).toBe(200)
    expect(paletteFrom(() => '')).toEqual({ ...light, easing: expect.any(Function) })
    // 使用方覆盖为其他写法（十六进制、rgb）时同样可用
    const custom = paletteFrom((n) => (n === '--vl-color-chart-1' ? 'rgb(255, 0, 0)' : ''))
    expect(custom.categorical[0]).toBe('#ff0000')
  })

  it('「减少动态效果」时时长令牌为 0：动画关闭', () => {
    const p = paletteFrom((n) => (n.startsWith('--vl-motion-duration') ? '0ms' : ''))
    expect(p.enterMs).toBe(0)
    const option = lineOption(lineModel(), env(p))
    expect(option.animation).toBe(false)
  })

  it('标准缓动 cubic-bezier(0.2, 0, 0, 1)：快起慢收，端点 0 与 1', () => {
    const ease = bezierEasing('cubic-bezier(0.2, 0, 0, 1)')
    expect(ease(0)).toBe(0)
    expect(ease(1)).toBe(1)
    expect(ease(0.5)).toBeGreaterThan(0.75)
    expect(ease(0.25)).toBeLessThan(ease(0.5))
  })
})

describe('系列的颜色', () => {
  const series = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ key: `s${i}`, name: `S${i}` }))

  it('按位置取色，slot 固定颜色；第 9 个起是弱化色，不生成新颜色', () => {
    const m = seriesModels(series(10))
    expect(m.map((s) => s.color)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 'muted', 'muted'])
    const pinned = seriesModels([
      { key: 'a', name: 'A', slot: 5 },
      { key: 'b', name: 'B' },
    ])
    expect(pinned.map((s) => s.color)).toEqual([5, 2])
  })

  it('emphasis：被突出的系列保留颜色，其余为弱化色；key 不存在时不弱化', () => {
    expect(seriesModels(series(3), 's1').map((s) => s.color)).toEqual(['muted', 2, 'muted'])
    expect(seriesModels(series(3), 'missing').map((s) => s.color)).toEqual([1, 2, 3])
  })

  it('超过 8 个系列时开发模式下提醒合并或拆分', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    warnTooManySeries('LineChart', 8)
    expect(warn).not.toHaveBeenCalled()
    warnTooManySeries('LineChart', 9)
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/9 series.*"Other"/))
    warn.mockRestore()
  })
})

const rows = [
  { month: 'Jan', a: 1200, b: 300 },
  { month: 'Feb', a: 1500, b: null },
  { month: 'Mar', a: 14200, b: 800 },
]

function lineModel(over: Partial<LineModel> = {}): LineModel {
  const s = [
    { key: 'a', name: 'Revenue' },
    { key: 'b', name: 'Cost' },
  ]
  return {
    data: cartesianData(rows, 'month', s),
    series: seriesModels(s),
    hidden: [],
    area: false,
    stacked: false,
    format: 'auto',
    locale: 'en-US',
    missing: '—',
    ...over,
  }
}

describe('折线图与面积图的选项', () => {
  it('线 2px、圆角连接与端点；数据点默认不显示，8px 圆点带 2px 表面色外圈', () => {
    const p = themePalette()
    const [a] = seriesOf(lineOption(lineModel(), env(p)))
    const line = a as AnyRecord
    expect(line.lineStyle).toMatchObject({
      width: LINE_WIDTH,
      cap: 'round',
      join: 'round',
      type: 'solid',
    })
    expect(LINE_WIDTH).toBe(2)
    expect(line.showSymbol).toBe(false)
    expect(line.symbol).toBe('circle')
    // 描边一半在内：露出的圆点直径 = 符号尺寸 − 外圈宽度
    expect(DOT_SYMBOL_SIZE - DOT_RING_WIDTH).toBe(8)
    expect(line.itemStyle).toMatchObject({ borderColor: p.surface, borderWidth: 2 })
    expect(line.areaStyle).toBeUndefined()
    // 悬停时不加粗
    expect((line.emphasis as AnyRecord).lineStyle).toEqual({ width: 2 })
  })

  it('颜色按系列位置取自令牌；隐藏第一个系列后第二个系列颜色不变', () => {
    const p = themePalette()
    const all = seriesOf(lineOption(lineModel(), env(p)))
    expect(all.map((s) => s.color)).toEqual([p.categorical[0], p.categorical[1]])
    const hidden = seriesOf(lineOption(lineModel({ hidden: ['a'] }), env(p)))
    expect(hidden.map((s) => s.id)).toEqual(['b'])
    expect(hidden[0]?.color).toBe(p.categorical[1])
  })

  it('面积填充约 10% 不透明度，堆叠时同样淡；堆叠的数值轴按累计范围取刻度', () => {
    const p = themePalette()
    const area = seriesOf(lineOption(lineModel({ area: true }), env(p)))
    expect(AREA_OPACITY).toBe(0.1)
    expect(area[0]?.areaStyle).toEqual({ color: p.categorical[0], opacity: 0.1 })
    const stacked = lineOption(lineModel({ area: true, stacked: true }), env(p))
    expect(seriesOf(stacked).every((s) => s.stack === 'total')).toBe(true)
    expect(seriesOf(stacked).every((s) => (s.areaStyle as AnyRecord).opacity === 0.1)).toBe(true)
    expect(axis(stacked, 'yAxis').max).toBeGreaterThanOrEqual(15000)
  })

  it('网格线 1px 实线、坐标轴基线与文字用令牌；数值轴最大值 ≥ 10,000 用紧凑刻度', () => {
    const p = themePalette()
    const option = lineOption(lineModel(), env(p))
    const y = axis(option, 'yAxis')
    expect(y.splitLine).toEqual({
      show: true,
      lineStyle: { color: p.grid, width: 1, type: 'solid' },
    })
    expect(y.axisLine).toEqual({ show: false })
    const x = axis(option, 'xAxis')
    expect(x.axisLine).toMatchObject({ lineStyle: { color: p.axis, width: 1, type: 'solid' } })
    expect(x.axisLabel).toMatchObject({ color: p.textTertiary, fontSize: 12 })
    expect(y.axisLabel).toMatchObject({ color: p.textTertiary, fontSize: 12 })
    const label = (y.axisLabel as { formatter: (v: number) => string }).formatter
    expect(y.max).toBe(15000)
    expect(label(15000)).toBe('15K')
    expect(label(5000)).toBe('5K')
    // 十字线：1px 实线、在系列之下、吸附到类别
    const tooltip = option.tooltip as AnyRecord
    expect(tooltip.trigger).toBe('axis')
    expect(tooltip.axisPointer).toMatchObject({ type: 'line', snap: true, z: 1 })
  })

  it('超过 8 个系列：第 9 个起用弱化色', () => {
    const p = themePalette()
    const s = Array.from({ length: 9 }, (_, i) => ({ key: `k${i}`, name: `S${i}` }))
    const data = [Object.fromEntries([['x', 'A'], ...s.map((x, i) => [x.key, i])])]
    const option = lineOption(
      lineModel({ data: cartesianData(data, 'x', s), series: seriesModels(s) }),
      env(p),
    )
    expect(seriesOf(option)[8]?.color).toBe(p.muted)
    expect(new Set(seriesOf(option).map((x) => x.color)).size).toBe(9)
  })

  it('提示：类别为标题，每个显示中的系列一行，数值按写法，缺失值写「—」', () => {
    const p = themePalette()
    expect(lineTooltip(lineModel(), p, 1)).toEqual({
      title: 'Feb',
      rows: [
        { color: p.categorical[0], value: '1,500', name: 'Revenue' },
        { color: p.categorical[1], value: '—', name: 'Cost' },
      ],
    })
    expect(lineTooltip(lineModel({ hidden: ['b'] }), p, 2).rows).toEqual([
      { color: p.categorical[0], value: '14.2K', name: 'Revenue' },
    ])
  })

  it('表格视图：首列是类别，其余每个系列一列（含隐藏的系列），数值用同一个写法', () => {
    const m = lineModel()
    expect(cartesianTable(m.data, m.series, 'Month', 'number', 'en-US', '—')).toEqual({
      columns: [
        { key: 'x', title: 'Month' },
        { key: 's0', title: 'Revenue', numeric: true },
        { key: 's1', title: 'Cost', numeric: true },
      ],
      rows: [
        { x: 'Jan', s0: '1,200', s1: '300' },
        { x: 'Feb', s0: '1,500', s1: '—' },
        { x: 'Mar', s0: '14,200', s1: '800' },
      ],
    })
  })
})

const quarters = [
  { q: 'Q1', a: 400, b: 300, c: -50 },
  { q: 'Q2', a: 500, b: null, c: 120 },
  { q: 'Q3', a: 0, b: 200, c: 80 },
]
const barSeries = [
  { key: 'a', name: 'A' },
  { key: 'b', name: 'B' },
  { key: 'c', name: 'C' },
]

function barModel(over: Partial<BarModel> = {}): BarModel {
  return {
    data: cartesianData(quarters, 'q', barSeries),
    series: seriesModels(barSeries),
    hidden: [],
    orientation: 'vertical',
    stacked: false,
    showValues: false,
    format: 'auto',
    locale: 'en-US',
    missing: '—',
    ...over,
  }
}

/**
 * 假的坐标换算：类别宽 band 像素，数值 1 对应 1 像素。纵向时 y 向上为正（像素向下增大），基线在 y = 500；
 * 横向时类别在纵轴（第一个在最上面），数值在横轴，基线在 x = 100。
 */
function fakeApi(orientation: 'vertical' | 'horizontal', band: number): BarRenderApi {
  return orientation === 'vertical'
    ? { coord: ([c, v]) => [c * band + band / 2, 500 - v], size: () => [band, 0] }
    : { coord: ([v, c]) => [100 + v, c * band + band / 2], size: () => [0, band] }
}

type Rect = { x: number; y: number; width: number; height: number; r: number[] }
/** 一个数据项画出的柱（第二个子元素；第一个是透明的命中区域）。 */
function barRect(m: BarModel, row: number, col: number, band = 100): Rect | null {
  const p = themePalette()
  const segs = barSegments(m)
  const render = barRenderer(m, segs[row] ?? [], row, segs.length, '#336699', p)
  const g = render({ dataIndex: col }, fakeApi(m.orientation, band))
  return g ? ((g.children[1] as { shape: Rect }).shape ?? null) : null
}

describe('柱状图的选项', () => {
  it('柱宽不超过 24px，一组柱最多占类别宽度的 70%，相邻柱之间 2px 间隙', () => {
    expect(BAR_MAX_WIDTH).toBe(24)
    expect(BAR_GAP).toBe(2)
    // 宽类别：柱宽封顶 24
    expect(barLayout(200, 1)).toEqual({ width: 24, offsets: [-12] })
    const three = barLayout(200, 3)
    expect(three.width).toBe(24)
    expect(three.offsets).toEqual([-38, -12, 14])
    // 相邻两根柱之间正好 2px
    expect((three.offsets[1] as number) - ((three.offsets[0] as number) + three.width)).toBe(2)
    // 窄类别：按 70% 分配
    const narrow = barLayout(40, 2)
    expect(narrow.width).toBe((40 * 0.7 - 2) / 2)
    // 渲染出来的柱：200px 宽的类别中三根柱各 24px；100px 宽时按 70% 分配为 22px，间隙仍是 2px
    const a = barRect(barModel(), 0, 0, 200) as Rect
    const b = barRect(barModel(), 1, 0, 200) as Rect
    expect(a.width).toBe(24)
    expect(b.x - (a.x + a.width)).toBe(2)
    const c = barRect(barModel(), 0, 0, 100) as Rect
    const d = barRect(barModel(), 1, 0, 100) as Rect
    expect(c.width).toBe(22)
    expect(d.x - (c.x + c.width)).toBe(2)
  })

  it('数据端 4px 圆角、基线端直角；负值、横向相应翻转', () => {
    expect(BAR_RADIUS).toBe(4)
    expect(barRadius('vertical', false, 4)).toEqual([4, 4, 0, 0])
    expect(barRadius('vertical', true, 4)).toEqual([0, 0, 4, 4])
    expect(barRadius('horizontal', false, 4)).toEqual([0, 4, 4, 0])
    expect(barRadius('horizontal', true, 4)).toEqual([4, 0, 0, 4])
    // 正值：从基线（y = 500）向上
    const up = barRect(barModel(), 0, 0) as Rect
    expect(up).toMatchObject({ y: 100, height: 400, r: [4, 4, 0, 0] })
    // 负值：从基线向下，圆角在下端
    const down = barRect(barModel(), 2, 0) as Rect
    expect(down).toMatchObject({ y: 500, height: 50, r: [0, 0, 4, 4] })
    // 横向：从基线（x = 100）向右，圆角在右端
    const right = barRect(barModel({ orientation: 'horizontal' }), 0, 1) as Rect
    expect(right).toMatchObject({ x: 100, width: 500, r: [0, 4, 4, 0] })
  })

  it('堆叠：段之间 2px 间隙，只有最外端的段圆角；正负分开累计', () => {
    const m = barModel({ stacked: true })
    const segs = barSegments(m)
    expect(segs[0]?.[0]).toMatchObject({ start: 0, end: 400, rounded: false, gapAfter: true })
    expect(segs[1]?.[0]).toMatchObject({ start: 400, end: 700, rounded: true, gapAfter: false })
    // 负值从 0 向下单独累计
    expect(segs[2]?.[0]).toMatchObject({ start: 0, end: -50, rounded: true })
    const lower = barRect(m, 0, 0, 200) as Rect
    const upper = barRect(m, 1, 0, 200) as Rect
    expect(lower.r).toEqual([0, 0, 0, 0])
    expect(upper.r).toEqual([4, 4, 0, 0])
    // 下面的段在顶端让出 2px：两段之间露出 2px 的表面
    expect(lower.y - (upper.y + upper.height)).toBe(2)
    expect(lower.height).toBe(398)
    // 堆叠时每个类别只有一根柱，宽度相同、位置相同
    expect(lower.x).toBe(upper.x)
    expect(lower.width).toBe(24)
  })

  it('缺失与 0 不画柱；柱端标注（showValues）：分组标各自的值，堆叠标总和', () => {
    const segs = barSegments(barModel({ showValues: true }))
    expect(segs[0]?.[2]).toBeNull()
    expect(segs[1]?.[1]).toBeNull()
    expect(segs[0]?.[0]?.label).toBe('400')
    const stacked = barSegments(barModel({ showValues: true, stacked: true }))
    expect(stacked[1]?.[0]?.label).toBe('700')
    expect(stacked[0]?.[0]?.label).toBeUndefined()
    expect(stacked[2]?.[0]?.label).toBe('-50')
  })

  it('选项：自定义系列，颜色按系列位置；隐藏一个系列后其他系列颜色不变；数值轴包含 0', () => {
    const p = themePalette()
    const option = barOption(barModel(), env(p))
    const series = seriesOf(option)
    expect(series.map((s) => s.type)).toEqual(['custom', 'custom', 'custom'])
    const colorOf = (opt: AnyRecord, row: number) => {
      const s = seriesOf(opt)[row] as { renderItem: (a: unknown, b: BarRenderApi) => unknown }
      const g = s.renderItem({ dataIndex: 1 }, fakeApi('vertical', 100)) as {
        children: { style: { fill: string } }[]
      } | null
      return g?.children[1]?.style.fill
    }
    expect(colorOf(option, 2)).toBe(p.categorical[2])
    const hidden = barOption(barModel({ hidden: ['a'] }), env(p))
    expect(seriesOf(hidden).map((s) => s.id)).toEqual(['b', 'c'])
    expect(colorOf(hidden, 1)).toBe(p.categorical[2])
    const y = axis(option, 'yAxis')
    expect(y.min).toBeLessThanOrEqual(-50)
    expect(y.max).toBeGreaterThanOrEqual(500)
    expect(y.splitLine).toEqual({
      show: true,
      lineStyle: { color: p.grid, width: 1, type: 'solid' },
    })
    expect((option.tooltip as AnyRecord).trigger).toBe('item')
    // 横向：类别在纵轴（第一个在最上面），数值在横轴
    const h = barOption(barModel({ orientation: 'horizontal' }), env(p))
    expect(axis(h, 'yAxis')).toMatchObject({ type: 'category', inverse: true })
    expect(axis(h, 'xAxis').type).toBe('value')
  })

  it('悬停提亮：柱的 emphasis 颜色比原色亮；命中区域包含两侧的间隙', () => {
    const p = themePalette()
    const segs = barSegments(barModel())
    const g = barRenderer(
      barModel(),
      segs[0] ?? [],
      0,
      3,
      p.categorical[0] as string,
      p,
    )({ dataIndex: 0 }, fakeApi('vertical', 100))
    expect(g).not.toBeNull()
    type Child = { shape: Rect; style: { fill: string }; emphasis: { style: { fill: string } } }
    const [hit, bar] = (g as unknown as { children: readonly [Child, Child] }).children
    expect(bar.emphasis.style.fill).toBe(liftColor(p.categorical[0] as string))
    expect(hit.shape.width).toBe(bar.shape.width + 2)
    expect(hit.shape.x).toBe(bar.shape.x - 1)
  })

  it('提示：类别为标题，一行是该系列的值', () => {
    const p = themePalette()
    expect(barTooltip(barModel(), p, 1, 0)).toEqual({
      title: 'Q1',
      rows: [{ color: p.categorical[1], value: '300', name: 'B' }],
    })
  })
})

const sources = [
  { key: 'a', name: 'A', value: 50 },
  { key: 'b', name: 'B', value: 5 },
  { key: 'c', name: 'C', value: 30 },
  { key: 'd', name: 'D', value: 20 },
  { key: 'e', name: 'E', value: 15 },
  { key: 'f', name: 'F', value: 10 },
  { key: 'g', name: 'G', value: 8 },
  { key: 'h', name: 'H', value: 0 },
]

function pieModel(over: Partial<PieModel> = {}): PieModel {
  return {
    data: sources,
    hidden: [],
    maxSlices: 6,
    donut: false,
    format: 'auto',
    locale: 'en-US',
    missing: '—',
    otherName: 'Other',
    ...over,
  }
}

describe('饼图与环形图的选项', () => {
  it('超过 maxSlices：保留最大的 maxSlices − 1 项（原来的顺序），其余合并为「其他」，用弱化色放在最后', () => {
    const slices = pieSlices(sources, 6, 'Other')
    expect(slices.map((s) => s.key)).toEqual(['a', 'c', 'd', 'e', 'f', OTHER_KEY])
    const other = slices.at(-1)
    expect(other).toMatchObject({ name: 'Other', value: 13, color: 'muted', members: ['b', 'g'] })
    // 颜色按项在 data 中的位置：c 是第 3 项，即使 b 被合并也仍是第 3 个颜色
    expect(slices.map((s) => s.color)).toEqual([1, 3, 4, 5, 6, 'muted'])
    // 没有超过时不合并；0 与负数不画扇区
    expect(pieSlices(sources.slice(0, 4), 6, 'Other').map((s) => s.key)).toEqual([
      'a',
      'b',
      'c',
      'd',
    ])
    expect(pieSlices(sources, 8, 'Other').map((s) => s.key)).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
      'f',
      'g',
    ])
    // 最多 8 个扇区
    const many = Array.from({ length: 12 }, (_, i) => ({
      key: `k${i}`,
      name: `K${i}`,
      value: 12 - i,
    }))
    expect(pieSlices(many, 20, 'Other')).toHaveLength(8)
  })

  it('相邻扇区之间 2px 表面色间隙；不写标签、不放大，悬停提亮；从 12 点方向顺时针', () => {
    const p = themePalette()
    const option = pieOption(pieModel(), env(p))
    const [pie] = seriesOf(option) as AnyRecord[]
    expect(pie?.itemStyle).toEqual({ borderColor: p.surface, borderWidth: 2 })
    expect(pie?.label).toEqual({ show: false })
    expect(pie?.emphasis).toEqual({ scale: false, focus: 'none' })
    expect(pie).toMatchObject({ startAngle: 90, clockwise: true, radius: [0, '88%'] })
    const data = pie?.data as { itemStyle: { color: string }; emphasis: AnyRecord }[]
    expect(data[0]?.itemStyle.color).toBe(p.categorical[0])
    expect(data[1]?.itemStyle.color).toBe(p.categorical[2])
    expect(data.at(-1)?.itemStyle.color).toBe(p.muted)
    expect(data[0]?.emphasis).toEqual({
      itemStyle: { color: liftColor(p.categorical[0] as string) },
    })
    const donut = seriesOf(pieOption(pieModel({ donut: true }), env(p)))[0]
    expect(donut?.radius).toEqual(['60%', '88%'])
    // 只有一个扇区时没有间隙
    const single = seriesOf(pieOption(pieModel({ data: sources.slice(0, 1) }), env(p)))[0]
    expect((single as AnyRecord).itemStyle).toMatchObject({ borderWidth: 0 })
  })

  it('隐藏某些扇区：其余扇区颜色不变，占比按显示中的扇区重算', () => {
    const p = themePalette()
    const m = pieModel({ data: sources.slice(0, 4), hidden: ['a'] })
    const data = seriesOf(pieOption(m, env(p)))[0]?.data as { id: string; itemStyle: AnyRecord }[]
    expect(data.map((d) => d.id)).toEqual(['b', 'c', 'd'])
    expect(data[1]?.itemStyle.color).toBe(p.categorical[2])
    expect(pieTooltip(m, p, 1)).toEqual({
      title: 'C',
      rows: [{ color: p.categorical[2], value: '30', name: '54.5%' }],
    })
  })

  it('表格视图列出全部原始项（含合并的与不画扇区的），占比按全部正数项计算', () => {
    const table = pieTable(pieModel(), { name: 'Source', value: 'Visits', share: 'Share' })
    expect(table.columns.map((c) => c.title)).toEqual(['Source', 'Visits', 'Share'])
    expect(table.rows).toHaveLength(8)
    expect(table.rows[1]).toEqual({ name: 'B', value: '5', share: '3.6%' })
    expect(table.rows[7]).toEqual({ name: 'H', value: '0', share: '—' })
  })
})

const scatterSeries = [
  {
    key: 'a',
    name: 'Alpha',
    points: [
      { x: 30, y: 5, label: 'P1' },
      { x: 10, y: 8, label: 'P2' },
    ],
  },
  { key: 'b', name: 'Beta', points: [{ x: 20, y: 2 }] },
]

function scatterModel(over: Partial<ScatterModel> = {}): ScatterModel {
  return {
    series: scatterSeries,
    models: seriesModels(scatterSeries),
    hidden: [],
    xFormat: 'auto',
    yFormat: 'auto',
    xLabel: 'Price',
    yLabel: 'Units',
    locale: 'en-US',
    missing: '—',
    ...over,
  }
}

describe('散点图的选项', () => {
  it('点 8px 带 2px 表面色外圈；ECharts 不自己触发悬停（由最近点查找负责，命中半径 16px）', () => {
    const p = themePalette()
    const option = scatterOption(scatterModel(), env(p))
    const [a, b] = seriesOf(option)
    expect(SCATTER_SYMBOL_SIZE - SCATTER_RING_WIDTH).toBe(8)
    expect(SCATTER_HIT_RADIUS * 2).toBeGreaterThanOrEqual(24)
    expect(a).toMatchObject({ type: 'scatter', silent: true, symbolSize: 10 })
    expect(a?.itemStyle).toMatchObject({
      color: p.categorical[0],
      borderColor: p.surface,
      borderWidth: 2,
    })
    expect(b?.itemStyle).toMatchObject({ color: p.categorical[1] })
    expect((option.tooltip as AnyRecord).triggerOn).toBe('none')
    // 两条数值轴：网格 1px 实线，轴名称用次要文字色
    const x = axis(option, 'xAxis')
    expect(x).toMatchObject({ type: 'value', name: 'Price' })
    expect(x.splitLine).toEqual({
      show: true,
      lineStyle: { color: p.grid, width: 1, type: 'solid' },
    })
    expect(x.min).toBeLessThanOrEqual(10)
    expect(x.max).toBeGreaterThanOrEqual(30)
    expect(axis(option, 'yAxis').name).toBe('Units')
  })

  it('键盘顺序：显示中的全部点按 x 排序；隐藏系列后跳过它的点', () => {
    expect(scatterOrder(scatterModel())).toEqual([
      { seriesIndex: 0, dataIndex: 1 },
      { seriesIndex: 1, dataIndex: 0 },
      { seriesIndex: 0, dataIndex: 0 },
    ])
    expect(scatterOrder(scatterModel({ hidden: ['a'] }))).toEqual([
      { seriesIndex: 0, dataIndex: 0 },
    ])
  })

  it('提示：点的名称（多个系列时附系列名）作标题，横轴、纵轴的值各一行；表格列出全部点', () => {
    const p = themePalette()
    expect(scatterTooltip(scatterModel(), p, 0, 0)).toEqual({
      title: 'P1 · Alpha',
      rows: [
        { color: p.categorical[0], value: '30', name: 'Price' },
        { color: p.categorical[0], value: '5', name: 'Units' },
      ],
    })
    expect(scatterTooltip(scatterModel(), p, 1, 0).title).toBe('Beta')
    const table = scatterTable(scatterModel(), { series: 'Series', label: 'Label' })
    expect(table.columns.map((c) => c.title)).toEqual(['Series', 'Label', 'Price', 'Units'])
    expect(table.rows).toEqual([
      { series: 'Alpha', label: 'P1', x: '30', y: '5' },
      { series: 'Alpha', label: 'P2', x: '10', y: '8' },
      { series: 'Beta', label: '', x: '20', y: '2' },
    ])
  })
})

function heatModel(over: Partial<HeatmapModel> = {}): HeatmapModel {
  return {
    xCategories: ['a', 'b', 'c'],
    yCategories: ['r1', 'r2'],
    data: [
      { x: 'a', y: 'r1', value: 10 },
      { x: 'b', y: 'r1', value: 20 },
      { x: 'c', y: 'r1', value: 30 },
      { x: 'a', y: 'r2', value: null },
      { x: 'b', y: 'r2', value: -10 },
      { x: 'zzz', y: 'r2', value: 99 },
    ],
    scale: 'sequential',
    midpoint: 0,
    format: 'auto',
    locale: 'en-US',
    missing: '—',
    ...over,
  }
}

describe('热力图的选项', () => {
  it('格子：类别不存在、数值缺失的不画；顺序色阶从最小值到最大值', () => {
    const p = themePalette()
    const m = heatModel()
    const cells = placeCells(m)
    expect(cells).toHaveLength(4)
    const domain = heatmapDomain(m, cells)
    expect(domain).toEqual({ min: -10, max: 30 })
    expect(heatmapColor(-10, domain, 'sequential', p)).toBe(p.sequential[0])
    expect(heatmapColor(30, domain, 'sequential', p)).toBe(p.sequential[6])
    // 正中间是第 4 级
    expect(heatmapColor(10, domain, 'sequential', p)).toBe(p.sequential[3])
  })

  it('发散色阶：以中点对称（取到中点距离较大的一侧），中点是第 4 级（中性灰）', () => {
    const p = themePalette()
    const m = heatModel({ scale: 'diverging', midpoint: 5 })
    const domain = heatmapDomain(m, placeCells(m))
    expect(domain).toEqual({ min: -20, max: 30, mid: 5 })
    expect(heatmapColor(5, domain, 'diverging', p)).toBe(p.diverging[3])
    expect(heatmapColor(30, domain, 'diverging', p)).toBe(p.diverging[6])
    expect(heatmapColor(-20, domain, 'diverging', p)).toBe(p.diverging[0])
    // 两种模式的中点都是中性灰（彩度很低）
    for (const mode of ['light', 'dark'] as const) {
      const mid = parseColor(themePalette(mode).diverging[3] as string) as {
        r: number
        g: number
        b: number
      }
      expect(Math.max(mid.r, mid.g, mid.b) - Math.min(mid.r, mid.g, mid.b)).toBeLessThan(8)
    }
  })

  it('相邻格子之间 2px 间隙、小圆角；悬停加描边而不改变颜色', () => {
    const p = themePalette()
    const render = cellRenderer(placeCells(heatModel()), ['#112233'], p)
    const el = render(
      { dataIndex: 0 },
      { coord: ([c, r]) => [c * 40 + 20, r * 30 + 15], size: () => [40, 30] },
    ) as { shape: AnyRecord; style: AnyRecord; emphasis: { style: AnyRecord } }
    expect(CELL_GAP).toBe(2)
    expect(el.shape).toEqual({ x: 1, y: 1, width: 38, height: 28, r: 2 })
    expect(el.style.fill).toBe('#112233')
    expect(el.emphasis.style).toEqual({ stroke: p.textPrimary, lineWidth: 2 })
    expect(el.emphasis.style.fill).toBeUndefined()
  })

  it('坐标轴：第一行在最上面，不画网格线与轴线；表格每个格子一行', () => {
    const option = heatmapOption(heatModel(), env())
    expect(axis(option, 'yAxis')).toMatchObject({
      type: 'category',
      inverse: true,
      data: ['r1', 'r2'],
    })
    expect(axis(option, 'xAxis').splitLine).toEqual({ show: false })
    expect(axis(option, 'xAxis').axisLine).toEqual({ show: false })
    const table = heatmapTable(heatModel({ xLabel: 'Hour', yLabel: 'Day' }), 'Value')
    expect(table.columns.map((c) => c.title)).toEqual(['Hour', 'Day', 'Value'])
    expect(table.rows).toEqual([
      { x: 'a', y: 'r1', value: '10' },
      { x: 'b', y: 'r1', value: '20' },
      { x: 'c', y: 'r1', value: '30' },
      { x: 'b', y: 'r2', value: '-10' },
    ])
  })
})
