import { Dropdown, Icon, IconButton } from 'vellum-ui'

/**
 * Basic usage
 * A "More" menu in a row: the trigger is an IconButton, and a click opens the menu.
 * @zh 基本用法
 * 行内「更多」操作：触发元素用 IconButton，点击弹出菜单。
 */
export function Basic() {
  return (
    <Dropdown
      trigger={['click']}
      menu={{
        items: [
          { key: 'rename', icon: <Icon name="edit" />, label: 'Rename' },
          { key: 'move', icon: <Icon name="folder" />, label: 'Move to...' },
          { type: 'divider' },
          { key: 'delete', icon: <Icon name="trash" />, label: 'Delete', danger: true },
        ],
        onClick: () => {},
      }}
    >
      <IconButton icon="more" label="More actions" />
    </Dropdown>
  )
}
