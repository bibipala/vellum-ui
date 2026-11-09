import { Box, Grid, Text } from 'vellum-ui'

/**
 * Basic usage
 * Without a number of columns, the grid fills the row automatically by minimum column width (`md`, 240 px, by
 * default).
 * @zh 基本用法
 * 不指定列数时按最小列宽（默认 md 240px）自动填充。
 */
export function Basic() {
  return (
    <Grid>
      {['Files', 'Messages', 'Members', 'Documents', 'Settings'].map((t) => (
        <Box key={t} surface="surface" border radius="lg" padding={4}>
          <Text weight="medium">{t}</Text>
        </Box>
      ))}
    </Grid>
  )
}

/**
 * Two fixed columns
 * Use a fixed number of columns for two-column forms and details.
 * @zh 固定两栏
 * 表单两栏、详情两栏用固定列数。
 * @section Variants
 */
export function TwoColumns() {
  return (
    <Grid columns={2} gap={4}>
      <Text tone="secondary">Username</Text>
      <Text mono>alex.morgan</Text>
      <Text tone="secondary">Team</Text>
      <Text>Design</Text>
    </Grid>
  )
}

/**
 * Spanning columns
 * `Grid.Item` with `span` makes a cell wider: two columns for a wide block, `full` for the whole row.
 * @zh 跨列
 * 带 `span` 的 `Grid.Item` 让格子更宽：两列用于较宽的区块，`full` 占满整行。
 * @section Variants
 */
export function Spanning() {
  return (
    <Grid columns={3}>
      <Grid.Item span={2}>
        <Box surface="surface" border radius="lg" padding={4}>
          <Text weight="medium">Traffic (two columns)</Text>
        </Box>
      </Grid.Item>
      <Box surface="surface" border radius="lg" padding={4}>
        <Text weight="medium">Sign-ups</Text>
      </Box>
      <Grid.Item span="full">
        <Box surface="surface" border radius="lg" padding={4}>
          <Text weight="medium">Orders (whole row)</Text>
        </Box>
      </Grid.Item>
    </Grid>
  )
}
