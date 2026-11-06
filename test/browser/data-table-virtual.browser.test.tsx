/**
 * DataTable 在真实浏览器中的交互（三）：虚拟滚动与高度。
 * - 1 万行：DOM 中的行数有界（与数据量无关），表格带 aria-rowcount，行带 aria-rowindex；
 * - 滚动到底能看到最后一行；表头吸顶；固定列在纵向、横向滚动时都不动，调整过的列宽在新出现的行上同样生效；
 * - 全选选中全部 1 万行；不超过 100 行时不虚拟化；`virtual={false}` 关闭；
 * - fill：占满父元素的高度，行在其中滚动。
 */
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { DataTable, type DataTableColumn, type DataTableProps } from '../../src/index.ts'
import { nextFrame, page, render, userEvent } from './render.tsx'

interface Row {
  readonly id: string
  readonly name: string
  readonly owner: string
  readonly size: number
}

const make = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `r${i}`,
    name: `Row ${i}`,
    owner: ['Sam Lee', 'Alex Kim', 'Riley Chen'][i % 3] as string,
    size: i,
  }))

const many = make(10_000)

const columns: DataTableColumn<Row>[] = [
  { key: 'name', title: 'Name', width: 160, pin: 'start' },
  { key: 'owner', title: 'Owner', width: 400 },
  { key: 'notes', title: 'Notes', width: 400 },
  { key: 'size', title: 'Size', width: 120, align: 'end' },
]

function Table(props: Partial<DataTableProps<Row>>) {
  return (
    <div style={{ width: 640 }}>
      <DataTable
        aria-label="Logs"
        columns={columns}
        rows={many}
        rowKey={(r) => r.id}
        height={400}
        {...props}
      />
    </div>
  )
}

const table = () => page.getByRole('table', { name: 'Logs' }).element() as HTMLTableElement
const scroller = () => table().parentElement as HTMLElement
const dataRows = () => [...table().querySelectorAll('tbody tr[aria-rowindex]')]
const frames = async (n = 4) => {
  for (let i = 0; i < n; i++) await nextFrame()
}
/** 在滚动容器的可见范围内（表头以下）。 */
function visibleIn(el: Element) {
  const r = el.getBoundingClientRect()
  const s = scroller().getBoundingClientRect()
  const head = table().tHead?.getBoundingClientRect().height ?? 0
  return r.top >= s.top + head - 1 && r.bottom <= s.bottom + 1
}

/** 受控多选，输出已选的数量。 */
function Selecting() {
  const [keys, setKeys] = useState<readonly string[]>([])
  return (
    <>
      <Table selectable selectedKeys={keys} onSelectionChange={setKeys} />
      <output>{keys.length}</output>
    </>
  )
}

describe('DataTable：虚拟滚动', () => {
  it('1 万行：只渲染可见附近的行，带总行数与行的位置；滚动到底能看到最后一行', async () => {
    await render(<Table />)
    await frames()
    expect(table().getAttribute('aria-rowcount')).toBe('10001')
    expect(table().tHead?.rows[0]?.getAttribute('aria-rowindex')).toBe('1')
    const first = dataRows()
    expect(first.length).toBeGreaterThan(5)
    expect(first.length).toBeLessThan(40)
    expect(first[0]?.getAttribute('aria-rowindex')).toBe('2')
    expect(first[0]?.textContent).toContain('Row 0')
    // 滚动容器的总高度对应全部行
    expect(scroller().scrollHeight).toBeGreaterThan(10_000 * 40)
    scroller().scrollTop = scroller().scrollHeight
    await frames(6)
    const last = dataRows().find((r) => r.getAttribute('aria-rowindex') === '10001')
    expect(last?.textContent).toContain('Row 9999')
    expect(visibleIn(last as Element)).toBe(true)
    expect(dataRows().length).toBeLessThan(40)
    // 表头吸顶
    const head = table().tHead?.rows[0]?.cells[0] as HTMLElement
    expect(Math.round(head.getBoundingClientRect().top)).toBe(
      Math.round(scroller().getBoundingClientRect().top),
    )
    // 滚到中间
    scroller().scrollTop = scroller().scrollHeight / 2
    await frames(6)
    const mid = dataRows().filter(visibleIn)
    expect(mid.length).toBeGreaterThan(3)
    const index = Number(mid[0]?.getAttribute('aria-rowindex'))
    expect(index).toBeGreaterThan(4000)
    expect(index).toBeLessThan(6000)
    expect(mid[0]?.textContent).toContain(`Row ${index - 2}`)
  })

  it('固定列在纵向、横向滚动时都不动；调整过的列宽在新出现的行上同样生效', async () => {
    await render(<Table />)
    await frames()
    const nameLeft = Math.round(
      (dataRows()[0] as HTMLTableRowElement).cells[0]?.getBoundingClientRect().left ?? 0,
    )
    scroller().scrollLeft = 200
    scroller().scrollTop = 30_000
    await frames(6)
    const row = dataRows().find(visibleIn) as HTMLTableRowElement
    expect(Math.round(row.cells[0]?.getBoundingClientRect().left ?? 0)).toBe(nameLeft)
    page.getByRole('separator', { name: 'Resize Owner' }).element().focus()
    await userEvent.keyboard('{Shift>}{ArrowLeft}{/Shift}')
    scroller().scrollTop = 200_000
    await frames(6)
    const later = dataRows().find(visibleIn) as HTMLTableRowElement
    expect(Math.round(later.cells[1]?.getBoundingClientRect().width ?? 0)).toBe(336)
  })

  it('全选选中全部 1 万行；不超过 100 行时不虚拟化；virtual={false} 关闭', async () => {
    const view = await render(<Selecting />)
    await userEvent.click(page.getByRole('checkbox', { name: 'Select all rows' }))
    expect(document.querySelector('output')?.textContent).toBe('10000')
    await view.unmount()
    const small = await render(<Table rows={make(100)} />)
    expect(table().hasAttribute('aria-rowcount')).toBe(false)
    expect(dataRows()).toHaveLength(0)
    expect(table().tBodies[0]?.rows).toHaveLength(100)
    await small.unmount()
    await render(<Table rows={make(300)} virtual={false} />)
    expect(table().tBodies[0]?.rows).toHaveLength(300)
  })

  it('fill：占满父元素的高度（工具栏在上面），行在其中滚动', async () => {
    await render(
      <div style={{ height: 360, width: 640, display: 'flex', flexDirection: 'column' }}>
        <DataTable
          aria-label="Logs"
          columns={columns}
          rows={many}
          rowKey={(r) => r.id}
          fill
          toolbar={<span>Filters</span>}
        />
      </div>,
    )
    await frames()
    const root = scroller().closest('[data-fill]') as HTMLElement
    expect(Math.round(root.getBoundingClientRect().height)).toBe(360)
    // 工具栏一行（插槽外面带内边距的那一层）
    const toolbar = page.getByText('Filters').element().parentElement?.parentElement as HTMLElement
    expect(toolbar.parentElement).toBe(root)
    expect(Math.round(scroller().getBoundingClientRect().height)).toBe(
      Math.round(360 - toolbar.getBoundingClientRect().height),
    )
    expect(dataRows().length).toBeLessThan(40)
    expect(table().getAttribute('aria-rowcount')).toBe('10001')
  })
})
