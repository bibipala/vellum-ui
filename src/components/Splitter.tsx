/**
 * 可拖拽分栏：两个窗格之间有一个可以拖动、也可以用键盘调整的手柄（WAI-ARIA 的 Window Splitter 模式）。
 *
 * 自研而不封装 antd 的 Splitter：antd 的分隔条不能用 Tab 聚焦、没有键盘操作，用鼠标 / 触摸事件而不是指针事件，
 * 折叠按钮的读屏名称写死为英文。这里只需要两个窗格、一个手柄，自己实现更小，行为也完全可控。
 *
 * - 尺寸是「主窗格」（默认第一个）的像素宽度（纵向时为高度），另一个窗格占满剩余空间；
 * - 手柄用统一状态层（data-vl-state），悬停、拖动、键盘聚焦时中间出现握把；
 * - 拖动用指针事件与指针捕获，拖出手柄、拖过 iframe 时照常跟随；
 * - `storageKey` 时把尺寸保存在本机（localStorage），挂载时读取；读取放在 layout effect 中，服务端与水合时用默认值，
 *   不会水合不匹配，客户端在绘制前换成保存的值，不闪。
 */
import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { useT } from '../i18n/index.ts'
import type { BaseProps } from './layout.tsx'
import styles from './splitter.module.css'

/**
 * Props of Splitter.
 * @zh Splitter 属性。
 */
export interface SplitterProps extends Pick<BaseProps, 'testId'> {
  /**
   * The two panes, in order. Each pane scrolls on its own when its content overflows.
   * @zh 两个窗格，按顺序排列。内容超出时各自滚动。
   */
  readonly children: readonly [ReactNode, ReactNode]
  /**
   * `horizontal`: panes side by side with a vertical handle; `vertical`: panes stacked with a horizontal handle.
   * The Splitter fills its parent, so give the parent a height.
   * @zh `horizontal`：左右排列，手柄竖直；`vertical`：上下排列，手柄水平。Splitter 占满父元素，父元素需要有高度。
   * @default 'horizontal'
   */
  readonly direction?: 'horizontal' | 'vertical'
  /**
   * The pane whose size is set (`size`, `min`, `max`); the other pane takes the remaining space.
   * @zh 设定尺寸的窗格（`size`、`min`、`max` 作用于它），另一个窗格占满剩余空间。
   * @default 'start'
   */
  readonly primary?: 'start' | 'end'
  /**
   * Size of the primary pane in pixels (controlled); use it with `onSizeChange`.
   * @zh 主窗格的像素尺寸（受控），与 `onSizeChange` 一起使用。
   */
  readonly size?: number
  /**
   * Initial size of the primary pane in pixels (uncontrolled).
   * @zh 主窗格的初始像素尺寸（非受控）。
   * @default 280
   */
  readonly defaultSize?: number
  /**
   * Called with the new size while dragging and after each keyboard step.
   * @zh 拖动过程中与每次键盘调整后调用，参数是新的尺寸。
   */
  readonly onSizeChange?: (size: number) => void
  /**
   * Smallest size of the primary pane in pixels; `Home` collapses the pane to it.
   * @zh 主窗格的最小像素尺寸；`Home` 把窗格收起到这个尺寸。
   * @default 0
   */
  readonly min?: number
  /**
   * Largest size of the primary pane in pixels; `End` expands the pane to it. Never larger than the Splitter
   * itself.
   * @zh 主窗格的最大像素尺寸；`End` 把窗格展开到这个尺寸。不会超过 Splitter 本身。
   */
  readonly max?: number
  /**
   * Pixels per arrow key press; with `Shift`, four times as much.
   * @zh 每按一次方向键调整的像素；按住 `Shift` 时为 4 倍。
   * @default 16
   */
  readonly step?: number
  /**
   * Saves the size on this device (in `localStorage` under this key) and restores it on the next visit. Use a key
   * that is unique in your application, such as `'files.sidebar'`.
   * @zh 把尺寸保存在本机（`localStorage` 中，键名即此值），下次打开时恢复。键名在应用内要唯一，如 `'files.sidebar'`。
   */
  readonly storageKey?: string
  /**
   * Accessible name of the handle, "Resize" by default (follows `locale`); name what it resizes, such as
   * "Resize the sidebar".
   * @zh 手柄的读屏名称，默认「调整大小」（随 `locale`）；写明调整的是什么，如「调整侧栏宽度」。
   */
  readonly 'aria-label'?: string
}

