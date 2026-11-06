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
import type { UploadChangeParam as AntUploadChangeParam } from 'antd/es/upload/index.js'
import {
  type DragEvent,
  type JSX,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type Ref,
  type RefAttributes,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useT } from '../i18n/index.ts'
import { IconButton } from './Extras.tsx'
import { fileRejectReason, formatSize } from './fileRules.ts'
import { Icon } from './Icon.tsx'
import type { AnyValue, StyleKeys } from './internal.ts'
import { ListItem } from './items.tsx'
import { Progress } from './Progress.tsx'
import { Text } from './Text.tsx'
import styles from './upload.module.css'

/** 列表中的一个文件：`uid`、`name`、`status`（`uploading` / `done` / `error`）、`percent`、`response` 等。 */
export type UploadFile<T = AnyValue> = AntUploadFile<T>

/** `onChange` 的参数：变化的文件与变化后的完整列表。 */
export type UploadChangeParam<T = AnyValue> = AntUploadChangeParam<UploadFile<T>>

/** 上传组件的引用（antd 的 UploadRef）。 */
export type UploadRef<T = AnyValue> = AntUploadRef<T>

/** `customRequest` 收到的请求参数：`file`、`action`、`data`、`headers` 与 `onProgress` / `onSuccess` / `onError`。 */
export type UploadRequestOptions = Parameters<NonNullable<AntUploadProps['customRequest']>>[0]

/** 文件被拒绝的原因：`type` 不符合 `accept`，`size` 超过 `maxSize`。 */
export type UploadRejectReason = 'type' | 'size'

/** antd 中由本组件接管或不提供的属性（文件列表自己渲染；接受的类型、请求由本组件处理）。 */
type UploadOwnKeys =
  | 'type'
  | 'accept'
  | 'listType'
  | 'showUploadList'
  | 'itemRender'
  | 'iconRender'
  | 'isImageUrl'
  | 'previewFile'
  | 'progress'
  | 'locale'
  | 'onDownload'
  | 'children'

/**
 * Props of Upload.
 * @zh Upload 属性。
 */
export interface UploadProps<T = AnyValue>
  extends Omit<AntUploadProps<T>, StyleKeys | UploadOwnKeys>,
    RefAttributes<UploadRef<T>> {
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
}

/**
 * Props of Upload.Dropzone.
 * @zh Upload.Dropzone 属性。
 */
export interface UploadDropzoneProps<T = AnyValue> extends Omit<UploadProps<T>, 'children'> {
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
  readonly options: UploadRequestOptions
  readonly info: Parameters<NonNullable<AntUploadProps['customRequest']>>[1]
}

/** 请求函数的返回值：可能带 `abort()`（antd 的默认请求），也可能什么都不返回。 */
type Aborter = { abort?: () => void } | undefined

interface InternalProps<T> extends UploadProps<T> {
  /** 渲染为拖放区。 */
  readonly drag?: boolean
}

function useUpload<T>(props: InternalProps<T>) {
  const {
    accept,
    maxSize,
    onReject,
    showUploadList = true,
    beforeUpload,
    customRequest,
    action,
    fileList: controlledList,
    defaultFileList,
    onChange,
    onRemove,
    ref,
    disabled,
    drag,
    children,
    ...rest
  } = props
  const t = useT()
  const [innerList, setInnerList] = useState<UploadFile<T>[]>(defaultFileList ?? [])
  const list = controlledList ?? innerList
  // 请求回调与移除在异步中执行：总是读取最新的列表
  const latest = useRef(list)
  latest.current = list
  const antdRef = useRef<UploadRef<T> | null>(null)
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

  const emit = (info: UploadChangeParam<T>) => {
    if (controlledList === undefined) setInnerList(info.fileList)
    onChange?.(info)
  }

  const mergedBeforeUpload: AntUploadProps<T>['beforeUpload'] = async (file, files) => {
    const reason: UploadRejectReason | null = fileRejectReason(file, { accept, maxSize })
    if (reason) {
      onReject?.(file, reason)
      return AntUpload.LIST_IGNORE
    }
    const result = beforeUpload ? await beforeUpload(file, files) : true
    if (result === false || result === AntUpload.LIST_IGNORE) return result
    // 没有指定上传方式：只加入列表，不发请求（antd 默认会向当前页面地址 POST）
    if (!hasTransport) return false
    return result
  }

  // 请求总是经过这里：记下参数以便失败后重试；实际的请求是使用方的 customRequest，或 antd 向 action 发出的默认请求
  const request: AntUploadProps<T>['customRequest'] = (options, info) => {
    const uid = (options.file as { uid?: string }).uid
    if (uid) requests.current.set(uid, { options, info })
    return customRequest ? customRequest(options, info) : info.defaultRequest(options)
  }

  const retry = (file: UploadFile<T>) => {
    const recorded = requests.current.get(file.uid)
    if (!recorded) return
    // 先把这一项改回「上传中」（antd 按 uid 更新列表），再用同样的参数重新请求
    recorded.options.onProgress?.({ percent: 0 })
    const run = customRequest ?? recorded.info.defaultRequest
    retried.current.set(file.uid, run(recorded.options, recorded.info) as Aborter)
  }

  const remove = async (file: UploadFile<T>, index: number) => {
    const result = await onRemove?.(file)
    if (result === false) return
    antdRef.current?.upload?.abort(file as Parameters<NonNullable<UploadRef['upload']>['abort']>[0])
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
    <AntUpload<T>
      {...rest}
      ref={(r: UploadRef<T> | null) => {
        antdRef.current = r
        assignRef(ref, r)
      }}
      type={drag ? 'drag' : 'select'}
      // 拖放区本身是可聚焦的按钮元素（与 antd 的 Upload.Dragger 相同）；选择文件时由其中的按钮获得焦点
      hasControlInside={rest.hasControlInside ?? !drag}
      disabled={disabled}
      // 由 beforeUpload 校验类型：antd 只在拖入时过滤且不通知，点选时不过滤；input 仍带 accept 供对话框筛选
      accept={accept ? { format: accept, filter: 'native' } : undefined}
      action={action}
      fileList={list}
      beforeUpload={mergedBeforeUpload}
      customRequest={hasTransport ? request : undefined}
      onChange={emit}
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

function assignRef<V>(ref: Ref<V> | undefined, value: V | null) {
  if (typeof ref === 'function') ref(value)
  else if (ref) ref.current = value
}

function FileRow<T>(props: {
  readonly file: UploadFile<T>
  readonly canRetry: boolean
  readonly canRemove: boolean
  readonly onPreview: ((file: UploadFile<T>) => void) | undefined
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
        <Progress percent={percent} size="small" showInfo={false} aria-label={file.name} />
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

function UploadRoot<T = AnyValue>(props: UploadProps<T>) {
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

function UploadDropzone<T = AnyValue>({ title, hint, children, ...rest }: UploadDropzoneProps<T>) {
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
  <T = AnyValue>(props: UploadProps<T>): JSX.Element
  /** 拖放区：把文件拖到区域内，或点击、按 Enter / 空格选择。 */
  readonly Dropzone: <T = AnyValue>(props: UploadDropzoneProps<T>) => JSX.Element
  /** 在 `beforeUpload` 中返回它：这个文件不加入列表。 */
  readonly LIST_IGNORE: string
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
  LIST_IGNORE: AntUpload.LIST_IGNORE,
})
