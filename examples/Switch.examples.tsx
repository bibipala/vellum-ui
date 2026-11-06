import { Inline, Switch } from 'vellum-ui'

/**
 * Basic usage
 * A binary setting that takes effect immediately.
 * @zh 基本用法
 * 立即生效的二元设置。
 */
export function Basic() {
  return <Switch defaultChecked />
}

/**
 * Loading and disabled
 * Show `loading` while the request for the switch is in progress.
 * @zh 加载与禁用
 * 切换请求进行中时显示 loading。
 * @section States
 */
export function States() {
  return (
    <Inline gap={3}>
      <Switch loading defaultChecked />
      <Switch disabled />
      <Switch size="sm" defaultChecked />
    </Inline>
  )
}
