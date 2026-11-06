/**
 * DataTable 的纯逻辑（与 React、DOM 无关，在 Node 中单元测试）：
 * - 列状态：使用方调整过的顺序、显示与隐藏、固定、列宽，叠加在列定义的默认值之上；
 * - 保存到本机的格式与读取时的校验（忽略已经不存在的列，新增的列按默认显示并放在默认的位置附近）；
 * - 显示顺序（固定到开头的列、普通列、固定到结尾的列）、在同一组内上移 / 下移；
 * - 排序：表头点击的循环（无 → 升序 → 降序 → 无）与本地排序；
 * - 布局：每列的像素宽度（或弹性）、固定列的粘性偏移、表格的最小宽度。
 */

/** 固定的位置：开头或结尾。 */
export type DataTablePin = 'start' | 'end'

/** 排序方向。 */
export type DataTableSortDirection = 'asc' | 'desc'

/** 当前排序：按哪一列、哪个方向。 */
export interface DataTableSort {
  /** 列的 `key`。 */
  readonly key: string
  /** 方向：`asc` 升序、`desc` 降序。 */
  readonly direction: DataTableSortDirection
}

/** 模型需要的列定义字段（DataTableColumn 的子集）。 */
export interface ModelColumn {
  readonly key: string
  readonly width?: number
  readonly minWidth?: number
  readonly maxWidth?: number
  readonly pin?: DataTablePin
  readonly hideable?: boolean
  readonly defaultHidden?: boolean
}

/** 使用方调整过的列状态。没有记录的列取列定义的默认值。 */
export interface ColumnState {
  /** 全部列的顺序；null 为列定义的顺序。 */
  readonly order: readonly string[] | null
  readonly hidden: Readonly<Record<string, boolean>>
  /** 固定：有记录时覆盖列定义的 `pin`（null 为不固定）。 */
  readonly pin: Readonly<Record<string, DataTablePin | null>>
  /** 调整过的列宽（像素）。 */
  readonly width: Readonly<Record<string, number>>
}

export const EMPTY_COLUMN_STATE: ColumnState = Object.freeze({
  order: null,
  hidden: Object.freeze({}),
  pin: Object.freeze({}),
  width: Object.freeze({}),
})

/** 没有给 `width` 的列被固定时的宽度，也是没有 `width` 时键盘调整的起点之一。 */
export const DEFAULT_COLUMN_WIDTH = 160
/** 调整列宽时的默认最小、最大宽度。 */
export const DEFAULT_MIN_WIDTH = 56
export const DEFAULT_MAX_WIDTH = 800
/** 弹性列（没有 `width`）在布局中至少占的宽度：表格比容器窄时横向滚动，而不是把弹性列挤没。 */
export const FLEX_MIN_WIDTH = 120

const hasOwn = (o: object, k: string) => Object.hasOwn(o, k)

/** 列宽的范围。 */
export function widthBounds(c: ModelColumn): { min: number; max: number } {
  const min = Math.max(1, c.minWidth ?? DEFAULT_MIN_WIDTH)
  return { min, max: Math.max(min, c.maxWidth ?? DEFAULT_MAX_WIDTH) }
}

export function clampWidth(c: ModelColumn, width: number): number {
  const { min, max } = widthBounds(c)
  return Math.round(Math.min(max, Math.max(min, width)))
}

/** 生效的固定位置。 */
export function pinOf(c: ModelColumn, state: ColumnState): DataTablePin | null {
  return hasOwn(state.pin, c.key) ? (state.pin[c.key] ?? null) : (c.pin ?? null)
}

/** 是否可以隐藏：`hideable: false` 的列（如主列）始终显示。 */
export const canHide = (c: ModelColumn) => c.hideable !== false

/** 生效的隐藏状态。 */
export function isHidden(c: ModelColumn, state: ColumnState): boolean {
  if (!canHide(c)) return false
  return hasOwn(state.hidden, c.key) ? state.hidden[c.key] === true : c.defaultHidden === true
}

/**
 * 合并保存的顺序与当前的列：保存的顺序中已经不存在的列丢掉；新增的列（保存的顺序里没有）放在列定义中它前面那一列
 * 之后，前面没有列时放在最前。
 */
