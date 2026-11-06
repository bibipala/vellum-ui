import { Avatar, Inline, Panel, Pill, Table, Text } from 'vellum-ui'

/**
 * Basic usage
 * Statuses use Pill, the member column uses Avatar and Text; inside a Panel, add `flush` so the table reaches the
 * edges.
 * @zh 基本用法
 * 状态用 Pill，成员列用 Avatar + Text；放在 Panel 中时加 `flush` 让表格贴边。
 */
export function Basic() {
  return (
    <Panel flush>
      <Table
        rowKey="id"
        pagination={false}
        dataSource={[
          { id: '1', name: 'Alex Morgan', status: 'active' },
          { id: '2', name: 'Sam Lee', status: 'inactive' },
        ]}
        columns={[
          {
            title: 'Name',
            dataIndex: 'name',
            render: (n: string) => (
              <Inline gap={2}>
                <Avatar name={n} size={20} />
                <Text size="sm" truncate>
                  {n}
                </Text>
              </Inline>
            ),
          },
          {
            title: 'Status',
            dataIndex: 'status',
            render: (s: string) =>
              s === 'active' ? (
                <Pill tone="success" dot>
                  Active
                </Pill>
              ) : (
                <Pill dot>Disabled</Pill>
              ),
          },
        ]}
      />
    </Panel>
  )
}

/**
 * No data
 * An empty state is shown automatically when there is no data.
 * @zh 空数据
 * 没有数据时自动显示空状态。
 * @section States
 */
export function Empty() {
  return (
    <Panel flush>
      <Table rowKey="id" dataSource={[]} columns={[{ title: 'Name', dataIndex: 'name' }]} />
    </Panel>
  )
}
