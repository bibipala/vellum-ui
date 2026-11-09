import { useRef } from 'react'
import { Button, DataTable, Input, Page, Panel, Text, Toolbar } from 'vellum-ui'

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

/**
 * Back action and title focus
 * A detail page goes back to its list with `back` (a link with `href`). After a client-side navigation, focus the
 * title through `titleRef`, so that screen readers announce the new page.
 * @zh 返回操作与标题聚焦
 * 详情页用 `back` 回到列表（有 `href` 时是链接）。客户端路由切换页面后，通过 `titleRef` 聚焦标题，读屏会读出新页面。
 * @section Advanced
 */
export function BackAndFocus() {
  const titleRef = useRef<HTMLHeadingElement>(null)
  return (
    <Page
      title="Website redesign"
      subtitle="Owned by Alex Kim"
      back={{ label: 'Back to projects', href: '#projects' }}
      titleRef={titleRef}
      actions={
        // In an application, call titleRef.current?.focus() when the route changes
        <Button onClick={() => titleRef.current?.focus()}>Focus the title</Button>
      }
    >
      <Panel>
        <Text tone="secondary">(details of the project)</Text>
      </Panel>
    </Page>
  )
}
