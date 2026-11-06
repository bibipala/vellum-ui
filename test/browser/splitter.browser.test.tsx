/**
 * Splitter 在真实浏览器中的交互（WAI-ARIA Window Splitter）：
 * - 读屏语义：role="separator"、方向、aria-valuenow / min / max（最大值不超过容器）、aria-controls；
 * - 键盘：Tab 聚焦显示焦点环；方向键按 step（Shift 为 4 倍）；Home 收起到 min、End 展开到 max、Enter 切换；
 *   纵向与主窗格在后面时方向正确，从右到左的页面左右颠倒；
 * - 拖动：真实的鼠标（Playwright）产生指针事件，指针捕获后移出手柄也跟随，受 min / max 限制；
 *   悬停与拖动时的状态层；
 * - storageKey：挂载时恢复保存的尺寸，调整后保存。
 */
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Splitter, type SplitterProps } from '../../src/index.ts'
import { expectFocusRing, page, pseudo, render, settle, token, userEvent } from './render.tsx'

function Frame(props: Partial<SplitterProps> & { width?: number; dir?: 'ltr' | 'rtl' }) {
  const { width = 600, dir, ...rest } = props
  return (
    <div dir={dir} data-testid="frame" style={{ width, height: 300 }}>
      <Splitter aria-label="Resize the list" {...rest}>
        <div data-testid="first">First</div>
        <div data-testid="second">Second</div>
      </Splitter>
    </div>
  )
}

function Controlled() {
  const [size, setSize] = useState(150)
  return (
    <>
      <Frame size={size} onSizeChange={setSize} />
      <output>{size}</output>
    </>
  )
}

const handle = () =>
  page.getByRole('separator', { name: 'Resize the list' }).element() as HTMLElement
const now = () => Number(handle().getAttribute('aria-valuenow'))
const paneWidth = (testId: string) =>
  (page.getByTestId(testId).element().parentElement as HTMLElement).getBoundingClientRect().width
const paneHeight = (testId: string) =>
  (page.getByTestId(testId).element().parentElement as HTMLElement).getBoundingClientRect().height

afterEach(() => {
  localStorage.removeItem('test.splitter')
})

describe('Splitter：语义与键盘', () => {
  it('分隔条的读屏语义：方向、当前值、范围（最大值不超过容器）、控制的窗格', async () => {
    await render(<Frame defaultSize={200} min={120} />)
    const h = handle()
    expect(h.getAttribute('aria-orientation')).toBe('vertical')
    expect(now()).toBe(200)
    expect(h.getAttribute('aria-valuemin')).toBe('120')
    // 600 宽的容器减去 8px 的手柄
    expect(h.getAttribute('aria-valuemax')).toBe('592')
    const controlled = document.getElementById(h.getAttribute('aria-controls') ?? '')
    expect(controlled?.contains(page.getByTestId('first').element())).toBe(true)
    expect(paneWidth('first')).toBe(200)
    expect(paneWidth('second')).toBe(392)
  })

  it('Tab 聚焦显示焦点环；→ / ← 按 step 调整，Shift 为 4 倍；Home 收起到 min，End 展开到 max，Enter 在收起与之前的尺寸之间切换', async () => {
    const onSizeChange = vi.fn()
    await render(
      <>
        <input aria-label="Before" />
        <Frame defaultSize={200} min={100} max={400} onSizeChange={onSizeChange} />
      </>,
    )
    await userEvent.click(page.getByRole('textbox', { name: 'Before' }))
    await userEvent.tab()
    expect(document.activeElement).toBe(handle())
    expectFocusRing(handle(), 2)
    await userEvent.keyboard('{ArrowRight}')
    expect(now()).toBe(216)
    await userEvent.keyboard('{Shift>}{ArrowRight}{/Shift}')
    expect(now()).toBe(280)
    await userEvent.keyboard('{ArrowLeft}')
    expect(now()).toBe(264)
    expect(paneWidth('first')).toBe(264)
    await userEvent.keyboard('{End}')
    expect(now()).toBe(400)
    await userEvent.keyboard('{ArrowRight}')
    expect(now()).toBe(400)
    await userEvent.keyboard('{Home}')
    expect(now()).toBe(100)
    await userEvent.keyboard('{Enter}')
    expect(now()).toBe(400)
    await userEvent.keyboard('{Enter}')
    expect(now()).toBe(100)
    expect(onSizeChange.mock.calls.map(([n]) => n)).toEqual([216, 280, 264, 400, 100, 400, 100])
  })

  it('纵向、主窗格在后面：↑ 增大底部窗格；从右到左的页面中 ← 增大第一个窗格', async () => {
    const view = await render(<Frame direction="vertical" primary="end" defaultSize={100} />)
    expect(handle().getAttribute('aria-orientation')).toBe('horizontal')
    handle().focus()
    await userEvent.keyboard('{ArrowUp}')
    expect(now()).toBe(116)
    expect(paneHeight('second')).toBe(116)
    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    expect(now()).toBe(84)
    await view.unmount()
    await render(<Frame dir="rtl" defaultSize={200} />)
    handle().focus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(now()).toBe(216)
  })

  it('受控：尺寸来自 size，onSizeChange 报告新值', async () => {
    await render(<Controlled />)
    handle().focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(now()).toBe(166)
    expect(document.querySelector('output')?.textContent).toBe('166')
  })
})

