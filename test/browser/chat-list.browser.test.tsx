/**
 * 消息列表在真实浏览器中的行为（docs/11 §6.2「不跳」、§7「长聊天记录必须虚拟化」；ADR 0020 §3「消息列表的滚动」）：
 * 首次显示就在末端；新消息与正在增长的最后一条消息保持在末端；滚轮、键盘、拖动滚动条向上时暂停贴底并显示
 * 「回到最新」（带新消息数），按下后回到末端并恢复；自己滚回末端也恢复；顶部插入更早的消息时可见内容不动；
 * 减少动态效果时直接跳到末端；读屏属性（aria-busy、完成时播报一次）；DOM 节点数与消息数量无关。
 */
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Message, MessageList, type MessageListHandle } from '../../src/index.ts'
import { expectFocusRing, focused, nextFrame, page, render, userEvent } from './render.tsx'

interface Msg {
  readonly id: string
  readonly author: 'user' | 'assistant'
  readonly text: string
}

/** 高度各不相同的消息：每第 3 条较长。 */
const make = (n: number, offset = 0): Msg[] =>
  Array.from({ length: n }, (_, k) => {
    const i = k + offset
    return {
      id: `m${i}`,
      author: i % 2 ? 'assistant' : 'user',
      text: `Message ${i}. ${'Lorem ipsum dolor sit amet. '.repeat((i % 3) * 6 + 1)}`,
    }
  })

function Chat(props: {
  readonly items: readonly Msg[]
  readonly streaming?: boolean
  readonly listRef?: React.Ref<MessageListHandle>
  readonly onReachStart?: () => void
  readonly loadingStart?: boolean
}) {
  return (
    <div style={{ height: 480, width: 720 }}>
      <MessageList
        ref={props.listRef}
        items={props.items}
        getKey={(m) => m.id}
        streaming={props.streaming}
        onReachStart={props.onReachStart}
        loadingStart={props.loadingStart}
        renderItem={(m) => (
          <Message
            author={m.author}
            status={props.streaming && m.id === 'live' ? 'streaming' : 'done'}
          >
            {m.text}
          </Message>
        )}
      />
    </div>
  )
}

const scroller = () => document.querySelector('section[aria-label="Conversation"]') as HTMLElement
const distance = () => {
  const el = scroller()
  return el.scrollHeight - el.clientHeight - el.scrollTop
}
const jumpButton = () =>
  [...document.querySelectorAll('button')].find((b) =>
    b.textContent?.startsWith('Back to latest'),
  ) ?? null
const frames = async (n: number) => {
  for (let i = 0; i < n; i++) await nextFrame()
}
/** 等滚动停下：浏览器的滚轮滚动是动画，连续 5 帧位置不变才算停下。 */
async function still() {
  let last = Number.NaN
  let same = 0
  for (let i = 0; i < 200 && same < 5; i++) {
    await nextFrame()
    const top = scroller().scrollTop
    same = top === last ? same + 1 : 0
    last = top
  }
}
/** 某条消息相对滚动区顶部的位置。 */
const topOf = (text: string) => {
  const row = [...document.querySelectorAll('article')].find((a) => a.textContent?.startsWith(text))
  if (!row) return null
  return row.getBoundingClientRect().top - scroller().getBoundingClientRect().top
}

