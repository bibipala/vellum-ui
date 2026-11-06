import { Button, Popconfirm } from 'vellum-ui'

/**
 * Basic usage
 * For actions with a small impact that still need confirmation; irreversible deletions use useConfirmDanger.
 * @zh 基本用法
 * 影响范围小、但仍需确认的操作；不可恢复的删除用 useConfirmDanger。
 */
export function Basic() {
  return (
    <Popconfirm
      title="Remove this grant?"
      description='Alex Morgan will no longer have access to "Website redesign / Mockups".'
      okText="Remove"
      okTone="danger"
      onConfirm={() => {}}
    >
      <Button>Remove</Button>
    </Popconfirm>
  )
}
