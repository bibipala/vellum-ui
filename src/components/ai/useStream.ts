/**
 * useStream：发起一次流式请求并把收到的片段累积成一个值；可以停止、重新开始。
 * 收到的片段很密集时（每秒数百个），界面按动画帧合并更新，每帧最多重新渲染一次。
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/**
 * State of a stream: not started, receiving, finished, failed, or stopped by the user.
 * @zh 流的状态：未开始、接收中、已完成、失败、被用户停止。
 */
export type StreamStatus = 'idle' | 'streaming' | 'done' | 'error' | 'stopped'

/**
 * Options of useStream.
 * @zh useStream 的选项。
 */
export interface UseStreamOptions<T, V, A extends readonly unknown[] = []> {
  /**
   * Starts the request and returns the chunks, such as `readSSE(await fetch(url, { signal }), { signal })`. Pass
   * `signal` on to `fetch` and the reader: it is aborted when the stream is stopped, restarted, or the component
   * unmounts. The arguments after `signal` are the arguments of `start`.
   * @zh 发起请求并返回片段，如 `readSSE(await fetch(url, { signal }), { signal })`。要把 `signal` 传给 `fetch` 与读取函数：
   * 停止、重新开始或组件卸载时它会被中止。`signal` 之后的参数就是 `start` 的参数。
   */
  readonly request: (
    signal: AbortSignal,
    ...args: A
  ) => AsyncIterable<T> | Promise<AsyncIterable<T>>
  /**
   * The value before the first chunk; `start` and `reset` return to it.
   * @zh 收到第一个片段之前的值；`start` 与 `reset` 都回到这个值。
   */
  readonly initial: V
  /**
   * Folds a chunk into the value, such as `(text, e) => text + JSON.parse(e.data).delta`. Return a new value
   * instead of changing the old one. An exception fails the stream.
   * @zh 把一个片段并入当前值，如 `(text, e) => text + JSON.parse(e.data).delta`。返回新值，不要修改旧值。抛出异常时流失败。
   */
  readonly reduce: (value: V, chunk: T) => V
  /**
   * Called with the final value when the stream finishes normally (not when it is stopped).
   * @zh 流正常结束时以最终的值调用（被停止时不调用）。
   */
  readonly onDone?: (value: V) => void
  /**
   * Called when the request or `reduce` fails, with the error and the value received so far.
   * @zh 请求或 `reduce` 失败时调用，参数是错误与已经收到的部分。
   */
  readonly onError?: (error: unknown, value: V) => void
}

/**
 * What useStream returns.
 * @zh useStream 的返回值。
 */
export interface StreamState<V, A extends readonly unknown[] = []> {
  /**
   * The value accumulated so far. It is kept after the stream stops or fails.
   * @zh 到目前为止累积的值。停止或失败后保留。
   */
  readonly value: V
  /**
   * State of the stream.
   * @zh 流的状态。
   */
  readonly status: StreamStatus
  /**
   * The error when `status` is `error`, otherwise `undefined`.
   * @zh `status` 为 `error` 时的错误，其他时候为 `undefined`。
   */
  readonly error: unknown
  /**
   * Starts a stream with these arguments; a stream still running is aborted first. The value starts from
   * `initial` again.
   * @zh 用这些参数开始一个流；仍在进行的流先被中止。值从 `initial` 重新开始。
   */
  readonly start: (...args: A) => void
  /**
   * Stops the running stream: the request is aborted, the status becomes `stopped` at once and the value
   * received so far is kept. Does nothing when no stream is running.
   * @zh 停止进行中的流：中止请求，状态立即变为 `stopped`，保留已经收到的部分。没有进行中的流时什么也不做。
   */
  readonly stop: () => void
  /**
   * Aborts any running stream and returns to `idle` with the `initial` value.
   * @zh 中止进行中的流，回到 `idle` 与 `initial` 值。
   */
  readonly reset: () => void
}

/** 运行器的快照（hook 的状态）。 */
export interface StreamSnapshot<V> {
  readonly value: V
  readonly status: StreamStatus
  readonly error: unknown
}

/** 流的运行器：与 React 无关，便于在 node 中测试。组件库内部使用，不从入口导出。 */
export interface StreamRunner<A extends readonly unknown[]> {
  start(...args: A): void
  stop(): void
  reset(): void
  /** 组件卸载：中止进行中的流，之后不再通知。 */
  dispose(): void
}

/** 安排一次合并更新，返回取消函数。浏览器中按动画帧，其他环境用 16ms 定时器。 */
export type ScheduleFlush = (flush: () => void) => () => void

export const scheduleFrame: ScheduleFlush = (flush) => {
  if (typeof requestAnimationFrame === 'function') {
    const handle = requestAnimationFrame(flush)
    return () => cancelAnimationFrame(handle)
  }
  const handle = setTimeout(flush, 16)
  return () => clearTimeout(handle)
}

