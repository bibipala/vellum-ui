import { useState } from 'react'
import { Inline, LinkButton, Stack, Text } from 'vellum-ui'

/**
 * Basic usage
 * Accent-colored text without background or underline; the font size follows its context. Use it for edit and
 * archive actions in table rows and for "View" on cards.
 * @zh 基本用法
 * 强调色文字、无底色、无下划线，字号跟随所在位置。表格行内的编辑、归档，卡片上的「查看」都用它。
 */
export function Basic() {
  const [count, setCount] = useState(0)
  return (
    <Stack gap={3}>
      <Inline gap={4}>
        <LinkButton onClick={() => setCount((n) => n + 1)}>Edit</LinkButton>
        <LinkButton>Archive</LinkButton>
        <LinkButton icon="external-link">View details</LinkButton>
      </Inline>
      <Text tone="secondary" size="sm">
        "Edit" clicked {count} times
      </Text>
    </Stack>
  )
}

/**
 * Clickable name
 * A name in a list that opens its details: it does not stand out awkwardly in running text, and its click area
 * extends 4 px beyond the text on each side.
 * @zh 可点击的名称
 * 列表中打开详情的名称：放在正文中也不会显得突兀，点击区域比文字四周各大 4px。
 * @section Variants
 */
export function InlineName() {
  return (
    <Text>
      The document <LinkButton>Annual report</LinkButton> has been updated.
    </Text>
  )
}

/**
 * Destructive actions
 * Use `tone="danger"` for destructive actions in a row, such as removing or revoking access; irreversible actions
 * still need a confirmation (Popconfirm or useConfirmDanger).
 * @zh 危险操作
 * 移除、撤销授权等行内的危险操作用 `tone="danger"`；不可恢复的操作仍需确认（Popconfirm 或 useConfirmDanger）。
 * @section Variants
 */
export function Danger() {
  return (
    <Inline gap={4}>
      <LinkButton tone="danger">Remove</LinkButton>
      <LinkButton tone="danger" icon="alert">
        Failed to send. Retry
      </LinkButton>
    </Inline>
  )
}

/**
 * Disabled and disabled reason
 * When a button is disabled because of permissions or unmet conditions, explain why with `disabledReason`: it
 * appears on hover or keyboard focus, and screen readers read it too.
 * @zh 禁用与禁用原因
 * 因权限或条件不满足而禁用时，用 disabledReason 说明原因：悬停或键盘聚焦时显示，读屏也能读到。
 * @section States
 */
export function Disabled() {
  return (
    <Inline gap={4}>
      <LinkButton disabled>Archive</LinkButton>
      <LinkButton
        disabled
        disabledReason="A project needs at least one owner, so this member cannot be removed"
      >
        Remove
      </LinkButton>
    </Inline>
  )
}
