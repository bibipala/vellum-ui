/**
 * DataTable 在真实浏览器中的交互（一）：
 * - 排序：点击与键盘（Enter / Space）循环「升序 → 降序 → 不排序」，aria-sort 正确；本地排序与受控（服务端）排序；
 *   表头按钮的状态层与焦点环；
 * - 多选：全选当前数据、半选、键盘勾选、Shift 点击选择一段、整个单元格都是点击区域、不能选择的行、其他页的键保留；
 *   复选框的读屏名称（rowLabel 或第一列的内容）；选中行的强调色浅底；
 * - 行：悬停状态层；onRowClick（点击行内控件、选择文字时不触发）；
 * - 状态：刷新时保留旧数据、200ms 后才出现加载指示（不闪）；首次加载、空、错误（重试）；
 * - 截断：只有真的被截断时才在悬停 500ms 后或键盘聚焦时显示完整内容；
 * - 紧凑密度：单元格内边距与行高随密度变小。
 */
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import {
  DataTable,
  type DataTableColumn,
  type DataTableProps,
  type DataTableSort,
  LinkButton,
} from '../../src/index.ts'
import {
  clock,
  css,
  expectFocusRing,
  focused,
  page,
  pseudo,
  render,
  sameColor,
  settle,
  token,
  useFakeTimers,
  userEvent,
  visibleTooltips,
} from './render.tsx'

interface Row {
  readonly id: string
  readonly name: string
  readonly owner: string
  readonly size: number
}

const rows: Row[] = [
  { id: 'a', name: 'Cedar', owner: 'Sam Lee', size: 30 },
  { id: 'b', name: 'Atlas', owner: 'Alex Kim', size: 120 },
  { id: 'c', name: 'Beacon', owner: 'Riley Chen', size: 8 },
  { id: 'd', name: 'Delta', owner: 'Jordan Park', size: 45 },
]

const columns: DataTableColumn<Row>[] = [
  { key: 'name', title: 'Name', width: 200, compare: (a, b) => a.name.localeCompare(b.name) },
  { key: 'owner', title: 'Owner', width: 200 },
  { key: 'size', title: 'Size', width: 96, align: 'end', compare: (a, b) => a.size - b.size },
]

function Table(props: Partial<DataTableProps<Row>>) {
  return (
    <div style={{ width: 720 }} data-testid="frame">
      <DataTable
        aria-label="Projects"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        {...props}
      />
    </div>
  )
}

const table = () => page.getByRole('table', { name: 'Projects' }).element() as HTMLTableElement
const bodyRows = () =>
  [...(table().tBodies[0]?.rows ?? [])].filter((r) => r.getAttribute('aria-hidden') !== 'true')
/** 每行某一列（按表头文字找列）的文字。 */
function column(name: string): string[] {
  const head = [...(table().tHead?.rows[0]?.cells ?? [])]
  const i = head.findIndex((th) => th.textContent === name)
  return bodyRows().map((r) => r.cells[i]?.textContent ?? '')
}
const header = (name: string) =>
  page.getByRole('columnheader', { name, exact: true }).element() as HTMLTableCellElement
const sortButton = (name: string) =>
  page.getByRole('button', { name, exact: true }).element() as HTMLButtonElement
const checkbox = (name: string) =>
  page.getByRole('checkbox', { name, exact: true }).element() as HTMLInputElement

/** 受控排序：由「服务端」排序（这里不排序，只显示 sort）。 */
function Server() {
  const [sort, setSort] = useState<DataTableSort | null>({ key: 'owner', direction: 'desc' })
  return (
    <Table
      columns={[
        { key: 'name', title: 'Name', sortable: true },
        { key: 'owner', title: 'Owner', sortable: true },
      ]}
      sort={sort}
      onSortChange={setSort}
    />
  )
}

