/**
 * 数据表格 DataTable：vellum-ui 自己的列定义与属性，不继承、不透传 antd Table 的属性。
 *
 * 自己实现而不封装 antd Table（ADR 0020 §3「数据表格增强」）：
 * - antd 的虚拟表格把表头与表体拆成两个 `<table>`，表体的行是 div，读屏得不到表头与单元格的关联；
 *   这里始终是一个原生 `<table>`：表头 `position: sticky` 吸顶，固定列 `position: sticky` 粘在两端，
 *   虚拟滚动用上下两个占位行（`aria-rowcount` / `aria-rowindex` 告诉读屏总行数与位置）；
 * - antd Table 没有可调列宽、列设置，键盘调整列宽要自己写；它还会带上筛选、分页等用不到的代码
 *   （单独引入约 117 KiB gzip，见 M3 的实测），这里只用 TanStack Virtual（已有依赖）与几个小组件。
 *
 * 布局：`table-layout: fixed` + `<colgroup>`。有 `width`、被调整过或被固定的列是定宽列；其余是弹性列，分享剩余宽度
 * （至少 FLEX_MIN_WIDTH）。没有弹性列时，最后补一个空列占满剩余宽度：调整一列的宽度只移动它后面的列，不让其他列重排。
 */
import { useVirtualizer } from '@tanstack/react-virtual'
// 复选框直接用 antd 的（与本库的 Checkbox 相同，那只是薄封装）：从 inputs.tsx 引入会连带 Form、Select、TreeSelect
// 等无法摇树去掉的代码（gzip 后约 80 KiB），见 ColumnSettings.tsx
import { Checkbox } from 'antd'
import {
  type CSSProperties,
  type MouseEvent,
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useT } from '../../i18n/index.ts'
import { useOptionalTheme } from '../../theme/ThemeProvider.tsx'
import { EmptyState, ErrorState, Loading } from '../feedback.tsx'
import { Icon } from '../Icon.tsx'
import type { BaseProps } from '../layout.tsx'
import { SelectionBar } from '../SelectionBar.tsx'
import { useDelayedPending } from '../useDelayedPending.ts'
import { ColumnSettings } from './ColumnSettings.tsx'
import styles from './data-table.module.css'
import {
  type ColumnLayout,
  type ColumnState,
  clampWidth,
  type DataTablePin,
  type DataTableSort,
  EMPTY_COLUMN_STATE,
  isHidden,
  layoutColumns,
  nextSort,
  orderedColumns,
  parseStoredState,
  serializeState,
  sortRows,
  widthBounds,
} from './model.ts'
import { ResizeHandle } from './ResizeHandle.tsx'
import { useTruncationTip } from './truncation.tsx'

export type { DataTablePin, DataTableSort, DataTableSortDirection } from './model.ts'

// 打包工具会把 process.env.NODE_ENV 替换为常量（antd 与 React 同样依赖这一点）；这里只声明用到的部分
declare const process: { readonly env: { readonly NODE_ENV?: string } }

/**
 * A column of DataTable.
 * @zh DataTable 的一列。
 */
