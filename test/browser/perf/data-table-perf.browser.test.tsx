/**
 * DataTable 的性能预算（docs/11 §7「长列表全部虚拟化，DOM 节点数与数据量无关」）：
 * - 1 万行、带选择列、固定列、截断与自定义单元格（头像、胶囊）：DOM 中的行数与 100 行时同一量级；
 * - 连续向下滚动（每帧 120px，共 150 帧）与几次大跨度的跳转：没有超过 50ms 的长任务；
 * - 先校准：故意阻塞主线程 70ms，确认这个浏览器确实会报告长任务，否则「没有长任务」没有意义。
 * 长任务用 PerformanceObserver（longtask）记录；数字用 console.info 输出（`vitest run --silent=false` 时可见）。
 * 测试按开发环境构建（比生产构建慢）。放在 perf/ 下单独运行（`pnpm --filter vellum-ui test:perf`）：挂钟时间的断言
 * 与其他测试并行时不可靠。
 */
import { describe, expect, it } from 'vitest'
import { Avatar, DataTable, type DataTableColumn, Inline, Pill, Text } from '../../../src/index.ts'
import { nextFrame, render } from '../render.tsx'

interface Event {
  readonly id: string
  readonly time: string
  readonly user: string
  readonly action: string
  readonly status: 'ok' | 'failed'
  readonly bytes: number
}

const users = ['Alex Morgan', 'Sam Lee', 'Jordan Park', 'Riley Chen', 'Casey Diaz']
const make = (n: number): Event[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `e${i}`,
    time: `10:${String(Math.floor(i / 60) % 60).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`,
    user: users[i % users.length] as string,
    action: `${['Uploaded', 'Renamed', 'Shared', 'Moved'][i % 4]} the file brief-${i}.pdf to the shared project folder`,
    status: i % 7 ? 'ok' : 'failed',
    bytes: (i * 7919) % 1_000_000,
  }))

const columns: DataTableColumn<Event>[] = [
  { key: 'time', title: 'Time', width: 112, pin: 'start' },
  {
    key: 'user',
    title: 'User',
    width: 200,
    render: (e) => (
      <Inline gap={2}>
        <Avatar name={e.user} size={20} />
        <Text size="sm" truncate>
          {e.user}
        </Text>
      </Inline>
    ),
  },
  { key: 'action', title: 'Action', truncate: true },
  {
    key: 'status',
    title: 'Status',
    width: 112,
    render: (e) =>
      e.status === 'ok' ? (
        <Pill tone="success" dot>
          Done
        </Pill>
      ) : (
        <Pill tone="danger" dot>
          Failed
        </Pill>
      ),
  },
  { key: 'bytes', title: 'Bytes', width: 120, align: 'end', compare: (a, b) => a.bytes - b.bytes },
]

function Table(props: { readonly rows: readonly Event[] }) {
  return (
    <div style={{ width: 1000 }}>
      <DataTable
        aria-label="Activity"
        columns={columns}
        rows={props.rows}
        rowKey={(e) => e.id}
        selectable
        height={600}
        virtual
      />
    </div>
  )
}

function longTasks() {
  const durations: number[] = []
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) durations.push(Math.round(entry.duration))
  })
  observer.observe({ type: 'longtask' })
  return {
    durations,
    stop: async () => {
      // 让最后一批条目送达
      await nextFrame()
      observer.disconnect()
    },
  }
}

const scroller = () =>
  (document.querySelector('table[aria-label="Activity"]') as HTMLElement)
    .parentElement as HTMLElement
const rowCount = () => document.querySelectorAll('table[aria-label="Activity"] tbody tr').length
const nodeCount = () => scroller().querySelectorAll('*').length
const settleFrames = async (n = 10) => {
  for (let i = 0; i < n; i++) await nextFrame()
}

describe('DataTable 性能', () => {
  it('校准：浏览器会报告超过 50ms 的长任务', async () => {
    const tasks = longTasks()
    await new Promise<void>((resolve) =>
      setTimeout(() => {
        const end = performance.now() + 70
        while (performance.now() < end) {
          // 故意阻塞主线程 70ms
        }
        resolve()
      }, 0),
    )
    await expect.poll(() => tasks.durations.length).toBeGreaterThan(0)
    await tasks.stop()
    expect(Math.max(...tasks.durations)).toBeGreaterThanOrEqual(60)
  })

  it('DOM 行数与数据量无关：1 万行与 100 行同一量级', async () => {
    const small = await render(<Table rows={make(150)} />)
    await settleFrames()
    const rows150 = rowCount()
    const nodes150 = nodeCount()
    await small.unmount()
    await render(<Table rows={make(10_000)} />)
    await settleFrames()
    const rows10k = rowCount()
    const nodes10k = nodeCount()
    console.info(
      `[perf] DataTable DOM: 150 rows → ${rows150} tr / ${nodes150} nodes; 10,000 rows → ${rows10k} tr / ${nodes10k} nodes`,
    )
    expect(rows10k).toBeLessThan(40)
    expect(nodes10k).toBeLessThan(nodes150 * 1.3)
  })

  it('1 万行中连续滚动与大跨度跳转：没有超过 50ms 的长任务', async () => {
    await render(<Table rows={make(10_000)} />)
    await settleFrames()
    const el = scroller()
    const tasks = longTasks()
    // 帧间隔：滚动期间相邻两帧之间的时间（60 帧时约 16.7ms）
    const intervals: number[] = []
    let last = performance.now()
    let measuring = true
    const onFrame = (now: number) => {
      intervals.push(now - last)
      last = now
      if (measuring) requestAnimationFrame(onFrame)
    }
    requestAnimationFrame(onFrame)
    const start = performance.now()
    let frames = 0
    for (let i = 0; i < 150; i++) {
      el.scrollTop += 120
      await nextFrame()
      frames++
    }
    const scrolled = performance.now() - start
    measuring = false
    const sorted = intervals.slice(1).sort((a, b) => a - b)
    const p95 = Math.round((sorted[Math.floor(sorted.length * 0.95)] ?? 0) * 10) / 10
    const worst = Math.round((sorted.at(-1) ?? 0) * 10) / 10
    // 大跨度跳转：每次换一整屏的行。记录跳转所在那一帧的帧间隔
    const jumps: number[] = []
    for (const ratio of [0.5, 0.1, 0.9, 0.3, 1]) {
      await nextFrame()
      const before = await new Promise<number>((r) => requestAnimationFrame(r))
      el.scrollTop = (el.scrollHeight - el.clientHeight) * ratio
      const after = await new Promise<number>((r) => requestAnimationFrame(r))
      const next = await new Promise<number>((r) => requestAnimationFrame(r))
      jumps.push(Math.round(Math.max(after - before, next - after) * 10) / 10)
      await settleFrames(3)
    }
    // 横向滚动（固定列不动，其他列滚动）
    for (let i = 0; i < 30; i++) {
      el.scrollLeft += 20
      await nextFrame()
    }
    await tasks.stop()
    console.info(
      `[perf] DataTable scroll: ${frames} steps of 120px in ${Math.round(scrolled)} ms; ` +
        `frame interval p95 ${p95} ms, max ${worst} ms; frame interval at each jump ${JSON.stringify(jumps)} ms; ` +
        `long tasks ${JSON.stringify(tasks.durations)}`,
    )
    expect(tasks.durations).toEqual([])
    expect(rowCount()).toBeLessThan(40)
  })
})
