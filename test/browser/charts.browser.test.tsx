/**
 * 图表在真实浏览器中的行为（折线、面积与容器）：
 * - 图例切换显示 / 隐藏（aria-pressed），隐藏后其他系列颜色不变；
 * - 「图表 / 表格」切换：首列是类别，每个系列一列，数值用同一个写法；
 * - 键盘：Tab 聚焦（焦点环只在键盘时出现），←/→、Home/End 显示与悬停相同的提示，读屏播报，Esc 关闭；
 * - 安全：系列名、类别名是不可信文本，提示、图例、表格、坐标轴中都不会被当作 HTML；
 * - 主题：明暗切换后重新着色；容器变宽后重绘；
 * - 状态：首次加载的加载指示与图表同高、重新加载保留旧图形并降低不透明度、错误（重试）与空状态。
 */
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { AreaChart, ChartContainer, LineChart, useTheme } from '../../src/index.ts'
import { plot as plotOf, rendered as renderedOf, tableView, visibleTooltip } from './charts.tsx'
import {
  css,
  expectFocusRing,
  expectNoFocusRing,
  page,
  render,
  sameColor,
  settle,
  token,
  userEvent,
} from './render.tsx'

const rows = [
  { month: 'Jan', revenue: 1200, cost: 300 },
  { month: 'Feb', revenue: 1500, cost: 420 },
  { month: 'Mar', revenue: 1420, cost: 510 },
  { month: 'Apr', revenue: 1810, cost: 480 },
]
const series = [
  { key: 'revenue', name: 'Revenue' },
  { key: 'cost', name: 'Cost' },
] as const

/** 图形区域。 */
const plot = (name = 'Monthly totals') => plotOf(name)

/** 等 ECharts 完成渲染。 */
const rendered = (el: HTMLElement = plot()) => renderedOf(el)

/** 折线的颜色（SVG 中 2px 宽、不填充的路径）。 */
function lineStrokes(el: HTMLElement = plot()): string[] {
  return [...el.querySelectorAll('path')]
    .filter(
      (p) =>
        p.getAttribute('stroke-width') === '2' && (p.getAttribute('fill') ?? 'none') === 'none',
    )
    .map((p) => p.getAttribute('stroke') ?? '')
    .filter((s) => s && s !== 'none')
}

function Chart(props: { loading?: boolean; data?: typeof rows; width?: number }) {
  return (
    <div style={{ width: props.width ?? 640 }}>
      <LineChart
        title="Monthly totals"
        data={props.data ?? rows}
        x="month"
        xLabel="Month"
        series={series}
        loading={props.loading}
      />
    </div>
  )
}

describe('LineChart：图例与颜色', () => {
  it('两个系列时显示图例；点击切换显示 / 隐藏（aria-pressed），隐藏后另一个系列颜色不变', async () => {
    await render(<Chart />)
    await rendered()
    const cost = page.getByRole('button', { name: 'Cost' })
    const revenue = page.getByRole('button', { name: 'Revenue' })
    await expect.element(revenue).toHaveAttribute('aria-pressed', 'true')
    const before = lineStrokes()
    expect(before).toHaveLength(2)
    expect(sameColor(before[0] as string, token('color-chart-1'))).toBe(true)
    expect(sameColor(before[1] as string, token('color-chart-2'))).toBe(true)
    await userEvent.click(revenue)
    await expect.element(revenue).toHaveAttribute('aria-pressed', 'false')
    await expect.poll(() => lineStrokes().length).toBe(1)
    expect(sameColor(lineStrokes()[0] as string, token('color-chart-2'))).toBe(true)
    // 图例的标记颜色也不变（隐藏后变为空心，颜色仍是原来的）
    const swatch = (cost.element() as HTMLElement).querySelector('span') as HTMLElement
    expect(sameColor(css(swatch).backgroundColor, token('color-chart-2'))).toBe(true)
    await userEvent.click(revenue)
    await expect.poll(() => lineStrokes().length).toBe(2)
  })

  it('图例可以用键盘操作：Tab 到图例项，Enter / Space 切换', async () => {
    await render(<Chart />)
    await rendered()
    const revenue = page.getByRole('button', { name: 'Revenue' })
    ;(revenue.element() as HTMLElement).focus()
    await userEvent.keyboard('{Enter}')
    await expect.element(revenue).toHaveAttribute('aria-pressed', 'false')
    await userEvent.keyboard(' ')
    await expect.element(revenue).toHaveAttribute('aria-pressed', 'true')
  })

  it('只有一个系列时没有图例', async () => {
    await render(
      <LineChart
        title="Monthly totals"
        data={rows}
        x="month"
        series={[{ key: 'revenue', name: 'Revenue' }]}
      />,
    )
    await rendered()
    expect(document.querySelector('[aria-pressed]')).toBeNull()
    expect(page.getByRole('list', { name: 'Legend' }).query()).toBeNull()
  })
})

