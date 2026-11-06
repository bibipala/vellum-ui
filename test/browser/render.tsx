/**
 * 浏览器组件测试的公共工具：在 ThemeProvider 与 App 中渲染组件，并加载组件库的样式。
 *
 * - 样式：源码中组件与 ThemeProvider 自己导入各自的 CSS（CSS Modules 与 base.css），这里再导入一次
 *   `styles.css`，与使用方的写法一致。不导入可选的 global.css：组件自己的焦点环、状态层不能依赖它。
 * - 每个测试结束后卸载、移除容器，把指针移到角落的停放区，并让焦点回到 body，互不影响。
 */
import '../../src/styles.css'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { App, ThemeProvider, type ThemeProviderProps } from '../../src/index.ts'

type ActEnv = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }

/**
 * 在 React 的 act 中执行（只在这期间打开 act 环境）：渲染与卸载同步完成。
 * 用户操作（userEvent）由浏览器真实派发，不包 act，结果用 expect.element / expect.poll 等待。
 */
export async function inAct(fn: () => void | Promise<void>): Promise<void> {
  const env = globalThis as ActEnv
  const previous = env.IS_REACT_ACT_ENVIRONMENT
  env.IS_REACT_ACT_ENVIRONMENT = true
  try {
    await act(async () => {
      await fn()
    })
  } finally {
    env.IS_REACT_ACT_ENVIRONMENT = previous
  }
}

interface Mounted {
  readonly root: Root
  readonly container: HTMLElement
}

const mounted = new Set<Mounted>()

/** render 的选项：ThemeProvider 的属性（默认浅色、舒适密度、en-US）。 */
export type RenderOptions = Omit<ThemeProviderProps, 'children'>

/** 渲染结果。 */
export interface RenderResult {
  /** 组件所在的容器（弹层、消息条渲染到 body，不在这里）。 */
  readonly container: HTMLElement
  /** 用新的内容重新渲染（保持组件状态）。 */
  rerender(ui: ReactNode): Promise<void>
  /** 卸载。 */
  unmount(): Promise<void>
}

function wrap(ui: ReactNode, options: RenderOptions) {
  return (
    <ThemeProvider defaultColorMode="light" locale="en-US" {...options}>
      <App>{ui}</App>
    </ThemeProvider>
  )
}

/** 在 ThemeProvider + App 中渲染。 */
export async function render(ui: ReactNode, options: RenderOptions = {}): Promise<RenderResult> {
  const container = document.createElement('div')
  container.dataset.testRoot = ''
  document.body.appendChild(container)
  const root = createRoot(container)
  const entry: Mounted = { root, container }
  mounted.add(entry)
  await inAct(() => root.render(wrap(ui, options)))
  return {
    container,
    rerender: (next) => inAct(() => root.render(wrap(next, options))),
    unmount: async () => {
      if (!mounted.delete(entry)) return
      await inAct(() => root.unmount())
      container.remove()
    },
  }
}

/** 指针停放区：每个测试结束后把指针移到这里，避免停在下一个测试的元素上而触发悬停。 */
function parking(): HTMLElement {
  let el = document.getElementById('pointer-park')
  if (!el) {
    el = document.createElement('div')
    el.id = 'pointer-park'
    el.setAttribute(
      'style',
      'position:fixed;right:0;bottom:0;width:8px;height:8px;z-index:2147483647;pointer-events:auto',
    )
    document.body.appendChild(el)
  }
  return el
}

/** 把指针移到角落（离开所有组件），等价于鼠标移出。 */
export async function parkPointer(): Promise<void> {
  await userEvent.hover(parking())
}

afterEach(async () => {
  // 测试中途失败时也恢复真实定时器，否则后续测试的弹层动画、指针操作会卡住
  vi.useRealTimers()
  for (const m of [...mounted]) {
    mounted.delete(m)
    await inAct(() => m.root.unmount())
    m.container.remove()
  }
  await parkPointer()
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
})

// —— 断言工具 ——

/** 元素的计算样式。 */
export const css = (el: Element) => getComputedStyle(el)

/** 伪元素的计算样式（统一状态层是 ::before）。 */
export const pseudo = (el: Element, which: '::before' | '::after') => getComputedStyle(el, which)

