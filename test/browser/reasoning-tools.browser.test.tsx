/**
 * Reasoning 与 ToolCalls 在真实浏览器中的行为：
 * - 标题是按钮：Tab 聚焦显示焦点环，Enter / 空格切换，aria-expanded 与 aria-controls 正确，悬停有状态层；
 * - 展开、收起：aria-controls 指向的面板高度沿弹簧过渡（motion-duration-spring、motion-ease-spring），收起后仍在 DOM 中，
 *   过渡结束后隐藏（visibility: hidden），读屏与 Tab 都跳过其中的内容；中途折返见 motion.browser.test.tsx；
 * - Reasoning：思考中自动展开、完成后自动收起，用户手动切换过就不再自动改变；用时（传入或测量）；
 * - ToolCalls：有序列表；状态是图标 + 文字，进行中的图标旋转；详情默认收起，展开后用 CodeBlock 显示 JSON；失败原因直接显示；
 * - 减少动态效果：展开、收起没有动画，加载指示不旋转。
 */
import { describe, expect, it, vi } from 'vitest'
import { Reasoning, ToolCalls } from '../../src/ai.ts'
import {
  css,
  expectFocusRing,
  focused,
  ms,
  page,
  parkPointer,
  pseudo,
  render,
  sameColor,
  sameEasing,
  token,
  transitionOf,
  userEvent,
} from './render.tsx'

const button = (testId: string) =>
  page.getByTestId(testId).element().querySelector('button') as HTMLButtonElement
/** 按钮展开、收起的面板（aria-controls 指向它）。 */
const controlled = (b: Element) => document.getElementById(b.getAttribute('aria-controls') ?? '')
/** 是否可见：在布局中，且没有被 visibility 隐藏（收起的面板仍在 DOM 中，过渡结束后 visibility: hidden）。 */
const visible = (el: Element | null) => Boolean(el?.checkVisibility({ visibilityProperty: true }))

/** 弹簧缓动令牌的计算值（浏览器规范化后的 linear()）。 */
function springEasing(): string {
  const probe = document.createElement('div')
  probe.style.transition = 'opacity 1s var(--vl-motion-ease-spring)'
  document.body.appendChild(probe)
  const easing = css(probe).transitionTimingFunction
  probe.remove()
  return easing
}

/** 面板高度（网格的行）过渡的时长（毫秒）与缓动。 */
function collapseMotion(panel: Element) {
  const s = css(panel)
  const props = s.transitionProperty.split(',').map((p) => p.trim())
  const easings = s.transitionTimingFunction.split(/,(?![^(]*\))/).map((e) => e.trim())
  return {
    duration: transitionOf(panel, 'grid-template-rows'),
    easing: easings[props.indexOf('grid-template-rows')] ?? '',
  }
}

