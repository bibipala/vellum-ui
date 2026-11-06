import { Stack, Text } from 'vellum-ui'

/**
 * Basic usage
 * Body text, secondary descriptions and faint hints.
 * @zh 基本用法
 * 正文、次要说明与弱提示。
 */
export function Basic() {
  return (
    <Stack gap={1}>
      <Text>Body text</Text>
      <Text tone="secondary" size="sm">
        Secondary description
      </Text>
      <Text tone="tertiary" size="xs">
        Faint hint
      </Text>
    </Stack>
  )
}

/**
 * Codes, paths and numbers
 * Codes and paths use the monospace font; amounts, quantities and times use tabular numbers to align vertically.
 * @zh 编号、路径与数字
 * 编号和路径用等宽字体；金额、数量、时间用等宽数字纵向对齐。
 * @section Variants
 */
export function MonoAndNumeric() {
  return (
    <Stack gap={1}>
      <Text mono size="sm">
        PRJ-2026-0042
      </Text>
      <Text numeric>1,234.50</Text>
      <Text as="time" dateTime="2026-11-03" numeric tone="secondary" size="sm">
        2026-11-03 14:20
      </Text>
    </Stack>
  )
}

/**
 * Overline
 * @zh 分组小标题
 * @section Variants
 */
export function Overline() {
  return <Text overline>Quick access</Text>
}

/**
 * Truncate
 * Truncated to one line; the full text is shown on hover.
 * @zh 省略
 * 单行省略，悬停显示完整文本。
 * @section States
 */
export function Truncate() {
  const long =
    'Documents/2026 plan/Marketing/Final/Q4 marketing plan - final - approved for external release.pdf'
  return (
    <Stack gap={1}>
      <Text truncate title={long}>
        {long}
      </Text>
      <Text truncate={2} tone="secondary" size="sm">
        Truncating to two lines suits summaries in lists: this is a fairly long description, and
        whatever does not fit in two lines is replaced by an ellipsis, so that all rows of the list
        keep the same height.
      </Text>
    </Stack>
  )
}
