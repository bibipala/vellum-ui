import { Avatar, CountBadge, Icon, IconButton, ListItem, Stack, Text } from 'vellum-ui'

/**
 * Basic usage
 * Avatar, title, description and time.
 * @zh 基本用法
 * 头像、标题、说明、时间。
 */
export function Basic() {
  return (
    <ListItem
      leading={<Avatar name="Alex Morgan" size={32} />}
      title="Alex Morgan"
      description="The first draft of the home page design is uploaded"
      meta="14:20"
      onClick={() => {}}
    />
  )
}

/**
 * Selected and unread
 * Use `selected` for the item currently open in a split view; put the unread count in `meta`.
 * @zh 选中与未读
 * 主从分栏中当前打开的一项用 selected；未读数放在 meta。
 * @section States
 */
export function States() {
  return (
    <Stack gap={1}>
      <ListItem
        leading={<Avatar name="Design" size={32} />}
        title="Design"
        selected
        onClick={() => {}}
      />
      <ListItem
        leading={<Avatar name="Company" size={32} />}
        title="All members"
        description="Meeting at 3 PM"
        meta={<CountBadge count={5} tone="accent" />}
        onClick={() => {}}
      />
    </Stack>
  )
}

/**
 * Compact row with actions on hover
 * A file list: compact density, and the actions appear only on hover.
 * @zh 紧凑行与悬停操作
 * 文件列表：紧凑密度，操作只在悬停时出现。
 * @section Variants
 */
export function CompactWithActions() {
  return (
    <ListItem
      density="compact"
      leading={<Icon name="file-image" />}
      title="cover.png"
      meta={<Text numeric>48.2 MB</Text>}
      actionsOnHover
      actions={
        <>
          <IconButton icon="download" label="Download" size="sm" />
          <IconButton icon="more" label="More" size="sm" />
        </>
      }
    />
  )
}
