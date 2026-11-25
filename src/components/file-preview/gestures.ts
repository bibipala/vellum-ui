/** 文件预览的指针手势：控制器区分松手、取消与双指接管，移动仍直接写入 transform。 */
import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { ImageViewHandle } from './ImageView.tsx'

/** 拖动超过这个距离（像素）才算拖动，否则是点击。 */
const SLOP = 6

interface Point {
  readonly x: number
  readonly y: number
}

type Gesture =
  | { kind: 'pending'; start: Point; onImage: boolean; noGesture: boolean; touch: boolean }
  | { kind: 'pan'; start: Point }
  | { kind: 'swipe'; start: Point; base: number }
  | { kind: 'dismiss'; start: Point }
  | { kind: 'pinch'; distance: number }
  | { kind: 'none' }

interface GestureOptions {
  readonly stage: RefObject<HTMLElement | null>
  readonly image: RefObject<ImageViewHandle | null>
  /** 当前项是图片（可以缩放）。 */
  readonly isImage: boolean
  /** 横向拖动换项（弹出式、多于一项）。 */
  readonly swipe?: {
    readonly begin: () => number
    readonly move: (offset: number) => void
    readonly end: (offset: number, velocity: number) => void
    readonly cancel: (animate: boolean) => void
  }
  /** 纵向拖动关闭（弹出式）。 */
  readonly dismiss?: {
    readonly move: (dx: number, dy: number) => void
    readonly end: (dx: number, dy: number, vy: number) => void
    readonly cancel: (motion: 'spring' | 'none') => void
  }
  /** 点击空白处（弹出式关闭）。 */
  readonly onBackgroundClick?: () => void
  /** 触屏单击图片（切换工具栏）。 */
  readonly onImageTap?: () => void
  /** 滚轮不按修饰键时缩放（弹出式）；否则只有按住 Ctrl（触控板双指缩放）时缩放，放大后滚轮平移。 */
  readonly wheelZooms: boolean
}

/** 最近 100ms 内的移动速度（像素 / 毫秒）。 */
function velocity(samples: { t: number; x: number; y: number }[]): Point {
  const last = samples.at(-1)
  if (!last) return { x: 0, y: 0 }
  const first = samples.find((s) => last.t - s.t <= 100) ?? last
  const dt = last.t - first.t
  return dt > 0 ? { x: (last.x - first.x) / dt, y: (last.y - first.y) / dt } : { x: 0, y: 0 }
}

/** 手势拥有的副作用集中在这里收尾；取消和双指接管永远不调用导航或关闭。 */
function createGestureController(options: () => GestureOptions) {
  const controller = {
    current: { kind: 'none' } as Gesture,
    finish(point: Point, speed: Point) {
      const g = controller.current
      const o = options()
      controller.current = { kind: 'none' }
      if (g.kind === 'pan') o.image.current?.panEnd(speed.x, speed.y)
      else if (g.kind === 'swipe') o.swipe?.end(g.base + point.x - g.start.x, speed.x)
      else if (g.kind === 'dismiss')
        o.dismiss?.end(point.x - g.start.x, point.y - g.start.y, speed.y)
      else if (g.kind === 'pinch') o.image.current?.pinchEnd()
      return g
    },
    cancel(animate = true) {
      const g = controller.current
      const o = options()
      controller.current = { kind: 'none' }
      if (g.kind === 'swipe') o.swipe?.cancel(animate)
      else if (g.kind === 'dismiss') o.dismiss?.cancel(animate ? 'spring' : 'none')
      else if (g.kind === 'pan') o.image.current?.panEnd(0, 0)
      else if (g.kind === 'pinch') o.image.current?.pinchEnd()
    },
    takeOverWithPinch(distance: number, center: Point) {
      // 先撤销轨道与背景的跟手效果，再读取图片位置，避免把关闭拖动的位移当成缩放起点。
      controller.cancel(false)
      const image = options().image.current
      image?.freeze()
      image?.pinchStart(center)
      controller.current = { kind: 'pinch', distance }
    },
  }
  return controller
}

