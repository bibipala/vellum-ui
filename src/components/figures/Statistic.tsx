/**
 * 指标卡（dataviz 的 stat tile）：标签、数值、增减与趋势。自己写，不依赖图表库（ADR 0020 §2）。
 *
 * 规格（docs/11 §4、dataviz「Figures」）：
 * - 标签句首大写、不带冒号，次要文字色；数值半粗、正文字体、比例数字（不用等宽数字：大号数字用等宽数字会显得松散）；
 * - 增减带正负号、对比的时期，颜色 = 方向 × 是否向好，总是同时有箭头与文字，读屏读出完整的一句话；
 * - 趋势是迷你图（历史弱化色、当前强调色）；
 * - 加载时数值位置显示骨架，增减与趋势保留同样的高度，内容到来时尺寸不跳。
 * 指标卡本身没有底色与内边距：单独使用时放进 Panel，多个指标用 Grid 排成一行（KPI 行）。
 */
import type { ReactNode } from 'react'
import { useT } from '../../i18n/index.ts'
import { useFormatValue, type ValueFormat } from '../charts/format.ts'
import { Icon, type IconName } from '../Icon.tsx'
import type { BaseProps } from '../layout.tsx'
import hidden from '../visually-hidden.module.css'
import { Sparkline } from './Sparkline.tsx'
import styles from './statistic.module.css'
import { type DeltaDirection, deltaDirection, deltaTone, signedText } from './statistic-delta.ts'

/**
 * The change of a Statistic compared with an earlier period.
 * @zh Statistic 与之前某个时期相比的增减。
 */
export interface StatisticDelta {
  /**
   * The change. With the default `format` it is a ratio: 0.125 is shown as +12.5%.
   * @zh 增减值。默认 `format` 下是比例：0.125 显示为 +12.5%。
   */
  readonly value: number
  /**
   * How the change is written (without its sign, which is added).
   * @zh 增减值的写法（不含正负号，正负号另外加上）。
   * @default 'percent'
   */
  readonly format?: ValueFormat
  /**
   * The period it is compared with, such as "vs last month".
   * @zh 对比的时期，如「与上月相比」。
   */
  readonly period: string
  /**
   * Which direction is good: `up` (revenue), `down` (errors, response time) or `none` (neither, shown in the
   * secondary text color).
   * @zh 哪个方向是好的：`up`（收入）、`down`（错误数、响应时间）或 `none`（不评价好坏，用次要文字色）。
   * @default 'up'
   */
  readonly goodWhen?: 'up' | 'down' | 'none'
}

/**
 * Props of Statistic.
 * @zh Statistic 属性。
 */
export interface StatisticProps extends Pick<BaseProps, 'testId'> {
  /**
   * What the number is, in sentence case and without a trailing colon, such as "Monthly revenue".
   * @zh 数值是什么，句首大写、不带冒号，如「月收入」。
   */
  readonly label: string
  /**
   * The value. `null` shows a dash (no data).
   * @zh 数值。`null` 显示为短横线（没有数据）。
   */
  readonly value: number | null
  /**
   * How the value is written; `auto` is in full below 10,000 and compact from there on (1,284 · 12.9K).
   * @zh 数值的写法；`auto` 小于 10,000 时写全，从 10,000 起用紧凑写法（1,284 · 1.3万）。
   * @default 'auto'
   */
  readonly format?: ValueFormat
  /**
   * Text before the value, in the same style, such as a currency symbol.
   * @zh 数值前的文字，与数值同样的样式，如货币符号。
   */
  readonly prefix?: string
  /**
   * A unit after the value, smaller and in the secondary text color, such as "items" or "ms".
   * @zh 数值后的单位，字号较小、次要文字色，如「件」「ms」。
   */
  readonly suffix?: string
  /**
   * The change compared with an earlier period: `{ value, period, format?, goodWhen? }`. It is shown with an
   * arrow and a sign (+12.5%), never by color alone; its color is the success color when the change is good,
   * the danger color when it is bad, and the secondary text color with `goodWhen: 'none'` or no change.
   * @zh 与之前某个时期相比的增减：`{ value, period, format?, goodWhen? }`。总是同时显示箭头与正负号（+12.5%），
   * 不只靠颜色；向好时为成功色，变差时为危险色，`goodWhen: 'none'` 或没有变化时为次要文字色。
   */
  readonly delta?: StatisticDelta
  /**
   * Recent values, oldest first, drawn as a Sparkline under the value (about 12 points): the history in the
   * de-emphasis color, the current value as an accent dot.
   * @zh 最近的数值，从早到晚，在数值下方画成迷你图（约 12 个点）：历史为弱化色，当前值为强调色圆点。
   */
  readonly trend?: readonly (number | null)[]
  /**
   * Shows a skeleton in place of the value (and of the change and trend, when given) while the data loads; the
   * size does not change when the data arrives.
   * @zh 数据加载时，数值（以及传入的增减与趋势）的位置显示骨架；数据到来时尺寸不变。
   */
  readonly loading?: boolean
  /**
   * Size of the value: `md` (24 px) for KPI rows, `lg` (32 px) for the main figure of an area.
   * @zh 数值的尺寸：`md`（24px）用于指标行，`lg`（32px）用于区域内的主要数字。
   * @default 'md'
   */
  readonly size?: 'md' | 'lg'
}