export interface DataTableColumn<T> {
  /**
   * Stable identifier of the column: used for sorting, for the saved width, order, visibility and pinning, and as
   * the default cell value (`row[key]`).
   * @zh 列的稳定标识：用于排序、保存的列宽、顺序、显示与固定，也是默认的单元格取值（`row[key]`）。
   */
  readonly key: string
  /**
   * Header content.
   * @zh 表头内容。
   */
  readonly title: ReactNode
  /**
   * Plain-text name of the column, used in the column settings and by screen readers (resize handle, row
   * checkboxes). Required when `title` is not a string; defaults to `title` when it is one.
   * @zh 列的纯文字名称，用于列设置与读屏（列宽手柄、行的复选框）。`title` 不是字符串时必须提供；是字符串时默认就是它。
   */
  readonly label?: string
  /**
   * Renders the cell. Without it, the cell shows `row[key]` as text.
   * @zh 渲染单元格。省略时显示 `row[key]` 的文字。
   */
  readonly render?: (row: T, index: number) => ReactNode
  /**
   * Horizontal alignment of the header and the cells; use `end` for numbers so that they line up.
   * @zh 表头与单元格的水平对齐；数字列用 `end`，数字才能对齐。
   * @default 'start'
   */
  readonly align?: 'start' | 'center' | 'end'
  /**
   * Default width in pixels. Columns without a width share the remaining space (at least 120 px each).
   * @zh 默认宽度（像素）。没有宽度的列分享剩余的空间（每列至少 120px）。
   */
  readonly width?: number
  /**
   * Smallest width in pixels when resizing.
   * @zh 调整列宽时的最小宽度（像素）。
   * @default 56
   */
  readonly minWidth?: number
  /**
   * Largest width in pixels when resizing.
   * @zh 调整列宽时的最大宽度（像素）。
   * @default 800
   */
  readonly maxWidth?: number
  /**
   * Pins the column to the start or the end: it stays in place while the other columns scroll horizontally. A
   * pinned column without `width` is 160 px wide. Users can change it in the column settings.
   * @zh 把列固定在开头或结尾：横向滚动时它不动。没有 `width` 的固定列宽 160px。用户可以在列设置中修改。
   */
  readonly pin?: DataTablePin
  /**
   * The header can be clicked to sort by this column. Rows are sorted locally only when `compare` is given;
   * otherwise sort them yourself (for example on the server) using `onSortChange`.
   * @zh 可以点击表头按这一列排序。只有提供了 `compare` 才在本地排序；否则由使用方（如服务端）根据 `onSortChange` 排序。
   */
  readonly sortable?: boolean
  /**
   * Compares two rows for local sorting (ascending order; descending is derived). Implies `sortable`.
   * @zh 本地排序的比较函数（升序；降序自动取反）。提供它就意味着可以排序。
   */
  readonly compare?: (a: T, b: T) => number
  /**
   * Whether users can hide the column in the column settings. Set `false` for the main column (such as the
   * name), which is always shown.
   * @zh 用户能否在列设置中隐藏这一列。主列（如名称）设为 `false`，始终显示。
   * @default true
   */
  readonly hideable?: boolean
  /**
   * Hidden at first; users can show it in the column settings.
   * @zh 默认隐藏；用户可以在列设置中显示。
   */
  readonly defaultHidden?: boolean
  /**
   * Truncates the cell content to one line with an ellipsis; the full text appears in a tooltip, but only when
   * the text is actually cut off.
   * @zh 单元格内容超出时省略为一行；只有文字真的被截断时，才用提示显示完整内容。
   */
  readonly truncate?: boolean
  /**
   * Whether the width can be adjusted by dragging the edge of the header or with the keyboard.
   * @zh 能否拖动表头边缘或用键盘调整列宽。
   * @default true
   */
  readonly resizable?: boolean
}

/**
 * Props of DataTable.
 * @zh DataTable 属性。
 */