describe('Splitter：拖动', () => {
  it('悬停叠加状态层；按住拖动跟随指针（移出手柄也跟随），拖动时保持按下的深度；受 min / max 限制', async () => {
    const onSizeChange = vi.fn()
    await render(<Frame defaultSize={200} min={150} max={450} onSizeChange={onSizeChange} />)
    const h = handle()
    const layer = () => Number(pseudo(h, '::before').opacity)
    await userEvent.hover(h)
    await expect.poll(layer).toBeCloseTo(Number(token('state-hover-opacity')), 2)
    await userEvent.pointer({ keys: '[MouseLeft>]' })
    await expect.poll(() => h.hasAttribute('data-dragging')).toBe(true)
    expect(layer()).toBeCloseTo(Number(token('state-press-opacity')), 2)
    const frame = page.getByTestId('frame')
    // 手柄中心在 x = 204；移到 x = 304（第二个窗格上方）
    await userEvent.hover(frame, { position: { x: 304, y: 150 } })
    await expect.poll(now).toBe(300)
    expect(h.hasAttribute('data-dragging')).toBe(true)
    expect(layer()).toBeCloseTo(Number(token('state-press-opacity')), 2)
    // 超过 max、低于 min 时停在边界
    await userEvent.hover(frame, { position: { x: 590, y: 150 } })
    await expect.poll(now).toBe(450)
    await userEvent.hover(frame, { position: { x: 20, y: 150 } })
    await expect.poll(now).toBe(150)
    await userEvent.hover(frame, { position: { x: 254, y: 150 } })
    await expect.poll(now).toBe(250)
    await userEvent.pointer({ keys: '[/MouseLeft]' })
    await expect.poll(() => h.hasAttribute('data-dragging')).toBe(false)
    expect(paneWidth('first')).toBe(250)
    expect(onSizeChange).toHaveBeenLastCalledWith(250)
    // 拖动后焦点在手柄上，但鼠标操作不显示焦点环
    expect(document.activeElement).toBe(h)
    expect(h.matches(':focus-visible')).toBe(false)
  })
})

describe('Splitter：storageKey', () => {
  it('挂载时恢复保存的尺寸；键盘调整与拖动后保存', async () => {
    localStorage.setItem('test.splitter', '320')
    const view = await render(<Frame storageKey="test.splitter" defaultSize={200} />)
    expect(now()).toBe(320)
    expect(paneWidth('first')).toBe(320)
    handle().focus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(localStorage.getItem('test.splitter')).toBe('304')
    await view.unmount()
    await render(<Frame storageKey="test.splitter" defaultSize={200} />)
    expect(now()).toBe(304)
    await userEvent.hover(handle())
    await userEvent.pointer({ keys: '[MouseLeft>]' })
    // 手柄中心在 x = 308（304 + 手柄宽度的一半），向右拖 100
    await userEvent.hover(page.getByTestId('frame'), { position: { x: 408, y: 100 } })
    await userEvent.pointer({ keys: '[/MouseLeft]' })
    await settle()
    expect(localStorage.getItem('test.splitter')).toBe('404')
  })

  it('保存的值无效时用默认尺寸', async () => {
    localStorage.setItem('test.splitter', 'wide')
    await render(<Frame storageKey="test.splitter" defaultSize={210} />)
    expect(now()).toBe(210)
  })
})
