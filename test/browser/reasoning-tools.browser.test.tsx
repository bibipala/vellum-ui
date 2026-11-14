/**
 * Reasoning 与 ToolCalls（基于 Ant Design X 的 Think、ThoughtChain）在真实浏览器中的行为：
 * - 标题是按钮：Tab 聚焦显示焦点环，Enter / 空格切换，aria-expanded 与 aria-controls 正确，悬停有状态层；
 * - Reasoning：思考中自动展开、完成后自动收起，用户手动切换过就不再自动改变；用时（传入或测量）；
 * - ToolCalls：状态是图标 + 文字，进行中的图标旋转；详情默认收起，展开后用 CodeBlock 显示 JSON；失败原因直接显示；
 * - 减少动态效果：展开没有动画，加载指示不旋转。
 */
import { describe, expect, it } from 'vitest'
import { Reasoning, ToolCalls } from '../../src/index.ts'
import {
  css,
  expectFocusRing,
  focused,
  ms,
  page,
  parkPointer,
  render,
  sameColor,
  token,
  userEvent,
} from './render.tsx'

const button = (testId: string) =>
  page.getByTestId(testId).element().querySelector('button') as HTMLButtonElement
const controlled = (b: Element) => document.getElementById(b.getAttribute('aria-controls') ?? '')
const visible = (el: Element | null) => Boolean(el && (el as HTMLElement).offsetParent !== null)

/** 点击标题后，折叠动画元素（X 的 motion-collapse）上的高度过渡时长（毫秒）。 */
async function collapseDuration(b: HTMLButtonElement): Promise<number> {
  // 折叠动画的类名只在动画期间存在（「减少动态效果」时只有 1ms）：在 DOM 变化的当下读取，不靠轮询
  const durationOf = (el: HTMLElement) => {
    const s = css(el)
    const props = s.transitionProperty.split(',').map((p) => p.trim())
    const durations = s.transitionDuration.split(',').map((d) => d.trim())
    const i = props.indexOf('height')
    return ms(durations[i] ?? durations[0] ?? '')
  }
  let found: number | undefined
  const observer = new MutationObserver(() => {
    const el = document.querySelector<HTMLElement>('[class*="motion-collapse"]')
    if (el && found === undefined) found = durationOf(el)
  })
  observer.observe(document.body, { subtree: true, childList: true, attributes: true })
  try {
    await userEvent.click(b)
    await expect.poll(() => found).not.toBeUndefined()
  } finally {
    observer.disconnect()
  }
  return found as number
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
    const content = controlled(b)?.parentElement as Element
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
    const view = await render(<Reasoning thinking testId="r" />)
    await new Promise((r) => setTimeout(r, 1600))
    await view.rerender(<Reasoning testId="r" />)
    await expect.poll(() => button('r').textContent).toBe('Thought for 2s')
  })

  it('键盘：Tab 聚焦整行显示焦点环，Enter / 空格切换；手动切换后不再自动展开或收起', async () => {
    const view = await render(
      <Reasoning duration={3000} testId="r">
        Hidden at first
      </Reasoning>,
    )
    const b = button('r')
    const header = b.closest('[class*="think-status-wrapper"]') as HTMLElement
    expect(b.getAttribute('aria-expanded')).toBe('false')
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
    const header = b.closest('[class*="think-status-wrapper"]') as HTMLElement
    const rest = css(header).backgroundColor
    await userEvent.hover(b)
    await expect
      .poll(() => sameColor(css(header).backgroundColor, token('color-fill-hover')))
      .toBe(true)
    expect(css(header).backgroundColor).not.toBe(rest)
    await parkPointer()
    await expect.poll(() => css(header).backgroundColor).toBe(rest)
  })

  it('减少动态效果：展开没有动画，加载指示不旋转', async () => {
    await render(
      <Reasoning thinking testId="r">
        Thoughts
      </Reasoning>,
      { reducedMotion: true },
    )
    const spin = page.getByTestId('r').element().querySelector('.lucide-loader-circle')
    expect(ms(css(spin?.parentElement as Element).animationDuration)).toBe(0)
    // 折叠动画的过渡时长取本库的弹簧令牌（X 的折叠动画原本取 antd 的 motionDurationMid）：减少动态效果时为 0，
    // 至少 1ms 以便状态机收到过渡结束
    expect(await collapseDuration(button('r'))).toBeLessThanOrEqual(1)
  })

  it('不减少动态效果时，折叠动画沿弹簧（motion-duration-spring、motion-ease-spring）', async () => {
    await render(
      <Reasoning thinking testId="r">
        Thoughts
      </Reasoning>,
    )
    expect(await collapseDuration(button('r'))).toBe(ms(token('motion-duration-spring')))
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
    // X 自带的展开图标（另一套图标风格）不显示
    for (const svg of svgs.filter((e) => !e.classList.contains('lucide')))
      expect(visible(svg.closest('[class*="collapse-icon"]') ?? svg)).toBe(false)
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

  it('悬停：标题按钮叠加状态层', async () => {
    await render(<ToolCalls testId="tc" items={items} />)
    const b = page.getByTestId('tc').element().querySelector('button') as HTMLElement
    await userEvent.hover(b)
    await expect.poll(() => sameColor(css(b).backgroundColor, token('color-fill-hover'))).toBe(true)
  })

  it('减少动态效果：进行中的图标不旋转，展开详情没有动画', async () => {
    await render(<ToolCalls testId="tc" items={items} />, { reducedMotion: true })
    const root = page.getByTestId('tc').element()
    const running = root.querySelector('span[data-status="running"]:has(svg)') as Element
    expect(ms(css(running).animationDuration)).toBe(0)
    expect(
      await collapseDuration(root.querySelector('button') as HTMLButtonElement),
    ).toBeLessThanOrEqual(1)
  })

  it('不减少动态效果时，展开详情的动画沿弹簧（motion-duration-spring）', async () => {
    await render(<ToolCalls testId="tc" items={items} />)
    const root = page.getByTestId('tc').element()
    expect(await collapseDuration(root.querySelector('button') as HTMLButtonElement)).toBe(
      ms(token('motion-duration-spring')),
    )
  })
})
