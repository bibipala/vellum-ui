/**
 * 上传：选择文件（Upload）与拖放区（Upload.Dropzone）。antd 的 Upload 只作为内部实现：选择、拖放、粘贴、
 * beforeUpload、请求的进度与状态由它处理；文件列表由本组件用 ListItem 自己渲染（填充式外观、Lucide 图标、
 * 失败重试、移除后焦点不丢）。
 *
 * 安全（ADR 0020「影响」中的安全要求）：组件自己不发请求。没有 `action` 也没有 `customRequest` 时只把文件放进列表（不上传），
 * 由使用方在提交时处理；antd 在这种情况下会向当前页面地址 POST，这里不允许。`accept` 与 `maxSize` 在
 * beforeUpload 之前由本组件校验（点选与拖入都校验；antd 只在拖入时按 accept 过滤，点选时完全不过滤）。
 */
import {
  Upload as AntUpload,
  type UploadFile as AntUploadFile,
  type UploadProps as AntUploadProps,
  type UploadRef as AntUploadRef,
} from 'antd'
import {
  type DragEvent,
  type JSX,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useT } from '../i18n/index.ts'
import { IconButton } from './Extras.tsx'
import { fileRejectReason, formatSize } from './fileRules.ts'
import { Icon } from './Icon.tsx'
import { ListItem } from './items.tsx'
import { Progress } from './Progress.tsx'
import { Text } from './Text.tsx'
import styles from './upload.module.css'

/**
 * State of a file in the list: `uploading`, `done`, `error`, or `removed` (only in the `onChange` call that removes
 * it). A file chosen without a request has no status.
 * @zh 列表中文件的状态：上传中（`uploading`）、完成（`done`）、失败（`error`），或已移除（`removed`，只出现在移除它的那次
 * `onChange` 中）。不发请求时选择的文件没有状态。
 */
export type UploadFileStatus = 'uploading' | 'done' | 'error' | 'removed'

/**
 * A file in the list of Upload.
 * @zh Upload 列表中的一个文件。
 */
export interface UploadFile {
  /**
   * Unique id of the file in the list.
   * @zh 文件在列表中的唯一编号。
   */
  readonly uid: string
  /**
   * File name.
   * @zh 文件名。
   */
  readonly name: string
  /**
   * Size in bytes.
   * @zh 大小（字节）。
   */
  readonly size?: number
  /**
   * MIME type.
   * @zh MIME 类型。
   */
  readonly type?: string
  /**
   * State of the file.
   * @zh 文件的状态。
   */
  readonly status?: UploadFileStatus
  /**
   * Upload progress, 0–100.
   * @zh 上传进度，0–100。
   */
  readonly percent?: number
  /**
   * What the request reported with `onSuccess`, such as the id from the server.
   * @zh 请求通过 `onSuccess` 汇报的内容，如服务端返回的编号。
   */
  readonly response?: unknown
  /**
   * The error reported with `onError`.
   * @zh 通过 `onError` 汇报的错误。
   */
  readonly error?: unknown
  /**
   * The chosen file (not present for files of `defaultFileList`).
   * @zh 选择的文件（`defaultFileList` 中的文件没有）。
   */
  readonly originFileObj?: File
  /**
   * Address of the uploaded file: the name in the list becomes a link that opens it in a new tab.
   * @zh 已上传文件的地址：列表中的文件名变成在新标签页打开它的链接。
   */
  readonly url?: string
}

/**
 * What `onChange` receives: the file that changed and the whole list after the change.
 * @zh `onChange` 收到的内容：变化的文件，以及变化后的完整列表。
 */
export interface UploadChangeInfo {
  /**
   * The file that changed.
   * @zh 变化的文件。
   */
  readonly file: UploadFile
  /**
   * The whole list after the change.
   * @zh 变化后的完整列表。
   */
  readonly fileList: UploadFile[]
}

/**
 * What `customRequest` receives: the file and the callbacks that report progress and the result.
 * @zh `customRequest` 收到的内容：文件，以及汇报进度与结果的回调。
 */