describe('MessageList', () => {
  it('首次显示就在末端，最后一条消息可见；DOM 中只有可见附近的消息', async () => {
    await render(<Chat items={make(200)} />)
    await expect.poll(distance).toBeLessThanOrEqual(1)
    await frames(3)
    expect(distance()).toBeLessThanOrEqual(1)
    expect(topOf('Message 199.')).not.toBeNull()
    expect(document.querySelectorAll('article').length).toBeLessThan(20)
  })

  it('消息在挂载之后才加载（先是空列表）：加载完成时同样停在末端', async () => {
    const { rerender } = await render(<Chat items={[]} />)
    await rerender(<Chat items={make(200)} />)
    await expect.poll(distance).toBeLessThanOrEqual(1)
    await frames(3)
    expect(distance()).toBeLessThanOrEqual(1)
    expect(topOf('Message 199.')).not.toBeNull()
  })

  it('正在流式增长的最后一条消息与新追加的消息都让列表保持在末端', async () => {
    const base = make(60)
    const { rerender } = await render(<Chat items={base} />)
    await expect.poll(distance).toBeLessThanOrEqual(1)
    let text = ''
    for (let i = 0; i < 40; i++) {
      text += `word${i} `.repeat(4)
      await rerender(
        <Chat items={[...base, { id: 'live', author: 'assistant', text }]} streaming />,
      )
      await nextFrame()
      expect(distance(), `第 ${i} 段之后`).toBeLessThanOrEqual(1)
    }
    await rerender(
      <Chat
        items={[...base, { id: 'live', author: 'assistant', text }, ...make(3, 900)]}
        streaming={false}
      />,
    )
    await frames(2)
    expect(distance()).toBeLessThanOrEqual(1)
    expect(topOf('Message 902.')).not.toBeNull()
  })

  it('滚轮向上暂停贴底：内容增长时视图不动，「回到最新」显示新消息数；按下后平滑回到末端并恢复', async () => {
    const base = make(80)
    const { rerender } = await render(<Chat items={base} />)
    await expect.poll(distance).toBeLessThanOrEqual(1)
    await userEvent.wheel(scroller(), { delta: { y: -600 } })
    await expect.poll(() => jumpButton()).not.toBeNull()
    await still()
    const top = scroller().scrollTop
    expect(distance()).toBeGreaterThan(24)
    // 暂停时：最后一条增长、追加新消息，视图都不动
    await rerender(<Chat items={[...base, ...make(2, 500)]} />)
    await frames(3)
    expect(Math.abs(scroller().scrollTop - top)).toBeLessThanOrEqual(1)
    await expect.poll(() => jumpButton()?.textContent).toBe('Back to latest2 new')
    await userEvent.click(jumpButton() as HTMLElement)
    await expect.poll(distance).toBeLessThanOrEqual(1)
    await expect.poll(() => jumpButton()).toBeNull()
    expect(focused()).toBe(scroller())
    // 恢复贴底：之后追加的消息仍然跟到末端
    await rerender(<Chat items={[...base, ...make(4, 500)]} />)
    await frames(2)
    expect(distance()).toBeLessThanOrEqual(1)
  })

  it('用户自己滚回末端也恢复贴底', async () => {
    const base = make(80)
    const { rerender } = await render(<Chat items={base} />)
    await expect.poll(distance).toBeLessThanOrEqual(1)
    await userEvent.wheel(scroller(), { delta: { y: -500 } })
    await expect.poll(() => jumpButton()).not.toBeNull()
    await userEvent.wheel(scroller(), { delta: { y: 5000 } })
    await expect.poll(() => jumpButton()).toBeNull()
    await still()
    await rerender(<Chat items={[...base, ...make(2, 500)]} />)
    await frames(2)
    expect(distance()).toBeLessThanOrEqual(1)
  })

  it('键盘：Tab 聚焦滚动区（焦点环向内收），Page Up 暂停；Tab 到「回到最新」按 Enter 回到末端，焦点回到列表', async () => {
    await render(<Chat items={make(80)} />)
    await expect.poll(distance).toBeLessThanOrEqual(1)
    await userEvent.tab()
    expect(focused()).toBe(scroller())
    expectFocusRing(scroller(), -2)
    await userEvent.keyboard('{PageUp}')
    await expect.poll(() => jumpButton()).not.toBeNull()
    expect(distance()).toBeGreaterThan(24)
    // 滚动区之后：消息中的可聚焦元素不在本例中，下一个 Tab 位置就是「回到最新」
    jumpButton()?.focus()
    await userEvent.keyboard('{Enter}')
    await expect.poll(distance).toBeLessThanOrEqual(1)
    expect(jumpButton()).toBeNull()
    expect(focused()).toBe(scroller())
  })

  it('拖动滚动条：按下即暂停，松开时不在末端保持暂停；拖回末端松开后恢复', async () => {
    const base = make(80)
    const { rerender } = await render(<Chat items={base} />)
    await expect.poll(distance).toBeLessThanOrEqual(1)
    const el = scroller()
    const rect = el.getBoundingClientRect()
    // 滚动条在内容区之外（无头浏览器的滚动条可能不占宽度：在内容区右边缘之外按下）
    const at = { clientX: rect.left + el.clientLeft + el.clientWidth + 1, clientY: rect.top + 40 }
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, ...at }))
    el.scrollTop -= 400
    await frames(2)
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, ...at }))
    await expect.poll(() => jumpButton()).not.toBeNull()
    const top = el.scrollTop
    await rerender(<Chat items={[...base, ...make(1, 500)]} />)
    await frames(2)
    expect(Math.abs(el.scrollTop - top)).toBeLessThanOrEqual(1)
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, ...at }))
    el.scrollTop = el.scrollHeight
    await frames(2)
    // 拖动中到了末端也不抢（新进入的消息测量后内容可能变高）：松开之后才恢复，并跟到真正的末端
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, ...at }))
    await expect.poll(() => jumpButton()).toBeNull()
    await expect.poll(distance).toBeLessThanOrEqual(1)
    await rerender(<Chat items={[...base, ...make(3, 500)]} />)
    await frames(2)
    expect(distance()).toBeLessThanOrEqual(1)
  })

  it('只在滚动条上按了一下（没有拖动）：松开后仍然贴底', async () => {
    const base = make(80)
    const { rerender } = await render(<Chat items={base} />)
    await expect.poll(distance).toBeLessThanOrEqual(1)
    const el = scroller()
    const rect = el.getBoundingClientRect()
    const at = {
      clientX: rect.left + el.clientLeft + el.clientWidth + 1,
      clientY: rect.bottom - 10,
    }
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, ...at }))
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, ...at }))
    await rerender(<Chat items={[...base, ...make(2, 500)]} />)
    await frames(2)
    expect(distance()).toBeLessThanOrEqual(1)
    expect(jumpButton()).toBeNull()
  })

  it('向上滚到顶部附近调用 onReachStart；在开头插入更早的消息后，可见的消息位置不变', async () => {
    const onReachStart = vi.fn()
    let items = make(30, 100)
    const { rerender } = await render(<Chat items={items} onReachStart={onReachStart} />)
    await expect.poll(distance).toBeLessThanOrEqual(1)
    await userEvent.wheel(scroller(), { delta: { y: -100_000 } })
    await expect.poll(() => onReachStart.mock.calls.length).toBeGreaterThan(0)
    await frames(2)
    const visible = [...document.querySelectorAll('article')].find(
      (a) => a.getBoundingClientRect().top >= scroller().getBoundingClientRect().top,
    )
    const label = visible?.textContent?.slice(0, 12) ?? ''
    expect(label).toMatch(/^Message 10\d/)
    const before = topOf(label)
    items = [...make(20, 0), ...items]
    await rerender(<Chat items={items} onReachStart={onReachStart} loadingStart />)
    expect(page.getByRole('status').filter({ hasText: 'Loading earlier messages' })).toBeTruthy()
    await frames(3)
    expect(Math.abs((topOf(label) ?? Number.NaN) - (before ?? 0))).toBeLessThanOrEqual(1)
    // 加载中不再调用
    const calls = onReachStart.mock.calls.length
    await userEvent.wheel(scroller(), { delta: { y: -50 } })
    await frames(2)
    expect(onReachStart.mock.calls.length).toBe(calls)
  })

  it('减少动态效果：「回到最新」直接跳到末端（下一帧就到）', async () => {
    await render(<Chat items={make(120)} />, { reducedMotion: true })
    await expect.poll(distance).toBeLessThanOrEqual(1)
    await userEvent.wheel(scroller(), { delta: { y: -2000 } })
    await expect.poll(() => jumpButton()).not.toBeNull()
    ;(jumpButton() as HTMLElement).click()
    await frames(2)
    expect(distance()).toBeLessThanOrEqual(1)
  })

  it('ref：scrollToIndex 离开末端即暂停，scrollToEnd 回到末端并恢复', async () => {
    const ref = createRef<MessageListHandle>()
    await render(<Chat items={make(100)} listRef={ref} />)
    await expect.poll(distance).toBeLessThanOrEqual(1)
    expect(ref.current?.isAtEnd()).toBe(true)
    ref.current?.scrollToIndex(10)
    await expect.poll(() => jumpButton()).not.toBeNull()
    expect(ref.current?.isAtEnd()).toBe(false)
    ref.current?.scrollToEnd()
    await expect.poll(distance).toBeLessThanOrEqual(1)
    await expect.poll(() => jumpButton()).toBeNull()
  })

  it('读屏：列表不是实时区域；生成中 aria-busy，完成时状态区读一次这条回复', async () => {
    const base = make(5)
    const { rerender } = await render(
      <Chat items={[...base, { id: 'live', author: 'assistant', text: 'Partial' }]} streaming />,
    )
    const list = scroller().querySelector('ul') as HTMLElement
    expect(list.getAttribute('aria-busy')).toBe('true')
    expect(scroller().getAttribute('aria-live')).toBeNull()
    expect(list.getAttribute('aria-live')).toBeNull()
    const rows = [...list.querySelectorAll(':scope > li')]
    expect(rows.at(-1)?.getAttribute('aria-posinset')).toBe('6')
    expect(rows.at(-1)?.getAttribute('aria-setsize')).toBe('6')
    const status = () =>
      [...document.querySelectorAll('[role="status"]')].map((s) => s.textContent).join('|')
    expect(status()).toBe('')
    await rerender(
      <Chat
        items={[...base, { id: 'live', author: 'assistant', text: 'The finished reply.' }]}
        streaming={false}
      />,
    )
    expect(list.getAttribute('aria-busy')).toBeNull()
    await expect.poll(status).toBe('The finished reply.')
  })

  it('没有消息时显示空状态插槽', async () => {
    await render(
      <div style={{ height: 300 }}>
        <MessageList
          items={[]}
          getKey={(m: Msg) => m.id}
          renderItem={(m) => m.text}
          empty={<p>How can I help?</p>}
        />
      </div>,
    )
    await expect.element(page.getByText('How can I help?')).toBeVisible()
  })
})