export function useGestures(options: GestureOptions) {
  const opts = useRef(options)
  opts.current = options
  const pointers = useRef(new Map<number, Point>())
  const [gesture] = useState(() => createGestureController(() => opts.current))
  const samples = useRef<{ t: number; x: number; y: number }[]>([])
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null)
  const tapTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const pinchInfo = () => {
    const [a, b] = [...pointers.current.values()]
    if (!a || !b) return null
    return {
      distance: Math.hypot(a.x - b.x, a.y - b.y),
      center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    }
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const target = e.target as Element
    // 工具栏、导航按钮等不在舞台里；舞台里的按钮、播放控件、自定义内容不开始手势
    if (target.closest('button, a, input, textarea, select, [contenteditable="true"]')) return
    const noGesture = target.closest('[data-fp-no-gesture]') !== null
    if (noGesture && e.pointerType === 'mouse') return
    const o = opts.current
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    try {
      o.stage.current?.setPointerCapture(e.pointerId)
    } catch {
      // 合成的指针事件（测试、辅助工具）没有可捕获的指针
    }
    if (pointers.current.size === 2 && o.isImage) {
      const info = pinchInfo()
      if (info) {
        // 第二根手指放下：取消已经开始的单指手势，改为双指缩放
        gesture.takeOverWithPinch(info.distance, info.center)
      }
      return
    }
    if (pointers.current.size > 1) return
    samples.current = [{ t: e.timeStamp, x: e.clientX, y: e.clientY }]
    const onImage = o.isImage && o.image.current?.contains(e.clientX, e.clientY) === true
    gesture.current = {
      kind: 'pending',
      start: { x: e.clientX, y: e.clientY },
      onImage,
      noGesture,
      touch: e.pointerType !== 'mouse',
    }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const o = opts.current
    const g = gesture.current
    if (g.kind === 'pinch') {
      const info = pinchInfo()
      if (info && g.distance > 0)
        o.image.current?.pinchMove(info.distance / g.distance, info.center)
      return
    }
    samples.current.push({ t: e.timeStamp, x: e.clientX, y: e.clientY })
    if (samples.current.length > 8) samples.current.shift()
    if (g.kind === 'pending') {
      const dx = e.clientX - g.start.x
      const dy = e.clientY - g.start.y
      if (Math.hypot(dx, dy) < SLOP) return
      const horizontal = Math.abs(dx) > Math.abs(dy)
      if (!g.noGesture && o.isImage && o.image.current?.zoomed()) {
        o.image.current.freeze()
        o.image.current.panStart()
        gesture.current = { kind: 'pan', start: g.start }
      } else if (horizontal && o.swipe) {
        gesture.current = { kind: 'swipe', start: g.start, base: o.swipe.begin() }
      } else if (!horizontal && o.dismiss && !g.noGesture) {
        o.image.current?.freeze()
        gesture.current = { kind: 'dismiss', start: g.start }
      } else {
        gesture.current = { kind: 'none' }
        return
      }
      // 开始拖动后不再选中文字
      e.preventDefault()
    }
    const now = gesture.current
    if (now.kind === 'pan')
      o.image.current?.panMove(e.clientX - now.start.x, e.clientY - now.start.y)
    else if (now.kind === 'swipe') o.swipe?.move(now.base + e.clientX - now.start.x)
    else if (now.kind === 'dismiss')
      o.dismiss?.move(e.clientX - now.start.x, e.clientY - now.start.y)
  }

  const finish = (e: ReactPointerEvent<HTMLElement>) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.delete(e.pointerId)
    if (gesture.current.kind === 'pinch') {
      if (pointers.current.size < 2) gesture.finish({ x: e.clientX, y: e.clientY }, { x: 0, y: 0 })
      // 剩下的那根手指不再开始新的手势
      return
    }
    if (pointers.current.size > 0) return
    // 松手的位置与时间也算进去：停住一会儿再松手时速度为 0
    samples.current.push({ t: e.timeStamp, x: e.clientX, y: e.clientY })
    const g = gesture.finish({ x: e.clientX, y: e.clientY }, velocity(samples.current))
    if (g.kind === 'pending') tap(e, g)
  }

  const cancel = (e: ReactPointerEvent<HTMLElement>) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.clear()
    gesture.cancel()
    samples.current = []
    lastTap.current = null
    clearTimeout(tapTimer.current)
  }

  /** 单击与双击：触屏的双击自己识别（浏览器不一定给出 dblclick）；鼠标的双击用 dblclick 事件。 */
  const tap = (e: ReactPointerEvent<HTMLElement>, g: Extract<Gesture, { kind: 'pending' }>) => {
    const o = opts.current
    if (!g.onImage) {
      if (!g.noGesture) o.onBackgroundClick?.()
      return
    }
    if (!g.touch) return
    const prev = lastTap.current
    if (
      prev &&
      e.timeStamp - prev.t < 300 &&
      Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 30
    ) {
      lastTap.current = null
      clearTimeout(tapTimer.current)
      o.image.current?.toggle({ x: e.clientX, y: e.clientY })
      return
    }
    lastTap.current = { t: e.timeStamp, x: e.clientX, y: e.clientY }
    clearTimeout(tapTimer.current)
    tapTimer.current = setTimeout(() => opts.current.onImageTap?.(), 300)
  }

  useEffect(() => () => clearTimeout(tapTimer.current), [])

  // 滚轮：要阻止页面滚动，必须是非被动的原生监听
  useEffect(() => {
    const el = options.stage.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      const o = opts.current
      const target = e.target as Element
      if (target.closest('[data-fp-no-gesture]')) return
      const image = o.image.current
      if (!o.isImage || !image?.ready()) {
        if (o.wheelZooms) e.preventDefault()
        return
      }
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1
      if (e.ctrlKey || o.wheelZooms) {
        e.preventDefault()
        // 触控板双指缩放（Ctrl + 滚轮）的增量小而密，按更大的系数换算
        const k = e.ctrlKey ? 0.01 : 0.0015
        image.zoomBy(Math.exp(-e.deltaY * unit * k), { x: e.clientX, y: e.clientY }, 'quick')
      } else if (image.zoomed()) {
        e.preventDefault()
        image.freeze()
        image.panStart()
        image.panMove(-e.deltaX * unit, -e.deltaY * unit)
        image.panEnd(0, 0)
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [options.stage])

  const onDoubleClick = (e: React.MouseEvent<HTMLElement>) => {
    const o = opts.current
    if (!o.isImage || !o.image.current?.contains(e.clientX, e.clientY)) return
    o.image.current?.toggle({ x: e.clientX, y: e.clientY })
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: finish,
    onPointerCancel: cancel,
    onDoubleClick,
  }
}
