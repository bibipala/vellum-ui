/**
 * 数字展示组件在真实浏览器中的行为（docs/11 §4、§6.2）：
 * - Sparkline：读屏摘要（随语言与数值写法）、颜色取自图表令牌（弱化色历史 + 强调色末端圆点）、线宽不随拉伸变化、
 *   圆点不超出容器、明暗切换后颜色随令牌变化；
 * - Statistic：增减的方向、颜色（方向 × 是否向好）、箭头图标与带正负号的文字、可访问文本、加载时尺寸不跳；
 * - SegmentedBar：宽度按比例、0 值不绘制、色块文字颜色、放不下的块不写文字、悬停与键盘漫游显示提示、
 *   读屏不靠悬停就能读到每个部分。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SegmentedBar, Sparkline, Statistic, useTheme } from '../../src/index.ts'
import {
  clock,
  css,
  ms,
  page,
  parkPointer,
  render,
  sameColor,
  settle,
  token,
  useFakeTimers,
  userEvent,
  visibleTooltips,
} from './render.tsx'

afterEach(() => {
  vi.restoreAllMocks()
})

let theme: ReturnType<typeof useTheme>
function ThemeProbe() {
  theme = useTheme()
  return null
}

const svgPaths = (root: Element) => [...root.querySelectorAll('path')]

describe('Sparkline', () => {
  it('读屏名称：标签 + 起止值、最低、最高（数值按 format 写，随语言切换）', async () => {
    await render(
      <>
        <Sparkline data={[182, 171, 301, 279]} label="Visits" />
        <Sparkline data={[0.1, 0.25, 0.2]} label="Conversion" format="percent" />
        <Sparkline data={[42]} label="First week" />
        <Sparkline data={[null, null]} label="Nothing yet" />
      </>,
    )
    await expect
      .element(page.getByRole('img', { name: 'Visits: from 182 to 279, low 171, high 301' }))
      .toBeVisible()
    await expect
      .element(page.getByRole('img', { name: 'Conversion: from 10% to 20%, low 10%, high 25%' }))
      .toBeVisible()
    await expect.element(page.getByRole('img', { name: 'First week: 42' })).toBeInTheDocument()
    await expect
      .element(page.getByRole('img', { name: 'Nothing yet: no data' }))
      .toBeInTheDocument()
  })

  it('zh-CN：摘要是中文，紧凑写法按语言', async () => {
    await render(<Sparkline data={[12_000, 9_000, 15_000]} label="访问量" />, { locale: 'zh-CN' })
    await expect
      .element(page.getByRole('img', { name: '访问量：从 1.2万 到 1.5万，最低 9,000，最高 1.5万' }))
      .toBeVisible()
  })

  it('默认：历史为弱化色、末端圆点为第一个图表颜色（强调色）；线宽 2px 且不随拉伸变化', async () => {
    await render(<Sparkline data={[3, 5, 4, 8]} label="Trend" area testId="spark" />)
    const root = page.getByTestId('spark').element()
    const [area, line] = svgPaths(root)
    if (!line || !area) throw new Error('缺少路径')
    expect(sameColor(css(line).stroke, token('color-chart-muted'))).toBe(true)
    expect(css(line).strokeWidth).toBe('2px')
    expect(css(line).vectorEffect).toBe('non-scaling-stroke')
    expect(css(line).strokeLinejoin).toBe('round')
    // 面积与线同色，约 10% 不透明度
    expect(sameColor(css(area).fill, token('color-chart-muted'))).toBe(true)
    expect(Number(css(area).fillOpacity)).toBeCloseTo(0.1, 2)
    const dot = root.querySelector('[data-sparkline-dot]')
    if (!dot) throw new Error('缺少末端圆点')
    expect(sameColor(css(dot).backgroundColor, token('color-chart-1'))).toBe(true)
    // 圆点 8px，在容器之内（右端与上端都不超出）
    const d = dot.getBoundingClientRect()
    const r = root.getBoundingClientRect()
    expect(d.width).toBe(8)
    expect(d.right).toBeLessThanOrEqual(r.right + 0.5)
    expect(d.top).toBeGreaterThanOrEqual(r.top - 0.5)
    expect(r.height).toBe(32)
  })

  it('slot：整条线与圆点用该图表颜色；highlight="none"：第一个图表颜色、没有圆点；sm 高 20px', async () => {
    await render(
      <>
        <Sparkline data={[1, 2, 3]} label="A" slot={3} testId="a" />
        <Sparkline data={[1, 2, 3]} label="B" highlight="none" size="sm" testId="b" />
      </>,
    )
    const a = page.getByTestId('a').element()
    const b = page.getByTestId('b').element()
    const lineA = svgPaths(a)[0]
    const lineB = svgPaths(b)[0]
    if (!lineA || !lineB) throw new Error('缺少路径')
    expect(sameColor(css(lineA).stroke, token('color-chart-3'))).toBe(true)
    const dotA = a.querySelector('[data-sparkline-dot]')
    if (!dotA) throw new Error('缺少末端圆点')
    expect(sameColor(css(dotA).backgroundColor, token('color-chart-3'))).toBe(true)
    expect(sameColor(css(lineB).stroke, token('color-chart-1'))).toBe(true)
    expect(b.querySelector('[data-sparkline-dot]')).toBeNull()
    expect(b.getBoundingClientRect().height).toBe(20)
  })

  it('缺失与很少的数据：断开处没有线；只有一个值时显示圆点；空数据不画线也不报错', async () => {
    await render(
      <>
        <Sparkline data={[1, null, 3]} label="Gaps" highlight="none" testId="gaps" />
        <Sparkline data={[5]} label="One" highlight="none" testId="one" />
        <Sparkline data={[]} label="Empty" testId="empty" />
      </>,
    )
    // 1 与 3 都是孤立值：没有线，各画一个 4px 的线色小圆点
    const gaps = page.getByTestId('gaps').element()
    expect(svgPaths(gaps)).toEqual([])
    const points = [...gaps.querySelectorAll('[data-sparkline-point]')]
    expect(points).toHaveLength(2)
    for (const p of points) {
      expect(p.getBoundingClientRect().width).toBe(4)
      expect(sameColor(css(p).backgroundColor, token('color-chart-1'))).toBe(true)
    }
    // 一个值没有线可画：即使 highlight="none" 也显示末端圆点（不再另画小圆点）
    const one = page.getByTestId('one').element()
    expect(one.querySelector('[data-sparkline-dot]')).not.toBeNull()
    expect(one.querySelector('[data-sparkline-point]')).toBeNull()
    const empty = page.getByTestId('empty').element()
    expect(svgPaths(empty)).toEqual([])
    expect(empty.querySelector('[data-sparkline-dot]')).toBeNull()
  })

  it('明暗切换后，线与圆点的颜色随令牌变化', async () => {
    await render(
      <>
        <ThemeProbe />
        <Sparkline data={[3, 5, 4, 8]} label="Trend" testId="spark" />
      </>,
    )
    const root = page.getByTestId('spark').element()
    const line = svgPaths(root)[0]
    const dot = root.querySelector('[data-sparkline-dot]')
    if (!line || !dot) throw new Error('缺少线或圆点')
    const lightLine = css(line).stroke
    const lightDot = css(dot).backgroundColor
    theme.setColorMode('dark')
    await expect.poll(() => document.documentElement.dataset.vlMode).toBe('dark')
    await expect.poll(() => sameColor(css(line).stroke, lightLine)).toBe(false)
    expect(sameColor(css(line).stroke, token('color-chart-muted'))).toBe(true)
    expect(sameColor(css(dot).backgroundColor, lightDot)).toBe(false)
    expect(sameColor(css(dot).backgroundColor, token('color-chart-1'))).toBe(true)
  })
})

/** 指标卡中增减的元素：方向与语气写在 data 属性上。 */
function deltaOf(testId: string) {
  const root = page.getByTestId(testId).element()
  const delta = root.querySelector('[data-direction]')
  if (!delta) throw new Error(`${testId} 没有增减`)
  const change = delta.firstElementChild
  if (!change) throw new Error(`${testId} 没有增减文字`)
  const icon = [...(change.querySelector('svg')?.classList ?? [])].find((c) =>
    c.startsWith('lucide-arrow'),
  )
  return { delta, change, icon, text: change.textContent }
}

