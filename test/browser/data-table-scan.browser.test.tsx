/**
 * DataTable 的选择汇总不随滚动扫描全部行：
 * - 表头复选框的状态（全选、半选）要知道当前显示的可选行中有几行已选。这只在数据或选择变化时计算一次；
 *   虚拟滚动引起的渲染不再按键逐个查找全部行（1 万行时每次渲染 1 万次查找）。
 * - 受控选择时，使用方每次渲染都传入新的内联 rowKey：点选一行后不为全部行重新取键（同一份数据的键不变）。
 *
 * 计数的是「被查找过的不同的行」，与渲染了几次无关，结果是确定的：只渲染了可见的几十行，就只查找这几十行。
 * 已选集合的查找通过临时替换 Set.prototype.has 统计（只统计行键，其他调用照常执行），测试结束时恢复。
 */
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { DataTable, type DataTableColumn } from '../../src/index.ts'
import { animationFrame, frames, page, render, userEvent } from './render.tsx'

interface Item {
  readonly id: string
  readonly name: string
  readonly size: number
}

const ROWS = 10_000
const rows: readonly Item[] = Array.from({ length: ROWS }, (_, i) => ({
  id: `row-${i}`,
  name: `File ${i}`,
  size: i,
}))
const columns: DataTableColumn<Item>[] = [
  { key: 'name', title: 'Name' },
  { key: 'size', title: 'Size', width: 120, align: 'end' },
]
const ROW_KEY = /^row-\d+$/

/** 统计在 Set 中查找过的不同行键。 */
function watchLookups() {
  const has = Set.prototype.has
  const looked = new Set<string>()
  const add = Set.prototype.add
  Set.prototype.has = function (this: Set<unknown>, value: unknown) {
    if (typeof value === 'string' && ROW_KEY.test(value)) add.call(looked, value)
    return has.call(this, value)
  }
  return {
    looked,
    reset: () => looked.clear(),
    stop: () => {
      Set.prototype.has = has
    },
  }
}
let stopWatching: (() => void) | undefined
afterEach(() => {
  stopWatching?.()
  stopWatching = undefined
})

const scroller = () =>
  (document.querySelector('table[aria-label="Files"]') as HTMLElement).parentElement as HTMLElement
const checkbox = (name: string) =>
  page.getByRole('checkbox', { name, exact: true }).element() as HTMLInputElement
const renderedIndexes = () =>
  [...document.querySelectorAll('table[aria-label="Files"] tbody tr[data-index]')].map((tr) =>
    Number(tr.getAttribute('data-index')),
  )

/** 受控选择：每次渲染都传入新的内联 rowKey（使用方常见的写法），记录被取键的行。 */
const keyed = new Set<string>()
function Controlled() {
  const [keys, setKeys] = useState<readonly string[]>([])
  return (
    <div style={{ width: 800 }}>
      <DataTable
        aria-label="Files"
        columns={columns}
        rows={rows}
        rowKey={(r) => {
          keyed.add(r.id)
          return r.id
        }}
        selectable
        selectedKeys={keys}
        onSelectionChange={setKeys}
        height={600}
        virtual
      />
      <output data-testid="count">{keys.length}</output>
    </div>
  )
}

describe('DataTable 的选择汇总不随渲染扫描全部行', () => {
  it('1 万行中滚动：只查找、只判断渲染出来的行', async () => {
    const called = new Set<string>()
    const initial = rows.filter((r) => r.size % 3 === 0).map((r) => r.id)
    await render(
      <div style={{ width: 800 }}>
        <DataTable
          aria-label="Files"
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          isRowSelectable={(r) => {
            called.add(r.id)
            return r.size % 7 !== 0
          }}
          selectable
          defaultSelectedKeys={initial}
          height={600}
          virtual
        />
      </div>,
    )
    await frames(10)
    // 有已选行，但不是全选：表头复选框为半选
    const all = checkbox('Select all rows')
    expect(all.indeterminate).toBe(true)
    const watch = watchLookups()
    stopWatching = watch.stop
    called.clear()
    const el = scroller()
    for (let i = 0; i < 20; i++) {
      await animationFrame()
      el.scrollTop += 120
    }
    await frames(4)
    watch.stop()
    // 确实滚动了，并且重新渲染了行（第一屏的行已经卸载）
    expect(Math.min(...renderedIndexes())).toBeGreaterThan(20)
    // 可见约 13 行，加上两侧各 8 行的预渲染，滚过约 52 行：远少于 1 万
    expect(watch.looked.size).toBeGreaterThan(0)
    expect(watch.looked.size).toBeLessThan(200)
    expect(called.size).toBeLessThan(200)
  })

  it('受控选择、内联的 rowKey：点选几行后不为全部行重新取键', async () => {
    await render(<Controlled />)
    await frames(10)
    keyed.clear()
    for (const name of ['File 1', 'File 2', 'File 3'])
      await userEvent.click(checkbox(`Select ${name}`))
    await expect.element(page.getByTestId('count')).toHaveTextContent('3')
    expect(keyed.size).toBeGreaterThan(0)
    expect(keyed.size).toBeLessThan(200)
  })
})
