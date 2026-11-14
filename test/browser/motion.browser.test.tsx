/**
 * 流式动效（docs/zh-CN/guides/motion.md）：在真实浏览器中逐帧观察。
 * - 弹层（下拉、选择器、气泡、对话框）从触发元素一侧长出、沿弹簧过渡；打开到一半就关闭时从当前状态折返；
 *   「减少动态效果」时立即开关，状态机不会停在离场中。
 * - Lightbox 关闭时淡出再卸载，可以折返；换图时新图从前进方向滑入。
 * - 展开、收起的高度沿弹簧变化，可以中途折返。
 * - Nav 的选中浅底沿弹簧滑到新的当前项；布局变化时立即跟上。
 * - 标签页切换时新内容淡入上移、旧内容淡出，旧内容不接收指针。
 * 为了在较慢的机器上也能看到动画中途的状态，测试把弹簧与离场的时长放慢（曲线不变）。
 */
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  Button,
  Dropdown,
  Lightbox,
  Modal,
  Nav,
  Popover,
  Select,
  Sources,
  Tabs,
} from '../../src/index.ts'
import { css, isOpen, ms, page, render, token, userEvent } from './render.tsx'

const root = document.documentElement
/** 放慢动效：弹簧 1200ms、离场 900ms */
function slow() {
  root.style.setProperty('--vl-motion-duration-spring', '1200ms')
  root.style.setProperty('--vl-motion-duration-fast', '900ms')
}
afterEach(() => {
  root.style.removeProperty('--vl-motion-duration-spring')
  root.style.removeProperty('--vl-motion-duration-fast')
})

const wait = (msValue: number) => new Promise((resolve) => setTimeout(resolve, msValue))
const frame = () => new Promise(requestAnimationFrame)
/** 元素当前的缩放（transform 矩阵的 a，没有变换时为 1） */
const scaleOf = (el: Element) => {
  const t = css(el).transform
  return t === 'none' ? 1 : new DOMMatrix(t).a
}
const opacityOf = (el: Element) => Number(css(el).opacity)

/** 连续若干帧记录元素的透明度与缩放 */
async function sample(get: () => Element | null, frames: number) {
  const out: { opacity: number; scale: number }[] = []
  for (let i = 0; i < frames; i++) {
    await frame()
    const el = get()
    if (el) out.push({ opacity: opacityOf(el), scale: scaleOf(el) })
  }
  return out
}

describe('弹簧令牌', () => {
  it('编译为 linear() 缓动与落定时长；回弹的那一条略微越过终点', () => {
    return render(<span />).then(() => {
      expect(token('motion-ease-spring')).toMatch(/^linear\(0, .+, 1\)$/)
      expect(ms(token('motion-duration-spring'))).toBeGreaterThan(150)
      const bounce = token('motion-ease-spring-bounce')
      const peak = Math.max(...[...bounce.matchAll(/([\d.]+) [\d.]+%/g)].map((m) => Number(m[1])))
      expect(peak).toBeGreaterThan(1.01)
      expect(peak).toBeLessThan(1.08)
    })
  })

  it('「减少动态效果」时弹簧时长为 0', async () => {
    await render(<span />, { reducedMotion: true })
    expect(ms(css(root).getPropertyValue('--vl-motion-duration-spring'))).toBe(0)
    expect(ms(css(root).getPropertyValue('--vl-motion-duration-spring-bounce'))).toBe(0)
  })
})

const menu = {
  items: [
    { key: 'edit', label: 'Edit' },
    { key: 'archive', label: 'Archive' },
  ],
}
const dropdown = (open: boolean) => (
  <Dropdown open={open} menu={menu}>
    <Button>More</Button>
  </Dropdown>
)
const dropdownEl = () => document.querySelector('.ant-dropdown')