/** 读取根元素上的 CSS 变量（令牌）。 */
export function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--vl-${name}`).trim()
}

/** 把 CSS 颜色解析成 [r, g, b, a]（借助 canvas，兼容 oklch 等写法）。 */
export function rgba(color: string): [number, number, number, number] {
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) throw new Error('canvas 2d 不可用')
  ctx.fillStyle = '#000'
  ctx.fillStyle = color
  ctx.fillRect(0, 0, 1, 1)
  const [r = 0, g = 0, b = 0, a = 0] = ctx.getImageData(0, 0, 1, 1).data
  return [r, g, b, a]
}

/** 两个颜色是否相同（允许 1 的取整误差）。 */
export function sameColor(a: string, b: string): boolean {
  const x = rgba(a)
  const y = rgba(b)
  return x.every((v, i) => Math.abs(v - (y[i] ?? 0)) <= 1)
}

/** 以毫秒为单位的 CSS 时长（`0.12s`、`120ms`）；逗号分隔时取第一项。 */
export function ms(value: string): number {
  const first = value.split(',')[0]?.trim() ?? ''
  const n = Number.parseFloat(first)
  if (!Number.isFinite(n)) return Number.NaN
  return first.endsWith('ms') ? n : n * 1000
}

/** transition-property 中某个属性对应的时长（毫秒）；没有该属性时为 undefined。 */
export function transitionOf(el: Element, property: string, from: CSSStyleDeclaration = css(el)) {
  const props = from.transitionProperty.split(',').map((s) => s.trim())
  const durations = from.transitionDuration.split(',').map((s) => s.trim())
  const i = props.findIndex((p) => p === property || p === 'all')
  if (i < 0) return undefined
  return ms(durations[i % durations.length] ?? '')
}

/** 键盘焦点环：2px 实线、强调色（焦点环令牌），外扩 offset（px）。 */
export function expectFocusRing(el: Element, offset: number) {
  const s = css(el)
  expect(s.outlineStyle, 'outline-style').toBe('solid')
  expect(s.outlineWidth, 'outline-width').toBe('2px')
  expect(s.outlineOffset, 'outline-offset').toBe(`${offset}px`)
  expect(sameColor(s.outlineColor, token('color-focus-ring')), 'outline-color').toBe(true)
}

/** 没有焦点环（outline 为 none 或宽度为 0）。 */
export function expectNoFocusRing(el: Element) {
  const s = css(el)
  expect(s.outlineStyle === 'none' || s.outlineWidth === '0px', 'outline').toBe(true)
}

/**
 * 假定时器：只替换 setTimeout / clearTimeout / Date（组件的延迟与计时都用它们）。
 * requestAnimationFrame、微任务与 CSS 动画保持真实，弹层的进出动画照常完成，测试不依赖真实时间的长短。
 */
export function useFakeTimers() {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
  })
}

/** 推进假定时器（异步：期间让出事件循环，React 与浏览器事件得以处理）。 */
export const advance = (msValue: number) => vi.advanceTimersByTimeAsync(msValue)

/**
 * 推进假定时器后再等两帧（真实的 requestAnimationFrame），让 React 提交、样式生效，然后立即断言。
 * 判断「是否立即出现」时用它而不用 expect.poll：开着假定时器时，expect.poll 每次重试都会把假时钟推进 50ms，
 * 延迟 500ms 的提示也会在重试中「等到」。
 */
export async function settle(msValue = 0): Promise<void> {
  if (vi.isFakeTimers()) await vi.advanceTimersByTimeAsync(msValue)
  else if (msValue > 0) await new Promise((resolve) => setTimeout(resolve, msValue))
  await nextFrame()
}

/**
 * 计时起点：`to(n)` 把假时钟推进到「距起点 n 毫秒」再 settle。
 *
 * 开着假定时器时，Vitest 在 userEvent 命令执行期间按真实耗时推进假时钟（每 50ms 推进 50ms），交互本身会消耗时间。
 * 判断「还没到」时以交互之前为起点（事件发生在其后，距事件的时间不超过 n）；判断「已经到了」时以交互之后为起点
 * （距事件的时间不少于 n）。这样结论与交互的真实耗时无关。
 */
export function clock() {
  const start = Date.now()
  return {
    /** 距起点的毫秒数。 */
    elapsed: () => Date.now() - start,
    /** 推进到距起点 n 毫秒（已经超过时不推进）。 */
    to: (n: number) => settle(Math.max(0, n - (Date.now() - start))),
  }
}

/** 当前可见的提示气泡的文字（antd 关闭后的气泡带 `-hidden` 类，不计入）。 */
export function visibleTooltips(): string[] {
  return [...document.querySelectorAll('.ant-tooltip:not(.ant-tooltip-hidden)')].map(
    (el) => el.textContent ?? '',
  )
}

/** antd 弹层（下拉、选择器面板、气泡）是否处于打开状态：存在且没有 `-hidden` 类。 */
export function isOpen(selector: string): boolean {
  const el = document.querySelector(selector)
  return Boolean(el && ![...el.classList].some((c) => c.endsWith('-hidden')))
}

/** 在元素上按下鼠标左键并保持（`:active`），返回松开的函数。 */
export async function press(el: Element): Promise<() => Promise<void>> {
  await userEvent.hover(el)
  await userEvent.pointer({ keys: '[MouseLeft>]' })
  return () => userEvent.pointer({ keys: '[/MouseLeft]' })
}

/** 颜色的相对亮度（0–1，sRGB）。 */
export function luminance(color: string): number {
  const [r, g, b] = rgba(color).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0)
}

/** 等待下一帧（让样式与布局生效）。 */
export const nextFrame = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  )

/** 当前获得焦点的元素。 */
export const focused = () => document.activeElement

/** 页面定位器（从 vitest/browser 转出，测试文件只从这里导入）。 */
export { page, userEvent }
