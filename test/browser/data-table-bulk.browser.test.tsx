/**
 * DataTable 的批量操作（`bulkActions`，由 SelectionBar 提供）：
 * - 有已选行时工具栏这一行原位换成批量操作栏（已选数量、清除、操作），表格不移动；
 * - 清除选择后回到工具栏，焦点回到表格（不落到 body）；
 * - `totalCount` 与 `onSelectAll`：「选择全部 N 项」；
 * - 没有 `selectable` 时 `bulkActions` 不起作用。
 */
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Button, DataTable, type DataTableColumn, Input } from '../../src/index.ts'
import { page, render, userEvent } from './render.tsx'

interface Row {
  readonly id: string
  readonly name: string
}

const rows: Row[] = [
  { id: 'a', name: 'Cedar' },
  { id: 'b', name: 'Atlas' },
  { id: 'c', name: 'Beacon' },
]
const columns: DataTableColumn<Row>[] = [{ key: 'name', title: 'Name', width: 240 }]

function Bulk(props: { selectable?: boolean; onArchive?: (keys: readonly string[]) => void }) {
  const [selected, setSelected] = useState<readonly string[]>([])
  return (
    <div style={{ width: 640 }}>
      <DataTable
        aria-label="Projects"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        selectable={props.selectable ?? true}
        selectedKeys={selected}
        onSelectionChange={setSelected}
        totalCount={40}
        onSelectAll={() => setSelected(rows.map((r) => r.id))}
        columnSettings
        toolbar={<Input.Search placeholder="Search projects" />}
        bulkActions={<Button onClick={() => props.onArchive?.(selected)}>Archive</Button>}
      />
    </div>
  )
}

const tableTop = () => document.querySelector('table')?.getBoundingClientRect().top ?? Number.NaN
const bar = () => document.querySelector('[data-layer="bar"]')

describe('DataTable：批量操作', () => {
  it('选中行时工具栏原位换成批量操作栏，表格不移动；操作收到已选的键', async () => {
    const onArchive = vi.fn()
    await render(<Bulk onArchive={onArchive} />)
    expect(page.getByPlaceholder('Search projects').element()).toBeTruthy()
    expect(bar()?.hasAttribute('data-hidden')).toBe(true)
    const top = tableTop()
    await userEvent.click(
      page.getByRole('checkbox', { name: 'Select Atlas', exact: true }).element(),
    )
    await expect.poll(() => bar()?.hasAttribute('data-hidden')).toBe(false)
    // 栏内的数量（另有一份在读屏的状态区中）
    expect(bar()?.textContent).toContain('1 selected')
    expect(tableTop()).toBeCloseTo(top, 0)
    await userEvent.click(page.getByRole('button', { name: 'Archive' }).element())
    expect(onArchive).toHaveBeenCalledWith(['b'])
  })

  it('清除选择：回到工具栏，焦点回到表格', async () => {
    await render(<Bulk />)
    await userEvent.click(
      page.getByRole('checkbox', { name: 'Select Cedar', exact: true }).element(),
    )
    await expect.poll(() => bar()?.hasAttribute('data-hidden')).toBe(false)
    await userEvent.click(page.getByRole('button', { name: 'Clear selection' }).element())
    await expect.poll(() => bar()?.hasAttribute('data-hidden')).toBe(true)
    expect(
      page.getByRole('checkbox', { name: 'Select Cedar', exact: true }).element(),
    ).not.toBeChecked()
    await expect.poll(() => document.activeElement === document.body).toBe(false)
    expect(
      document.querySelector('table')?.closest('[class]')?.contains(document.activeElement),
    ).toBe(true)
  })

  it('totalCount 与 onSelectAll：「选择全部 N 项」', async () => {
    await render(<Bulk />)
    await userEvent.click(
      page.getByRole('checkbox', { name: 'Select Cedar', exact: true }).element(),
    )
    await expect
      .poll(() => page.getByRole('button', { name: 'Select all 40' }).query())
      .not.toBeNull()
  })

  it('没有 selectable 时 bulkActions 不起作用', async () => {
    await render(<Bulk selectable={false} />)
    expect(bar()).toBeNull()
    expect(page.getByPlaceholder('Search projects').element()).toBeTruthy()
  })
})
