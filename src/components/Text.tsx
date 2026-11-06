/**
 * 文字原语：字号、字重、色调只取令牌档位，替代手写的 `.muted`、`.mono` 之类的样式类。
 */
import type { ReactNode } from 'react'
import type { BaseProps } from './layout.tsx'
import styles from './text.module.css'

/**
 * Props of Text.
 * @zh Text 属性。
 */
export interface TextProps extends BaseProps {
  /**
   * Font size step: `2xs` 11, `xs` 12, `sm` 13, `md` 14, `lg` 16, `xl` 20 px.
   * @zh 字号档位：2xs 11、xs 12、sm 13、md 14、lg 16、xl 20px。
   * @default 'md'
   */
  readonly size?: '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  /**
   * Font weight step: `regular` for body text, `medium` for emphasis, `semibold` for labels and small headings,
   * `bold` for figures and key points.
   * @zh 字重档位：regular 正文、medium 强调、semibold 标签与小标题、bold 数字与重点。
   * @default 'regular'
   */
  readonly weight?: 'regular' | 'medium' | 'semibold' | 'bold'
  /**
   * Tone: `primary` for main text, `secondary` for supporting text, `tertiary` for faint hints; the others are
   * semantic colors.
   * @zh 色调：primary 主要文字、secondary 次要说明、tertiary 弱提示，其余为语义色。
   * @default 'primary'
   */
  readonly tone?: 'primary' | 'secondary' | 'tertiary' | 'accent' | 'danger' | 'warning' | 'success'
  /**
   * Monospace font: IDs, code, API names, paths.
   * @zh 等宽字体：编号、代码、接口名、路径。
   */
  readonly mono?: boolean
  /**
   * Tabular numbers (without changing the font), so that amounts, quantities and times line up vertically.
   * @zh 等宽数字（不换字体），用于金额、数量、时间的纵向对齐。
   */
  readonly numeric?: boolean
  /**
   * Truncates overflowing text: `true` for a single line, a number for the maximum number of lines.
   * @zh 超出时省略：`true` 为单行，数字为最多显示的行数。
   */
  readonly truncate?: boolean | 2 | 3
  /**
   * Overline style for group headings (small, secondary color, wider letter spacing).
   * @zh 分组小标题样式（小号、次要色、加字距）。
   */
  readonly overline?: boolean
  /**
   * HTML element to render: `p` for paragraphs, `label` for form labels.
   * @zh 输出的 HTML 元素：段落用 p，表单标签用 label。
   * @default 'span'
   */
  readonly as?: 'span' | 'p' | 'div' | 'label' | 'time' | 'strong' | 'code'
  /**
   * ID of the associated form control when `as="label"`.
   * @zh `as="label"` 时关联的表单控件 ID。
   */
  readonly htmlFor?: string
  /**
   * Machine-readable time when `as="time"`.
   * @zh `as="time"` 时的机器可读时间。
   */
  readonly dateTime?: string
  /**
   * Full text shown on mouse hover (often used together with `truncate`).
   * @zh 鼠标悬停时显示的完整文本（常与 truncate 一起用）。
   */
  readonly title?: string
  /**
   * Text content.
   * @zh 文字内容。
   */
  readonly children?: ReactNode
}

/**
 * Text with consistent font size, weight, tone, monospace and truncation. Use it for body text, descriptions,
 * IDs, times and group headings.
 * @zh 文字：统一字号、字重、色调、等宽与省略。正文、说明、编号、时间、分组小标题都用它。
 * @category Primitives
 * @usage Secondary text, IDs and paths (`mono`), amounts and times (`numeric`), truncation, group headings (`overline`)
 * @usageZh 次要说明文字、编号与路径（mono）、金额与时间（numeric）、单行省略、分组小标题（overline）
 */
export function Text(props: TextProps) {
  const El = props.as ?? 'span'
  const lines = props.truncate === true ? 1 : props.truncate || undefined
  return (
    <El
      data-testid={props.testId}
      aria-label={props['aria-label']}
      role={props.role}
      id={props.id}
      htmlFor={El === 'label' ? props.htmlFor : undefined}
      dateTime={El === 'time' ? props.dateTime : undefined}
      title={props.title}
      className={styles.text}
      data-size={props.overline ? '2xs' : (props.size ?? 'md')}
      data-weight={props.overline ? 'semibold' : (props.weight ?? 'regular')}
      data-tone={props.overline ? 'tertiary' : (props.tone ?? 'primary')}
      data-mono={props.mono || undefined}
      data-numeric={props.numeric || undefined}
      data-overline={props.overline || undefined}
      data-truncate={lines}
    >
      {props.children}
    </El>
  )
}
