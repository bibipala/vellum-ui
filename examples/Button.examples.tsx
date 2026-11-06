import { useState } from 'react'
import { Button, Icon, Inline } from 'vellum-ui'

/**
 * Basic usage
 * At most one primary button per area; add `danger` for destructive actions.
 * @zh 基本用法
 * 每个区域最多一个主按钮；危险操作加 danger。
 */
export function Basic() {
  return (
    <Inline>
      <Button type="primary">Save</Button>
      <Button>Cancel</Button>
      <Button danger>Delete</Button>
    </Inline>
  )
}

/**
 * Loading and disabled
 * Show `loading` while submitting to prevent double submission. The width does not change while loading: a button
 * with an icon replaces the icon with the loading indicator; a button without one hides its text and centers the
 * indicator.
 * @zh 加载与禁用
 * 提交中显示 loading，防止重复提交。加载时宽度不变：有图标的把图标换成加载指示，没有图标的文字隐藏、指示居中。
 * @section States
 */
export function States() {
  return (
    <Inline>
      <Button type="primary" loading>
        Save
      </Button>
      <Button loading icon={<Icon name="download" />}>
        Export
      </Button>
      <Button disabled>Unavailable</Button>
    </Inline>
  )
}

/**
 * Loading after a click
 * Clicks are ignored while loading and the width of the button stays the same, so the content next to it does not
 * move.
 * @zh 点击后加载
 * 加载期间忽略点击，按钮宽度不变，旁边的内容不会跳动。
 * @section States
 */
export function LoadOnClick() {
  const [loading, setLoading] = useState(false)
  return (
    <Inline>
      <Button
        type="primary"
        loading={loading}
        onClick={() => {
          setLoading(true)
          setTimeout(() => setLoading(false), 1200)
        }}
      >
        Save changes
      </Button>
      <Button>Cancel</Button>
    </Inline>
  )
}

/**
 * Disabled reason
 * When a button is disabled because of permissions or unmet conditions, explain why with `disabledReason`: it
 * appears on hover or keyboard focus, and screen readers read it too.
 * @zh 禁用原因
 * 因权限或条件不满足而禁用时，用 disabledReason 说明原因：悬停或键盘聚焦时显示，读屏也能读到。
 * @section States
 */
export function DisabledReason() {
  return (
    <Inline>
      <Button
        type="primary"
        danger
        disabled
        disabledReason="You do not have permission to delete. Contact an administrator."
      >
        Delete project
      </Button>
      <Button disabled disabledReason="Select a file first">
        Download
      </Button>
    </Inline>
  )
}
