/**
 * 一条对话消息：用户消息靠右、在气泡中；助手消息靠左、不加气泡、占满宽度，可以有头像与名字。
 * 状态：生成中（还没有内容时显示加载指示）、失败（说明与重试）、已停止（标注）。操作区在消息下方，
 * 悬停或键盘焦点进入消息时出现。只负责布局与状态，内容（纯文本、Markdown）由使用方传入。
 */
import type { ReactNode } from 'react'
import { useT } from '../../i18n/index.ts'
import { LinkButton } from '../Extras.tsx'
import { Icon } from '../Icon.tsx'
import type { BaseProps } from '../layout.tsx'
import styles from './chat-message.module.css'

/**
 * Who wrote a message: the person using the application (`user`) or the AI (`assistant`).
 * @zh 消息的作者：使用应用的人（`user`）或 AI（`assistant`）。
 */
export type MessageAuthor = 'user' | 'assistant'

/**
 * State of a message: finished, being generated, failed, or stopped by the user. The same values as the
 * `status` of useStream, without `idle`.
 * @zh 消息的状态：已完成、生成中、失败、被用户停止。与 useStream 的 `status` 取值相同（没有 `idle`）。
 */
export type MessageStatus = 'done' | 'streaming' | 'error' | 'stopped'

/**
 * Props of Message.
 * @zh Message 属性。
 */
export interface MessageProps extends Pick<BaseProps, 'testId'> {
  /**
   * Who wrote the message: `user` messages are right-aligned in a bubble, `assistant` messages are left-aligned
   * without a bubble and use the full width.
   * @zh 作者：`user` 的消息靠右、在气泡中；`assistant` 的消息靠左、不加气泡、占满宽度。
   */
  readonly author: MessageAuthor
  /**
   * The content: plain text (line breaks are kept) or rendered content such as Markdown. While `status` is
   * `streaming` and there is no content yet, a loading indicator is shown instead.
   * @zh 内容：纯文本（保留换行）或渲染好的内容（如 Markdown）。`status` 为 `streaming` 且还没有内容时，改为显示加载指示。
   */
  readonly children?: ReactNode
  /**
   * Name of the author, shown above the content and used as the accessible name of the message. Without it,
   * nothing is shown and screen readers read "You" or "Assistant".
   * @zh 作者名称：显示在内容上方，也是消息的读屏名称。不传时不显示，读屏读「你」或「助手」。
   */
  readonly name?: string
  /**
   * Avatar of an assistant message, usually an Avatar with `size={28}`; shown to the left of the content.
   * @zh 助手消息的头像，通常是 `size={28}` 的 Avatar，显示在内容左侧。
   */
  readonly avatar?: ReactNode
  /**
   * Secondary information next to the name, such as the time or the model.
   * @zh 名称旁的次要信息，如时间、模型。
   */
  readonly meta?: ReactNode
  /**
   * State: `streaming` while the reply is generated (an empty reply shows "Generating" after 200 ms, actions are
   * hidden), `error` adds a failure note (with "Retry" when `onRetry` is set), `stopped` adds a "Stopped" note.
   * @zh 状态：`streaming` 生成中（还没有内容时 200ms 后显示「正在生成」，不显示操作）；`error` 追加失败说明（有
   * `onRetry` 时带「重试」）；`stopped` 追加「已停止」标注。
   * @default 'done'
   */
  readonly status?: MessageStatus
  /**
   * Explanation shown when `status` is `error`; "Couldn't generate a reply" by default.
   * @zh `status` 为 `error` 时显示的说明，默认「未能生成回复」。
   */
  readonly error?: ReactNode
  /**
   * Shows "Retry" in the failure note and calls this function when it is pressed.
   * @zh 在失败说明中显示「重试」，按下时调用。
   */
  readonly onRetry?: () => void
  /**
   * Actions below the content, usually MessageActions. Not shown while `status` is `streaming`.
   * @zh 内容下方的操作，通常是 MessageActions。`status` 为 `streaming` 时不显示。
   */
  readonly actions?: ReactNode
  /**
   * When the actions are visible: `hover` on hover or keyboard focus (always on touch screens), `always` for
   * example on the last message.
   * @zh 操作何时可见：`hover` 悬停或键盘焦点进入消息时（触屏上始终可见）；`always` 始终可见，如最后一条消息。
   * @default 'hover'
   */
  readonly showActions?: 'hover' | 'always'
}