export interface UploadRequestOptions {
  /**
   * The file to send.
   * @zh 要发送的文件。
   */
  readonly file: File
  /**
   * Reports the progress, 0–100.
   * @zh 汇报进度，0–100。
   */
  readonly onProgress: (percent: number) => void
  /**
   * Reports success, with what the server returned; the file becomes `done`.
   * @zh 汇报成功，参数是服务端返回的内容；文件变为完成。
   */
  readonly onSuccess: (response?: unknown) => void
  /**
   * Reports failure; the file shows "Upload failed" and "Retry".
   * @zh 汇报失败；文件显示「上传失败」与「重试」。
   */
  readonly onError: (error: Error) => void
}

/**
 * Why a file was rejected: `type` does not match `accept`, `size` exceeds `maxSize`.
 * @zh 文件被拒绝的原因：`type` 不符合 `accept`，`size` 超过 `maxSize`。
 */
export type UploadRejectReason = 'type' | 'size'

/**
 * Props of Upload.
 * @zh Upload 属性。
 */
export interface UploadProps {
  /**
   * Accepted file types: comma-separated extensions and MIME types, such as `".pdf,image/png,image/*"`. Checked
   * for chosen and dropped files; rejected files are not added to the list and `onReject` is called. By default
   * every type is accepted.
   * @zh 接受的文件类型：逗号分隔的扩展名与 MIME 类型，如 `".pdf,image/png,image/*"`。点选与拖入的文件都会校验，
   * 不符合的不加入列表，并调用 `onReject`。默认接受所有类型。
   */
  readonly accept?: string
  /**
   * Maximum size of one file in bytes, such as `10 * 1024 * 1024` for 10 MB. Larger files are not added to the list
   * and `onReject` is called. There is no limit by default; the server must check the size as well.
   * @zh 单个文件的最大字节数，如 10 MB 写作 `10 * 1024 * 1024`。超过的文件不加入列表，并调用 `onReject`。
   * 默认不限制；服务端同样要校验大小。
   */
  readonly maxSize?: number
  /**
   * Called for each file rejected by `accept` (`reason` is `type`) or `maxSize` (`size`), for example to show a
   * message.
   * @zh 文件因 `accept`（`reason` 为 `type`）或 `maxSize`（`size`）被拒绝时调用，可用来显示消息条。
   */
  readonly onReject?: (file: File, reason: UploadRejectReason) => void
  /**
   * Sends a file: report the progress and the result with the callbacks in `options`. Return an object with
   * `abort()` to let "Remove" cancel the request. Without `customRequest` and `action`, files are only added to the
   * list.
   * @zh 发送一个文件：用 `options` 中的回调汇报进度与结果。返回带 `abort()` 的对象时，「移除」可以取消请求。
   * 没有 `customRequest` 也没有 `action` 时，文件只加入列表。
   */
  readonly customRequest?: (options: UploadRequestOptions) => void | { abort(): void }
  /**
   * Address that receives each file as a `multipart/form-data` POST, when `customRequest` is not given.
   * @zh 没有 `customRequest` 时，接收文件的地址：每个文件以 `multipart/form-data` POST 发送。
   */
  readonly action?: string
  /**
   * Name of the file field in the POST to `action`.
   * @zh 向 `action` POST 时文件字段的名字。
   * @default 'file'
   */
  readonly name?: string
  /**
   * Allows choosing several files at once.
   * @zh 可以一次选择多个文件。
   */
  readonly multiple?: boolean
  /**
   * Largest number of files in the list; with `1`, a new file replaces the old one.
   * @zh 列表中最多的文件数；为 `1` 时新文件替换旧文件。
   */
  readonly maxCount?: number
  /**
   * Disables choosing and removing files.
   * @zh 禁止选择与移除文件。
   */
  readonly disabled?: boolean
  /**
   * The files in the list (controlled).
   * @zh 列表中的文件（受控）。
   */
  readonly fileList?: readonly UploadFile[]
  /**
   * Initial files (uncontrolled), such as attachments already saved.
   * @zh 初始的文件（非受控），如已保存的附件。
   */
  readonly defaultFileList?: readonly UploadFile[]
  /**
   * Called when files are added, change state or are removed.
   * @zh 文件加入、状态变化或被移除时调用。
   */
  readonly onChange?: (info: UploadChangeInfo) => void
  /**
   * Called before a file is removed; return `false` (or a promise of it) to keep it.
   * @zh 移除文件之前调用；返回 `false`（或解析为它的 Promise）则保留。
   */
  readonly onRemove?: (file: UploadFile) => boolean | undefined | Promise<boolean | undefined>
  /**
   * Called when the name of a file in the list is clicked, such as to preview it.
   * @zh 点击列表中的文件名时调用，如用于预览。
   */
  readonly onPreview?: (file: UploadFile) => void
  /**
   * Shows the file list below the trigger: name, size or progress, "Retry" for failed files and "Remove".
   * @zh 在触发元素下方显示文件列表：文件名、大小或进度，失败的文件有「重试」，以及「移除」。
   * @default true
   */
  readonly showUploadList?: boolean
  /**
   * The trigger, usually a Button. Pressing it opens the file dialog; focus stays on it.
   * @zh 触发元素，通常是一个 Button。按下后打开选择文件的对话框，焦点留在它上面。
   */
  readonly children?: ReactNode
  /**
   * Test id, output as `data-testid`.
   * @zh 测试定位，输出为 `data-testid`。
   */
  readonly 'data-testid'?: string
}