const ARROW: Record<DeltaDirection, IconName> = {
  up: 'arrow-up',
  down: 'arrow-down',
  flat: 'arrow-right',
}

/**
 * A stat tile: a label, a value, its change compared with an earlier period, and an optional trend line. It has
 * no background or padding of its own: place it in a Panel, and put several of them in a Grid to form a KPI row.
 *
 * **Interaction**: not interactive. The value is semibold with proportional figures. The change always has an
 * arrow and a sign, and screen readers read it as a sentence, such as "Up 12.5%, vs last month". While loading,
 * a skeleton takes the place of the value and appears after 200 ms, so fast loads do not flash; the size does
 * not change when the data arrives.
 * @zh 指标卡：标签、数值、与之前某个时期相比的增减，以及可选的趋势线。
 * 本身没有底色与内边距：单独使用时放进 Panel，多个指标放进 Grid 组成指标行。
 *
 * **交互**：不可交互。数值为半粗、比例数字。
 * 增减总是同时有箭头与正负号，读屏读成一句话，如「上升 12.5%，与上月相比」。
 * 加载时数值位置显示骨架，200ms 后才出现，很快完成的加载不会闪；数据到来时尺寸不变。
 * @category Charts
 * @usage KPI rows at the top of dashboards, key numbers of a project or a period, figures next to a chart
 * @usageZh 仪表盘顶部的指标行、项目或某个时期的关键数字、图表旁的数字
 */
export function Statistic(props: StatisticProps) {
  const t = useT()
  const fmt = useFormatValue(props.format)
  const fmtDelta = useFormatValue(props.delta?.format ?? 'percent')
  const loading = props.loading ?? false
  const { delta, trend } = props

  let value: ReactNode
  if (loading)
    value = (
      <>
        <span className={styles.skeleton} data-skeleton="value" />
        <span className={hidden.hidden}>{t('spin.loading')}</span>
      </>
    )
  else if (props.value === null || !Number.isFinite(props.value)) value = fmt(null)
  else
    value = (
      <>
        {props.prefix}
        {fmt(props.value)}
        {props.suffix && <span className={styles.suffix}>{props.suffix}</span>}
      </>
    )

  let change = null
  if (delta && !loading) {
    const shown = fmtDelta(Math.abs(delta.value))
    const direction = deltaDirection(delta.value, shown, fmtDelta(0))
    const tone = deltaTone(direction, delta.goodWhen ?? 'up')
    const spoken =
      direction === 'up'
        ? t('statistic.up', { value: shown })
        : direction === 'down'
          ? t('statistic.down', { value: shown })
          : t('statistic.flat')
    change = (
      <div className={styles.delta} data-direction={direction} data-tone={tone}>
        <span className={styles.change} aria-hidden="true">
          <Icon name={ARROW[direction]} size={14} />
          {signedText(direction, shown)}
        </span>
        <span className={styles.period} aria-hidden="true">
          {delta.period}
        </span>
        <span className={hidden.hidden}>
          {t('statistic.delta', { change: spoken, period: delta.period })}
        </span>
      </div>
    )
  }

  return (
    <div
      className={styles.root}
      data-size={props.size ?? 'md'}
      data-loading={loading || undefined}
      aria-busy={loading || undefined}
      data-testid={props.testId}
    >
      <div className={styles.label}>{props.label}</div>
      <div className={styles.value}>{value}</div>
      {delta &&
        (loading ? (
          <div className={styles.delta}>
            <span className={styles.skeleton} data-skeleton="delta" />
          </div>
        ) : (
          change
        ))}
      {trend &&
        (loading ? (
          <span className={styles.trendPlaceholder} />
        ) : (
          <div className={styles.trend}>
            <Sparkline
              data={trend}
              label={t('statistic.trend', { label: props.label })}
              format={props.format}
            />
          </div>
        ))}
    </div>
  )
}
