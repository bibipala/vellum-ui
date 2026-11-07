/**
 * 读取流式响应：把 `fetch` 的响应体（或任意字节流）读成文本片段，或按 Server-Sent Events 规范解析为事件。
 * 与 React 无关；可取消（AbortSignal），取消时同时取消底层的读取。
 */

/**
 * One event of a Server-Sent Events stream.
 * @zh Server-Sent Events 流中的一个事件。
 */
export interface ServerSentEvent {
  /**
   * Event type: the `event:` field, `message` when the event has none.
   * @zh 事件类型：`event:` 字段的值，没有时为 `message`。
   */
  readonly event: string
  /**
   * Data: the `data:` lines joined with line breaks.
   * @zh 数据：各行 `data:` 的值用换行连接。
   */
  readonly data: string
  /**
   * The last event ID seen so far (the `id:` field persists until it is set again), an empty string when none.
   * @zh 到这个事件为止最后一次出现的事件编号（`id:` 字段一直有效，直到再次设置），没有时为空字符串。
   */
  readonly id: string
  /**
   * Reconnection time in milliseconds, when the event carries a `retry:` field.
   * @zh 重连间隔（毫秒），事件带有 `retry:` 字段时才有。
   */
  readonly retry?: number
}

/**
 * Where a stream is read from: a `fetch` response or a byte stream.
 * @zh 流的来源：`fetch` 的响应，或字节流。
 */
export type StreamSource = Response | ReadableStream<Uint8Array>

/**
 * Options for reading a stream.
 * @zh 读取流的选项。
 */
export interface ReadStreamOptions {
  /**
   * Stops reading when aborted: the underlying stream is cancelled and the iteration throws an `AbortError`
   * (the same error as an aborted `fetch`).
   * @zh 中止时停止读取：底层的流被取消，迭代抛出 `AbortError`（与中止的 `fetch` 相同）。
   */
  readonly signal?: AbortSignal
}

/**
 * Thrown by `readTextStream` and `readSSE` when they are given a `fetch` response whose status is not 2xx, or which
 * has no body. `status` is the HTTP status of the response; `name` is `'StreamResponseError'`. It is thrown when the
 * iteration starts (at the first `next()`), not when the function is called.
 * @zh `readTextStream` 与 `readSSE` 收到状态码不是 2xx、或没有响应体的 `fetch` 响应时抛出。`status` 是响应的 HTTP
 * 状态码；`name` 为 `'StreamResponseError'`。在开始迭代时（第一次 `next()`）抛出，而不是调用函数时。
 * @group Streaming
 */
export class StreamResponseError extends Error {
  /**
   * HTTP status of the response.
   * @zh 响应的 HTTP 状态码。
   */
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'StreamResponseError'
    this.status = status
  }
}

function abortError(signal: AbortSignal): unknown {
  // signal.reason 默认就是 AbortError（DOMException）；调用方传了自定义原因时原样抛出
  return signal.reason ?? new DOMException('The operation was aborted.', 'AbortError')
}

function bodyOf(source: StreamSource): ReadableStream<Uint8Array> {
  if (!(source instanceof Response)) return source
  if (!source.ok)
    throw new StreamResponseError(source.status, `Request failed with status ${source.status}`)
  if (!source.body) throw new StreamResponseError(source.status, 'The response has no body')
  return source.body
}

/**
 * Reads a byte stream as UTF-8 text, one piece per chunk received. A character split across two chunks is
 * not broken; empty pieces are skipped.
 *
 * `source` is a `fetch` response or a byte stream; a response whose status is not 2xx, or that has no body, throws
 * `StreamResponseError`. Aborting `options.signal` cancels the underlying stream and makes the iteration throw the
 * abort reason (an `AbortError` by default). Returns an async generator of the text pieces in order of arrival; ending
 * the loop early (`break`, an exception) also cancels the stream.
 * @zh 把字节流按 UTF-8 读成文本，每收到一块产出一段。跨两块的字符不会被拆坏；空段跳过。
 *
 * `source` 是 `fetch` 的响应或字节流；响应的状态码不是 2xx、或没有响应体时抛出 `StreamResponseError`。中止
 * `options.signal` 会取消底层的流，迭代抛出中止原因（默认为 `AbortError`）。返回异步生成器，按到达顺序产出文本片段；
 * 提前结束循环（`break`、异常）同样会取消流。
 * @group Streaming
 * @param source - A `fetch` response (its status must be 2xx) or a byte stream.
 * @param options - `signal` cancels the reading.
 * @returns The text pieces in order of arrival.
 * @example
 * ```ts
 * const res = await fetch('/api/complete', { method: 'POST', body, signal })
 * for await (const piece of readTextStream(res, { signal })) text += piece
 * ```
 */