/**
 * Props of Upload.Dropzone.
 * @zh Upload.Dropzone 属性。
 */
export interface UploadDropzoneProps extends Omit<UploadProps, 'children'> {
  /**
   * Main text of the drop area; the built-in text by default ("Drag files here, or click to choose").
   * @zh 拖放区的主文字，默认为内置文本（「将文件拖到此处，或点击选择」）。
   */
  readonly title?: ReactNode
  /**
   * Secondary text below the title, such as the accepted types and the size limit.
   * @zh 标题下方的说明，如接受的类型与大小限制。
   */
  readonly hint?: ReactNode
  /**
   * Custom content that replaces the icon, title and hint.
   * @zh 自定义内容，替换默认的图标、标题与说明。
   */
  readonly children?: ReactNode
}

/** antd 内部的类型：只在本文件与 antd 之间交换。 */
type AnyFile = AntUploadFile<unknown>
type AntRequest = NonNullable<AntUploadProps['customRequest']>
type AntRequestOptions = Parameters<AntRequest>[0]

/** 触发元素：上传区域中第一个可聚焦的元素（选择文件的 input 隐藏，不可聚焦）。 */
function triggerOf(root: HTMLElement | null): HTMLElement | null {
  return (
    root?.querySelector<HTMLElement>(
      '.ant-upload button:not([disabled]), .ant-upload a[href], .ant-upload [tabindex="0"]',
    ) ?? null
  )
}

/** 一次请求：重试时用同样的参数再发一次（`file` 的 uid 不变，列表中的同一项从失败变回上传中）。 */
interface RecordedRequest {
  readonly options: AntRequestOptions
  readonly info: Parameters<AntRequest>[1]
  /** 交给使用方 customRequest 的参数：重试时传同一个对象。 */
  readonly own: UploadRequestOptions
}

/** 请求函数的返回值：可能带 `abort()`（antd 的默认请求），也可能什么都不返回。 */
type Aborter = { abort?: () => void } | undefined

interface InternalProps extends Omit<UploadDropzoneProps, 'title' | 'hint'> {
  /** 渲染为拖放区。 */
  readonly drag?: boolean
}

