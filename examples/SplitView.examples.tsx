import { Avatar, CountBadge, EmptyState, ListItem, SplitView, Stack } from 'vellum-ui'

/**
 * Basic usage
 * Select in the list on the left, see the content on the right; an empty state is shown while nothing is
 * selected.
 * @zh 基本用法
 * 左侧列表选择，右侧显示内容；未选择时显示空状态。
 */
export function Basic() {
  return (
    <SplitView
      aside={
        <Stack gap={1} padding={2}>
          <ListItem
            title="Design"
            leading={<Avatar name="Design" size={28} />}
            selected
            onClick={() => {}}
          />
          <ListItem
            title="Engineering"
            leading={<Avatar name="Engineering" size={28} />}
            meta={<CountBadge count={3} />}
            onClick={() => {}}
          />
        </Stack>
      }
    >
      <EmptyState icon="users" title="Select a team on the left to see its members" fill />
    </SplitView>
  )
}

/**
 * Flush split
 * Full-screen interfaces (such as a chat) use `flush`, without panel borders.
 * @zh 贴边分割
 * 全屏界面（如聊天）用 flush，没有面板边框。
 * @section Variants
 */
export function Flush() {
  return (
    <SplitView variant="flush" asideWidth="lg" aside={<Stack padding={3}>Conversations</Stack>}>
      <Stack padding={3}>Messages</Stack>
    </SplitView>
  )
}