const DEFAULT_SIZE = 280
const DEFAULT_STEP = 16

/** 读取保存的尺寸；无效值、不可用的存储（隐私模式、被禁用）视为没有保存。 */
function readStored(key: string): number | null {
  try {
    const raw = globalThis.localStorage?.getItem(key)
    const n = raw == null ? Number.NaN : Number(raw)
    return Number.isFinite(n) && n >= 0 ? n : null
  } catch {
    return null
  }
}

/** 保存尺寸。存储不可用或已满时放弃：尺寸只是偏好，丢失不影响使用。 */
function writeStored(key: string, size: number) {
  try {
    globalThis.localStorage?.setItem(key, String(Math.round(size)))
  } catch {
    // 不可写（隐私模式、配额已满）：本次会话内尺寸照常生效，只是不会被记住
  }
}

/**
 * A resizable split between two panes: drag the handle, or focus it and use the keyboard.
 *
 * **Interaction**: hovering the handle adds the shared state layer and shows a grip; dragging follows the pointer
 * (also when it leaves the handle) and keeps the pressed state. `Tab` focuses the handle and shows the focus
 * ring; `←` / `→` (`↑` / `↓` when vertical) resize by `step`, four times as much with `Shift`; `Home` collapses
 * the primary pane to `min`, `End` expands it to `max`, and `Enter` toggles between collapsed and the previous
 * size. Screen readers read the handle as a separator with its current size (`aria-valuenow`).
 * @zh 可拖拽分栏：两个窗格之间的手柄可以拖动，也可以聚焦后用键盘调整。
 *
 * **交互**：悬停手柄时叠加统一状态层并出现握把；拖动时跟随指针（移出手柄也一样），保持按下的状态。`Tab` 聚焦手柄显示焦点环；
 * `←` / `→`（纵向时 `↑` / `↓`）按 `step` 调整，按住 `Shift` 时为 4 倍；`Home` 把主窗格收起到 `min`，`End` 展开到 `max`，
 * `Enter` 在收起与之前的尺寸之间切换。读屏把手柄读作分隔条，并读出当前尺寸（`aria-valuenow`）。
 * @category Patterns
 * @usage A resizable sidebar or list next to details, editors with a preview, a resizable bottom panel
 * @usageZh 可调宽度的侧栏或列表加详情、带预览的编辑器、可调高度的底部面板
 */
