/**
 * Heatmap 在真实浏览器中的行为：
 * - 四个方向键在格子之间移动（跳过空格子），被指向的格子加描边而颜色不变；Home / End 在行内跳到首尾；
 * - 色标：渐变取顺序 / 发散色阶令牌，最小、最大（与中点）用文字色写出，读屏名称说明范围；
 * - 明暗切换后格子重新着色。
 */
import { describe, expect, it } from 'vitest'
import { Heatmap, useTheme } from '../../src/index.ts'
import { plot, rendered, visibleTooltip } from './charts.tsx'
import { css, page, render, sameColor, token, userEvent } from './render.tsx'

const TITLE = 'Activity'
const xs = ['a', 'b', 'c']
const ys = ['r1', 'r2']
const data = [
  { x: 'a', y: 'r1', value: 1 },
  { x: 'b', y: 'r1', value: 5 },
  { x: 'c', y: 'r1', value: 9 },
  { x: 'a', y: 'r2', value: 3 },
  { x: 'c', y: 'r2', value: 7 },
]

/** 带主要文字色描边的格子数（悬停 / 键盘指向）。 */
const outlined = () =>
  [...plot(TITLE).querySelectorAll('path')].filter((p) => {
    const stroke = p.getAttribute('stroke')
    return Boolean(stroke && stroke !== 'none' && sameColor(stroke, token('color-text-primary')))
  }).length

let theme: ReturnType<typeof useTheme>
function Probe() {
  theme = useTheme()
  return null
}

describe('Heatmap', () => {
  it.each([
    ['ArrowRight', 'a', 3],
    ['ArrowLeft', 'c', 7],
    ['ArrowDown', 'a', 3],
    ['ArrowUp', 'a', 3],
    ['Home', 'a', 3],
    ['End', 'c', 7],
  ] as const)('%s 首次进入时跳过首尾空行，提示与读屏播报一致', async (key, x, value) => {
    await render(
      <div style={{ width: 600 }}>
        <Heatmap
          title={TITLE}
          xCategories={xs}
          yCategories={['empty-first', 'middle', 'empty-last']}
          data={[
            { x: 'a', y: 'middle', value: 3 },
            { x: 'c', y: 'middle', value: 7 },
          ]}
          valueLabel="Events"
        />
      </div>,
    )
    const el = plot(TITLE)
    await rendered(el)
    el.focus()
    await userEvent.keyboard(`{${key}}`)
    await expect.poll(() => visibleTooltip()?.textContent).toBe(`${x} · middle${value}Events`)
    const announce = el.parentElement?.querySelector('[aria-live="polite"]')
    expect(announce?.textContent).toContain(`${x} · middle`)
    expect(announce?.textContent).toContain(String(value))
  })

  it('方向键在格子之间移动，跳过空格子；指向的格子加描边；Home / End 在行内；Esc 关闭', async () => {
    await render(
      <div style={{ width: 600 }}>
        <Heatmap title={TITLE} xCategories={xs} yCategories={ys} data={data} valueLabel="Events" />
      </div>,
    )
    const el = plot(TITLE)
    await rendered(el)
    el.focus()
    await userEvent.keyboard('{ArrowRight}')
    await expect.poll(() => visibleTooltip()?.textContent).toBe('a · r11Events')
    await expect.poll(outlined).toBe(1)
    await userEvent.keyboard('{ArrowDown}')
    await expect.poll(() => visibleTooltip()?.textContent).toBe('a · r23Events')
    // b · r2 是空格子：跳到 c · r2
    await userEvent.keyboard('{ArrowRight}')
    await expect.poll(() => visibleTooltip()?.textContent).toBe('c · r27Events')
    await userEvent.keyboard('{ArrowUp}')
    await expect.poll(() => visibleTooltip()?.textContent).toBe('c · r19Events')
    await userEvent.keyboard('{Home}')
    await expect.poll(() => visibleTooltip()?.textContent).toBe('a · r11Events')
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => visibleTooltip()).toBeNull()
    await expect.poll(outlined).toBe(0)
  })

  it('色标：顺序色阶的渐变取令牌，写出最小、最大值；读屏名称说明范围', async () => {
    await render(
      <div style={{ width: 600 }}>
        <Heatmap title={TITLE} xCategories={xs} yCategories={ys} data={data} />
      </div>,
    )
    const scale = page.getByRole('img', { name: 'Color scale from 1 to 9' })
    await expect.element(scale).toBeVisible()
    const ramp = scale.element().firstElementChild as HTMLElement
    expect(css(ramp).backgroundImage).toMatch(/linear-gradient/)
    expect(scale.element().textContent).toBe('19')
    const tick = scale.element().querySelector('span') as HTMLElement
    expect(sameColor(css(tick).color, token('color-text-secondary'))).toBe(true)
  })

  it('发散色阶：以中点对称，色标写出中点', async () => {
    await render(
      <div style={{ width: 600 }}>
        <Heatmap
          title={TITLE}
          xCategories={xs}
          yCategories={ys}
          data={data}
          scale="diverging"
          midpoint={4}
        />
      </div>,
    )
    await expect
      .element(page.getByRole('img', { name: 'Color scale from -1 to 9, centered on 4' }))
      .toBeVisible()
  })

  it('明暗切换后格子重新着色：最大值的格子是深色模式的顺序色第 7 级', async () => {
    await render(
      <div style={{ width: 600 }}>
        <Probe />
        <Heatmap title={TITLE} xCategories={xs} yCategories={ys} data={data} />
      </div>,
    )
    const el = plot(TITLE)
    await rendered(el)
    const hasFill = (color: string) =>
      [...el.querySelectorAll('path')].some((p) => sameColor(p.getAttribute('fill') ?? '', color))
    expect(hasFill(token('color-chart-seq-7'))).toBe(true)
    theme.setColorMode('dark')
    await expect.poll(() => document.documentElement.dataset.vlMode).toBe('dark')
    await expect.poll(() => hasFill(token('color-chart-seq-7'))).toBe(true)
    expect(hasFill(token('color-chart-seq-1'))).toBe(true)
  })
})