describe('Reasoning', () => {
  it('思考中展开（加载指示与 Thinking）；完成后自动收起，显示用时', async () => {
    const view = await render(
      <Reasoning thinking testId="r">
        Step one, step two.
      </Reasoning>,
    )
    const b = button('r')
    expect(b.textContent).toBe('Thinking')
    expect(b.getAttribute('aria-expanded')).toBe('true')
    expect(controlled(b)?.textContent).toBe('Step one, step two.')
    expect(visible(controlled(b))).toBe(true)
    // 加载指示是旋转的图标（不是渐变、闪光）
    const spin = page.getByTestId('r').element().querySelector('.lucide-loader-circle')
    expect(spin).not.toBeNull()
    expect(css(spin?.parentElement as Element).animationName).not.toBe('none')
    // 内容是次要文字色
    const content = page.getByText('Step one, step two.').element()
    expect(sameColor(css(content).color, token('color-text-secondary'))).toBe(true)

    await view.rerender(
      <Reasoning duration={12_400} testId="r">
        Step one, step two.
      </Reasoning>,
    )
    expect(b.textContent).toBe('Thought for 12s')
    expect(b.getAttribute('aria-expanded')).toBe('false')
    await expect.poll(() => visible(controlled(b))).toBe(false)
    // 收起后内容节点仍在（aria-controls 指向它）
    expect(controlled(b)).not.toBeNull()
    expect(page.getByTestId('r').element().querySelector('.lucide-loader-circle')).toBeNull()
  })

  it('没有传入时长时测量 thinking 从开到关的时间', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(10_000)
    try {
      const view = await render(<Reasoning thinking testId="r" />)
      now.mockReturnValue(11_600)
      await view.rerender(<Reasoning testId="r" />)
      expect(button('r').textContent).toBe('Thought for 2s')
    } finally {
      now.mockRestore()
    }
  })

  it('键盘：Tab 聚焦整行显示焦点环，Enter / 空格切换；手动切换后不再自动展开或收起', async () => {
    const view = await render(
      <Reasoning duration={3000} testId="r">
        Hidden at first
      </Reasoning>,
    )
    const b = button('r')
    // 标题行（按钮所在的一行）：焦点环与悬停底色画在整行上
    const header = b.parentElement as HTMLElement
    expect(b.getAttribute('aria-expanded')).toBe('false')
    // 收起时面板仍在（aria-controls 指向它），只是隐藏
    expect(controlled(b)).not.toBeNull()
    expect(visible(controlled(b))).toBe(false)
    await userEvent.tab()
    expect(focused()).toBe(b)
    expectFocusRing(header, 2)
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => b.getAttribute('aria-expanded')).toBe('true')
    await expect.poll(() => visible(controlled(b))).toBe(true)
    expect(controlled(b)?.textContent).toBe('Hidden at first')
    await userEvent.keyboard(' ')
    await expect.poll(() => b.getAttribute('aria-expanded')).toBe('false')
    // 用户收起过：再次开始思考也不自动展开
    await view.rerender(
      <Reasoning thinking testId="r">
        Hidden at first
      </Reasoning>,
    )
    expect(b.getAttribute('aria-expanded')).toBe('false')
    await userEvent.click(b)
    await expect.poll(() => b.getAttribute('aria-expanded')).toBe('true')
    // 用户展开过：思考结束也不自动收起
    await view.rerender(
      <Reasoning duration={5000} testId="r">
        Hidden at first
      </Reasoning>,
    )
    expect(b.getAttribute('aria-expanded')).toBe('true')
  })

  it('悬停与按下：标题行叠加状态层', async () => {
    await render(<Reasoning duration={1000} testId="r" />)
    const b = button('r')
    const header = b.parentElement as HTMLElement
    const rest = css(header).backgroundColor
    await userEvent.hover(b)
    await expect
      .poll(() => sameColor(css(header).backgroundColor, token('color-fill-hover')))
      .toBe(true)
    expect(css(header).backgroundColor).not.toBe(rest)
    await parkPointer()
    await expect.poll(() => css(header).backgroundColor).toBe(rest)
  })

  it('减少动态效果：展开、收起没有动画（立即隐藏），加载指示不旋转', async () => {
    await render(
      <Reasoning thinking testId="r">
        Thoughts
      </Reasoning>,
      { reducedMotion: true },
    )
    const spin = page.getByTestId('r').element().querySelector('.lucide-loader-circle')
    expect(ms(css(spin?.parentElement as Element).animationDuration)).toBe(0)
    const b = button('r')
    expect(collapseMotion(controlled(b) as Element).duration).toBe(0)
    await userEvent.click(b)
    expect(b.getAttribute('aria-expanded')).toBe('false')
    await expect.poll(() => visible(controlled(b)), { timeout: 200 }).toBe(false)
  })

  it('不减少动态效果时，面板的高度沿弹簧过渡（motion-duration-spring、motion-ease-spring）', async () => {
    await render(
      <Reasoning thinking testId="r">
        Thoughts
      </Reasoning>,
    )
    const motion = collapseMotion(controlled(button('r')) as Element)
    expect(motion.duration).toBe(ms(token('motion-duration-spring')))
    expect(sameEasing(motion.easing, springEasing())).toBe(true)
  })

  it('读屏与键盘：按钮的名称是标题文字、带 aria-expanded；内容第一次展开时才渲染，再次收起后仍在但 Tab 跳过', async () => {
    await render(
      <>
        <Reasoning duration={4000}>
          See <a href="#source">the source</a>
        </Reasoning>
        <input aria-label="After" />
      </>,
    )
    const toggle = page.getByRole('button', { name: 'Thought for 4s' })
    const link = () => document.querySelector('a[href="#source"]')
    await expect.element(toggle).toHaveAttribute('aria-expanded', 'false')
    // 一开始就收起：面板在（aria-controls 指向它），内容还没有渲染
    expect(controlled(toggle.element())).not.toBeNull()
    expect(link()).toBeNull()
    await userEvent.tab()
    expect(focused()).toBe(toggle.element())
    await userEvent.keyboard('{Enter}')
    await expect.element(toggle).toHaveAttribute('aria-expanded', 'true')
    await userEvent.tab()
    expect(focused()).toBe(page.getByRole('link', { name: 'the source' }).element())
    // 再次收起：内容保留在 DOM 中，过渡结束后隐藏，Tab 从按钮直接到后面的输入框
    await userEvent.tab({ shift: true })
    await userEvent.keyboard(' ')
    await expect.element(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect.poll(() => visible(controlled(toggle.element()))).toBe(false)
    expect(link()).not.toBeNull()
    await userEvent.tab()
    expect(focused()).toBe(page.getByRole('textbox', { name: 'After' }).element())
  })
})