describe('DataTable：排序', () => {
  it('点击表头：升序 → 降序 → 不排序，aria-sort 随之变化；本地排序', async () => {
    const onSortChange = vi.fn()
    await render(<Table onSortChange={onSortChange} />)
    expect(column('Name')).toEqual(['Cedar', 'Atlas', 'Beacon', 'Delta'])
    expect(header('Name').hasAttribute('aria-sort')).toBe(false)
    await userEvent.click(sortButton('Name'))
    expect(header('Name').getAttribute('aria-sort')).toBe('ascending')
    expect(column('Name')).toEqual(['Atlas', 'Beacon', 'Cedar', 'Delta'])
    await userEvent.click(sortButton('Name'))
    expect(header('Name').getAttribute('aria-sort')).toBe('descending')
    expect(column('Name')).toEqual(['Delta', 'Cedar', 'Beacon', 'Atlas'])
    await userEvent.click(sortButton('Name'))
    expect(header('Name').hasAttribute('aria-sort')).toBe(false)
    expect(column('Name')).toEqual(['Cedar', 'Atlas', 'Beacon', 'Delta'])
    // 换一列：从升序开始，前一列不再带 aria-sort
    await userEvent.click(sortButton('Size'))
    expect(column('Size')).toEqual(['8', '30', '45', '120'])
    expect(header('Size').getAttribute('aria-sort')).toBe('ascending')
    expect(header('Name').hasAttribute('aria-sort')).toBe(false)
    expect(onSortChange.mock.calls.map(([s]) => s)).toEqual([
      { key: 'name', direction: 'asc' },
      { key: 'name', direction: 'desc' },
      null,
      { key: 'size', direction: 'asc' },
    ])
    // 不可排序的列没有按钮
    expect(page.getByRole('button', { name: 'Owner', exact: true }).query()).toBeNull()
  })

  it('键盘：Tab 聚焦表头按钮显示焦点环，Enter 与 Space 切换排序；悬停叠加状态层', async () => {
    await render(<Table />)
    await userEvent.tab()
    expect(focused()).toBe(sortButton('Name'))
    expectFocusRing(sortButton('Name'), 2)
    await userEvent.keyboard('{Enter}')
    expect(header('Name').getAttribute('aria-sort')).toBe('ascending')
    await userEvent.keyboard(' ')
    expect(header('Name').getAttribute('aria-sort')).toBe('descending')
    expect(focused()).toBe(sortButton('Name'))
    const size = sortButton('Size')
    await userEvent.hover(size)
    await expect
      .poll(() => Number(pseudo(size, '::before').opacity))
      .toBeCloseTo(Number(token('state-hover-opacity')), 2)
  })

  it('受控（服务端排序）：显示 sort，点击只报告下一个排序，不在本地排序没有 compare 的列', async () => {
    await render(<Server />)
    expect(header('Owner').getAttribute('aria-sort')).toBe('descending')
    expect(column('Owner')).toEqual(['Sam Lee', 'Alex Kim', 'Riley Chen', 'Jordan Park'])
    await userEvent.click(sortButton('Owner'))
    expect(header('Owner').hasAttribute('aria-sort')).toBe(false)
    await userEvent.click(sortButton('Name'))
    expect(header('Name').getAttribute('aria-sort')).toBe('ascending')
    // 服务端负责排序：行的顺序不变
    expect(column('Name')).toEqual(['Cedar', 'Atlas', 'Beacon', 'Delta'])
  })
})

function Selectable(
  props: Partial<DataTableProps<Row>> & { readonly initial?: readonly string[] },
) {
  const { initial = [], ...rest } = props
  const [keys, setKeys] = useState<readonly string[]>(initial)
  return (
    <>
      <Table selectable selectedKeys={keys} onSelectionChange={setKeys} {...rest} />
      <output>{keys.join(',')}</output>
    </>
  )
}
const output = () => document.querySelector('output')?.textContent ?? ''

describe('DataTable：多选', () => {
  it('读屏名称：表头「Select all rows」；行默认用第一列的内容，提供 rowLabel 时用它', async () => {
    const view = await render(<Selectable />)
    expect(checkbox('Select all rows')).toBeTruthy()
    expect(checkbox('Select Cedar')).toBeTruthy()
    await view.unmount()
    await render(<Selectable rowLabel={(r) => `${r.name} (${r.owner})`} />)
    expect(checkbox('Select Atlas (Alex Kim)')).toBeTruthy()
  })

  it('全选当前数据、半选；其他页的键保留；不能选择的行跳过并禁用', async () => {
    await render(<Selectable initial={['other-page']} isRowSelectable={(r) => r.id !== 'd'} />)
    const all = checkbox('Select all rows')
    expect(checkbox('Select Delta').disabled).toBe(true)
    expect(all.checked).toBe(false)
    expect(all.indeterminate).toBe(false)
    await userEvent.click(checkbox('Select Atlas'))
    expect(output()).toBe('other-page,b')
    expect(all.indeterminate).toBe(true)
    expect(all.checked).toBe(false)
    await userEvent.click(all)
    expect(output().split(',').sort()).toEqual(['a', 'b', 'c', 'other-page'])
    expect(all.checked).toBe(true)
    expect(all.indeterminate).toBe(false)
    await userEvent.click(all)
    expect(output()).toBe('other-page')
    expect(all.checked).toBe(false)
  })

  it('键盘：Tab 到行的复选框，空格勾选；焦点环；选中的行是强调色浅底', async () => {
    await render(<Selectable />)
    checkbox('Select all rows').focus()
    // 全选 → 三个排序按钮与它们之间的列宽手柄 → 第一行的复选框
    while (focused() !== checkbox('Select Cedar')) await userEvent.tab()
    await userEvent.keyboard(' ')
    expect(output()).toBe('a')
    const wrapper = checkbox('Select Cedar').closest('.ant-checkbox') as HTMLElement
    expectFocusRing(wrapper, 2)
    const tr = checkbox('Select Cedar').closest('tr') as HTMLTableRowElement
    expect(tr.hasAttribute('data-selected')).toBe(true)
    const cell = tr.cells[1] as HTMLElement
    await expect
      .poll(() => sameColor(pseudo(cell, '::before').backgroundColor, token('color-fill-selected')))
      .toBe(true)
  })

  it('Shift 点击选择一段（取消同理）；整个单元格都是点击区域', async () => {
    await render(<Selectable />)
    await userEvent.click(checkbox('Select Cedar'))
    await userEvent.keyboard('{Shift>}')
    await userEvent.click(checkbox('Select Beacon'))
    await userEvent.keyboard('{/Shift}')
    expect(output()).toBe('a,b,c')
    await userEvent.keyboard('{Shift>}')
    await userEvent.click(checkbox('Select Atlas'))
    await userEvent.keyboard('{/Shift}')
    // 从上一次点击的 Beacon 到 Atlas 都取消
    expect(output()).toBe('a')
    // 点在单元格的角上（复选框之外）也能勾选
    const td = checkbox('Select Delta').closest('td') as HTMLElement
    await userEvent.click(td, { position: { x: 4, y: 4 } })
    expect(output()).toBe('a,d')
  })
})

