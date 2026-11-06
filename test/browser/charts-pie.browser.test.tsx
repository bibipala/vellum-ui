/**
 * PieChart / DonutChart 在真实浏览器中的行为：
 * - 每个扇区是自己的悬停区域：提示显示名称、数值与占比，悬停的扇区提亮；
 * - 键盘：←/→ 在扇区之间移动并播报，Home / End、Esc；
 * - 超过 maxSlices 时合并为「其他」（弱化色、随语言），表格视图仍列出全部原始项；
 * - 图例隐藏扇区后其他扇区颜色不变。
 */
import { describe, expect, it } from 'vitest'
import { liftColor, toHexColor } from '../../src/components/charts/color.ts'
import { DonutChart, PieChart } from '../../src/index.ts'
import { centerOf, fills, plot, rendered, tableView, visibleTooltip } from './charts.tsx'
import { page, render, sameColor, token, userEvent } from './render.tsx'

const TITLE = 'Visits by source'
const data = [
  { key: 'search', name: 'Search', value: 480 },
  { key: 'direct', name: 'Direct', value: 320 },
  { key: 'social', name: 'Social', value: 120 },
  { key: 'email', name: 'Email', value: 80 },
]

const slicesOf = (color: string) =>
  [...plot(TITLE).querySelectorAll('path')].filter((p) =>
    sameColor(p.getAttribute('fill') ?? 'none', color),
  )
const lifted = (color: string) => {
  const target = liftColor(toHexColor(color) ?? '')
  return fills(plot(TITLE)).filter((f) => sameColor(f, target)).length
}

describe('PieChart / DonutChart', () => {
  it('悬停扇区：提示显示名称、数值与占比，扇区提亮', async () => {
    await render(
      <div style={{ width: 600 }}>
        <PieChart title={TITLE} data={data} />
      </div>,
    )
    const el = plot(TITLE)
    await rendered(el)
    const slice = slicesOf(token('color-chart-1'))[0] as SVGPathElement
    expect(slice).toBeDefined()
    const box = el.getBoundingClientRect()
    const c = centerOf(slice)
    await userEvent.hover(el, { position: { x: c.x - box.left, y: c.y - box.top } })
    await expect.poll(() => visibleTooltip()?.textContent).toBe('Search48048%')
    await expect.poll(() => lifted(token('color-chart-1'))).toBe(1)
  })

  it('键盘：←/→ 在扇区之间移动并播报，End 到最后，Esc 关闭', async () => {
    await render(
      <div style={{ width: 600 }}>
        <DonutChart title={TITLE} data={data} />
      </div>,
    )
    const el = plot(TITLE)
    await rendered(el)
    expect(el.getAttribute('aria-roledescription')).toBe('Donut chart')
    el.focus()
    await userEvent.keyboard('{ArrowRight}')
    await expect.poll(() => visibleTooltip()?.textContent).toBe('Search48048%')
    const live = el.parentElement?.querySelector('[aria-live="polite"]')
    expect(live?.textContent).toBe('Search, 480, 48%')
    await expect.poll(() => lifted(token('color-chart-1'))).toBe(1)
    await userEvent.keyboard('{ArrowRight}')
    await expect.poll(() => visibleTooltip()?.textContent).toBe('Direct32032%')
    await userEvent.keyboard('{End}')
    await expect.poll(() => visibleTooltip()?.textContent).toBe('Email808%')
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => visibleTooltip()).toBeNull()
  })

  it('超过 maxSlices：合并为「其他」（弱化色、随语言），表格视图仍列出全部原始项', async () => {
    await render(
      <div style={{ width: 600 }}>
        <PieChart title={TITLE} data={data} maxSlices={3} />
      </div>,
      { locale: 'zh-CN' },
    )
    const el = plot(TITLE)
    await rendered(el)
    await expect.element(page.getByRole('button', { name: '其他' })).toBeVisible()
    expect(slicesOf(token('color-chart-muted'))).toHaveLength(1)
    expect(slicesOf(token('color-chart-3'))).toHaveLength(0)
    await userEvent.click(page.getByText('表格', { exact: true }))
    await expect.poll(() => tableView()?.cells.length).toBe(4)
    expect(tableView()?.headers).toEqual(['类别', '数值', '占比'])
    expect(tableView()?.cells.map((r) => r[0])).toEqual(['Search', 'Direct', 'Social', 'Email'])
  })

  it('图例隐藏一个扇区：其他扇区颜色不变', async () => {
    await render(
      <div style={{ width: 600 }}>
        <PieChart title={TITLE} data={data} />
      </div>,
    )
    const el = plot(TITLE)
    await rendered(el)
    await userEvent.click(page.getByRole('button', { name: 'Search' }))
    await expect.poll(() => slicesOf(token('color-chart-1')).length).toBe(0)
    expect(slicesOf(token('color-chart-2'))).toHaveLength(1)
    expect(slicesOf(token('color-chart-4'))).toHaveLength(1)
  })
})
