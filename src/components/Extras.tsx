/**
 * 业务界面常用的小组件：图标按钮、状态胶囊、头像。聊天、文件、成员、看板等界面共用，
 * 保证工具栏、状态、头像在整个应用中观感一致。
 */
import {
  type ButtonHTMLAttributes,
  type CSSProperties,
  forwardRef,
  type MouseEvent,
  type ReactNode,
  useId,
} from 'react'
import { useT } from '../i18n/index.ts'
import { AVATAR_TONE_COUNT } from '../tokens/semantic.ts'
import styles from './extras.module.css'
import { Icon, type IconName } from './Icon.tsx'
import { withInjected } from './internal.ts'
import { StatusDot, type StatusDotProps } from './items.tsx'
import { DisabledReasonTooltip, Tooltip } from './overlays.tsx'

/**
 * Props of IconButton.
 * @zh IconButton 属性。
 */
export interface IconButtonProps
  extends Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    'children' | 'type' | 'className' | 'style'
  > {
  /**
   * Icon name.
   * @zh 图标名称。
   */
  readonly icon: IconName
  /**
   * Text label, used as the tooltip and the accessible name (required: an icon button must be understandable).
   * @zh 文字说明：作为提示与读屏名称（必填，图标按钮必须可理解）。
   */
  readonly label: string
  /**
   * `accent`: solid accent color (such as Send); `ghost`: transparent background (default); `soft`: neutral
   * fill.
   * @zh `accent`：强调色实心（如发送）；`ghost`：透明底（默认）；`soft`：中性填充底。
   */
  readonly variant?: 'ghost' | 'soft' | 'accent'
  /**
   * Size: `sm` inside list items, `md` in toolbars, `lg` for the primary action next to an input (such as Send).
   * @zh 尺寸：sm 用于列表行内，md 用于工具栏，lg 用于输入框旁的主操作（如发送）。
   */
  readonly size?: 'sm' | 'md' | 'lg'
  /**
   * Whether to show the tooltip on hover; shown by default.
   * @zh 是否显示悬停提示，默认显示。
   */
  readonly tooltip?: boolean
  /**
   * Pressed state (for toggle buttons).
   * @zh 按下态（切换按钮）。
   */
  readonly active?: boolean
  /**
   * Disabled reason: while `disabled`, hover or keyboard focus shows "label: reason", such as "You don't have
   * permission to download". With a reason, the button can still be focused with `Tab` (`aria-disabled`), screen
   * readers read the reason through `aria-describedby`, and clicks and `Enter` have no effect; the reason is
   * shown even with `tooltip={false}`.
   * @zh 禁用原因：`disabled` 时悬停或键盘聚焦显示「说明：原因」，如「没有下载权限」。
   * 提供后按钮仍可用 Tab 聚焦（`aria-disabled`），读屏通过 `aria-describedby` 读出原因，点击与回车不生效；
   * 即使 `tooltip={false}` 也会显示原因。
   */
  readonly disabledReason?: string
}

const preventClick = (e: MouseEvent) => e.preventDefault()
const joinIds = (...ids: (string | undefined)[]) => ids.filter(Boolean).join(' ') || undefined

