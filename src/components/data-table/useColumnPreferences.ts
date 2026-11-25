/**
 * DataTable 的列偏好：列的顺序、显示、固定与列宽，保存在本机，以及调整列宽的过程。
 *
 * - 保存：有 storageKey 时在绘制之前读取保存的状态，修改后写回；没有任何调整时删除。拖动列宽的过程中只更新状态
 *   （临时的宽度），松开时才写入（commitWidth）。
 * - 布局：按列定义与列状态排出可见的列（model.ts 的纯函数）。
 * - 弹性列的实际宽度：手柄的 aria-valuenow，以及开始调整时的起点。表头单元格通过 headerCell 登记，用
 *   ResizeObserver 测量。
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { DataTableColumn } from './DataTable.tsx'
import {
  type ColumnState,
  clampWidth,
  EMPTY_COLUMN_STATE,
  isHidden,
  layoutColumns,
  orderedColumns,
  parseStoredState,
  serializeState,
} from './model.ts'

/** 读取保存的列状态；存储不可用（隐私模式、被禁用）时视为没有保存。 */
function readStored(key: string): ColumnState | null {
  try {
    return parseStoredState(globalThis.localStorage?.getItem(key) ?? null)
  } catch {
    return null
  }
}

/** 保存列状态；没有任何调整时删除。存储不可用或已满时放弃：只是偏好，丢失不影响使用。 */
function writeStored(key: string, value: string | null) {
  try {
    if (value === null) globalThis.localStorage?.removeItem(key)
    else globalThis.localStorage?.setItem(key, value)
  } catch {
    // 不可写：本次会话内照常生效，只是不会被记住
  }
}

/** useColumnPreferences 的结果。除 state、layout、measured、resizing 外，函数的身份在 storageKey 不变时不变。 */
export interface ColumnPreferences<T> {
  /** 当前的列状态（含拖动中的临时宽度）。 */
  readonly state: ColumnState
  /** 可见的列及其宽度、固定位置（model.ts 的 layoutColumns）。 */
  readonly layout: ReturnType<typeof layoutColumns<DataTableColumn<T>>>
  /** 弹性列测量到的宽度（像素）。 */
  readonly measured: Readonly<Record<string, number>>
  /** 正在拖动某一列的边缘。 */
  readonly resizing: boolean
  /** 列设置中的修改：立即生效并保存。 */
  readonly change: (next: ColumnState) => void
  /** 恢复默认（并删除保存的状态）。 */
  readonly reset: () => void
  /** 登记表头单元格（th 的 ref）：测量弹性列的宽度。 */
  readonly headerCell: (key: string, el: HTMLTableCellElement | null) => void
  /** 调整的起点：调整过的宽度、定宽列的宽度，弹性列取实际宽度。 */
  readonly widthNow: (key: string) => number
  /** 调整中：更新宽度，不保存。 */
  readonly resizeTo: (column: DataTableColumn<T>, width: number) => void
  /** 调整结束：保存。 */
  readonly commitWidth: () => void
  /** 恢复这一列的默认宽度并保存。 */
  readonly resetWidth: (key: string) => void
  /** 开始、结束拖动。 */
  readonly setResizing: (dragging: boolean) => void
}

export function useColumnPreferences<T>(
  columns: readonly DataTableColumn<T>[],
  storageKey: string | undefined,
): ColumnPreferences<T> {
  const [state, setState] = useState<ColumnState>(EMPTY_COLUMN_STATE)
  const stateRef = useRef(state)
  stateRef.current = state
  // 恢复保存的状态：在绘制之前读取（服务端与注水时用默认值，不会注水不一致；客户端不先显示默认再跳变）
  useLayoutEffect(() => {
    setState(storageKey ? (readStored(storageKey) ?? EMPTY_COLUMN_STATE) : EMPTY_COLUMN_STATE)
  }, [storageKey])
  const columnsRef = useRef(columns)
  columnsRef.current = columns
  const persist = useCallback(
    (next: ColumnState) => {
      if (storageKey) writeStored(storageKey, serializeState(columnsRef.current, next))
    },
    [storageKey],
  )
  const apply = useCallback(
    (next: ColumnState, save: boolean) => {
      stateRef.current = next
      setState(next)
      if (save) persist(next)
    },
    [persist],
  )
  const change = useCallback((next: ColumnState) => apply(next, true), [apply])
  const reset = useCallback(() => apply(EMPTY_COLUMN_STATE, true), [apply])

  const layout = useMemo(() => {
    const visible = orderedColumns(columns, state).filter((c) => !isHidden(c, state))
    return layoutColumns(visible, state)
  }, [columns, state])

  // 弹性列的实际宽度：手柄的 aria-valuenow，以及开始调整时的起点
  const headerCells = useRef(new Map<string, HTMLTableCellElement>())
  const headerCell = useCallback((key: string, el: HTMLTableCellElement | null) => {
    if (el) headerCells.current.set(key, el)
    else headerCells.current.delete(key)
  }, [])
  const [measured, setMeasured] = useState<Readonly<Record<string, number>>>({})
  const flexKeys = layout.columns
    .filter((c) => c.width === null)
    .map((c) => c.column.key)
    .join('\n')
  useEffect(() => {
    if (!flexKeys || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      setMeasured((prev) => {
        let next: Record<string, number> | null = null
        for (const entry of entries) {
          const key = (entry.target as HTMLElement).dataset.key
          if (!key) continue
          const w = Math.round(entry.target.getBoundingClientRect().width)
          if (!Object.hasOwn(prev, key) || prev[key] !== w) {
            next ??= Object.assign(Object.create(null) as Record<string, number>, prev)
            next[key] = w
          }
        }
        return next ?? prev
      })
    })
    for (const key of flexKeys.split('\n')) {
      const el = headerCells.current.get(key)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [flexKeys])

  // —— 列宽调整 ——
  const [resizing, setResizing] = useState(false)
  const layoutRef = useRef(layout)
  layoutRef.current = layout
  const widthNow = useCallback((key: string) => {
    const widths = stateRef.current.width
    const saved = Object.hasOwn(widths, key) ? widths[key] : undefined
    if (saved !== undefined) return saved
    const own = layoutRef.current.columns.find((c) => c.column.key === key)?.width
    if (own !== null && own !== undefined) return own
    return Math.round(headerCells.current.get(key)?.getBoundingClientRect().width ?? 0)
  }, [])
  const resizeTo = useCallback(
    (column: DataTableColumn<T>, width: number) => {
      const s = stateRef.current
      const w = clampWidth(column, width)
      if (s.width[column.key] === w) return
      apply({ ...s, width: { ...s.width, [column.key]: w } }, false)
    },
    [apply],
  )
  const commitWidth = useCallback(() => persist(stateRef.current), [persist])
  const resetWidth = useCallback(
    (key: string) => {
      const s = stateRef.current
      if (!Object.hasOwn(s.width, key)) return
      const { [key]: _removed, ...rest } = s.width
      apply({ ...s, width: rest }, true)
    },
    [apply],
  )

  return {
    state,
    layout,
    measured,
    resizing,
    change,
    reset,
    headerCell,
    widthNow,
    resizeTo,
    commitWidth,
    resetWidth,
    setResizing,
  }
}
