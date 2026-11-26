import { Descriptions, Pill } from 'vellum-ui'

const endpoint: { path: string; permission?: string } = {
  path: 'GET /api/projects',
  permission: 'Read only',
}

/**
 * Basic usage
 * Give the fields in `items`; `column` sets the number of columns.
 * @zh 基本用法
 * 用 `items` 给出字段；`column` 控制列数。
 */
export function Basic() {
  return (
    <Descriptions
      column={2}
      items={[
        { key: 'name', label: 'Name', children: 'Alex Morgan' },
        { key: 'username', label: 'Username', children: 'alex.morgan' },
        { key: 'team', label: 'Team', children: 'Design' },
        {
          key: 'status',
          label: 'Status',
          children: (
            <Pill tone="success" dot>
              Active
            </Pill>
          ),
        },
      ]}
    />
  )
}

/**
 * Fields shown conditionally
 * Leave a field out of `items` when it has no value; `size="sm"` fits drawers and panels.
 * @zh 按条件显示的字段
 * 没有值的字段不放进 `items`；`size="sm"` 适合抽屉与面板。
 * @section Variants
 */
export function Conditional() {
  return (
    <Descriptions
      column={1}
      size="sm"
      items={[
        { key: 'endpoint', label: 'Endpoint', children: endpoint.path },
        ...(endpoint.permission
          ? [{ key: 'permission', label: 'Permission', children: endpoint.permission }]
          : []),
      ]}
    />
  )
}