describe('LineChart：表格视图', () => {
  it('切换为表格：首列是类别，每个系列一列，数值用同一个写法；切回图表重新绘制', async () => {
    await render(<Chart />)
    await rendered()
    await userEvent.click(page.getByText('Table', { exact: true }))
    await expect.poll(() => tableView()?.cells.length).toBe(4)
    expect(tableView()?.headers).toEqual(['Month', 'Revenue', 'Cost'])
    expect(tableView()?.cells).toEqual([
      ['Jan', '1,200', '300'],
      ['Feb', '1,500', '420'],
      ['Mar', '1,420', '510'],
      ['Apr', '1,810', '480'],
    ])
    expect(page.getByRole('application').query()).toBeNull()
    await userEvent.click(page.getByText('Chart', { exact: true }))
    // 切回图表：新的图形区域重新创建实例并画出两条线
    await expect.poll(() => lineStrokes().length).toBe(2)
  })
})

describe('LineChart：键盘', () => {
  it('Tab 聚焦显示焦点环；→ 显示第一个类别的提示（列出全部系列）并播报，Home / End 跳到首尾，Esc 关闭', async () => {
    await render(
      <>
        <input aria-label="Before" />
        <Chart />
      </>,
    )
    await rendered()
    await userEvent.click(page.getByRole('textbox', { name: 'Before' }))
    // 先经过图例的两个按钮，再到图形
    await userEvent.tab()
    await userEvent.tab()
    await userEvent.tab()
    await userEvent.tab()
    expect(document.activeElement).toBe(plot())
    expectFocusRing(plot(), 2)
    // 焦点环画在图形区域外侧，外层不能把它裁掉
    for (let n = plot().parentElement; n && n.tagName !== 'FIGURE'; n = n.parentElement)
      expect(css(n).overflow, n.className).toBe('visible')
    expect(visibleTooltip()).toBeNull()

    await userEvent.keyboard('{ArrowRight}')
    await expect.poll(() => visibleTooltip()?.textContent).toBe('Jan1,200Revenue300Cost')
    const live = plot().parentElement?.querySelector('[aria-live="polite"]')
    expect(live?.textContent).toBe('Jan, Revenue 1,200, Cost 300')

    await userEvent.keyboard('{ArrowRight}')
    await expect.poll(() => visibleTooltip()?.textContent).toMatch(/^Feb/)
    await userEvent.keyboard('{End}')
    await expect.poll(() => visibleTooltip()?.textContent).toMatch(/^Apr/)
    // 已在最后：停在原处
    await userEvent.keyboard('{ArrowRight}')
    await settle(100)
    expect(visibleTooltip()?.textContent).toMatch(/^Apr/)
    await userEvent.keyboard('{Home}')
    await expect.poll(() => visibleTooltip()?.textContent).toMatch(/^Jan/)

    await userEvent.keyboard('{Escape}')
    await expect.poll(() => visibleTooltip()).toBeNull()
    // Esc 之后再按方向键，从原来的位置继续
    await userEvent.keyboard('{ArrowRight}')
    await expect.poll(() => visibleTooltip()?.textContent).toMatch(/^Feb/)
  })

  it('鼠标点击图形不显示焦点环；失去焦点时关闭键盘打开的提示', async () => {
    await render(
      <>
        <Chart />
        <input aria-label="After" />
      </>,
    )
    await rendered()
    await userEvent.click(plot(), { position: { x: 300, y: 40 } })
    expect(document.activeElement).toBe(plot())
    expectNoFocusRing(plot())
    await userEvent.keyboard('{ArrowRight}')
    await expect.poll(() => visibleTooltip()).not.toBeNull()
    expectFocusRing(plot(), 2)
    ;(page.getByRole('textbox', { name: 'After' }).element() as HTMLElement).focus()
    await expect.poll(() => visibleTooltip()).toBeNull()
  })

  it('图形的读屏名称是标题，角色说明是图表类型，说明中有键盘操作', async () => {
    await render(<Chart />)
    await rendered()
    const el = plot()
    expect(el.getAttribute('aria-roledescription')).toBe('Line chart')
    const hint = document.getElementById(el.getAttribute('aria-describedby') ?? '')
    expect(hint?.textContent).toMatch(/arrow keys/)
  })
})