export function resolveOrder(
  defaults: readonly string[],
  saved: readonly string[] | null,
): string[] {
  if (!saved) return [...defaults]
  const known = new Set(defaults)
  const out = saved.filter((k, i) => known.has(k) && saved.indexOf(k) === i)
  const placed = new Set(out)
  defaults.forEach((key, i) => {
    if (placed.has(key)) return
    // 列定义中排在它前面、已经放好的最近一列
    let at = 0
    for (let j = i - 1; j >= 0; j--) {
      const prev = out.indexOf(defaults[j] as string)
      if (prev >= 0) {
        at = prev + 1
        break
      }
    }
    out.splice(at, 0, key)
    placed.add(key)
  })
  return out
}

/** 按显示顺序排列的全部列（含隐藏的列）：固定到开头的、普通的、固定到结尾的，各组内保持 order 中的顺序。 */
export function orderedColumns<C extends ModelColumn>(
  columns: readonly C[],
  state: ColumnState,
): C[] {
  const byKey = new Map(columns.map((c) => [c.key, c]))
  const order = resolveOrder(
    columns.map((c) => c.key),
    state.order,
  )
  const all = order.map((k) => byKey.get(k) as C)
  const group = (p: DataTablePin | null) => all.filter((c) => pinOf(c, state) === p)
  return [...group('start'), ...group(null), ...group('end')]
}

/**
 * 在同一个固定分组内上移（-1）或下移（+1）。返回新的状态；已经在分组的边上时返回 null。
 * 显示顺序是 order 按固定分组的稳定划分，所以交换同组的两个相邻列，划分的结果仍然一致。
 */
export function moveColumn(
  columns: readonly ModelColumn[],
  state: ColumnState,
  key: string,
  delta: -1 | 1,
): ColumnState | null {
  const shown = orderedColumns(columns, state)
  const i = shown.findIndex((c) => c.key === key)
  const self = shown[i]
  const other = shown[i + delta]
  if (!self || !other || pinOf(self, state) !== pinOf(other, state)) return null
  const order = resolveOrder(
    columns.map((c) => c.key),
    state.order,
  )
  const a = order.indexOf(key)
  const b = order.indexOf(other.key)
  order[a] = other.key
  order[b] = key
  return { ...state, order }
}

/** 能否在分组内上移 / 下移。 */
export function canMove(
  columns: readonly ModelColumn[],
  state: ColumnState,
  key: string,
  delta: -1 | 1,
): boolean {
  return moveColumn(columns, state, key, delta) !== null
}

// —— 保存到本机 ——

/** 保存格式的版本：格式不兼容地改变时加一，旧数据随之被忽略。 */
const STORAGE_VERSION = 1

interface StoredColumns {
  readonly v?: unknown
  readonly order?: unknown
  readonly hidden?: unknown
  readonly pin?: unknown
  readonly width?: unknown
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * 解析保存的列状态。格式不对、版本不同、存储不可用时返回 null（视为没有保存）；单个字段不合法时只丢掉那个字段。
 * 已经不存在的列在这里保留，由 resolveOrder 等在使用时忽略：同一个键名也可能被列不同的表格共用。
 */
export function parseStoredState(raw: string | null): ColumnState | null {
  if (!raw) return null
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isRecord(data)) return null
  const d: StoredColumns = data
  if (d.v !== STORAGE_VERSION) return null
  const order = Array.isArray(d.order) ? d.order.filter((k) => typeof k === 'string') : null
  const hidden: Record<string, boolean> = {}
  if (isRecord(d.hidden))
    for (const [k, v] of Object.entries(d.hidden)) if (typeof v === 'boolean') hidden[k] = v
  const pin: Record<string, DataTablePin | null> = {}
  if (isRecord(d.pin))
    for (const [k, v] of Object.entries(d.pin))
      if (v === 'start' || v === 'end' || v === null) pin[k] = v
  const width: Record<string, number> = {}
  if (isRecord(d.width))
    for (const [k, v] of Object.entries(d.width))
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) width[k] = v
  return { order, hidden, pin, width }
}

