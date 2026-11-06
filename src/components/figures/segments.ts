/**
 * 分段条的布局（纯函数）：每个部分的占比、颜色，以及把尾部合并为「其他」；色块里的文字是否放得下。
 * 不访问 DOM，服务端可用。
 *
 * - 颜色跟着部分走：第 n 个部分（在 `items` 中的位置，从 0 开始）用第 n + 1 个分类色，或用它的 `slot`；
 *   值为 0 的部分不绘制，但仍占着自己的颜色，其他部分不因此变色（docs/11 §4）；
 * - 超过 `maxItems` 个部分时，保留前 `maxItems - 1` 个，其余合并为「其他」（弱化色），总数不超过 `maxItems`；
 *   `maxItems` 限制在 2–8（分类色只有 8 个）；
 * - 负数、NaN、±Infinity 无法表示「整体中的一部分」：整条按空处理，并列出这些部分（组件在开发模式下警告）；
 *   全部为 0 或没有部分时同样为空，但这是正常数据，不警告。
 */
import { CHART_SLOTS, type ChartColorSlot, seriesColorToken } from '../charts/format.ts'

/** 分段条的一个部分（与组件的 SegmentedBarItem 相同）。 */
export interface SegmentInput {
  readonly key: string
  readonly name: string
  readonly value: number
  readonly slot?: ChartColorSlot
}

/** 布局后的一个色块。 */
export interface Segment {
  readonly key: string
  readonly name: string
  readonly value: number
  /** 占整体的比例，0–1。 */
  readonly share: number
  /** 填充色令牌名（不含 `--vl-` 前缀）。 */
  readonly color: string
  /** 色块内文字的颜色令牌名。 */
  readonly on: string
  /** 是否为合并出来的「其他」。 */
  readonly other: boolean
}

/** 分段条的布局结果。 */
export interface SegmentLayout {
  /** 要绘制的色块，按 `items` 的顺序，「其他」在最后。为空时显示空条。 */
  readonly segments: readonly Segment[]
  /** 全部有效部分的总和。 */
  readonly total: number
  /** 数值无效（负数、非有限数）的部分的 key；不为空时整条按空处理。 */
  readonly invalid: readonly string[]
}

/** 默认最多显示的部分数（含「其他」）：dataviz 对「一眼看出整体如何拆分」的上限。 */
export const DEFAULT_MAX_ITEMS = 6

/** 「其他」的 key：以控制字符开头，不会与使用方的 key 相同。 */
export const OTHER_KEY = '\u0000other'

const MUTED = 'color-chart-muted'

/** 计算分段条的色块。`otherName` 是「其他」的名称（随语言）。 */
export function layoutSegments(
  items: readonly SegmentInput[],
  otherName: string,
  maxItems: number = DEFAULT_MAX_ITEMS,
): SegmentLayout {
  const invalid = items.filter((i) => !Number.isFinite(i.value) || i.value < 0).map((i) => i.key)
  if (invalid.length) return { segments: [], total: 0, invalid }
  const drawn = items
    .map((item, i) => ({ item, color: seriesColorToken(i, item.slot) }))
    .filter(({ item }) => item.value > 0)
  const total = drawn.reduce((sum, { item }) => sum + item.value, 0)
  if (!(total > 0)) return { segments: [], total: 0, invalid: [] }
  const limit = Number.isFinite(maxItems)
    ? Math.min(CHART_SLOTS, Math.max(2, Math.floor(maxItems)))
    : DEFAULT_MAX_ITEMS
  const fold = drawn.length > limit
  const kept = fold ? drawn.slice(0, limit - 1) : drawn
  const segments: Segment[] = kept.map(({ item, color }) => ({
    key: item.key,
    name: item.name,
    value: item.value,
    share: item.value / total,
    color,
    on: `${color}-on`,
    other: false,
  }))
  if (fold) {
    const value = drawn.slice(limit - 1).reduce((sum, { item }) => sum + item.value, 0)
    segments.push({
      key: OTHER_KEY,
      name: otherName,
      value,
      share: value / total,
      color: MUTED,
      on: `${MUTED}-on`,
      other: true,
    })
  }
  return { segments, total, invalid: [] }
}

/**
 * 色块里的文字是否放得下：文字宽度加上两侧的内边距不超过色块宽度。放不下的块不写文字（不裁切、不溢出），
 * 数值留在提示与读屏名称中。
 */
export function labelFits(textWidth: number, blockWidth: number, padding: number): boolean {
  return textWidth > 0 && textWidth + 2 * padding <= blockWidth
}

const shareFormats = new Map<string, Intl.NumberFormat>()

/** 色块里的占比：整数百分比（46%），比提示中的写法（46.2%）短，更容易放进色块。 */
export function formatShareShort(share: number, locale: string): string {
  let f = shareFormats.get(locale)
  if (!f) {
    f = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 })
    shareFormats.set(locale, f)
  }
  return f.format(share)
}
