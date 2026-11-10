/**
 * 输入框（AI 对话）：基于 Ant Design X 的 Sender（自动增高的文本框、输入法组字、粘贴文件），按钮、附件、拖放、
 * 发送与停止由本组件实现。
 *
 * - 发送：`Enter` 发送、`Shift+Enter` 换行；输入法组字时 `Enter` 只是确认文字；内容为空（只有空白且没有附件）时不能发送。
 *   X 的发送按钮只在它自己的按钮渲染时才更新可否发送的状态，这里不用它的按钮，`Enter` 由本组件处理。
 * - 生成中：发送按钮原位变为「停止」（同一个按钮，宽度不变），`Esc` 也能停止。
 * - 附件（ADR 0020「影响」中的安全要求）：组件自己不上传、不读取文件内容，只看名称、类型与大小；`onSubmit` 把文字与附件交给使用方。
 *   粘贴只在粘贴事件中取文件（粘贴的内容有文字时按文字处理），不读取剪贴板。
 */
import SenderModule, { type SenderProps, type SenderRef } from '@ant-design/x/es/sender/index.js'
import { Input as AntInput } from 'antd'
import {
  type ChangeEvent,
  type ComponentRef,
  createContext,
  type DragEvent,
  forwardRef,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  useContext,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { useT } from '../../i18n/index.ts'
import { IconButton } from '../Extras.tsx'
import { fileRejectReason, formatSize } from '../fileRules.ts'
import { Icon } from '../Icon.tsx'
import type { BaseProps } from '../layout.tsx'
import { DisabledReasonTooltip } from '../overlays.tsx'
import styles from './prompt-input.module.css'
import { esModuleDefault } from './x-interop.ts'

// 默认导入在 TypeScript 与打包器中的形态不同，见 x-interop.ts
const Sender = /* @__PURE__ */ esModuleDefault(SenderModule)

/**
 * Why a file was not attached: `type` does not match `accept`, `size` exceeds `maxSize`, `count` would exceed
 * `maxFiles`.
 * @zh 文件没有加入附件的原因：`type` 不符合 `accept`，`size` 超过 `maxSize`，`count` 会超过 `maxFiles`。
 */
export type PromptInputRejectReason = 'type' | 'size' | 'count'

/**
 * What PromptInput submits: the text (without leading and trailing whitespace) and the attached files.
 * @zh PromptInput 提交的内容：文字（去掉首尾空白）与附件。
 */
export interface PromptInputSubmit {
  /**
   * The text without leading and trailing whitespace; may be empty when only files are attached.
   * @zh 去掉首尾空白的文字；只有附件时可以为空。
   */
  readonly text: string
  /**
   * The attached files, in the order they were added. The component has not read or uploaded them.
   * @zh 附件，按加入的顺序。组件没有读取或上传它们。
   */
  readonly files: readonly File[]
}

/**
 * Controls a PromptInput through `ref`.
 * @zh 通过 ref 控制 PromptInput。
 */
export interface PromptInputHandle {
  /**
   * Moves keyboard focus to the text field.
   * @zh 把键盘焦点移到文本框。
   */
  focus(): void
  /**
   * Removes focus from the text field.
   * @zh 让文本框失去焦点。
   */
  blur(): void
}

/**
 * Props of PromptInput.
 * @zh PromptInput 属性。
 */
export interface PromptInputProps extends Pick<BaseProps, 'testId'> {
  /**
   * The text (controlled). Clear it yourself in `onSubmit`.
   * @zh 文字（受控）。需要在 `onSubmit` 中自己清空。
   */
  readonly value?: string
  /**
   * Initial text (uncontrolled); the text is cleared after each submission.
   * @zh 初始文字（非受控）；每次提交后自动清空。
   */
  readonly defaultValue?: string
  /**
   * Called when the text changes.
   * @zh 文字变化时调用。
   */
  readonly onChange?: (value: string) => void
  /**
   * Called with the text and the files when `Enter` or the send button is pressed. Not called while
   * `generating`, while disabled, or when there is neither text nor a file.
   * @zh 按 `Enter` 或发送按钮时，以文字与附件调用。`generating`、禁用时，或既没有文字也没有附件时不调用。
   */
  readonly onSubmit?: (message: PromptInputSubmit) => void
  /**
   * A reply is being generated: the send button turns into "Stop generating" (`onStop`, also on `Esc`) and
   * `Enter` does not submit. Typing is still possible.
   * @zh 正在生成回复：发送按钮变为「停止生成」（`onStop`，`Esc` 也可以），`Enter` 不提交。仍然可以输入。
   */
  readonly generating?: boolean
  /**
   * Called when the stop button or `Esc` is pressed while `generating`.
   * @zh `generating` 时按下停止按钮或 `Esc` 时调用。
   */
  readonly onStop?: () => void
  /**
   * Placeholder; "Type a message" by default.
   * @zh 占位文字，默认「输入消息」。
   */
  readonly placeholder?: string
  /**
   * Accessible name of the text field; "Message" by default.
   * @zh 文本框的读屏名称，默认「消息」。
   */
  readonly 'aria-label'?: string
  /**
   * Disables typing, attaching and sending.
   * @zh 禁止输入、添加附件与发送。
   */
  readonly disabled?: boolean
  /**
   * Disabled reason, shown on hover or keyboard focus while `disabled` (as on Button). With a reason, the text field
   * can still be focused (`aria-disabled`, read-only) and screen readers read the reason.
   * @zh 禁用原因：`disabled` 时悬停或键盘聚焦显示（与 Button 相同）。提供后文本框仍可聚焦（`aria-disabled`、只读），读屏读出原因。
   */
  readonly disabledReason?: string
  /**
   * Maximum number of visible lines; longer text scrolls inside the field.
   * @zh 最多显示的行数，更长的文字在框内滚动。
   * @default 8
   */
  readonly maxRows?: number
  /**
   * Allows attaching files: the attach button, dropping files on the field and pasting files.
   * @zh 允许添加附件：附件按钮、把文件拖到输入框上、粘贴文件。
   */
  readonly allowFiles?: boolean
  /**
   * The attached files (controlled).
   * @zh 附件（受控）。
   */
  readonly files?: readonly File[]
  /**
   * Initial files (uncontrolled); the files are cleared after each submission.
   * @zh 初始附件（非受控）；每次提交后自动清空。
   */
  readonly defaultFiles?: readonly File[]
  /**
   * Called when files are added or removed.
   * @zh 附件增加或移除时调用。
   */
  readonly onFilesChange?: (files: readonly File[]) => void
  /**
   * Accepted file types: comma-separated extensions and MIME types, such as `".pdf,image/*"` (as on Upload).
   * Every type is accepted by default.
   * @zh 接受的文件类型：逗号分隔的扩展名与 MIME 类型，如 `".pdf,image/*"`（与 Upload 相同）。默认接受所有类型。
   */
  readonly accept?: string
  /**
   * Maximum size of one file in bytes. No limit by default; the server must check it as well.
   * @zh 单个文件的最大字节数。默认不限制；服务端同样要校验。
   */
  readonly maxSize?: number
  /**
   * Maximum number of attached files.
   * @zh 附件的最多个数。
   */
  readonly maxFiles?: number
  /**
   * Called for each file that was not attached, with the reason.
   * @zh 每个没有加入附件的文件都会以原因调用。
   */
  readonly onReject?: (file: File, reason: PromptInputRejectReason) => void
  /**
   * Your own controls in the bottom bar, before the send button, such as a model picker.
   * @zh 底栏中发送按钮之前的自定义控件，如模型选择。
   */
  readonly actions?: ReactNode
}

/** 文本框的额外属性：X 的 Sender 不转交 aria 属性，用自定义的文本框组件带上。 */
const TextAreaAria = createContext<Record<string, string | boolean | undefined>>({})

type AntTextAreaProps = Parameters<typeof AntInput.TextArea>[0]

/** 交给 Sender 渲染的文本框：antd 的 TextArea 加上读屏名称、说明、禁用状态（X 读取它的 ref 来聚焦、取值）。 */
const PromptTextArea = forwardRef<
  ComponentRef<typeof AntInput.TextArea>,
  Omit<AntTextAreaProps, 'ref'>
>(function PromptTextArea(props, ref) {
  const aria = useContext(TextAreaAria)
  return <AntInput.TextArea {...props} {...aria} ref={ref} />
})

const SENDER_COMPONENTS: SenderProps['components'] = { input: PromptTextArea }

/** 拖动的内容里是否有文件（拖动页面上的文字、链接时不提示投放）。 */
const hasFiles = (e: DragEvent) => [...(e.dataTransfer?.types ?? [])].includes('Files')

/** 附件卡片的稳定键：同一个 File 对象始终得到同一个键。 */
const fileKeys = new WeakMap<File, string>()
let nextFileKey = 0
function keyOf(file: File): string {
  let key = fileKeys.get(file)
  if (!key) {
    key = `f${nextFileKey++}`
    fileKeys.set(file, key)
  }
  return key
}

function PromptInputInner(props: PromptInputProps, ref: Ref<PromptInputHandle>) {
  const t = useT()
  const { generating = false, maxRows = 8 } = props
  const [innerValue, setInnerValue] = useState(props.defaultValue ?? '')
  const text = props.value ?? innerValue
  const [innerFiles, setInnerFiles] = useState<readonly File[]>(props.defaultFiles ?? [])
  const files = props.files ?? innerFiles
  // 拖放、粘贴可能在一次渲染之间连续加入文件：总是在最新的列表上追加
  const latestFiles = useRef(files)
  latestFiles.current = files
  const senderRef = useRef<SenderRef>(null)
  const actionRef = useRef<HTMLButtonElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const filesRef = useRef<HTMLUListElement>(null)
  const composing = useRef(false)
  const [over, setOver] = useState(false)
  const depth = useRef(0)
  const focusAfterRemove = useRef<number | null>(null)
  const reasonId = useId()

  const disabled = Boolean(props.disabled)
  // 有禁用原因时文本框仍可聚焦（只读 + aria-disabled），原因通过提示与 aria-describedby 给出
  const blocked = disabled && Boolean(props.disabledReason)
  const canSubmit = !disabled && !generating && (text.trim() !== '' || files.length > 0)

  const focusInput = () => senderRef.current?.focus()
  useImperativeHandle(ref, () => ({
    focus: focusInput,
    blur: () => senderRef.current?.blur(),
  }))

  const setText = (value: string) => {
    if (props.value === undefined) setInnerValue(value)
    props.onChange?.(value)
  }
  const setFiles = (next: readonly File[]) => {
    latestFiles.current = next
    if (props.files === undefined) setInnerFiles(next)
    props.onFilesChange?.(next)
  }

  const addFiles = (list: Iterable<File>) => {
    if (!props.allowFiles || disabled) return
    const current = latestFiles.current
    const accepted: File[] = []
    for (const file of list) {
      const reason: PromptInputRejectReason | null =
        fileRejectReason(file, { accept: props.accept, maxSize: props.maxSize }) ??
        (props.maxFiles !== undefined && current.length + accepted.length >= props.maxFiles
          ? 'count'
          : null)
      if (reason) props.onReject?.(file, reason)
      else accepted.push(file)
    }
    if (accepted.length) setFiles([...current, ...accepted])
  }

  const removeFile = (file: File, index: number) => {
    focusAfterRemove.current = index
    setFiles(latestFiles.current.filter((f) => f !== file))
  }

  // 移除附件后焦点移到同一位置的下一张卡片（没有就上一张，都没有了就回到文本框），不丢到 body 上
  useLayoutEffect(() => {
    const index = focusAfterRemove.current
    if (index === null) return
    focusAfterRemove.current = null
    const buttons = filesRef.current?.querySelectorAll<HTMLElement>('button') ?? []
    const target = buttons[Math.min(index, buttons.length - 1)]
    if (target) target.focus()
    else focusInput()
  })

  // 停止按钮变回发送按钮时可能是禁用的（文字已清空）：焦点不能留在禁用的按钮上，回到文本框
  useLayoutEffect(() => {
    const button = actionRef.current
    if (button && document.activeElement === button && button.disabled) focusInput()
  })

  const submit = () => {
    if (!canSubmit) return
    props.onSubmit?.({ text: text.trim(), files })
    if (props.value === undefined) setInnerValue('')
    if (props.files === undefined) setInnerFiles([])
    focusInput()
  }

  const stop = () => {
    if (!generating || !props.onStop) return
    props.onStop()
  }

  const onKeyDown = (e: KeyboardEvent) => {
    const native = e.nativeEvent as globalThis.KeyboardEvent
    // 输入法组字中：Enter 是确认文字、Esc 是取消组字（Safari 中确认组字的 Enter 在 compositionend 之后、keyCode 为 229）
    const ime = composing.current || native.isComposing || native.keyCode === 229
    if (e.key === 'Escape') {
      if (ime || !generating || !props.onStop) return
      // 停止生成，不再交给外层（如对话框的 Esc 关闭）
      e.preventDefault()
      e.stopPropagation()
      stop()
      return false
    }
    if (e.key !== 'Enter') return
    // 返回 false：X 不再处理这次 Enter（发送由这里决定）
    if (ime || e.shiftKey) return false
    if (e.ctrlKey || e.metaKey || e.altKey) return false
    e.preventDefault()
    submit()
    return false
  }

  const onFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files ?? [])
    // 清空：再次选择同一个文件也会触发 change
    e.target.value = ''
  }

  const acceptsDrop = props.allowFiles && !disabled
  const resetDrag = () => {
    depth.current = 0
    setOver(false)
  }

  const header =
    files.length > 0 ? (
      <ul ref={filesRef} className={styles.files} aria-label={t('promptInput.attachments')}>
        {files.map((file, index) => (
          <li key={keyOf(file)} className={styles.file}>
            <Icon
              name={file.type.startsWith('image/') ? 'file-image' : 'file-text'}
              tone="tertiary"
            />
            <span className={styles.fileText}>
              <span className={styles.fileName} title={file.name}>
                {file.name}
              </span>
              <span className={styles.fileSize}>{formatSize(file.size)}</span>
            </span>
            <IconButton
              icon="close"
              size="sm"
              label={t('promptInput.remove', { name: file.name })}
              disabled={disabled}
              onClick={() => removeFile(file, index)}
            />
          </li>
        ))}
      </ul>
    ) : null

  const footer = (
    <div className={styles.bar}>
      {props.allowFiles && (
        <>
          <IconButton
            icon="attach"
            label={t('promptInput.attach')}
            disabled={disabled}
            onClick={() => fileInputRef.current?.click()}
          />
          <input
            ref={fileInputRef}
            type="file"
            className={styles.fileInput}
            accept={props.accept}
            multiple={props.maxFiles !== 1}
            onChange={onFileInput}
          />
        </>
      )}
      {props.actions}
      <span className={styles.spacer} />
      {/* 发送与停止是同一个按钮：生成开始、结束时宽度与焦点都不变 */}
      <IconButton
        ref={actionRef}
        icon={generating ? 'stop' : 'arrow-up'}
        variant="accent"
        label={generating ? t('promptInput.stop') : t('promptInput.send')}
        disabled={generating ? !props.onStop || disabled : !canSubmit}
        onClick={generating ? stop : submit}
      />
    </div>
  )

  const root = (
    // biome-ignore lint/a11y/noStaticElementInteractions: 只监听拖放（投放文件）与输入法组字的冒泡事件，交互元素是其中的文本框与按钮
    <div
      className={styles.root}
      data-vl-prompt=""
      data-disabled={disabled || undefined}
      data-drag-over={over || undefined}
      data-testid={props.testId}
      onCompositionStart={() => {
        composing.current = true
      }}
      onCompositionEnd={() => {
        composing.current = false
      }}
      onDragEnter={(e) => {
        if (!acceptsDrop || !hasFiles(e)) return
        depth.current++
        setOver(true)
      }}
      onDragOver={(e) => {
        if (!acceptsDrop || !hasFiles(e)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
      }}
      onDragLeave={() => {
        if (depth.current === 0) return
        depth.current--
        if (depth.current === 0) setOver(false)
      }}
      onDrop={(e) => {
        if (!acceptsDrop || !hasFiles(e)) return
        e.preventDefault()
        resetDrag()
        addFiles(e.dataTransfer.files)
      }}
    >
      <TextAreaAria.Provider
        value={{
          'aria-label': props['aria-label'] ?? t('promptInput.label'),
          'aria-disabled': blocked || undefined,
          'aria-describedby': blocked ? reasonId : undefined,
        }}
      >
        <Sender
          ref={senderRef}
          className={styles.sender}
          classNames={{ content: styles.content, input: styles.input, footer: styles.footer }}
          components={SENDER_COMPONENTS}
          value={text}
          onChange={(value) => setText(value)}
          placeholder={props.placeholder ?? t('promptInput.placeholder')}
          disabled={disabled && !blocked}
          readOnly={blocked}
          autoSize={{ minRows: 1, maxRows }}
          onKeyDown={onKeyDown}
          onPasteFile={props.allowFiles ? (list) => addFiles(list) : undefined}
          header={header}
          footer={footer}
          suffix={false}
        />
      </TextAreaAria.Provider>
      {over && (
        <div className={styles.dropHint} aria-hidden="true">
          <Icon name="upload" />
          {t('promptInput.drop')}
        </div>
      )}
    </div>
  )

  if (!blocked) return root
  return (
    <DisabledReasonTooltip id={reasonId} reason={props.disabledReason ?? ''}>
      {root}
    </DisabledReasonTooltip>
  )
}