function useUpload(props: InternalProps) {
  const {
    accept,
    maxSize,
    onReject,
    showUploadList = true,
    customRequest,
    action,
    fileList: controlledList,
    defaultFileList,
    onChange,
    onRemove,
    disabled,
    drag,
    children,
    ...rest
  } = props
  const t = useT()
  const [innerList, setInnerList] = useState<readonly UploadFile[]>(defaultFileList ?? [])
  const list = controlledList ?? innerList
  // 请求回调与移除在异步中执行：总是读取最新的列表
  const latest = useRef(list)
  latest.current = list
  const antdRef = useRef<AntUploadRef<unknown> | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const requests = useRef(new Map<string, RecordedRequest>())
  const retried = useRef(new Map<string, Aborter>())
  // 移除后把焦点移到同一位置的下一项（没有就上一项，列表空了就回到触发元素），而不是丢到 body 上
  const focusAfterRemove = useRef<number | null>(null)
  const hasTransport = Boolean(action) || Boolean(customRequest)

  useEffect(() => {
    const index = focusAfterRemove.current
    if (index === null) return
    focusAfterRemove.current = null
    const items = listRef.current?.querySelectorAll<HTMLElement>(':scope > li')
    const target = items?.[Math.min(index, items.length - 1)]
    const button = target?.querySelector<HTMLElement>('[data-vl-upload-remove]')
    ;(button ?? triggerOf(rootRef.current))?.focus()
  })

  const emit = (info: UploadChangeInfo) => {
    if (controlledList === undefined) setInnerList(info.fileList)
    onChange?.(info)
  }

  const mergedBeforeUpload: AntUploadProps['beforeUpload'] = (file) => {
    const reason: UploadRejectReason | null = fileRejectReason(file, { accept, maxSize })
    if (reason) {
      onReject?.(file, reason)
      return AntUpload.LIST_IGNORE
    }
    // 没有指定上传方式：只加入列表，不发请求（antd 默认会向当前页面地址 POST）
    return hasTransport
  }

  // 使用方的 customRequest 收到本库的参数（进度是数字，不是 antd 的 { percent } 对象）
  const ownOptions = (options: AntRequestOptions): UploadRequestOptions => ({
    file: options.file as File,
    onProgress: (percent) => options.onProgress?.({ percent }),
    onSuccess: (response) => options.onSuccess?.(response),
    onError: (error) => options.onError?.(error),
  })
  const send = (recorded: RecordedRequest): Aborter =>
    customRequest
      ? (customRequest(recorded.own) ?? undefined)
      : (recorded.info.defaultRequest(recorded.options) as Aborter)

  // 请求总是经过这里：记下参数以便失败后重试；实际的请求是使用方的 customRequest，或 antd 向 action 发出的默认请求
  const request: AntRequest = (options, info) => {
    const recorded = { options, info, own: ownOptions(options) }
    const uid = (options.file as { uid?: string }).uid
    if (uid) requests.current.set(uid, recorded)
    return send(recorded) as ReturnType<AntRequest>
  }

  const retry = (file: UploadFile) => {
    const recorded = requests.current.get(file.uid)
    if (!recorded) return
    // 先把这一项改回「上传中」（antd 按 uid 更新列表），再用同样的参数重新请求
    recorded.options.onProgress?.({ percent: 0 })
    retried.current.set(file.uid, send(recorded))
  }

  const remove = async (file: UploadFile, index: number) => {
    const result = await onRemove?.(file)
    if (result === false) return
    antdRef.current?.upload?.abort(
      file as unknown as Parameters<NonNullable<AntUploadRef['upload']>['abort']>[0],
    )
    retried.current.get(file.uid)?.abort?.()
    retried.current.delete(file.uid)
    requests.current.delete(file.uid)
    focusAfterRemove.current = index
    const next = latest.current.filter((f) => f.uid !== file.uid)
    emit({ file: { ...file, status: 'removed' }, fileList: next })
  }

  // rc-upload 按下按钮打开对话框时会让按钮失焦（焦点落到 body 上）；对话框关闭后焦点应回到按钮上
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const button = (e.target as Element).closest?.('.ant-upload button')
    if (button instanceof HTMLElement && document.activeElement !== button) button.focus()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    if (!target.closest('.ant-upload')) return
    // 拖放区是 role="button" 的元素，rc-upload 只响应 Enter：空格也要能打开对话框
    if (e.key === ' ' && target.getAttribute('role') === 'button') {
      e.preventDefault()
      target.click()
    }
    // 在触发按钮上按 Enter：rc-upload 在 keydown 中直接打开对话框并让按钮失焦，浏览器随后不再产生 click。
    // 把焦点还给按钮，并阻止默认行为（否则按钮重新获得焦点后，同一次按键又会点击它、再打开一次对话框）
    if (e.key === 'Enter' && target.tagName === 'BUTTON' && document.activeElement !== target) {
      e.preventDefault()
      target.focus()
    }
  }

  const upload = (
    <AntUpload
      {...(rest as Record<string, unknown>)}
      ref={antdRef}
      type={drag ? 'drag' : 'select'}
      // 拖放区本身是可聚焦的按钮元素（与 antd 的 Upload.Dragger 相同）；选择文件时由其中的按钮获得焦点
      hasControlInside={!drag}
      disabled={disabled}
      // 由 beforeUpload 校验类型：antd 只在拖入时过滤且不通知，点选时不过滤；input 仍带 accept 供对话框筛选
      accept={accept ? { format: accept, filter: 'native' } : undefined}
      action={action}
      fileList={list as AnyFile[]}
      beforeUpload={mergedBeforeUpload}
      customRequest={hasTransport ? request : undefined}
      onChange={(info) => emit(info as unknown as UploadChangeInfo)}
      showUploadList={false}
    >
      {children}
    </AntUpload>
  )

  const fileList =
    showUploadList && list.length > 0 ? (
      <ul ref={listRef} className={styles.list} aria-label={t('upload.list')}>
        {list.map((file, index) => (
          <li key={file.uid} data-status={file.status ?? 'selected'}>
            <FileRow
              file={file}
              canRetry={file.status === 'error' && requests.current.has(file.uid)}
              canRemove={!disabled}
              onPreview={rest.onPreview}
              onRetry={() => retry(file)}
              onRemove={() => remove(file, index)}
            />
          </li>
        ))}
      </ul>
    ) : null

  return { upload, fileList, rootRef, onClick, onKeyDown }
}

