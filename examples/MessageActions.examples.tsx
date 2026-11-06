import { useState } from 'react'
import { IconButton, MessageActions, type MessageFeedback, Text } from 'vellum-ui'

const REPLY = 'The release is planned for Thursday at 10:00.'

/**
 * Basic usage
 * Copy, retry, like and dislike. Like and dislike exclude each other, and pressing the pressed one again clears
 * it. The group has one `Tab` stop; `←` / `→` move between the buttons.
 * @zh 基本用法
 * 复制、重试、赞、踩。赞与踩互斥，再次按下已按下的按钮会取消。整组只占一个 `Tab` 位置，`←` / `→` 在按钮之间移动。
 */
export function Basic() {
  const [feedback, setFeedback] = useState<MessageFeedback>(null)
  return (
    <>
      <MessageActions
        copyText={REPLY}
        onRetry={() => {}}
        feedback={feedback}
        onFeedbackChange={setFeedback}
      />
      <Text tone="tertiary" size="sm">
        Feedback: {feedback ?? 'none'}
      </Text>
    </>
  )
}

/**
 * Your own actions
 * Icon buttons passed as children come after the built-in ones and take part in the arrow key navigation.
 * @zh 自己的操作
 * 作为子元素传入的图标按钮排在内置操作之后，同样可以用方向键切换。
 * @section Advanced
 */
export function CustomActions() {
  return (
    <MessageActions copyText={REPLY}>
      <IconButton icon="share" size="sm" label="Share" onClick={() => {}} />
      <IconButton icon="more" size="sm" label="More" onClick={() => {}} />
    </MessageActions>
  )
}
