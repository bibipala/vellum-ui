/**
 * ScatterChart 在真实浏览器中的行为：
 * - 最近点命中：指针离点 10px（不在点上）也显示该点的提示并提亮，离所有点都超过 16px 时关闭；
 * - 键盘：按 x 排序在点之间移动；
 * - 超过 3 个系列时开发模式下提醒。
 */
import { describe, expect, it, vi } from 'vitest'
import { liftColor, toHexColor } from '../../src/components/charts/color.ts'
import { ScatterChart } from '../../src/index.ts'
import { centerOf, fills, plot, rendered, visibleTooltip } from './charts.tsx'
import { render, sameColor, token, userEvent } from './render.tsx'

const TITLE = 'Price and units'
const points = [
  { label: 'Aster', x: 30, y: 400 },
  { label: 'Birch', x: 10, y: 800 },
  { label: 'Cedar', x: 50, y: 200 },
]

const dots = (color: string) =>
  [...plot(TITLE).querySelectorAll('path')].filter((p) =>
    sameColor(p.getAttribute('fill') ?? 'none', color),
  )

describe('ScatterChart', () => {
  it('指针靠近点（10px 以内，不在点上）显示提示并提亮；远离所有点时关闭', async () => {
    await render(
      <div style={{ width: 640 }}>
        <ScatterChart
          title={TITLE}
          xLabel="Price"
          yLabel="Units"
          series={[{ key: 'p', name: 'Products', points }]}
        />
      </div>,
    )
    const el = plot(TITLE)
    await rendered(el)
    const color = token('color-chart-1')
    // 最左边的点是 Birch（x = 10）
    const leftmost = dots(color).sort(
      (a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left,
    )[0] as SVGPathElement
    const box = el.getBoundingClientRect()
    const c = centerOf(leftmost)
    await userEvent.hover(el, { position: { x: c.x - box.left + 8, y: c.y - box.top + 6 } })
    await expect.poll(() => visibleTooltip()?.textContent).toBe('Birch10Price800Units')
    const lifted = liftColor(toHexColor(color) ?? '')
    await expect.poll(() => fills(el).filter((f) => sameColor(f, lifted)).length).toBe(1)
    await userEvent.hover(el, { position: { x: c.x - box.left + 60, y: c.y - box.top + 60 } })
    await expect.poll(() => visibleTooltip()).toBeNull()
  })

  it('键盘：←/→ 按横轴数值的顺序在点之间移动，Esc 关闭', async () => {
    await render(
      <div style={{ width: 640 }}>
        <ScatterChart title={TITLE} series={[{ key: 'p', name: 'Products', points }]} />
      </div>,
    )
    const el = plot(TITLE)
    await rendered(el)
    el.focus()
    await userEvent.keyboard('{ArrowRight}')
    await expect.poll(() => visibleTooltip()?.textContent).toMatch(/^Birch/)
    await userEvent.keyboard('{ArrowRight}')
    await expect.poll(() => visibleTooltip()?.textContent).toMatch(/^Aster/)
    await userEvent.keyboard('{End}')
    await expect.poll(() => visibleTooltip()?.textContent).toMatch(/^Cedar/)
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => visibleTooltip()).toBeNull()
  })

  it('超过 3 个系列：开发模式下提醒合并或拆成小图', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await render(
      <ScatterChart
        title={TITLE}
        series={['a', 'b', 'c', 'd'].map((k) => ({ key: k, name: k, points }))}
      />,
    )
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/ScatterChart: 4 series.*first 3/))
    warn.mockRestore()
  })
})
