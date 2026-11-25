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
 *
 * 按状态的归属拆成几个内部模块，这里只负责组合与表格的结构：
 * - useColumnPreferences：列的顺序、显示、固定与列宽（保存、拖动中的临时宽度、弹性列的测量）；
 * - useTableSelection：受控与非受控的选择、Shift 点击的起点、表头复选框的汇总；
 * - useTableViewport：滚动容器的观察、边缘、表头高度与虚拟滚动；
 * - rows.tsx：memo 的表头（Head）与行（Row）；model.ts：列布局的纯函数。
 */
import {
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useT } from '../../i18n/index.ts'
import { EmptyState, ErrorState, Loading } from '../feedback.tsx'
import type { BaseProps } from '../layout.tsx'
import { SelectionBar } from '../SelectionBar.tsx'
import { useDelayedPending } from '../useDelayedPending.ts'
import { useKeyIndex } from '../virtual.ts'
import { ColumnSettings } from './ColumnSettings.tsx'
import styles from './data-table.module.css'
import { type DataTablePin, type DataTableSort, nextSort, sortRows } from './model.ts'
import { Head, labelOf, Row } from './rows.tsx'
import { useTruncationTip } from './truncation.tsx'
import { useColumnPreferences } from './useColumnPreferences.ts'
import { useTableSelection } from './useTableSelection.ts'
import { useTableViewport } from './useTableViewport.ts'

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
   * Compares two rows for local sorting (ascending order; descending is derived). Implies `sortable`. It sorts the
   * rows passed in `rows` only: when the table shows one page of a longer list, sort the whole list yourself
   * (controlled `sort` and `onSortChange`) before cutting out the page, or sort on the server.
   * @zh 本地排序的比较函数（升序；降序自动取反）。提供它就意味着可以排序。它只对 `rows` 中传入的行排序：表格只显示
   * 较长列表中的一页时，要先自己对整个列表排序（受控的 `sort` 与 `onSortChange`）再取出这一页，或者在服务端排序。
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
   * Content below the table, such as Pagination. Leave it out while there are no rows: a pager for an empty list
   * only shows "0" and page 1.
   * @zh 表格下方的内容，如 Pagination。没有行时不要传：空列表的分页只会显示 0 条与第 1 页。
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
   * selected" once everything is selected, and offers "Select all N" before that with `onSelectAll`. When some
   * rows cannot be selected (`isRowSelectable`), pass the number of rows that can.
   * @zh 全部行（所有页）的数量，表格只显示一页时提供。交给 SelectionBar：全部选中时显示「已选全部 N 项」，未全选且提供了
   * `onSelectAll` 时显示「选择全部 N 项」。有不能选择的行（`isRowSelectable`）时，传能选择的行数。
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

