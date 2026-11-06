import { Button, DataTable, Panel, SettingRow, Switch, Text } from 'vellum-ui'

/**
 * Basic usage
 * A panel with a title and actions.
 * @zh 基本用法
 * 带标题与操作的面板。
 */
export function Basic() {
  return (
    <Panel title="Details" actions={<Button size="small">Edit</Button>}>
      <Text tone="secondary">The content of a panel has a padding of step 4 by default</Text>
    </Panel>
  )
}

/**
 * Flush content
 * Use `flush` for tables and lists inside a panel, so that the content reaches the edges.
 * @zh 贴边内容
 * 表格、列表放在面板里时用 flush，内容贴边。
 * @section Variants
 */
export function Flush() {
  return (
    <Panel flush>
      <DataTable
        aria-label="Projects"
        rowKey={(r) => r.id}
        rows={[{ id: '1', name: 'Website redesign' }]}
        columns={[{ key: 'name', title: 'Name' }]}
      />
    </Panel>
  )
}

/**
 * Settings panel
 * @zh 设置面板
 * @section Advanced
 */
export function Settings() {
  return (
    <Panel title="Chat">
      <SettingRow
        title="Recall messages"
        description="Messages can be recalled within 2 minutes of sending"
        control={<Switch defaultChecked />}
      />
      <SettingRow title="Read receipts" control={<Switch />} />
    </Panel>
  )
}