describe('安全：不可信的名字', () => {
  it('系列名、类别名中的 HTML 只作为文字显示：提示、图例、表格、坐标轴中都没有 img，脚本不执行', async () => {
    const evil = '<img src=x onerror="window.__xss=1">'
    const w = window as { __xss?: number }
    delete w.__xss
    await render(
      <LineChart
        title="Monthly totals"
        data={[
          { month: evil, a: 1, b: 2 },
          { month: 'Feb', a: 3, b: 4 },
        ]}
        x="month"
        series={[
          { key: 'a', name: evil },
          { key: 'b', name: 'Safe' },
        ]}
      />,
    )
    await rendered()
    plot().focus()
    await userEvent.keyboard('{ArrowRight}')
    await expect.poll(() => visibleTooltip()).not.toBeNull()
    expect(visibleTooltip()?.textContent).toContain(evil)
    await userEvent.hover(plot(), { position: { x: 300, y: 100 } })
    await settle(200)
    await userEvent.click(page.getByText('Table', { exact: true }))
    await expect.poll(() => tableView()?.cells.length).toBe(2)
    expect(tableView()?.headers).toContain(evil)
    expect(tableView()?.cells[0]?.[0]).toBe(evil)
    expect(document.querySelector('img')).toBeNull()
    await settle(100)
    expect(w.__xss).toBeUndefined()
  })
})

let theme: ReturnType<typeof useTheme>
function Probe() {
  theme = useTheme()
  return null
}

function Resizable() {
  const [width, setWidth] = useState(400)
  return (
    <>
      <button type="button" onClick={() => setWidth(800)}>
        Wider
      </button>
      <Chart width={width} />
    </>
  )
}

function Custom() {
  const [hidden, setHidden] = useState<readonly string[]>([])
  return (
    <ChartContainer
      title="Custom"
      height={120}
      legend={[
        { key: 'a', name: 'Alpha', color: 1 },
        { key: 'b', name: 'Beta', color: 'muted' },
      ]}
      hiddenKeys={hidden}
      onHiddenKeysChange={setHidden}
      table={{ columns: [{ key: 'k', title: 'Key' }], rows: [{ k: 'one' }] }}
    >
      <output>{hidden.join(',') || 'all'}</output>
    </ChartContainer>
  )
}

