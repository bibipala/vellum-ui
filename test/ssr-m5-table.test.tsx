/**
 * 服务端渲染（M5 DataTable）：没有 window、document、localStorage 时渲染不报错，结构与读屏语义已经在服务端输出：
 * - 一个原生 `<table>`：表格的读屏名称、`<th scope="col">`、排序中的表头带 aria-sort、可排序的表头是按钮；
 * - 选择列：全选与行的复选框有读屏名称；
 * - 列宽手柄是可聚焦的分隔条（定宽列有 aria-valuenow，弹性列要在浏览器中测量后才有）；
 * - 固定列带粘性偏移；`storageKey` 时服务端用默认的列状态（挂载后才读取本机保存的状态，注水一致）；
 * - 虚拟滚动时只输出第一屏的行，并有 aria-rowcount / aria-rowindex；
 * - 空、错误状态。
 */
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DataTable, type DataTableColumn, ThemeProvider } from '../src/index.ts'

afterEach(() => {
  vi.restoreAllMocks()
})

interface Row {
  readonly id: string
  readonly name: string
  readonly owner: string
  readonly size: number
}

const rows: Row[] = Array.from({ length: 5 }, (_, i) => ({
  id: `r${i}`,
  name: `Project ${i}`,
  owner: i % 2 ? 'Alex Kim' : 'Sam Lee',
  size: i * 10,
}))

const columns: DataTableColumn<Row>[] = [
  {
    key: 'name',
    title: 'Name',
    width: 200,
    hideable: false,
    compare: (a, b) => a.name.localeCompare(b.name),
  },
  { key: 'owner', title: 'Owner', truncate: true },
  { key: 'size', title: 'Size', align: 'end', width: 96, sortable: true, pin: 'end' },
]

const ssr = (node: React.ReactNode) =>
  renderToString(<ThemeProvider locale="en-US">{node}</ThemeProvider>)

describe('服务端渲染（M5 DataTable）', () => {
  it('没有浏览器对象时渲染：原生表格、表头、排序、选择、列宽手柄、固定列', () => {
    expect(typeof window).toBe('undefined')
    expect(typeof localStorage).toBe('undefined')
    const error = vi.spyOn(console, 'error')
    const html = ssr(
      <DataTable
        aria-label="Projects"
        testId="dt"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        defaultSort={{ key: 'name', direction: 'desc' }}
        selectable
        defaultSelectedKeys={['r1']}
        storageKey="test.ssr"
        columnSettings
      />,
    )
    expect(html).toMatch(/<table[^>]*aria-label="Projects"/)
    expect(html.match(/<th scope="col"/g)).toHaveLength(4)
    expect(html).toMatch(/<th scope="col"[^>]*aria-sort="descending"[^>]*>\s*<button type="button"/)
    // 本地降序排序
    const order = [...html.matchAll(/>(Project \d)</g)].map((m) => m[1])
    expect(order).toEqual(['Project 4', 'Project 3', 'Project 2', 'Project 1', 'Project 0'])
    expect(html).toContain('aria-label="Select all rows"')
    expect(html.match(/aria-labelledby="[^"]+"/g)).toHaveLength(5)
    expect(html.match(/role="separator"/g)).toHaveLength(3)
    expect(html).toContain('aria-label="Resize Name"')
    expect(html).toMatch(/aria-valuenow="200"[^>]*aria-valuemin="56"[^>]*aria-valuemax="800"/)
    // 弹性列（Owner）的宽度要在浏览器中测量
    expect(html).toMatch(/aria-label="Resize Owner"(?![^>]*aria-valuenow)/)
    // 固定到结尾的列带粘性偏移
    expect(html).toMatch(/data-pin="end"[^>]*style="inset-inline-end:0(px)?"/)
    expect(html).toContain('aria-label="Columns"')
    expect(error).not.toHaveBeenCalled()
  })

  it('虚拟滚动：只输出第一屏，带总行数与行的位置', () => {
    const many = Array.from({ length: 10_000 }, (_, i) => ({
      id: `r${i}`,
      name: `Row ${i}`,
      owner: 'Sam Lee',
      size: i,
    }))
    const html = ssr(
      <DataTable
        aria-label="Logs"
        columns={columns}
        rows={many}
        rowKey={(r) => r.id}
        height={400}
      />,
    )
    expect(html).toMatch(/<table[^>]*aria-rowcount="10001"/)
    const rendered = html.match(/<tr[^>]*aria-rowindex="\d+"/g) ?? []
    expect(rendered.length).toBeGreaterThan(5)
    expect(rendered.length).toBeLessThan(40)
    expect(html).toContain('aria-rowindex="2"')
    expect(html).not.toContain('Row 9999')
  })

  it('空与错误状态', () => {
    const empty = ssr(
      <DataTable aria-label="Projects" columns={columns} rows={[]} rowKey={(r) => r.id} />,
    )
    expect(empty).toContain('No data')
    expect(empty).toMatch(/<table[^>]*data-state="empty"/)
    const failed = ssr(
      <DataTable
        aria-label="Projects"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        error="The server is not reachable."
        onRetry={() => {}}
      />,
    )
    expect(failed).toContain('role="alert"')
    expect(failed).toContain('The server is not reachable.')
    expect(failed).toContain('Retry')
    expect(failed).not.toContain('Project 0')
  })
})
