/**
 * DataTable 的纯逻辑：列状态与显示顺序、在分组内移动、保存格式（忽略已经不存在的列、新增的列按默认显示）、
 * 排序的循环与本地稳定排序、列宽的范围与固定列的偏移。
 */
import { describe, expect, it } from 'vitest'
import {
  type ColumnState,
  canMove,
  clampWidth,
  DEFAULT_COLUMN_WIDTH,
  EMPTY_COLUMN_STATE,
  FLEX_MIN_WIDTH,
  isHidden,
  layoutColumns,
  type ModelColumn,
  moveColumn,
  nextSort,
  orderedColumns,
  parseStoredState,
  resolveOrder,
  serializeState,
  sortRows,
} from '../src/components/data-table/model.ts'

const cols: ModelColumn[] = [
  { key: 'name', hideable: false, width: 240 },
  { key: 'owner' },
  { key: 'status', defaultHidden: true },
  { key: 'size', width: 96, minWidth: 64, maxWidth: 200 },
  { key: 'actions', pin: 'end', width: 120 },
]
const keys = (list: readonly ModelColumn[]) => list.map((c) => c.key)
const state = (s: Partial<ColumnState>): ColumnState => ({ ...EMPTY_COLUMN_STATE, ...s })

describe('列的顺序', () => {
  it('没有保存的顺序时按列定义；固定到结尾的列排在最后', () => {
    expect(keys(orderedColumns(cols, EMPTY_COLUMN_STATE))).toEqual([
      'name',
      'owner',
      'status',
      'size',
      'actions',
    ])
    const pinned = state({ pin: { size: 'start', actions: null } })
    expect(keys(orderedColumns(cols, pinned))).toEqual([
      'size',
      'name',
      'owner',
      'status',
      'actions',
    ])
  })

  it('保存的顺序：丢掉已经不存在的列与重复项；新增的列放在列定义中它前面那一列之后', () => {
    const defaults = ['a', 'b', 'c', 'd']
    expect(resolveOrder(defaults, ['d', 'gone', 'c', 'a', 'b', 'a'])).toEqual(['d', 'c', 'a', 'b'])
    // b、d 是新增的：b 跟在 a 后面，d 跟在 c 后面
    expect(resolveOrder(defaults, ['c', 'a'])).toEqual(['c', 'd', 'a', 'b'])
    // 第一列是新增的：放在最前
    expect(resolveOrder(defaults, ['b', 'c', 'd'])).toEqual(['a', 'b', 'c', 'd'])
    expect(resolveOrder(defaults, [])).toEqual(defaults)
  })

  it('在同一个固定分组内上移 / 下移；分组的边上不能再移', () => {
    const moved = moveColumn(cols, EMPTY_COLUMN_STATE, 'owner', -1)
    expect(moved && keys(orderedColumns(cols, moved))).toEqual([
      'owner',
      'name',
      'status',
      'size',
      'actions',
    ])
    // size 是普通列中的最后一个，下面是固定到结尾的 actions：不能下移
    expect(canMove(cols, EMPTY_COLUMN_STATE, 'size', 1)).toBe(false)
    expect(canMove(cols, EMPTY_COLUMN_STATE, 'actions', -1)).toBe(false)
    expect(canMove(cols, EMPTY_COLUMN_STATE, 'name', -1)).toBe(false)
    // 固定到开头的分组内部
    const two = state({ pin: { name: 'start', size: 'start' } })
    expect(keys(orderedColumns(cols, two)).slice(0, 2)).toEqual(['name', 'size'])
    const swapped = moveColumn(cols, two, 'size', -1)
    expect(swapped && keys(orderedColumns(cols, swapped)).slice(0, 2)).toEqual(['size', 'name'])
    // 分组内的最后一列（下面是普通列 owner）不能下移，第一列不能上移
    expect(canMove(cols, two, 'name', 1)).toBe(true)
    expect(canMove(cols, two, 'size', 1)).toBe(false)
    expect(canMove(cols, two, 'name', -1)).toBe(false)
  })
})

describe('显示与隐藏', () => {
  it('defaultHidden 默认隐藏；hideable: false 的列始终显示，即使保存的数据说隐藏', () => {
    expect(isHidden(cols[2] as ModelColumn, EMPTY_COLUMN_STATE)).toBe(true)
    expect(isHidden(cols[2] as ModelColumn, state({ hidden: { status: false } }))).toBe(false)
    expect(isHidden(cols[0] as ModelColumn, state({ hidden: { name: true } }))).toBe(false)
    expect(isHidden(cols[1] as ModelColumn, state({ hidden: { owner: true } }))).toBe(true)
  })
})

