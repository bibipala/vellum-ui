import { useRef, useState } from 'react'
import {
  App,
  Message,
  MessageActions,
  type MessageAuthor,
  MessageList,
  type MessageListHandle,
  type MessageStatus,
  PromptInput,
  type PromptInputRejectReason,
  type PromptInputSubmit,
  PromptSuggestions,
  readSSE,
  type ServerSentEvent,
  Stack,
  Text,
  useMessage,
  useStream,
} from 'vellum-ui'
import { DemoFrame } from './_frame.tsx'
import { DEMO_REPLY, fakeSSE } from './_stream.ts'

/**
 * Basic usage
 * `Enter` sends and `Shift+Enter` adds a line break; the field grows with the text. The text is cleared after
 * sending (uncontrolled).
 * @zh 基本用法
 * `Enter` 发送，`Shift+Enter` 换行，输入框随文字增高。发送后文字自动清空（非受控）。
 */
export function Basic() {
  const [last, setLast] = useState('')
  return (
    <Stack gap={2}>
      <PromptInput onSubmit={(m) => setLast(m.text)} />
      <Text tone="tertiary" size="sm">
        Sent: {last || '—'}
      </Text>
    </Stack>
  )
}

const REASONS: Record<PromptInputRejectReason, string> = {
  type: 'only PDF files and images can be attached',
  size: 'the file is larger than 5 MB',
  count: 'at most 3 files can be attached',
}

function WithFiles() {
  const message = useMessage()
  const [sent, setSent] = useState<PromptInputSubmit | null>(null)
  return (
    <Stack gap={2}>
      <PromptInput
        allowFiles
        accept=".pdf,image/*"
        maxSize={5 * 1024 * 1024}
        maxFiles={3}
        placeholder="Ask about a document"
        onReject={(file, reason) => message.error(`${file.name}: ${REASONS[reason]}`)}
        onSubmit={setSent}
      />
      <Text tone="tertiary" size="sm">
        {sent ? `Sent "${sent.text}" with ${sent.files.length} file(s)` : 'Nothing sent yet'}
      </Text>
    </Stack>
  )
}

/**
 * Attachments
 * With `allowFiles`, files can be chosen with the paperclip, dropped on the field or pasted. `accept`, `maxSize`
 * and `maxFiles` limit them; rejected files go to `onReject`. The files are handed to `onSubmit` with the text,
 * and the component never reads or uploads them.
 * @zh 附件
 * 设置 `allowFiles` 后，可以用回形针按钮选择、拖到输入框上或粘贴文件。`accept`、`maxSize`、`maxFiles` 限制文件，被拒绝的文件交给
 * `onReject`。文件与文字一起交给 `onSubmit`，组件从不读取或上传它们。
 * @section Variants
 */
export function Attachments() {
  return (
    <App>
      <WithFiles />
    </App>
  )
}

/**
 * Disabled
 * `disabledReason` explains why nothing can be sent; the field stays focusable and shows the reason on hover or
 * focus.
 * @zh 禁用
 * `disabledReason` 说明为什么不能发送；输入框仍可聚焦，悬停或聚焦时显示原因。
 * @section States
 */
export function Disabled() {
  return (
    <PromptInput disabled disabledReason="This conversation is archived" placeholder="Archived" />
  )
}

interface ChatMessage {
  readonly id: string
  readonly author: MessageAuthor
  readonly text: string
  readonly status?: MessageStatus
}

// Every event carries {"delta": "..."}; the last one is [DONE]
const appendDelta = (text: string, e: ServerSentEvent) =>
  e.data === '[DONE]' ? text : text + (JSON.parse(e.data) as { delta: string }).delta

const STARTERS = [
  { key: 'plan', label: 'Plan the launch', icon: 'sparkles' },
  { key: 'notes', label: 'Summarize the meeting notes', icon: 'file-text' },
  { key: 'mail', label: 'Draft a status update', icon: 'message' },
] as const

/**
 * A small conversation
 * PromptInput with MessageList and useStream (a simulated endpoint): send a message, watch the reply stream, stop it
 * with the stop button or `Esc`. The suggestions in the empty state send their label.
 * @zh 一个小对话
 * PromptInput 与 MessageList、useStream（模拟的接口）配合：发送消息，回复流式出现，用停止按钮或 `Esc` 停止。空状态中的建议会发送它的标签。
 * @section Advanced
 */
export function Conversation() {
  const listRef = useRef<MessageListHandle>(null)
  const [log, setLog] = useState<ChatMessage[]>([])
  const [round, setRound] = useState(0)
  const reply = useStream({
    request: (signal) => readSSE(fakeSSE(DEMO_REPLY, { signal }), { signal }),
    initial: '',
    reduce: appendDelta,
  })
  const live: ChatMessage[] =
    reply.status === 'idle'
      ? []
      : [{ id: `reply-${round}`, author: 'assistant', text: reply.value, status: reply.status }]
  const items = [...log, ...live]
  const send = (text: string) => {
    const next = round + 1
    // The previous reply becomes part of the log, with the same key
    setLog([...items, { id: `question-${next}`, author: 'user', text }])
    setRound(next)
    reply.start()
    listRef.current?.scrollToEnd()
  }
  const generating = reply.status === 'streaming'
  return (
    <DemoFrame>
      <Stack grow>
        <MessageList
          ref={listRef}
          items={items}
          getKey={(m) => m.id}
          streaming={generating}
          renderItem={(m, i) => (
            <Message
              author={m.author}
              status={m.status}
              showActions={i === items.length - 1 ? 'always' : 'hover'}
              actions={
                m.author === 'assistant' ? (
                  <MessageActions copyText={m.text} onFeedbackChange={() => {}} />
                ) : undefined
              }
            >
              {m.text}
            </Message>
          )}
          empty={<PromptSuggestions items={STARTERS} onSelect={(s) => send(s.label)} />}
        />
      </Stack>
      <Stack padding={3}>
        <PromptInput generating={generating} onStop={reply.stop} onSubmit={(m) => send(m.text)} />
      </Stack>
    </DemoFrame>
  )
}
