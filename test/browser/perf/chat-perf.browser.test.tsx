/**
 * 消息列表的性能（docs/11 §7「长聊天记录全部虚拟化，DOM 节点数与数据量无关」；ADR 0020 §4「长消息列表与流式渲染的帧率」）：
 * - 1,000 条消息时 DOM 节点数与 100 条时相同量级（只渲染可见附近的消息）；
 * - 连续滚动（每帧 120px）与以每秒约 40 段的速度流式增长最后一条消息时，没有超过 50ms 的长任务，流式期间一直贴底。
 * 长任务用 PerformanceObserver（longtask）记录；测得的数字用 console.info 输出（`vitest run --silent=false` 时可见）。
 * 测试按开发环境构建（比生产构建慢），生产构建的数字另在使用方项目中实测。
 * 放在 perf/ 下：挂钟时间的断言要单独运行（与全部测试并行时 CPU 被占用，同一段代码会测出长任务）。
 */
import { useEffect, useState } from 'react'
import { describe, expect, it } from 'vitest'
import { Message, MessageActions, MessageList } from '../../../src/index.ts'
import { nextFrame, render } from '../render.tsx'

interface Msg {
  readonly id: string
  readonly author: 'user' | 'assistant'
  readonly text: string
}

const make = (n: number): Msg[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `m${i}`,
    author: i % 2 ? 'assistant' : 'user',
    text: `Message ${i}. ${'The team agreed on the next steps for the release. '.repeat((i % 5) + 1)}`,
  }))

function List(props: { readonly items: readonly Msg[] }) {
  return (
    <div style={{ height: 600, width: 800 }} data-testid="frame">
      <MessageList
        items={props.items}
        getKey={(m) => m.id}
        renderItem={(m) => (
          <Message
            author={m.author}
            actions={m.author === 'assistant' ? <MessageActions copyText={m.text} /> : undefined}
          >
            {m.text}
          </Message>
        )}
      />
    </div>
  )
}

/** 以 interval 毫秒的间隔给最后一条消息追加文字，共 chunks 段。 */
function Streaming(props: {
  readonly base: readonly Msg[]
  readonly chunks: number
  readonly interval: number
  readonly onDone: () => void
}) {
  const [text, setText] = useState('')
  const [count, setCount] = useState(0)
  const { chunks, interval, onDone } = props
  useEffect(() => {
    if (count >= chunks) {
      onDone()
      return
    }
    const timer = setTimeout(() => {
      setText((t) => `${t}word${count} and `)
      setCount((c) => c + 1)
    }, interval)
    return () => clearTimeout(timer)
  }, [count, chunks, interval, onDone])
  const items = [...props.base, { id: 'live', author: 'assistant' as const, text }]
  return (
    <div style={{ height: 600, width: 800 }}>
      <MessageList
        items={items}
        getKey={(m) => m.id}
        streaming={count < chunks}
        renderItem={(m) => (
          <Message
            author={m.author}
            status={m.id === 'live' && count < chunks ? 'streaming' : 'done'}
          >
            {m.text}
          </Message>
        )}
      />
    </div>
  )
}

function longTasks() {
  const durations: number[] = []
  /** 每个长任务开始的时刻（相对开始记录），便于判断它落在哪一段。 */
  const at: number[] = []
  const origin = performance.now()
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      durations.push(Math.round(entry.duration))
      at.push(Math.round(entry.startTime - origin))
    }
  })
  observer.observe({ type: 'longtask' })
  return {
    durations,
    at,
    stop: async () => {
      // 让最后一批条目送达
      await nextFrame()
      observer.disconnect()
    },
  }
}

const scroller = () => document.querySelector('section[aria-label="Conversation"]') as HTMLElement
const nodeCount = () => scroller().querySelectorAll('*').length
const distance = () => {
  const el = scroller()
  return el.scrollHeight - el.clientHeight - el.scrollTop
}
const settleFrames = async (n = 10) => {
  for (let i = 0; i < n; i++) await nextFrame()
}

describe('MessageList 性能', () => {
  it('DOM 节点数与消息数量无关：1,000 条与 100 条同一量级', async () => {
    const small = await render(<List items={make(100)} />)
    await settleFrames()
    const nodes100 = nodeCount()
    await small.unmount()
    await render(<List items={make(1000)} />)
    await settleFrames()
    const nodes1000 = nodeCount()
    const rows = scroller().querySelectorAll('ul > li').length
    console.info(
      `[perf] DOM nodes: 100 messages ${nodes100}, 1000 messages ${nodes1000}; rows ${rows}`,
    )
    expect(rows).toBeLessThan(20)
    expect(nodes1000).toBeLessThan(nodes100 * 1.3)
    expect(nodes1000).toBeLessThan(600)
  })

  it('1,000 条消息中连续向上滚动：没有超过 50ms 的长任务', async () => {
    await render(<List items={make(1000)} />)
    await settleFrames()
    const tasks = longTasks()
    const el = scroller()
    const start = performance.now()
    let frames = 0
    for (let i = 0; i < 150; i++) {
      el.scrollTop -= 120
      await nextFrame()
      frames++
    }
    const elapsed = performance.now() - start
    await tasks.stop()
    console.info(
      `[perf] scroll: ${frames} steps of 120px in ${Math.round(elapsed)} ms; long tasks ${JSON.stringify(tasks.durations)} at ${JSON.stringify(tasks.at)} ms`,
    )
    expect(tasks.durations).toEqual([])
  })

  it('以每秒约 40 段流式增长最后一条消息：没有超过 50ms 的长任务，始终贴底', async () => {
    let done = false
    const far: number[] = []
    const base = make(1000)
    await render(
      <Streaming
        base={base}
        chunks={120}
        interval={25}
        onDone={() => {
          done = true
        }}
      />,
    )
    await settleFrames()
    const tasks = longTasks()
    const start = performance.now()
    while (!done) {
      await nextFrame()
      far.push(distance())
    }
    const elapsed = performance.now() - start
    await tasks.stop()
    await settleFrames(3)
    console.info(
      `[perf] streaming: 120 chunks in ${Math.round(elapsed)} ms (${Math.round(120000 / elapsed)}/s); ` +
        `long tasks ${JSON.stringify(tasks.durations)}; max distance from end ${Math.max(...far)} px`,
    )
    expect(tasks.durations).toEqual([])
    expect(distance()).toBeLessThanOrEqual(1)
  })
})
