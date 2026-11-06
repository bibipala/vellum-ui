/**
 * 消息操作：复制、重试、赞、踩，以及使用方自己的图标按钮。整组是一个工具栏（role="toolbar"），只占一个 Tab 位置，
 * 方向键在按钮之间移动（WAI-ARIA 工具栏模式的漫游焦点）。复制复用 CopyButton（只写剪贴板、不读）。
 */
import {
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { useT } from '../../i18n/index.ts'
import { CopyButton } from '../CopyButton.tsx'
import { IconButton } from '../Extras.tsx'
import type { BaseProps } from '../layout.tsx'
import styles from './message-actions.module.css'

/**
 * Feedback on a message: `like`, `dislike`, or `null` for none.
 * @zh 对消息的反馈：`like` 赞、`dislike` 踩，`null` 表示没有。
 */
export type MessageFeedback = 'like' | 'dislike' | null

/**
 * Props of MessageActions.
 * @zh MessageActions 属性。
 */
export interface MessageActionsProps extends Pick<BaseProps, 'testId'> {
  /**
   * The text copied by the "Copy" button, usually the plain text or Markdown source of the message. The button is
   * shown only when it is set.
   * @zh 「复制」按钮复制的文字，通常是消息的纯文本或 Markdown 原文。设置后才显示该按钮。
   */
  readonly copyText?: string
  /**
   * Called after the text has been written to the clipboard.
   * @zh 文字写入剪贴板之后调用。
   */
  readonly onCopy?: (text: string) => void
  /**
   * Called when copying fails (see CopyButton); without it the error is reported with `reportError`.
   * @zh 复制失败时调用（见 CopyButton）；不提供时错误通过 `reportError` 上报。
   */
  readonly onCopyError?: (error: unknown) => void
  /**
   * Shows a "Retry" button that calls this function, for example to generate the reply again.
   * @zh 显示「重试」按钮并在按下时调用，如重新生成这条回复。
   */
  readonly onRetry?: () => void
  /**
   * The current feedback (controlled). Without it the buttons keep their own state, starting with none.
   * @zh 当前的反馈（受控）。不传时按钮自己保存状态，初始为没有反馈。
   */
  readonly feedback?: MessageFeedback
  /**
   * Shows the "Like" and "Dislike" toggle buttons; called with the new feedback. Pressing the pressed button again
   * clears it (`null`); the two buttons exclude each other.
   * @zh 显示「赞」「踩」两个切换按钮，以新的反馈调用。再次按下已按下的按钮会取消（`null`）；两个按钮互斥。
   */
  readonly onFeedbackChange?: (feedback: MessageFeedback) => void
  /**
   * Accessible name of the toolbar; "Message actions" by default.
   * @zh 工具栏的读屏名称，默认「消息操作」。
   */
  readonly label?: string
  /**
   * Your own actions after the built-in ones, usually IconButton with `size="sm"`. They take part in the arrow key
   * navigation.
   * @zh 内置操作之后使用方自己的操作，通常是 `size="sm"` 的 IconButton。它们同样可以用方向键切换。
   */
  readonly children?: ReactNode
}

/** 工具栏中可以获得焦点的按钮（原生禁用的跳过；带禁用原因的仍可聚焦，读屏能读出原因）。 */
const FOCUSABLE = 'button:not(:disabled), a[href], [role="button"]:not([aria-disabled="true"])'

/**
 * Actions under a message: copy, retry, like and dislike, plus your own icon buttons. Each button has a tooltip and
 * an accessible name; like and dislike are toggle buttons (`aria-pressed`) that exclude each other.
 *
 * **Interaction**: the group is a toolbar with a single `Tab` stop: `←` / `→` move between the buttons, `Home` /
 * `End` go to the first and the last, and `Tab` leaves the toolbar; coming back, focus returns to the button used
 * last. Copying shows a check mark and announces "Copied" (CopyButton). Inside Message, the toolbar appears on hover
 * or when keyboard focus enters the message.
 * @zh 消息下方的操作：复制、重试、赞、踩，以及使用方自己的图标按钮。每个按钮都有提示与读屏名称；赞、踩是互斥的
 * 切换按钮（`aria-pressed`）。
 *
 * **交互**：整组是工具栏，只占一个 `Tab` 位置：`←` / `→` 在按钮之间移动，`Home` / `End` 到第一个与最后一个，`Tab`
 * 离开工具栏；再回来时焦点落在上次使用的按钮上。复制成功显示勾并播报「已复制」（CopyButton）。放在 Message 中时，
 * 悬停或键盘焦点进入消息才出现。
 * @category AI
 * @usage Copy, retry and rate an AI reply; actions of a chat message
 * @usageZh 复制、重试、评价 AI 回复；聊天消息的操作
 */
export function MessageActions(props: MessageActionsProps) {
  const t = useT()
  const root = useRef<HTMLDivElement>(null)
  // 漫游焦点：记住上次获得焦点的按钮，Tab 回到工具栏时落在它上面
  const active = useRef(0)
  const [innerFeedback, setInnerFeedback] = useState<MessageFeedback>(null)
  const feedback = props.feedback === undefined ? innerFeedback : props.feedback
  const showFeedback = Boolean(props.onFeedbackChange) || props.feedback !== undefined

  const items = () => [...(root.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])]

  // 每次渲染后整理 tabIndex：只有当前按钮可以用 Tab 到达。按钮由子组件渲染（CopyButton、使用方的 IconButton），
  // React 不管理它们的 tabIndex，这里直接设置在元素上
  useLayoutEffect(() => {
    const list = items()
    if (list.length === 0) return
    const focusedIndex = list.indexOf(document.activeElement as HTMLElement)
    active.current = focusedIndex >= 0 ? focusedIndex : Math.min(active.current, list.length - 1)
    list.forEach((el, i) => {
      el.tabIndex = i === active.current ? 0 : -1
    })
  })

  const focusAt = (list: HTMLElement[], index: number) => {
    const target = list[index]
    if (!target) return
    active.current = index
    list.forEach((el, i) => {
      el.tabIndex = i === index ? 0 : -1
    })
    target.focus()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // 弹层（如使用方按钮打开的菜单）渲染在别处，但事件沿 React 树冒泡到这里：只处理工具栏内的按键
    if (!root.current?.contains(e.target as Node) || e.altKey || e.ctrlKey || e.metaKey) return
    const list = items()
    const current = list.indexOf(e.target as HTMLElement)
    if (current < 0) return
    const rtl = getComputedStyle(root.current).direction === 'rtl'
    const next = rtl ? 'ArrowLeft' : 'ArrowRight'
    const prev = rtl ? 'ArrowRight' : 'ArrowLeft'
    let index: number
    if (e.key === next) index = (current + 1) % list.length
    else if (e.key === prev) index = (current - 1 + list.length) % list.length
    else if (e.key === 'Home') index = 0
    else if (e.key === 'End') index = list.length - 1
    else return
    e.preventDefault()
    focusAt(list, index)
  }

  const onFocus = (e: FocusEvent<HTMLDivElement>) => {
    const list = items()
    const index = list.indexOf(e.target as HTMLElement)
    if (index >= 0 && index !== active.current) focusAt(list, index)
  }

  const toggle = (value: Exclude<MessageFeedback, null>) => {
    const next = feedback === value ? null : value
    if (props.feedback === undefined) setInnerFeedback(next)
    props.onFeedbackChange?.(next)
  }

  return (
    <div
      ref={root}
      role="toolbar"
      aria-label={props.label ?? t('messageActions.label')}
      aria-orientation="horizontal"
      className={styles.toolbar}
      data-testid={props.testId}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
    >
      {props.copyText !== undefined && (
        <CopyButton
          text={props.copyText}
          size="sm"
          onCopy={props.onCopy}
          onError={props.onCopyError}
        />
      )}
      {props.onRetry && (
        <IconButton
          icon="refresh"
          size="sm"
          label={t('messageActions.retry')}
          onClick={props.onRetry}
        />
      )}
      {showFeedback && (
        <>
          <IconButton
            icon="thumbs-up"
            size="sm"
            label={t('messageActions.like')}
            active={feedback === 'like'}
            onClick={() => toggle('like')}
          />
          <IconButton
            icon="thumbs-down"
            size="sm"
            label={t('messageActions.dislike')}
            active={feedback === 'dislike'}
            onClick={() => toggle('dislike')}
          />
        </>
      )}
      {props.children}
    </div>
  )
}