/** 点击行时不当作「点击行」的元素：控件、链接与使用方的可交互内容。 */
const INTERACTIVE =
  'a,button,input,select,textarea,label,summary,[role="button"],[role="checkbox"],[role="link"],[role="menuitem"],[role="switch"],[role="tab"],[contenteditable=""],[contenteditable="true"]'

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
  const baseId = useId()
  const { columns, rows, rowKey, storageKey, selectable = false } = props

  // —— 列状态（顺序、显示、固定、列宽）与保存 ——
  const prefs = useColumnPreferences(columns, storageKey)
  const { layout } = prefs

  if (process.env.NODE_ENV !== 'production') warnColumns(columns)

  const hasStartPins = layout.columns.some((c) => c.pin === 'start')
  const filler = !layout.hasFlex
  const colCount = layout.columns.length + (selectable ? 1 : 0) + (filler ? 1 : 0)

  // —— 排序 ——
  const [innerSort, setInnerSort] = useState<DataTableSort | null>(props.defaultSort ?? null)
  const sort = props.sort !== undefined ? props.sort : innerSort
  // 点击时读取最新的排序与回调：toggleSort 的身份不变，使用方传入新的 onSortChange 时表头（memo）不重新渲染
  const sortNow = { sort, controlled: props.sort !== undefined, onSortChange: props.onSortChange }
  const sortRef = useRef(sortNow)
  sortRef.current = sortNow
  const toggleSort = useCallback((key: string) => {
    const s = sortRef.current
    const next = nextSort(s.sort, key)
    if (!s.controlled) setInnerSort(next)
    s.onSortChange?.(next)
  }, [])
  const display = useMemo(
    () => sortRows(rows, sort, (key) => columns.find((c) => c.key === key)?.compare),
    [rows, sort, columns],
  )
  // 按键查找行的位置：每份显示的数据一张表，用到时才建立（Shift 点击选择一段、保留焦点所在的行共用）
  const indexOf = useKeyIndex(display, rowKey)

  // —— 选择 ——
  const selection = useTableSelection({
    enabled: selectable,
    rows: display,
    rowKey,
    indexOf,
    selectedKeys: props.selectedKeys,
    defaultSelectedKeys: props.defaultSelectedKeys,
    onSelectionChange: props.onSelectionChange,
    isRowSelectable: props.isRowSelectable,
  })

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
    const text = globalThis.getSelection?.()
    if (text && !text.isCollapsed && text.toString()) return
    handler(row, index)
  }, [])

  // —— 尺寸、滚动 ——
  const viewport = useRef<HTMLDivElement>(null)
  const bounded = props.height !== undefined || Boolean(props.fill)
  const virtual = bounded && (props.virtual ?? rows.length > VIRTUAL_AUTO_ROWS)
  if (process.env.NODE_ENV !== 'production' && props.virtual && !bounded)
    warnOnce('virtual', '`virtual` needs `height` or `fill`; all rows are rendered.')
  const tip = useTruncationTip(viewport)
  const view = useTableViewport({
    rows: display,
    rowKey,
    indexOf,
    virtual,
    height: props.height,
    onScroll: tip.close,
  })
  const { virtualizer, headHeight, edges } = view

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
        canSelect={selectable && selection.canSelect(row)}
        selected={selectable && selection.selected.has(key)}
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
        onToggle={selection.toggleRow}
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
    // 渲染的行不一定连续（保持挂载的焦点行可能远在可见区域之外）：每段空隙用一个占位行撑开
    const spacer = (key: string, height: number) => (
      // biome-ignore lint/a11y/noAriaHiddenOnFocusable: 占位行不可聚焦，对读屏隐藏（行数由 aria-rowcount 告知）
      <tr key={key} aria-hidden="true" className={styles.spacer}>
        <td colSpan={colCount} style={{ height }} />
      </tr>
    )
    const parts: ReactNode[] = []
    let cursor = headHeight
    for (const item of virtualizer.getVirtualItems()) {
      if (item.start > cursor) parts.push(spacer(`gap-${item.index}`, item.start - cursor))
      parts.push(renderRow(item.index, virtualizer.measureElement))
      cursor = item.end
    }
    const bottom = virtualizer.getTotalSize() - (cursor - headHeight)
    if (bottom > 0) parts.push(spacer('gap-end', bottom))
    body = parts
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
            state={prefs.state}
            labelOf={labelOf}
            onChange={prefs.change}
            onReset={prefs.reset}
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
      data-footer={props.footer !== undefined || undefined}
      data-resizing={prefs.resizing || undefined}
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
              count={selection.keys.length}
              total={props.totalCount}
              onSelectAll={props.onSelectAll}
              onClear={selection.clear}
              returnFocus={() => view.scroller.current}
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
        <div ref={view.scroller} className={styles.scroller}>
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
            <Head<T>
              theadRef={view.thead}
              columns={layout.columns}
              selectable={selectable}
              hasStartPins={hasStartPins}
              filler={filler}
              virtual={virtual}
              sortKey={sort?.key}
              sortDirection={sort?.direction}
              allSelected={selection.all}
              someSelected={selection.some}
              selectAllDisabled={selection.selectableCount === 0 || state !== null}
              measured={prefs.measured}
              onSort={toggleSort}
              onToggleAll={selection.toggleAll}
              headerCell={prefs.headerCell}
              widthNow={prefs.widthNow}
              onResize={prefs.resizeTo}
              onResizeCommit={prefs.commitWidth}
              onResizeReset={prefs.resetWidth}
              onResizeDrag={prefs.setResizing}
            />
            <tbody onFocus={view.onBodyFocus} onBlur={view.onBodyBlur}>
              {body}
            </tbody>
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
