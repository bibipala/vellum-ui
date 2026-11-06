import { Alert, Stack } from 'vellum-ui'

/**
 * Basic usage
 * Persistent information in an area that needs the user's attention; `type` sets the meaning.
 * @zh 基本用法
 * 区域内需要用户注意的持续性信息，`type` 区分语义。
 */
export function Basic() {
  return (
    <Stack gap={3}>
      <Alert type="info" showIcon title="Files are still syncing; the list may be incomplete." />
      <Alert
        type="warning"
        showIcon
        title="This token is shown only once. Copy and store it now."
      />
    </Stack>
  )
}

/**
 * With description and actions
 * @zh 带说明与操作
 * @section Variants
 */
export function WithDescription() {
  return (
    <Alert
      type="error"
      showIcon
      title="Connection failed"
      description="Cannot reach the server. Check your network connection and whether your account is still valid."
    />
  )
}
