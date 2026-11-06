import { Button, DataTable, Input, Page, Panel, Toolbar } from 'vellum-ui'

const rows = [
  { id: '1', name: 'Website redesign', kind: 'Design' },
  { id: '2', name: 'Brand guidelines', kind: 'Document' },
]

/**
 * Basic usage
 * A list page: title, subtitle and primary action, a search box in the toolbar, and the table wrapped in a
 * Panel.
 * @zh 基本用法
 * 列表页：标题、说明、主操作，工具栏放搜索，内容用 Panel 包裹表格。
 */
export function Basic() {
  return (
    <Page
      title="Projects"
      subtitle="Active and archived projects of the team"
      actions={<Button variant="primary">New project</Button>}
      toolbar={
        <Toolbar>
          <Input.Search placeholder="Search by name" allowClear />
        </Toolbar>
      }
    >
      <Panel flush>
        <DataTable
          aria-label="Projects"
          rowKey={(r) => r.id}
          rows={rows}
          columns={[
            { key: 'name', title: 'Name' },
            { key: 'kind', title: 'Type' },
          ]}
        />
      </Panel>
    </Page>
  )
}

/**
 * Narrow page
 * Forms and settings pages use `narrow` for a more comfortable reading width.
 * @zh 窄页面
 * 表单与设置页用 narrow，阅读宽度更舒适。
 * @section Variants
 */
export function Narrow() {
  return (
    <Page title="Personal settings" width="narrow">
      <Panel>…</Panel>
    </Page>
  )
}
