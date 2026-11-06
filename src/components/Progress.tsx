/**
 * 进度条：线形与环形。组件库自己实现（不封装 antd 的 Progress），公共属性不引用 antd 的类型（ADR 0021）。
 *
 * - 颜色来自量表令牌（dataviz 的 meter 规则，compile.ts 的 meterTokens）：填充按 `tone` 表示程度（强调色 → 警告 →
 *   危险），未填充的轨道是同一色阶上更靠近背景的一级，与填充相差 3:1，不是中性灰；不提供自定义颜色；
 * - `status` 是任务的结果（完成、失败），不是色调：数值换成勾或叉，读屏读出「60%，失败」；
 * - 不提供装饰性的循环流光（antd 的 `status="active"`，docs/11 §5）。
 */
import type { CSSProperties, Ref } from 'react'
import { useT } from '../i18n/index.ts'
import { Icon } from './Icon.tsx'
import styles from './progress.module.css'

/** 环形的线宽与半径（viewBox 100 × 100 中的单位，随直径缩放：线宽是直径的 8%）。 */
const RING_STROKE = 8
const RING_RADIUS = 50 - RING_STROKE / 2

/** 结果图标的像素尺寸：线形随文字，环形随直径。 */
const ICON_SIZE = {
  line: { sm: 14, md: 16, lg: 18 },
  circle: { sm: 20, md: 28, lg: 40 },
} as const

/**
 * Props of Progress.
 * @zh Progress 属性。
 */
export interface ProgressProps {
  /**
   * How far the task has come, in percent from 0 to 100; values outside are clamped.
   * @zh 进行到哪里，百分比 0–100；超出范围按两端处理。
   * @default 0
   */
  readonly percent?: number
  /**
   * Form: `line`, a bar with the value after it; `circle`, a ring with the value in the middle.
   * @zh 形态：`line` 线形，数值在后面；`circle` 环形，数值在中间。
   * @default 'line'
   */
  readonly variant?: 'line' | 'circle'
  /**
   * Size: for `line`, the thickness of the bar (4, 8 or 12 px; `sm` for list rows); for `circle`, the diameter
   * (48, 80 or 120 px).
   * @zh 尺寸：`line` 是线条的粗细（4、8、12px，列表行中用 `sm`）；`circle` 是直径（48、80、120px）。
   * @default 'md'
   */
  readonly size?: 'sm' | 'md' | 'lg'
  /**
   * Color of the fill, for how serious the level is: `accent` for normal progress, `warning` and `danger` for a
   * level that needs attention (such as storage that is almost full), `success` for a good level. The track is a
   * lighter step of the same color. Ignored when `status` is set.
   * @zh 填充的色调，表示程度：`accent` 为一般的进度，`warning`、`danger` 为需要注意的程度（如存储空间快满了），
   * `success` 为良好的程度。轨道是同一颜色更浅的一级。设置了 `status` 时不起作用。
   * @default 'accent'
   */
  readonly tone?: 'accent' | 'success' | 'warning' | 'danger'
  /**
   * Result of the task: `success` uses the success color and shows a check mark, `error` uses the danger color and
   * shows a cross, instead of the number; screen readers hear "60%, failed". When `status` and `tone` are both
   * omitted, it becomes `success` at 100%.
   * @zh 任务的结果：`success` 为成功色并显示勾，`error` 为危险色并显示叉，代替数字；读屏读作「60%，失败」。
   * `status` 与 `tone` 都省略时，到 100% 自动为 `success`。
   */
  readonly status?: 'success' | 'error'
  /**
   * Shows the value (or the result icon) after the bar or in the ring.
   * @zh 显示数值（或结果图标），在线条后面或环的中间。
   * @default true
   */
  readonly showValue?: boolean
  /**
   * Accessible name, such as "Upload of report.pdf"; screen readers read it with the value.
   * @zh 读屏名称，如「上传 report.pdf」；读屏连同数值一起读出。
   */
  readonly 'aria-label'?: string
  /**
   * ID of the element that names the progress bar, instead of `aria-label`.
   * @zh 为进度条提供读屏名称的元素的 ID，代替 `aria-label`。
   */
  readonly 'aria-labelledby'?: string
  /**
   * ID of the root element.
   * @zh 根元素的 ID。
   */
  readonly id?: string
  /**
   * For tests: rendered as `data-testid`.
   * @zh 测试定位用，输出为 `data-testid`。
   */
  readonly testId?: string
  /**
   * The root element (the element with the `progressbar` role).
   * @zh 根元素（`progressbar` 角色的元素）。
   */
  readonly ref?: Ref<HTMLDivElement>
}