describe('ToolCalls', () => {
  const items = [
    {
      key: 'a',
      title: 'Search the web',
      status: 'success' as const,
      description: 'launch checklist',
      input: { query: 'launch checklist', limit: 3 },
      output: 'Found 3 results',
    },
    {
      key: 'b',
      title: 'Read file',
      status: 'error' as const,
      error: 'The file does not exist.',
    },
    { key: 'c', title: 'Summarize', status: 'running' as const, input: { length: 'short' } },
    { key: 'd', title: 'Send', status: 'pending' as const },
    { key: 'e', title: 'Notify', status: 'cancelled' as const },
  ]

  it('每步的状态是图标加文字；进行中的图标旋转；失败原因直接显示', async () => {
    await render(<ToolCalls testId="tc" items={items} />)
    const root = page.getByTestId('tc').element()
    const statuses = [...root.querySelectorAll('[data-status]')]
      .filter((e) => e.tagName === 'SPAN' && e.textContent)
      .map((e) => e.textContent)
    expect(statuses).toEqual(['Done', 'Failed', 'Running', 'Waiting', 'Cancelled'])
    const svgs = [...root.querySelectorAll('svg')]
    // 只有本库的图标（同一套图标风格）
    expect(svgs.every((e) => e.classList.contains('lucide'))).toBe(true)
    const icons = svgs
      .filter((e) => e.classList.contains('lucide'))
      .map((e) => [...e.classList].find((c) => c.startsWith('lucide-') && c !== 'lucide-icon'))
      .filter((c) => c !== 'lucide-chevron-right')
    expect(icons).toEqual([
      'lucide-circle-check',
      'lucide-circle-x',
      'lucide-loader-circle',
      'lucide-circle-dashed',
      'lucide-ban',
    ])
    const running = root.querySelector('span[data-status="running"]:has(svg)') as Element
    expect(css(running).animationName).not.toBe('none')
    expect(ms(css(running).animationDuration)).toBeGreaterThan(0)
    expect(page.getByText('The file does not exist.').element()).toBeTruthy()
    expect(visible(page.getByText('The file does not exist.').element())).toBe(true)
    // 没有详情的步骤不是按钮
    expect(root.querySelectorAll('button')).toHaveLength(2)
  })

  it('读屏：步骤是有序列表；按钮的名称含标题与状态，aria-controls 在第一次展开前就指向存在的详情面板', async () => {
    await render(<ToolCalls testId="tc" items={items} />)
    const list = page.getByRole('list')
    await expect.element(list).toBeInTheDocument()
    expect(list.element().tagName).toBe('OL')
    expect(page.getByRole('listitem').all()).toHaveLength(5)
    const toggle = page.getByRole('button', { name: 'Search the web Done' })
    await expect.element(toggle).toHaveAttribute('aria-expanded', 'false')
    const panel = controlled(toggle.element())
    expect(panel).not.toBeNull()
    expect(visible(panel)).toBe(false)
    // 键盘：Tab 在两个可以展开的步骤之间移动，空格展开第二个
    await userEvent.tab()
    await userEvent.tab()
    const second = page.getByRole('button', { name: 'Summarize Running' })
    expect(focused()).toBe(second.element())
    await userEvent.keyboard(' ')
    await expect.element(second).toHaveAttribute('aria-expanded', 'true')
    await expect.poll(() => visible(controlled(second.element()))).toBe(true)
    expect(toggle.element().getAttribute('aria-expanded')).toBe('false')
  })

  it('详情默认收起；键盘展开后用 CodeBlock 显示 JSON（可复制），再次切换收起', async () => {
    await render(<ToolCalls testId="tc" items={items} />)
    const [first] = page.getByTestId('tc').element().querySelectorAll('button')
    const b = first as HTMLButtonElement
    expect(b.textContent).toContain('Search the web')
    expect(b.getAttribute('aria-expanded')).toBe('false')
    expect(visible(controlled(b))).toBe(false)
    await userEvent.tab()
    expect(focused()).toBe(b)
    expectFocusRing(b, 2)
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => b.getAttribute('aria-expanded')).toBe('true')
    await expect.poll(() => visible(controlled(b))).toBe(true)
    const details = controlled(b) as HTMLElement
    const codes = [...details.querySelectorAll('pre')].map((p) => p.textContent)
    expect(codes).toEqual([
      JSON.stringify({ query: 'launch checklist', limit: 3 }, null, 2),
      'Found 3 results',
    ])
    expect(details.textContent).toContain('Input')
    expect(details.textContent).toContain('Output')
    expect(details.querySelectorAll('button[aria-label="Copy"]')).toHaveLength(2)
    await userEvent.keyboard(' ')
    await expect.poll(() => b.getAttribute('aria-expanded')).toBe('false')
    await expect.poll(() => visible(controlled(b))).toBe(false)
    expect(controlled(b)).not.toBeNull()
  })

  it('收起的详情不序列化：第一次展开时序列化一次；之后其他步骤变化不再序列化，收起时输出变化等展开再更新', async () => {
    let reads = 0
    // 很大的输出，以 toJSON 计数：只有序列化（JSON.stringify）调用它。不用取值器：开发模式下 React 为性能面板
    // 比较变化的属性时会读取对象的字段
    const result = (label: string) => ({
      toJSON: () => {
        reads++
        return Array.from({ length: 2000 }, (_, i) => ({ id: i, name: `${label} ${i}` }))
      },
    })
    const view = (output: unknown, next: 'running' | 'success') => (
      <ToolCalls
        testId="tc"
        items={[
          { key: 'query', title: 'Query the database', status: 'success', output },
          { key: 'next', title: 'Summarize', status: next },
        ]}
      />
    )
    const first = result('Row')
    const { rerender } = await render(view(first, 'running'))
    await rerender(view(first, 'success'))
    await rerender(view(first, 'running'))
    expect(reads).toBe(0)
    const b = button('tc')
    await userEvent.click(b)
    await expect.poll(() => b.getAttribute('aria-expanded')).toBe('true')
    await expect.poll(() => visible(controlled(b))).toBe(true)
    expect(reads).toBe(1)
    expect(controlled(b)?.textContent).toContain('"name": "Row 1999"')
    await rerender(view(first, 'success'))
    await userEvent.click(b)
    await expect.poll(() => b.getAttribute('aria-expanded')).toBe('false')
    await expect.poll(() => visible(controlled(b))).toBe(false)
    await rerender(view(first, 'running'))
    expect(reads).toBe(1)
    // 收起时输出换成新的：不序列化，再次展开时显示新的输出
    const second = result('Item')
    await rerender(view(second, 'success'))
    await rerender(view(second, 'running'))
    expect(reads).toBe(1)
    await userEvent.click(b)
    await expect.poll(() => b.getAttribute('aria-expanded')).toBe('true')
    await expect.poll(() => controlled(b)?.textContent).toContain('"name": "Item 1999"')
    expect(reads).toBe(2)
  })

  it('悬停：标题按钮叠加状态层', async () => {
    await render(<ToolCalls testId="tc" items={items} />)
    const b = page.getByTestId('tc').element().querySelector('button') as HTMLElement
    // 统一状态层（data-vl-state）：内容色（正文色）× 悬停透明度，即 color-fill-hover
    expect(b.hasAttribute('data-vl-state')).toBe(true)
    await userEvent.hover(b)
    await expect
      .poll(() => Number(pseudo(b, '::before').opacity))
      .toBe(Number(token('state-hover-opacity')))
    expect(sameColor(pseudo(b, '::before').backgroundColor, token('color-text-primary'))).toBe(true)
  })

  it('减少动态效果：进行中的图标不旋转，展开详情没有动画', async () => {
    await render(<ToolCalls testId="tc" items={items} />, { reducedMotion: true })
    const root = page.getByTestId('tc').element()
    const running = root.querySelector('span[data-status="running"]:has(svg)') as Element
    expect(ms(css(running).animationDuration)).toBe(0)
    const b = root.querySelector('button') as HTMLButtonElement
    expect(collapseMotion(controlled(b) as Element).duration).toBe(0)
    await userEvent.click(b)
    await expect.poll(() => visible(controlled(b)), { timeout: 200 }).toBe(true)
  })

  it('不减少动态效果时，展开详情的高度沿弹簧过渡（motion-duration-spring、motion-ease-spring）', async () => {
    await render(<ToolCalls testId="tc" items={items} />)
    const b = page.getByTestId('tc').element().querySelector('button') as HTMLButtonElement
    const motion = collapseMotion(controlled(b) as Element)
    expect(motion.duration).toBe(ms(token('motion-duration-spring')))
    expect(sameEasing(motion.easing, springEasing())).toBe(true)
  })
})
