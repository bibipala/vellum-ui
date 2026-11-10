/**
 * BarChart 在真实浏览器中的行为：
 * - 每根柱是自己的悬停区域：提示显示类别与数值，悬停的柱稍微提亮；
 * - 键盘：←/→ 在类别之间、↑/↓ 在同一类别的系列之间移动（横向时互换），被指向的柱提亮；
 * - 图例隐藏某个系列后，其他系列的颜色不变；颜色来自分类色令牌；
 * - 柱的几何：宽度不超过 24px，相邻柱之间 2px 间隙（实测 SVG 中的位置）。
 */
import { describe, expect, it } from 'vitest'
import { liftColor, toHexColor } from '../../src/components/charts/color.ts'
import { BarChart } from '../../src/index.ts'
import { centerOf, fills, plot, rendered, visibleTooltip } from './charts.tsx'
import { luminance, page, render, sameColor, settle, token, userEvent } from './render.tsx'

const quarters = [
  { quarter: 'Q1', hardware: 420, software: 610 },
  { quarter: 'Q2', hardware: 455, software: 680 },
  { quarter: 'Q3', hardware: 390, software: 720 },
]
const series = [
  { key: 'hardware', name: 'Hardware' },
  { key: 'software', name: 'Software' },
] as const

const TITLE = 'Revenue by quarter'

/** 某个颜色的柱（SVG 路径），按在页面上的位置从左到右、从上到下排序。 */
function barsOf(color: string): SVGPathElement[] {
  return [...plot(TITLE).querySelectorAll('path')]
    .filter((p) => sameColor(p.getAttribute('fill') ?? 'none', color))
    .sort((a, b) => {
      const ra = a.getBoundingClientRect()
      const rb = b.getBoundingClientRect()
      return ra.left - rb.left || ra.top - rb.top
    })
}

/** 提亮后的柱（悬停 / 键盘焦点状态）：颜色等于该系列颜色提亮后的取值，并且比原色亮。 */
function liftedCount(color: string): number {
  const lifted = liftColor(toHexColor(color) ?? '')
  expect(luminance(lifted)).toBeGreaterThan(luminance(color))
  return fills(plot(TITLE)).filter((f) => sameColor(f, lifted)).length
}

