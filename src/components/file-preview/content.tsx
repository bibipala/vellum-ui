/**
 * 文件预览中图片以外的内容：文本（代码、JSON、Markdown）、视频、音频，以及不能预览时的文件卡片。
 * 弹出式与嵌入式共用；外观差别（弹出时放在一张「纸」上）由外层的 data-mode 决定。
 */
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { useT } from '../../i18n/index.ts'
import { Markdown } from '../ai/Markdown.tsx'
import { Button } from '../basic.tsx'
import { CopyButton } from '../CopyButton.tsx'
import { EmptyState, Loading } from '../feedback.tsx'
import { formatSize } from '../fileRules.ts'
import styles from './file-preview.module.css'
import {
  BinaryContentError,
  formatJson,
  kindIcon,
  type PreviewKind,
  readText,
  TEXT_LIMIT,
  type TextResult,
} from './kind.ts'

/** 一个文件：FilePreviewItem 中这里用到的字段。 */
export interface ContentItem {
  readonly id: string
  readonly name: string
  readonly src?: string
  readonly file?: Blob
  readonly type?: string
  readonly size?: number
  readonly content?: string
}

/** 文件的地址：`src`，或为 `file` 创建的对象地址（不再显示时释放）。 */
export function useItemUrl(item: ContentItem): string | undefined {
  const [made, setMade] = useState<{ readonly file: Blob; readonly url: string } | null>(null)
  useEffect(() => {
    if (item.src || !item.file) return
    const url = URL.createObjectURL(item.file)
    setMade({ file: item.file, url })
    return () => URL.revokeObjectURL(url)
  }, [item.src, item.file])
  return item.src || (made && made.file === item.file ? made.url : undefined)
}

/** 文件大小：`size`，或 `file` 的大小。 */
export const sizeOf = (item: ContentItem) => item.size ?? item.file?.size

/** 不能预览、加载失败时的文件卡片：图标、文件名、大小与说明，可以下载或重试。 */
export function FileCard(props: {
  readonly item: ContentItem
  readonly kind: PreviewKind
  readonly reason: 'unsupported' | 'failed'
  readonly onDownload?: () => void
  readonly onRetry?: () => void
}) {
  const t = useT()
  const size = sizeOf(props.item)
  const message = props.reason === 'failed' ? t('filePreview.failed') : t('filePreview.unsupported')
  return (
    <div className={styles.card} data-fp-no-gesture="">
      <EmptyState
        icon={kindIcon(props.item, props.kind)}
        title={<span className={styles.cardName}>{props.item.name}</span>}
        description={size === undefined ? message : `${formatSize(size)} · ${message}`}
        action={
          props.onRetry || props.onDownload ? (
            <span className={styles.cardActions}>
              {props.onRetry && <Button onClick={props.onRetry}>{t('filePreview.retry')}</Button>}
              {props.onDownload && (
                <Button onClick={props.onDownload}>{t('filePreview.download')}</Button>
              )}
            </span>
          ) : undefined
        }
      />
    </div>
  )
}

type TextState =
  | { readonly status: 'loading' }
  | { readonly status: 'done'; readonly result: TextResult }
  | { readonly status: 'error'; readonly binary: boolean }

/** 文本：只读开头 256 KB，读到后按种类显示（JSON 排版，Markdown 渲染，其余按原样等宽显示）。 */
export function TextContent(props: {
  readonly item: ContentItem
  readonly kind: 'markdown' | 'json' | 'text'
  readonly onDownload?: () => void
}) {
  const t = useT()
  const { item, kind } = props
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<TextState>({ status: 'loading' })
  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt 是重试的触发条件
  useEffect(() => {
    const controller = new AbortController()
    setState({ status: 'loading' })
    readText(item, controller.signal).then(
      (result) => {
        if (!controller.signal.aborted) setState({ status: 'done', result })
      },
      (error: unknown) => {
        if (!controller.signal.aborted)
          setState({ status: 'error', binary: error instanceof BinaryContentError })
      },
    )
    return () => controller.abort()
  }, [item.content, item.file, item.src, attempt])

  if (state.status === 'loading')
    return (
      <div className={styles.textLoading}>
        <Loading fill />
      </div>
    )
  if (state.status === 'error')
    return (
      <FileCard
        item={item}
        kind={state.binary ? 'other' : kind}
        reason={state.binary ? 'unsupported' : 'failed'}
        onRetry={state.binary ? undefined : () => setAttempt((n) => n + 1)}
        onDownload={props.onDownload}
      />
    )
  const { text, truncated, total } = state.result
  const shown = kind === 'json' && !truncated ? formatJson(text) : text
  return (
    <div className={styles.text} data-kind={kind}>
      {truncated && (
        <div className={styles.notice} role="note">
          {t('filePreview.truncated', {
            size: formatSize(TEXT_LIMIT),
            total: total === undefined ? '?' : formatSize(total),
          })}
        </div>
      )}
      {kind === 'markdown' ? (
        <div className={styles.markdown}>
          <Markdown content={shown} />
        </div>
      ) : (
        <>
          <span className={styles.copy}>
            <CopyButton text={shown} size="sm" />
          </span>
          <pre className={styles.code} data-wrap={(kind === 'text' && isProse(item)) || undefined}>
            <code>{shown}</code>
          </pre>
        </>
      )}
    </div>
  )
}

/** 按行阅读的文本（纯文本、日志）自动换行；代码与数据保持原样，横向滚动。 */
const isProse = (item: ContentItem) => /\.(txt|log)$/i.test(item.name) || !/\.\w+$/.test(item.name)

/** 视频：浏览器自带的播放控件；不再是当前项时暂停。 */
export function VideoContent(props: {
  readonly src: string
  readonly name: string
  readonly active: boolean
  readonly failed: ReactNode
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    if (!props.active) ref.current?.pause()
  }, [props.active])
  if (error) return props.failed
  return (
    <div className={styles.media}>
      {/* biome-ignore lint/a11y/useMediaCaption: 用户自己的文件，没有字幕轨道可提供 */}
      <video
        ref={ref}
        className={styles.video}
        src={props.src}
        controls
        playsInline
        preload="metadata"
        aria-label={props.name}
        data-fp-no-gesture=""
        onError={() => setError(true)}
      />
    </div>
  )
}

/** 音频：文件卡片加上浏览器自带的播放控件；不再是当前项时暂停。 */
export function AudioContent(props: {
  readonly item: ContentItem
  readonly src: string
  readonly active: boolean
  readonly failed: ReactNode
}) {
  const ref = useRef<HTMLAudioElement>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    if (!props.active) ref.current?.pause()
  }, [props.active])
  if (error) return props.failed
  const size = sizeOf(props.item)
  return (
    <div className={styles.card} data-fp-no-gesture="">
      <EmptyState
        icon={kindIcon(props.item, 'audio')}
        title={<span className={styles.cardName}>{props.item.name}</span>}
        description={size === undefined ? undefined : formatSize(size)}
        action={
          // biome-ignore lint/a11y/useMediaCaption: 用户自己的文件，没有字幕轨道可提供
          <audio
            ref={ref}
            className={styles.audio}
            src={props.src}
            controls
            preload="metadata"
            aria-label={props.item.name}
            onError={() => setError(true)}
          />
        }
      />
    </div>
  )
}
