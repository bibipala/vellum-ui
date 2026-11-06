import { Descriptions, Pill } from 'vellum-ui'

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
 * Child elements
 * With few fields, or when fields are rendered conditionally, `Descriptions.Item` can be used as well.
 * @zh 子元素写法
 * 字段较少、需要条件渲染时也可以用 `Descriptions.Item`。
 * @section Variants
 */
export function Items() {
  return (
    <Descriptions column={1} size="sm">
      <Descriptions.Item label="Endpoint">GET /api/projects</Descriptions.Item>
      <Descriptions.Item label="Permission">Read only</Descriptions.Item>
    </Descriptions>
  )
}
