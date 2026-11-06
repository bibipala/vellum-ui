import { Avatar, Message, MessageActions, Stack } from 'vellum-ui'

const QUESTION = 'Can you summarize the launch checklist in three points?'
const ANSWER = `1. Freeze the scope on Monday.
2. Run the release checklist and move blocked items to the next sprint.
3. Send the announcement on Thursday.`

/**
 * Basic usage
 * The user message is right-aligned in a bubble; the reply is left-aligned with an avatar and a name, and its
 * actions appear on hover or keyboard focus.
 * @zh 基本用法
 * 用户消息靠右、在气泡中；回复靠左，带头像与名字，操作在悬停或键盘聚焦时出现。
 */
export function Basic() {
  return (
    <Stack gap={4}>
      <Message author="user">{QUESTION}</Message>
      <Message
        author="assistant"
        name="Assistant"
        meta="10:42"
        avatar={<Avatar name="Assistant" icon="sparkles" size={28} />}
        actions={<MessageActions copyText={ANSWER} onRetry={() => {}} />}
      >
        {ANSWER}
      </Message>
    </Stack>
  )
}

/**
 * Generating, failed and stopped
 * An empty reply that is still generating shows "Generating" after 200 ms. A failed reply keeps what was received
 * and offers "Retry"; a stopped reply is marked "Stopped".
 * @zh 生成中、失败与已停止
 * 还没有内容的回复在 200ms 后显示「正在生成」。失败的回复保留已经收到的内容并提供「重试」；被停止的回复标注「已停止」。
 * @section States
 */
export function States() {
  return (
    <Stack gap={4}>
      <Message author="assistant" status="streaming" />
      <Message author="assistant" status="error" onRetry={() => {}}>
        Here is a short plan for the
      </Message>
      <Message author="assistant" status="stopped">
        The first step is to freeze the scope
      </Message>
    </Stack>
  )
}

/**
 * Actions always visible
 * `showActions="always"` keeps the actions of the latest reply visible, so they can be found without hovering.
 * @zh 操作始终可见
 * `showActions="always"` 让最新一条回复的操作始终可见，不需要悬停就能找到。
 * @section Variants
 */
export function AlwaysVisible() {
  return (
    <Message
      author="assistant"
      showActions="always"
      actions={<MessageActions copyText={ANSWER} onFeedbackChange={() => {}} />}
    >
      {ANSWER}
    </Message>
  )
}
