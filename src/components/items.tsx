/**
 * 列表与信息展示组件：列表行、计数徽标、状态圆点、设置行。
 * 统一列表行、计数徽标与设置行的写法。成员卡片等依赖具体业务数据的组件不在本库。
 */
import type { ReactNode } from 'react'
import { useT } from '../i18n/index.ts'
import styles from './items.module.css'
import type { BaseProps } from './layout.tsx'

const base = (p: BaseProps) => ({
  'data-testid': p.testId,
  'aria-label': p['aria-label'],
  id: p.id,
})

/**
 * Props of ListItem.
 * @zh ListItem 属性。
 */
export interface ListItemProps extends BaseProps {
  /**
   * Main text.
   * @zh 主文字。
   */
  readonly title: ReactNode
  /**
   * Description on the second line (truncated to one line).
   * @zh 第二行说明（单行省略）。
   */
  readonly description?: ReactNode
  /**
   * Left side: an avatar, icon or thumbnail.
   * @zh 左侧：头像、图标或缩略图。
   */
  readonly leading?: ReactNode
  /**
   * Faint information at the top right: time, count, status.
   * @zh 右上角的弱信息：时间、数量、状态。
   */
  readonly meta?: ReactNode
  /**
   * Actions on the right (IconButton and the like).
   * @zh 右侧操作（IconButton 等）。
   */
  readonly actions?: ReactNode
  /**
   * Shows the actions only on hover or keyboard focus, keeping the list calm.
   * @zh 操作只在悬停或键盘聚焦时显示，保持列表安静。
   */
  readonly actionsOnHover?: boolean
  /**
   * Selected state (the item currently open in a split view).
   * @zh 选中态（主从分栏中当前打开的一项）。
   */
  readonly selected?: boolean
  /**
   * Click on the whole row; when provided, the body is a button that can be focused with `Tab` and triggered with
   * `Enter` or `Space`.
   * @zh 点击整行；提供后主体是一个按钮，可用 Tab 聚焦、Enter 或空格触发。
   */
  readonly onClick?: () => void
  /**
   * Row density: `comfortable` suits conversations and members; `compact` suits files and tree-like entries.
   * @zh 行高密度：comfortable 适合会话、成员；compact 适合文件、树状条目。
   * @default 'comfortable'
   */
  readonly density?: 'comfortable' | 'compact'
}

/**
 * A list item with an avatar or icon on the left, a title and description in the middle, and time and actions on
 * the right; it fills on hover, highlights when selected and works with the keyboard.
 *
 * **Interaction**: with `onClick`, the whole row is clickable, and hover and press add the shared state layer
 * (press darkens immediately and recovers 120 ms after release); the body is a button, `Tab` focus shows the
 * focus ring around the whole row, and `Enter` / `Space` trigger it; `selected` uses a subtle accent background;
 * `actionsOnHover` actions appear on hover or when keyboard focus enters the row, and pressing an inline action
 * does not darken the whole row. Without `onClick`, it is a display-only row without hover effects.
 * @zh 列表行：左侧头像或图标，中间标题与说明，右侧时间与操作；悬停填充、选中高亮、键盘可操作。
 *
 * **交互**：提供 `onClick` 时整行可点击，悬停与按下叠加统一状态层（按下立即变深，松开 120ms 恢复）；
 * 主体是一个按钮，`Tab` 聚焦时整行显示焦点环，`Enter` / `Space` 触发；`selected` 为强调色浅底；
 * `actionsOnHover` 的操作在悬停或键盘焦点进入该行时出现，按下行内操作时整行不跟着变深。
 * 不提供 `onClick` 时只是展示行，没有悬停效果。
 * @category Basic
 * @usage Conversation lists, member lists, file list rows, search results, access records
 * @usageZh 会话列表、成员列表、文件列表行、搜索结果、授权记录
 */
export function ListItem(props: ListItemProps) {
  const body = (
    <>
      {props.leading && <span className={styles.leading}>{props.leading}</span>}
      <span className={styles.main}>
        <span className={styles.titleRow}>
          <span className={styles.title}>{props.title}</span>
          {props.meta && <span className={styles.meta}>{props.meta}</span>}
        </span>
        {props.description && <span className={styles.description}>{props.description}</span>}
      </span>
    </>
  )
  return (
    <div
      {...base(props)}
      role={props.role}
      className={styles.item}
      data-density={props.density ?? 'comfortable'}
      data-selected={props.selected || undefined}
      data-interactive={props.onClick ? true : undefined}
      data-vl-state={props.onClick ? '' : undefined}
      data-hover-actions={props.actionsOnHover || undefined}
    >
      {/* 可点击时主体是一个真正的按钮；操作按钮与它并列，避免按钮嵌套 */}
      {props.onClick ? (
        <button
          type="button"
          className={styles.hit}
          aria-pressed={props.selected}
          onClick={props.onClick}
        >
          {body}
        </button>
      ) : (
        <span className={styles.hit}>{body}</span>
      )}
      {props.actions && <span className={styles.actions}>{props.actions}</span>}
    </div>
  )
}

