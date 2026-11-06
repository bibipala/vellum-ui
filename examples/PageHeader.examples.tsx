import { Button, IconButton, PageHeader } from 'vellum-ui'

/**
 * Basic usage
 * The primary action goes rightmost; secondary actions go to its left.
 * @zh 基本用法
 * 主操作放最右；次要操作在左侧。
 */
export function Basic() {
  return (
    <PageHeader
      title="Roles and access"
      subtitle="Roles define what can be done, grants define who can do it"
      actions={
        <>
          <IconButton icon="refresh" label="Refresh" />
          <Button type="primary">New role</Button>
        </>
      }
    />
  )
}
