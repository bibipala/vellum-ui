/**
 * 分段条：一个整体分成几部分（dataviz 推荐用它代替环图）。自己写，不依赖图表库（ADR 0020 §2）。
 *
 * 规格（dataviz「Segmented bar」，docs/11 §4）：
 * - 宽度按数值比例；值为 0 的部分不绘制；没有基线，所以两端都不是直角；
 * - 细条 8px（密集行 4px），每段全圆角，不写文字；高条 28px（封顶），每部分是独立的块，4px 圆角，
 *   块之间 2px 间隙（透出底下的表面色）；占比或取整后的数值写在块内靠前的位置，文字色取 `color-chart-N-on`；
 * - 文字放不下的块不写文字：渲染后实际测量（布局 effect + ResizeObserver），服务端与首次渲染时不显示文字，
 *   不用 overflow 裁掉半截；
 * - 每块可以悬停与键盘聚焦（←/→ 漫游焦点），提示中数值在前、醒目；读屏不靠悬停就能读到每个部分的名称、
 *   数值与占比（每块是带读屏名称的 img）。名称是不可信文本，只作为 React 文本节点渲染。
 */
import {
  type CSSProperties,
  type KeyboardEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { useT } from '../../i18n/index.ts'
import {
  type ChartColorSlot,
  formatValue,
  useFormatValue,
  type ValueFormat,
} from '../charts/format.ts'
import type { BaseProps } from '../layout.tsx'
import { Tooltip } from '../overlays.tsx'
import hidden from '../visually-hidden.module.css'
import styles from './segmented-bar.module.css'
import {
  DEFAULT_MAX_ITEMS,
  formatShareShort,
  labelFits,
  layoutSegments,
  type Segment,
} from './segments.ts'

// 打包工具会把 process.env.NODE_ENV 替换为常量（antd 与 React 同样依赖这一点）；这里只声明用到的部分
declare const process: { readonly env: { readonly NODE_ENV?: string } }

/**
 * One part of a SegmentedBar.
 * @zh SegmentedBar 的一个部分。
 */
export interface SegmentedBarItem {
  /**
   * Unique key of the part.
   * @zh 部分的唯一标识。
   */
  readonly key: string
  /**
   * Name of the part, shown in the legend and the tooltip and read by screen readers.
   * @zh 部分的名称，显示在图例与提示中，读屏也会读出。
   */
  readonly name: string
  /**
   * Amount of the part: a finite number, 0 or more.
   * @zh 部分的数量：有限数，不小于 0。
   */
  readonly value: number
  /**
   * Chart color (1–8). By default the n-th item uses the n-th chart color.
   * @zh 图表颜色（1–8）。默认第 n 个部分用第 n 个图表颜色。
   */
  readonly slot?: ChartColorSlot
}

/**
 * Props of SegmentedBar.
 * @zh SegmentedBar 属性。
 */
export interface SegmentedBarProps extends Pick<BaseProps, 'testId'> {
  /**
   * The parts, in the order of the blocks. Each keeps the color of its position (or its `slot`) even when
   * another part is 0 and not drawn. Negative or non-finite values cannot be part of a whole: the bar is then
   * shown empty (with a warning in development). When every value is 0 the bar is empty too.
   * @zh 各个部分，按色块的顺序。每个部分保持其位置（或 `slot`）对应的颜色，其他部分为 0 不绘制时也不变色。
   * 负数与非有限数不能构成整体的一部分：此时整条显示为空（开发模式下给出警告）。全部为 0 时同样为空。
   */
  readonly items: readonly SegmentedBarItem[]
  /**
   * What the whole is, such as "Storage by file type". Screen readers read it before the parts.
   * @zh 整体是什么，如「按文件类型的存储占用」。读屏先读它，再读各个部分。
   */
  readonly label: string
  /**
   * `tall` (28 px): a bar standing alone, with the share or amount printed in each block that has room for it
   * and a legend. `thin` (8 px): a bar next to the figures it splits (in a table row or above a list), without
   * text or legend.
   * @zh `tall`（28px）：单独出现的条，放得下的块里写着占比或数量，并有图例。
   * `thin`（8px）：放在它所拆分的数字旁边（表格行中、列表上方），不写文字、默认没有图例。
   */
  readonly variant: 'thin' | 'tall'
  /**
   * Makes the thin bar 4 px high, for dense table rows.
   * @zh 细条的高度改为 4px，用于紧凑的表格行。
   */
  readonly dense?: boolean
  /**
   * What the tall blocks print: the `share` of the whole (46%) or the `value` (413M, written with `format`).
   * @zh 高条的块里写什么：占整体的比例 `share`（46%），或数量 `value`（413M，按 `format` 写）。
   * @default 'share'
   */
  readonly show?: 'share' | 'value'
  /**
   * How amounts are written, in the blocks (with `show="value"`), the tooltip and the accessible names.
   * @zh 数量的写法：用于块内（`show="value"` 时）、提示与读屏名称。
   * @default 'auto'
   */
  readonly format?: ValueFormat
  /**
   * The most parts shown, "Other" included (2–8). Past it, the parts after the first `maxItems - 1` are folded
   * into "Other" in the de-emphasis color, so order the items with the ones to keep first.
   * @zh 最多显示的部分数，含「其他」（2–8）。超过时，前 `maxItems - 1` 个之后的部分合并为「其他」（弱化色），
   * 所以把要保留的部分排在前面。
   * @default 6
   */
  readonly maxItems?: number
  /**
   * Shows a legend under the bar: the names in block order, without numbers. On by default for `tall`, off for
   * `thin` (in a table, use one legend for the whole table).
   * @zh 在条下方显示图例：按色块顺序列出名称，不重复数字。
   * `tall` 默认显示，`thin` 默认不显示（表格中整张表共用一个图例）。
   */
  readonly legend?: boolean
}

const cssVar = (token: string) => `var(--vl-${token})`

/** 提示的内容：数值在前、醒目，占比随后，名称在下一行。对读屏隐藏（块的读屏名称已包含同样的内容）。 */
function SegmentTip(props: { segment: Segment; value: string; share: string }) {
  return (
    <span className={styles.tip} aria-hidden="true">
      <span className={styles.tipRow}>
        <span
          className={styles.tipKey}
          style={{ background: cssVar(props.segment.color) } as CSSProperties}
        />
        <span className={styles.tipValue}>{props.value}</span>
        <span>{props.share}</span>
      </span>
      <span className={styles.tipName}>{props.segment.name}</span>
    </span>
  )
}

/**
 * A segmented bar shows how one whole splits into a few parts (up to 6 by default), as blocks whose widths are
 * proportional to the amounts. Use it instead of a pie or a donut. To compare the parts with each other or to
 * show more of them, use a bar chart; for a single ratio against a limit, use Progress.
 *
 * **Interaction**: hovering a block shows a tooltip with its amount, share and name; the blocks are one `Tab`
 * stop, and `←` / `→` (`Home` / `End`) move between them, showing the same tooltip. Screen readers read the
 * label of the bar and then each part as "Name: amount (share)", without hovering. A label that does not fit
 * in its block is not printed; the value stays in the tooltip and the accessible name.
 * @zh 分段条：一个整体分成几个部分（默认最多 6 个），块的宽度与数量成比例。代替饼图与环图。
 * 需要比较各部分大小或部分更多时用柱状图；单个比例相对上限时用 Progress。
 *
 * **交互**：悬停在块上显示提示：数量、占比与名称；
 * 所有块只占一个 `Tab` 位置，`←` / `→`（`Home` / `End`）在块之间移动，同样显示提示。
 * 读屏先读条的名称，再逐个读出「名称：数量（占比）」，不需要悬停。
 * 块里放不下的文字不写；数值仍在提示与读屏名称中。
 * @category Charts
 * @usage Storage by file type, time spent per phase, budget split, the split of a figure in a table row
 * @usageZh 按文件类型的存储占用、各阶段用时、预算拆分、表格行中某个数字的构成
 */
export function SegmentedBar(props: SegmentedBarProps) {
  const t = useT()
  const fmt = useFormatValue(props.format)
  const locale = t('format.locale')
  const missing = t('format.missing')
  const { items, variant } = props
  const tall = variant === 'tall'
  const show = props.show ?? 'share'
  const layout = layoutSegments(items, t('chart.other'), props.maxItems ?? DEFAULT_MAX_ITEMS)
  const { segments } = layout

  // 数据无效时整条为空：开发模式下说明原因（生产环境不输出）
  const invalidKeys = layout.invalid.join('\u0000')
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || !invalidKeys) return
    console.warn(
      `[vellum-ui] SegmentedBar: values must be finite numbers of 0 or more; the bar is shown empty. Invalid items: "${invalidKeys.split('\u0000').join('", "')}".`,
    )
  }, [invalidKeys])

  const texts = segments.map((s) => ({
    value: fmt(s.value),
    share: formatValue(s.share, 'percent', locale, missing),
    label: show === 'value' ? fmt(s.value) : formatShareShort(s.share, locale),
  }))

  // —— 块内文字：放得下才显示。服务端与首次渲染时都不显示，布局后测量 ——
  const trackRef = useRef<HTMLDivElement>(null)
  const [fits, setFits] = useState<readonly boolean[]>([])
  const labelsKey = tall ? texts.map((x) => x.label).join('\u0000') : ''
  useLayoutEffect(() => {
    const track = trackRef.current
    if (!track || !labelsKey) {
      setFits((prev) => (prev.length ? [] : prev))
      return
    }
    const measure = () => {
      const next = [...track.querySelectorAll<HTMLElement>('[data-segment-fill]')].map((fill) => {
        const label = fill.querySelector<HTMLElement>('[data-segment-label]')
        if (!label) return false
        // 文字离色块前端的距离就是两侧要留的内边距
        const padding = Number.parseFloat(getComputedStyle(label).insetInlineStart) || 0
        return labelFits(
          label.getBoundingClientRect().width,
          fill.getBoundingClientRect().width,
          padding,
        )
      })
      setFits((prev) =>
        prev.length === next.length && prev.every((v, i) => v === next[i]) ? prev : next,
      )
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    // 条的宽度变化，以及文字宽度变化（网页字体加载完成）时重新测量
    const observer = new ResizeObserver(measure)
    observer.observe(track)
    for (const label of track.querySelectorAll('[data-segment-label]')) observer.observe(label)
    return () => observer.disconnect()
  }, [labelsKey])

  // —— 漫游焦点：所有块只占一个 Tab 位置，方向键在块之间移动 ——
  const [active, setActive] = useState(0)
  const current = Math.min(active, Math.max(0, segments.length - 1))
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const from = Number(
      (e.target as HTMLElement).closest<HTMLElement>('[data-segment]')?.dataset.index,
    )
    if (!Number.isInteger(from)) return
    const last = segments.length - 1
    const to =
      e.key === 'ArrowRight'
        ? Math.min(last, from + 1)
        : e.key === 'ArrowLeft'
          ? Math.max(0, from - 1)
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? last
              : null
    if (to === null) return
    e.preventDefault()
    setActive(to)
    trackRef.current?.querySelector<HTMLElement>(`[data-segment][data-index="${to}"]`)?.focus()
  }

  const showLegend = (props.legend ?? tall) && segments.length > 0
  return (
    <figure
      aria-label={props.label}
      className={styles.root}
      data-variant={variant}
      data-dense={(!tall && props.dense) || undefined}
      data-testid={props.testId}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: 键盘事件委托给容器，交给获得焦点的块（role="img"，tabIndex 漫游） */}
      <div ref={trackRef} className={styles.track} onKeyDown={onKeyDown}>
        {segments.length === 0 ? (
          <span className={styles.empty} data-segment-empty="">
            <span className={hidden.hidden}>{t('segmentedBar.empty')}</span>
          </span>
        ) : (
          segments.map((s, i) => {
            const text = texts[i]
            if (!text) return null
            return (
              <Tooltip
                key={s.key}
                title={<SegmentTip segment={s} value={text.value} share={text.share} />}
              >
                <span
                  className={styles.segment}
                  role="img"
                  aria-label={t('segmentedBar.part', {
                    name: s.name,
                    value: text.value,
                    share: text.share,
                  })}
                  tabIndex={i === current ? 0 : -1}
                  data-segment=""
                  data-index={i}
                  data-other={s.other || undefined}
                  onFocus={() => setActive(i)}
                  style={
                    {
                      flexGrow: s.share * 100,
                      '--segment-color': cssVar(s.color),
                      '--segment-on': cssVar(s.on),
                    } as CSSProperties
                  }
                >
                  <span className={styles.fill} data-segment-fill="">
                    {tall && (
                      <span
                        className={styles.label}
                        data-segment-label=""
                        data-fit={fits[i] || undefined}
                      >
                        {text.label}
                      </span>
                    )}
                  </span>
                </span>
              </Tooltip>
            )
          })
        )}
      </div>
      {showLegend && (
        <ul className={styles.legend} aria-hidden="true">
          {segments.map((s) => (
            <li key={s.key} className={styles.legendItem}>
              <span
                className={styles.swatch}
                style={{ background: cssVar(s.color) } as CSSProperties}
              />
              {s.name}
            </li>
          ))}
        </ul>
      )}
    </figure>
  )
}