function FileRow(props: {
  readonly file: UploadFile
  readonly canRetry: boolean
  readonly canRemove: boolean
  readonly onPreview: ((file: UploadFile) => void) | undefined
  readonly onRetry: () => void
  readonly onRemove: () => void
}) {
  const t = useT()
  const { file } = props
  const status = file.status
  const percent = Math.round(file.percent ?? 0)
  const isImage = file.type?.startsWith('image/')
  const leading =
    status === 'uploading' ? (
      <span className={styles.spin}>
        <Icon name="loader" tone="accent" />
      </span>
    ) : status === 'error' ? (
      <Icon name="alert" tone="danger" />
    ) : (
      <Icon name={isImage ? 'file-image' : 'attach'} tone="tertiary" />
    )
  // 文件名：有 onPreview 时是按钮；有地址时是新窗口打开的链接（不带来源页信息）；否则是文字
  const name = props.onPreview ? (
    <button
      type="button"
      className={styles.name}
      title={file.name}
      onClick={() => props.onPreview?.(file)}
    >
      {file.name}
    </button>
  ) : file.url ? (
    <a
      className={styles.name}
      href={file.url}
      target="_blank"
      rel="noopener noreferrer"
      title={file.name}
    >
      {file.name}
    </a>
  ) : (
    <span title={file.name}>{file.name}</span>
  )
  const description =
    status === 'uploading' ? (
      <span className={styles.progress}>
        <Progress percent={percent} size="sm" showValue={false} aria-label={file.name} />
      </span>
    ) : status === 'error' ? (
      <Text tone="danger" size="sm">
        {t('upload.failed')}
      </Text>
    ) : file.size !== undefined ? (
      <Text tone="tertiary" size="sm" numeric>
        {formatSize(file.size)}
      </Text>
    ) : undefined
  return (
    <ListItem
      density="compact"
      leading={leading}
      title={name}
      description={description}
      meta={status === 'uploading' ? `${percent}%` : undefined}
      actions={
        props.canRetry || props.canRemove ? (
          <>
            {props.canRetry && (
              <IconButton
                icon="refresh"
                size="sm"
                label={t('upload.retry')}
                onClick={props.onRetry}
              />
            )}
            {props.canRemove && (
              <IconButton
                icon="close"
                size="sm"
                label={t('upload.remove')}
                data-vl-upload-remove=""
                onClick={props.onRemove}
              />
            )}
          </>
        ) : undefined
      }
    />
  )
}

function UploadRoot(props: UploadProps) {
  const { upload, fileList, rootRef, onClick, onKeyDown } = useUpload(props)
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: 只是为了修正内部按钮的焦点与空格键，交互元素是其中的按钮
    <div ref={rootRef} className={styles.root} onClick={onClick} onKeyDown={onKeyDown}>
      {upload}
      {fileList}
    </div>
  )
}

/** 拖动的内容里是否有文件（拖动页面上的文字、链接时不提示投放）。 */
const hasFiles = (e: DragEvent) => [...(e.dataTransfer?.types ?? [])].includes('Files')

