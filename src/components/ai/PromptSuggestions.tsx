/**
 * 提示建议：一组可点击的建议（标签、可选的说明与图标），选择后回调，常用于对话开始前或回复之后。
 * 自己实现：Ant Design X 的 Prompts 把标签写成按钮里的 h6 标题、禁用项不能聚焦也没有原因说明，单纯的布局不需要它。
 */
import { useId } from 'react'
import { useT } from '../../i18n/index.ts'
import { Icon, type IconName } from '../Icon.tsx'
import type { BaseProps } from '../layout.tsx'
import { DisabledReasonTooltip } from '../overlays.tsx'
import styles from './prompt-suggestions.module.css'

/**
 * One suggestion.
 * @zh 一条建议。
 */
export interface PromptSuggestion {
  /**
   * Stable key.
   * @zh 稳定的键。
   */
  readonly key: string
  /**
   * The suggestion, such as the question it asks.
   * @zh 建议的内容，如要问的问题。
   */
  readonly label: string
  /**
   * Secondary text below the label.
   * @zh 标签下方的说明。
   */
  readonly description?: string
  /**
   * Icon before the text.
   * @zh 文字前的图标。
   */
  readonly icon?: IconName
  /**
   * Disables the suggestion.
   * @zh 禁用这条建议。
   */
  readonly disabled?: boolean
  /**
   * Disabled reason, shown on hover or keyboard focus while `disabled`; the suggestion stays focusable.
   * @zh 禁用原因：`disabled` 时悬停或键盘聚焦显示；这条建议仍可聚焦。
   */
  readonly disabledReason?: string
}

/**
 * Props of PromptSuggestions.
 * @zh PromptSuggestions 属性。
 */
export interface PromptSuggestionsProps extends Pick<BaseProps, 'testId'> {
  /**
   * The suggestions.
   * @zh 建议。
   */
  readonly items: readonly PromptSuggestion[]
  /**
   * Called when a suggestion is chosen with a click, `Enter` or `Space`.
   * @zh 用点击、`Enter` 或空格选择一条建议时调用。
   */
  readonly onSelect?: (item: PromptSuggestion) => void
  /**
   * `wrap` places the suggestions in rows that wrap; `vertical` stacks them in one column with the full width.
   * @zh `wrap` 横向排列、放不下时换行；`vertical` 纵向排成一列、占满宽度。
   * @default 'wrap'
   */
  readonly layout?: 'wrap' | 'vertical'
  /**
   * Accessible name of the list; "Suggestions" by default.
   * @zh 列表的读屏名称，默认「建议」。
   */
  readonly 'aria-label'?: string
}

function Suggestion(props: {
  readonly item: PromptSuggestion
  readonly onSelect?: (item: PromptSuggestion) => void
}) {
  const { item } = props
  const reasonId = useId()
  // 有禁用原因时保持可聚焦（aria-disabled），原因通过提示与 aria-describedby 给出
  const blocked = Boolean(item.disabled && item.disabledReason)
  const button = (
    <button
      type="button"
      className={styles.item}
      data-vl-state=""
      disabled={item.disabled && !blocked}
      aria-disabled={blocked || undefined}
      aria-describedby={blocked ? reasonId : undefined}
      onClick={() => {
        if (!item.disabled) props.onSelect?.(item)
      }}
    >
      {item.icon && (
        <span className={styles.icon}>
          <Icon name={item.icon} tone="secondary" />
        </span>
      )}
      <span className={styles.text}>
        <span className={styles.label}>{item.label}</span>
        {item.description && <span className={styles.description}>{item.description}</span>}
      </span>
    </button>
  )
  if (!blocked) return button
  return (
    <DisabledReasonTooltip id={reasonId} reason={item.disabledReason ?? ''}>
      {button}
    </DisabledReasonTooltip>
  )
}

/**
 * A set of suggested prompts, each with a label and an optional description and icon; choosing one calls
 * `onSelect`. Use it in the empty state of a conversation or below a reply.
 *
 * **Interaction**: every suggestion is a button with a neutral fill; hover and press add the shared state layer, `Tab`
 * moves between them and shows the focus ring, and `Enter` / `Space` choose. Disabled suggestions have a lower
 * opacity and do nothing; with `disabledReason` they stay focusable and show the reason on hover or focus.
 * @zh 提示建议：一组建议，每条有标签，可带说明与图标；选择后调用 `onSelect`。用于对话的空状态或回复下方。
 *
 * **交互**：每条建议都是中性填充的按钮；悬停与按下叠加统一状态层，`Tab` 在建议之间移动并显示焦点环，`Enter` / 空格选择。
 * 禁用的建议降低透明度、没有效果；提供 `disabledReason` 时仍可聚焦，悬停或聚焦显示原因。
 * @category AI
 * @usage Starter prompts of an empty chat, follow-up questions after a reply
 * @usageZh 空对话的开场建议、回复之后的追问建议
 */
export function PromptSuggestions(props: PromptSuggestionsProps) {
  const t = useT()
  return (
    <ul
      className={styles.list}
      data-layout={props.layout ?? 'wrap'}
      aria-label={props['aria-label'] ?? t('promptSuggestions.label')}
      data-testid={props.testId}
    >
      {props.items.map((item) => (
        <li key={item.key} className={styles.cell}>
          <Suggestion item={item} onSelect={props.onSelect} />
        </li>
      ))}
    </ul>
  )
}
