import { Button, EmptyState } from 'vellum-ui'

/**
 * Basic usage
 * Explain why the area is empty and offer the next step.
 * @zh 基本用法
 * 说明为什么是空的，并给出下一步。
 */
export function Basic() {
  return (
    <EmptyState
      icon="project"
      title="No projects yet"
      description="Create a project to manage its tasks and documents here"
      action={<Button variant="primary">New project</Button>}
    />
  )
}

/**
 * Small, inside a list
 * @zh 列表内的小尺寸
 * @section Variants
 */
export function Small() {
  return <EmptyState size="sm" icon="search" title="No matching files" />
}