describe('Statistic', () => {
  it('增减：箭头 + 带正负号的文字；颜色 = 方向 × 是否向好；不评价或持平为次要文字色', async () => {
    await render(
      <>
        <Statistic
          testId="up-good"
          label="Active users"
          value={12_894}
          delta={{ value: 0.125, period: 'vs last month' }}
        />
        <Statistic
          testId="down-bad"
          label="Revenue"
          value={48_210}
          delta={{ value: -0.032, period: 'vs last month' }}
        />
        <Statistic
          testId="down-good"
          label="Error rate"
          value={0.0042}
          format="percent"
          delta={{ value: -0.18, period: 'vs last week', goodWhen: 'down' }}
        />
        <Statistic
          testId="up-bad"
          label="Response time"
          value={182}
          delta={{ value: 0.06, period: 'vs last week', goodWhen: 'down' }}
        />
        <Statistic
          testId="neutral"
          label="Open tickets"
          value={64}
          delta={{ value: 0.08, period: 'vs yesterday', goodWhen: 'none' }}
        />
        <Statistic
          testId="flat"
          label="Uptime"
          value={0.9995}
          format="percent"
          delta={{ value: 0.0001, period: 'vs last month' }}
        />
      </>,
    )
    const success = token('color-success-text')
    const danger = token('color-danger-text')
    const secondary = token('color-text-secondary')
    const cases = [
      ['up-good', 'up', 'good', 'lucide-arrow-up', '+12.5%', success],
      ['down-bad', 'down', 'bad', 'lucide-arrow-down', '\u22123.2%', danger],
      ['down-good', 'down', 'good', 'lucide-arrow-down', '\u221218%', success],
      ['up-bad', 'up', 'bad', 'lucide-arrow-up', '+6%', danger],
      ['neutral', 'up', 'neutral', 'lucide-arrow-up', '+8%', secondary],
      // 0.0001 按百分比写成 0%：持平，水平箭头，不带符号
      ['flat', 'flat', 'neutral', 'lucide-arrow-right', '0%', secondary],
    ] as const
    for (const [id, direction, tone, icon, text, color] of cases) {
      const d = deltaOf(id)
      expect(d.delta.getAttribute('data-direction'), id).toBe(direction)
      expect(d.delta.getAttribute('data-tone'), id).toBe(tone)
      expect(d.icon, id).toBe(icon)
      expect(d.text, id).toBe(text)
      // 箭头图标与文字同色（图标跟随 currentColor）
      expect(sameColor(css(d.change).color, color), id).toBe(true)
      expect(d.change.querySelector('svg')?.getAttribute('stroke'), id).toBe('currentColor')
    }
    // 对比的时期是次要文字色，不随好坏变色
    const period = deltaOf('up-good').delta.children[1]
    if (!period) throw new Error('缺少时期')
    expect(period.textContent).toBe('vs last month')
    expect(sameColor(css(period).color, secondary)).toBe(true)
  })

  it('可访问文本：读屏读到完整的一句话（方向、数值、时期），图标与带符号的文字对读屏隐藏；随语言切换', async () => {
    const { unmount } = await render(
      <Statistic
        testId="s"
        label="Active users"
        value={12_894}
        delta={{ value: 0.125, period: 'vs last month' }}
      />,
    )
    await expect
      .element(page.getByText('Up 12.5%, vs last month', { exact: true }))
      .toBeInTheDocument()
    const { change, delta } = deltaOf('s')
    expect(change.getAttribute('aria-hidden')).toBe('true')
    expect(delta.children[1]?.getAttribute('aria-hidden')).toBe('true')
    await unmount()
    await render(
      <>
        <Statistic label="收入" value={-5} delta={{ value: -0.2, period: '与上月相比' }} />
        <Statistic label="工单" value={3} delta={{ value: 0, period: '与昨天相比' }} />
      </>,
      { locale: 'zh-CN' },
    )
    await expect
      .element(page.getByText('下降 20%，与上月相比', { exact: true }))
      .toBeInTheDocument()
    await expect.element(page.getByText('持平，与昨天相比', { exact: true })).toBeInTheDocument()
  })

  it('数值：半粗、比例数字（不用等宽数字，表格中也不继承）；标签为次要文字色；md 24px、lg 32px', async () => {
    await render(
      <>
        <Statistic label="Active users" value={12_894} testId="md" />
        <div style={{ fontVariantNumeric: 'tabular-nums' }}>
          <Statistic label="Revenue" value={48_210} prefix="$" suffix="USD" size="lg" testId="lg" />
        </div>
        <Statistic label="Refunds" value={null} testId="none" />
      </>,
    )
    const md = page.getByText('12.9K', { exact: true }).element()
    expect(css(md).fontWeight).toBe('600')
    expect(css(md).fontSize).toBe('24px')
    expect(css(md).fontVariantNumeric).toBe('normal')
    const label = page.getByText('Active users', { exact: true }).element()
    expect(sameColor(css(label).color, token('color-text-secondary'))).toBe(true)
    const lg = page.getByText('$48.2KUSD', { exact: true }).element()
    expect(css(lg).fontSize).toBe('32px')
    expect(css(lg).fontVariantNumeric).toBe('normal')
    // 单位：较小、次要文字色
    const unit = page.getByText('USD', { exact: true }).element()
    expect(Number.parseFloat(css(unit).fontSize)).toBeLessThan(32)
    expect(sameColor(css(unit).color, token('color-text-secondary'))).toBe(true)
    expect(page.getByTestId('none').element().textContent).toBe('Refunds—')
  })

  it('加载：数值、增减、趋势的位置显示骨架（延迟出现、读屏读出「Loading」），数据到来后尺寸不变', async () => {
    const tile = (loading: boolean) => (
      <div style={{ width: 240 }}>
        <Statistic
          testId="s"
          label="Weekly sign-ups"
          value={458}
          delta={{ value: 0.05, period: 'vs last week' }}
          trend={[312, 298, 341, 356, 330, 372]}
          loading={loading}
        />
      </div>
    )
    const { rerender } = await render(tile(true))
    const root = page.getByTestId('s').element()
    expect(root.getAttribute('aria-busy')).toBe('true')
    await expect.element(page.getByText('Loading', { exact: true })).toBeInTheDocument()
    const skeletons = [...root.querySelectorAll('[data-skeleton]')]
    expect(skeletons.map((s) => s.getAttribute('data-skeleton'))).toEqual(['value', 'delta'])
    for (const s of skeletons) {
      // 骨架延迟出现（防闪），与 PageSkeleton 相同
      expect(ms(css(s).animationDelay)).toBe(ms(token('motion-delay-loading')))
      expect(sameColor(css(s).backgroundColor, token('color-fill'))).toBe(true)
    }
    expect(root.querySelector('[role="img"]')).toBeNull()
    const rows = () => [...root.children].map((el) => el.getBoundingClientRect().height)
    const loadingRows = rows()
    const loadingHeight = root.getBoundingClientRect().height
    await rerender(tile(false))
    expect(root.getAttribute('aria-busy')).toBeNull()
    expect(root.querySelector('[data-skeleton]')).toBeNull()
    await expect
      .element(page.getByRole('img', { name: /^Weekly sign-ups trend: from 312 to 372/ }))
      .toBeVisible()
    expect(rows()).toEqual(loadingRows)
    expect(root.getBoundingClientRect().height).toBe(loadingHeight)
  })
})

