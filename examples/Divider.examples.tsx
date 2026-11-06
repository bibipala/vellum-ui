import { Divider, Stack, Text } from 'vellum-ui'

/**
 * Basic usage
 * Separate levels with spacing and backgrounds first; use a divider only when a line is really needed.
 * @zh 基本用法
 * 层次优先用间距与底色区分，确实需要一条线时才用分隔线。
 */
export function Basic() {
  return (
    <Stack gap={0}>
      <Text>Yesterday's messages</Text>
      <Divider />
      <Text>Today's messages</Text>
    </Stack>
  )
}

/**
 * With text
 * Date separators in a message list.
 * @zh 带文字
 * 消息列表的日期分隔。
 * @section Variants
 */
export function WithText() {
  return <Divider plain>November 4</Divider>
}
