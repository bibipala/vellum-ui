/**
 * Markdown 流式渲染的性能预算：约 10 KB 的回复以每秒约 40 段的速度流式渲染，没有超过 50ms 的长任务
 * （不开、开打字机各一次）。
 *
 * 性能预算测的是挂钟时间，只有在没有其他测试同时运行时才可靠，所以放在 perf 项目中逐个文件单独运行
 * （`pnpm --filter vellum-ui test:perf`），不在默认的并行测试中：并行时其他测试文件与浏览器项目同时占用 CPU，
 * 同一段代码会测出 58ms 这样的长任务（2026-11-06 合并 M4b 时出现）。
 */
import { useEffect, useState } from 'react'
import { describe, expect, it } from 'vitest'
import { Markdown } from '../../../src/ai.ts'
import { page, render } from '../render.tsx'
import { frameIntervals, longTasks } from './measure.ts'

/** 约 10 KB 的 Markdown 回复：标题分节、段落、列表、代码块、表格。 */
function longReply(): string {
  const parts: string[] = []
  for (let i = 1; parts.join('\n').length < 10_000; i++) {
    parts.push(
      `## Part ${i}`,
      '',
      `This part explains step ${i} of the rollout. It covers the **scope**, the *risks* and the \`owner\`, with a link to [the notes](https://example.com/notes/${i}).`,
      '',
      '- Prepare the environment and check the access rights',
      '- Run the migration in a dry run first',
      '- Compare the results with the previous release',
      '',
      '```ts',
      `export function step${i}(input: string): string {`,
      '  return input.trim().toLowerCase()',
      '}',
      '```',
      '',
      '| Item | Owner | Minutes |',
      '| --- | --- | ---: |',
      `| Check ${i} | Alex | ${i * 5} |`,
      `| Verify ${i} | Sam | ${i * 3} |`,
      '',
    )
  }
  return parts.join('\n')
}

/** 用定时器模拟流：每 `interval` 毫秒追加一段，结束时 streaming 变为 false。 */
function StreamHarness(props: {
  text: string
  chunk: number
  interval: number
  typewriter?: boolean
  onDone: () => void
}) {
  const [length, setLength] = useState(0)
  const { text, chunk, interval, onDone } = props
  useEffect(() => {
    if (length >= text.length) {
      onDone()
      return
    }
    const timer = setTimeout(() => setLength((n) => Math.min(text.length, n + chunk)), interval)
    return () => clearTimeout(timer)
  }, [length, text, chunk, interval, onDone])
  return (
    <Markdown
      testId="perf"
      content={text.slice(0, length)}
      streaming={length < text.length}
      typewriter={props.typewriter}
    />
  )
}

async function measureStream(typewriter: boolean) {
  const text = longReply()
  const chunk = 64
  const interval = 25
  let done = false
  const started = performance.now()
  const view = await render(
    <StreamHarness
      text={text}
      chunk={chunk}
      interval={interval}
      typewriter={typewriter}
      onDone={() => {
        done = true
      }}
    />,
  )
  // 从首次渲染之后开始统计（模块加载与首次挂载不算在流式渲染里）
  const tasks = longTasks()
  const sampling = frameIntervals()
  try {
    await expect.poll(() => done, { timeout: 30_000, interval: 100 }).toBe(true)
    sampling.stop()
    await new Promise((r) => setTimeout(r, 300))
    const el = page.getByTestId('perf').element()
    expect(el.textContent?.length).toBeGreaterThan(5000)
  } finally {
    sampling.stop()
    await tasks.stop()
    await view.unmount()
  }
  const sorted = [...sampling.intervals].sort((a, b) => a - b)
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0
  const elapsed = performance.now() - started

  return {
    bytes: text.length,
    chunks: Math.ceil(text.length / chunk),
    elapsed: Math.round(elapsed),
    longTasks: tasks.durations,
    frames: sampling.intervals.length,
    frameP95: Math.round(p95 * 10) / 10,
    frameMax: Math.round((sorted.at(-1) ?? 0) * 10) / 10,
  }
}

describe('Markdown：流式渲染的性能', () => {
  it('约 10 KB、每秒约 40 段：没有超过 50ms 的长任务（不开、开打字机各一次）', async () => {
    // 校准：确认这个浏览器确实会报告长任务（否则下面的「没有长任务」没有意义）
    const probe = longTasks()
    try {
      await new Promise<void>((resolve) =>
        setTimeout(() => {
          const end = performance.now() + 70
          while (performance.now() < end) {
            // 故意阻塞主线程 70ms
          }
          resolve()
        }, 0),
      )
      await expect.poll(() => probe.durations.length).toBeGreaterThan(0)
    } finally {
      await probe.stop()
    }

    const plain = await measureStream(false)
    const typed = await measureStream(true)
    // 实测数字写进测试输出，供汇报使用
    console.info('Markdown stream perf', JSON.stringify({ plain, typed }))
    expect(plain.longTasks).toEqual([])
    expect(typed.longTasks).toEqual([])
  }, 60_000)
})
