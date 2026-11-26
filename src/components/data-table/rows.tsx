/**
 * DataTable 的视图部分：表头（Head）与表体的一行（Row）。两者都是 memo 组件，属性只有值与身份不变的函数：
 * 虚拟滚动引起的渲染只重新渲染新出现的行，表头不重新渲染。
 */
import { Checkbox } from 'antd'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { type CSSProperties, type MouseEvent, memo, type ReactNode, type RefObject } from 'react'
import { useT } from '../../i18n/index.ts'
import { Glyph } from '../glyph.tsx'
import type { DataTableColumn } from './DataTable.tsx'
import styles from './data-table.module.css'
import {
  type ColumnLayout,
  type DataTablePin,
  type DataTableSortDirection,
  widthBounds,
} from './model.ts'
import { ResizeHandle } from './ResizeHandle.tsx'

/** 列的纯文字名称：label，或者是字符串的 title，否则是 key。 */
export const labelOf = <T,>(c: DataTableColumn<T>) =>
  c.label ?? (typeof c.title === 'string' ? c.title : c.key)

const cellText = (row: unknown, key: string): ReactNode => {
  const v = (row as Record<string, unknown> | null)?.[key]
  if (v === null || v === undefined) return null
  return typeof v === 'string' ? v : String(v)
}

/** 固定列的粘性偏移：开头的列要加上选择列的宽度。 */
function stickyStyle(
  c: { readonly pin: DataTablePin | null; readonly offset: number | null },
  selectable: boolean,
  filler: boolean,
): CSSProperties | undefined {
  if (c.offset === null) return undefined
  // 有补宽的空列时，它粘在结尾、至少与两端的内缩一样宽：结尾的固定列让出这段内缩
  if (c.pin === 'end')
    return {
      insetInlineEnd: filler ? `calc(var(--data-table-inset) + ${c.offset}px)` : c.offset,
    }
  return {
    insetInlineStart: selectable
      ? `calc(var(--vl-data-table-selection-width) + ${c.offset}px)`
      : c.offset,
  }
}

export interface HeadProps<T> {
  readonly theadRef: RefObject<HTMLTableSectionElement | null>
  readonly columns: readonly ColumnLayout<DataTableColumn<T>>[]
  readonly selectable: boolean
  readonly hasStartPins: boolean
  readonly filler: boolean
  readonly virtual: boolean
  readonly sortKey: string | undefined
  readonly sortDirection: DataTableSortDirection | undefined
  readonly allSelected: boolean
  readonly someSelected: boolean
  readonly selectAllDisabled: boolean
  /** 弹性列测量到的宽度（手柄的 aria-valuenow）。 */
  readonly measured: Readonly<Record<string, number>>
  readonly onSort: (key: string) => void
  readonly onToggleAll: (checked: boolean) => void
  /** 登记表头单元格，用来测量弹性列。 */
  readonly headerCell: (key: string, el: HTMLTableCellElement | null) => void
  readonly widthNow: (key: string) => number
  readonly onResize: (column: DataTableColumn<T>, width: number) => void
  readonly onResizeCommit: () => void
  readonly onResizeReset: (key: string) => void
  readonly onResizeDrag: (dragging: boolean) => void
}

