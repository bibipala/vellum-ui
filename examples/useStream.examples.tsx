import {
  Button,
  ErrorState,
  Inline,
  Pill,
  type PillTone,
  readSSE,
  type ServerSentEvent,
  Stack,
  type StreamStatus,
  Text,
  useStream,
} from 'vellum-ui'
import { fakeSSE } from './_stream.ts'

const ANSWER =
  'Streaming shows the reply while it is being written, so people can start reading at once and stop it when it goes off track.'

// Every event carries {"delta": "..."}; the last one is [DONE]
const appendDelta = (text: string, e: ServerSentEvent) =>
  e.data === '[DONE]' ? text : text + (JSON.parse(e.data) as { delta: string }).delta

const TONES: Record<StreamStatus, PillTone> = {
  idle: 'neutral',
  streaming: 'accent',
  done: 'success',
  error: 'danger',
  stopped: 'warning',
}

/**
 * Basic usage
 * `request` returns the events of the response (here a simulated endpoint; in a real page, `fetch` with the same
 * `signal`). The text grows as events arrive; "Stop" aborts the request and keeps what has arrived.
 * @zh 基本用法
 * `request` 返回响应中的事件（这里是模拟的接口；实际页面中用 `fetch`，并传同一个 `signal`）。文字随事件到达而增长；
 * "Stop" 中止请求，保留已经收到的部分。
 */
export function Basic() {
  const reply = useStream({
    request: (signal) => readSSE(fakeSSE(ANSWER, { signal }), { signal }),
    initial: '',
    reduce: appendDelta,
  })
  const streaming = reply.status === 'streaming'
  return (
    <Stack gap={3}>
      <Inline gap={2} align="center">
        {streaming ? (
          <Button onClick={reply.stop}>Stop</Button>
        ) : (
          <Button variant="primary" onClick={() => reply.start()}>
            Generate
          </Button>
        )}
        <Pill tone={TONES[reply.status]}>{reply.status}</Pill>
      </Inline>
      <Text as="p">{reply.value || '—'}</Text>
    </Stack>
  )
}

/**
 * Failure and retry
 * When the connection breaks, `status` becomes `error`, `error` holds the reason and the text received so far is
 * kept. Arguments of `start` are passed on to `request`.
 * @zh 失败与重试
 * 连接中断时 `status` 变为 `error`，`error` 是原因，已经收到的文字保留。`start` 的参数会传给 `request`。
 * @section States
 */
export function Failure() {
  const reply = useStream({
    request: (signal, failAfter?: number) =>
      readSSE(fakeSSE(ANSWER, { signal, failAfter }), { signal }),
    initial: '',
    reduce: appendDelta,
  })
  return (
    <Stack gap={3}>
      <Inline gap={2}>
        <Button onClick={() => reply.start(40)} disabled={reply.status === 'streaming'}>
          Generate (fails halfway)
        </Button>
      </Inline>
      <Text as="p">{reply.value || '—'}</Text>
      {reply.status === 'error' && (
        <ErrorState
          size="sm"
          message={reply.error instanceof Error ? reply.error.message : undefined}
          onRetry={() => reply.start()}
        />
      )}
    </Stack>
  )
}