/**
 * A square icon button with a transparent background, a tooltip and an accessible name.
 *
 * **Interaction**: hover and press add the shared state layer (press darkens immediately and recovers 120 ms
 * after release, without scaling); `Tab` focus shows the focus ring, and `Enter` / `Space` trigger the button;
 * `active` is the pressed state of a toggle button (subtle accent background); when disabled, the opacity is
 * lowered and there is no state layer, and with `disabledReason` the reason is shown on hover or focus.
 * @zh 图标按钮：方形、透明底，带提示与读屏名称。
 *
 * **交互**：悬停与按下叠加统一状态层（按下立即变深，松开 120ms 恢复，不缩放）；`Tab` 聚焦显示焦点环，
 * `Enter` / `Space` 触发；`active` 为切换按钮的按下态（强调色浅底）；禁用时降低透明度、没有状态层，
 * 提供 `disabledReason` 时悬停或聚焦显示原因。
 * @category Basic
 * @usage Secondary actions in toolbars and list items (refresh, more, download, close); accent style for Send
 * @usageZh 工具栏与列表行里的次要操作（刷新、更多、下载、关闭）；强调样式用于发送等主操作
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    icon,
    label,
    variant = 'ghost',
    size = 'md',
    tooltip = true,
    active,
    disabled,
    disabledReason,
    onClick,
    ...rest
  },
  ref,
) {
  const t = useT()
  const reasonId = useId()
  // 原生 disabled 的按钮不能聚焦、也收不到鼠标事件，提示无从显示；有原因时改用 aria-disabled 并拦截点击
  const blocked = Boolean(disabled && disabledReason)
  const button = (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-pressed={active}
      {...rest}
      disabled={blocked ? undefined : disabled}
      aria-disabled={blocked || undefined}
      aria-describedby={
        blocked ? joinIds(rest['aria-describedby'], reasonId) : rest['aria-describedby']
      }
      onClick={blocked ? preventClick : onClick}
      className={withInjected(styles.iconButton, rest)}
      data-variant={variant}
      data-size={size}
      data-vl-state=""
    >
      <Icon name={icon} size={size === 'lg' ? 18 : size === 'sm' ? 14 : 16} />
    </button>
  )
  if (blocked)
    return (
      <DisabledReasonTooltip
        id={reasonId}
        reason={disabledReason ?? ''}
        tip={t('iconButton.disabledTooltip', { label, reason: disabledReason ?? '' })}
      >
        {button}
      </DisabledReasonTooltip>
    )
  return tooltip ? <Tooltip title={label}>{button}</Tooltip> : button
})

/**
 * Props of LinkButton.
 * @zh LinkButton 属性。
 */
export interface LinkButtonProps
  extends Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    'children' | 'type' | 'className' | 'style' | 'color'
  > {
  /**
   * Button text.
   * @zh 按钮文字。
   */
  readonly children: ReactNode
  /**
   * Tone: `accent` (default); `danger` for destructive inline actions such as removing an item or revoking
   * access.
   * @zh 色调：`accent` 强调色（默认）；`danger` 用于移除、撤销授权等危险的行内操作。
   * @default 'accent'
   */
  readonly tone?: 'accent' | 'danger'
  /**
   * Icon before the text.
   * @zh 文字前的图标。
   */
  readonly icon?: IconName
  /**
   * Disabled reason: an explanation shown on hover or keyboard focus while `disabled` (as on Button). With a
   * reason, the button can still be focused with `Tab` (`aria-disabled`), screen readers read the reason through
   * `aria-describedby`, and clicks and `Enter` have no effect.
   * @zh 禁用原因：`disabled` 时悬停或键盘聚焦显示的说明（与 Button 相同）。提供后按钮仍可用 Tab 聚焦
   * （`aria-disabled`），读屏通过 `aria-describedby` 读出原因，点击与回车不生效。
   */
  readonly disabledReason?: string
}

