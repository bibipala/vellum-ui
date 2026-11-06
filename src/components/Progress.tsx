/**
 * 进度条：线形与环形。antd 只作为内部实现；不提供自定义颜色（`strokeColor`、`trailColor`、`railColor`），颜色来自令牌：
 * 进行中为强调色，完成为成功色，失败为危险色，轨道为中性填充。完成与失败的图标换成 Lucide 的勾与叉；
 * 不提供 antd 的 `status="active"`（装饰性的循环流光，docs/11 §5）。
 */
import { Progress as AntProgress, type ProgressProps as AntProgressProps } from 'antd'
import type { RefAttributes } from 'react'
import { Icon } from './Icon.tsx'
import type { StyleKeys } from './internal.ts'

/** 由令牌决定的颜色与不提供的属性。 */
type ProgressOmitKeys =
  | 'strokeColor'
  | 'trailColor'
  | 'railColor'
  | 'success'
  | 'status'
  | 'width'
  | 'gapPosition'

/**
 * Props of Progress.
 * @zh Progress 属性。
 */
export interface ProgressProps
  extends Omit<AntProgressProps, StyleKeys | ProgressOmitKeys>,
    RefAttributes<HTMLDivElement> {
  /**
   * Status: `normal` in the accent color, `success` in the success color with a check mark, `exception` in the
   * danger color with a cross. When omitted, it becomes `success` at 100%.
   * @zh 状态：`normal` 为强调色；`success` 为成功色并显示勾；`exception` 为危险色并显示叉。省略时到 100% 自动为 `success`。
   */
  readonly status?: 'normal' | 'success' | 'exception'
}

/**
 * Progress shows how far a task has come, as a line (`type="line"`, default) or a ring (`type="circle"`); the
 * number in the middle of the ring and after the line uses tabular numbers. For loading without a known progress
 * use Loading.
 *
 * **Interaction**: the bar animates to the new value using the motion tokens (no animation with "reduce motion");
 * screen readers read it as a progress bar with its value (give it an `aria-label`).
 * @zh 进度条：显示任务进行到哪里，线形（`type="line"`，默认）或环形（`type="circle"`）；环形中间与线形后面的数字为
 * 等宽数字。不知道进度的加载用 Loading。
 *
 * **交互**：进度变化时按动效令牌过渡（「减少动态效果」时不过渡）；读屏读作带取值的进度条（请提供 `aria-label`）。
 * @category Feedback
 * @usage Upload and import progress, storage usage, completion of a profile
 * @usageZh 上传与导入进度、存储空间用量、资料完成度
 */
export function Progress({ status, format, percent = 0, ...rest }: ProgressProps) {
  // 与 antd 相同：没有指定状态时，达到 100% 视为完成
  const resolved = status ?? (percent >= 100 ? 'success' : 'normal')
  const line = (rest.type ?? 'line') === 'line'
  const iconSize = line ? 14 : 24
  return (
    <AntProgress
      {...rest}
      percent={percent}
      status={resolved}
      format={
        format ??
        ((value) =>
          resolved === 'success' ? (
            <Icon name="check" size={iconSize} tone="success" />
          ) : resolved === 'exception' ? (
            <Icon name="close" size={iconSize} tone="danger" />
          ) : (
            `${value ?? 0}%`
          ))
      }
    />
  )
}