const storage = [
  { key: 'images', name: 'Images', value: 413 },
  { key: 'videos', name: 'Videos', value: 286 },
  { key: 'documents', name: 'Documents', value: 92 },
  { key: 'audio', name: 'Audio', value: 41 },
  { key: 'archives', name: 'Archives', value: 18 },
]
const gb = (v: number) => `${v} GB`

/** 分段条的各块（可聚焦的 img）、色块与块内文字。 */
function segmentsOf(testId: string) {
  const root = page.getByTestId(testId).element()
  return [...root.querySelectorAll<HTMLElement>('[data-segment]')].map((el) => {
    const fill = el.querySelector<HTMLElement>('[data-segment-fill]')
    if (!fill) throw new Error('缺少色块')
    return { el, fill, label: fill.querySelector<HTMLElement>('[data-segment-label]') }
  })
}

const width = (el: Element) => el.getBoundingClientRect().width
const shown = (label: HTMLElement | null) => label !== null && css(label).visibility === 'visible'

describe('SegmentedBar', () => {
  it('读屏：整条是带名称的 figure，每个部分是带名称的 img（名称、数量、占比），不需要悬停', async () => {
    await render(
      <SegmentedBar variant="tall" label="Storage by file type" items={storage} format={gb} />,
    )
    await expect.element(page.getByRole('figure', { name: 'Storage by file type' })).toBeVisible()
    for (const name of [
      'Images: 413 GB (48.6%)',
      'Videos: 286 GB (33.6%)',
      'Documents: 92 GB (10.8%)',
      'Audio: 41 GB (4.8%)',
      'Archives: 18 GB (2.1%)',
    ])
      await expect.element(page.getByRole('img', { name })).toBeInTheDocument()
  })

  it('宽度按比例，块之间 2px 间隙；值为 0 的部分不绘制，其余部分颜色不变；色块与块内文字取图表令牌', async () => {
    await render(
      <div style={{ width: 400 }}>
        <SegmentedBar
          variant="tall"
          label="Split"
          testId="bar"
          items={[
            { key: 'a', name: 'A', value: 30 },
            { key: 'b', name: 'B', value: 50 },
            { key: 'c', name: 'C', value: 0 },
            { key: 'd', name: 'D', value: 20 },
          ]}
        />
      </div>,
    )
    const segs = segmentsOf('bar')
    expect(segs).toHaveLength(3)
    const [a, b, d] = segs
    if (!a || !b || !d) throw new Error('缺少色块')
    // 400 - 2 × 2px 间隙 = 396 按 30 : 50 : 20 分
    expect(width(a.el)).toBeCloseTo(118.8, 0)
    expect(width(b.el)).toBeCloseTo(198, 0)
    expect(width(d.el)).toBeCloseTo(79.2, 0)
    expect(b.el.getBoundingClientRect().left - a.el.getBoundingClientRect().right).toBeCloseTo(2, 1)
    // 第 4 个部分（C 为 0 不绘制）仍是第 4 个颜色
    const expected = ['color-chart-1', 'color-chart-2', 'color-chart-4']
    segs.forEach((seg, i) => {
      const color = expected[i] as string
      expect(sameColor(css(seg.fill).backgroundColor, token(color)), color).toBe(true)
      expect(sameColor(css(seg.fill).color, token(`${color}-on`)), `${color}-on`).toBe(true)
      // 实际绘制的色块（不是计算样式）：高 28px，铺满整块的宽度
      expect(seg.fill.getBoundingClientRect().height).toBe(28)
      expect(width(seg.fill)).toBeCloseTo(width(seg.el), 1)
      expect(css(seg.fill).borderTopLeftRadius).toBe('4px')
      expect(css(seg.fill).borderBottomRightRadius).toBe('4px')
      expect(shown(seg.label), `${color} 的文字`).toBe(true)
    })
    expect(a.label?.textContent).toBe('30%')
  })

  it('放不下的块不写文字（实际测量，不用 overflow 裁切）；条变宽后重新测量', async () => {
    const { rerender } = await render(
      <div style={{ width: 200 }}>
        <SegmentedBar
          variant="tall"
          label="Split"
          testId="bar"
          items={[
            { key: 'big', name: 'Big', value: 90 },
            { key: 'small', name: 'Small', value: 10 },
          ]}
        />
      </div>,
    )
    const [big, small] = segmentsOf('bar')
    if (!big || !small?.label) throw new Error('缺少色块')
    expect(shown(big.label)).toBe(true)
    expect(shown(small.label)).toBe(false)
    expect(small.label.hasAttribute('data-fit')).toBe(false)
    expect(width(small.label)).toBeGreaterThan(width(small.fill) - 16)
    expect(css(small.fill).overflow).toBe('visible')
    // 显示出来的文字连同两侧 8px 都在色块之内
    const b = big.fill.getBoundingClientRect()
    const l = big.label?.getBoundingClientRect()
    expect(l && l.left - b.left).toBeCloseTo(8, 0)
    expect(l && l.right + 8).toBeLessThanOrEqual(b.right)
    await rerender(
      <div style={{ width: 1000 }}>
        <SegmentedBar
          variant="tall"
          label="Split"
          testId="bar"
          items={[
            { key: 'big', name: 'Big', value: 90 },
            { key: 'small', name: 'Small', value: 10 },
          ]}
        />
      </div>,
    )
    await expect.poll(() => shown(small.label)).toBe(true)
  })

  it('show="value" 写数量；超过 maxItems 时尾部合并为弱化色的「其他」', async () => {
    await render(
      <div style={{ width: 800 }}>
        <SegmentedBar
          variant="tall"
          label="Visits"
          testId="bar"
          show="value"
          maxItems={3}
          items={[
            { key: 'us', name: 'US', value: 4_210 },
            { key: 'de', name: 'DE', value: 1_830 },
            { key: 'jp', name: 'JP', value: 1_240 },
            { key: 'br', name: 'BR', value: 610 },
          ]}
        />
      </div>,
    )
    const segs = segmentsOf('bar')
    expect(segs.map((s) => s.label?.textContent)).toEqual(['4,210', '1,830', '1,850'])
    const other = segs[2]
    if (!other) throw new Error('缺少「其他」')
    expect(other.el.hasAttribute('data-other')).toBe(true)
    expect(sameColor(css(other.fill).backgroundColor, token('color-chart-muted'))).toBe(true)
    expect(sameColor(css(other.fill).color, token('color-chart-muted-on'))).toBe(true)
    await expect
      .element(page.getByRole('img', { name: 'Other: 1,850 (23.4%)' }))
      .toBeInTheDocument()
    const legend = page.getByTestId('bar').element().querySelector('ul')
    expect([...(legend?.children ?? [])].map((li) => li.textContent)).toEqual(['US', 'DE', 'Other'])
  })

  it('悬停：500ms 后显示提示（数值在前、醒目，然后是占比与名称）；移开后消失', async () => {
    useFakeTimers()
    await render(
      <SegmentedBar variant="tall" label="Storage" testId="bar" items={storage} format={gb} />,
    )
    const [images, videos] = segmentsOf('bar')
    if (!images || !videos) throw new Error('缺少色块')
    const before = clock()
    await userEvent.hover(images.el)
    const after = clock()
    await before.to(450)
    expect(visibleTooltips()).toEqual([])
    await after.to(550)
    expect(visibleTooltips()).toEqual(['413 GB48.6%Images'])
    const tip = document.querySelector('.ant-tooltip:not(.ant-tooltip-hidden)')
    const value = [...(tip?.querySelectorAll('span') ?? [])].find(
      (el) => el.textContent === '413 GB',
    )
    if (!value) throw new Error('提示中缺少数值')
    expect(css(value).fontWeight).toBe('600')
    // 提示对读屏隐藏：块的读屏名称已包含同样的内容
    expect(tip?.querySelector('[aria-hidden="true"]')).not.toBeNull()
    // 悬停的块叠加状态层
    expect(Number(getComputedStyle(images.fill, '::before').opacity)).toBeGreaterThan(0)
    // 移到相邻的块：立即切换
    await userEvent.hover(videos.el)
    await settle()
    expect(visibleTooltips()).toContain('286 GB33.6%Videos')
    await parkPointer()
    await settle(300)
    await expect.poll(visibleTooltips).toEqual([])
  })

  it('键盘：所有块只占一个 Tab 位置，←/→、Home/End 漫游；聚焦即显示提示与焦点环', async () => {
    useFakeTimers()
    await render(
      <>
        <input aria-label="Before" />
        <SegmentedBar variant="tall" label="Storage" testId="bar" items={storage} format={gb} />
        <input aria-label="After" />
      </>,
    )
    const segs = segmentsOf('bar').map((s) => s.el)
    expect(segs.map((s) => s.tabIndex)).toEqual([0, -1, -1, -1, -1])
    await userEvent.click(page.getByRole('textbox', { name: 'Before' }))
    await userEvent.tab()
    expect(document.activeElement).toBe(segs[0])
    await settle()
    expect(visibleTooltips()).toEqual(['413 GB48.6%Images'])
    const fill = segs[0]?.querySelector('[data-segment-fill]')
    if (!fill) throw new Error('缺少色块')
    expect(css(fill).outlineStyle).toBe('solid')
    expect(css(fill).outlineWidth).toBe('2px')
    expect(css(fill).outlineOffset).toBe('2px')
    expect(sameColor(css(fill).outlineColor, token('color-focus-ring'))).toBe(true)
    await userEvent.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(segs[1])
    await settle()
    expect(visibleTooltips()).toContain('286 GB33.6%Videos')
    expect(segs.map((s) => s.tabIndex)).toEqual([-1, 0, -1, -1, -1])
    await userEvent.keyboard('{End}')
    expect(document.activeElement).toBe(segs[4])
    await userEvent.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(segs[4])
    await userEvent.keyboard('{Home}')
    expect(document.activeElement).toBe(segs[0])
    await userEvent.keyboard('{ArrowLeft}')
    expect(document.activeElement).toBe(segs[0])
    await userEvent.keyboard('{ArrowRight}{ArrowRight}')
    expect(document.activeElement).toBe(segs[2])
    // Tab 离开整条；Shift+Tab 回到上次停留的块
    await userEvent.tab()
    expect(document.activeElement).toBe(page.getByRole('textbox', { name: 'After' }).element())
    await userEvent.tab({ shift: true })
    expect(document.activeElement).toBe(segs[2])
  })

  it('细条：8px（dense 4px）、全圆角、不写文字、默认没有图例；悬停区域 24px，不改变布局', async () => {
    await render(
      <>
        <SegmentedBar variant="thin" label="Tasks" testId="thin" items={storage} />
        <SegmentedBar variant="thin" dense label="Tasks" testId="dense" items={storage} />
        <SegmentedBar variant="thin" legend label="Tasks" testId="legend" items={storage} />
      </>,
    )
    const thin = page.getByTestId('thin').element()
    const [seg] = segmentsOf('thin')
    if (!seg) throw new Error('缺少色块')
    expect(seg.label).toBeNull()
    expect(seg.fill.getBoundingClientRect().height).toBe(8)
    expect(width(seg.fill)).toBeGreaterThan(0)
    expect(width(seg.fill)).toBeCloseTo(width(seg.el), 1)
    expect(Number.parseFloat(css(seg.fill).borderTopLeftRadius)).toBeGreaterThanOrEqual(4)
    expect(seg.el.getBoundingClientRect().height).toBe(24)
    expect(thin.getBoundingClientRect().height).toBe(8)
    expect(thin.querySelector('ul')).toBeNull()
    const [denseSeg] = segmentsOf('dense')
    expect(denseSeg?.fill.getBoundingClientRect().height).toBe(4)
    expect(denseSeg?.el.getBoundingClientRect().height).toBe(24)
    const legend = page.getByTestId('legend').element().querySelector('ul')
    expect(legend?.getAttribute('aria-hidden')).toBe('true')
    expect([...(legend?.children ?? [])].map((li) => li.textContent)).toEqual(
      storage.map((s) => s.name),
    )
  })

  it('没有数据：同样高度的空轨道，读屏读出「No data」；负数等无效数据在开发模式下警告并按空处理', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await render(
      <>
        <SegmentedBar variant="tall" label="Empty" testId="empty" items={[]} />
        <SegmentedBar
          variant="tall"
          label="Zeros"
          testId="zeros"
          items={[{ key: 'a', name: 'A', value: 0 }]}
        />
        <SegmentedBar
          variant="tall"
          label="Invalid"
          testId="invalid"
          items={[
            { key: 'a', name: 'A', value: 5 },
            { key: 'b', name: 'B', value: -2 },
          ]}
        />
      </>,
    )
    for (const id of ['empty', 'zeros', 'invalid']) {
      const root = page.getByTestId(id).element()
      expect(root.querySelectorAll('[data-segment]'), id).toHaveLength(0)
      const track = root.querySelector('[data-segment-empty]')
      if (!track) throw new Error(`${id} 缺少空轨道`)
      expect(track.getBoundingClientRect().height, id).toBe(28)
      expect(sameColor(css(track).backgroundColor, token('color-fill-strong')), id).toBe(true)
      expect(track.textContent, id).toBe('No data')
      expect(root.querySelector('ul'), id).toBeNull()
    }
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('"b"')
  })

  it('名称是不可信文本：只作为文字渲染', async () => {
    useFakeTimers()
    const name = '<img src=x onerror="window.__xss=1">'
    await render(
      <SegmentedBar
        variant="tall"
        label="Untrusted"
        testId="bar"
        items={[{ key: 'a', name, value: 1 }]}
      />,
    )
    const root = page.getByTestId('bar').element()
    expect(root.querySelector('img')).toBeNull()
    expect(root.querySelector('li')?.textContent).toBe(name)
    await userEvent.hover(segmentsOf('bar')[0]?.el as HTMLElement)
    await clock().to(600)
    expect(visibleTooltips()[0]).toContain(name)
    expect(document.querySelector('.ant-tooltip img')).toBeNull()
    expect((window as { __xss?: number }).__xss).toBeUndefined()
  })

  it('动效只用令牌：色块状态层 120ms 淡入淡出；「减少动态效果」时为 0（没有宽度动画）', async () => {
    const { unmount } = await render(
      <SegmentedBar variant="tall" label="Storage" testId="bar" items={storage} />,
    )
    const fill = () => segmentsOf('bar')[0]?.fill as HTMLElement
    const stateLayer = () => getComputedStyle(fill(), '::before')
    expect(stateLayer().transitionProperty).toBe('opacity')
    expect(ms(stateLayer().transitionDuration)).toBe(ms(token('motion-duration-fast')))
    expect(ms(stateLayer().transitionDuration)).toBeGreaterThan(0)
    expect(css(segmentsOf('bar')[0]?.el as HTMLElement).transitionDuration).toBe('0s')
    await unmount()
    await render(<SegmentedBar variant="tall" label="Storage" testId="bar" items={storage} />, {
      reducedMotion: true,
    })
    expect(ms(stateLayer().transitionDuration)).toBe(0)
  })

  it('明暗切换后，色块与块内文字的颜色随令牌变化', async () => {
    await render(
      <>
        <ThemeProbe />
        <SegmentedBar variant="tall" label="Storage" testId="bar" items={storage} />
      </>,
    )
    const [first] = segmentsOf('bar')
    if (!first) throw new Error('缺少色块')
    const light = css(first.fill).backgroundColor
    theme.setColorMode('dark')
    await expect.poll(() => document.documentElement.dataset.vlMode).toBe('dark')
    await expect.poll(() => sameColor(css(first.fill).backgroundColor, light)).toBe(false)
    expect(sameColor(css(first.fill).backgroundColor, token('color-chart-1'))).toBe(true)
    expect(sameColor(css(first.fill).color, token('color-chart-1-on'))).toBe(true)
  })
})
