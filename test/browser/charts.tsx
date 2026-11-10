/**
 * 图表浏览器测试的公共工具：找到图形区域、等待 ECharts 渲染、读取可见的提示、表格视图与图形的颜色。
 */
import { expect } from 'vitest'
import { css, nextFrame, page } from './render.tsx'

/** 图形区域（可聚焦，读屏名称是标题）。 */
export const plot = (name: string) =>
  page.getByRole('application', { name }).element() as HTMLElement

/** 等 ECharts 完成渲染：当前选项画完（data-rendered），并且已经有图形。 */
export async function rendered(el: HTMLElement) {
  await expect.poll(() => el.dataset.rendered, { timeout: 5000 }).toBe('true')
  await expect.poll(() => el.querySelectorAll('path').length).toBeGreaterThan(0)
}

/**
 * 等图形的位置稳定：连续两帧读到的值相同。data-rendered 表示当前选项画完，但负载高时可能先读到上一次渲染完成的标记，
 * 随后的更新又让图形动起来；悬停、点击前用它确认要指向的图形已经停在最终位置。
 */
export async function settled(read: () => string) {
  await expect
    .poll(
      async () => {
        const before = read()
        await nextFrame()
        await nextFrame()
        return before === read()
      },
      { timeout: 5000 },
    )
    .toBe(true)
}

/** 当前可见的图表提示（ECharts 隐藏提示时把容器设为不可见）。 */
export function visibleTooltip(): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>('[data-vl-chart-tooltip]')) {
    const box = el.parentElement as HTMLElement
    const s = css(box)
    if (s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0.5) return el
  }
  return null
}

/** 表格视图：表头文字与各行单元格的文字。 */
export function tableView(root: Element = document.body) {
  const view = root.querySelector('[data-view="table"]')
  if (!view) return null
  const headers = [...view.querySelectorAll('thead th')].map((th) => th.textContent ?? '')
  const cells = [...view.querySelectorAll('tbody tr:not([aria-hidden])')]
    .filter((tr) => !tr.className.includes('measure'))
    .map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent ?? ''))
  return { view: view as HTMLElement, headers, cells }
}

/** 填充色块（柱、扇区、格子）的颜色：有填充、不透明的路径（不含透明的命中区域与背景）。 */
export function fills(el: HTMLElement): string[] {
  return [...el.querySelectorAll('path')]
    .map((p) => p.getAttribute('fill') ?? '')
    .filter((f) => f && f !== 'none' && f !== 'transparent' && !/rgba\([^)]*,\s*0\)/.test(f))
}

/** 图形区域内某个元素中心相对视口的坐标（用于把指针移到柱、点上）。 */
export function centerOf(el: Element): { x: number; y: number } {
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}