describe('BarChart', () => {
  it.each([
    ['vertical', 'ArrowRight', 'ArrowLeft'],
    ['horizontal', 'ArrowDown', 'ArrowUp'],
  ] as const)(
    '%s：首尾系列没有数据时从中间系列进入，类别方向保持不变',
    async (orientation, next, prev) => {
      await render(
        <div style={{ width: 720 }}>
          <BarChart
            title={TITLE}
            data={quarters.map((row) => ({ ...row, 'empty-first': null, 'empty-last': null }))}
            x="quarter"
            series={[
              { key: 'empty-first', name: 'First' },
              { key: 'software', name: 'Software' },
              { key: 'empty-last', name: 'Last' },
            ]}
            orientation={orientation}
          />
        </div>,
      )
      const el = plot(TITLE)
      await rendered(el)
      el.focus()
      await userEvent.keyboard(`{${next}}`)
      await expect.poll(() => visibleTooltip()?.textContent).toBe('Q1610Software')
      await userEvent.keyboard(`{${next}}`)
      await expect.poll(() => visibleTooltip()?.textContent).toBe('Q2680Software')
      await userEvent.keyboard(`{${prev}}`)
      await expect.poll(() => visibleTooltip()?.textContent).toBe('Q1610Software')
    },
  )

  it('柱的几何：宽度不超过 24px，同一类别相邻的柱之间 2px 间隙；颜色来自分类色令牌', async () => {
    await render(
      <div style={{ width: 720 }}>
        <BarChart title={TITLE} data={quarters} x="quarter" series={series} />
      </div>,
    )
    await rendered(plot(TITLE))
    const a = barsOf(token('color-chart-1'))
    const b = barsOf(token('color-chart-2'))
    expect(a).toHaveLength(3)
    expect(b).toHaveLength(3)
    const ra = (a[0] as SVGPathElement).getBoundingClientRect()
    const rb = (b[0] as SVGPathElement).getBoundingClientRect()
    expect(ra.width).toBeLessThanOrEqual(24.5)
    expect(rb.left - ra.right).toBeCloseTo(2, 0)
  })

  it('悬停一根柱：提示显示类别与该系列的值，柱稍微提亮；移开后恢复', async () => {
    await render(
      <div style={{ width: 720 }}>
        <BarChart title={TITLE} data={quarters} x="quarter" series={series} />
      </div>,
    )
    const el = plot(TITLE)
    await rendered(el)
    const color = token('color-chart-2')
    const bar = barsOf(color)[1] as SVGPathElement
    const box = el.getBoundingClientRect()
    const c = centerOf(bar)
    await userEvent.hover(el, { position: { x: c.x - box.left, y: c.y - box.top } })
    await expect.poll(() => visibleTooltip()?.textContent).toBe('Q2680Software')
    await expect.poll(() => liftedCount(color)).toBe(1)
    await userEvent.hover(page.getByText(TITLE))
    await expect.poll(() => liftedCount(color)).toBe(0)
  })

  it('键盘：←/→ 在类别之间、↑/↓ 在系列之间移动，被指向的柱提亮；Esc 关闭', async () => {
    await render(
      <div style={{ width: 720 }}>
        <BarChart title={TITLE} data={quarters} x="quarter" series={series} />
      </div>,
    )
    const el = plot(TITLE)
    await rendered(el)
    el.focus()
    await userEvent.keyboard('{ArrowRight}')
    await expect.poll(() => visibleTooltip()?.textContent).toBe('Q1420Hardware')
    // 状态切换时颜色有一小段过渡
    await expect.poll(() => liftedCount(token('color-chart-1'))).toBe(1)
    await userEvent.keyboard('{ArrowUp}')
    await expect.poll(() => visibleTooltip()?.textContent).toBe('Q1610Software')
    await expect.poll(() => liftedCount(token('color-chart-1'))).toBe(0)
    await expect.poll(() => liftedCount(token('color-chart-2'))).toBe(1)
    await userEvent.keyboard('{ArrowRight}')
    await expect.poll(() => visibleTooltip()?.textContent).toBe('Q2680Software')
    await userEvent.keyboard('{End}')
    await expect.poll(() => visibleTooltip()?.textContent).toBe('Q3720Software')
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => visibleTooltip()).toBeNull()
    await expect.poll(() => liftedCount(token('color-chart-2'))).toBe(0)
  })

  it('横向：↑/↓ 在类别之间、←/→ 在系列之间移动', async () => {
    await render(
      <div style={{ width: 720 }}>
        <BarChart
          title={TITLE}
          data={quarters}
          x="quarter"
          series={series}
          orientation="horizontal"
        />
      </div>,
    )
    const el = plot(TITLE)
    await rendered(el)
    el.focus()
    await userEvent.keyboard('{ArrowDown}')
    await expect.poll(() => visibleTooltip()?.textContent).toBe('Q1420Hardware')
    await userEvent.keyboard('{ArrowDown}')
    await expect.poll(() => visibleTooltip()?.textContent).toBe('Q2455Hardware')
    await userEvent.keyboard('{ArrowRight}')
    await expect.poll(() => visibleTooltip()?.textContent).toBe('Q2680Software')
    // 横向时第一个类别在最上面
    const hw = barsOf(token('color-chart-1'))
    const tops = hw.map((b) => b.getBoundingClientRect().top)
    expect(tops).toEqual([...tops].sort((x, y) => x - y))
  })

  it('图例隐藏一个系列：另一个系列颜色不变，柱变宽（一组只剩一根）', async () => {
    await render(
      <div style={{ width: 480 }}>
        <BarChart title={TITLE} data={quarters} x="quarter" series={series} />
      </div>,
    )
    const el = plot(TITLE)
    await rendered(el)
    const before = (barsOf(token('color-chart-2'))[0] as SVGPathElement).getBoundingClientRect()
    await userEvent.click(page.getByRole('button', { name: 'Hardware' }))
    await expect.poll(() => barsOf(token('color-chart-1')).length).toBe(0)
    await settle(400)
    const after = barsOf(token('color-chart-2'))
    expect(after).toHaveLength(3)
    expect((after[0] as SVGPathElement).getBoundingClientRect().width).toBeGreaterThanOrEqual(
      before.width,
    )
  })
})
