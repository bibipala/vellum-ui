/**
 * 反馈类组件在真实浏览器中的位置、计时与动效（docs/11 §6.2「消息条」「不闪」）：
 * useMessage 底部居中、最多 3 条新的在下、默认 4 秒、悬停暂停、撤销可用鼠标与键盘、同 key 原地更新、error 用 role=alert；
 * Loading / PageSkeleton 挂载后 200ms 内不可见再淡入，immediate 直接显示；useDelayedPending 在真实组件中的行为；
 * ErrorState 的重试、Alert 的关闭可用键盘操作。
 */
import { useEffect, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import {
  Alert,
  ErrorState,
  Loading,
  type MessageApi,
  PageSkeleton,
  useDelayedPending,
  useMessage,
} from '../../src/index.ts'
import {
  clock,
  css,
  focused,
  ms,
  page,
  parkPointer,
  render,
  settle,
  token,
  useFakeTimers,
  userEvent,
} from './render.tsx'

let api: MessageApi
function Capture() {
  api = useMessage()
  return null
}

const messages = () => [...document.querySelectorAll<HTMLElement>('[data-kind]')]
const texts = () => messages().map((m) => m.textContent)
const active = () => messages().filter((m) => !m.hasAttribute('data-leaving'))
/** 在 act 之外调用消息接口后，等 React 提交。 */
const show = async (fn: () => void) => {
  fn()
  await settle()
}

describe('useMessage', () => {
  it('出现在视口底部居中（距底部 space-5），实色表面与浮起阴影', async () => {
    await render(<Capture />)
    await show(() => api.success('Saved'))
    const [msg] = messages()
    if (!msg) throw new Error('没有消息条')
    const r = msg.getBoundingClientRect()
    const vw = document.documentElement.clientWidth
    const vh = document.documentElement.clientHeight
    expect(Math.abs((r.left + r.right) / 2 - vw / 2)).toBeLessThan(1)
    await expect
      .poll(() => Math.round(vh - msg.getBoundingClientRect().bottom))
      .toBe(Number.parseFloat(token('space-5')))
    expect(css(msg).boxShadow).not.toBe('none')
    // 进入动画：从底部滑入，时长取令牌
    expect(css(msg).animationDuration).toBe(`${ms(token('motion-duration-base')) / 1000}s`)
  })

  it('最多 3 条，新的在下；超出时最早的一条离开', async () => {
    useFakeTimers()
    await render(<Capture />)
    for (const t of ['One', 'Two', 'Three']) await show(() => api.info(t))
    const tops = messages().map((m) => m.getBoundingClientRect().top)
    expect(texts()).toEqual(['One', 'Two', 'Three'])
    expect([...tops].sort((a, b) => a - b)).toEqual(tops)
    await show(() => api.info('Four'))
    expect(active().map((m) => m.textContent)).toEqual(['Two', 'Three', 'Four'])
    expect(messages()[0]?.textContent).toBe('One')
    expect(messages()[0]?.hasAttribute('data-leaving')).toBe(true)
    await settle(200)
    expect(texts()).toEqual(['Two', 'Three', 'Four'])
    const last = messages().at(-1)
    expect(last?.textContent).toBe('Four')
    for (const m of messages().slice(0, -1))
      expect(m.getBoundingClientRect().top).toBeLessThan(last?.getBoundingClientRect().top ?? 0)
  })

  it('默认 4 秒后关闭（先播放离开动画，再移除）', async () => {
    useFakeTimers()
    await render(<Capture />)
    await show(() => api.success('Saved'))
    await settle(3990)
    expect(active()).toHaveLength(1)
    await settle(20)
    expect(active()).toHaveLength(0)
    expect(messages()[0]?.hasAttribute('data-leaving')).toBe(true)
    await settle(200)
    expect(messages()).toHaveLength(0)
  })

  it('悬停时暂停计时，移开后从剩余时间继续', async () => {
    useFakeTimers()
    await render(<Capture />)
    const opened = clock()
    await show(() => api.success('Saved'))
    await settle(1000)
    // 悬停开始前已过 1 秒，剩余不到 3 秒（悬停命令本身也会推进假时钟，见 render.tsx 的 clock）
    await userEvent.hover(messages()[0] as HTMLElement)
    await settle(10_000)
    expect(active()).toHaveLength(1)
    const hoveredFor = opened.elapsed()
    await parkPointer()
    // 移开后还剩不到 3 秒：不会立即关闭，3 秒内一定关闭
    expect(active()).toHaveLength(1)
    await settle(3000)
    expect(active()).toHaveLength(0)
    expect(hoveredFor).toBeGreaterThan(4000)
  })

  it('undoable：默认显示 6 秒', async () => {
    useFakeTimers()
    await render(<Capture />)
    await show(() => api.undoable({ content: 'Moved to trash', onUndo: () => {} }))
    await settle(5990)
    expect(active()).toHaveLength(1)
    await settle(20)
    expect(active()).toHaveLength(0)
  })

  it('undoable：鼠标点击「撤销」立即关闭并调用 onUndo（连点只撤销一次见 message-store.test.ts）', async () => {
    const onUndo = vi.fn()
    await render(<Capture />)
    await show(() => api.undoable({ content: 'Moved to trash', onUndo }))
    await userEvent.click(page.getByRole('button', { name: 'Undo' }))
    await settle()
    expect(onUndo).toHaveBeenCalledOnce()
    expect(active()).toHaveLength(0)
  })

  it('undoable：Tab 聚焦「撤销」（聚焦期间暂停计时），Enter 或空格触发', async () => {
    useFakeTimers()
    const onUndo = vi.fn()
    const onUndo2 = vi.fn()
    await render(<Capture />)
    await show(() => api.undoable({ content: 'Archived', onUndo }))
    await userEvent.tab()
    expect(focused()).toBe(page.getByRole('button', { name: 'Undo' }).element())
    await settle(10_000)
    expect(active()).toHaveLength(1)
    await userEvent.keyboard('{Enter}')
    await settle()
    expect(onUndo).toHaveBeenCalledOnce()
    await settle(200)
    await show(() => api.undoable({ content: 'Archived again', onUndo: onUndo2 }))
    page.getByRole('button', { name: 'Undo' }).element().focus()
    await userEvent.keyboard(' ')
    await settle()
    expect(onUndo2).toHaveBeenCalledOnce()
  })

  it('同一个 key 原地更新：元素不变、不重新播放进入动画，并重新计时', async () => {
    useFakeTimers()
    await render(<Capture />)
    await show(() => api.loading({ content: 'Saving…', key: 'save', duration: 0 }))
    const el = messages()[0]
    expect(el?.dataset.kind).toBe('loading')
    await show(() => api.success({ content: 'Saved', key: 'save' }))
    expect(messages()).toHaveLength(1)
    expect(messages()[0]).toBe(el)
    expect(el?.dataset.kind).toBe('success')
    expect(el?.textContent).toBe('Saved')
    await settle(3990)
    expect(active()).toHaveLength(1)
    await settle(20)
    expect(active()).toHaveLength(0)
  })

  it('error 用 role="alert"（读屏立即播报），其余用 role="status"', async () => {
    await render(<Capture />)
    await show(() => api.error('Could not save'))
    await show(() => api.info('Synced'))
    await expect.element(page.getByRole('alert')).toHaveTextContent('Could not save')
    await expect.element(page.getByRole('status').filter({ hasText: 'Synced' })).toBeVisible()
    expect(page.getByRole('alert').element().getAttribute('aria-live')).toBeNull()
  })
})

/** 元素上的进场动画（pending-in），暂停后可按时间点检查透明度。 */
function pendingAnimation(el: Element): Animation {
  const anim = el.getAnimations().find((a) => a instanceof CSSAnimation)
  if (!anim) throw new Error('没有进场动画')
  anim.pause()
  return anim
}

describe('Loading 与 PageSkeleton', () => {
  it('挂载后 200ms 内不可见（opacity 0），之后淡入到 1', async () => {
    await render(
      <>
        <Loading testId="loading" />
        <PageSkeleton testId="skeleton" />
      </>,
    )
    const delay = ms(token('motion-delay-loading'))
    expect(delay).toBe(200)
    for (const id of ['loading', 'skeleton']) {
      const el = page.getByTestId(id).element()
      const anim = pendingAnimation(el)
      expect(ms(css(el).animationDelay), id).toBe(delay)
      anim.currentTime = 0
      expect(Number(css(el).opacity), `${id} 0ms`).toBe(0)
      anim.currentTime = delay - 10
      expect(Number(css(el).opacity), `${id} 190ms`).toBe(0)
      anim.currentTime = delay + ms(token('motion-duration-fast')) / 2
      const mid = Number(css(el).opacity)
      expect(mid, `${id} 淡入中`).toBeGreaterThan(0)
      expect(mid).toBeLessThan(1)
      anim.finish()
      expect(Number(css(el).opacity), `${id} 结束`).toBe(1)
    }
  })

  it('真实时间下：100ms 时仍不可见，过了延迟后可见', async () => {
    await render(<Loading testId="loading" />)
    const el = page.getByTestId('loading').element()
    await new Promise((r) => setTimeout(r, 100))
    expect(Number(css(el).opacity)).toBe(0)
    await expect.poll(() => Number(css(el).opacity)).toBe(1)
  })

  it('immediate：不延迟，直接淡入', async () => {
    await render(
      <>
        <Loading testId="loading" immediate />
        <PageSkeleton testId="skeleton" immediate />
      </>,
    )
    for (const id of ['loading', 'skeleton']) {
      const el = page.getByTestId(id).element()
      const anim = pendingAnimation(el)
      expect(ms(css(el).animationDelay), id).toBe(0)
      anim.currentTime = ms(token('motion-duration-fast')) / 2
      expect(Number(css(el).opacity), id).toBeGreaterThan(0)
    }
  })

  it('读屏读出「加载中」', async () => {
    await render(<Loading />)
    await expect.element(page.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  })
})

/** 模拟请求：`ms` 后完成。骨架按文档的写法：`isPending || showSkeleton`。 */
function SlowPage(props: { readonly ms: number }) {
  const [pending, setPending] = useState(true)
  const showSkeleton = useDelayedPending(pending)
  useEffect(() => {
    const t = setTimeout(() => setPending(false), props.ms)
    return () => clearTimeout(t)
  }, [props.ms])
  if (pending || showSkeleton) return <PageSkeleton testId="skeleton" />
  return <p data-testid="content">Loaded</p>
}

describe('useDelayedPending 在真实组件中', () => {
  it('很快完成（100ms）：骨架一直不可见，直接显示内容', async () => {
    useFakeTimers()
    await render(<SlowPage ms={100} />)
    const skeleton = page.getByTestId('skeleton').element()
    expect(Number(css(skeleton).opacity)).toBe(0)
    await settle(100)
    expect(page.getByTestId('skeleton').query()).toBeNull()
    expect(page.getByTestId('content').query()).not.toBeNull()
  })

  it('较慢（300ms）：200ms 后出现，请求结束后仍至少显示 400ms', async () => {
    useFakeTimers()
    await render(<SlowPage ms={300} />)
    await settle(199)
    expect(page.getByTestId('skeleton').query()).not.toBeNull()
    await settle(101)
    // 请求已在 300ms 结束；骨架从 200ms 开始显示，至少到 600ms
    expect(page.getByTestId('skeleton').query()).not.toBeNull()
    await settle(290)
    expect(page.getByTestId('skeleton').query()).not.toBeNull()
    await settle(20)
    expect(page.getByTestId('skeleton').query()).toBeNull()
    expect(page.getByTestId('content').query()).not.toBeNull()
  })
})

describe('ErrorState 与 Alert', () => {
  it('ErrorState：role=alert，「重试」可用键盘触发', async () => {
    const onRetry = vi.fn()
    await render(<ErrorState message="The server did not respond." onRetry={onRetry} />)
    await expect.element(page.getByRole('alert')).toMatchTextContent('The server did not respond.')
    await userEvent.tab()
    expect(focused()).toBe(page.getByRole('button', { name: 'Retry' }).element())
    await userEvent.keyboard('{Enter}')
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('Alert：可关闭时关闭按钮可用 Tab 聚焦、Enter 关闭', async () => {
    const onClose = vi.fn()
    await render(<Alert tone="warning" title="Storage is almost full" closable onClose={onClose} />)
    await userEvent.tab()
    const close = focused() as HTMLElement
    expect(close.tagName).toBe('BUTTON')
    await userEvent.keyboard('{Enter}')
    expect(onClose).toHaveBeenCalledOnce()
    await expect.poll(() => document.querySelector('.ant-alert')).toBeNull()
  })
})