/** 内容是否为空（还没有收到任何文字）：空、布尔、只有空白的字符串，或全是这些的数组。 */
function isEmpty(node: ReactNode): boolean {
  if (node === null || node === undefined || typeof node === 'boolean') return true
  if (typeof node === 'string') return node.trim() === ''
  if (Array.isArray(node)) return node.every(isEmpty)
  return false
}

/**
 * One message of a conversation. User messages are right-aligned in a bubble with a neutral fill; assistant
 * messages are left-aligned without a bubble and use the full width, optionally with an avatar and a name. Place
 * it in MessageList.
 *
 * **Interaction**: while a reply is generated and still empty, "Generating" appears after 200 ms (no flash for
 * fast replies; the indicator is static when motion is reduced). A failed reply keeps the text received so far and
 * adds a note with "Retry"; a stopped reply adds "Stopped". The actions appear on hover or when keyboard focus
 * enters the message, without changing the height of the message (their place is kept); on touch screens and with
 * `showActions="always"` they are always visible.
 * @zh 对话中的一条消息。用户消息靠右，在中性填充的气泡中；助手消息靠左、不加气泡、占满宽度，可以有头像与名字。放在
 * MessageList 中使用。
 *
 * **交互**：回复生成中且还没有内容时，200ms 后出现「正在生成」（很快的回复不会闪出；减少动态效果时指示静止）。失败的回复
 * 保留已经收到的文字，并追加带「重试」的说明；被停止的回复追加「已停止」。操作在悬停或键盘焦点进入消息时出现，消息的高度
 * 不变（位置预先留好）；触屏上以及 `showActions="always"` 时始终可见。
 * @category AI
 * @usage Messages of an AI chat, replies with copy and retry, failed or stopped generations
 * @usageZh AI 对话中的消息、带复制与重试的回复、失败或被停止的生成
 */
export function Message(props: MessageProps) {
  const t = useT()
  const { author, status = 'done', children } = props
  const empty = isEmpty(children)
  const label = props.name ?? t(author === 'user' ? 'message.user' : 'message.assistant')
  const header = props.name !== undefined || props.meta !== undefined
  return (
    <article
      className={styles.message}
      aria-label={label}
      aria-busy={status === 'streaming' || undefined}
      data-author={author}
      data-status={status}
      data-show-actions={props.showActions ?? 'hover'}
      data-testid={props.testId}
    >
      {author === 'assistant' && props.avatar !== undefined && (
        <div className={styles.avatar}>{props.avatar}</div>
      )}
      <div className={styles.main}>
        {header && (
          <div className={styles.header}>
            {props.name !== undefined && <span className={styles.name}>{props.name}</span>}
            {props.meta !== undefined && <span className={styles.meta}>{props.meta}</span>}
          </div>
        )}
        {!empty && (
          <div
            className={styles.content}
            data-plain={typeof children === 'string' || undefined}
            data-vl-announce=""
          >
            {children}
          </div>
        )}
        {status === 'streaming' && empty && (
          <div className={styles.pending}>
            <span className={styles.spin}>
              <Icon name="loader" size={14} />
            </span>
            {t('message.generating')}
          </div>
        )}
        {status === 'error' && (
          <div className={styles.note} data-tone="danger">
            <Icon name="alert" size={14} />
            <span data-vl-announce="">{props.error ?? t('message.failed')}</span>
            {props.onRetry && <LinkButton onClick={props.onRetry}>{t('message.retry')}</LinkButton>}
          </div>
        )}
        {status === 'stopped' && (
          <div className={styles.note}>
            <Icon name="stop" size={14} />
            <span data-vl-announce="">{t('message.stopped')}</span>
          </div>
        )}
        {props.actions !== undefined && status !== 'streaming' && (
          <div className={styles.actions}>{props.actions}</div>
        )}
      </div>
    </article>
  )
}