function HeadInner<T>(p: HeadProps<T>) {
  const t = useT()
  return (
    <thead ref={p.theadRef}>
      <tr aria-rowindex={p.virtual ? 1 : undefined}>
        {p.selectable && (
          <th
            scope="col"
            className={`${styles.cell} ${styles.th} ${styles.selectCell}`}
            data-pin="start"
            data-edge={!p.hasStartPins ? 'start' : undefined}
          >
            <Checkbox
              aria-label={t('dataTable.selectAll')}
              checked={p.allSelected}
              indeterminate={p.someSelected}
              disabled={p.selectAllDisabled}
              onChange={(e) => p.onToggleAll(e.target.checked)}
            />
          </th>
        )}
        {p.columns.map((c) => {
          const col = c.column
          const sortable = Boolean(col.sortable || col.compare)
          const direction = p.sortKey === col.key ? p.sortDirection : undefined
          const label = labelOf(col)
          const bounds = widthBounds(col)
          const title = (
            <span className={styles.title} data-vl-truncate="">
              {col.title}
            </span>
          )
          return (
            <th
              key={col.key}
              ref={(el) => p.headerCell(col.key, el)}
              scope="col"
              // 表头的读屏名称只是列名：否则其中列宽手柄的名称（「调整……的列宽」）也会算进去，
              // 读屏在每个单元格前读出的列名就变成了「名称 调整名称的列宽」
              aria-label={label}
              data-key={col.key}
              className={`${styles.cell} ${styles.th}`}
              data-align={col.align}
              data-pin={c.pin ?? undefined}
              data-edge={c.edge ?? undefined}
              style={stickyStyle(c, p.selectable, p.filler)}
              aria-sort={
                direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : undefined
              }
            >
              {sortable ? (
                <button
                  type="button"
                  className={styles.sort}
                  data-vl-state=""
                  data-sorted={direction}
                  onClick={() => p.onSort(col.key)}
                >
                  {title}
                  <span className={styles.sortIcon} aria-hidden="true">
                    <Glyph
                      icon={
                        direction === 'asc'
                          ? ArrowUp
                          : direction === 'desc'
                            ? ArrowDown
                            : ArrowUpDown
                      }
                      size={14}
                    />
                  </span>
                </button>
              ) : (
                title
              )}
              {col.resizable !== false && (
                <ResizeHandle
                  label={t('dataTable.resize', { column: label })}
                  width={
                    c.width ??
                    (Object.hasOwn(p.measured, col.key) ? p.measured[col.key] : null) ??
                    null
                  }
                  min={bounds.min}
                  max={bounds.max}
                  onStart={() => p.widthNow(col.key)}
                  onChange={(w) => p.onResize(col, w)}
                  onCommit={p.onResizeCommit}
                  onReset={() => p.onResizeReset(col.key)}
                  onDragChange={p.onResizeDrag}
                />
              )}
            </th>
          )
        })}
        {p.filler && (
          // biome-ignore lint/a11y/noAriaHiddenOnFocusable: 补满宽度的空列不可聚焦、没有内容，对读屏隐藏
          <th
            aria-hidden="true"
            className={`${styles.cell} ${styles.th} ${styles.filler}`}
            data-pin="end"
          />
        )}
      </tr>
    </thead>
  )
}

/** 表头：滚动、行的选择变化（只要全选状态不变）时不重新渲染。 */
export const Head = memo(HeadInner) as typeof HeadInner

export interface RowProps<T> {
  readonly row: T
  readonly index: number
  readonly columns: readonly ColumnLayout<DataTableColumn<T>>[]
  readonly selectable: boolean
  readonly canSelect: boolean
  readonly selected: boolean
  readonly selectLabel: string | undefined
  readonly labelledBy: string
  readonly firstCellId: string
  readonly filler: boolean
  readonly edgeOnSelection: boolean
  readonly ariaRowIndex: number | undefined
  readonly clickable: boolean
  readonly measure: ((el: Element | null) => void) | undefined
  readonly onToggle: (index: number, checked: boolean, shift: boolean) => void
  readonly onClick: (index: number, e: MouseEvent<HTMLTableRowElement>) => void
}

function RowInner<T>(p: RowProps<T>) {
  return (
    <tr
      ref={p.measure}
      data-index={p.index}
      aria-rowindex={p.ariaRowIndex}
      className={styles.row}
      data-selected={p.selected || undefined}
      data-clickable={p.clickable || undefined}
      onClick={p.clickable ? (e) => p.onClick(p.index, e) : undefined}
    >
      {p.selectable && (
        <td
          className={`${styles.cell} ${styles.td} ${styles.selectCell}`}
          data-pin="start"
          data-edge={p.edgeOnSelection ? 'start' : undefined}
        >
          <Checkbox
            checked={p.selected}
            disabled={!p.canSelect}
            aria-label={p.selectLabel}
            aria-labelledby={p.selectLabel ? undefined : p.labelledBy}
            onChange={(e) =>
              p.onToggle(p.index, e.target.checked, Boolean(e.nativeEvent?.shiftKey))
            }
          />
        </td>
      )}
      {p.columns.map((c, i) => {
        const col = c.column
        const content = col.render ? col.render(p.row, p.index) : cellText(p.row, col.key)
        return (
          <td
            key={col.key}
            id={i === 0 ? p.firstCellId : undefined}
            className={`${styles.cell} ${styles.td}`}
            data-tail={p.filler && i === p.columns.length - 1 ? '' : undefined}
            data-align={col.align}
            data-pin={c.pin ?? undefined}
            data-edge={c.edge ?? undefined}
            style={stickyStyle(c, p.selectable, p.filler)}
          >
            {col.truncate ? (
              <span className={styles.truncate} data-vl-truncate="">
                {content}
              </span>
            ) : (
              content
            )}
          </td>
        )
      })}
      {p.filler && (
        <td
          aria-hidden="true"
          className={`${styles.cell} ${styles.td} ${styles.filler}`}
          data-pin="end"
        />
      )}
    </tr>
  )
}

/** 表体的一行：只有自己的属性变化时重新渲染。 */
export const Row = memo(RowInner) as typeof RowInner