function UploadDropzone({ title, hint, children, ...rest }: UploadDropzoneProps) {
  const t = useT()
  const [over, setOver] = useState(false)
  // dragenter / dragleave 在经过子元素时成对触发：按层数计数，离开最外层才算拖出（不闪烁）
  const depth = useRef(0)
  const { upload, fileList, rootRef, onClick, onKeyDown } = useUpload({
    ...rest,
    drag: true,
    children: children ?? (
      <span className={styles.dropContent}>
        <span className={styles.dropIcon}>
          <Icon name="upload" size={24} />
        </span>
        <Text weight="medium">
          {over ? t('upload.dropzone.drop') : (title ?? t('upload.dropzone.title'))}
        </Text>
        {hint && (
          <Text size="sm" tone="tertiary">
            {hint}
          </Text>
        )}
      </span>
    ),
  })
  const disabled = Boolean(rest.disabled)
  const reset = () => {
    depth.current = 0
    setOver(false)
  }
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: 只是为了修正内部按钮的焦点与空格键，交互元素是其中的按钮
    <div ref={rootRef} className={styles.root} onClick={onClick} onKeyDown={onKeyDown}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: 只监听拖放以切换外观，投放与点击由其中 antd 的按钮元素处理 */}
      <div
        className={styles.dropzone}
        data-vl-state=""
        data-drag-over={over || undefined}
        data-disabled={disabled || undefined}
        onDragEnter={(e) => {
          if (disabled || !hasFiles(e)) return
          depth.current++
          setOver(true)
        }}
        onDragLeave={() => {
          if (depth.current === 0) return
          depth.current--
          if (depth.current === 0) setOver(false)
        }}
        onDrop={reset}
      >
        {upload}
      </div>
      {fileList}
    </div>
  )
}

/** Upload 及其静态成员。 */
export interface UploadComponent {
  /** 渲染上传：触发元素与文件列表。 */
  (props: UploadProps): JSX.Element
  /** 拖放区：把文件拖到区域内，或点击、按 Enter / 空格选择。 */
  readonly Dropzone: (props: UploadDropzoneProps) => JSX.Element
}

/**
 * Chooses files and shows them in a list with their progress. Upload does not send requests by itself: set
 * `customRequest` (your own request with `onProgress` / `onSuccess` / `onError`) or `action` (an address that
 * receives a POST); without either, files are only added to the list, for example to be sent with a form. Use
 * `Upload.Dropzone` for a drop area.
 *
 * By default every file type is accepted and there is no size limit: set `accept` and `maxSize` (also check them
 * on the server), and handle rejected files with `onReject`.
 *
 * **Interaction**: pressing the trigger opens the file dialog and focus stays on the trigger. In the list, failed
 * files show "Upload failed" and a "Retry" button that sends the same request again; "Remove" cancels an upload in
 * progress, and focus moves to the next file (or back to the trigger when the list is empty). The drop area has a
 * filled background with a dashed outline (the outline marks where files can be dropped); while files are dragged
 * over it, it turns to a subtle accent background with an accent outline. It is focusable with `Tab`, and `Enter` /
 * `Space` open the file dialog.
 * @zh 上传：选择文件并在列表中显示进度。组件自己不发请求：设置 `customRequest`（使用方自己的请求，通过 `onProgress` /
 * `onSuccess` / `onError` 汇报）或 `action`（接收 POST 的地址）；两者都没有时只把文件加入列表，例如随表单一起提交。
 * 拖放区用 `Upload.Dropzone`。
 *
 * 默认接受所有类型、不限制大小：请设置 `accept` 与 `maxSize`（服务端也要校验），被拒绝的文件用 `onReject` 处理。
 *
 * **交互**：按下触发元素打开选择文件的对话框，焦点留在触发元素上。列表中上传失败的文件显示「上传失败」与「重试」按钮，
 * 重试用同样的参数重新请求；「移除」会取消进行中的上传，焦点移到下一个文件（列表空了就回到触发元素）。拖放区为填充底与
 * 虚线轮廓（虚线表示可以投放的区域），文件拖到上面时变为强调色浅底与强调色轮廓；可以用 `Tab` 聚焦，`Enter` / 空格
 * 打开选择文件的对话框。
 * @category Basic
 * @usage Attachments of a form, importing a file, uploading images
 * @usageZh 表单附件、导入文件、上传图片
 */
export const Upload: UploadComponent = /* @__PURE__ */ Object.assign(UploadRoot, {
  Dropzone: UploadDropzone,
})