export interface DataTableProps<T> extends Pick<BaseProps, 'testId'> {
  /**
   * Accessible name of the table, such as "Projects".
   * @zh 表格的读屏名称，如「项目」。
   */
  readonly 'aria-label': string
  /**
   * The columns, in their default order.
   * @zh 列，按默认顺序排列。
   */
  readonly columns: readonly DataTableColumn<T>[]
  /**
   * The rows (the current page when paginated).
   * @zh 行（分页时是当前页）。
   */
  readonly rows: readonly T[]
  /**
   * Stable key of a row, such as its ID.
   * @zh 行的稳定键，如 ID。
   */
  readonly rowKey: (row: T) => string
  /**
   * Current sorting (controlled); `null` when not sorted. Use it with `onSortChange`, for example to sort on the
   * server.
   * @zh 当前排序（受控），不排序时为 `null`。与 `onSortChange` 一起使用，如由服务端排序。
   */
  readonly sort?: DataTableSort | null
  /**
   * Initial sorting (uncontrolled).
   * @zh 初始排序（非受控）。
   */
  readonly defaultSort?: DataTableSort | null
  /**
   * Called when a sortable header is clicked: none, then ascending, then descending, then none again.
   * @zh 点击可排序的表头时调用：不排序 → 升序 → 降序 → 不排序。
   */
  readonly onSortChange?: (sort: DataTableSort | null) => void
  /**
   * Adds a selection column with a checkbox in each row and a "select all" checkbox in the header.
   * @zh 增加选择列：每行一个复选框，表头一个「全选」复选框。
   */
  readonly selectable?: boolean
  /**
   * Keys of the selected rows (controlled); use it with `onSelectionChange`. Keys of rows that are not in `rows`
   * (other pages) are kept.
   * @zh 已选行的键（受控），与 `onSelectionChange` 一起使用。不在 `rows` 中的键（其他页）会保留。
   */
  readonly selectedKeys?: readonly string[]
  /**
   * Keys of the rows selected at first (uncontrolled).
   * @zh 初始选中的行（非受控）。
   */
  readonly defaultSelectedKeys?: readonly string[]
  /**
   * Called with the new keys when the selection changes.
   * @zh 选择变化时调用，参数是新的键。
   */
  readonly onSelectionChange?: (keys: readonly string[]) => void
  /**
   * Whether a row can be selected; rows that cannot have a disabled checkbox and are skipped by "select all".
   * @zh 行能否被选择；不能选择的行复选框禁用，「全选」时跳过。
   */
  readonly isRowSelectable?: (row: T) => boolean
  /**
   * Name of a row for screen readers, such as its title: the checkbox is read as "Select Alex Morgan". Without
   * it, the content of the first column is used.
   * @zh 行的读屏名称，如标题：复选框读作「选择 Alex Morgan」。省略时用第一列的内容。
   */
  readonly rowLabel?: (row: T) => string
  /**
   * Shows the column settings button on the right of the toolbar: users can show and hide columns, change their
   * order, pin them, and restore the defaults.
   * @zh 在工具栏右侧显示「列设置」按钮：用户可以显示、隐藏列，调整顺序，固定列，恢复默认。
   */
  readonly columnSettings?: boolean
  /**
   * Saves the column widths, order, visibility and pinning on this device (in `localStorage` under this key) and
   * restores them on the next visit. Use a key that is unique in your application, such as `'files.table'`.
   * Saved columns that no longer exist are ignored; new columns appear as defined.
   * @zh 把列宽、顺序、显示与固定保存在本机（`localStorage` 中，键名即此值），下次打开时恢复。键名在应用内要唯一，如
   * `'files.table'`。保存的数据中已经不存在的列被忽略，新增的列按定义显示。
   */
  readonly storageKey?: string
  /**
   * Height of the table area in pixels (without the toolbar and the footer): the rows scroll inside it and the
   * header stays at the top.
   * @zh 表格区域的高度（像素，不含工具栏与表尾）：行在其中滚动，表头吸顶。
   */
  readonly height?: number
  /**
   * Fills the height of the parent (a flex column or an element with a height): the rows scroll inside and the
   * header stays at the top.
   * @zh 占满父元素的高度（纵向弹性容器或有高度的元素）：行在其中滚动，表头吸顶。
   */
  readonly fill?: boolean
  /**
   * Renders only the visible rows. On by default with `height` or `fill` and more than 100 rows; it needs one of
   * them to know the visible area.
   * @zh 只渲染可见的行。有 `height` 或 `fill` 且超过 100 行时默认开启；需要两者之一才能知道可见区域。
   */
  readonly virtual?: boolean
  /**
   * Loading: the current rows stay, and a loading indicator appears on top of them after 200 ms (fast loads do
   * not flash). Without rows, the indicator takes the place of the empty state.
   * @zh 加载中：保留当前的行，200ms 后才在上面出现加载指示（很快完成的加载不闪）。没有行时，加载指示代替空状态。
   */
  readonly loading?: boolean
  /**
   * Error state shown instead of the rows: a text readable by users (never the raw exception), or `true` for the
   * default title only.
   * @zh 代替行显示的错误状态：用户可读的说明（不要显示原始异常），或 `true` 只显示默认标题。
   */
  readonly error?: ReactNode
  /**
   * Retry in the error state: when provided, a "Retry" button is shown.
   * @zh 错误状态中的重试：提供后显示「重试」按钮。
   */
  readonly onRetry?: () => void
  /**
   * Shown when there are no rows, instead of the default empty state.
   * @zh 没有行时显示，代替默认的空状态。
   */
  readonly empty?: ReactNode
  /**
   * Toolbar on the left above the table: search, filters, actions for the whole table.
   * @zh 表格上方左侧的工具栏：搜索、筛选、针对整个表格的操作。
   */
  readonly toolbar?: ReactNode
  /**
   * Content below the table, such as Pagination.
   * @zh 表格下方的内容，如 Pagination。
   */
  readonly footer?: ReactNode
  /**
   * Actions for the selected rows (usually Buttons). While rows are selected, the toolbar row is replaced in place
   * by a SelectionBar with the number of selected rows, "Clear selection" and these actions; the content below does
   * not move. Needs `selectable`.
   * @zh 针对已选行的操作（通常是 Button）。有已选行时，工具栏这一行在原位换成 SelectionBar：已选数量、「清除选择」与这些
   * 操作，下方的内容不移动。需要 `selectable`。
   */
  readonly bulkActions?: ReactNode
  /**
   * Number of all rows (all pages), when the table shows one page. Passed to the SelectionBar: it says "All N
   * selected" once everything is selected, and offers "Select all N" before that with `onSelectAll`.
   * @zh 全部行（所有页）的数量，表格只显示一页时提供。交给 SelectionBar：全部选中时显示「已选全部 N 项」，未全选且提供了
   * `onSelectAll` 时显示「选择全部 N 项」。
   */
  readonly totalCount?: number
  /**
   * Selects all rows of all pages (offered by the SelectionBar when `totalCount` is larger than the selection).
   * @zh 选择所有页的全部行（`totalCount` 大于已选数量时由 SelectionBar 提供入口）。
   */
  readonly onSelectAll?: () => void
  /**
   * Called when a row is clicked (not when clicking a link, a button, a checkbox or another control in it, or
   * when selecting text). Rows are not focusable: also put a link or a button that does the same thing in the
   * main column, so that keyboard and screen reader users can open the row.
   * @zh 点击行时调用（点击其中的链接、按钮、复选框等控件或选择文字时不调用）。行不能获得焦点：请同时在主列放一个
   * 作用相同的链接或按钮，键盘与读屏用户才能打开这一行。
   */
  readonly onRowClick?: (row: T, index: number) => void
}

