import { describe, expect, it, vi } from 'vitest'
import {
  createSseParser,
  readSSE,
  readTextStream,
  type ServerSentEvent,
  StreamResponseError,
} from '../src/components/ai/stream.ts'
import {
  createStreamRunner,
  type StreamSnapshot,
  type UseStreamOptions,
} from '../src/components/ai/useStream.ts'

const encoder = new TextEncoder()

/** 按给定的分块产出字节的流；记录是否被取消。 */
function byteStream(chunks: readonly (string | Uint8Array)[]) {
  const state = { cancelled: false }
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(typeof c === 'string' ? encoder.encode(c) : c)
      controller.close()
    },
    cancel() {
      state.cancelled = true
    },
  })
  return { stream, state }
}

/** 由测试手动推送的流：用于在中途停止、取消。 */
function manualStream() {
  let ctrl!: ReadableStreamDefaultController<Uint8Array>
  const state = { cancelled: false }
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      ctrl = c
    },
    cancel() {
      state.cancelled = true
    },
  })
  return {
    stream,
    state,
    push: (text: string) => ctrl.enqueue(encoder.encode(text)),
    close: () => ctrl.close(),
  }
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = []
  for await (const item of iterable) out.push(item)
  return out
}

const tick = () => new Promise((r) => setTimeout(r, 0))

describe('SSE 解析（WHATWG 9.2）', () => {
  const parse = (...pieces: string[]) => {
    const p = createSseParser()
    return pieces.flatMap((s) => p.push(s))
  }

  it('空行结束一个事件；没有 event 字段时类型为 message', () => {
    expect(parse('data: hello\n\n')).toEqual([{ event: 'message', data: 'hello', id: '' }])
  })

  it('多行 data 用换行连接；冒号后只去掉一个空格', () => {
    expect(parse('data: a\ndata:  b\ndata\n\n')).toEqual([
      { event: 'message', data: 'a\n b\n', id: '' },
    ])
  })

  it('event、id、retry；id 跨事件保持；retry 只接受数字', () => {
    const events = parse('event: delta\nid: 7\nretry: 3000\ndata: x\n\n', 'data: y\nretry: 1s\n\n')
    expect(events).toEqual([
      { event: 'delta', data: 'x', id: '7', retry: 3000 },
      { event: 'message', data: 'y', id: '7' },
    ])
  })

  it('注释行（心跳）与未知字段被忽略；没有 data 的事件不产出', () => {
    expect(parse(': ping\n\nfoo: bar\nevent: x\n\ndata: z\n\n')).toEqual([
      { event: 'message', data: 'z', id: '' },
    ])
  })

  it('含 NUL 的 id 被忽略', () => {
    expect(parse('id: 1\n\nid: a\0b\ndata: q\n\n')).toEqual([
      { event: 'message', data: 'q', id: '1' },
    ])
  })

  it('CRLF、CR、LF 三种行尾，以及跨两段的 CRLF', () => {
    expect(parse('data: a\r\n\r\ndata: b\r\rdata: c\n\n')).toEqual([
      { event: 'message', data: 'a', id: '' },
      { event: 'message', data: 'b', id: '' },
      { event: 'message', data: 'c', id: '' },
    ])
    // CR 在段末、LF 在下一段开头：只算一个换行，不会多出一个空行而提前结束事件
    expect(parse('data: a\r', '\ndata: b\r', '\n\r', '\n')).toEqual([
      { event: 'message', data: 'a\nb', id: '' },
    ])
  })

  it('字段在任意位置被切开', () => {
    const text = 'event: delta\ndata: {"t":"你好"}\n\n'
    for (let cut = 1; cut < text.length; cut++) {
      expect(parse(text.slice(0, cut), text.slice(cut))).toEqual([
        { event: 'delta', data: '{"t":"你好"}', id: '' },
      ])
    }
  })
})