describe('弹层的进出场', () => {
  it('下拉菜单从触发按钮一侧长出：起始时缩小、透明，原点在靠近按钮的角上，逐帧放大到原样', async () => {
    slow()
    const { rerender } = await render(dropdown(false))
    await rerender(dropdown(true))
    const frames = await sample(dropdownEl, 12)
    const first = frames.find((f) => f.opacity > 0)
    expect(first, '已经开始出现').toBeDefined()
    expect(first?.scale, '起始时小于原样').toBeLessThan(0.99)
    expect(first?.scale).toBeGreaterThanOrEqual(0.95)
    // 逐帧放大，不缩回去
    for (let i = 1; i < frames.length; i++) {
      expect(frames[i]?.scale).toBeGreaterThanOrEqual((frames[i - 1]?.scale ?? 0) - 0.001)
    }
    // 默认在按钮下方左对齐：原点是左上角
    expect(css(dropdownEl() as Element).transformOrigin).toBe('0px 0px')
    await expect.poll(() => scaleOf(dropdownEl() as Element), { timeout: 3000 }).toBe(1)
    expect(opacityOf(dropdownEl() as Element)).toBe(1)
  })

  it('打开到一半就关闭：从当前状态淡出，不先跳到完全打开；结束后隐藏', async () => {
    slow()
    const { rerender } = await render(dropdown(false))
    await rerender(dropdown(true))
    await wait(250)
    const el = dropdownEl() as Element
    const before = opacityOf(el)
    expect(before, '还在进场中').toBeLessThan(0.98)
    await rerender(dropdown(false))
    const frames = await sample(dropdownEl, 12)
    // 进场的势头会延续一两帧（状态机在下一帧才换上离场的目标），随后折返；不会跳到完全不透明
    const peak = Math.max(...frames.map((f) => f.opacity))
    expect(peak, '没有先跳到完全打开').toBeLessThan(Math.min(0.98, before + 0.15))
    expect(frames.at(-1)?.opacity, '已经折返、开始淡出').toBeLessThan(peak)
    expect(css(el).pointerEvents, '离场中不接收指针').toBe('none')
    await expect.poll(() => isOpen('.ant-dropdown'), { timeout: 3000 }).toBe(false)
  })

  it('关闭后再次打开仍然从起始状态长出', async () => {
    const { rerender } = await render(dropdown(true))
    await expect.poll(() => scaleOf(dropdownEl() as Element)).toBe(1)
    await rerender(dropdown(false))
    await expect.poll(() => isOpen('.ant-dropdown')).toBe(false)
    slow()
    await rerender(dropdown(true))
    const frames = await sample(dropdownEl, 6)
    expect(frames.find((f) => f.opacity > 0)?.scale).toBeLessThan(0.99)
  })

  it('选择器的弹层与触发元素等宽，从上沿的中点长出', async () => {
    slow()
    await render(<Select aria-label="Fruit" options={[{ value: 'a', label: 'Apple' }]} />)
    await userEvent.click(document.querySelector('.ant-select') as HTMLElement)
    await expect.poll(() => isOpen('.ant-select-dropdown')).toBe(true)
    const popup = document.querySelector('.ant-select-dropdown') as HTMLElement
    const [x, y] = css(popup).transformOrigin.split(' ').map(Number.parseFloat)
    expect(x).toBeCloseTo(Number.parseFloat(css(popup).width) / 2, 1)
    expect(y).toBe(0)
  })

  it('气泡卡片同样可以在进场中途关闭，并最终隐藏', async () => {
    slow()
    const popover = (open: boolean) => (
      <Popover open={open} content="Details">
        <Button>Info</Button>
      </Popover>
    )
    const { rerender } = await render(popover(false))
    await rerender(popover(true))
    await wait(200)
    const el = document.querySelector('.ant-popover') as Element
    expect(scaleOf(el)).toBeLessThan(1)
    await rerender(popover(false))
    await expect.poll(() => isOpen('.ant-popover'), { timeout: 3000 }).toBe(false)
  })

  it('对话框从点击的位置长出（原点由 antd 设为指针位置），关闭的过渡结束后卸载内容', async () => {
    slow()
    const dialog = (open: boolean) => (
      <Modal open={open} title="Rename" onCancel={() => {}}>
        Body
      </Modal>
    )
    const { rerender } = await render(dialog(false))
    await rerender(dialog(true))
    const modal = () => document.querySelector('.ant-modal')
    const frames = await sample(modal, 8)
    expect(frames.find((f) => f.opacity > 0)?.scale).toBeLessThan(0.99)
    await rerender(dialog(false))
    await expect.poll(modal, { timeout: 4000 }).toBeNull()
  })

  it('「减少动态效果」时立即打开、立即关闭（状态机不会停在离场中），对话框照常卸载内容', async () => {
    const ui = (open: boolean) => (
      <>
        {dropdown(open)}
        <Modal open={open} title="Rename" onCancel={() => {}}>
          Body
        </Modal>
      </>
    )
    const { rerender } = await render(ui(true), { reducedMotion: true })
    await expect.poll(() => opacityOf(dropdownEl() as Element), { timeout: 300 }).toBe(1)
    await rerender(ui(false))
    await expect.poll(() => isOpen('.ant-dropdown'), { timeout: 300 }).toBe(false)
    await expect.poll(() => document.querySelector('.ant-modal'), { timeout: 500 }).toBeNull()
  })
})

