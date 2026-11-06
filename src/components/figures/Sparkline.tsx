/**
 * 迷你图：指标卡与表格单元格里的小趋势线。自己用 SVG 画，不依赖图表库（ADR 0020 §2）。
 *
 * 规格来自 dataviz 方法（docs/11 §4）：线宽 2px、圆角连接；默认历史部分用弱化色、最后一个点用强调色圆点
 * （指标卡趋势的规定）；面积填充约 10% 不透明度。没有坐标轴、没有悬停，读屏读出自动生成的摘要。
 * 几何是纯函数（sparkline-geometry.ts），渲染时不访问 DOM，服务端可以渲染。
 */
import type { CSSProperties } from 'react'
import { useT } from '../../i18n/index.ts'
import {
  type ChartColorSlot,
  seriesColorToken,
  useFormatValue,
  type ValueFormat,
} from '../charts/format.ts'
import type { BaseProps } from '../layout.tsx'
import styles from './sparkline.module.css'
import { SPARK_VIEW, sparklineGeometry } from './sparkline-geometry.ts'

/**
 * Props of Sparkline.
 * @zh Sparkline 属性。
 */
export interface SparklineProps extends Pick<BaseProps, 'testId'> {
  /**
   * The values, oldest first. `null` (and `NaN`) leaves a gap: the line breaks there. An empty list, or a list
   * of `null` only, draws nothing.
   * @zh 数值，从早到晚。`null`（以及 `NaN`）留空，线在那里断开。空数组或全是 `null` 时不画线。
   */
  readonly data: readonly (number | null)[]
  /**
   * What the line shows, such as "Visits in the last 12 weeks". Required: screen readers read it followed by a
   * summary (first and last value, low and high).
   * @zh 这条线表示什么，如「最近 12 周访问量」。必填：读屏先读它，再读自动生成的摘要（起止值、最低、最高）。
   */
  readonly label: string
  /**
   * Fills the area under the line with a wash of the line color (about 10% opacity).
   * @zh 在线下方填充线的颜色（约 10% 不透明度）。
   */
  readonly area?: boolean
  /**
   * Height: `sm` (20 px) in table cells, `md` (32 px) in stat tiles. The width always fills the container.
   * @zh 高度：`sm`（20px）用于表格单元格，`md`（32px）用于指标卡。宽度总是撑满容器。
   * @default 'md'
   */
  readonly size?: 'sm' | 'md'
  /**
   * `last`: the history is drawn in the de-emphasis color and the last value is a dot in the accent color, so
   * the current value stands out (the rule for stat tile trends). `none`: one plain line in the first chart
   * color, without a dot.
   * @zh `last`：历史部分用弱化色，最后一个值是强调色圆点，突出当前值（指标卡趋势的规定）。
   * `none`：整条线用第一个图表颜色，没有圆点。
   * @default 'last'
   */
  readonly highlight?: 'last' | 'none'
  /**
   * Draws the whole line in this chart color (1–8), for a sparkline that stands for a series shown elsewhere in
   * the same color. History and current value are then not told apart by color; with `highlight="last"` the
   * last value still gets a dot of the same color.
   * @zh 整条线用这个图表颜色（1–8），用于代表别处同色系列的迷你图。此时历史与当前不再用颜色区分；
   * `highlight="last"` 时最后一个值仍有同色圆点。
   */
  readonly slot?: ChartColorSlot
  /**
   * How the values are written in the summary read by screen readers.
   * @zh 读屏摘要中数值的写法。
   * @default 'auto'
   */
  readonly format?: ValueFormat
}

/**
 * A sparkline: a small trend line without axes, for stat tiles and table cells. It is purely graphic: there is
 * no hover, and the exact values belong next to it or in a table.
 *
 * **Interaction**: not interactive. The line is 2 px with round joins; by default the history is in the
 * de-emphasis color and the last value is an accent dot. A gap in the data breaks the line; a lone value is drawn
 * as a dot. Screen readers read the label and a summary: first and last value, low and high.
 * @zh 迷你图：没有坐标轴的小趋势线，用于指标卡与表格单元格。纯图形：没有悬停，精确数值放在旁边或表格中。
 *
 * **交互**：不可交互。线宽 2px、圆角连接；默认历史部分用弱化色，最后一个值是强调色圆点。数据缺失处断开；
 * 孤立的一个值画成圆点。读屏读出名称与摘要：起止值、最低、最高。
 * @category Charts
 * @usage Trends in stat tiles, a trend column in tables, activity over the last weeks in list items
 * @usageZh 指标卡中的趋势、表格中的趋势列、列表行中最近几周的活跃度
 */
export function Sparkline(props: SparklineProps) {
  const t = useT()
  const fmt = useFormatValue(props.format)
  const highlight = props.highlight ?? 'last'
  const geometry = sparklineGeometry(props.data)
  const series = seriesColorToken(0, props.slot)
  // 指定了颜色时整条线同色；否则 last 模式的历史部分用弱化色，none 模式用第一个图表颜色
  const line = props.slot === undefined && highlight === 'last' ? 'color-chart-muted' : series
  const { summary, end } = geometry
  const label = props.label
  const name = !summary
    ? t('sparkline.empty', { label })
    : geometry.count === 1
      ? t('sparkline.single', { label, value: fmt(summary.end) })
      : t('sparkline.summary', {
          label,
          start: fmt(summary.start),
          end: fmt(summary.end),
          min: fmt(summary.min),
          max: fmt(summary.max),
        })
  // 只有一个值时没有线可画：总是显示圆点，否则什么也看不见
  const dot = end && (highlight === 'last' || geometry.count === 1) ? end : null
  return (
    <span
      role="img"
      aria-label={name}
      className={styles.root}
      data-size={props.size ?? 'md'}
      data-testid={props.testId}
      style={
        {
          '--sparkline-line': `var(--vl-${line})`,
          '--sparkline-dot': `var(--vl-${series})`,
        } as CSSProperties
      }
    >
      <span className={styles.plot}>
        <svg
          className={styles.svg}
          viewBox={`0 0 ${SPARK_VIEW} ${SPARK_VIEW}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          {props.area && geometry.area && <path className={styles.area} d={geometry.area} />}
          {geometry.line && <path className={styles.line} d={geometry.line} />}
        </svg>
        {geometry.isolated.map((p) =>
          // 末端的孤立值由末端圆点表示
          dot && p.x === dot.x && p.y === dot.y ? null : (
            <span
              key={`${p.x} ${p.y}`}
              className={styles.point}
              data-sparkline-point=""
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
            />
          ),
        )}
        {dot && (
          <span
            className={styles.dot}
            data-sparkline-dot=""
            style={{ left: `${dot.x}%`, top: `${dot.y}%` }}
          />
        )}
      </span>
    </span>
  )
}
