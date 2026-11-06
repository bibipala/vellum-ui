import { useEffect, useState } from 'react'
import { Button, Inline, Reasoning, Stack, StreamingText } from 'vellum-ui'

const THOUGHTS = `The user wants a short plan. Three steps should be enough.
First check what is already done, then what is blocked.
Keep the answer under 100 words.`

/**
 * Basic usage
 * While `thinking`, the content is expanded and the header shows "Thinking"; when it ends, the header shows how long
 * it took and the content collapses. Here the thoughts stream in with StreamingText.
 * @zh 基本用法
 * `thinking` 时内容展开，标题显示「思考中」；结束后标题显示用时，内容自动收起。这里思考内容用 StreamingText 流式显示。
 */
export function Basic() {
  const [length, setLength] = useState(0)
  const [running, setRunning] = useState(false)
  useEffect(() => {
    if (!running) return
    if (length >= THOUGHTS.length) {
      setRunning(false)
      return
    }
    const timer = setTimeout(() => setLength((n) => n + 4), 40)
    return () => clearTimeout(timer)
  }, [running, length])
  return (
    <Stack gap={3}>
      <Inline gap={2}>
        <Button
          variant="primary"
          disabled={running}
          onClick={() => {
            setLength(0)
            setRunning(true)
          }}
        >
          Ask
        </Button>
      </Inline>
      <Reasoning thinking={running}>
        <StreamingText text={THOUGHTS.slice(0, length)} streaming={running} />
      </Reasoning>
    </Stack>
  )
}

/**
 * Finished
 * A finished reasoning with a known `duration` (in milliseconds) starts collapsed and shows the time it took; expand
 * it to read the thoughts.
 * @zh 已完成
 * 已经完成、知道 `duration`（毫秒）的思考过程一开始就是收起的，标题显示用时；展开即可阅读。
 * @section States
 */
export function Finished() {
  return (
    <Stack gap={4}>
      <Reasoning duration={12_400}>{THOUGHTS}</Reasoning>
      <Reasoning duration={95_000}>{THOUGHTS}</Reasoning>
    </Stack>
  )
}
