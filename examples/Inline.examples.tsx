import { Button, Icon, Inline, Pill, Spacer, Text } from 'vellum-ui'

/**
 * Basic usage
 * Arranges children in a row, vertically centered, with spacing step 2 by default.
 * @zh 基本用法
 * 横向排列，默认垂直居中、间距档位 2。
 */
export function Basic() {
  return (
    <Inline>
      <Icon name="folder" />
      <Text>Shared documents</Text>
      <Pill tone="success">Synced</Pill>
    </Inline>
  )
}

/**
 * Title row with both ends aligned
 * Spacer pushes the action button to the right.
 * @zh 两端对齐的标题行
 * 用 Spacer 把操作按钮推到右侧。
 * @section Variants
 */
export function WithSpacer() {
  return (
    <Inline>
      <Text weight="semibold">Members</Text>
      <Text tone="tertiary" size="sm" numeric>
        12
      </Text>
      <Spacer />
      <Button size="sm">Add</Button>
    </Inline>
  )
}

/**
 * Wrapping tag group
 * Wraps when there is not enough space.
 * @zh 换行的标签组
 * 空间不足时换行。
 * @section Variants
 */
export function Wrapping() {
  return (
    <Inline wrap gap={1}>
      {['Design', 'Development', 'Testing', 'Docs', 'Operations', 'Marketing', 'Support'].map(
        (t) => (
          <Pill key={t}>{t}</Pill>
        ),
      )}
    </Inline>
  )
}