const clampPercent = (v: number | undefined) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0

/**
 * Progress shows how far a task has come, as a line (default) or a ring (`variant="circle"`); the value uses
 * tabular numbers. The fill color follows `tone` and the track is a lighter step of the same color, so the level
 * reads across the whole bar; `status` shows the result of the task. For loading without a known progress use
 * Loading; for one whole split into parts, SegmentedBar.
 *
 * **Interaction**: the bar moves to the new value using the motion tokens (no animation with "reduce motion");
 * screen readers read it as a progress bar with its value, and the result with `status` (give it an
 * `aria-label`).
 * @zh 进度条：显示任务进行到哪里，线形（默认）或环形（`variant="circle"`），数值为等宽数字。填充的颜色按 `tone`，
 * 轨道是同一颜色更浅的一级，整条都读得出程度；`status` 表示任务的结果。不知道进度的加载用 Loading；一个整体分成几部分
 * 用 SegmentedBar。
 *
 * **交互**：数值变化时按动效令牌过渡（「减少动态效果」时不过渡）；读屏读作带取值的进度条，有 `status` 时一并读出结果
 * （请提供 `aria-label`）。
 * @category Feedback
 * @usage Upload and import progress, storage usage, completion of a profile
 * @usageZh 上传与导入进度、存储空间用量、资料完成度
 */
export function Progress(props: ProgressProps) {
  const t = useT()
  const percent = clampPercent(props.percent)
  const variant = props.variant ?? 'line'
  const size = props.size ?? 'md'
  // 与以前相同：没有指定结果与色调时，达到 100% 视为完成
  const status =
    props.status ?? (props.tone === undefined && percent >= 100 ? 'success' : undefined)
  const tone =
    status === 'success' ? 'success' : status === 'error' ? 'danger' : (props.tone ?? 'accent')
  const formatter = new Intl.NumberFormat(t('format.locale'), {
    style: 'percent',
    maximumFractionDigits: 0,
  })
  const format = (p: number) => formatter.format(p / 100)
  // 向下取整：99.6% 不显示为 100%
  const text = format(Math.floor(percent))
  const iconSize = ICON_SIZE[variant][size]
  const value =
    status === 'success' ? (
      <Icon name="check" size={iconSize} tone="success" />
    ) : status === 'error' ? (
      <Icon name="close" size={iconSize} tone="danger" />
    ) : (
      text
    )
  return (
    <div
      ref={props.ref}
      id={props.id}
      data-testid={props.testId}
      className={styles.root}
      data-variant={variant}
      data-size={size}
      data-tone={tone}
      data-status={status}
      role="progressbar"
      aria-label={props['aria-label']}
      aria-labelledby={props['aria-labelledby']}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={status ? t(`progress.${status}`, { value: text }) : text}
      // 填充的长度：CSS 中按它平移线条（自定义属性，不是外观样式）
      style={{ '--progress-value': percent } as CSSProperties}
    >
      {variant === 'line' ? (
        <div className={styles.track}>
          <div className={styles.bar} />
        </div>
      ) : (
        <svg className={styles.ring} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
          <circle
            className={styles.ringTrack}
            cx={50}
            cy={50}
            r={RING_RADIUS}
            strokeWidth={RING_STROKE}
          />
          <circle
            className={styles.ringBar}
            cx={50}
            cy={50}
            r={RING_RADIUS}
            strokeWidth={RING_STROKE}
            pathLength={100}
            strokeDasharray={100}
            strokeDashoffset={100 - percent}
            data-empty={percent <= 0 || undefined}
          />
        </svg>
      )}
      {(props.showValue ?? true) &&
        (variant === 'line' ? (
          // 数值的位置按「100%」的宽度留出（不可见的占位与数值叠在同一格中）：数值变化时线条长度不变，与字体、语言无关
          <span className={styles.value}>
            <span className={styles.sizer} aria-hidden="true">
              {format(100)}
            </span>
            <span>{value}</span>
          </span>
        ) : (
          <span className={styles.value}>{value}</span>
        ))}
    </div>
  )
}