/** 序列化列状态，只写当前存在的列；没有任何调整时返回 null（应删除保存的数据）。 */
export function serializeState(columns: readonly ModelColumn[], state: ColumnState): string | null {
  const keys = new Set(columns.map((c) => c.key))
  const pick = <V>(r: Readonly<Record<string, V>>) =>
    Object.fromEntries(Object.entries(r).filter(([k]) => keys.has(k)))
  const hidden = pick(state.hidden)
  const pin = pick(state.pin)
  const width = pick(state.width)
  const order = state.order
    ? resolveOrder(
        columns.map((c) => c.key),
        state.order,
      )
    : null
  const changed =
    order !== null ||
    Object.keys(hidden).length > 0 ||
    Object.keys(pin).length > 0 ||
    Object.keys(width).length > 0
  if (!changed) return null
  return JSON.stringify({ v: STORAGE_VERSION, order, hidden, pin, width })
}

// —— 排序 ——

/** 点击表头后的排序：其他列 → 这一列升序；升序 → 降序；降序 → 不排序。 */
export function nextSort(current: DataTableSort | null, key: string): DataTableSort | null {
  if (!current || current.key !== key) return { key, direction: 'asc' }
  if (current.direction === 'asc') return { key, direction: 'desc' }
  return null
}

/** 本地排序（稳定）：只在排序列提供了比较函数时排序，否则保持原顺序（如服务端已经排好）。 */
export function sortRows<T>(
  rows: readonly T[],
  sort: DataTableSort | null,
  compareOf: (key: string) => ((a: T, b: T) => number) | undefined,
): readonly T[] {
  if (!sort) return rows
  const compare = compareOf(sort.key)
  if (!compare) return rows
  const sign = sort.direction === 'desc' ? -1 : 1
  // 带上原序号：降序时相等的行仍保持原来的先后
  return rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => sign * compare(a.row, b.row) || a.i - b.i)
    .map((x) => x.row)
}

// —— 布局 ——

/** 一列在布局中的结果。 */
export interface ColumnLayout<C extends ModelColumn> {
  readonly column: C
  readonly pin: DataTablePin | null
  /** 像素宽度；null 为弹性列（分享剩余的宽度）。 */
  readonly width: number | null
  /**
   * 固定列的粘性偏移（像素）：开头的列从开头量起（不含选择列，选择列的宽度由样式加上），结尾的列从结尾量起。
   * 不固定的列为 null。
   */
  readonly offset: number | null
  /** 固定分组与滚动内容交界处的列：滚动到它下面时显示分隔。 */
  readonly edge: DataTablePin | null
}

/**
 * 计算可见列的布局。固定列总是定宽（没有 `width` 时用默认宽度），否则粘性偏移无法确定；没有 `width` 也没有被调整过的
 * 普通列是弹性列。
 */
export function layoutColumns<C extends ModelColumn>(
  visible: readonly C[],
  state: ColumnState,
): { columns: ColumnLayout<C>[]; fixedWidth: number; flexMinWidth: number; hasFlex: boolean } {
  const base = visible.map((column) => {
    const pin = pinOf(column, state)
    const own = state.width[column.key] ?? column.width
    const width =
      own !== undefined
        ? clampWidth(column, own)
        : pin
          ? clampWidth(column, DEFAULT_COLUMN_WIDTH)
          : null
    return { column, pin, width }
  })
  const starts = base.filter((c) => c.pin === 'start')
  const ends = base.filter((c) => c.pin === 'end')
  let fromStart = 0
  const startOffsets = new Map<string, number>()
  for (const c of starts) {
    startOffsets.set(c.column.key, fromStart)
    fromStart += c.width ?? 0
  }
  let fromEnd = 0
  const endOffsets = new Map<string, number>()
  for (const c of [...ends].reverse()) {
    endOffsets.set(c.column.key, fromEnd)
    fromEnd += c.width ?? 0
  }
  const lastStart = starts.at(-1)?.column.key
  const firstEnd = ends[0]?.column.key
  let fixedWidth = 0
  let flexMinWidth = 0
  const columns = base.map((c): ColumnLayout<C> => {
    if (c.width === null) flexMinWidth += Math.max(c.column.minWidth ?? 0, FLEX_MIN_WIDTH)
    else fixedWidth += c.width
    const key = c.column.key
    return {
      ...c,
      offset:
        c.pin === 'start'
          ? (startOffsets.get(key) ?? 0)
          : c.pin === 'end'
            ? (endOffsets.get(key) ?? 0)
            : null,
      edge: key === lastStart ? 'start' : key === firstEnd ? 'end' : null,
    }
  })
  return { columns, fixedWidth, flexMinWidth, hasFlex: flexMinWidth > 0 }
}
