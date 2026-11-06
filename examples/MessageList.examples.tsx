import { useRef, useState } from 'react'
import {
  Avatar,
  Button,
  Heading,
  Inline,
  Markdown,
  Message,
  MessageActions,
  type MessageAuthor,
  type MessageFeedback,
  MessageList,
  type MessageListHandle,
  type MessageStatus,
  PromptInput,
  PromptSuggestions,
  Reasoning,
  readSSE,
  type ServerSentEvent,
  type SourceItem,
  Sources,
  Stack,
  Text,
  useStream,
} from 'vellum-ui'
import { DemoFrame } from './_frame.tsx'
import { DEMO_REPLY, fakeSSE } from './_stream.ts'

interface ChatMessage {
  readonly id: string
  readonly author: MessageAuthor
  readonly text: string
  readonly status?: MessageStatus
}

const QUESTION = 'What should we do before the launch?'

/** A long history: questions and replies of different lengths. */
const history = (count: number, first = 0): ChatMessage[] =>
  Array.from({ length: count }, (_, k) => {
    const i = first + k
    return i % 2
      ? {
          id: `m${i}`,
          author: 'assistant',
          text: `Reply ${i}: ${'The team agreed on the next steps. '.repeat((i % 4) + 1)}`,
        }
      : { id: `m${i}`, author: 'user', text: `Question ${i}?` }
  })

// Every event carries {"delta": "..."}; the last one is [DONE]
const appendDelta = (text: string, e: ServerSentEvent) =>
  e.data === '[DONE]' ? text : text + (JSON.parse(e.data) as { delta: string }).delta

function renderMessage(m: ChatMessage, last: boolean) {
  const assistant = m.author === 'assistant'
  return (
    <Message
      author={m.author}
      status={m.status}
      avatar={assistant ? <Avatar name="Assistant" icon="sparkles" size={28} /> : undefined}
      showActions={last ? 'always' : 'hover'}
      actions={assistant ? <MessageActions copyText={m.text} /> : undefined}
    >
      {m.text}
    </Message>
  )
}

/**
 * Basic usage
 * One thousand messages, of which only the visible ones are rendered. "Ask" adds a question and streams a reply
 * (a simulated endpoint read with useStream): the list follows the growing reply. Scroll up while it streams to
 * pause following; "Back to latest" brings you back.
 * @zh 基本用法
 * 一千条消息，只渲染可见的部分。"Ask" 追加一个问题并流式生成回复（用 useStream 读取模拟的接口），列表跟随增长的回复。
 * 生成时向上滚动会暂停跟随，「回到最新」回到末端。
 */
export function Basic() {
  const listRef = useRef<MessageListHandle>(null)
  const [log, setLog] = useState(() => history(1000))
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
  const ask = () => {
    const next = round + 1
    // The previous reply becomes part of the log, with the same key
    setLog([...items, { id: `question-${next}`, author: 'user', text: QUESTION }])
    setRound(next)
    reply.start()
    listRef.current?.scrollToEnd()
  }
  const streaming = reply.status === 'streaming'
  return (
    <Stack gap={3}>
      <Inline gap={2}>
        {streaming ? (
          <Button onClick={reply.stop}>Stop</Button>
        ) : (
          <Button type="primary" onClick={ask}>
            Ask
          </Button>
        )}
      </Inline>
      <DemoFrame>
        <MessageList
          ref={listRef}
          items={items}
          getKey={(m) => m.id}
          streaming={streaming}
          renderItem={(m, i) => renderMessage(m, i === items.length - 1)}
        />
      </DemoFrame>
    </Stack>
  )
}

/**
 * Empty conversation
 * `empty` is shown while there are no messages, for example a welcome text with suggestions.
 * @zh 空对话
 * 没有消息时显示 `empty`，如欢迎语与提示建议。
 * @section States
 */
export function Empty() {
  return (
    <DemoFrame>
      <MessageList
        items={[] as ChatMessage[]}
        getKey={(m) => m.id}
        renderItem={(m) => renderMessage(m, false)}
        empty={
          <Stack gap={2} align="center">
            <Heading level={2}>How can I help?</Heading>
            <Text tone="secondary">Ask about projects, files or the release plan.</Text>
          </Stack>
        }
      />
    </DemoFrame>
  )
}

/**
 * Loading earlier messages
 * Scrolling up near the top calls `onReachStart`; the earlier messages are inserted at the start and the visible
 * ones stay in place. `loadingStart` shows the indicator meanwhile.
 * @zh 加载更早的消息
 * 向上滚动到顶部附近时调用 `onReachStart`；更早的消息插到开头，可见的消息位置不变。加载期间 `loadingStart` 显示加载指示。
 * @section Advanced
 */
