/**
 * 截断提示（DataTable 内部）：只有文字真的被截断时，才在悬停（500ms 后）或键盘聚焦时显示完整内容（docs/11 §6.2「文字」）。
 *
 * 整个表格共用一个提示，而不是每个单元格包一个 Tooltip：虚拟滚动时行不断挂载，逐格创建弹层的开销与行数成正比。
 * 截断的元素带 `data-vl-truncate`；指针进入时比较 scrollWidth 与 clientWidth 判断是否真的被截断，再把一个不可见的
 * 定位点移到它上面，提示挂在定位点上。提示刚关闭（300ms 内）时移到另一个截断的元素，立即切换，与 Tooltip 一致。
 * 完整文字本来就在 DOM 中（只是视觉上被截断），读屏照常读到，提示只是视觉增强；所以提示不拦截指针（直接用 antd 的
 * Tooltip 以便给弹层加类名）：它常常盖在相邻的行上，不能挡住对那些行的悬停与点击。
 */

import { Tooltip as AntTooltip } from 'antd'
import {
  type FocusEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import styles from './data-table.module.css'

const SHOW_DELAY = 500
const WARM_MS = 300

interface Tip {
  readonly id: number
  readonly text: string
  readonly top: number
  readonly left: number
  readonly width: number
  readonly height: number
  readonly open: boolean
}

/** 是否真的被截断：截断的元素本身，或其中截断自己文字的链接、按钮（见样式中的 `.truncate > :is(a, button)`）。 */
const overflows = (el: Element) => el.scrollWidth > el.clientWidth
const isTruncated = (el: Element) =>
  overflows(el) || [...el.children].some((c) => c.matches('a, button') && overflows(c))

const truncatedIn = (target: EventTarget | null): HTMLElement | null => {
  if (!(target instanceof Element)) return null
  return (target.closest('[data-vl-truncate]') ??
    target.querySelector('[data-vl-truncate]')) as HTMLElement | null
}

/** 截断提示：返回挂在表格视口上的事件处理与要渲染的提示。 */
export function useTruncationTip(viewport: RefObject<HTMLElement | null>) {
  const [tip, setTip] = useState<Tip | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const current = useRef<Element | null>(null)
  const openNow = useRef(false)
  const warmUntil = useRef(0)
  const seq = useRef(0)

  const clear = useCallback(() => {
    if (timer.current !== undefined) clearTimeout(timer.current)
    timer.current = undefined
  }, [])

  const close = useCallback(() => {
    clear()
    current.current = null
    if (openNow.current) warmUntil.current = Date.now() + WARM_MS
    openNow.current = false
    setTip((t) => (t?.open ? { ...t, open: false } : t))
  }, [clear])

  const show = useCallback(
    (el: HTMLElement, immediate: boolean) => {
      if (current.current === el) return
      clear()
      current.current = el
      if (!isTruncated(el)) {
        if (openNow.current) close()
        return
      }
      const open = () => {
        timer.current = undefined
        const vp = viewport.current
        if (!vp || !el.isConnected || current.current !== el) return
        const r = el.getBoundingClientRect()
        const v = vp.getBoundingClientRect()
        openNow.current = true
        seq.current += 1
        setTip({
          id: seq.current,
          text: el.textContent ?? '',
          top: r.top - v.top,
          left: r.left - v.left,
          width: r.width,
          height: r.height,
          open: true,
        })
      }
      if (immediate || openNow.current || Date.now() < warmUntil.current) open()
      else timer.current = setTimeout(open, SHOW_DELAY)
    },
    [clear, close, viewport],
  )

  useEffect(() => clear, [clear])

  const handlers = {
    onPointerOver: (e: PointerEvent<HTMLElement>) => {
      if (e.pointerType === 'touch') return
      const el = (e.target as Element).closest?.('[data-vl-truncate]') as HTMLElement | null
      if (el && e.currentTarget.contains(el)) show(el, false)
      else if (current.current) close()
    },
    onPointerLeave: close,
    onFocus: (e: FocusEvent<HTMLElement>) => {
      // 只响应键盘焦点：鼠标点击得到的焦点按悬停处理
      if (!(e.target instanceof Element) || !e.target.matches(':focus-visible')) return
      const el = truncatedIn(e.target)
      if (el && e.currentTarget.contains(el)) show(el, true)
    },
    onBlur: close,
  }

  const node: ReactNode = tip ? (
    <AntTooltip key={tip.id} open={tip.open} title={tip.text} classNames={{ root: styles.tip }}>
      <span
        aria-hidden="true"
        className={styles.tipAnchor}
        style={{ top: tip.top, left: tip.left, width: tip.width, height: tip.height }}
      />
    </AntTooltip>
  ) : null

  return { handlers, node, close }
}
