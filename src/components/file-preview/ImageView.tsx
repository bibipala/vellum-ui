/**
 * 文件预览中的图片：按区域大小「放得下、不放大」地摆好（contain，不超过原始尺寸），可以缩放、平移。
 *
 * 位置由脚本直接写到元素上（transform: translate() scale()，原点在图片中心），不经过 React 状态：手势每一帧都要改。
 * 同一时刻元素上的目标值记在 view 里；过渡进行中被新的手势打断时，先读出当前的实际位置（freeze），从那里继续。
 *
 * 从缩略图放大（FLIP）：打开时把图片先摆到缩略图的位置与大小（等比放大到盖住缩略图，再用 clip-path 裁成缩略图的
 * 形状与圆角），下一帧沿弹簧回到原位；关闭时反过来飞回缩略图。
 */
import {
  forwardRef,
  type ReactNode,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { Loading } from '../feedback.tsx'
import styles from './file-preview.module.css'

export interface Size {
  readonly width: number
  readonly height: number
}

/** 缩略图：打开时先显示它（已在缓存中），大图加载完成后盖上去。 */
export interface Placeholder extends Size {
  readonly src: string
}

/** 飞入、飞回的起点或终点：缩略图在视口中的位置、大小与圆角。 */
export interface FlightRect {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
  readonly radius: number
}

/** 当前的缩放：比例（相对「放得下」的大小）、相对原始像素的百分比、能否再放大、缩小。 */
export interface ZoomInfo {
  readonly scale: number
  readonly percent: number
  readonly canZoomIn: boolean
  readonly canZoomOut: boolean
}

/** 过渡方式：spring 沿弹簧（松手、双击、按钮）；quick 快速跟随（滚轮）；none 立即（拖动中）。 */
export type Motion = 'spring' | 'quick' | 'none'

export interface ImageViewHandle {
  readonly frame: () => HTMLElement | null
  /** 视口中的一点是否在图片上（指针被舞台捕获后，事件的目标不再是图片本身）。 */
  readonly contains: (x: number, y: number) => boolean
  /** 是否放大了（比「放得下」大）。 */
  readonly zoomed: () => boolean
  readonly ready: () => boolean
  /** 读出过渡中的实际位置作为当前值（打断进行中的过渡）。 */
  readonly freeze: () => void
  readonly zoomBy: (factor: number, at: { x: number; y: number } | null, motion: Motion) => void
  readonly zoomStep: (direction: 1 | -1) => void
  /** 双击：放得下时放大到原始大小（小图放大两倍），放大时回到放得下。 */
  readonly toggle: (at: { x: number; y: number } | null) => void
  readonly reset: (motion: Motion) => void
  /** 拖动平移：相对按下时的位置，超出边界时有阻力。 */
  readonly panStart: () => void
  readonly panMove: (dx: number, dy: number) => void
  /** 松手：带一点惯性，回到边界内。 */
  readonly panEnd: (vx: number, vy: number) => void
  /** 双指缩放：ratio 是两指距离相对开始时的比例，center 是两指中点（视口坐标）。 */
  readonly pinchStart: (center: { x: number; y: number }) => void
  readonly pinchMove: (ratio: number, center: { x: number; y: number }) => void
  readonly pinchEnd: () => void
  /** 向下拖动关闭：跟随手指，随距离略微缩小。 */
  readonly drag: (dx: number, dy: number, scale: number, motion: Motion) => void
  /** 关闭时飞回缩略图；没有放好时返回 false。 */
  readonly flyTo: (rect: FlightRect) => boolean
}

interface ImageViewProps {
  readonly src: string
  readonly alt: string
  /** 与之对应的缩略图的标识，写在图片框上（data-vl-preview-id），全屏查看时据此飞出、飞回。 */
  readonly previewId?: string
  readonly placeholder?: Placeholder
  /** 打开时从这里飞入；只在第一次放好时使用。 */
  readonly intro?: FlightRect
  readonly onIntroEnd?: () => void
  readonly onZoomChange?: (zoom: ZoomInfo) => void
  readonly onStatusChange?: (status: 'loading' | 'loaded' | 'error') => void
  /** 加载失败时显示的内容。 */
  readonly failed?: ReactNode
  /** 是否是当前显示的一项：不再是当前项时回到放得下。 */
  readonly active: boolean
}

/** 加载过的大图的原始尺寸：再次显示时（换回来、重新打开）不用等加载就能放好。 */
const naturalSizes = new Map<string, Size>()

const SPRING = 'var(--vl-motion-duration-spring) var(--vl-motion-ease-spring)'
const QUICK = 'var(--vl-motion-duration-fast) var(--vl-motion-ease-standard)'

const transitionFor = (motion: Motion) =>
  motion === 'none'
    ? 'none'
    : `transform ${motion === 'spring' ? SPRING : QUICK}, clip-path ${motion === 'spring' ? SPRING : QUICK}`

interface View {
  s: number
  x: number
  y: number
}

/** 超出边界的部分按阻力衰减：越往外拉越费力。 */
function rubber(value: number, min: number, max: number): number {
  if (value < min) return min - (min - value) * 0.35
  if (value > max) return max + (value - max) * 0.35
  return value
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

export const ImageView = forwardRef<ImageViewHandle, ImageViewProps>(
  function ImageView(props, ref) {
    const area = useRef<HTMLDivElement>(null)
    const frame = useRef<HTMLDivElement>(null)
    const [areaSize, setAreaSize] = useState<Size | null>(null)
    const [natural, setNatural] = useState<Size | null>(() => naturalSizes.get(props.src) ?? null)
    const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(() =>
      naturalSizes.has(props.src) ? 'loaded' : 'loading',
    )
    const view = useRef<View>({ s: 1, x: 0, y: 0 })
    const gesture = useRef<{ view: View; center?: { x: number; y: number } } | null>(null)
    const introPlayed = useRef(false)
    const { onStatusChange } = props
    // 回调放在 ref 里：父组件每次渲染传入新的函数，不应让位置的写入函数随之变化
    const onZoomChange = useRef(props.onZoomChange)
    onZoomChange.current = props.onZoomChange

    // 放得下的尺寸：原始尺寸未知时用缩略图的宽高比铺满区域（大图加载后再按原始尺寸收紧）
    const shape = natural ?? props.placeholder ?? null
    const box = areaSize && shape ? fitBox(areaSize, shape, natural !== null) : null

    const setStatusBoth = useCallback(
      (next: 'loading' | 'loaded' | 'error') => {
        setStatus(next)
        onStatusChange?.(next)
      },
      [onStatusChange],
    )

    useLayoutEffect(() => {
      const el = area.current
      if (!el) return
      const measure = () => {
        const r = el.getBoundingClientRect()
        setAreaSize((prev) =>
          prev && prev.width === r.width && prev.height === r.height
            ? prev
            : { width: r.width, height: r.height },
        )
      }
      measure()
      if (typeof ResizeObserver !== 'function') return
      const ro = new ResizeObserver(measure)
      ro.observe(el)
      return () => ro.disconnect()
    }, [])

    /** 视口中的区域矩形与容器（slide）尺寸：平移的边界按容器算，放大的图片可以铺到区域的内边距里。 */
    const geometry = useCallback(() => {
      const a = area.current
      if (!a || !box) return null
      const rect = a.getBoundingClientRect()
      const host = a.parentElement?.getBoundingClientRect() ?? rect
      return { rect, host, box }
    }, [box])

    const maxScale = useCallback(() => {
      if (!box || !natural) return 4
      return Math.max(2, (4 * natural.width) / box.width)
    }, [box, natural])

    const zoomInfo = useCallback((): ZoomInfo => {
      const s = view.current.s
      const percent = box && natural ? Math.round((s * box.width * 100) / natural.width) : 100
      return {
        scale: s,
        percent,
        canZoomIn: s < maxScale() - 1e-3,
        canZoomOut: s > 1 + 1e-3,
      }
    }, [box, natural, maxScale])

    const write = useCallback(
      (motion: Motion, extra?: { scale?: number }) => {
        const el = frame.current
        if (!el) return
        const { s, x, y } = view.current
        el.style.transition = transitionFor(motion)
        el.style.transform = `translate(${x}px, ${y}px) scale(${s * (extra?.scale ?? 1)})`
        el.style.clipPath = ''
        if (s > 1 + 1e-3) el.dataset.zoomed = ''
        else delete el.dataset.zoomed
        onZoomChange.current?.(zoomInfo())
      },
      [zoomInfo],
    )

    /** 平移的边界：放大后超出容器的那部分的一半；没有超出时居中。 */
    const bounds = useCallback(
      (s: number) => {
        const g = geometry()
        if (!g) return { x: 0, y: 0, cx: 0, cy: 0 }
        // 图片框的中心相对容器中心的偏移（区域的内边距左右不一定相等）
        const cx = g.rect.left + g.box.left + g.box.width / 2 - (g.host.left + g.host.width / 2)
        const cy = g.rect.top + g.box.top + g.box.height / 2 - (g.host.top + g.host.height / 2)
        return {
          x: Math.max(0, (s * g.box.width - g.host.width) / 2),
          y: Math.max(0, (s * g.box.height - g.host.height) / 2),
          cx,
          cy,
        }
      },
      [geometry],
    )

    const clampView = useCallback(
      (v: View): View => {
        const s = clamp(v.s, 1, maxScale())
        const b = bounds(s)
        // 没有超出容器时回到区域的中间（x = 0）；超出时图片的边不离开容器的边
        const x = b.x === 0 ? 0 : clamp(v.x, -b.x - b.cx, b.x - b.cx)
        const y = b.y === 0 ? 0 : clamp(v.y, -b.y - b.cy, b.y - b.cy)
        return { s, x, y }
      },
      [bounds, maxScale],
    )

    /** 以视口中的一点为中心缩放到 s：这一点下面的图片内容保持不动。 */
    const scaleAround = useCallback(
      (from: View, s: number, at: { x: number; y: number } | null): View => {
        const g = geometry()
        if (!g) return { ...from, s }
        const cx = g.rect.left + g.box.left + g.box.width / 2
        const cy = g.rect.top + g.box.top + g.box.height / 2
        const px = at ? at.x - cx : 0
        const py = at ? at.y - cy : 0
        const k = s / from.s
        return { s, x: px - (px - from.x) * k, y: py - (py - from.y) * k }
      },
      [geometry],
    )

    const freeze = useCallback(() => {
      const el = frame.current
      if (!el) return
      const m = new DOMMatrixReadOnly(getComputedStyle(el).transform)
      if (!m.is2D) return
      view.current = { s: Math.hypot(m.a, m.b) || 1, x: m.e, y: m.f }
      el.style.transition = 'none'
      el.style.transform = `translate(${view.current.x}px, ${view.current.y}px) scale(${view.current.s})`
    }, [])

    useImperativeHandle(
      ref,
      (): ImageViewHandle => ({
        frame: () => frame.current,
        contains(x, y) {
          const r = frame.current?.getBoundingClientRect()
          return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
        },
        zoomed: () => view.current.s > 1 + 1e-3,
        ready: () => box !== null,
        freeze,
        zoomBy(factor, at, motion) {
          const target = clamp(view.current.s * factor, 1, maxScale())
          view.current = clampView(scaleAround(view.current, target, at))
          write(motion)
        },
        zoomStep(direction) {
          const steps = [1, 1.5, 2, 3, 4, 6, 8, 12, 16]
          const s = view.current.s
          const next =
            direction > 0
              ? (steps.find((v) => v > s + 1e-3) ?? maxScale())
              : ([...steps].reverse().find((v) => v < s - 1e-3) ?? 1)
          view.current = clampView(scaleAround(view.current, clamp(next, 1, maxScale()), null))
          write('spring')
        },
        toggle(at) {
          if (view.current.s > 1 + 1e-3) {
            view.current = { s: 1, x: 0, y: 0 }
          } else {
            const actual = box && natural ? natural.width / box.width : 1
            const target = clamp(actual > 1.2 ? actual : 2, 1, maxScale())
            view.current = clampView(scaleAround(view.current, target, at))
          }
          write('spring')
        },
        reset(motion) {
          view.current = { s: 1, x: 0, y: 0 }
          write(motion)
        },
        panStart() {
          gesture.current = { view: { ...view.current } }
        },
        panMove(dx, dy) {
          const start = gesture.current?.view
          if (!start) return
          const b = bounds(start.s)
          view.current = {
            s: start.s,
            x: rubber(start.x + dx, -b.x - b.cx, b.x - b.cx),
            y: rubber(start.y + dy, -b.y - b.cy, b.y - b.cy),
          }
          write('none')
        },
        panEnd(vx, vy) {
          gesture.current = null
          // 惯性：按松手时的速度再滑一段（约 120ms 的距离），再收回到边界内
          view.current = clampView({
            ...view.current,
            x: view.current.x + vx * 120,
            y: view.current.y + vy * 120,
          })
          write('spring')
        },
        pinchStart(center) {
          gesture.current = { view: { ...view.current }, center }
        },
        pinchMove(ratio, center) {
          const g = gesture.current
          if (!g?.center) return
          // 缩小到放得下以下、放大到上限以上时有阻力
          const raw = g.view.s * ratio
          const max = maxScale()
          const s = raw < 1 ? 1 - (1 - raw) * 0.35 : raw > max ? max + (raw - max) * 0.35 : raw
          const scaled = scaleAround(g.view, s, g.center)
          view.current = {
            s,
            x: scaled.x + center.x - g.center.x,
            y: scaled.y + center.y - g.center.y,
          }
          write('none')
        },
        pinchEnd() {
          gesture.current = null
          view.current = clampView(view.current)
          write('spring')
        },
        drag(dx, dy, scale, motion) {
          view.current = { s: 1, x: dx, y: dy }
          write(motion, { scale })
        },
        flyTo(rect) {
          const el = frame.current
          const g = geometry()
          if (!el || !g) return false
          const flight = flightTransform(g.rect, g.box, rect)
          el.style.transition = transitionFor('spring')
          el.style.transform = flight.transform
          el.style.clipPath = flight.clip
          return true
        },
      }),
      [box, natural, maxScale, clampView, scaleAround, write, bounds, geometry, freeze],
    )

    // 不再是当前项（换到了别的文件）：沿弹簧回到放得下。成为当前项时报告缩放（工具栏显示它的百分比）
    const hasZoomListener = props.onZoomChange !== undefined
    // biome-ignore lint/correctness/useExhaustiveDependencies: hasZoomListener 是触发条件（开始监听时报告一次）
    useLayoutEffect(() => {
      if (!props.active && view.current.s !== 1) {
        view.current = { s: 1, x: 0, y: 0 }
        write('spring')
      } else if (props.active && box) onZoomChange.current?.(zoomInfo())
    }, [props.active, hasZoomListener, box, write, zoomInfo])

    // 尺寸变化（窗口、区域）后，放大的位置收回到新的边界内
    // biome-ignore lint/correctness/useExhaustiveDependencies: box 是触发条件
    useLayoutEffect(() => {
      if (!box || introPlayed.current === false) return
      view.current = clampView(view.current)
      write('none')
    }, [box?.width, box?.height])

    // 第一次放好：从缩略图飞入，或者直接就位。结束的回调与兜底定时器不随重新渲染取消：飞入只有一次，结束时一定要通知
    const { intro } = props
    const onIntroEnd = useRef(props.onIntroEnd)
    onIntroEnd.current = props.onIntroEnd
    const introTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
    useLayoutEffect(() => () => clearTimeout(introTimer.current), [])
    useLayoutEffect(() => {
      if (!box || introPlayed.current) return
      introPlayed.current = true
      const el = frame.current
      const a = area.current
      if (!el || !a) return
      if (!intro) {
        write('none')
        return
      }
      const flight = flightTransform(a.getBoundingClientRect(), box, intro)
      el.style.transition = 'none'
      el.style.transform = flight.transform
      el.style.clipPath = flight.clip
      void el.offsetWidth
      el.style.transition = transitionFor('spring')
      el.style.transform = 'translate(0px, 0px) scale(1)'
      el.style.clipPath = 'inset(0px round 0px)'
      let done = false
      const finish = () => {
        if (done) return
        done = true
        el.removeEventListener('transitionend', onEnd)
        el.style.clipPath = ''
        onIntroEnd.current?.()
      }
      const onEnd = (e: TransitionEvent) => {
        if (e.target === el && e.propertyName === 'transform') finish()
      }
      el.addEventListener('transitionend', onEnd)
      introTimer.current = setTimeout(finish, springMs(el) + 100)
    }, [box, intro, write])

    // 大图加载完成（或挂载时已在缓存中）：量出原始尺寸后才算加载完成
    const measuring = useRef<string | null>(null)
    const failedSrc = useRef<string | null>(null)
    const alive = useRef(true)
    useLayoutEffect(() => {
      alive.current = true
      return () => {
        alive.current = false
      }
    }, [])
    const settle = (src: string) => {
      if (measuring.current === src || naturalSizes.has(src)) return
      measuring.current = src
      measureNatural(src).then((size) => {
        // 加载失败（onError）之后不再改回「已加载」
        if (!alive.current || measuring.current !== src || failedSrc.current === src) return
        const known = size ?? areaSize ?? { width: 800, height: 600 }
        naturalSizes.set(src, known)
        setNatural((prev) =>
          prev && prev.width === known.width && prev.height === known.height ? prev : known,
        )
        setStatusBoth('loaded')
      })
    }

    const loaded = status === 'loaded'
    return (
      <div ref={area} className={styles.imageArea}>
        {status === 'loading' && !props.placeholder && (
          <span className={styles.imageLoading}>
            <Loading />
          </span>
        )}
        {status === 'error' ? (
          props.failed
        ) : (
          <div
            ref={frame}
            className={styles.frame}
            data-vl-preview-id={props.previewId}
            data-loaded={loaded || undefined}
            data-placeholder={(props.placeholder && !loaded) || undefined}
            data-sized={box ? '' : undefined}
            data-intro={props.intro ? '' : undefined}
            data-fp-frame=""
            style={
              box
                ? { left: box.left, top: box.top, width: box.width, height: box.height }
                : undefined
            }
          >
            <div className={styles.content}>
              {props.placeholder && !loaded && (
                <img
                  className={styles.picture}
                  src={props.placeholder.src}
                  alt=""
                  draggable={false}
                />
              )}
              <img
                className={styles.picture}
                data-full=""
                src={props.src}
                alt={props.alt}
                draggable={false}
                ref={(img) => {
                  // 已在缓存中的图片挂载时就已加载完成，不会再触发 load
                  if (img?.complete && img.naturalWidth > 0) settle(props.src)
                }}
                onLoad={() => settle(props.src)}
                onError={() => {
                  failedSrc.current = props.src
                  setStatusBoth('error')
                }}
              />
            </div>
          </div>
        )}
      </div>
    )
  },
)

/**
 * 图片的原始尺寸：用一个不在页面上的 Image 读取。页面上的 img 不可靠：WebKit 中同一张 SVG 已在别处（如缩略图）
 * 显示过时，naturalWidth 是那里的显示尺寸。没有固有尺寸（或加载失败）时为 null。
 */
function measureNatural(src: string): Promise<Size | null> {
  return new Promise((resolve) => {
    const probe = new Image()
    probe.onload = () =>
      resolve(
        probe.naturalWidth > 0 ? { width: probe.naturalWidth, height: probe.naturalHeight } : null,
      )
    probe.onerror = () => resolve(null)
    probe.src = src
  })
}

/** 区域中「放得下」的位置与大小：按宽高比缩小到放得下；cap 为 true 时不超过原始尺寸。居中。 */
function fitBox(area: Size, shape: Size, cap: boolean) {
  const ratio = Math.min(area.width / shape.width, area.height / shape.height, cap ? 1 : Infinity)
  const width = shape.width * ratio
  const height = shape.height * ratio
  return { left: (area.width - width) / 2, top: (area.height - height) / 2, width, height }
}

/** 图片框（区域中的 box）变成视口中 rect 的样子：等比缩放到盖住 rect，再按 rect 的形状与圆角裁剪。 */
function flightTransform(
  areaRect: DOMRect,
  box: { left: number; top: number; width: number; height: number },
  rect: FlightRect,
) {
  const k = Math.max(rect.width / box.width, rect.height / box.height)
  const cx = areaRect.left + box.left + box.width / 2
  const cy = areaRect.top + box.top + box.height / 2
  const x = rect.left + rect.width / 2 - cx
  const y = rect.top + rect.height / 2 - cy
  // 裁剪在缩放之前的坐标中：可见部分是 rect 的大小除以 k，居中
  const insetX = Math.max(0, (box.width - rect.width / k) / 2)
  const insetY = Math.max(0, (box.height - rect.height / k) / 2)
  return {
    transform: `translate(${x}px, ${y}px) scale(${k})`,
    clip: `inset(${insetY}px ${insetX}px round ${rect.radius / k}px)`,
  }
}

/** 弹簧时长（毫秒），作为 transitionend 的兜底；「减少动态效果」时为 0。 */
export function springMs(el: Element): number {
  const v = getComputedStyle(el).getPropertyValue('--vl-motion-duration-spring').trim()
  const n = Number.parseFloat(v)
  return Number.isFinite(n) ? (v.endsWith('ms') ? n : n * 1000) : 0
}
