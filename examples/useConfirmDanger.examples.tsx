import { Button, useConfirmDanger } from 'vellum-ui'

/**
 * Basic usage
 * Irreversible actions can only be confirmed after typing the name.
 * @zh 基本用法
 * 不可恢复的操作要求输入名称后才能确认。
 */
export function Basic() {
  const confirm = useConfirmDanger()
  return (
    <Button
      tone="danger"
      onClick={async () => {
        const ok = await confirm({
          title: 'Delete project',
          description:
            'The tasks, documents and member permissions of this project are deleted with it, and cannot be restored.',
          confirmText: 'Website redesign',
          okText: 'Delete',
        })
        if (ok) {
          // Delete the project
        }
      }}
    >
      Delete project
    </Button>
  )
}
