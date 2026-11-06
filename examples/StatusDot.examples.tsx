import { Inline, StatusDot, Text } from 'vellum-ui'

/**
 * Basic usage
 * The caller maps the business meaning to a tone and describes it with `aria-label`; combine it with Text when
 * visible text is shown next to it.
 * @zh 基本用法
 * 业务含义由调用方映射到色调，并用 `aria-label` 说明；旁边有可见文字时与 Text 组合。
 */
export function Basic() {
  return (
    <Inline gap={4}>
      <Inline gap={1}>
        <StatusDot tone="success" aria-label="Online" />
        <Text size="sm">Online</Text>
      </Inline>
      <Inline gap={1}>
        <StatusDot tone="warning" aria-label="Away" />
        <Text size="sm">Away</Text>
      </Inline>
      <Inline gap={1}>
        <StatusDot tone="neutral" aria-label="Offline" />
        <Text size="sm">Offline</Text>
      </Inline>
    </Inline>
  )
}

/**
 * All tones
 * `success` normal, `warning` attention, `danger` error, `neutral` inactive, `accent` notice.
 * @zh 全部色调
 * success 正常、warning 注意、danger 异常、neutral 未激活、accent 提醒。
 * @section Variants
 */
export function Tones() {
  return (
    <Inline gap={3}>
      <StatusDot tone="success" aria-label="Running" />
      <StatusDot tone="warning" aria-label="Sync delayed" />
      <StatusDot tone="danger" aria-label="Connection failed" />
      <StatusDot tone="neutral" aria-label="Disabled" />
      <StatusDot tone="accent" aria-label="Update available" />
    </Inline>
  )
}
