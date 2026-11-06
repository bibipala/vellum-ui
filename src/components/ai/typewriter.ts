/**
 * 打字机：把不断变长的文字按片段到达的节奏匀速放出，而不是一块一块地出现。
 *
 * - 节奏模型（createPacer）与 React 无关：每到一个片段，把「还没放出的部分」平均分摊到预计的下一个片段到达之前
 *   （片段间隔的指数移动平均，限制在 50–500ms），两个片段之间速度不变；速度不低于每秒 30 个字。
 * - useTypewriter 用 requestAnimationFrame 推进，每帧最多更新一次；放出的永远是原文的前缀，并且不切开一个字
 *   （按字素簇对齐：emoji、国旗、带附加符号的字母不会只显示一半）。
 * - 挂载时已有的文字立即显示（如重新打开的历史回复），只有之后到达的部分逐字放出；不是在原文后面追加
 *   （整段被替换）时立即显示新的全文；`active` 为 false（流结束、减少动态效果）时直接显示全文。
 * 组件库内部使用（StreamingText），不从入口导出。
 */
import { useEffect, useRef, useState } from 'react'

const DEFAULT_INTERVAL_MS = 100
const MIN_HORIZON_MS = 50
const MAX_HORIZON_MS = 500
/** 片段间隔的指数移动平均中，新间隔的权重。 */
const EWMA_ALPHA = 0.3
/** 最低速度：每毫秒的字数（每秒 30 个字）。 */
const MIN_RATE = 30 / 1000

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/** 打字机的节奏模型。时间单位为毫秒（performance.now() 的值）。 */
export interface Pacer {
  /** 已经放出的字数（UTF-16 码元，未按字素对齐）。 */
  readonly shown: number
  /** 文字的总长度。 */
  readonly target: number
  /** 当前速度（每毫秒的字数）。 */
  readonly rate: number
  /** 文字变长到 `length`（在时刻 `now` 收到一个片段）。 */
  arrive(length: number, now: number): void
  /** 推进到时刻 `now`，返回已经放出的字数。 */
  advance(now: number): number
  /** 立即全部放出（流结束、文字被替换），并忘掉之前的节奏。 */
  reset(length: number): void
}

/** 创建节奏模型；`initialLength` 是一开始就显示的字数。 */
export function createPacer(initialLength: number): Pacer {
  let shown = initialLength
  let target = initialLength
  let rate = 0
  let interval = DEFAULT_INTERVAL_MS
  let lastArrival: number | null = null
  let lastTick = 0
  return {
    get shown() {
      return Math.floor(shown)
    },
    get target() {
      return target
    },
    get rate() {
      return rate
    },
    arrive(length, now) {
      if (length <= target) {
        target = length
        shown = Math.min(shown, length)
        return
      }
      if (lastArrival !== null) {
        const gap = clamp(now - lastArrival, 16, 2000)
        interval = clamp(
          (1 - EWMA_ALPHA) * interval + EWMA_ALPHA * gap,
          MIN_HORIZON_MS,
          MAX_HORIZON_MS,
        )
      }
      // 之前已经放完、处于空闲：从现在开始计时（不把空闲的时间算进去）
      if (shown >= target) lastTick = now
      lastArrival = now
      target = length
      rate = Math.max(MIN_RATE, (target - shown) / interval)
    },
    advance(now) {
      const dt = Math.max(0, now - lastTick)
      lastTick = now
      if (shown < target) shown = Math.min(target, shown + rate * dt)
      return Math.floor(shown)
    },
    reset(length) {
      shown = length
      target = length
      rate = 0
      interval = DEFAULT_INTERVAL_MS
      lastArrival = null
    },
  }
}

let segmenter: Intl.Segmenter | null | undefined

/** 字素簇最长按这个窗口查找（一般的 emoji 序列远短于它）。 */
const CLUSTER_WINDOW = 32

/**
 * 把截断位置向后移到字素簇的边界：不显示半个 emoji、国旗或带附加符号的字母。
 * 没有 Intl.Segmenter 时至少不切开代理对。
 */
export function alignToGrapheme(text: string, length: number): number {
  if (length <= 0) return 0
  if (length >= text.length) return text.length
  if (segmenter === undefined)
    segmenter =
      typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
        ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
        : null
  if (!segmenter) {
    const code = text.charCodeAt(length - 1)
    return code >= 0xd800 && code <= 0xdbff ? length + 1 : length
  }
  const start = Math.max(0, length - CLUSTER_WINDOW)
  const end = Math.min(text.length, length + CLUSTER_WINDOW)
  for (const { index, segment } of segmenter.segment(text.slice(start, end))) {
    const from = start + index
    const to = from + segment.length
    if (from >= length) return from
    if (to >= length) return to
  }
  return end
}

/**
 * 打字机 hook：返回此刻应当显示的文字（`text` 的前缀）。`active` 为 false 时原样返回 `text`。
 * 服务端与第一次渲染返回全文（挂载时已有的文字立即显示），所以注水时两边一致。
 */
export function useTypewriter(text: string, active: boolean): string {
  const [shown, setShown] = useState(text.length)
  const pacer = useRef<Pacer | null>(null)
  pacer.current ??= createPacer(text.length)
  const frame = useRef<number | null>(null)
  const latest = useRef(text)
  const shownRef = useRef(text.length)
  const wasActive = useRef(active)

  useEffect(() => {
    const p = pacer.current
    if (!p) return
    const previous = latest.current
    latest.current = text
    const stop = () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
      frame.current = null
    }
    const showAll = () => {
      stop()
      p.reset(text.length)
      shownRef.current = text.length
      setShown(text.length)
    }
    if (!active) {
      // 不活动时返回值就是全文，不需要为每个片段多渲染一次：只同步模型，状态等重新活动时再设
      wasActive.current = false
      stop()
      p.reset(text.length)
      shownRef.current = text.length
      return
    }
    // 刚打开（如流重新开始、减少动态效果被关闭）、或整段被替换：现有的文字立即显示，之后到达的才逐字放出
    const replaced = !text.startsWith(previous.slice(0, shownRef.current))
    if (!wasActive.current || replaced) {
      wasActive.current = true
      showAll()
      return
    }
    if (text.length === p.target) return
    p.arrive(text.length, performance.now())
    if (frame.current !== null) return
    const tick = (now: number) => {
      frame.current = null
      const value = latest.current
      const next = alignToGrapheme(value, p.advance(now))
      if (next !== shownRef.current) {
        shownRef.current = next
        setShown(next)
      }
      if (next < value.length) frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
  }, [text, active])

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
      frame.current = null
    },
    [],
  )

  if (!active) return text
  return shown >= text.length ? text : text.slice(0, shown)
}