/**
 * A text link button: accent-colored text without background or underline, with the font size of its context.
 * Use it for actions in table rows (edit, archive), clickable names in lists and "View" on cards.
 *
 * Compared with Button: `type="text"` on Button is a neutral text button (a background appears on hover) that
 * suits toolbars; LinkButton is accent-colored text for actions that appear next to body text or table content.
 * Button does not offer antd's `type="link"`; all accent-colored text actions use LinkButton.
 *
 * **Interaction**: the text darkens on hover and darkens further immediately on press (recovering 120 ms after
 * release), without scaling or a background; the click area extends 4 px beyond the text on every side; `Tab`
 * focus shows the focus ring, and `Enter` / `Space` trigger the button; when disabled, the opacity is lowered,
 * and with `disabledReason` the reason is shown on hover or focus.
 * @zh 文字链接按钮：强调色文字、无底色、无下划线，字号跟随所在位置。用于表格行内操作（编辑、归档）、
 * 列表中可点击的名称、卡片上的「查看」。
 *
 * 与 Button 的区别：Button 的 `type="text"` 是中性色的文字按钮（悬停出现底色），适合工具栏；
 * LinkButton 是强调色文字，适合与正文、表格内容并排出现的操作。Button 不再提供 antd 的 `type="link"`，
 * 强调色的文字操作统一用 LinkButton。
 *
 * **交互**：悬停文字加深、按下立即再加深（松开 120ms 恢复），不缩放、不出现底色；点击区域比文字四周各大 4px；
 * `Tab` 聚焦显示焦点环，`Enter` / `Space` 触发；禁用时降低透明度，提供 `disabledReason` 时悬停或聚焦显示原因。
 * @category Basic
 * @usage Edit, archive and remove in table rows; clickable names in lists; "View" and "Pin" on cards
 * @usageZh 表格行内的编辑、归档、移除；列表中可点击的名称；卡片上的「查看」「置顶」
 */
export const LinkButton = forwardRef<HTMLButtonElement, LinkButtonProps>(function LinkButton(
  { children, tone = 'accent', icon, disabled, disabledReason, onClick, ...rest },
  ref,
) {
  const reasonId = useId()
  const blocked = Boolean(disabled && disabledReason)
  const button = (
    <button
      ref={ref}
      type="button"
      {...rest}
      disabled={blocked ? undefined : disabled}
      aria-disabled={blocked || undefined}
      aria-describedby={
        blocked ? joinIds(rest['aria-describedby'], reasonId) : rest['aria-describedby']
      }
      onClick={blocked ? preventClick : onClick}
      className={withInjected(styles.linkButton, rest)}
      data-tone={tone}
    >
      {icon && <Icon name={icon} size={14} />}
      {children}
    </button>
  )
  if (!blocked) return button
  return (
    <DisabledReasonTooltip id={reasonId} reason={disabledReason ?? ''}>
      {button}
    </DisabledReasonTooltip>
  )
})

/** 状态胶囊的色调。 */
export type PillTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'

/**
 * Props of Pill.
 * @zh Pill 属性。
 */
export interface PillProps {
  /**
   * Tone: `neutral`, `accent`, or the semantic states `success` / `warning` / `danger` / `info`.
   * @zh 色调：neutral 中性、accent 强调、success / warning / danger / info 语义状态。
   * @default 'neutral'
   */
  readonly tone?: PillTone
  /**
   * Leading dot (indicates a status).
   * @zh 前置圆点（表示状态）。
   */
  readonly dot?: boolean
  /**
   * Leading icon.
   * @zh 前置图标。
   */
  readonly icon?: IconName
  /**
   * Text of the pill.
   * @zh 胶囊文字。
   */
  readonly children?: ReactNode
  /**
   * Tooltip shown on hover.
   * @zh 悬停提示。
   */
  readonly title?: string
  /**
   * Locator for tests.
   * @zh 测试定位。
   */
  readonly 'data-testid'?: string
}

/**
 * A status pill: a subtle background with text in the same hue, optionally with a status dot. Use it for all
 * statuses and markers in the application instead of mixing in Tag.
 * @zh 状态胶囊：低饱和底色 + 同色文字，可带状态圆点。应用中的状态与标记统一用它，不必混用 Tag。
 * @category Basic
 * @usage Statuses such as In progress / Archived, markers such as "Owner" or "Connected", tags
 * @usageZh 进行中 / 已归档等状态、「负责人」「已连接」等标记、标签
 */
