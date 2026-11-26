/**
 * 文件预览：弹出式（铺满窗口的查看器，类似「快速查看」）与嵌入式（FilePreview.Inline，放在页面中的一块区域）。
 *
 * 弹出式的结构：背景层、工具栏、舞台。舞台里是一条横向的轨道，当前项与前后各一项并排放在轨道上（相邻的项预先渲染，
 * 图片随之预加载）。换项时轨道沿弹簧滑过去：序号改变的同一帧里，先把轨道挪回「还停在上一项」的位置，再过渡到新位置，
 * 所以按键、按钮、拖动松手都是同一种连续的滑动，也可以在滑动途中再换。
 *
 * 手势（指针事件，鼠标与触屏相同）：放大时拖动平移；放得下时横向拖动换项、纵向拖动关闭（背景随距离变淡）；双指缩放；
 * 双击（双击触屏）在放得下与实际大小之间切换；滚轮缩放。点击图片以外的空白处关闭。
 *
 * 从缩略图打开：打开前最后按下（或聚焦）的元素如果带着图片，图片从它的位置飞入；关闭时飞回当前项的缩略图
 * （带 `data-vl-preview-id` 的元素，ImageGrid 的格子自带），找不到或不在视口中时淡出。
 */
import { ConfigProvider } from 'antd'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  File as FileIcon,
  FileImage,
  FileMusic,
  FilePlay,
  FileText,
  Maximize2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import {
  type CSSProperties,
  type JSX,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { type MessageKey, useT } from '../../i18n/index.ts'
import { useViewerStage } from '../../theme/context.ts'
import { type ViewerStage, viewerStages } from '../../tokens/viewer-stage.ts'
import { IconButton } from '../Extras.tsx'
import { FocusScope } from '../FocusScope.tsx'
import { EmptyState } from '../feedback.tsx'
import { formatSize } from '../fileRules.ts'
import { Glyph, type IconComponent } from '../glyph.tsx'
import { useReducedMotion } from '../useReducedMotion.ts'
import {
  AudioContent,
  FileCard,
  sizeOf,
  TextContent,
  useItemUrl,
  VideoContent,
} from './content.tsx'
import styles from './file-preview.module.css'
import { useGestures } from './gestures.ts'
import {
  type FlightRect,
  ImageView,
  type ImageViewHandle,
  type Placeholder,
  springMs,
  type ZoomInfo,
} from './ImageView.tsx'
import { type PreviewKind, previewKind } from './kind.ts'

/**
 * A file shown by FilePreview. Give `src` (an address) or `file` (a `File` or `Blob` in memory); text that is already
 * in memory can be given as `content`.
 * @zh FilePreview 显示的一个文件。给出 `src`（地址）或 `file`（内存中的 `File` 或 `Blob`）；已经在内存中的文本可以用
 * `content` 直接给出。
 */
export interface FilePreviewItem {
  /**
   * Unique ID. Thumbnails with the same ID in `data-vl-preview-id` (the tiles of ImageGrid have it) are where images
   * fly in from and back to.
   * @zh 唯一标识。`data-vl-preview-id` 为同一标识的缩略图（ImageGrid 的格子自带）是图片飞入、飞回的位置。
   */
  readonly id: string
  /**
   * File name, shown in the toolbar; its extension also decides how the file is shown when `type` is omitted.
   * @zh 文件名，显示在工具栏中；省略 `type` 时也按它的扩展名决定显示方式。
   */
  readonly name: string
  /**
   * Address of the file.
   * @zh 文件的地址。
   */
  readonly src?: string
  /**
   * The file in memory (such as a file the user picked); an object URL is created for it while it is shown and
   * released afterwards.
   * @zh 内存中的文件（如用户选择的文件）；显示期间为它创建对象地址，不再显示时释放。
   */
  readonly file?: Blob
  /**
   * MIME type, such as `image/png`; taken from `file`, or guessed from the extension of `name`, when omitted.
   * @zh MIME 类型，如 `image/png`；省略时取 `file` 的类型，或按 `name` 的扩展名判断。
   */
  readonly type?: string
  /**
   * Size in bytes, shown in the toolbar; taken from `file` when omitted.
   * @zh 大小（字节），显示在工具栏中；省略时取 `file` 的大小。
   */
  readonly size?: number
  /**
   * The text of a text file, when it is already in memory (such as a response body); used instead of loading
   * `src`.
   * @zh 文本文件的内容，已经在内存中时（如接口返回的内容）直接给出，不再加载 `src`。
   */
  readonly content?: string
  /**
   * Alternative text of an image, read by screen readers; the file name when omitted.
   * @zh 图片的替代文字，供读屏读出；省略时用文件名。
   */
  readonly alt?: string
}

/** 弹出式与嵌入式共有的属性。 */
interface SharedProps {
  /**
   * Your own buttons in the toolbar for the file shown, such as "Share" or "Show in folder"; use IconButton.
   * @zh 工具栏中针对当前文件的自定义按钮，如「分享」「在文件夹中显示」；用 IconButton。
   */
  readonly actions?: (item: FilePreviewItem) => ReactNode
  /**
   * Shows a "Download" button and is called when it is pressed; the application decides how to save the file
   * (a link with `download` in the browser, a save dialog in a desktop client). No button when omitted.
   * @zh 显示「下载」按钮，按下时调用；如何保存文件由应用决定（浏览器中用带 `download` 的链接，桌面客户端中用保存对话框）。
   * 不传时没有这个按钮。
   */
  readonly onDownload?: (item: FilePreviewItem) => void
  /**
   * Shows a file in your own way, such as PDF with a PDF library: return the content, or `undefined` to use the
   * built-in preview. The content fills the preview area; gestures (swiping, dragging to close) do not start on it.
   * @zh 用自己的方式显示文件，如用 PDF 库显示 PDF：返回内容，或返回 `undefined` 使用内置的预览。内容铺满预览区域，
   * 在其上不会开始手势（滑动换项、拖动关闭）。
   */
  readonly render?: (item: FilePreviewItem) => ReactNode
}

interface FilePreviewOwnProps extends SharedProps {
  /**
   * Whether the preview is open.
   * @zh 是否打开。
   */
  readonly open: boolean
  /**
   * Files to switch between.
   * @zh 可切换的文件列表。
   */
  readonly items: readonly FilePreviewItem[]
  /**
   * Index of the file shown (controlled).
   * @zh 当前显示的文件序号（受控）。
   */
  readonly index: number
  /**
   * Called when switching to another file; without it, the files cannot be switched.
   * @zh 切换文件时调用；不传时不能切换。
   */
  readonly onIndexChange?: (index: number) => void
  /**
   * Called when closing (`Esc`, the close button, clicking outside the file, dragging it away).
   * @zh 关闭时调用（`Esc`、关闭按钮、点击文件以外的地方、把文件拖走）。
   */
  readonly onClose: () => void
  /**
   * Fixed viewer background; when omitted, the viewer background from ThemeProvider is used and can be changed in
   * the toolbar.
   * @zh 指定看图背景；省略时使用 ThemeProvider 中的看图背景，并可在工具栏切换。
   */
  readonly stage?: ViewerStage
  /**
   * Accessible name of the dialog; "File preview" when omitted.
   * @zh 对话框的读屏名称；不传时为「文件预览」。
   */
  readonly 'aria-label'?: string
  /**
   * Test id, rendered as `data-testid` on the dialog.
   * @zh 测试定位，输出为对话框的 `data-testid`。
   */
  readonly testId?: string
}

/**
 * Props of FilePreview.
 * @zh FilePreview 属性。
 */
export interface FilePreviewProps extends FilePreviewOwnProps {}

interface FilePreviewInlineOwnProps extends SharedProps {
  /**
   * The file shown; `null` shows "No file selected".
   * @zh 显示的文件；为 `null` 时显示「未选择文件」。
   */
  readonly item: FilePreviewItem | null
  /**
   * Shows a "Full screen" button that opens the file in the full-window preview (images fly out of the area and back).
   * @zh 显示「全屏查看」按钮，在铺满窗口的预览中打开（图片从区域中飞出、关闭时飞回）。
   * @default true
   */
  readonly expandable?: boolean
  /**
   * Accessible name of the area; the file name when omitted.
   * @zh 区域的读屏名称；不传时用文件名。
   */
  readonly 'aria-label'?: string
  /**
   * Test id, rendered as `data-testid`.
   * @zh 测试定位，输出为 `data-testid`。
   */
  readonly testId?: string
}

/**
 * Props of FilePreview.Inline.
 * @zh FilePreview.Inline 属性。
 */
export interface FilePreviewInlineProps extends FilePreviewInlineOwnProps {}

/** 文字的键：FilePreview 与 Lightbox 用各自的文字（Lightbox 说「上一张」，FilePreview 说「上一个」）。 */
interface Texts {
  readonly label: MessageKey
  readonly close: MessageKey
  readonly prev: MessageKey
  readonly next: MessageKey
  readonly counter: MessageKey
}

const fileTexts: Texts = {
  label: 'filePreview.label',
  close: 'filePreview.close',
  prev: 'filePreview.prev',
  next: 'filePreview.next',
  counter: 'filePreview.counter',
}

/** Lightbox 的文字。 */
export const imageTexts: Texts = {
  label: 'lightbox.label',
  close: 'lightbox.close',
  prev: 'lightbox.prev',
  next: 'lightbox.next',
  counter: 'lightbox.counter',
}

/** 轨道上相邻两项之间的空隙（像素）：滑动时看得出是两张。 */
const GAP = 24
/** 图片停留不动多久后隐藏工具栏（毫秒）。 */
const IDLE_MS = 2500
const SPRING = 'var(--vl-motion-duration-spring) var(--vl-motion-ease-spring)'

// ———————————————————————————————— 缩略图（飞入、飞回的位置） ————————————————————————————————

/** 最近一次按下的元素与时间：点击打开预览时，焦点不一定在被点的元素上（WebKit 中按钮点击后不获得焦点）。 */
const lastPress: { target: Element | null; time: number } = { target: null, time: 0 }
let pressListeners = 0
const onPress = (e: Event) => {
  lastPress.target = e.target instanceof Element ? e.target : null
  lastPress.time = performance.now()
}

function useLastPress() {
  useEffect(() => {
    if (pressListeners++ === 0) document.addEventListener('pointerdown', onPress, true)
    return () => {
      if (--pressListeners === 0) document.removeEventListener('pointerdown', onPress, true)
    }
  }, [])
}

/** 打开预览的元素：一秒内按下的元素，否则是当前的焦点。 */
function currentTrigger(): Element | null {
  if (lastPress.target?.isConnected && performance.now() - lastPress.time < 1000)
    return lastPress.target
  return document.activeElement
}

function inViewport(el: Element): boolean {
  const r = el.getBoundingClientRect()
  return (
    r.width > 0 &&
    r.height > 0 &&
    r.bottom > 0 &&
    r.right > 0 &&
    r.top < window.innerHeight &&
    r.left < window.innerWidth
  )
}

/**
 * 当前项的缩略图：打开它的元素（或其所在的、标识相同的 `data-vl-preview-id` 元素）；否则是页面上标识相同的元素。
 * 打开它的元素没有标识时，只有其中有图片才算。
 */
function findOrigin(
  id: string,
  trigger: Element | null,
  exclude: Element | null,
): HTMLElement | null {
  const usable = (el: Element | null | undefined): el is HTMLElement =>
    el instanceof HTMLElement && el.isConnected && !exclude?.contains(el) && inViewport(el)
  const tagged = trigger?.closest('[data-vl-preview-id]')
  if (tagged?.getAttribute('data-vl-preview-id') === id && usable(tagged)) return tagged
  for (const el of document.querySelectorAll(`[data-vl-preview-id="${CSS.escape(id)}"]`))
    if (usable(el)) return el
  if (
    !tagged &&
    usable(trigger) &&
    (trigger instanceof HTMLImageElement || trigger.querySelector('img'))
  )
    return trigger
  return null
}

function flightRect(el: HTMLElement): FlightRect {
  const r = el.getBoundingClientRect()
  const radius = Number.parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0
  return { left: r.left, top: r.top, width: r.width, height: r.height, radius }
}

function placeholderOf(el: HTMLElement): Placeholder | undefined {
  const img = el instanceof HTMLImageElement ? el : el.querySelector('img')
  if (!img?.complete || img.naturalWidth === 0) return undefined
  return { src: img.currentSrc || img.src, width: img.naturalWidth, height: img.naturalHeight }
}

/**
 * 飞行期间把缩略图藏起来，看上去就是它本身被拿起、放回。用透明度而不是 visibility：关闭时焦点要回到它上面，
 * visibility: hidden 的元素不能获得焦点。
 */
function hide(el: HTMLElement): () => void {
  const previous = el.style.opacity
  el.style.opacity = '0'
  return () => {
    el.style.opacity = previous
  }
}

// ———————————————————————————————— 一项的内容 ————————————————————————————————

interface SlideContentProps {
  readonly item: FilePreviewItem
  readonly kind: PreviewKind
  readonly active: boolean
  readonly imageRef?: RefObject<ImageViewHandle | null>
  readonly placeholder?: Placeholder
  readonly intro?: FlightRect
  readonly onIntroEnd?: () => void
  readonly onZoomChange?: (zoom: ZoomInfo) => void
  readonly onDownload?: () => void
  readonly render?: (item: FilePreviewItem) => ReactNode
  readonly previewId?: string
}

function SlideContent(props: SlideContentProps) {
  const { item, kind } = props
  const src = useItemUrl(item)
  const custom = props.render?.(item)
  const failed = <FileCard item={item} kind={kind} reason="failed" onDownload={props.onDownload} />
  if (custom !== undefined)
    return (
      <div className={styles.custom} data-fp-no-gesture="">
        {custom}
      </div>
    )
  if (kind === 'markdown' || kind === 'json' || kind === 'text')
    return (
      <div className={styles.sheet} data-fp-no-gesture="">
        <TextContent item={item} kind={kind} onDownload={props.onDownload} />
      </div>
    )
  if (kind === 'other' || !src)
    return kind === 'other' || (!item.src && !item.file) ? (
      <FileCard item={item} kind={kind} reason="unsupported" onDownload={props.onDownload} />
    ) : null
  if (kind === 'image')
    return (
      <ImageView
        ref={props.imageRef}
        src={src}
        alt={item.alt ?? item.name}
        active={props.active}
        previewId={props.previewId}
        placeholder={props.placeholder}
        intro={props.intro}
        onIntroEnd={props.onIntroEnd}
        onZoomChange={props.onZoomChange}
        failed={failed}
      />
    )
  if (kind === 'video')
    return <VideoContent src={src} name={item.name} active={props.active} failed={failed} />
  return <AudioContent item={item} src={src} active={props.active} failed={failed} />
}

// ———————————————————————————————— 工具栏 ————————————————————————————————

function ZoomControls(props: {
  readonly zoom: ZoomInfo | null
  readonly image: RefObject<ImageViewHandle | null>
}) {
  const t = useT()
  const zoom = props.zoom
  const fitted = !zoom?.canZoomOut
  return (
    <span className={styles.zoom}>
      <IconButton
        icon={ZoomOut}
        label={t('filePreview.zoomOut')}
        disabled={!zoom?.canZoomOut}
        onClick={() => props.image.current?.zoomStep(-1)}
      />
      <button
        type="button"
        className={styles.percent}
        data-vl-state=""
        disabled={!zoom}
        aria-label={fitted ? t('filePreview.actualSize') : t('filePreview.fit')}
        title={fitted ? t('filePreview.actualSize') : t('filePreview.fit')}
        onClick={() => props.image.current?.toggle(null)}
      >
        {zoom ? `${zoom.percent}%` : '—'}
      </button>
      <IconButton
        icon={ZoomIn}
        label={t('filePreview.zoomIn')}
        disabled={!zoom?.canZoomIn}
        onClick={() => props.image.current?.zoomStep(1)}
      />
    </span>
  )
}

function StagePicker(props: {
  readonly current: ViewerStage
  readonly onChange: (s: ViewerStage) => void
}) {
  const t = useT()
  return (
    <fieldset aria-label={t('lightbox.stage')} className={styles.stages}>
      {viewerStages.map((s) => (
        <button
          key={s}
          type="button"
          className={styles.swatch}
          data-stage={s}
          aria-pressed={s === props.current}
          aria-label={t(`lightbox.stage.${s}`)}
          title={t(`lightbox.stage.${s}`)}
          onClick={() => props.onChange(s)}
        />
      ))}
    </fieldset>
  )
}

function meta(item: FilePreviewItem, counter: string | null): string {
  const size = sizeOf(item)
  return [counter, size === undefined ? null : formatSize(size)].filter(Boolean).join(' · ')
}

// ———————————————————————————————— 弹出式 ————————————————————————————————

interface ViewerProps extends FilePreviewOwnProps {
  readonly texts: Texts
}

/** 打开时的飞入：从哪个元素、飞到哪一项。 */
interface Opening {
  readonly index: number
  readonly origin: HTMLElement | null
  readonly trigger: Element | null
  readonly rect?: FlightRect
  readonly placeholder?: Placeholder
}

/** 弹出式的查看器；Lightbox 也用它（只有图片、文字不同）。 */
export function PreviewDialog(props: ViewerProps): JSX.Element | null {
  useLastPress()
  const visible = props.open && props.items[props.index] !== undefined
  const reduced = useReducedMotion()
  const [present, setPresent] = useState(visible)
  const leaving = present && !visible
  // 关闭的过渡期间仍显示关闭前的内容
  const last = useRef({ items: props.items, index: props.index })
  if (visible) last.current = { items: props.items, index: props.index }

  // 打开的那一刻记下打开它的元素与缩略图（渲染时读取：需要在第一次渲染查看器之前）
  const opening = useRef<Opening | null>(null)
  const wasVisible = useRef(false)
  if (visible && !wasVisible.current && !present && typeof document !== 'undefined') {
    const trigger = currentTrigger()
    const item = props.items[props.index]
    const origin = item && previewKind(item) === 'image' ? findOrigin(item.id, trigger, null) : null
    const placeholder = origin ? placeholderOf(origin) : undefined
    opening.current = {
      index: props.index,
      origin,
      trigger,
      rect: origin && placeholder ? flightRect(origin) : undefined,
      placeholder,
    }
  } else if (visible && !wasVisible.current && present) {
    // 关闭途中再次打开：不再飞入
    if (opening.current) opening.current = { ...opening.current, rect: undefined }
  }
  wasVisible.current = visible

  useEffect(() => {
    if (visible) setPresent(true)
    else if (reduced) setPresent(false)
  }, [visible, reduced])

  if (!(visible || present) || typeof document === 'undefined') return null
  const { items, index } = visible ? props : { ...props, ...last.current }
  if (items[index] === undefined) return null
  return createPortal(
    <Viewer
      {...props}
      items={items}
      index={index}
      leaving={leaving}
      reduced={reduced}
      opening={opening}
      onGone={() => setPresent(false)}
    />,
    document.body,
  )
}

interface ViewerInnerProps extends ViewerProps {
  readonly leaving: boolean
  readonly reduced: boolean
  readonly opening: RefObject<Opening | null>
  readonly onGone: () => void
}

function Viewer(props: ViewerInnerProps) {
  const t = useT()
  const viewer = useViewerStage()
  const { items, index, leaving, texts } = props
  const total = items.length
  const item = items[index] as FilePreviewItem
  const kind = previewKind(item)
  const current = props.stage ?? viewer?.stage ?? 'dark'
  const root = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const image = useRef<ImageViewHandle>(null)
  const [width, setWidth] = useState(0)
  const [zoom, setZoom] = useState<(ZoomInfo & { readonly id: string }) | null>(null)
  const reportZoom = useCallback((id: string, next: ZoomInfo) => {
    setZoom((prev) =>
      prev &&
      prev.id === id &&
      prev.percent === next.percent &&
      prev.canZoomIn === next.canZoomIn &&
      prev.canZoomOut === next.canZoomOut
        ? prev
        : { ...next, id },
    )
  }, [])
  const [idle, setIdle] = useState(false)
  const pitch = width + GAP
  const canSwitch = total > 1 && props.onIndexChange !== undefined
  const opening = props.opening.current
  const intro = opening && opening.index === index ? opening : null

  // ——— 打开时飞入、关闭时飞回：缩略图在飞行期间藏起来。两次各自恢复，互不影响 ———
  const introHidden = useRef<(() => void) | null>(null)
  const closeHidden = useRef<(() => void) | null>(null)
  const showIntroOrigin = useCallback(() => {
    introHidden.current?.()
    introHidden.current = null
  }, [])
  const showCloseOrigin = useCallback(() => {
    closeHidden.current?.()
    closeHidden.current = null
  }, [])
  // biome-ignore lint/correctness/useExhaustiveDependencies: 只在挂载时
  useLayoutEffect(() => {
    if (intro?.rect && intro.origin) introHidden.current = hide(intro.origin)
    // 兜底：图片没能飞入（如还没有地址）时，缩略图不能一直藏着
    const timer = setTimeout(showIntroOrigin, 1000)
    return () => {
      clearTimeout(timer)
      showCloseOrigin()
      showIntroOrigin()
    }
  }, [])
  const onIntroEnd = useCallback(() => {
    showIntroOrigin()
    if (props.opening.current) props.opening.current = { ...props.opening.current, rect: undefined }
  }, [showIntroOrigin, props.opening])

  useLayoutEffect(() => {
    const el = stage.current
    if (!el) return
    const measure = () => setWidth(el.getBoundingClientRect().width)
    measure()
    if (typeof ResizeObserver !== 'function') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ——— 轨道：换项时连续滑动 ———
  const direction = useRef<1 | -1 | null>(null)
  const setTrack = useCallback((x: number, animate: boolean) => {
    const el = track.current
    if (!el) return
    el.style.transition = animate ? `transform ${SPRING}` : 'none'
    el.style.transform = `translateX(${x}px)`
  }, [])
  const trackX = useCallback(() => {
    const el = track.current
    if (!el) return 0
    return new DOMMatrixReadOnly(getComputedStyle(el).transform).e
  }, [])
  const shown = useRef(index)
  useLayoutEffect(() => {
    const previous = shown.current
    shown.current = index
    if (previous === index) return
    let dir = direction.current
    direction.current = null
    if (dir === null && total > 2) {
      if (index === (previous + 1) % total) dir = 1
      else if (index === (previous - 1 + total) % total) dir = -1
    }
    if (dir === null || pitch <= GAP) {
      setTrack(0, false)
      return
    }
    // 上一项现在在轨道上前一格（或后一格）：先把轨道挪回让它停在原处，再滑到新的当前项
    setTrack(trackX() + dir * pitch, false)
    void track.current?.offsetWidth
    setTrack(0, true)
  }, [index, total, pitch, setTrack, trackX])

  const go = useCallback(
    (delta: 1 | -1) => {
      if (!canSwitch) return
      direction.current = delta
      props.onIndexChange?.((index + delta + total) % total)
    },
    [canSwitch, index, total, props.onIndexChange],
  )

  // ——— 拖动关闭：背景随距离变淡 ———
  const dragged = useRef<{ dx: number; dy: number } | null>(null)
  const setDismiss = (progress: number, dragging: boolean) => {
    const el = root.current
    if (!el) return
    if (dragging) el.dataset.dragging = ''
    else delete el.dataset.dragging
    el.style.setProperty('--fp-dismiss', String(progress))
  }
  const currentSlide = () => track.current?.querySelector<HTMLElement>('[data-current]') ?? null

  const resetDismiss = (motion: 'spring' | 'none') => {
    dragged.current = null
    setDismiss(0, false)
    if (kind === 'image' && image.current?.ready()) image.current.reset(motion)
    const slide = currentSlide()
    if (slide?.style.transform) {
      slide.style.transition = motion === 'spring' ? `transform ${SPRING}` : 'none'
      slide.style.transform = ''
    }
  }

  const gestures = useGestures({
    stage,
    image,
    isImage: kind === 'image',
    wheelZooms: true,
    swipe: {
      begin: () => {
        const x = trackX()
        setTrack(x, false)
        return x
      },
      move: (offset) => {
        // 只有一项（或不能切换）时有阻力，松手后回去
        setTrack(canSwitch ? offset : offset * 0.3, false)
      },
      cancel: (animate) => setTrack(0, animate),
      end: (offset, v) => {
        const threshold = Math.min(pitch * 0.2, 160)
        if (canSwitch && (offset < -threshold || v < -0.35) && offset < 0) go(1)
        else if (canSwitch && (offset > threshold || v > 0.35) && offset > 0) go(-1)
        else setTrack(0, true)
      },
    },
    dismiss: {
      cancel: resetDismiss,
      move: (dx, dy) => {
        const height = stage.current?.clientHeight || window.innerHeight
        dragged.current = { dx, dy }
        setDismiss(Math.min(1, Math.abs(dy) / (height * 0.45)), true)
        const k = 1 - Math.min(0.25, (Math.abs(dy) / height) * 0.5)
        if (kind === 'image' && image.current?.ready()) image.current.drag(dx, dy, k, 'none')
        else {
          const slide = currentSlide()
          if (slide) {
            slide.style.transition = 'none'
            slide.style.transform = `translate(${dx}px, ${dy}px) scale(${k})`
          }
        }
      },
      end: (dx, dy, vy) => {
        if (Math.abs(dy) > 90 || (Math.abs(vy) > 0.5 && Math.sign(vy) === Math.sign(dy))) {
          setDismiss(Math.min(1, Math.abs(dy) / (window.innerHeight * 0.45)), false)
          props.onClose()
          return
        }
        resetDismiss('spring')
        void dx
      },
    },
    onBackgroundClick: props.onClose,
    onImageTap: () => setIdle((v) => !v),
  })

  // ——— 关闭：飞回缩略图，或者淡出；结束后卸载 ———
  const { onGone, reduced } = props
  // biome-ignore lint/correctness/useExhaustiveDependencies: 只在开始、取消关闭时；其余的值取开始那一刻的
  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    if (!leaving) {
      // 关闭途中再次打开：从当前的样子回到原位
      if (el.dataset.leaving === 'fly') {
        image.current?.freeze()
        image.current?.reset('spring')
      }
      delete el.dataset.leaving
      el.style.setProperty('--fp-dismiss', '0')
      showCloseOrigin()
      return
    }
    if (reduced) return
    const opened = props.opening.current
    const origin =
      kind === 'image'
        ? findOrigin(item.id, opened?.index === index ? opened.trigger : null, el)
        : null
    image.current?.freeze()
    let target: Element = el.querySelector(`.${styles.backdrop}`) ?? el
    let property = 'opacity'
    if (origin && image.current?.flyTo(flightRect(origin))) {
      el.dataset.leaving = 'fly'
      // 飞入还没结束就关闭：交给关闭的这一次藏着（同一帧里先恢复再藏起，不会闪）
      showIntroOrigin()
      closeHidden.current = hide(origin)
      target = image.current.frame() ?? target
      property = 'transform'
    } else {
      el.dataset.leaving = 'fade'
      showIntroOrigin()
    }
    let done = false
    const finish = () => {
      if (done) return
      done = true
      onGone()
    }
    const onEnd = (e: TransitionEvent) => {
      if (e.target === target && e.propertyName === property) finish()
    }
    target.addEventListener('transitionend', onEnd as EventListener)
    const timer = setTimeout(
      finish,
      (property === 'transform' ? springMs(el) : exitFastMs(el)) + 100,
    )
    return () => {
      clearTimeout(timer)
      target.removeEventListener('transitionend', onEnd as EventListener)
    }
  }, [leaving])

  // ——— 焦点、按键、工具栏的隐藏 ———
  useEffect(() => {
    if (!leaving) closeRef.current?.focus()
  }, [leaving])

  const idleTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const wake = useCallback(() => {
    setIdle(false)
    clearTimeout(idleTimer.current)
    if (kind === 'image') idleTimer.current = setTimeout(() => setIdle(true), IDLE_MS)
  }, [kind])
  useEffect(() => {
    wake()
    return () => clearTimeout(idleTimer.current)
  }, [wake])

  useEffect(() => {
    if (leaving) return
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return
      const target = e.target instanceof Element ? e.target : null
      const typing = target?.closest(
        'input, textarea, select, video, audio, [contenteditable="true"]',
      )
      if (e.key === 'Escape') {
        props.onClose()
        return
      }
      if (typing) return
      if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
      else if (kind === 'image' && (e.key === '+' || e.key === '=')) image.current?.zoomStep(1)
      else if (kind === 'image' && e.key === '-') image.current?.zoomStep(-1)
      else if (kind === 'image' && e.key === '0') image.current?.reset('spring')
      else return
      wake()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [leaving, go, kind, props.onClose, wake])

  // ——— 轨道上的项：当前项与前后各一项（两项时前后是同一项，按方向各放一份） ———
  const slots: { pos: -1 | 0 | 1; i: number }[] = [{ pos: 0, i: index }]
  if (total > 1) {
    slots.unshift({ pos: -1, i: (index - 1 + total) % total })
    slots.push({ pos: 1, i: (index + 1) % total })
  }
  const seen = new Set<string>()

  const download = props.onDownload
  const counter = total > 1 ? t(texts.counter, { current: index + 1, total }) : null
  const info = meta(item, null)
  return (
    <ConfigProvider getPopupContainer={() => root.current ?? document.body}>
      <div
        ref={root}
        className={styles.root}
        role="dialog"
        aria-modal="true"
        aria-label={props['aria-label'] ?? t(texts.label)}
        data-testid={props.testId}
        data-vl-viewer-stage={current}
        data-stage={current}
        data-kind={kind}
        data-idle={(idle && !leaving) || undefined}
        inert={leaving}
        onPointerMove={(e) => {
          if (e.pointerType === 'mouse') wake()
        }}
      >
        <div className={styles.backdrop} />
        <div className={styles.toolbar} data-fp-chrome="">
          <div className={styles.title}>
            <span className={styles.name} title={item.name}>
              {item.name}
            </span>
            <span className={styles.meta}>
              {counter && <span className={styles.counter}>{counter}</span>}
              {counter && info && <span aria-hidden="true"> · </span>}
              {info}
            </span>
          </div>
          <div className={styles.tools}>
            {kind === 'image' && (
              <ZoomControls zoom={zoom?.id === item.id ? zoom : null} image={image} />
            )}
            {props.stage === undefined && viewer && (
              <StagePicker current={current} onChange={viewer.setStage} />
            )}
            {props.actions?.(item)}
            {download && (
              <IconButton
                icon={Download}
                label={t('filePreview.download')}
                onClick={() => download(item)}
              />
            )}
            <IconButton ref={closeRef} icon={X} label={t(texts.close)} onClick={props.onClose} />
          </div>
        </div>
        {/* 看图界面是模态的：焦点限制在界面内，关闭（开始淡出）时还给打开前的元素 */}
        <FocusScope active={!leaving} restoreFocus />
        <div ref={stage} className={styles.stage} {...gestures}>
          <div ref={track} className={styles.track}>
            {slots.map(({ pos, i }) => {
              const slotItem = items[i] as FilePreviewItem
              const key = seen.has(slotItem.id) ? `${slotItem.id}@${pos}` : slotItem.id
              seen.add(slotItem.id)
              const active = pos === 0
              const slotKind = previewKind(slotItem)
              return (
                <div
                  key={key}
                  className={styles.slide}
                  data-current={active || undefined}
                  data-kind={slotKind}
                  style={{ left: pos * pitch } as CSSProperties}
                  inert={!active}
                  aria-hidden={!active || undefined}
                >
                  <SlideContent
                    item={slotItem}
                    kind={slotKind}
                    active={active}
                    imageRef={active ? image : undefined}
                    placeholder={active ? intro?.placeholder : undefined}
                    intro={active ? intro?.rect : undefined}
                    onIntroEnd={active ? onIntroEnd : undefined}
                    onZoomChange={active ? (z) => reportZoom(slotItem.id, z) : undefined}
                    onDownload={download ? () => download(slotItem) : undefined}
                    render={props.render}
                  />
                </div>
              )
            })}
          </div>
        </div>
        {canSwitch && (
          <>
            <button
              type="button"
              className={`${styles.nav} ${styles.prev}`}
              data-fp-chrome=""
              data-vl-state=""
              aria-label={t(texts.prev)}
              onClick={() => go(-1)}
            >
              <Glyph icon={ChevronLeft} size={20} />
            </button>
            <button
              type="button"
              className={`${styles.nav} ${styles.next}`}
              data-fp-chrome=""
              data-vl-state=""
              aria-label={t(texts.next)}
              onClick={() => go(1)}
            >
              <Glyph icon={ChevronRight} size={20} />
            </button>
          </>
        )}
        {/*
          标题栏区域的拖动条（没有自绘标题栏时高度为 0）：app-region 给 Electron 与网页应用，属性给 Tauri。
          它靠 z-index 盖在工具栏之上，放在最后不影响层次
        */}
        <div className={styles.dragStrip} aria-hidden="true" data-tauri-drag-region="" />
      </div>
    </ConfigProvider>
  )
}

/** 淡出的时长（与样式相同，取 motion-duration-exit-fast，毫秒）；「减少动态效果」时为 0。 */
function exitFastMs(el: Element): number {
  const v = getComputedStyle(el).getPropertyValue('--vl-motion-duration-exit-fast').trim()
  const n = Number.parseFloat(v)
  return Number.isFinite(n) ? (v.endsWith('ms') ? n : n * 1000) : 0
}

function FilePreviewRoot(props: FilePreviewProps): JSX.Element | null {
  return <PreviewDialog {...props} texts={fileTexts} />
}

// ———————————————————————————————— 嵌入式 ————————————————————————————————

function Inline(props: FilePreviewInlineProps): JSX.Element {
  const t = useT()
  const item = props.item
  const kind = item ? previewKind(item) : 'other'
  const [expanded, setExpanded] = useState(false)
  const stage = useRef<HTMLDivElement>(null)
  const image = useRef<ImageViewHandle>(null)
  const gestures = useGestures({ stage, image, isImage: kind === 'image', wheelZooms: false })
  const download = props.onDownload
  const expandable = (props.expandable ?? true) && item !== null && kind !== 'other'
  // 换了文件时收起全屏
  const itemId = item?.id
  // biome-ignore lint/correctness/useExhaustiveDependencies: itemId 是触发条件
  useEffect(() => setExpanded(false), [itemId])
  return (
    <section
      className={styles.inline}
      aria-label={props['aria-label'] ?? item?.name}
      data-testid={props.testId}
      data-kind={item ? kind : undefined}
    >
      {item && (
        <header className={styles.inlineHeader}>
          <span className={styles.inlineIcon}>
            <Glyph icon={iconFor(kind)} size={16} tone="tertiary" />
          </span>
          <span className={styles.title}>
            <span className={styles.name} title={item.name}>
              {item.name}
            </span>
            <span className={styles.meta}>{meta(item, null)}</span>
          </span>
          <span className={styles.tools}>
            {props.actions?.(item)}
            {download && (
              <IconButton
                icon={Download}
                label={t('filePreview.download')}
                onClick={() => download(item)}
              />
            )}
            {expandable && (
              <IconButton
                icon={Maximize2}
                label={t('filePreview.expand')}
                onClick={() => setExpanded(true)}
              />
            )}
          </span>
        </header>
      )}
      {/* 预览区总是在：滚轮的监听挂在它上面，不随有没有文件而换元素 */}
      <div
        ref={stage}
        className={styles.inlineBody}
        data-kind={item ? kind : undefined}
        {...gestures}
      >
        {item ? (
          <SlideContent
            key={item.id}
            item={item}
            kind={kind}
            active
            imageRef={image}
            previewId={item.id}
            onDownload={download ? () => download(item) : undefined}
            render={props.render}
          />
        ) : (
          <EmptyState icon={FileIcon} title={t('filePreview.empty')} size="sm" fill />
        )}
      </div>
      {item && expandable && (
        <FilePreviewRoot
          open={expanded}
          items={[item]}
          index={0}
          onClose={() => setExpanded(false)}
          actions={props.actions}
          onDownload={props.onDownload}
          render={props.render}
        />
      )}
    </section>
  )
}

const iconFor = (kind: PreviewKind): IconComponent =>
  kind === 'image'
    ? FileImage
    : kind === 'video'
      ? FilePlay
      : kind === 'audio'
        ? FileMusic
        : kind === 'other'
          ? FileIcon
          : FileText

/**
 * FilePreview and its static members.
 * @zh FilePreview 及其静态成员。
 */
export interface FilePreviewComponent {
  /**
   * Renders the full-window preview.
   * @zh 渲染铺满窗口的预览。
   */
  (props: FilePreviewProps): JSX.Element | null
  /**
   * The preview as an area of the page, such as the right pane of a file list: a header with the file name, size
   * and buttons, and the file below it, filling the height of the parent. Images can be zoomed with a pinch,
   * `Ctrl` + wheel or a double click, and dragged when zoomed; "Full screen" opens the full-window preview.
   * @zh 放在页面中的一块预览区域，如文件列表右侧的窗格：顶部是文件名、大小与按钮，下面是文件，高度占满父元素。
   * 图片可以双指缩放、`Ctrl` + 滚轮缩放或双击放大，放大后拖动平移；「全屏查看」打开铺满窗口的预览。
   */
  readonly Inline: (props: FilePreviewInlineProps) => JSX.Element
}

/**
 * Previews files in a full-window viewer: images, video, audio and text (code, JSON, Markdown, logs) are shown
 * directly; other files show a card with their name and size, and can be shown in your own way with `render` (such
 * as PDF with a PDF library). Files are switched with `←` / `→`, the side buttons or by swiping. Use
 * `FilePreview.Inline` for a preview inside the page.
 *
 * Text files are read up to their first 256 KB; JSON is formatted. The background of images uses the neutral viewer
 * tokens, like Lightbox, so it does not change how the colors of images are perceived; text is shown on a sheet in
 * the colors of the theme.
 *
 * **Interaction**: a modal dialog. When it opens, focus moves to "Close"; `Esc` closes it, `←` / `→` switch files,
 * `+` / `-` zoom images and `0` fits them again; `Tab` stays inside the preview and focus returns to the opener
 * after closing. Images zoom with the wheel or a pinch around the pointer, a double click (or double tap) switches
 * between fitting the window and the actual size, and zoomed images are dragged to move them. Dragging a file
 * sideways switches to the next one, dragging it up or down closes the preview (the background fades with the
 * distance), and clicking outside the file closes it too. While an image is shown and the pointer rests, the
 * toolbar fades away; moving the pointer brings it back.
 *
 * **Motion**: an image opened from a thumbnail (the element that was pressed, or one with the same
 * `data-vl-preview-id`, such as the tiles of ImageGrid) grows out of it along the spring and flies back into it when
 * closing; otherwise the preview fades in and the image grows into place once loaded. Switching files slides them
 * along a track; gestures follow the finger and settle along the spring when released, and every motion can be
 * interrupted.
 * @zh 在铺满窗口的查看器中预览文件：图片、视频、音频与文本（代码、JSON、Markdown、日志）直接显示；其他文件显示带文件名与
 * 大小的卡片，也可以用 `render` 自己显示（如用 PDF 库显示 PDF）。用 `←` / `→`、两侧的按钮或滑动切换文件。放在页面中的
 * 预览用 `FilePreview.Inline`。
 *
 * 文本文件只读取开头 256 KB；JSON 自动排版。图片的背景与 Lightbox 一样使用中性的看图令牌，不影响对图片颜色的判断；
 * 文本显示在一张主题配色的「纸」上。
 *
 * **交互**：模态对话框。打开时焦点移到「关闭」；`Esc` 关闭，`←` / `→` 切换文件，`+` / `-` 缩放图片，`0` 回到适合窗口；
 * `Tab` 只在预览内移动，关闭后焦点回到打开前的元素。图片用滚轮或双指以指针为中心缩放，双击（触屏双击）在适合窗口与
 * 实际大小之间切换，放大后拖动平移。横向拖动文件切换到下一个，上下拖动关闭预览（背景随距离变淡），点击文件以外的地方
 * 也会关闭。显示图片且指针停留不动时，工具栏淡出，移动指针后重新出现。
 *
 * **动效**：从缩略图打开的图片（按下的元素，或 `data-vl-preview-id` 相同的元素，如 ImageGrid 的格子）沿弹簧从缩略图中
 * 长出，关闭时飞回缩略图；否则预览淡入，图片加载后放大到位。切换文件时沿轨道滑动；手势跟手，松手后沿弹簧落定，所有
 * 动效都可以中途打断。
 * @category Media
 * @usage Previewing attachments and uploaded files, viewing images in a gallery, checking logs and data files
 * @usageZh 预览附件与上传的文件、在图库中看图、查看日志与数据文件
 */
export const FilePreview: FilePreviewComponent = /* @__PURE__ */ Object.assign(FilePreviewRoot, {
  Inline,
})
