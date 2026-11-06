import { Button, Inline, Tooltip } from 'vellum-ui'

/**
 * Basic usage
 * Appears after hovering for 500 ms, so it does not flash while the pointer passes over.
 * @zh 基本用法
 * 悬停 500ms 后出现，避免鼠标划过时闪烁。
 */
export function Basic() {
  return (
    <Tooltip title="Sync the files changed in the last 24 hours">
      <Button>Incremental sync</Button>
    </Tooltip>
  )
}

/**
 * Explaining a disabled state
 * A disabled button does not receive mouse events, so a `span` around it receives the hover.
 * @zh 解释禁用原因
 * 禁用的按钮不触发鼠标事件，用一层 span 承接悬停。
 * @section Advanced
 */
export function DisabledReason() {
  return (
    <Inline>
      <Tooltip title='An administrator must grant you the "Manage projects" permission'>
        <span>
          <Button disabled>New project</Button>
        </span>
      </Tooltip>
    </Inline>
  )
}
