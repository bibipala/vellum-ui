/**
 * 流式动效（docs/zh-CN/guides/motion.md）：在真实浏览器中控制真实 CSS 过渡的进度。
 * - 弹层（下拉、选择器、气泡、对话框）从触发元素一侧长出、沿弹簧过渡；打开到一半就关闭时从当前状态折返；
 *   「减少动态效果」时立即开关，状态机不会停在离场中。
 * - Lightbox 关闭时淡出再卸载，可以折返；换图时轨道沿弹簧连续滑动，途中可以继续换。
 * - 展开、收起的高度沿弹簧变化，可以中途折返。
 * - Nav 的选中浅底沿弹簧滑到新的当前项；布局变化时立即跟上。
 * - 标签页切换时新内容淡入上移、旧内容淡出，旧内容不接收指针。
 * 测试暂停真实过渡并定位进度；放慢时长只给状态机留出完成清理的余量（曲线不变）。
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
import { pauseTransition } from './animation.ts'
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

/** 元素当前的缩放（transform 矩阵的 a，没有变换时为 1） */
const scaleOf = (el: Element) => {
  const t = css(el).transform
  return t === 'none' ? 1 : new DOMMatrix(t).a
}
const opacityOf = (el: Element) => Number(css(el).opacity)

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
    const entering = await pauseTransition(dropdownEl, 'transform', () => rerender(dropdown(true)))
    entering.at(0.01)
    const el = dropdownEl() as Element
    expect(opacityOf(el), '已经开始出现').toBeGreaterThan(0)
    expect(scaleOf(el), '起始时小于原样').toBeLessThan(0.99)
    expect(scaleOf(el)).toBeGreaterThanOrEqual(0.95)
    // 按真实过渡的进度采样：逐步放大，不缩回去。
    let previous = scaleOf(el)
    for (const progress of [0.1, 0.25, 0.5, 0.75, 1]) {
      entering.at(progress)
      expect(scaleOf(el)).toBeGreaterThanOrEqual(previous - 0.001)
      previous = scaleOf(el)
    }
    // 默认在按钮下方左对齐：原点是左上角
    expect(css(dropdownEl() as Element).transformOrigin).toBe('0px 0px')
    expect(scaleOf(el)).toBe(1)
    expect(opacityOf(el)).toBe(1)
    entering.play()
  })

  it('打开到一半就关闭：从当前状态淡出，不先跳到完全打开；结束后隐藏', async () => {
    slow()
    const { rerender } = await render(dropdown(false))
    const entering = await pauseTransition(dropdownEl, 'opacity', () => rerender(dropdown(true)))
    entering.at(0.2)
    const el = dropdownEl() as Element
    const before = opacityOf(el)
    expect(before, '已经开始进场').toBeGreaterThan(0)
    expect(before, '还在进场中').toBeLessThan(0.98)
    const exiting = await pauseTransition(dropdownEl, 'opacity', () => rerender(dropdown(false)))
    exiting.at(0)
    expect(opacityOf(el), '从被打断的透明度开始，没有先跳到完全打开').toBeCloseTo(before, 4)
    exiting.at(0.5)
    expect(opacityOf(el), '已经折返、开始淡出').toBeLessThan(before)
    expect(css(el).pointerEvents, '离场中不接收指针').toBe('none')
    exiting.at(0)
    exiting.play()
    await expect.poll(() => isOpen('.ant-dropdown'), { timeout: 3000 }).toBe(false)
  })

  it('关闭后再次打开仍然从起始状态长出', async () => {
    const { rerender } = await render(dropdown(true))
    await expect.poll(() => scaleOf(dropdownEl() as Element)).toBe(1)
    await rerender(dropdown(false))
    await expect.poll(() => isOpen('.ant-dropdown')).toBe(false)
    slow()
    const entering = await pauseTransition(dropdownEl, 'transform', () => rerender(dropdown(true)))
    entering.at(0.01)
    expect(opacityOf(dropdownEl() as Element)).toBeGreaterThan(0)
    expect(scaleOf(dropdownEl() as Element)).toBeLessThan(0.99)
    entering.play()
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
    const popup = () => document.querySelector('.ant-popover')
    const entering = await pauseTransition(popup, 'transform', () => rerender(popover(true)))
    entering.at(0.2)
    const el = popup() as Element
    const before = scaleOf(el)
    expect(before).toBeLessThan(1)
    const exiting = await pauseTransition(popup, 'transform', () => rerender(popover(false)))
    exiting.at(0)
    expect(scaleOf(el), '从当前缩放开始退出').toBeCloseTo(before, 4)
    exiting.play()
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
    const modal = () => document.querySelector('.ant-modal')
    const entering = await pauseTransition(modal, 'transform', () => rerender(dialog(true)))
    entering.at(0.01)
    expect(opacityOf(modal() as Element)).toBeGreaterThan(0)
    expect(scaleOf(modal() as Element)).toBeLessThan(0.99)
    const exiting = await pauseTransition(modal, 'transform', () => rerender(dialog(false)))
    exiting.at(0)
    exiting.play()
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
const dialogEl = () => document.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]')
/** 背景层（对话框的第一个子元素）：进出场的淡入淡出在它上面，图片与工具栏各自淡出 */
const backdrop = () => (dialogEl()?.firstElementChild as HTMLElement | null) ?? null
/** 轨道：当前项与前后各一项并排放在上面，换图时整体滑动 */
const track = () => dialogEl()?.querySelector('[data-current]')?.parentElement ?? null
const trackX = () => {
  const t = css(track() as Element).transform
  return t === 'none' ? 0 : new DOMMatrix(t).e
}

describe('Lightbox 的进出场', () => {
  it('关闭时淡出（不再接收焦点与点击），淡出结束后卸载；关闭途中再次打开从当前状态折返', async () => {
    slow()
    const { rerender } = await render(viewer(true))
    await expect.poll(() => opacityOf(backdrop() as Element), { timeout: 3000 }).toBe(1)
    const exiting = await pauseTransition(backdrop, 'opacity', () => rerender(viewer(false)))
    exiting.at(0.2)
    const el = dialogEl() as HTMLElement
    expect(el, '关闭途中仍在页面上').not.toBeNull()
    expect(el.inert).toBe(true)
    expect(el.dataset.leaving, '没有缩略图：淡出').toBe('fade')
    const mid = opacityOf(backdrop() as Element)
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(1)
    const entering = await pauseTransition(backdrop, 'opacity', () => rerender(viewer(true)))
    entering.at(0)
    expect(opacityOf(backdrop() as Element), '从当前透明度折返').toBeCloseTo(mid, 4)
    entering.at(0.5)
    expect(opacityOf(backdrop() as Element), '折返：变得更不透明').toBeGreaterThan(mid)
    expect(dialogEl()?.inert).toBe(false)
    expect(dialogEl()?.dataset.leaving).toBeUndefined()
    const closing = await pauseTransition(backdrop, 'opacity', () => rerender(viewer(false)))
    closing.at(0)
    closing.play()
    await expect.poll(dialogEl, { timeout: 3000 }).toBeNull()
  })

  it('换图时轨道沿弹簧滑动：上一张先停在原处，再滑到新的一张；滑动途中可以继续换', async () => {
    slow()
    await render(<ViewerHarness />)
    await expect.poll(() => track() !== null).toBe(true)
    const width = (track()?.querySelector('[data-current]') as HTMLElement | null)?.offsetWidth ?? 0
    expect(trackX()).toBe(0)
    const next = () =>
      (page.getByRole('button', { name: 'Next' }).element() as HTMLButtonElement).click()
    const sliding = await pauseTransition(track, 'transform', next)
    sliding.at(0)
    const first = trackX()
    // 新的一张在右边一格：轨道从右边一格（加上间隙）的位置开始往回滑
    expect(first, '从上一张的位置开始').toBeGreaterThan(width * 0.5)
    sliding.at(0.25)
    const mid = trackX()
    expect(mid).toBeLessThan(first)
    expect(mid).toBeGreaterThan(0)
    // 途中再按一次：从当前位置再加一格，而不是跳回原位
    const continuing = await pauseTransition(track, 'transform', next)
    continuing.at(0)
    expect(trackX(), '从当前位置再加一格').toBeCloseTo(mid + first, 0)
    continuing.at(0.5)
    expect(trackX()).toBeGreaterThan(0)
    expect(trackX()).toBeLessThan(mid + first)
    continuing.play()
    await expect.poll(trackX, { timeout: 3000 }).toBeCloseTo(0, 0)
  })

  it('「减少动态效果」时立即卸载', async () => {
    const { rerender } = await render(viewer(true), { reducedMotion: true })
    await rerender(viewer(false))
    await expect.poll(dialogEl, { timeout: 200 }).toBeNull()
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
    const collapse = () => list().parentElement?.parentElement
    const expanding = await pauseTransition(collapse, 'grid-template-rows', toggle)
    expanding.at(0.2)
    const full = list().scrollHeight
    const mid = height()
    expect(mid, '展开到一半').toBeGreaterThan(0)
    expect(mid).toBeLessThan(full)
    const collapsing = await pauseTransition(collapse, 'grid-template-rows', toggle)
    collapsing.at(0)
    expect(height(), '从当前高度折返，没有跳到 0 或先展开到底').toBeCloseTo(mid, 1)
    collapsing.at(0.5)
    expect(height()).toBeGreaterThan(0)
    expect(height()).toBeLessThan(mid)
    collapsing.at(0)
    collapsing.play()
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
    const sliding = await pauseTransition(
      () => indicator,
      'transform',
      () => userEvent.click(target),
    )
    const end = target.element().getBoundingClientRect().top
    sliding.at(0)
    expect(top(), '没有瞬间跳到新的一项').toBeCloseTo(start, 1)
    let previous = start
    for (const progress of [0.1, 0.25, 0.5, 0.75]) {
      sliding.at(progress)
      expect(top()).toBeGreaterThanOrEqual(previous - 0.5)
      expect(top()).toBeLessThan(end)
      previous = top()
    }
    expect(top()).toBeGreaterThan(start)
    sliding.play()
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
    const panel = (text: string) =>
      [...document.querySelectorAll<HTMLElement>('[role="tabpanel"]')].find(
        (p) => p.textContent === text && css(p).display !== 'none',
      )
    const fading = await pauseTransition(
      () => panel('Members panel'),
      'opacity',
      () => userEvent.click(page.getByRole('tab', { name: 'Members' })),
    )
    fading.at(0.2)
    const entering = panel('Members panel') as HTMLElement
    expect(opacityOf(entering), '新内容正在淡入').toBeGreaterThan(0)
    expect(opacityOf(entering)).toBeLessThan(1)
    const y = new DOMMatrix(css(entering).transform).f
    expect(y, '新内容从下方上移').toBeGreaterThan(0)
    const leaving = panel('Overview panel')
    if (leaving) expect(css(leaving).pointerEvents).toBe('none')
    fading.play()
    await expect.poll(() => opacityOf(entering), { timeout: 3000 }).toBe(1)
    await expect.poll(() => panel('Overview panel'), { timeout: 3000 }).toBeUndefined()
  })
})