describe('readTextStream', () => {
  it('跨两块的多字节字符不被拆坏；空段跳过', async () => {
    const bytes = encoder.encode('你好')
    const { stream } = byteStream([
      bytes.slice(0, 2),
      bytes.slice(2, 4),
      new Uint8Array(),
      bytes.slice(4),
    ])
    expect((await collect(readTextStream(stream))).join('')).toBe('你好')
    const pieces = await collect(
      readTextStream(byteStream([bytes.slice(0, 2), bytes.slice(2)]).stream),
    )
    expect(pieces).toEqual(['你好'])
  })

  it('Response 状态码不是 2xx 时抛出 StreamResponseError', async () => {
    const res = new Response('nope', { status: 503 })
    const error = await collect(readTextStream(res)).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(StreamResponseError)
    expect((error as StreamResponseError).status).toBe(503)
  })

  it('读取 Response 的响应体', async () => {
    const res = new Response(byteStream(['a', 'b']).stream)
    expect((await collect(readTextStream(res))).join('')).toBe('ab')
  })

  it('中止时抛出 AbortError，并取消底层的流（不等下一块数据）', async () => {
    const src = manualStream()
    const ctrl = new AbortController()
    const got: string[] = []
    const done = (async () => {
      for await (const piece of readTextStream(src.stream, { signal: ctrl.signal })) got.push(piece)
    })().catch((e: unknown) => e)
    src.push('first')
    await tick()
    ctrl.abort()
    const error = await done
    expect(got).toEqual(['first'])
    expect((error as DOMException).name).toBe('AbortError')
    expect(src.state.cancelled).toBe(true)
  })

  it('已经中止的 signal：不开始读取', async () => {
    const ctrl = new AbortController()
    ctrl.abort()
    const error = await collect(
      readTextStream(byteStream(['x']).stream, { signal: ctrl.signal }),
    ).catch((e: unknown) => e)
    expect((error as DOMException).name).toBe('AbortError')
  })

  it('提前结束迭代（break）时取消底层的流', async () => {
    const src = manualStream()
    src.push('a')
    for await (const _ of readTextStream(src.stream)) break
    expect(src.state.cancelled).toBe(true)
  })
})

describe('readSSE', () => {
  it('流结束时没写完的事件丢弃', async () => {
    const { stream } = byteStream(['data: one\n\ndata: tw', 'o\n\ndata: cut'])
    expect((await collect(readSSE(stream))).map((e) => e.data)).toEqual(['one', 'two'])
  })

  it('开头的 BOM 被去掉', async () => {
    const { stream } = byteStream([new Uint8Array([0xef, 0xbb, 0xbf]), 'data: x\n\n'])
    expect(await collect(readSSE(stream))).toEqual([{ event: 'message', data: 'x', id: '' }])
  })
})

/** 用手动的合并调度测试运行器：flushes 中是等待执行的合并更新。 */
function setup<T, V, A extends readonly unknown[] = []>(opts: UseStreamOptions<T, V, A>) {
  const snapshots: StreamSnapshot<V>[] = []
  const flushes: (() => void)[] = []
  const runner = createStreamRunner(
    () => opts,
    (s) => snapshots.push(s),
    (flush) => {
      flushes.push(flush)
      return () => {
        const i = flushes.indexOf(flush)
        if (i >= 0) flushes.splice(i, 1)
      }
    },
  )
  const runFlushes = () => {
    for (const f of flushes.splice(0)) f()
  }
  return { runner, snapshots, flushes, runFlushes, last: () => snapshots.at(-1) }
}

async function* chunks<T>(items: readonly T[], signal?: AbortSignal) {
  for (const item of items) {
    await tick()
    if (signal?.aborted) throw signal.reason
    yield item
  }
}