describe('DataTable：行', () => {
  it('悬停叠加状态层；onRowClick 点击行时调用，点击行内的链接、复选框时不调用', async () => {
    const onRowClick = vi.fn()
    const onOpen = vi.fn()
    await render(
      <Table
        selectable
        onRowClick={(r) => onRowClick(r.id)}
        columns={[
          {
            key: 'name',
            title: 'Name',
            render: (r) => <LinkButton onClick={() => onOpen(r.id)}>{r.name}</LinkButton>,
          },
          { key: 'owner', title: 'Owner' },
        ]}
      />,
    )
    const ownerCell = page.getByRole('cell', { name: 'Alex Kim' }).element() as HTMLElement
    await userEvent.hover(ownerCell)
    await expect
      .poll(() =>
        sameColor(pseudo(ownerCell, '::before').backgroundColor, token('table-row-hover-bg')),
      )
      .toBe(true)
    expect(css(ownerCell.parentElement as Element).cursor).toBe('pointer')
    await userEvent.click(ownerCell)
    expect(onRowClick).toHaveBeenCalledWith('b')
    await userEvent.click(page.getByRole('button', { name: 'Delta' }))
    expect(onOpen).toHaveBeenCalledWith('d')
    await userEvent.click(checkbox('Select Beacon'))
    expect(onRowClick).toHaveBeenCalledTimes(1)
  })
})

