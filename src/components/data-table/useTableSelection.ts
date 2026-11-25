/**
 * DataTable 的选择：受控与非受控的已选键、Shift 点击选择一段的起点，以及表头复选框用到的汇总。
 *
 * 只在数据或选择变化时遍历行：
 * - 可选行的键按数据（与是否可选的判断）计算一次。rowKey 常是内联函数，通过 ref 读取最新的一个（同一份数据的键
 *   不变），使用方每次渲染传入新的 rowKey 时不为全部行重新取键；
 * - 已选的可选行数按可选行的键与已选集合计算，虚拟滚动引起的渲染不重新数；
 * - Shift 点击时按键查找起点的位置（indexOf：每份数据一张键到位置的表），不逐行比较。
 * 事件处理函数的身份不变（行与表头是 memo 组件），通过 ref 读取最新的值。
 */
import { useCallback, useMemo, useRef, useState } from 'react'

export interface TableSelectionOptions<T> {
  /** 是否有选择列；没有时不计算可选行。 */
  readonly enabled: boolean
  /** 当前显示的行（排序后）。 */
  readonly rows: readonly T[]
  readonly rowKey: (row: T) => string
  /** 按键查找行在 rows 中的位置（没有时为 -1）。 */
  readonly indexOf: (key: string) => number
  readonly selectedKeys: readonly string[] | undefined
  readonly defaultSelectedKeys: readonly string[] | undefined
  readonly onSelectionChange: ((keys: readonly string[]) => void) | undefined
  readonly isRowSelectable: ((row: T) => boolean) | undefined
}

/** useTableSelection 的结果。toggleRow、toggleAll、clear 的身份不变。 */
export interface TableSelection<T> {
  /** 已选的键（含不在当前行中的，如其他页）。 */
  readonly keys: readonly string[]
  readonly selected: ReadonlySet<string>
  readonly canSelect: (row: T) => boolean
  /** 当前显示的行中可以选择的行数。 */
  readonly selectableCount: number
  /** 当前显示的可选行全部已选。 */
  readonly all: boolean
  /** 当前显示的可选行部分已选。 */
  readonly some: boolean
  /** 勾选或取消第 index 行；shift 时从上一次点击的行到这一行。 */
  readonly toggleRow: (index: number, checked: boolean, shift: boolean) => void
  /** 表头复选框：选择或取消当前显示的全部可选行（其他页已选的键保留）。 */
  readonly toggleAll: (checked: boolean) => void
  /** 清除全部选择。 */
  readonly clear: () => void
}

export function useTableSelection<T>(o: TableSelectionOptions<T>): TableSelection<T> {
  const [inner, setInner] = useState<readonly string[]>(o.defaultSelectedKeys ?? [])
  const keys = o.selectedKeys ?? inner
  const selected = useMemo(() => new Set(keys), [keys])
  const { isRowSelectable, rows, enabled } = o
  const canSelect = useCallback(
    (row: T) => (isRowSelectable ? isRowSelectable(row) : true),
    [isRowSelectable],
  )
  const keyOf = useRef(o.rowKey)
  keyOf.current = o.rowKey
  const selectableKeys = useMemo(
    () => (enabled ? rows.filter(canSelect).map((row) => keyOf.current(row)) : []),
    [enabled, rows, canSelect],
  )
  const selectedShown = useMemo(
    () => selectableKeys.reduce((n, k) => n + (selected.has(k) ? 1 : 0), 0),
    [selectableKeys, selected],
  )
  const all = selectableKeys.length > 0 && selectedShown === selectableKeys.length
  const some = selectedShown > 0 && !all

  const now = {
    rows,
    selected,
    selectableKeys,
    canSelect,
    rowKey: o.rowKey,
    indexOf: o.indexOf,
    controlled: o.selectedKeys !== undefined,
    onSelectionChange: o.onSelectionChange,
  }
  const latest = useRef(now)
  latest.current = now
  const change = useCallback((next: Set<string>) => {
    const s = latest.current
    const list = [...next]
    if (!s.controlled) setInner(list)
    s.onSelectionChange?.(list)
  }, [])
  const anchor = useRef<string | null>(null)
  const toggleRow = useCallback(
    (index: number, checked: boolean, shift: boolean) => {
      const s = latest.current
      const clicked = s.rows[index]
      if (clicked === undefined) return
      const next = new Set(s.selected)
      const anchorIndex = shift && anchor.current !== null ? s.indexOf(anchor.current) : -1
      const from = anchorIndex < 0 ? index : Math.min(anchorIndex, index)
      const to = anchorIndex < 0 ? index : Math.max(anchorIndex, index)
      for (let i = from; i <= to; i++) {
        const row = s.rows[i]
        if (row === undefined || !s.canSelect(row)) continue
        const key = s.rowKey(row)
        if (checked) next.add(key)
        else next.delete(key)
      }
      anchor.current = s.rowKey(clicked)
      change(next)
    },
    [change],
  )
  const toggleAll = useCallback(
    (checked: boolean) => {
      const s = latest.current
      const next = new Set(s.selected)
      for (const k of s.selectableKeys) {
        if (checked) next.add(k)
        else next.delete(k)
      }
      anchor.current = null
      change(next)
    },
    [change],
  )
  const clear = useCallback(() => change(new Set()), [change])

  return {
    keys,
    selected,
    canSelect,
    selectableCount: selectableKeys.length,
    all,
    some,
    toggleRow,
    toggleAll,
    clear,
  }
}
