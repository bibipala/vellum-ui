/**
 * 数字展示组件（Sparkline、Statistic、SegmentedBar）的纯函数：迷你图的路径与摘要、指标卡增减的方向与颜色、
 * 分段条的比例与「其他」合并、色块文字是否放得下；以及它们用到的令牌。不访问 DOM。
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MAX_ITEMS,
  formatShareShort,
  labelFits,
  layoutSegments,
  OTHER_KEY,
} from '../src/components/figures/segments.ts'
import { SPARK_VIEW, sparklineGeometry } from '../src/components/figures/sparkline-geometry.ts'
import {
  deltaDirection,
  deltaTone,
  MINUS_SIGN,
  signedText,
} from '../src/components/figures/statistic-delta.ts'
import { compileTheme, defaultTheme, resolveTheme } from '../src/index.ts'

describe('迷你图的几何', () => {
  it('横向按位置均分，纵向按最小、最大值拉满（SVG 的 y 向下）', () => {
    const g = sparklineGeometry([0, 5, 10])
    expect(g.line).toBe('M0 100L50 50L100 0')
    expect(g.end).toEqual({ x: 100, y: 0 })
    expect(g.count).toBe(3)
    expect(g.summary).toEqual({ start: 0, end: 10, min: 0, max: 10 })
  })

  it('面积从底边围到线，再回到底边', () => {
    expect(sparklineGeometry([2, 4]).area).toBe(`M0 ${SPARK_VIEW}L0 100L100 0L100 ${SPARK_VIEW}Z`)
  })

  it('null 处断开：每段连续的值一条子路径，空值也占位置', () => {
    const g = sparklineGeometry([1, 3, null, 2, 4])
    expect(g.line).toBe('M0 100L25 33.33M75 66.67L100 0')
    // 两段各有自己的面积
    expect(g.area.match(/M/g)).toHaveLength(2)
    expect(g.summary).toEqual({ start: 1, end: 4, min: 1, max: 4 })
  })

  it('NaN 与 Infinity 当作空值', () => {
    const g = sparklineGeometry([1, Number.NaN, 3, Number.POSITIVE_INFINITY])
    expect(g.count).toBe(2)
    expect(g.summary).toEqual({ start: 1, end: 3, min: 1, max: 3 })
  })

  it('前后都缺数据的孤立值单独列出（组件画成小圆点），不画线、不参与面积', () => {
    const g = sparklineGeometry([1, null, 3, null, 2])
    expect(g.line).toBe('')
    expect(g.area).toBe('')
    expect(g.isolated).toEqual([
      { x: 0, y: 100 },
      { x: 50, y: 0 },
      { x: 100, y: 50 },
    ])
    // 与线相连的值不算孤立
    expect(sparklineGeometry([1, 2, null, 3]).isolated).toEqual([{ x: 100, y: 0 }])
    expect(sparklineGeometry([1, 2, 3]).isolated).toEqual([])
  })

  it('末尾缺数据时，末端是最后一个非空值，线提前结束', () => {
    const g = sparklineGeometry([1, 2, 3, null])
    expect(g.end?.x).toBeCloseTo(66.67, 2)
    expect(g.summary?.end).toBe(3)
  })

  it('所有值相同时画在中线', () => {
    const g = sparklineGeometry([7, 7, 7])
    expect(g.line).toBe('M0 50L50 50L100 50')
    expect(g.summary).toEqual({ start: 7, end: 7, min: 7, max: 7 })
  })

  it('只有一个值：放在右端中线', () => {
    const g = sparklineGeometry([42])
    expect(g.end).toEqual({ x: 100, y: 50 })
    expect(g.count).toBe(1)
    expect(g.area).toBe('')
  })

  it('空数组或全是空值：什么也不画，不报错', () => {
    for (const data of [[], [null, null], [Number.NaN]]) {
      const g = sparklineGeometry(data)
      expect(g).toEqual({ line: '', area: '', isolated: [], end: null, count: 0, summary: null })
    }
  })

  it('负数与小数照常换算', () => {
    const g = sparklineGeometry([-1, 0.5, -0.25])
    expect(g.summary).toEqual({ start: -1, end: -0.25, min: -1, max: 0.5 })
    expect(g.line).toBe('M0 100L50 0L100 50')
  })
})

describe('指标卡的增减', () => {
  it('方向：正为上升、负为下降；0、非有限数、格式化后等于 0 的都算持平', () => {
    expect(deltaDirection(0.125, '12.5%', '0%')).toBe('up')
    expect(deltaDirection(-0.032, '3.2%', '0%')).toBe('down')
    expect(deltaDirection(0, '0%', '0%')).toBe('flat')
    expect(deltaDirection(Number.NaN, '—', '0%')).toBe('flat')
    // 0.0004 按百分比写成 0%：不显示「+0%」与上升箭头
    expect(deltaDirection(0.0004, '0%', '0%')).toBe('flat')
    expect(deltaDirection(-0.0004, '0%', '0%')).toBe('flat')
  })

  it('颜色 = 方向 × 哪个方向是好的；不评价或持平为中性', () => {
    expect(deltaTone('up', 'up')).toBe('good')
    expect(deltaTone('down', 'up')).toBe('bad')
    expect(deltaTone('up', 'down')).toBe('bad')
    expect(deltaTone('down', 'down')).toBe('good')
    expect(deltaTone('up', 'none')).toBe('neutral')
    expect(deltaTone('down', 'none')).toBe('neutral')
    expect(deltaTone('flat', 'up')).toBe('neutral')
    expect(deltaTone('flat', 'down')).toBe('neutral')
  })

  it('显示文字带正负号（减号是 U+2212），持平不带符号', () => {
    expect(signedText('up', '12.5%')).toBe('+12.5%')
    expect(signedText('down', '3.2%')).toBe(`${MINUS_SIGN}3.2%`)
    expect(MINUS_SIGN).toBe('\u2212')
    expect(signedText('flat', '0%')).toBe('0%')
  })
})

describe('分段条的布局', () => {
  const item = (key: string, value: number, slot?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8) => ({
    key,
    name: key.toUpperCase(),
    value,
    ...(slot ? { slot } : {}),
  })

  it('占比按数值计算，颜色按在 items 中的位置；块内文字色是对应的 -on 令牌', () => {
    const { segments, total, invalid } = layoutSegments(
      [item('a', 30), item('b', 50), item('c', 20)],
      'Other',
    )
    expect(total).toBe(100)
    expect(invalid).toEqual([])
    expect(segments.map((s) => [s.key, s.share, s.color, s.on])).toEqual([
      ['a', 0.3, 'color-chart-1', 'color-chart-1-on'],
      ['b', 0.5, 'color-chart-2', 'color-chart-2-on'],
      ['c', 0.2, 'color-chart-3', 'color-chart-3-on'],
    ])
  })

  it('值为 0 的部分不绘制，但其他部分的颜色不变（颜色跟着部分走）；slot 固定颜色', () => {
    const { segments } = layoutSegments([item('a', 0), item('b', 5), item('c', 5, 7)], 'Other')
    expect(segments.map((s) => [s.key, s.color, s.share])).toEqual([
      ['b', 'color-chart-2', 0.5],
      ['c', 'color-chart-7', 0.5],
    ])
  })

  it('超过 maxItems（默认 6，含「其他」）时，保留前 maxItems - 1 个，其余合并为弱化色的「其他」', () => {
    expect(DEFAULT_MAX_ITEMS).toBe(6)
    const items = 'abcdefgh'.split('').map((k) => item(k, 10))
    const { segments } = layoutSegments(items, 'Other')
    expect(segments).toHaveLength(6)
    expect(segments.slice(0, 5).map((s) => s.key)).toEqual(['a', 'b', 'c', 'd', 'e'])
    const other = segments[5]
    expect(other).toMatchObject({
      key: OTHER_KEY,
      name: 'Other',
      value: 30,
      share: 30 / 80,
      color: 'color-chart-muted',
      on: 'color-chart-muted-on',
      other: true,
    })
    // 正好 maxItems 个时不合并
    expect(layoutSegments(items.slice(0, 6), 'Other').segments.some((s) => s.other)).toBe(false)
    // 值为 0 的部分不计入
    const withZeros = [...items.slice(0, 6), item('z1', 0), item('z2', 0)]
    expect(layoutSegments(withZeros, 'Other').segments.some((s) => s.other)).toBe(false)
  })

  it('maxItems 限制在 2–8：分类色只有 8 个', () => {
    const items = 'abcdefghij'.split('').map((k) => item(k, 1))
    expect(layoutSegments(items, 'Other', 1).segments.map((s) => s.key)).toEqual(['a', OTHER_KEY])
    expect(layoutSegments(items, 'Other', 20).segments).toHaveLength(8)
    expect(layoutSegments(items, 'Other', 3.7).segments).toHaveLength(3)
    expect(layoutSegments(items, 'Other', Number.NaN).segments).toHaveLength(6)
  })

  it('全部为 0 或没有部分：为空，不算无效数据', () => {
    expect(layoutSegments([], 'Other')).toEqual({ segments: [], total: 0, invalid: [] })
    expect(layoutSegments([item('a', 0), item('b', 0)], 'Other')).toEqual({
      segments: [],
      total: 0,
      invalid: [],
    })
  })

  it('负数、NaN、Infinity：整条为空，并列出无效的部分', () => {
    const { segments, invalid } = layoutSegments(
      [item('a', 3), item('b', -1), item('c', Number.NaN), item('d', Number.POSITIVE_INFINITY)],
      'Other',
    )
    expect(segments).toEqual([])
    expect(invalid).toEqual(['b', 'c', 'd'])
  })

  it('块内文字：连同两侧内边距放得下才写', () => {
    expect(labelFits(30, 46, 8)).toBe(true)
    expect(labelFits(30, 45.9, 8)).toBe(false)
    expect(labelFits(0, 100, 8)).toBe(false)
  })

  it('块内占比写成整数百分比（随语言）', () => {
    expect(formatShareShort(0.462, 'en-US')).toBe('46%')
    expect(formatShareShort(0.005, 'en-US')).toBe('1%')
    expect(formatShareShort(0.462, 'zh-CN')).toBe('46%')
  })
})

describe('数字展示用到的令牌', () => {
  it('「其他」色块的文字色 color-chart-muted-on：两种模式都编译，取白色或近黑色之一', () => {
    for (const mode of ['light', 'dark'] as const) {
      const vars = compileTheme(resolveTheme(defaultTheme, mode))
      const on = vars['--vl-color-chart-muted-on']
      expect([vars['--vl-color-chart-1-on'], vars['--vl-color-chart-4-on']], mode).toContain(on)
    }
  })

  it('组件令牌：迷你图与分段条的高度、圆点与悬停区域', () => {
    const vars = compileTheme(resolveTheme(defaultTheme, 'light'))
    expect(vars['--vl-sparkline-height-sm']).toBe('20px')
    expect(vars['--vl-sparkline-height-md']).toBe('32px')
    expect(vars['--vl-sparkline-dot-size']).toBe('8px')
    expect(vars['--vl-sparkline-point-size']).toBe('4px')
    expect(vars['--vl-segmented-bar-height-dense']).toBe('4px')
    expect(vars['--vl-segmented-bar-height-thin']).toBe('8px')
    expect(vars['--vl-segmented-bar-height-tall']).toBe('28px')
    expect(vars['--vl-segmented-bar-hit-size']).toBe('24px')
    expect(vars['--vl-segmented-bar-radius']).toBe('4px')
  })
})