describe('DataTable：加载、空、错误', () => {
  it('刷新时保留旧数据；加载指示 200ms 后才出现（很快完成的加载不闪），出现后至少显示 400ms', async () => {
    useFakeTimers()
    const view = await render(<Table />)
    const busy = () => page.getByRole('status', { name: 'Loading' }).query()
    const start = clock()
    await view.rerender(<Table loading />)
    expect(table().getAttribute('aria-busy')).toBe('true')
    await start.to(150)
    expect(busy()).toBeNull()
    // 150ms 时就完成：一直不出现
    await view.rerender(<Table />)
    await settle(400)
    expect(busy()).toBeNull()
    expect(table().hasAttribute('aria-busy')).toBe(false)
    // 较慢的加载：200ms 后出现，旧数据保留
    const slow = clock()
    await view.rerender(<Table loading />)
    await slow.to(199)
    expect(busy()).toBeNull()
    await slow.to(210)
    expect(busy()).not.toBeNull()
    expect(column('Name')).toEqual(['Cedar', 'Atlas', 'Beacon', 'Delta'])
    await view.rerender(<Table />)
    await settle(100)
    expect(busy()).not.toBeNull()
    await slow.to(620)
    expect(busy()).toBeNull()
  })

  it('首次加载（没有行）：加载指示代替空状态；没有行时显示空状态或 empty', async () => {
    const view = await render(<Table rows={[]} loading />)
    await expect.element(page.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
    expect(page.getByText('No data').query()).toBeNull()
    await view.rerender(<Table rows={[]} />)
    await expect.element(page.getByText('No data')).toBeInTheDocument()
    // 表头仍在
    expect(header('Name')).toBeTruthy()
    await view.rerender(<Table rows={[]} empty={<p>No projects yet</p>} />)
    await expect.element(page.getByText('No projects yet')).toBeInTheDocument()
  })

  it('错误：代替行显示，表头仍在；「重试」可用键盘触发', async () => {
    const onRetry = vi.fn()
    await render(<Table error="The server did not respond." onRetry={onRetry} selectable />)
    await expect.element(page.getByRole('alert')).toMatchTextContent('The server did not respond.')
    expect(bodyRows()).toHaveLength(1)
    expect(header('Name')).toBeTruthy()
    expect(checkbox('Select all rows').disabled).toBe(true)
    page.getByRole('button', { name: 'Retry' }).element().focus()
    await userEvent.keyboard('{Enter}')
    expect(onRetry).toHaveBeenCalledOnce()
  })
})

describe('DataTable：截断', () => {
  const long = 'Quarterly catalog photography for the northern region stores'
  const truncRows: Row[] = [
    { id: 'a', name: long, owner: 'Sam Lee', size: 1 },
    { id: 'b', name: 'Short', owner: 'Alex Kim', size: 2 },
  ]
  const truncColumns: DataTableColumn<Row>[] = [
    { key: 'name', title: 'Name', width: 140, truncate: true },
    {
      key: 'owner',
      title: 'Owner',
      width: 160,
      truncate: true,
      render: (r) => (
        <LinkButton onClick={() => {}}>{`${r.owner} and the whole production team`}</LinkButton>
      ),
    },
  ]

  it('只有真的被截断时，悬停 500ms 后才显示完整内容；提示不拦截指针', async () => {
    useFakeTimers()
    await render(<Table rows={truncRows} columns={truncColumns} />)
    // 没有被截断的文字：不显示
    await userEvent.hover(page.getByText('Short').element())
    await settle(700)
    expect(visibleTooltips()).toEqual([])
    const cut = page.getByText(long).element()
    expect(cut.scrollWidth).toBeGreaterThan(cut.clientWidth)
    expect(css(cut).textOverflow).toBe('ellipsis')
    const start = clock()
    await userEvent.hover(cut)
    await start.to(400)
    expect(visibleTooltips()).toEqual([])
    await start.to(560)
    await expect.poll(visibleTooltips).toEqual([long])
    const popup = document.querySelector('.ant-tooltip:not(.ant-tooltip-hidden)') as HTMLElement
    expect(css(popup).pointerEvents).toBe('none')
    // 提示盖在相邻的行上也不挡住它：移到下一行即关闭
    await userEvent.hover(page.getByText('Short').element())
    await settle(400)
    await expect.poll(visibleTooltips).toEqual([])
  })

  it('键盘聚焦被截断的链接时立即显示', async () => {
    await render(<Table rows={truncRows} columns={truncColumns} />)
    const link = page.getByRole('button', { name: 'Sam Lee and the whole production team' })
    const linkEl = link.element() as HTMLElement
    // 链接自己截断文字、显示省略号
    expect(css(linkEl).textOverflow).toBe('ellipsis')
    expect(linkEl.scrollWidth).toBeGreaterThan(linkEl.clientWidth)
    // 从前一个可聚焦元素按 Tab 进入（键盘焦点）
    while (focused() !== linkEl) await userEvent.tab()
    await expect.poll(visibleTooltips).toEqual(['Sam Lee and the whole production team'])
    // 焦点环（2px、外扩 2px）在截断的裁剪区域之内，不被裁掉
    expectFocusRing(linkEl, 2)
    const ring = linkEl.getBoundingClientRect()
    const clip = (linkEl.parentElement as HTMLElement).getBoundingClientRect()
    expect(ring.left - 4).toBeGreaterThanOrEqual(clip.left - 0.5)
    expect(ring.top - 4).toBeGreaterThanOrEqual(clip.top - 0.5)
    expect(ring.bottom + 4).toBeLessThanOrEqual(clip.bottom + 0.5)
    await userEvent.tab()
    await expect.poll(visibleTooltips).toEqual(['Alex Kim and the whole production team'])
  })
})

describe('DataTable：密度', () => {
  it('紧凑密度：单元格内边距与行高变小，表格数字等宽', async () => {
    const view = await render(<Table />)
    const cell = () => page.getByRole('cell', { name: 'Alex Kim' }).element() as HTMLElement
    const comfortable = cell().getBoundingClientRect().height
    expect(css(cell()).paddingTop).toBe('12px')
    expect(css(table()).fontVariantNumeric).toBe('tabular-nums')
    await view.unmount()
    await render(<Table />, { density: 'compact' })
    expect(css(cell()).paddingTop).toBe('4px')
    expect(css(cell()).paddingLeft).toBe('8px')
    const compact = cell().getBoundingClientRect().height
    expect(compact).toBeLessThan(comfortable - 12)
    expect(compact).toBeGreaterThanOrEqual(28)
  })
})
