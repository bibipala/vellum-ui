import { useState } from 'react'
import { ContextMenu, ListItem, Stack, Text } from 'vellum-ui'

const files = ['Brief.pdf', 'Moodboard.png', 'Budget.xlsx']

/**
 * Basic usage
 * Right click a row, or focus it and press `Shift+F10` (or the menu key). The rows are focusable, so keyboard
 * users can open the menu too.
 * @zh 基本用法
 * 在行上右键，或聚焦后按 `Shift+F10`（或菜单键）。行可以聚焦，键盘用户同样能打开菜单。
 */
export function Basic() {
  const [last, setLast] = useState('Nothing yet')
  return (
    <Stack gap={2}>
      <Stack gap={1}>
        {files.map((name) => (
          <ContextMenu
            key={name}
            onSelect={(key) => setLast(`${key}: ${name}`)}
            items={[
              { key: 'open', label: 'Open', icon: 'external-link' },
              { key: 'rename', label: 'Rename', icon: 'edit', shortcut: 'f2' },
              { key: 'copy', label: 'Copy link', icon: 'link', shortcut: 'mod+shift+c' },
              { type: 'divider' },
              { key: 'delete', label: 'Delete', icon: 'trash', danger: true, shortcut: 'delete' },
            ]}
          >
            <ListItem title={name} onClick={() => {}} />
          </ContextMenu>
        ))}
      </Stack>
      <Text size="sm" tone="secondary">
        Last action: {last}
      </Text>
    </Stack>
  )
}

function Card() {
  const [archived, setArchived] = useState(false)
  return (
    <ContextMenu
      items={[
        { key: 'download', label: 'Download', icon: 'download' },
        { key: 'share', label: 'Share', icon: 'link', disabled: true },
        { type: 'divider' },
        {
          key: 'archive',
          label: archived ? 'Restore' : 'Archive',
          icon: 'archive',
          onClick: () => setArchived((a) => !a),
        },
      ]}
    >
      <ListItem
        title="Q3 review deck"
        description={archived ? 'Archived' : 'Sharing is turned off for this file'}
        onClick={() => {}}
      />
    </ContextMenu>
  )
}

/**
 * Disabled items and dividers
 * Disabled items are shown but skipped by `↑` / `↓`; dividers separate groups of actions. Each item can have an
 * `onClick` of its own.
 * @zh 禁用项与分隔线
 * 禁用项照常显示，但 `↑` / `↓` 会跳过它；分隔线把操作分组。每个菜单项可以有自己的 `onClick`。
 * @section States
 */
export function DisabledItems() {
  return <Card />
}