/** 超过这个行数（并且有高度）时默认开启虚拟滚动。 */
const VIRTUAL_AUTO_ROWS = 100
/** 估计行高（像素）：一行文字加单元格上下内边距（table-cell-padding-y），实际行高渲染后测量。 */
const ROW_ESTIMATE = { comfortable: 46, compact: 30 } as const
/** 虚拟滚动时可见区域外额外渲染的行数。 */
const OVERSCAN = 8

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

const labelOf = <T,>(c: DataTableColumn<T>) =>
  c.label ?? (typeof c.title === 'string' ? c.title : c.key)

const cellText = (row: unknown, key: string): ReactNode => {
  const v = (row as Record<string, unknown> | null)?.[key]
  if (v === null || v === undefined) return null
  return typeof v === 'string' ? v : String(v)
}

/** 点击行时不当作「点击行」的元素：控件、链接与使用方的可交互内容。 */
const INTERACTIVE =
  'a,button,input,select,textarea,label,summary,[role="button"],[role="checkbox"],[role="link"],[role="menuitem"],[role="switch"],[role="tab"],[contenteditable=""],[contenteditable="true"]'

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
      insetInlineEnd: filler ? `calc(var(--vl-data-table-inset) + ${c.offset}px)` : c.offset,
    }
  return {
    insetInlineStart: selectable
      ? `calc(var(--vl-data-table-selection-width) + ${c.offset}px)`
      : c.offset,
  }
}