describe('useStream 的运行器', () => {
  it('累积片段；一帧内收到的多个片段只更新一次；结束时 done 并调用 onDone', async () => {
    const onDone = vi.fn()
    const src = manualStream()
    const t = setup({
      request: (signal) => readSSE(src.stream, { signal }),
      initial: '',
      reduce: (text: string, e: ServerSentEvent) => text + e.data,
      onDone,
    })
    t.runner.start()
    expect(t.last()).toEqual({ value: '', status: 'streaming', error: undefined })
    src.push('data: a\n\ndata: b\n\n')
    await tick()
    src.push('data: c\n\n')
    await tick()
    expect(t.flushes).toHaveLength(1)
    expect(t.snapshots).toHaveLength(1)
    t.runFlushes()
    expect(t.last()).toEqual({ value: 'abc', status: 'streaming', error: undefined })
    src.close()
    await tick()
    await tick()
    expect(t.last()).toEqual({ value: 'abc', status: 'done', error: undefined })
    expect(onDone).toHaveBeenCalledWith('abc')
    expect(t.flushes).toHaveLength(0)
  })

  it('stop：状态立即变为 stopped，保留已收到的部分，并中止请求', async () => {
    const src = manualStream()
    let signal: AbortSignal | undefined
    const onDone = vi.fn()
    const t = setup({
      request: (s) => {
        signal = s
        return readTextStream(src.stream, { signal: s })
      },
      initial: '',
      reduce: (text: string, piece: string) => text + piece,
      onDone,
    })
    t.runner.start()
    src.push('partial')
    await tick()
    t.runner.stop()
    expect(t.last()).toEqual({ value: 'partial', status: 'stopped', error: undefined })
    expect(signal?.aborted).toBe(true)
    await tick()
    expect(src.state.cancelled).toBe(true)
    const count = t.snapshots.length
    await tick()
    expect(t.snapshots).toHaveLength(count)
    expect(onDone).not.toHaveBeenCalled()
    t.runner.stop() // 没有进行中的流：什么也不做
    expect(t.snapshots).toHaveLength(count)
  })

  it('重新开始：先中止旧的流，旧流后到的片段不会混进新值', async () => {
    const signals: AbortSignal[] = []
    const t = setup({
      request: (signal, items: readonly string[]) => {
        signals.push(signal)
        return chunks(items)
      },
      initial: '',
      reduce: (text: string, piece: string) => text + piece,
    })
    t.runner.start(['old1', 'old2', 'old3'])
    await tick()
    t.runner.start(['new'])
    expect(signals[0]?.aborted).toBe(true)
    expect(t.last()?.value).toBe('')
    for (let i = 0; i < 6; i++) await tick()
    t.runFlushes()
    expect(t.last()).toEqual({ value: 'new', status: 'done', error: undefined })
  })

  it('请求失败：状态 error，保留已收到的部分，调用 onError', async () => {
    const onError = vi.fn()
    const boom = new Error('boom')
    const t = setup({
      request: async function* () {
        yield 'a'
        throw boom
      },
      initial: '',
      reduce: (text: string, piece: string) => text + piece,
      onError,
    })
    t.runner.start()
    await tick()
    expect(t.last()).toEqual({ value: 'a', status: 'error', error: boom })
    expect(onError).toHaveBeenCalledWith(boom, 'a')
  })

  it('reduce 抛出异常（如 JSON 解析失败）时流失败', async () => {
    const t = setup({
      request: () => chunks(['{"ok":1}', 'not json']),
      initial: 0,
      reduce: (n: number, piece: string) => n + (JSON.parse(piece) as { ok: number }).ok,
    })
    t.runner.start()
    for (let i = 0; i < 4; i++) await tick()
    expect(t.last()?.status).toBe('error')
    expect(t.last()?.value).toBe(1)
    expect(t.last()?.error).toBeInstanceOf(SyntaxError)
  })

  it('reset 回到 idle 与初始值；dispose 之后不再通知', async () => {
    const src = manualStream()
    const t = setup({
      request: (signal) => readTextStream(src.stream, { signal }),
      initial: '',
      reduce: (text: string, piece: string) => text + piece,
    })
    t.runner.start()
    src.push('x')
    await tick()
    t.runner.reset()
    expect(t.last()).toEqual({ value: '', status: 'idle', error: undefined })
    t.runner.start()
    const count = t.snapshots.length
    t.runner.dispose()
    await tick()
    t.runFlushes()
    expect(t.snapshots).toHaveLength(count)
  })
})