export function LoadEarlier() {
  const [first, setFirst] = useState(400)
  const [loading, setLoading] = useState(false)
  const items = history(500 - first, first)
  const loadEarlier = () => {
    setLoading(true)
    // A real page fetches the previous page here
    setTimeout(() => {
      setFirst((n) => Math.max(0, n - 40))
      setLoading(false)
    }, 600)
  }
  return (
    <DemoFrame>
      <MessageList
        items={items}
        getKey={(m) => m.id}
        renderItem={(m) => renderMessage(m, false)}
        onReachStart={first > 0 ? loadEarlier : undefined}
        loadingStart={loading}
      />
    </DemoFrame>
  )
}

const SOURCES: readonly SourceItem[] = [
  {
    key: 'small',
    title: 'Shipping small releases',
    url: 'https://example.com/small-releases',
    description: 'Why teams that release weekly find problems earlier.',
  },
  {
    key: 'checklist',
    title: 'Release checklist template',
    url: 'https://docs.example.org/checklist',
  },
]

const ANSWER = `Here is a plan for the launch week:

1. **Freeze the scope** on Monday — smaller releases surface problems earlier [1].
2. Run the release checklist [2]; anything \`blocked\` moves to the next sprint.
3. Send the announcement on Thursday.

| Day | Owner |
| --- | --- |
| Monday | Alex |
| Thursday | Sam |`

const STARTERS = [
  { key: 'plan', label: 'Plan the launch week', icon: 'sparkles' },
  { key: 'notes', label: 'Summarize the meeting notes', icon: 'file-text' },
] as const

interface Turn {
  readonly id: string
  readonly author: MessageAuthor
  readonly text: string
  readonly status?: MessageStatus
}

/**
 * AI assistant
 * The AI components together: the reply streams in as Markdown with citations, Reasoning shows the thinking step
 * before the first words arrive, Sources lists the references once the reply is done, and the latest reply can be
 * copied, retried and rated. The input stops the reply while it is generating.
 * @zh AI 助手
 * AI 组件的组合：回复以 Markdown 流式出现并带有引用，第一个字到达之前 Reasoning 显示思考过程，回复完成后 Sources 列出来源，
 * 最新的回复可以复制、重试和评价。生成时输入框可以停止回复。
 * @section Advanced
 */
export function Assistant() {
  const listRef = useRef<MessageListHandle>(null)
  const [log, setLog] = useState<Turn[]>([])
  const [round, setRound] = useState(0)
  const [feedback, setFeedback] = useState<Readonly<Record<string, MessageFeedback>>>({})
  const reply = useStream({
    request: (signal) => readSSE(fakeSSE(ANSWER, { signal, interval: 40 }), { signal }),
    initial: '',
    reduce: appendDelta,
  })
  const live: Turn[] =
    reply.status === 'idle'
      ? []
      : [{ id: `reply-${round}`, author: 'assistant', text: reply.value, status: reply.status }]
  const items = [...log, ...live]
  const send = (text: string) => {
    const next = round + 1
    // The finished reply moves into the log with the same key, so its row is not re-created
    setLog([...items, { id: `question-${next}`, author: 'user', text }])
    setRound(next)
    reply.start()
    listRef.current?.scrollToEnd()
  }
  const generating = reply.status === 'streaming'
  const renderTurn = (m: Turn, i: number) => {
    if (m.author === 'user') return <Message author="user">{m.text}</Message>
    const latest = i === items.length - 1
    const streaming = m.status === 'streaming'
    return (
      <Message
        author="assistant"
        avatar={<Avatar name="Assistant" icon="sparkles" size={28} />}
        status={m.status}
        onRetry={reply.start}
        showActions={latest ? 'always' : 'hover'}
        actions={
          streaming ? undefined : (
            <MessageActions
              copyText={m.text}
              onRetry={latest ? reply.start : undefined}
              feedback={feedback[m.id] ?? null}
              onFeedbackChange={(f) => setFeedback((all) => ({ ...all, [m.id]: f }))}
            />
          )
        }
      >
        <Stack gap={3}>
          <Reasoning
            thinking={streaming && !m.text}
            duration={streaming && !m.text ? undefined : 2400}
          >
            The user wants a plan for the launch week. List the steps in order, cite the sources,
            and add a small table of owners.
          </Reasoning>
          {m.text && <Markdown content={m.text} streaming={streaming} sources={SOURCES} />}
          {m.status === 'done' && <Sources items={SOURCES} />}
        </Stack>
      </Message>
    )
  }
  return (
    <DemoFrame>
      <Stack grow>
        <MessageList
          ref={listRef}
          items={items}
          getKey={(m) => m.id}
          streaming={generating}
          renderItem={renderTurn}
          empty={
            <Stack gap={3} align="center">
              <Heading level={2}>How can I help?</Heading>
              <PromptSuggestions items={STARTERS} onSelect={(s) => send(s.label)} />
            </Stack>
          }
        />
      </Stack>
      <Stack padding={3}>
        <PromptInput generating={generating} onStop={reply.stop} onSubmit={(m) => send(m.text)} />
      </Stack>
    </DemoFrame>
  )
}