interface RowProps<T> {
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

const Row = memo(RowInner) as typeof RowInner

/**
 * A data table with sorting, selection, pinned and resizable columns, column settings saved on this device,
 * and virtual scrolling for large data. The columns and props are those of vellum-ui; it is not a wrapper of the
 * Ant Design table. Place it on a surface, such as a Panel with `flush`.
 *
 * **Interaction**: sortable headers are buttons: hover and press add the state layer, `Tab` shows the focus ring,
 * and `Enter` / `Space` sort (none, ascending, descending); the sorted header has `aria-sort`. Checkboxes select
 * rows (the whole cell is the click area, `Shift`-click selects a range); the header checkbox selects all rows
 * shown and is mixed when some are selected. The edge of a resizable header can be dragged, or focused with
 * `Tab` and adjusted with `←` / `→` (16 px, 64 px with `Shift`); `Enter` or a double click restores the default
 * width. Rows have a state layer on hover; with `onRowClick` the whole row can be clicked, and the main column
 * should contain a link for the keyboard. Text cut off by `truncate` shows its full text in a tooltip on hover
 * (after 500 ms) or keyboard focus. While `loading`, the rows stay and the indicator appears after 200 ms.
 * @zh 数据表格：排序、多选、固定列、可调列宽、保存在本机的列设置，大数据时虚拟滚动。列定义与属性是 vellum-ui 自己的，
 * 不是 Ant Design 表格的封装。放在表面上使用，如带 `flush` 的 Panel 中。
 *
 * **交互**：可排序的表头是按钮：悬停、按下叠加状态层，`Tab` 聚焦显示焦点环，`Enter` / `Space` 排序（不排序 → 升序 →
 * 降序），排序中的表头带 `aria-sort`。复选框选择行（整个单元格都是点击区域，按住 `Shift` 点击选择一段）；表头的复选框
 * 选择当前显示的全部行，部分选中时为半选。可调宽度的表头边缘可以拖动，也可以用 `Tab` 聚焦后按 `←` / `→` 调整（16px，
 * 按住 `Shift` 为 64px），`Enter` 或双击恢复默认宽度。悬停的行叠加状态层；提供 `onRowClick` 时整行可以点击，主列中应
 * 放一个供键盘使用的链接。`truncate` 截断的文字在悬停（500ms 后）或键盘聚焦时用提示显示全文。`loading` 时保留当前的行，
 * 200ms 后才出现加载指示。
 * @category Data
 * @usage Lists of records with server-side sorting and pagination, file and asset lists, large logs, tables that
 * users arrange themselves
 * @usageZh 服务端排序与分页的记录列表、文件与素材列表、大量日志、用户自己调整列的表格
 */
export function DataTable<T>(props: DataTableProps<T>) {
  const t = useT()
  const theme = useOptionalTheme()
  const baseId = useId()
  const { columns, rows, rowKey, storageKey, selectable = false } = props

  // —— 列状态（顺序、显示、固定、列宽）与保存 ——
  const [colState, setColState] = useState<ColumnState>(EMPTY_COLUMN_STATE)
  const stateRef = useRef(colState)
  stateRef.current = colState
  // 恢复保存的状态：在绘制之前读取（服务端与注水时用默认值，不会注水不一致；客户端不先显示默认再跳变）
  useLayoutEffect(() => {
    setColState(storageKey ? (readStored(storageKey) ?? EMPTY_COLUMN_STATE) : EMPTY_COLUMN_STATE)
  }, [storageKey])
  const columnsRef = useRef(columns)
  columnsRef.current = columns
  const persist = useCallback(
    (state: ColumnState) => {
      if (storageKey) writeStored(storageKey, serializeState(columnsRef.current, state))
    },
    [storageKey],
  )
  const applyState = useCallback(
    (next: ColumnState, save: boolean) => {
      stateRef.current = next
      setColState(next)
      if (save) persist(next)
    },
    [persist],
  )

  if (process.env.NODE_ENV !== 'production') warnColumns(columns)

  const layout = useMemo(() => {
    const visible = orderedColumns(columns, colState).filter((c) => !isHidden(c, colState))
    return layoutColumns(visible, colState)
  }, [columns, colState])
  const hasStartPins = layout.columns.some((c) => c.pin === 'start')
  const filler = !layout.hasFlex
  const colCount = layout.columns.length + (selectable ? 1 : 0) + (filler ? 1 : 0)

  // —— 排序 ——
  const [innerSort, setInnerSort] = useState<DataTableSort | null>(props.defaultSort ?? null)
  const sort = props.sort !== undefined ? props.sort : innerSort
  const { onSortChange } = props
  const toggleSort = useCallback(
    (key: string) => {
      const next = nextSort(sort, key)
      if (props.sort === undefined) setInnerSort(next)
      onSortChange?.(next)
    },
    [sort, props.sort, onSortChange],
  )
  const display = useMemo(
    () => sortRows(rows, sort, (key) => columns.find((c) => c.key === key)?.compare),
    [rows, sort, columns],
  )

  // —— 选择 ——
  const [innerSelected, setInnerSelected] = useState<readonly string[]>(
    props.defaultSelectedKeys ?? [],
  )
  const selectedKeys = props.selectedKeys ?? innerSelected
  const selectedSet = useMemo(() => new Set(selectedKeys), [selectedKeys])
  const { isRowSelectable, onSelectionChange } = props
  const canSelectRow = useCallback(
    (row: T) => (isRowSelectable ? isRowSelectable(row) : true),
    [isRowSelectable],
  )
  const selectableKeys = useMemo(
    () => (selectable ? display.filter(canSelectRow).map(rowKey) : []),
    [selectable, display, canSelectRow, rowKey],
  )
  const selectedShown = selectableKeys.reduce((n, k) => n + (selectedSet.has(k) ? 1 : 0), 0)
  const allSelected = selectableKeys.length > 0 && selectedShown === selectableKeys.length
  const someSelected = selectedShown > 0 && !allSelected
  const changeSelection = useCallback(
    (next: Set<string>) => {
      const keys = [...next]
      if (props.selectedKeys === undefined) setInnerSelected(keys)
      onSelectionChange?.(keys)
    },
    [props.selectedKeys, onSelectionChange],
  )
  const anchor = useRef<number | null>(null)
  const selectionRef = useRef({ display, selectedSet, canSelectRow, rowKey, changeSelection })
  selectionRef.current = { display, selectedSet, canSelectRow, rowKey, changeSelection }
  const toggleRow = useCallback((index: number, checked: boolean, shift: boolean) => {
    const s = selectionRef.current
    const next = new Set(s.selectedSet)
    const from = shift && anchor.current !== null ? Math.min(anchor.current, index) : index
    const to = shift && anchor.current !== null ? Math.max(anchor.current, index) : index
    for (let i = from; i <= to; i++) {
      const row = s.display[i]
      if (row === undefined || !s.canSelectRow(row)) continue
      const key = s.rowKey(row)
      if (checked) next.add(key)
      else next.delete(key)
    }
    anchor.current = index
    s.changeSelection(next)
  }, [])
  const toggleAll = (checked: boolean) => {
    const next = new Set(selectedSet)
    for (const k of selectableKeys) {
      if (checked) next.add(k)
      else next.delete(k)
    }
    anchor.current = null
    changeSelection(next)
  }

  // —— 行点击 ——
  const { onRowClick } = props
  const clickRef = useRef({ onRowClick, display })
  clickRef.current = { onRowClick, display }
  const clickRow = useCallback((index: number, e: MouseEvent<HTMLTableRowElement>) => {
    const { onRowClick: handler, display: list } = clickRef.current
    const row = list[index]
    if (!handler || row === undefined) return
    const target = e.target as Element
    // 弹层（下拉菜单等）的点击会沿 React 树冒泡到行上，但它们不在行的 DOM 中
    if (!e.currentTarget.contains(target)) return
    if (target.closest(INTERACTIVE)) return
    const selection = globalThis.getSelection?.()
    if (selection && !selection.isCollapsed && selection.toString()) return
    handler(row, index)
  }, [])

  // —— 尺寸、滚动 ——
  const scroller = useRef<HTMLDivElement>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const thead = useRef<HTMLTableSectionElement>(null)
  const bounded = props.height !== undefined || Boolean(props.fill)
  const virtual = bounded && (props.virtual ?? rows.length > VIRTUAL_AUTO_ROWS)
  if (process.env.NODE_ENV !== 'production' && props.virtual && !bounded)
    warnOnce('virtual', '`virtual` needs `height` or `fill`; all rows are rendered.')
  const estimate = ROW_ESTIMATE[theme?.density ?? 'comfortable']
  const [headHeight, setHeadHeight] = useState<number>(estimate)
  const [edges, setEdges] = useState({ start: false, end: false, overflow: false })
  const tip = useTruncationTip(viewport)
  const closeTip = tip.close

  useLayoutEffect(() => {
    const el = scroller.current
    const head = thead.current
    if (!el) return
    // 内容是否滚到了固定列下面（从右到左的页面中 scrollLeft 为负）
    const updateEdges = () => {
      const max = el.scrollWidth - el.clientWidth
      const x = Math.abs(el.scrollLeft)
      const start = x > 0.5
      const end = max - x > 0.5
      const overflow = max > 0.5
      setEdges((p) =>
        p.start === start && p.end === end && p.overflow === overflow
          ? p
          : { start, end, overflow },
      )
    }
    const measure = () => {
      updateEdges()
      if (head) setHeadHeight(head.offsetHeight)
    }
    measure()
    const onScroll = () => {
      updateEdges()
      closeTip()
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    if (typeof ResizeObserver === 'undefined')
      return () => el.removeEventListener('scroll', onScroll)
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    if (el.firstElementChild) observer.observe(el.firstElementChild)
    if (head) observer.observe(head)
    return () => {
      el.removeEventListener('scroll', onScroll)
      observer.disconnect()
    }
  }, [closeTip])

  // 弹性列的实际宽度：手柄的 aria-valuenow，以及开始调整时的起点
  const headerCells = useRef(new Map<string, HTMLTableCellElement>())
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
          if (prev[key] !== w) {
            next ??= { ...prev }
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
  /** 调整的起点：调整过的宽度、定宽列的宽度，弹性列取实际宽度。 */
  const widthNow = useCallback((key: string) => {
    const saved = stateRef.current.width[key]
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
      applyState({ ...s, width: { ...s.width, [column.key]: w } }, false)
    },
    [applyState],
  )
  const commitWidth = useCallback(() => persist(stateRef.current), [persist])
  const resetWidth = useCallback(
    (key: string) => {
      const s = stateRef.current
      if (!(key in s.width)) return
      const { [key]: _removed, ...rest } = s.width
      applyState({ ...s, width: rest }, true)
    },
    [applyState],
  )

  // —— 虚拟滚动 ——
  // 行的键：数据变化（排序、换页）时函数随之变化，虚拟列表重新取键；rowKey 常是内联函数，通过 ref 读取，
  // 否则每次渲染都要为全部行重新计算位置
  const rowKeyRef = useRef(rowKey)
  rowKeyRef.current = rowKey
  const getItemKey = useCallback(
    (i: number) => {
      const row = display[i]
      return row === undefined ? i : rowKeyRef.current(row)
    },
    [display],
  )
  const virtualizer = useVirtualizer({
    count: virtual ? display.length : 0,
    enabled: virtual,
    getScrollElement: () => scroller.current,
    estimateSize: () => estimate,
    overscan: OVERSCAN,
    scrollMargin: headHeight,
    getItemKey,
    // 服务端与注水的第一次渲染没有滚动容器：两边都按这个尺寸渲染第一屏，结果一致
    initialRect: { width: 0, height: props.height ?? 480 },
  })

  // —— 状态 ——
  const state = props.error
    ? 'error'
    : rows.length === 0
      ? props.loading
        ? 'loading'
        : 'empty'
      : null
  const busy = useDelayedPending(Boolean(props.loading) && rows.length > 0 && !props.error)

  const selectTextId = `${baseId}-select`
  const sortKey = sort?.key
  const sortDirection = sort?.direction

  const renderRow = (index: number, measure?: (el: Element | null) => void) => {
    const row = display[index] as T
    const key = rowKey(row)
    return (
      <Row<T>
        key={key}
        row={row}
        index={index}
        columns={layout.columns}
        selectable={selectable}
        canSelect={selectable && canSelectRow(row)}
        selected={selectable && selectedSet.has(key)}
        selectLabel={
          props.rowLabel ? t('dataTable.selectRow', { name: props.rowLabel(row) }) : undefined
        }
        labelledBy={`${selectTextId} ${baseId}-r${index}`}
        firstCellId={`${baseId}-r${index}`}
        filler={filler}
        edgeOnSelection={selectable && !hasStartPins}
        ariaRowIndex={virtual ? index + 2 : undefined}
        clickable={Boolean(onRowClick)}
        measure={measure}
        onToggle={toggleRow}
        onClick={clickRow}
      />
    )
  }

  let body: ReactNode
  if (state) {
    body = (
      <tr className={styles.stateRow}>
        <td colSpan={colCount} className={`${styles.cell} ${styles.stateCell}`}>
          {state === 'error' ? (
            <ErrorState
              size="sm"
              message={props.error === true ? undefined : props.error}
              onRetry={props.onRetry}
            />
          ) : state === 'loading' ? (
            <Loading />
          ) : (
            (props.empty ?? <EmptyState size="sm" />)
          )}
        </td>
      </tr>
    )
  } else if (virtual) {
    const items = virtualizer.getVirtualItems()
    const first = items[0]
    const last = items.at(-1)
    const top = first ? first.start - headHeight : 0
    const bottom = last ? virtualizer.getTotalSize() - (last.end - headHeight) : 0
    body = (
      <>
        {top > 0 && (
          // biome-ignore lint/a11y/noAriaHiddenOnFocusable: 占位行不可聚焦，对读屏隐藏（行数由 aria-rowcount 告知）
          <tr aria-hidden="true" className={styles.spacer}>
            <td colSpan={colCount} style={{ height: top }} />
          </tr>
        )}
        {items.map((item) => renderRow(item.index, virtualizer.measureElement))}
        {bottom > 0 && (
          // biome-ignore lint/a11y/noAriaHiddenOnFocusable: 占位行不可聚焦，对读屏隐藏（行数由 aria-rowcount 告知）
          <tr aria-hidden="true" className={styles.spacer}>
            <td colSpan={colCount} style={{ height: bottom }} />
          </tr>
        )}
      </>
    )
  } else {
    body = display.map((_, i) => renderRow(i))
  }

  // 表格的最小宽度：定宽列、弹性列的最小宽度、选择列，以及补宽空列至少的宽度（两端的内缩）
  const minWidth = layout.fixedWidth + layout.flexMinWidth
  const extra = [
    selectable && 'var(--vl-data-table-selection-width)',
    filler && 'var(--vl-data-table-inset)',
  ].filter(Boolean)
  const tableStyle: CSSProperties = {
    minWidth: extra.length ? `calc(${[...extra, `${minWidth}px`].join(' + ')})` : minWidth,
  }
  const bulk = props.bulkActions !== undefined && selectable
  const showToolbar = props.toolbar !== undefined || props.columnSettings || bulk
  const toolbarContent = (
    <>
      <div className={styles.toolbarStart}>{props.toolbar}</div>
      {props.columnSettings && (
        <div className={styles.toolbarEnd}>
          <ColumnSettings
            columns={columns}
            state={colState}
            labelOf={labelOf}
            onChange={(next) => applyState(next, true)}
            onReset={() => applyState(EMPTY_COLUMN_STATE, true)}
          />
        </div>
      )}
    </>
  )

  return (
    <div
      className={styles.root}
      data-testid={props.testId}
      data-fill={props.fill || undefined}
      data-resizing={resizing || undefined}
      data-busy={busy || undefined}
      data-scrolled-start={edges.start || undefined}
      data-scrolled-end={edges.end || undefined}
      data-overflow={edges.overflow || undefined}
    >
      {showToolbar &&
        (bulk ? (
          // 有已选行时工具栏这一行原位换成批量操作栏（SelectionBar 自己保证高度不变）；清除后焦点回到表格
          <div className={styles.toolbar} data-bulk="">
            <SelectionBar
              count={selectedKeys.length}
              total={props.totalCount}
              onSelectAll={props.onSelectAll}
              onClear={() => changeSelection(new Set())}
              returnFocus={() => scroller.current}
              toolbar={<div className={styles.toolbarRow}>{toolbarContent}</div>}
            >
              {props.bulkActions}
            </SelectionBar>
          </div>
        ) : (
          <div className={styles.toolbar}>{toolbarContent}</div>
        ))}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: 只是截断提示的事件委托（悬停、键盘焦点进出），不是可操作的元素 */}
      <div
        ref={viewport}
        className={styles.viewport}
        style={props.height !== undefined ? { height: props.height } : undefined}
        onPointerOver={tip.handlers.onPointerOver}
        onPointerLeave={tip.handlers.onPointerLeave}
        onFocus={tip.handlers.onFocus}
        onBlur={tip.handlers.onBlur}
      >
        <div ref={scroller} className={styles.scroller}>
          <table
            className={styles.table}
            aria-label={props['aria-label']}
            aria-rowcount={virtual ? display.length + 1 : undefined}
            aria-busy={props.loading || undefined}
            data-state={state ?? undefined}
            style={tableStyle}
          >
            <colgroup>
              {selectable && <col className={styles.selectCol} />}
              {layout.columns.map((c) => (
                <col key={c.column.key} style={c.width === null ? undefined : { width: c.width }} />
              ))}
              {filler && <col />}
            </colgroup>
            <thead ref={thead}>
              <tr aria-rowindex={virtual ? 1 : undefined}>
                {selectable && (
                  <th
                    scope="col"
                    className={`${styles.cell} ${styles.th} ${styles.selectCell}`}
                    data-pin="start"
                    data-edge={!hasStartPins ? 'start' : undefined}
                  >
                    <Checkbox
                      aria-label={t('dataTable.selectAll')}
                      checked={allSelected}
                      indeterminate={someSelected}
                      disabled={selectableKeys.length === 0 || state !== null}
                      onChange={(e) => toggleAll(e.target.checked)}
                    />
                  </th>
                )}
                {layout.columns.map((c) => {
                  const col = c.column
                  const sortable = Boolean(col.sortable || col.compare)
                  const direction = sortKey === col.key ? sortDirection : undefined
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
                      ref={(el) => {
                        if (el) headerCells.current.set(col.key, el)
                        else headerCells.current.delete(col.key)
                      }}
                      scope="col"
                      // 表头的读屏名称只是列名：否则其中列宽手柄的名称（「调整……的列宽」）也会算进去，
                      // 读屏在每个单元格前读出的列名就变成了「名称 调整名称的列宽」
                      aria-label={label}
                      data-key={col.key}
                      className={`${styles.cell} ${styles.th}`}
                      data-align={col.align}
                      data-pin={c.pin ?? undefined}
                      data-edge={c.edge ?? undefined}
                      style={stickyStyle(c, selectable, filler)}
                      aria-sort={
                        direction === 'asc'
                          ? 'ascending'
                          : direction === 'desc'
                            ? 'descending'
                            : undefined
                      }
                    >
                      {sortable ? (
                        <button
                          type="button"
                          className={styles.sort}
                          data-vl-state=""
                          data-sorted={direction}
                          onClick={() => toggleSort(col.key)}
                        >
                          {title}
                          <span className={styles.sortIcon} aria-hidden="true">
                            <Icon
                              name={
                                direction === 'asc'
                                  ? 'arrow-up'
                                  : direction === 'desc'
                                    ? 'arrow-down'
                                    : 'sort'
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
                          width={c.width ?? measured[col.key] ?? null}
                          min={bounds.min}
                          max={bounds.max}
                          onStart={() => widthNow(col.key)}
                          onChange={(w) => resizeTo(col, w)}
                          onCommit={commitWidth}
                          onReset={() => resetWidth(col.key)}
                          onDragChange={setResizing}
                        />
                      )}
                    </th>
                  )
                })}
                {filler && (
                  // biome-ignore lint/a11y/noAriaHiddenOnFocusable: 补满宽度的空列不可聚焦、没有内容，对读屏隐藏
                  <th
                    aria-hidden="true"
                    className={`${styles.cell} ${styles.th} ${styles.filler}`}
                    data-pin="end"
                  />
                )}
              </tr>
            </thead>
            <tbody>{body}</tbody>
          </table>
        </div>
        {busy && (
          <div className={styles.busy}>
            <Loading immediate />
          </div>
        )}
        {tip.node}
      </div>
      {props.footer !== undefined && <div className={styles.footer}>{props.footer}</div>}
      {selectable && !props.rowLabel && (
        <span id={selectTextId} hidden>
          {t('dataTable.select')}
        </span>
      )}
    </div>
  )
}

const warned = new Set<string>()
function warnOnce(id: string, message: string) {
  if (warned.has(id)) return
  warned.add(id)
  console.warn(`[vellum-ui] DataTable: ${message}`)
}

/** 开发模式下检查列定义：键重复、标题不是文字却没有 label。 */
function warnColumns(
  columns: readonly { readonly key: string; readonly label?: string; readonly title: ReactNode }[],
) {
  const seen = new Set<string>()
  for (const c of columns) {
    if (seen.has(c.key)) warnOnce(`dup:${c.key}`, `duplicate column key "${c.key}".`)
    seen.add(c.key)
    if (c.label === undefined && typeof c.title !== 'string')
      warnOnce(
        `label:${c.key}`,
        `column "${c.key}" has a title that is not a string; give it a \`label\` for the column settings and screen readers.`,
      )
  }
}
