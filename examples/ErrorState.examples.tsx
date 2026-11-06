import { ErrorState } from 'vellum-ui'

/**
 * Basic usage
 * Replaces the content when a request fails and offers a retry. `message` is converted, user-readable text; do
 * not show the raw exception.
 * @zh 基本用法
 * 请求失败时代替内容显示，提供重试。message 是转换后的用户可读文本，不要显示原始异常。
 */
export function Basic() {
  return (
    <ErrorState
      message='The project "Website redesign" cannot be loaded right now: the network is unreachable'
      onRetry={() => {}}
    />
  )
}

/**
 * Small, inside a panel
 * @zh 面板内的小尺寸
 * @section Variants
 */
export function Small() {
  return <ErrorState size="sm" message="You do not have permission to view this folder" />
}