/**
 * 创建运行器。`options()` 每次取最新的选项（hook 中 request、reduce 常是内联函数）；`onChange` 收到新快照。
 * 每次 start 有自己的编号：停止、重新开始、卸载后，旧的循环即使还在收数据，也不会再改动状态。
 */
export function createStreamRunner<T, V, A extends readonly unknown[]>(
  options: () => UseStreamOptions<T, V, A>,
  onChange: (snapshot: StreamSnapshot<V>) => void,
  schedule: ScheduleFlush = scheduleFrame,
): StreamRunner<A> {
  let run = 0
  let controller: AbortController | undefined
  let streaming = false
  let value: V = options().initial
  let cancelFlush: (() => void) | undefined

  const clearFlush = () => {
    cancelFlush?.()
    cancelFlush = undefined
  }
  const abort = () => {
    run++
    clearFlush()
    controller?.abort()
    controller = undefined
    streaming = false
  }
  const finish = (status: StreamStatus, error?: unknown) => {
    clearFlush()
    controller = undefined
    streaming = false
    onChange({ value, status, error })
  }

  return {
    start(...args) {
      abort()
      const id = run
      const ctrl = new AbortController()
      controller = ctrl
      streaming = true
      value = options().initial
      onChange({ value, status: 'streaming', error: undefined })
      const flush = () => {
        cancelFlush = undefined
        if (id === run) onChange({ value, status: 'streaming', error: undefined })
      }
      void (async () => {
        try {
          const chunks = await options().request(ctrl.signal, ...args)
          for await (const chunk of chunks) {
            if (id !== run) return
            value = options().reduce(value, chunk)
            cancelFlush ??= schedule(flush)
          }
          if (id !== run) return
          finish('done')
          options().onDone?.(value)
        } catch (error) {
          // 停止、重新开始、卸载时编号已经变了：中止引起的 AbortError 在这里被忽略
          if (id !== run) return
          finish('error', error)
          options().onError?.(error, value)
        }
      })()
    },
    stop() {
      if (!streaming) return
      abort()
      // 立即反馈（100ms 内必有反馈），不等请求真正断开
      onChange({ value, status: 'stopped', error: undefined })
    },
    reset() {
      abort()
      value = options().initial
      onChange({ value, status: 'idle', error: undefined })
    },
    dispose: abort,
  }
}

/**
 * Runs a streaming request and accumulates its chunks into a value, such as the text of an AI reply. The stream can
 * be stopped and restarted; stopping, restarting or unmounting aborts the request. When chunks arrive densely
 * (hundreds per second), the value is updated at most once per animation frame.
 * Read the chunks with `readSSE` or `readTextStream`, or return any async iterable.
 * @zh 发起流式请求，把收到的片段累积成一个值，如 AI 回复的文字。可以停止、重新开始；停止、重新开始、组件卸载时都会中止请求。
 * 片段到达很密集时（每秒数百个），值每个动画帧最多更新一次。
 * 片段用 `readSSE` 或 `readTextStream` 读取，也可以返回任意异步可迭代对象。
 * @param options - The request, the initial value and how a chunk is folded in.
 * @returns The value, the status and the controls.
 * @category AI
 * @usage Streaming AI replies, long-running generation with a stop button, any `text/event-stream` endpoint
 * @usageZh 流式的 AI 回复、可以停止的长时间生成、任何 `text/event-stream` 接口
 * @example
 * ```tsx
 * const reply = useStream({
 *   request: async (signal, prompt: string) =>
 *     readSSE(await fetch('/api/chat', { method: 'POST', body: prompt, signal }), { signal }),
 *   initial: '',
 *   reduce: (text, e: ServerSentEvent) => text + e.data,
 * })
 * reply.start('Hello') // reply.value grows; reply.stop() aborts
 * ```
 */
export function useStream<T, V, A extends readonly unknown[] = []>(
  options: UseStreamOptions<T, V, A>,
): StreamState<V, A> {
  const latest = useRef(options)
  useLayoutEffect(() => {
    latest.current = options
  })
  const [snapshot, setSnapshot] = useState<StreamSnapshot<V>>(() => ({
    value: options.initial,
    status: 'idle',
    error: undefined,
  }))
  const runner = useRef<StreamRunner<A> | null>(null)
  runner.current ??= createStreamRunner(() => latest.current, setSnapshot)
  const controls = useRef<Pick<StreamState<V, A>, 'start' | 'stop' | 'reset'> | null>(null)
  controls.current ??= {
    start: (...args) => runner.current?.start(...args),
    stop: () => runner.current?.stop(),
    reset: () => runner.current?.reset(),
  }
  useEffect(() => () => runner.current?.dispose(), [])
  return { ...snapshot, ...controls.current }
}