describe('保存到本机的格式', () => {
  it('来回转换；只写当前存在的列；没有调整时为 null', () => {
    expect(serializeState(cols, EMPTY_COLUMN_STATE)).toBeNull()
    const s = state({
      order: ['owner', 'name', 'status', 'size', 'actions', 'gone'],
      hidden: { owner: true, gone: true },
      pin: { size: 'start', actions: null },
      width: { name: 300, gone: 99 },
    })
    const raw = serializeState(cols, s)
    expect(raw).not.toBeNull()
    const back = parseStoredState(raw)
    expect(back).toEqual({
      order: ['owner', 'name', 'status', 'size', 'actions'],
      hidden: { owner: true },
      pin: { size: 'start', actions: null },
      width: { name: 300 },
    })
  })

  it('格式不对、版本不同时视为没有保存；单个字段不合法时只丢掉那个字段', () => {
    expect(parseStoredState(null)).toBeNull()
    expect(parseStoredState('not json')).toBeNull()
    expect(parseStoredState('[1,2]')).toBeNull()
    expect(parseStoredState(JSON.stringify({ v: 99, order: ['a'] }))).toBeNull()
    expect(
      parseStoredState(
        JSON.stringify({
          v: 1,
          order: ['a', 3, 'b'],
          hidden: { a: 'yes', b: true },
          pin: { a: 'left', b: 'end', c: null },
          width: { a: -5, b: 'wide', c: 180, d: null },
        }),
      ),
    ).toEqual({
      order: ['a', 'b'],
      hidden: { b: true },
      pin: { b: 'end', c: null },
      width: { c: 180 },
    })
    expect(parseStoredState(JSON.stringify({ v: 1 }))).toEqual(EMPTY_COLUMN_STATE)
  })

  it('保存的数据中已经不存在的列被忽略，新增的列按默认显示', () => {
    const stored = parseStoredState(
      JSON.stringify({
        v: 1,
        order: ['size', 'removed', 'name'],
        hidden: { removed: false, size: true },
        pin: {},
        width: { removed: 400 },
      }),
    ) as ColumnState
    const shown = orderedColumns(cols, stored).filter((c) => !isHidden(c, stored))
    // owner、status、actions 是新增的：owner 跟在 name 后面，status 默认隐藏，actions 固定在结尾
    expect(keys(shown)).toEqual(['name', 'owner', 'actions'])
    expect(layoutColumns(shown, stored).columns.map((c) => c.width)).toEqual([240, null, 120])
  })
})

describe('排序', () => {
  it('点击表头：其他列 → 升序 → 降序 → 不排序', () => {
    expect(nextSort(null, 'a')).toEqual({ key: 'a', direction: 'asc' })
    expect(nextSort({ key: 'a', direction: 'asc' }, 'a')).toEqual({ key: 'a', direction: 'desc' })
    expect(nextSort({ key: 'a', direction: 'desc' }, 'a')).toBeNull()
    expect(nextSort({ key: 'a', direction: 'desc' }, 'b')).toEqual({ key: 'b', direction: 'asc' })
  })

  it('本地排序是稳定的（降序时相等的行也保持原来的先后）；没有比较函数时不排序', () => {
    const rows = [
      { id: 1, g: 'b' },
      { id: 2, g: 'a' },
      { id: 3, g: 'b' },
      { id: 4, g: 'a' },
    ]
    const byG = (a: (typeof rows)[number], b: (typeof rows)[number]) => a.g.localeCompare(b.g)
    const ids = (r: readonly (typeof rows)[number][]) => r.map((x) => x.id)
    expect(ids(sortRows(rows, { key: 'g', direction: 'asc' }, () => byG))).toEqual([2, 4, 1, 3])
    expect(ids(sortRows(rows, { key: 'g', direction: 'desc' }, () => byG))).toEqual([1, 3, 2, 4])
    expect(sortRows(rows, { key: 'g', direction: 'asc' }, () => undefined)).toBe(rows)
    expect(sortRows(rows, null, () => byG)).toBe(rows)
  })
})

describe('布局', () => {
  it('列宽限制在最小与最大宽度之间', () => {
    const size = cols[3] as ModelColumn
    expect(clampWidth(size, 10)).toBe(64)
    expect(clampWidth(size, 500)).toBe(200)
    expect(clampWidth(size, 120.4)).toBe(120)
  })

  it('固定列定宽、带偏移，交界处的列标为 edge；弹性列计入最小宽度', () => {
    const s = state({ pin: { name: 'start', owner: 'start' }, width: { size: 150 } })
    const visible = orderedColumns(cols, s).filter((c) => !isHidden(c, s))
    const { columns, fixedWidth, flexMinWidth, hasFlex } = layoutColumns(visible, s)
    expect(columns.map((c) => [c.column.key, c.pin, c.width, c.offset, c.edge] as const)).toEqual([
      ['name', 'start', 240, 0, null],
      // 没有 width 的列被固定时用默认宽度
      ['owner', 'start', DEFAULT_COLUMN_WIDTH, 240, 'start'],
      ['size', null, 150, null, null],
      ['actions', 'end', 120, 0, 'end'],
    ])
    expect(fixedWidth).toBe(240 + DEFAULT_COLUMN_WIDTH + 150 + 120)
    expect(flexMinWidth).toBe(0)
    expect(hasFlex).toBe(false)
    const plain = layoutColumns(
      orderedColumns(cols, EMPTY_COLUMN_STATE).filter((c) => !isHidden(c, EMPTY_COLUMN_STATE)),
      EMPTY_COLUMN_STATE,
    )
    expect(plain.hasFlex).toBe(true)
    expect(plain.flexMinWidth).toBe(FLEX_MIN_WIDTH)
  })
})
