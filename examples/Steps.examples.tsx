import { useState } from 'react'
import { Button, Inline, Stack, Steps } from 'vellum-ui'

const items = [
  { title: 'Details', content: 'Name and owner' },
  { title: 'Members', content: 'Who has access' },
  { title: 'Review', content: 'Check and create' },
]

/**
 * Basic usage
 * Steps before `current` are finished and show a check mark; the current step uses the accent color.
 * @zh 基本用法
 * `current` 之前的步骤为已完成并显示勾，当前步骤用强调色。
 */
export function Basic() {
  return <Steps current={1} items={items} aria-label="Project setup" />
}

/**
 * Clickable steps
 * With `onChange`, steps are buttons: `Tab` focuses them and `Enter` / `Space` go to a step.
 * @zh 可点击的步骤
 * 提供 `onChange` 时步骤是按钮：`Tab` 聚焦，`Enter` / 空格切换到该步骤。
 * @section Variants
 */
export function Clickable() {
  const [current, setCurrent] = useState(0)
  return (
    <Stack gap={4}>
      <Steps current={current} onChange={setCurrent} items={items} aria-label="Project setup" />
      <Inline gap={2}>
        <Button disabled={current === 0} onClick={() => setCurrent(current - 1)}>
          Back
        </Button>
        <Button
          variant="primary"
          disabled={current === items.length - 1}
          onClick={() => setCurrent(current + 1)}
        >
          Next
        </Button>
      </Inline>
    </Stack>
  )
}

/**
 * Vertical, small and error
 * `orientation="vertical"` for a narrow column, `size="small"` for dense layouts, and `status="error"` marks the
 * current step as failed.
 * @zh 纵向、小尺寸与出错
 * 窄列中用 `orientation="vertical"`，紧凑布局用 `size="small"`；`status="error"` 表示当前步骤失败。
 * @section Variants
 */
export function Variants() {
  return (
    <Inline gap={6} align="start">
      <Steps
        orientation="vertical"
        current={2}
        items={[
          { title: 'Submitted', content: 'Mar 3, 09:12' },
          { title: 'Approved', content: 'Mar 3, 14:40' },
          { title: 'Paid', content: 'Waiting for payment' },
        ]}
      />
      <Steps size="small" current={1} status="error" items={items} />
    </Inline>
  )
}