describe('主题与尺寸', () => {
  it('明暗切换后重新着色：折线颜色变为深色模式的令牌', async () => {
    await render(
      <>
        <Probe />
        <Chart />
      </>,
    )
    await rendered()
    const light = lineStrokes()[0] as string
    expect(sameColor(light, token('color-chart-1'))).toBe(true)
    theme.setColorMode('dark')
    await expect.poll(() => document.documentElement.dataset.vlMode).toBe('dark')
    await expect.poll(() => sameColor(lineStrokes()[0] ?? '', token('color-chart-1'))).toBe(true)
    expect(sameColor(lineStrokes()[0] as string, light)).toBe(false)
  })

  it('容器变宽后重绘：SVG 跟随容器宽度', async () => {
    await render(<Resizable />)
    await rendered()
    const svgWidth = () => Number(plot().querySelector('svg')?.getAttribute('width'))
    const narrow = svgWidth()
    expect(narrow).toBeGreaterThan(300)
    expect(narrow).toBeLessThanOrEqual(400)
    await userEvent.click(page.getByRole('button', { name: 'Wider' }))
    await expect.poll(svgWidth).toBeGreaterThan(narrow + 300)
  })

  it('高度：图形与表格视图同高，卡片内没有嵌套滚动', async () => {
    await render(<Chart />)
    await rendered()
    const body = plot().parentElement?.parentElement as HTMLElement
    expect(body.getBoundingClientRect().height).toBe(240)
    expect(body.scrollHeight).toBeLessThanOrEqual(body.clientHeight)
    await userEvent.click(page.getByText('Table', { exact: true }))
    await expect.poll(() => tableView()?.cells.length).toBe(4)
    expect(tableView()?.view.getBoundingClientRect().height).toBe(240)
  })

  // 短表格不出现嵌套滚动（dataviz：卡片内不要嵌套滚动）；只有超过上限（480px）的长表格才在卡片内滚动
  const manyRows = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ month: `M${i + 1}`, revenue: 1000 + i, cost: 400 + i }))
  const body = () => tableView()?.view as HTMLElement

  it('表格视图：行数多于图表高度能容纳的行数时随行数变高，不出现嵌套滚动', async () => {
    await render(<Chart data={manyRows(10)} />)
    await rendered()
    await userEvent.click(page.getByText('Table', { exact: true }))
    await expect.poll(() => tableView()?.cells.length).toBe(10)
    const el = body()
    expect(el.getBoundingClientRect().height).toBeGreaterThan(240)
    expect(el.getBoundingClientRect().height).toBeLessThanOrEqual(480)
    // 内容的底边不超出主体（用精确的位置比较：行高是小数，scrollHeight 与 clientHeight 各自取整会差 1px）
    const content = el.firstElementChild as HTMLElement
    expect(content.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      el.getBoundingClientRect().bottom + 0.5,
    )
  })

  it('表格视图：长表格到 480px 为止，其余在卡片内滚动', async () => {
    await render(<Chart data={manyRows(60)} />)
    await rendered()
    await userEvent.click(page.getByText('Table', { exact: true }))
    await expect.poll(() => tableView()?.cells.length).toBe(60)
    const el = body()
    expect(el.getBoundingClientRect().height).toBe(480)
    expect(el.scrollHeight).toBeGreaterThan(el.clientHeight)
  })
})

