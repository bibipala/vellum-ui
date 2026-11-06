import {
  Button,
  Inline,
  readSSE,
  type ServerSentEvent,
  Stack,
  StreamingText,
  useStream,
} from 'vellum-ui'
import { fakeSSE } from './_stream.ts'

const SUMMARY = `The review is done. Three files changed:
- the color tokens of the dark theme
- the empty state of the file list
- one test that was flaky on slow machines

Nothing blocks the release.`

// Every event carries {"delta": "..."}; the last one is [DONE]
const appendDelta = (text: string, e: ServerSentEvent) =>
  e.data === '[DONE]' ? text : text + (JSON.parse(e.data) as { delta: string }).delta

/**
 * Basic usage
 * Pass the text received so far and `streaming` while more is coming: new text is typed out at a steady pace and a
 * cursor marks the end. Line breaks are kept.
 * @zh 基本用法
 * 传入到目前为止收到的文字，还有后续内容时设置 `streaming`：新到的文字匀速逐字放出，结尾有光标。保留换行。
 */
export function Basic() {
  const reply = useStream({
    request: (signal) => readSSE(fakeSSE(SUMMARY, { signal, chunk: 6, interval: 80 }), { signal }),
    initial: '',
    reduce: appendDelta,
  })
  const streaming = reply.status === 'streaming'
  return (
    <Stack gap={3}>
      <Inline gap={2}>
        {streaming ? (
          <Button onClick={reply.stop}>Stop</Button>
        ) : (
          <Button variant="primary" onClick={() => reply.start()}>
            Summarize
          </Button>
        )}
      </Inline>
      <StreamingText text={reply.value || 'Press "Summarize" to start.'} streaming={streaming} />
    </Stack>
  )
}

/**
 * Finished text
 * Without `streaming` the text is shown at once and there is no cursor, for example when a conversation is opened
 * again later.
 * @zh 已完成的文字
 * 不设置 `streaming` 时文字立即全部显示，没有光标，例如之后重新打开一段对话时。
 * @section States
 */
export function Finished() {
  return <StreamingText text={SUMMARY} />
}