const swatch = (hue: number) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><rect width="40" height="30" fill="hsl(${hue} 60% 50%)"/></svg>`,
  )}`
const shots = [
  { id: 'a', src: swatch(20), alt: 'One' },
  { id: 'b', src: swatch(120), alt: 'Two' },
]
const viewer = (open: boolean, index = 0) => (
  <Lightbox open={open} items={shots} index={index} onClose={() => {}} />
)
const backdrop = () => document.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]')

describe('Lightbox 的进出场', () => {
  it('关闭时淡出（不再接收焦点与点击），淡出结束后卸载；关闭途中再次打开从当前状态折返', async () => {
    slow()
    const { rerender } = await render(viewer(true))
    await expect.poll(() => opacityOf(backdrop() as Element), { timeout: 3000 }).toBe(1)
    await rerender(viewer(false))
    await wait(150)
    const el = backdrop() as HTMLElement
    expect(el, '关闭途中仍在页面上').not.toBeNull()
    expect(el.inert).toBe(true)
    const mid = opacityOf(el)
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(1)
    await rerender(viewer(true))
    const frames = await sample(backdrop, 6)
    expect(frames.at(-1)?.opacity, '折返：变得更不透明').toBeGreaterThan(mid)
    expect(backdrop()?.inert).toBe(false)
    await rerender(viewer(false))
    await expect.poll(backdrop, { timeout: 3000 }).toBeNull()
  })

  it('用按钮换图时新图从前进方向一侧滑入；图片加载后才进场', async () => {
    await render(<ViewerHarness />)
    const img = () => backdrop()?.querySelector('img') as HTMLImageElement
    await expect.poll(() => img()?.hasAttribute('data-loaded')).toBe(true)
    expect(img().dataset.enter).toBeUndefined()
    await userEvent.click(page.getByRole('button', { name: 'Next' }))
    expect(img().alt).toBe('Two')
    expect(img().dataset.enter).toBe('next')
    await userEvent.click(page.getByRole('button', { name: 'Previous' }))
    expect(img().dataset.enter).toBe('prev')
    await expect.poll(() => opacityOf(img())).toBe(1)
  })

  it('「减少动态效果」时立即卸载', async () => {
    const { rerender } = await render(viewer(true), { reducedMotion: true })
    await rerender(viewer(false))
    await expect.poll(backdrop, { timeout: 200 }).toBeNull()
  })
})

function ViewerHarness() {
  const [index, setIndex] = useState(0)
  return <Lightbox open items={shots} index={index} onIndexChange={setIndex} onClose={() => {}} />
}