export function Pill({ tone = 'neutral', dot, icon, children, ...rest }: PillProps) {
  return (
    <span {...rest} className={withInjected(styles.pill, rest)} data-tone={tone}>
      {dot && <span className={styles.dot} aria-hidden="true" />}
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  )
}

/**
 * Props of Avatar.
 * @zh Avatar 属性。
 */
export interface AvatarProps {
  /**
   * Person's or item's name: the first character is shown, and the whole name determines the tone in a stable
   * way (the same name has the same color everywhere).
   * @zh 姓名或名称：取第一个字符显示，并按整个名称稳定地决定色调（同一名称在各处颜色相同）。
   */
  readonly name: string
  /**
   * Size in pixels: commonly 20 (tables, tags), 28 (sidebars) or 32 (lists).
   * @zh 像素尺寸：常用 20（表格、标签）、28（侧栏）、32（列表）。
   * @default 32
   */
  readonly size?: number
  /**
   * Accent ring, for avatars that need to stand out, such as teams or the current user.
   * @zh 强调色外环：团队、当前用户等需要突出的头像。
   */
  readonly ring?: boolean
  /**
   * Shows an icon instead of text (such as system notifications), on a neutral fill without a tone.
   * @zh 以图标代替文字（如系统通知），底色为中性填充，不取色调。
   */
  readonly icon?: IconName
  /**
   * Status badge at the bottom right (a StatusDot tone), such as online status; not shown when omitted.
   * @zh 右下角的状态角标（StatusDot 的色调），如在线状态；不传则不显示。
   */
  readonly status?: StatusDotProps['tone']
  /**
   * Accessible name of the status badge, such as "Online"; the default name of the tone is used when omitted.
   * @zh 状态角标的读屏名称，如「在线」；不传时用色调的默认名称。
   */
  readonly statusLabel?: string
}

/** 名称 → 色调编号（1–5）。简单的乘法哈希：同一名称在任何页面、任何会话中都得到同一色调。 */
function avatarTone(name: string): number {
  let h = 0
  for (const ch of name.trim()) h = (h * 31 + (ch.codePointAt(0) ?? 0)) >>> 0
  return (h % AVATAR_TONE_COUNT) + 1
}

/**
 * A letter avatar showing the first character of a name. The name picks one of five tones (blue, green, orange,
 * purple, cyan) in a stable way (light background with dark text, dark background with light text in dark mode),
 * without a border; with an icon instead of text, the background is a neutral fill. It can have an accent ring
 * and a status badge at the bottom right. The avatar itself is hidden from screen readers (the name is usually
 * shown next to it); only the status badge is announced.
 * @zh 头像：取名称首字的字母头像。按名称稳定地取蓝、绿、橙、紫、青五种色调之一（浅底深字，深色模式为暗底浅字），
 * 不描边；以图标代替文字时用中性填充底。可加强调色外环，可在右下角显示状态角标。
 * 头像本身对读屏隐藏（名称一般已显示在旁边），只有状态角标会被读出。
 * @category Basic
 * @usage Avatars of conversations, teams and projects; `leading` of list items; account menus; online status
 * @usageZh 会话、团队、项目的头像；列表行的 leading；账户菜单；带在线状态的成员头像
 */
export function Avatar({ name, size = 32, ring, icon, status, statusLabel }: AvatarProps) {
  const initial = Array.from(name.trim())[0]?.toUpperCase() ?? '?'
  return (
    <span
      className={styles.avatar}
      data-ring={ring ? 'true' : undefined}
      data-tone={icon ? undefined : avatarTone(name)}
      style={{ '--avatar-size': `${size}px` } as CSSProperties}
    >
      <span className={styles.avatarInner} aria-hidden="true">
        {icon ? <Icon name={icon} size={Math.round(size * 0.48)} /> : initial}
      </span>
      {status && (
        <span className={styles.avatarStatus}>
          <StatusDot tone={status} aria-label={statusLabel} />
        </span>
      )}
    </span>
  )
}