/**
 * The text field of a chat: it grows with its text, sends with `Enter` and turns its send button into a stop
 * button while a reply is generated. Files can be attached with the attach button, by dropping or by pasting
 * (`allowFiles`); they are shown as removable cards and handed to `onSubmit` with the text. The component never
 * uploads or reads the files.
 *
 * **Interaction**: the field is a borderless surface card that floats on the page; on focus it shows the accent border and the
 * focus halo, like Input. It grows up to `maxRows` lines, then scrolls. `Enter` sends, `Shift+Enter` adds a line break, and `Enter`
 * only confirms the text while an input method is composing. Sending is not possible while the text is blank and no
 * file is attached. While `generating`, the send button turns into "Stop generating" in place (same size, focus
 * kept), and `Esc` stops as well. Files dragged over the field show an accent drop area; rejected files are
 * reported with `onReject`; removing a card moves focus to the next card or back to the field. With
 * `disabledReason`, hovering or focusing the field shows the reason.
 * @zh 对话的输入框：随文字增高，`Enter` 发送，生成回复时发送按钮变为停止按钮。允许附件时（`allowFiles`）可以用附件按钮、拖入或粘贴
 * 添加文件，文件显示为可移除的卡片，与文字一起交给 `onSubmit`。组件从不上传或读取文件。
 *
 * **交互**：不描边、浮在页面上的表面色卡片；聚焦时显示强调色细边与光环，与 Input 一致。最多增高到 `maxRows` 行，之后在框内滚动。`Enter` 发送，
 * `Shift+Enter` 换行，输入法组字时 `Enter` 只确认文字。文字为空白且没有附件时不能发送。`generating` 时发送按钮原位变为「停止生成」
 * （大小不变、焦点保留），`Esc` 也能停止。文件拖到输入框上时显示强调色的投放区；被拒绝的文件通过 `onReject` 告知；移除卡片后焦点
 * 移到下一张卡片或回到文本框。提供 `disabledReason` 时，悬停或聚焦输入框显示原因。
 * @category AI
 * @usage The message field of an AI chat, prompts with attachments, any field that sends with Enter
 * @usageZh AI 对话的输入框、带附件的提示输入、按 Enter 发送的输入框
 */
export const PromptInput = forwardRef(PromptInputInner)