export async function* readTextStream(
  source: StreamSource,
  options: ReadStreamOptions = {},
): AsyncGenerator<string, void, undefined> {
  const { signal } = options
  if (signal?.aborted) throw abortError(signal)
  const reader = bodyOf(source).getReader()
  const decoder = new TextDecoder()
  // 中止时取消读取：挂起中的 read() 立即结束，不用等下一块数据到达
  const onAbort = () => {
    reader.cancel(signal?.reason).catch(() => {})
  }
  signal?.addEventListener('abort', onAbort, { once: true })
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (signal?.aborted) throw abortError(signal)
      if (done) break
      const text = decoder.decode(value, { stream: true })
      if (text) yield text
    }
    const rest = decoder.decode()
    if (rest) yield rest
  } finally {
    signal?.removeEventListener('abort', onAbort)
    // 提前结束迭代（break、异常）时取消底层的流，服务端随之断开
    reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

/**
 * 按 WHATWG HTML 规范（9.2 Server-sent events）解析事件流的状态机。逐段喂入文本，返回本段完成的事件。
 * 组件库内部使用（readSSE 与测试），不从入口导出。
 */
export interface SseParser {
  /** 喂入一段文本，返回其中已经完整（遇到空行）的事件。 */
  push(text: string): ServerSentEvent[]
}

/** 创建 SSE 解析器。行尾可以是 CRLF、LF 或 CR；CR 在段末时要看下一段是否以 LF 开头。 */
export function createSseParser(): SseParser {
  let buffer = ''
  // 上一段以 CR 结尾：下一段开头的 LF 属于同一个换行
  let pendingCR = false
  let data = ''
  let hasData = false
  let eventType = ''
  let lastId = ''
  let retry: number | undefined

  const dispatch = (out: ServerSentEvent[]) => {
    if (hasData) {
      const event: ServerSentEvent = {
        event: eventType || 'message',
        data,
        id: lastId,
        ...(retry === undefined ? {} : { retry }),
      }
      out.push(event)
    }
    data = ''
    hasData = false
    eventType = ''
    retry = undefined
  }

  const line = (text: string, out: ServerSentEvent[]) => {
    if (text === '') {
      dispatch(out)
      return
    }
    if (text.startsWith(':')) return // 注释（常用作心跳）
    const colon = text.indexOf(':')
    const field = colon === -1 ? text : text.slice(0, colon)
    let value = colon === -1 ? '' : text.slice(colon + 1)
    if (value.startsWith(' ')) value = value.slice(1)
    switch (field) {
      case 'event':
        eventType = value
        break
      case 'data':
        data = hasData ? `${data}\n${value}` : value
        hasData = true
        break
      case 'id':
        if (!value.includes('\0')) lastId = value
        break
      case 'retry':
        if (/^\d+$/.test(value)) retry = Number(value)
        break
      default:
      // 规范要求忽略未知字段
    }
  }

  return {
    push(text) {
      const out: ServerSentEvent[] = []
      let chunk = text
      if (pendingCR && chunk.startsWith('\n')) chunk = chunk.slice(1)
      pendingCR = false
      buffer += chunk
      let start = 0
      for (let i = 0; i < buffer.length; i++) {
        const c = buffer[i]
        if (c !== '\n' && c !== '\r') continue
        line(buffer.slice(start, i), out)
        if (c === '\r') {
          if (i + 1 === buffer.length) pendingCR = true
          else if (buffer[i + 1] === '\n') i++
        }
        start = i + 1
      }
      buffer = buffer.slice(start)
      return out
    },
  }
}

/**
 * Reads a Server-Sent Events stream (`text/event-stream`) as events. Follows the WHATWG specification: comments
 * (heartbeats) are skipped, multi-line `data` is joined with line breaks, `id` persists across events, and an
 * event cut off by the end of the stream is discarded. It does not reconnect.
 *
 * `source` and `options` are the same as for `readTextStream` (a non-2xx response throws `StreamResponseError`,
 * `options.signal` cancels the reading). Returns an async generator of `ServerSentEvent` objects in order of
 * arrival; events without a `data` field are not yielded.
 * @zh 把 Server-Sent Events 流（`text/event-stream`）读成事件。按 WHATWG 规范解析：跳过注释（心跳），多行 `data`
 * 用换行连接，`id` 跨事件保持，流结束时没写完的事件丢弃。不自动重连。
 *
 * `source` 与 `options` 同 `readTextStream`（状态码不是 2xx 的响应抛出 `StreamResponseError`，`options.signal`
 * 取消读取）。返回异步生成器，按到达顺序产出 `ServerSentEvent`；没有 `data` 字段的事件不产出。
 * @group Streaming
 * @param source - A `fetch` response (its status must be 2xx) or a byte stream.
 * @param options - `signal` cancels the reading.
 * @returns The events in order of arrival.
 * @example
 * ```ts
 * const res = await fetch('/api/chat', { method: 'POST', body, signal })
 * for await (const e of readSSE(res, { signal })) {
 *   if (e.data === '[DONE]') break
 *   text += JSON.parse(e.data).delta
 * }
 * ```
 */
export async function* readSSE(
  source: StreamSource,
  options: ReadStreamOptions = {},
): AsyncGenerator<ServerSentEvent, void, undefined> {
  const parser = createSseParser()
  for await (const text of readTextStream(source, options)) {
    for (const event of parser.push(text)) yield event
  }
}
