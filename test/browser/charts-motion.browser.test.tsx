/**
 * 图表与「减少动态效果」：设置变化（应用内开关 ThemeProvider `reducedMotion`、系统的 prefers-reduced-motion）时
 * 立即生效，不等下一次数据更新：图表的动画立即关闭，之后的更新（如图例切换）直接画出结果；关闭设置后恢复动画。
 */
import { getInstanceByDom } from 'echarts/core'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cdp } from 'vitest/browser'
import { LineChart, ThemeProvider } from '../../src/index.ts'
import { plot, rendered } from './charts.tsx'
import { ms, page, render, token, userEvent } from './render.tsx'

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

const TITLE = 'Monthly totals'

/** 更新动画的时长：动效令牌 `motion-duration-base`（设置打开时为 0）。 */
const base = () => ms(token('motion-duration-base'))

/** 图表实例当前的动画设置。 */
function animation() {
  const option = getInstanceByDom(plot(TITLE))?.getOption() as
    | { animation?: boolean; animationDurationUpdate?: number }
    | undefined
  return { on: option?.animation, update: option?.animationDurationUpdate }
}

/**
 * 点击图例切换一个系列，返回这次更新从开始到画完（ECharts 的 finished）的毫秒数：
 * data-rendered 在设置新选项时被移除、画完时恢复。有动画时约为更新动画的时长（200ms），没有动画时只有一两帧。
 */
async function updateDuration(name: string): Promise<number> {
  const el = plot(TITLE)
  let start: number | null = null
  let end: number | null = null
  const observer = new MutationObserver((records) => {
    const now = performance.now()
    for (const r of records) {
      if (r.oldValue === 'true') start ??= now
      else if (start !== null) end ??= now
    }
  })
  observer.observe(el, {
    attributes: true,
    attributeFilter: ['data-rendered'],
    attributeOldValue: true,
  })
  await userEvent.click(page.getByRole('button', { name }))
  await expect.poll(() => end, { timeout: 3000 }).not.toBeNull()
  observer.disconnect()
  return (end ?? 0) - (start ?? 0)
}

function Chart() {
  return (
    <div style={{ width: 600 }}>
      <LineChart title={TITLE} data={rows} x="month" series={series} />
    </div>
  )
}

/** 应用内开关：外面再包一层 ThemeProvider，由按钮切换它的 `reducedMotion`。 */
function WithSwitch() {
  const [reduced, setReduced] = useState(false)
  return (
    <ThemeProvider defaultColorMode="light" locale="en-US" reducedMotion={reduced}>
      <button type="button" onClick={() => setReduced((r) => !r)}>
        Reduce motion
      </button>
      <Chart />
    </ThemeProvider>
  )
}

afterEach(async () => {
  await cdp().send('Emulation.setEmulatedMedia', { features: [] })
})

describe('图表与减少动态效果', () => {
  it('应用内开关：打开后立即关闭动画（不等数据更新），之后的更新直接画出；关闭后恢复动画', async () => {
    await render(<WithSwitch />)
    await rendered(plot(TITLE))
    expect(base()).toBe(200)
    expect(animation()).toEqual({ on: true, update: base() })
    // 对照：有动画时，图例切换后要等更新动画（200ms）结束才画完
    expect(await updateDuration('Cost')).toBeGreaterThan(150)

    await userEvent.click(page.getByRole('button', { name: 'Reduce motion' }))
    await expect.poll(animation).toEqual({ on: false, update: 0 })
    expect(base()).toBe(0)
    await rendered(plot(TITLE))
    expect(await updateDuration('Cost')).toBeLessThan(100)

    await userEvent.click(page.getByRole('button', { name: 'Reduce motion' }))
    await expect.poll(animation).toEqual({ on: true, update: base() })
  })

  it('系统设置（prefers-reduced-motion）变化时同样立即生效', async () => {
    await render(<Chart />)
    await rendered(plot(TITLE))
    expect(animation().on).toBe(true)
    await cdp().send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    })
    expect(matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(true)
    await expect.poll(animation).toEqual({ on: false, update: 0 })
    await rendered(plot(TITLE))
    expect(await updateDuration('Revenue')).toBeLessThan(100)
    await cdp().send('Emulation.setEmulatedMedia', { features: [] })
    await expect.poll(animation).toEqual({ on: true, update: base() })
  })
})
