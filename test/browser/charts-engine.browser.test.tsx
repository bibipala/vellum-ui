/**
 * 图表引擎按需加载（第一次渲染图表时才 `import()` ECharts）：
 * - 服务端渲染后注水：两边都按「引擎未就绪」输出，没有注水不一致；注水后加载引擎并画出图形；
 * - 引擎就绪之前：图形区域已经是最终的尺寸，超过 200ms 才出现加载指示；标题、图例、视图切换与表格视图不等引擎；
 *   就绪后卡片高度不变；
 * - 已经加载过：直接创建实例，不出现加载指示；
 * - 加载失败：图形区域显示错误状态与「重试」，控制台输出原因；重试成功后画出图形。
 *
 * 本文件的第一个用例必须在引擎还没有加载时运行（每个测试文件在自己的页面中运行，模块状态互不影响）。
 */
import { useState } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChartContainer } from '../../src/components/charts/ChartContainer.tsx'
import { type ChartLoader, type ChartNav, ChartPlot } from '../../src/components/charts/engine.tsx'
import { App, LineChart, ThemeProvider } from '../../src/index.ts'
import { plot, rendered, tableView } from './charts.tsx'
import { inAct, page, render, settle, userEvent } from './render.tsx'

afterEach(() => {
  vi.restoreAllMocks()
})

const rows = [
  { month: 'Jan', revenue: 1200, cost: 300 },
  { month: 'Feb', revenue: 1500, cost: 420 },
  { month: 'Mar', revenue: 1420, cost: 510 },
]
const series = [
  { key: 'revenue', name: 'Revenue' },
  { key: 'cost', name: 'Cost' },
] as const

function Line() {
  return (
    <div style={{ width: 600 }}>
      <LineChart title="Monthly totals" data={rows} x="month" series={series} />
    </div>
  )
}

/** 在页面中做一次服务端渲染再注水，返回注水期间的可恢复错误与 console.error。 */
async function hydrate() {
  const ui = (
    <ThemeProvider defaultColorMode="light" locale="en-US">
      <App>
        <Line />
      </App>
    </ThemeProvider>
  )
  const container = document.createElement('div')
  container.innerHTML = renderToString(ui)
  document.body.appendChild(container)
  // 服务端输出空的图形区域
  expect(container.querySelector('[role="application"]')?.innerHTML).toBe('')
  const error = vi.spyOn(console, 'error')
  const recoverable = vi.fn()
  let root: ReturnType<typeof hydrateRoot> | undefined
  await inAct(() => {
    root = hydrateRoot(container, ui, { onRecoverableError: recoverable })
  })
  await rendered(plot('Monthly totals'))
  expect(recoverable).not.toHaveBeenCalled()
  expect(error).not.toHaveBeenCalled()
  await inAct(() => root?.unmount())
  container.remove()
}

describe('服务端渲染与注水', () => {
  it('引擎还没有加载时注水：没有注水不一致，注水后加载引擎并画出图形', async () => {
    await hydrate()
  })

  it('引擎已经加载过时注水：同样没有注水不一致', async () => {
    await hydrate()
  })
})

describe('引擎已经加载过', () => {
  it('直接创建实例，不出现加载指示', async () => {
    await render(<Line />)
    const figure = plot('Monthly totals').closest('figure') as HTMLElement
    expect(figure.querySelector('[role="status"]')).toBeNull()
    await rendered(plot('Monthly totals'))
  })
})

/** 由测试控制何时完成的加载函数：第 n 次调用等待第 n 个闸门。 */
function gatedLoader() {
  const gates: { resolve: () => void; reject: (e: unknown) => void }[] = []
  const load: ChartLoader = () =>
    new Promise<void>((resolve, reject) => {
      gates.push({ resolve, reject })
    }).then(() => import('../../src/components/charts/engine-line.ts'))
  return { load, gates }
}

const NAV: ChartNav = {
  cols: 0,
  rows: 1,
  keys: { colNext: 'ArrowRight', colPrev: 'ArrowLeft' },
  target: () => null,
}

const build = () => ({
  animation: false,
  grid: { left: 32, right: 8, top: 8, bottom: 24 },
  xAxis: { type: 'category', data: ['a', 'b', 'c'] },
  yAxis: { type: 'value' },
  series: [{ type: 'line', data: [1, 3, 2] }],
})

function Gated(props: { load: ChartLoader }) {
  const [hidden, setHidden] = useState<readonly string[]>([])
  return (
    <div style={{ width: 600 }}>
      <ChartContainer
        title="Gated"
        legend={[
          { key: 'a', name: 'Alpha', color: 1 },
          { key: 'b', name: 'Beta', color: 2 },
        ]}
        hiddenKeys={hidden}
        onHiddenKeysChange={setHidden}
        table={{ columns: [{ key: 'k', title: 'Key' }], rows: [{ k: 'one' }] }}
      >
        <ChartPlot
          load={props.load}
          build={build}
          nav={NAV}
          label="Gated"
          kind="Line chart"
          hint=""
        />
      </ChartContainer>
    </div>
  )
}

describe('引擎就绪之前', () => {
  it('图形区域是最终的尺寸，200ms 后出现加载指示；图例与表格视图可用；就绪后画出图形，卡片高度不变', async () => {
    const { load, gates } = gatedLoader()
    await render(<Gated load={load} />)
    const el = plot('Gated')
    const figure = el.closest('figure') as HTMLElement
    expect(el.getBoundingClientRect().height).toBe(240)
    const height = figure.getBoundingClientRect().height
    // 很快完成的加载不闪：一开始加载指示不可见（延迟出现）
    const status = () => figure.querySelector('[role="status"]') as HTMLElement | null
    expect(Number(getComputedStyle(status() as HTMLElement).opacity)).toBe(0)
    await expect.poll(() => Number(getComputedStyle(status() as HTMLElement).opacity)).toBe(1)

    // 图例、视图切换与表格视图不等引擎
    const alpha = page.getByRole('button', { name: 'Alpha' })
    await userEvent.click(alpha)
    await expect.element(alpha).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(page.getByText('Table', { exact: true }))
    await expect.poll(() => tableView()?.cells).toEqual([['one']])
    await userEvent.click(page.getByText('Chart', { exact: true }))
    expect(plot('Gated').getBoundingClientRect().height).toBe(240)

    gates.forEach((g) => {
      g.resolve()
    })
    await rendered(plot('Gated'))
    await expect.poll(status).toBeNull()
    expect(figure.getBoundingClientRect().height).toBe(height)
  })

  it('加载失败：图形区域显示错误状态与「重试」，控制台输出原因；重试成功后画出图形', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { load, gates } = gatedLoader()
    await render(<Gated load={load} />)
    await expect.poll(() => gates.length).toBe(1)
    gates[0]?.reject(new Error('network down'))
    const retry = page.getByRole('button', { name: 'Retry' })
    await expect.element(retry).toBeVisible()
    expect(page.getByRole('application', { name: 'Gated' }).query()).toBeNull()
    expect(error).toHaveBeenCalledWith(
      '[vellum-ui] Failed to load the chart engine.',
      expect.objectContaining({ message: 'network down' }),
    )
    await userEvent.click(retry)
    await expect.poll(() => gates.length).toBe(2)
    gates[1]?.resolve()
    await rendered(plot('Gated'))
    await settle()
    expect(page.getByRole('button', { name: 'Retry' }).query()).toBeNull()
  })
})