/**
 * Props of CountBadge.
 * @zh CountBadge 属性。
 */
export interface CountBadgeProps extends BaseProps {
  /**
   * The count; nothing is shown when it is 0.
   * @zh 数量；为 0 时不显示。
   */
  readonly count: number
  /**
   * Tone: `accent` for unread items and to-dos that need attention; `neutral` for plain counts (members, child
   * items).
   * @zh 色调：accent 用于需要处理的未读与待办；neutral 用于普通计数（成员数、子项数）。
   * @default 'neutral'
   */
  readonly tone?: 'neutral' | 'accent'
  /**
   * Counts above this value are shown as "max+".
   * @zh 超过该值显示为「上限+」。
   * @default 99
   */
  readonly max?: number
}

/**
 * A count badge: a pill with tabular numbers. Use the accent color for unread items and to-dos, and the neutral
 * color for plain counts.
 * @zh 计数徽标：等宽数字的胶囊。未读、待办用强调色，普通计数用中性色。
 * @category Basic
 * @usage Unread counts of conversations, to-do counts, team sizes, number of entries in a group
 * @usageZh 会话未读数、待办数、团队人数、分组条目数
 */
export function CountBadge(props: CountBadgeProps) {
  if (props.count <= 0) return null
  const max = props.max ?? 99
  return (
    <span {...base(props)} className={styles.badge} data-tone={props.tone ?? 'neutral'}>
      {props.count > max ? `${max}+` : props.count}
    </span>
  )
}

/**
 * Props of StatusDot.
 * @zh StatusDot 属性。
 */
export interface StatusDotProps extends BaseProps {
  /**
   * Tone: `success` for normal, `warning` for attention, `danger` for errors, `neutral` for inactive, `accent` for
   * reminders. The caller maps business meanings (online, running, disabled, and so on) to tones and describes
   * them with `aria-label`.
   * @zh 色调：success 正常、warning 注意、danger 异常、neutral 未激活、accent 提醒。
   * 业务含义（在线、运行中、已停用……）由调用方映射到色调，并通过 `aria-label` 说明。
   */
  readonly tone: 'success' | 'warning' | 'danger' | 'neutral' | 'accent'
}

/**
 * A status dot that shows a status with a semantic color. The accessible name comes from `aria-label`, or the
 * default name of the tone when omitted; combine it with Text when visible text is needed.
 * @zh 状态圆点：用语义色表示一个状态。读屏名称取 `aria-label`，不传时用色调的默认名称；
 * 需要可见文字时与 Text 组合。
 * @category Basic
 * @usage Online status, status of a service or connection, the status badge at the corner of an avatar
 * @usageZh 在线状态、服务或连接的运行状态、头像右下角的状态角标
 */
export function StatusDot(props: StatusDotProps) {
  const t = useT()
  return (
    <span
      {...base(props)}
      role="img"
      aria-label={props['aria-label'] ?? t(`statusDot.${props.tone}`)}
      className={styles.statusDot}
      data-tone={props.tone}
    />
  )
}

/**
 * Props of SettingRow.
 * @zh SettingRow 属性。
 */
export interface SettingRowProps extends BaseProps {
  /**
   * Name of the setting.
   * @zh 设置项名称。
   */
  readonly title: ReactNode
  /**
   * Description: what the setting affects and what the values mean.
   * @zh 说明：影响范围、取值含义。
   */
  readonly description?: ReactNode
  /**
   * Control on the right: Switch, Select, InputNumber, Button and the like.
   * @zh 右侧控件：Switch、Select、InputNumber、Button 等。
   */
  readonly control?: ReactNode
  /**
   * Additional content below the control (such as expanded sub-settings).
   * @zh 控件下方的附加内容（如展开的子设置）。
   */
  readonly children?: ReactNode
}

/**
 * A setting row with a name and description on the left and a control on the right. Put several rows in a Panel
 * or Section to build a settings page.
 *
 * **Interaction**: the row itself is not clickable and has no hover effect; states and keyboard interaction come
 * from the control on the right (`Tab` moves focus directly to the control).
 * @zh 设置行：左侧名称与说明，右侧控件。多行放在 Panel 或 Section 中，组成设置页。
 *
 * **交互**：设置行本身不可点击、没有悬停效果；状态与键盘操作由右侧控件提供（`Tab` 直接聚焦到控件）。
 * @category Basic
 * @usage Application settings, conversation settings, personal preferences, on/off options
 * @usageZh 应用设置、会话设置、个人偏好、开关类选项
 */
export function SettingRow(props: SettingRowProps) {
  return (
    <div {...base(props)} role={props.role} className={styles.setting}>
      <div className={styles.settingMain}>
        <div className={styles.settingText}>
          <div className={styles.title}>{props.title}</div>
          {props.description && <div className={styles.settingDesc}>{props.description}</div>}
        </div>
        {props.control && <div className={styles.settingControl}>{props.control}</div>}
      </div>
      {props.children}
    </div>
  )
}