describe('状态', () => {
  it('首次加载：延迟出现的加载指示，高度与图表相同；数据到来后显示图形', async () => {
    const { rerender } = await render(<Chart loading data={[]} />)
    const status = page.getByRole('status', { name: 'Loading' })
    await expect.element(status).toBeInTheDocument()
    const body = status.element().parentElement as HTMLElement
    expect(body.getBoundingClientRect().height).toBe(240)
    await rerender(<Chart />)
    await rendered()
    expect(page.getByRole('status', { name: 'Loading' }).query()).toBeNull()
  })

  it('已有数据时重新加载：保留上一次的图形、降低不透明度（aria-busy），不显示加载指示', async () => {
    const { rerender } = await render(<Chart />)
    await rendered()
    const svg = plot().querySelector('svg')
    await rerender(<Chart loading />)
    const figure = plot().closest('figure') as HTMLElement
    expect(figure.getAttribute('aria-busy')).toBe('true')
    // 很快完成的重新加载不变暗（与加载指示一样延迟 200ms）
    const body = figure.querySelector('[data-view]') as HTMLElement
    expect(body.dataset.refreshing).toBeUndefined()
    await expect.poll(() => body.dataset.refreshing, { timeout: 2000 }).toBe('true')
    await expect.poll(() => Number(css(body).opacity)).toBeLessThan(0.6)
    expect(plot().querySelector('svg')).toBe(svg)
    expect(page.getByRole('status', { name: 'Loading' }).query()).toBeNull()
    await rerender(<Chart />)
    expect(figure.getAttribute('aria-busy')).toBeNull()
  })

  it('错误：显示错误状态，有 onRetry 时显示重试；空数据显示空状态，高度不变', async () => {
    const onRetry = vi.fn()
    const { rerender } = await render(
      <LineChart
        title="Monthly totals"
        data={rows}
        x="month"
        series={series}
        error="The service did not respond."
        onRetry={onRetry}
      />,
    )
    const alert = page.getByRole('alert').filter({ hasText: 'The service did not respond.' })
    await expect.element(alert).toBeVisible()
    expect(alert.element().textContent).toContain('Failed to load')
    await userEvent.click(page.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
    await rerender(
      <LineChart
        title="Monthly totals"
        data={[]}
        x="month"
        series={series}
        emptyDescription="No visits yet"
      />,
    )
    const empty = page.getByText('No visits yet')
    await expect.element(empty).toBeVisible()
    const body = empty.element().closest('[data-view]') as HTMLElement
    expect(body.getBoundingClientRect().height).toBe(240)
  })
})

describe('状态：高度很小时', () => {
  it('错误状态的内容（含重试按钮）不被裁掉：主体随内容变高；视图切换在错误与空状态下禁用', async () => {
    await render(
      <LineChart
        title="Monthly totals"
        data={[]}
        x="month"
        series={series}
        height={120}
        error="The service did not respond."
        onRetry={() => {}}
      />,
    )
    const retry = page.getByRole('button', { name: 'Retry' }).element()
    const body = retry.closest('[data-view]') as HTMLElement
    expect(body.getBoundingClientRect().height).toBeGreaterThanOrEqual(120)
    const b = body.getBoundingClientRect()
    const r = retry.getBoundingClientRect()
    expect(r.top).toBeGreaterThanOrEqual(b.top)
    expect(r.bottom).toBeLessThanOrEqual(b.bottom)
    expect(body.scrollHeight).toBeLessThanOrEqual(body.clientHeight)
    const tableOption = page.getByText('Table', { exact: true }).element()
    expect(tableOption.closest('.ant-segmented-item-disabled')).not.toBeNull()
  })
})

describe('AreaChart 与 ChartContainer', () => {
  it('面积填充约 10% 不透明度，图例标记是方块', async () => {
    await render(<AreaChart title="Monthly totals" data={rows} x="month" series={series} stacked />)
    await rendered()
    const fills = [...plot().querySelectorAll('path')]
      .map((p) => p.getAttribute('fill-opacity'))
      .filter(Boolean)
    expect(fills.length).toBeGreaterThanOrEqual(2)
    for (const f of fills) expect(Number(f)).toBeCloseTo(0.1, 2)
    const swatch = page.getByRole('button', { name: 'Revenue' }).element().querySelector('span')
    expect(swatch?.dataset.marker).toBe('square')
  })

  it('自定义图形：标题、表格切换与图例由容器提供', async () => {
    await render(<Custom />)
    await userEvent.click(page.getByRole('button', { name: 'Beta' }))
    await expect.element(page.getByRole('status')).toHaveTextContent('b')
    const swatch = page.getByRole('button', { name: 'Beta' }).element().querySelector('span')
    expect(
      sameColor(
        css(swatch as Element).boxShadow.match(/(rgb|oklch|lab)\([^)]*\)/)?.[0] ?? '',
        token('color-chart-muted'),
      ),
    ).toBe(true)
    await userEvent.click(page.getByText('Table', { exact: true }))
    await expect.poll(() => tableView()?.cells).toEqual([['one']])
  })
})