export function Splitter(props: SplitterProps) {
  const t = useT()
  const horizontal = (props.direction ?? 'horizontal') === 'horizontal'
  const primary = props.primary ?? 'start'
  const min = Math.max(0, props.min ?? 0)
  const step = props.step ?? DEFAULT_STEP
  const [inner, setInner] = useState(props.defaultSize ?? DEFAULT_SIZE)
  const [available, setAvailable] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const handle = useRef<HTMLDivElement>(null)
  const drag = useRef<{ pointer: number; from: number; size: number; sign: number } | null>(null)
  const restore = useRef<number | null>(null)
  const paneId = useId()

  // 可用空间：Splitter 的宽（高）减去手柄。窗口或父元素变化时更新，最大值随之变化
  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    const measure = () => {
      const total = horizontal ? el.clientWidth : el.clientHeight
      const bar = handle.current
      const barSize = bar ? (horizontal ? bar.offsetWidth : bar.offsetHeight) : 0
      setAvailable(Math.max(0, total - barSize))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [horizontal])

  const max = Math.max(
    min,
    Math.min(props.max ?? Number.POSITIVE_INFINITY, available ?? Number.POSITIVE_INFINITY),
  )
  const clamp = useCallback((n: number) => Math.min(max, Math.max(min, n)), [min, max])
  const current = clamp(props.size ?? inner)
  // 最新的尺寸：拖动结束时保存它。连续的 pointermove 可能还没有重新渲染，闭包里的 current 会落后一步
  const latest = useRef(current)
  latest.current = current

  const { onSizeChange, storageKey } = props
  const change = useCallback(
    (next: number) => {
      const value = Math.round(clamp(next))
      latest.current = value
      if (value === current) return value
      if (props.size === undefined) setInner(value)
      onSizeChange?.(value)
      return value
    },
    [clamp, current, props.size, onSizeChange],
  )

  // 恢复保存的尺寸：在绘制之前，避免先显示默认尺寸再跳变
  // biome-ignore lint/correctness/useExhaustiveDependencies: 只在挂载与键名变化时读取一次
  useLayoutEffect(() => {
    if (!storageKey) return
    const stored = readStored(storageKey)
    if (stored === null) return
    setInner(stored)
    onSizeChange?.(stored)
  }, [storageKey])

  const persist = (value: number) => {
    if (storageKey) writeStored(storageKey, value)
  }

  /** 增大主窗格时指针（或方向键）的方向：主窗格在后面时颠倒；从右到左的页面中左右再颠倒一次。 */
  const growSign = () => {
    const rtl =
      horizontal && root.current ? getComputedStyle(root.current).direction === 'rtl' : false
    return (primary === 'start' ? 1 : -1) * (rtl ? -1 : 1)
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    // 不阻止默认操作：鼠标按下照常把焦点给手柄（鼠标聚焦不显示焦点环，之后可以接着用方向键）；
    // 拖动期间不选中文字由样式负责（data-dragging 时 user-select: none）
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = {
      pointer: e.pointerId,
      from: horizontal ? e.clientX : e.clientY,
      size: current,
      sign: growSign(),
    }
    setDragging(true)
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.pointer !== e.pointerId) return
    const delta = (horizontal ? e.clientX : e.clientY) - d.from
    change(d.size + d.sign * delta)
  }
  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.pointer !== e.pointerId) return
    drag.current = null
    setDragging(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId)
    persist(latest.current)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const sign = growSign()
    const amount = e.shiftKey ? step * 4 : step
    const [less, more] = horizontal ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown']
    let next: number
    if (e.key === less || e.key === more) {
      next = current + (e.key === more ? 1 : -1) * sign * amount
      restore.current = null
    } else if (e.key === 'End') {
      next = max
      restore.current = null
    } else if (e.key === 'Home' || (e.key === 'Enter' && current > min)) {
      // 收起：记住收起前的尺寸，Enter 再展开回去
      if (current > min) restore.current = current
      next = min
    } else if (e.key === 'Enter') {
      next = restore.current ?? props.defaultSize ?? DEFAULT_SIZE
      restore.current = null
    } else return
    e.preventDefault()
    persist(change(next))
  }

  const sizeStyle = horizontal ? { width: current } : { height: current }
  const [first, second] = props.children
  return (
    <div
      ref={root}
      className={styles.root}
      data-direction={horizontal ? 'horizontal' : 'vertical'}
      data-dragging={dragging || undefined}
      data-testid={props.testId}
    >
      <div
        className={styles.pane}
        id={primary === 'start' ? paneId : undefined}
        data-primary={primary === 'start' || undefined}
        style={primary === 'start' ? sizeStyle : undefined}
      >
        {first}
      </div>
      {/* biome-ignore lint/a11y/useSemanticElements: 可聚焦、可调整的分隔条（WAI-ARIA Window Splitter）没有对应的原生元素，<hr> 不能聚焦与拖动 */}
      <div
        ref={handle}
        role="separator"
        tabIndex={0}
        aria-orientation={horizontal ? 'vertical' : 'horizontal'}
        aria-valuenow={current}
        aria-valuemin={min}
        aria-valuemax={Number.isFinite(max) ? Math.round(max) : undefined}
        aria-controls={paneId}
        aria-label={props['aria-label'] ?? t('splitter.label')}
        className={styles.handle}
        data-vl-state=""
        data-dragging={dragging || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        onKeyDown={onKeyDown}
      />
      <div
        className={styles.pane}
        id={primary === 'end' ? paneId : undefined}
        data-primary={primary === 'end' || undefined}
        style={primary === 'end' ? sizeStyle : undefined}
      >
        {second}
      </div>
    </div>
  )
}
