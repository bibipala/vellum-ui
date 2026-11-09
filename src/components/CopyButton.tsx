/**
 * 复制按钮：把文字写入剪贴板（navigator.clipboard.writeText），成功后图标短暂变为勾并播报「已复制」。
 * 只写入、不读取剪贴板。失败时（没有剪贴板接口、浏览器拒绝）显示失败状态并交给 `onError`，不吞掉异常。
 */
import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n/index.ts'
import { ButtonBase } from './basic.tsx'
import styles from './copy-button.module.css'
import { IconButton } from './Extras.tsx'
import { Icon, type IconName } from './Icon.tsx'
import { reportError } from './internal.ts'
import type { BaseProps } from './layout.tsx'
import hidden from './visually-hidden.module.css'

/** 成功、失败状态的显示时长（毫秒）：失败多停留一会儿，让人看清。 */
const COPIED_MS = 2000
const FAILED_MS = 4000

type CopyStatus = 'idle' | 'copied' | 'failed'

const STATUS_ICON: Record<CopyStatus, IconName> = { idle: 'copy', copied: 'check', failed: 'alert' }

/**
 * Props of CopyButton.
 * @zh CopyButton 属性。
 */
export interface CopyButtonProps extends Pick<BaseProps, 'testId'> {
  /**
   * The text to copy.
   * @zh 要复制的文字。
   */
  readonly text: string
  /**
   * Label: the text of the button with `showLabel`, otherwise the tooltip and the accessible name. "Copy" by
   * default (follows `locale`).
   * @zh 文字说明：`showLabel` 时是按钮文字，否则是提示与读屏名称。默认「复制」（随 `locale`）。
   */
  readonly label?: string
  /**
   * Shows the label next to the icon (a Button); by default only the icon is shown (an IconButton with a
   * tooltip).
   * @zh 在图标旁显示文字（Button 外观）；默认只显示图标（带提示的 IconButton 外观）。
   */
  readonly showLabel?: boolean
  /**
   * Size of the icon-only button: `sm` inside code blocks and list items, `md` in toolbars.
   * @zh 只有图标时的尺寸：sm 用于代码块与列表行内，md 用于工具栏。
   * @default 'md'
   */
  readonly size?: 'sm' | 'md'
  /**
   * Disables the button.
   * @zh 禁用。
   */
  readonly disabled?: boolean
  /**
   * Called after the text has been written to the clipboard.
   * @zh 文字写入剪贴板之后调用。
   */
  readonly onCopy?: (text: string) => void
  /**
   * Called when copying fails: the Clipboard API is not available (it requires a secure context, HTTPS or
   * localhost) or the browser refused to write. The button shows the failed state either way; without `onError`
   * the error is reported with `reportError`.
   * @zh 复制失败时调用：没有剪贴板接口（需要安全上下文，即 HTTPS 或 localhost）或浏览器拒绝写入。
   * 无论是否提供，按钮都会显示失败状态；不提供时错误通过 `reportError` 上报。
   */
  readonly onError?: (error: unknown) => void
}

/**
 * A button that copies a text to the clipboard. It only writes to the clipboard and never reads from it.
 *
 * **Interaction**: hover and press add the shared state layer, `Tab` focus shows the focus ring and `Enter` /
 * `Space` copy. After copying, the icon turns into a check mark for 2 seconds, the tooltip says "Copied" and
 * screen readers announce "Copied". When copying fails, the icon turns into a warning sign for 4 seconds, the
 * tooltip and the announcement say "Couldn't copy", and `onError` is called. The width of the button with a
 * label does not change.
 * @zh 复制按钮：把一段文字复制到剪贴板。只写入、不读取剪贴板。
 *
 * **交互**：悬停与按下叠加统一状态层，`Tab` 聚焦显示焦点环，`Enter` / `Space` 复制。复制成功后图标变为勾、
 * 持续 2 秒，提示显示「已复制」，读屏播报「已复制」；失败时图标变为警示、持续 4 秒，提示与播报为「复制失败」，
 * 并调用 `onError`。带文字的按钮宽度不变。
 * @category Basic
 * @usage Copying tokens, links, IDs and code examples
 * @usageZh 复制令牌、链接、编号与代码示例
 */
export function CopyButton(props: CopyButtonProps) {
  const t = useT()
  const [status, setStatus] = useState<CopyStatus>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      clearTimeout(timer.current)
    }
  }, [])

  const show = (next: CopyStatus) => {
    clearTimeout(timer.current)
    setStatus(next)
    timer.current = setTimeout(() => setStatus('idle'), next === 'failed' ? FAILED_MS : COPIED_MS)
  }
  const fail = (error: unknown) => {
    if (alive.current) show('failed')
    // 调用方没有提供 onError 时，异常交给全局的错误处理，不能被悄悄吞掉
    if (props.onError) props.onError(error)
    else reportError(error)
  }
  const copy = () => {
    const { text, onCopy } = props
    const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard
    if (typeof clipboard?.writeText !== 'function') {
      fail(new Error('The Clipboard API is not available; it requires a secure context (HTTPS).'))
      return
    }
    let written: Promise<void>
    try {
      written = clipboard.writeText(text)
    } catch (error) {
      fail(error)
      return
    }
    written.then(() => {
      if (alive.current) show('copied')
      onCopy?.(text)
    }, fail)
  }

  const label = props.label ?? t('copy.copy')
  const statusText =
    status === 'copied' ? t('copy.copied') : status === 'failed' ? t('copy.failed') : ''
  return (
    <span
      className={styles.root}
      data-variant={props.showLabel ? 'label' : 'icon'}
      data-status={status}
      data-testid={props.testId}
    >
      {props.showLabel ? (
        <ButtonBase
          iconSize={16}
          icon={
            <Icon
              name={STATUS_ICON[status]}
              tone={status === 'copied' ? 'success' : status === 'failed' ? 'danger' : 'inherit'}
            />
          }
          disabled={props.disabled}
          onClick={copy}
        >
          {label}
        </ButtonBase>
      ) : (
        <IconButton
          icon={STATUS_ICON[status]}
          // 提示显示结果；读屏名称保持「复制」不变，结果由下面的播报区读出
          label={statusText || label}
          aria-label={label}
          size={props.size ?? 'md'}
          disabled={props.disabled}
          onClick={copy}
        />
      )}
      <span className={hidden.hidden} role="status">
        {statusText}
      </span>
    </span>
  )
}
