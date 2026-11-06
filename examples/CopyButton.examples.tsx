import { CopyButton, Inline, Text } from 'vellum-ui'

/**
 * Basic usage
 * An icon button with a tooltip next to the text it copies. After copying, the icon turns into a check mark.
 * @zh 基本用法
 * 放在被复制文字旁的图标按钮，带提示。复制后图标变为勾。
 */
export function Basic() {
  return (
    <Inline gap={2} align="center">
      <Text mono size="sm">
        proj_01HZX4
      </Text>
      <CopyButton text="proj_01HZX4" label="Copy ID" size="sm" />
    </Inline>
  )
}

/**
 * With a label
 * `showLabel` shows the label next to the icon, for a copy action that deserves a button of its own.
 * @zh 带文字
 * `showLabel` 在图标旁显示文字，用于需要单独一个按钮的复制操作。
 * @section Variants
 */
export function WithLabel() {
  return <CopyButton showLabel text="https://example.com/share/r8Kd2" label="Copy link" />
}

/**
 * Handling failures
 * Copying fails without a secure context (HTTPS) or when the browser refuses; the button shows the failed state
 * and `onError` receives the error.
 * @zh 处理失败
 * 没有安全上下文（HTTPS）或浏览器拒绝时复制会失败：按钮显示失败状态，`onError` 收到错误。
 * @section States
 */
export function Failure() {
  return (
    <CopyButton
      showLabel
      text="secret"
      onError={(error) => {
        // Report the error to your monitoring, or show a message
        console.warn(error)
      }}
    />
  )
}