describe('展开与收起', () => {
  it('Sources 的列表高度沿弹簧展开，中途再点从当前高度折返', async () => {
    slow()
    await render(
      <Sources
        items={[
          { title: 'Guide', url: 'https://example.com/a', description: 'How to start' },
          { title: 'Notes', url: 'https://example.com/b', description: 'More details' },
        ]}
      />,
    )
    const button = page.getByRole('button', { name: '2 sources' })
    const list = () =>
      document.getElementById(button.element().getAttribute('aria-controls') ?? '') as HTMLElement
    const height = () => (list().parentElement as HTMLElement).getBoundingClientRect().height
    expect(height()).toBe(0)
    // 用 DOM 的 click（同步触发），不受测试驱动的延迟影响
    const toggle = () => (button.element() as HTMLButtonElement).click()
    toggle()
    await wait(200)
    const full = list().scrollHeight
    const mid = height()
    expect(mid, '展开到一半').toBeGreaterThan(0)
    expect(mid).toBeLessThan(full)
    toggle()
    const frames: number[] = []
    for (let i = 0; i < 10; i++) {
      await frame()
      frames.push(height())
    }
    // 从当前高度折返：既没有跳到 0，也没有先展开到底；随后逐帧变矮
    expect(frames[0], '没有直接跳到 0').toBeGreaterThan(0)
    expect(Math.max(...frames), '没有先展开到底').toBeLessThan(full - 0.5)
    expect(frames.at(-1)).toBeLessThan(Math.max(...frames))
    await expect.poll(height, { timeout: 3000 }).toBe(0)
    await expect.poll(() => css(list()).visibility, { timeout: 3000 }).toBe('hidden')
  })
})

const navItems = [
  { key: 'home', label: 'Home', icon: 'home' as const },
  { key: 'inbox', label: 'Inbox', icon: 'inbox' as const },
  { key: 'members', label: 'Members', icon: 'users' as const },
]
function NavHarness(props: { width?: number }) {
  const [value, setValue] = useState('home')
  return (
    <div style={{ width: props.width ?? 240 }}>
      <Nav items={navItems} value={value} onSelect={setValue} />
    </div>
  )
}

describe('Nav 的选中滑块', () => {
  it('当前项变化时滑块沿弹簧滑过去（逐帧靠近，不瞬间跳），最后与当前项重合', async () => {
    slow()
    await render(<NavHarness />)
    const indicator = document.querySelector('nav > span[aria-hidden="true"]') as HTMLElement
    const top = () => indicator.getBoundingClientRect().top
    const target = page.getByRole('button', { name: 'Members' })
    const start = top()
    await userEvent.click(target)
    const end = target.element().getBoundingClientRect().top
    const tops: number[] = []
    for (let i = 0; i < 6; i++) {
      await frame()
      tops.push(top())
    }
    expect(tops[0], '没有瞬间跳到新的一项').toBeLessThan(end - 1)
    for (let i = 1; i < tops.length; i++) {
      expect(tops[i]).toBeGreaterThanOrEqual((tops[i - 1] as number) - 0.5)
    }
    expect(tops.at(-1)).toBeGreaterThan(start)
    await expect.poll(top, { timeout: 3000 }).toBeCloseTo(end, 0)
  })

  it('导航的宽度变化时滑块立即跟上（不过渡）', async () => {
    slow()
    const { rerender } = await render(<NavHarness width={240} />)
    const indicator = document.querySelector('nav > span[aria-hidden="true"]') as HTMLElement
    await rerender(<NavHarness width={320} />)
    await expect.poll(() => Math.round(indicator.getBoundingClientRect().width)).toBe(320)
  })
})

describe('标签页切换内容', () => {
  const tabs = [
    { key: 'a', label: 'Overview', children: 'Overview panel' },
    { key: 'b', label: 'Members', children: 'Members panel' },
  ]
  it('新内容淡入并上移，旧内容淡出且不接收指针；结束后只剩新内容', async () => {
    slow()
    await render(<Tabs items={tabs} />)
    await userEvent.click(page.getByRole('tab', { name: 'Members' }))
    const panel = (text: string) =>
      [...document.querySelectorAll<HTMLElement>('[role="tabpanel"]')].find(
        (p) => p.textContent === text && css(p).display !== 'none',
      )
    await frame()
    const entering = panel('Members panel') as HTMLElement
    expect(opacityOf(entering), '新内容正在淡入').toBeLessThan(1)
    const leaving = panel('Overview panel')
    if (leaving) expect(css(leaving).pointerEvents).toBe('none')
    await expect.poll(() => opacityOf(entering), { timeout: 3000 }).toBe(1)
    await expect.poll(() => panel('Overview panel'), { timeout: 3000 }).toBeUndefined()
  })
})
