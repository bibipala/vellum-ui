import { IconButton, Inline } from 'vellum-ui'

/**
 * Basic usage
 * `label` is required: it is the tooltip and the accessible name.
 * @zh 基本用法
 * label 必填：作为悬停提示与读屏名称。
 */
export function Basic() {
  return (
    <Inline gap={1}>
      <IconButton icon="refresh" label="Refresh" />
      <IconButton icon="download" label="Download" />
      <IconButton icon="more" label="More" />
    </Inline>
  )
}

/**
 * Variants and sizes
 * `soft` suits places that need a visible boundary; `accent` is for main actions such as sending; `active` is the
 * pressed state of a toggle button.
 * @zh 变体与尺寸
 * soft 用于需要边界感的位置；accent 用于发送等主操作；active 表示切换按钮的按下态。
 * @section Variants
 */
export function Variants() {
  return (
    <Inline gap={2}>
      <IconButton icon="grid" label="Grid view" variant="soft" active />
      <IconButton icon="list" label="List view" variant="soft" />
      <IconButton icon="send" label="Send" variant="accent" size="lg" />
      <IconButton icon="close" label="Remove" size="sm" />
    </Inline>
  )
}

/**
 * Disabled reason
 * When a button is disabled because of permissions or unmet conditions, explain why with `disabledReason`: hover
 * or keyboard focus shows "label: reason".
 * @zh 禁用原因
 * 因权限或条件不满足而禁用时，用 disabledReason 说明原因：悬停或键盘聚焦时显示「说明：原因」。
 * @section States
 */
export function DisabledReason() {
  return (
    <Inline gap={1}>
      <IconButton
        icon="download"
        label="Download"
        disabled
        disabledReason="You do not have permission to download"
      />
      <IconButton icon="trash" label="Delete" disabled />
    </Inline>
  )
}
