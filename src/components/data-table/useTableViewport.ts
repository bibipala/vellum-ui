/**
 * DataTable 的视口：滚动容器的尺寸与滚动位置、表头高度，以及虚拟滚动。
 *
 * - 边缘：内容是否滚到了固定列下面（data-scrolled-start / end）、是否横向溢出；滚动时同时关闭截断提示。
 * - 表头高度：虚拟滚动时行的位置从表头下方开始（scrollMargin）。
 * - 虚拟滚动：行的键只在数据变化时重新计算；焦点所在的行滚出可见区域时也保持挂载（键盘用户不失去位置）。
 * 估计行高按密度（只订阅主题中的密度）。
 */
import { useVirtualizer, type Virtualizer } from '@tanstack/react-virtual'
import { type FocusEvent, type RefObject, useLayoutEffect, useRef, useState } from 'react'
import { useDensity } from '../../theme/context.ts'
import { useItemKey, useRetainedFocus, useRetainedRange } from '../virtual.ts'

/** 估计行高（像素）：一行文字加单元格上下内边距（table-cell-padding-y），实际行高渲染后测量。 */
const ROW_ESTIMATE = { comfortable: 46, compact: 30 } as const
/** 虚拟滚动时可见区域外额外渲染的行数。 */
const OVERSCAN = 8

export interface TableViewportOptions<T> {
  /** 当前显示的行（排序后）。 */
  readonly rows: readonly T[]
  readonly rowKey: (row: T) => string
  /** 按键查找行在 rows 中的位置（与选择共用同一张表）。 */
  readonly indexOf: (key: string | number) => number
  /** 是否虚拟滚动（需要 height 或 fill）。 */
  readonly virtual: boolean
  /** 表格区域的高度（服务端与注水的第一次渲染按它计算第一屏）。 */
  readonly height: number | undefined
  /** 滚动时调用（关闭截断提示）。身份应当不变。 */
  readonly onScroll: () => void
}

export interface TableViewport {
  readonly scroller: RefObject<HTMLDivElement | null>
  readonly thead: RefObject<HTMLTableSectionElement | null>
  readonly headHeight: number
  readonly edges: { readonly start: boolean; readonly end: boolean; readonly overflow: boolean }
  readonly virtualizer: Virtualizer<HTMLDivElement, Element>
  /** 表体的 onFocus：记下焦点所在的行。 */
  readonly onBodyFocus: (e: FocusEvent<HTMLTableSectionElement>) => void
  /** 表体的 onBlur：焦点离开表体时不再保留。 */
  readonly onBodyBlur: (e: FocusEvent<HTMLTableSectionElement>) => void
}

export function useTableViewport<T>(o: TableViewportOptions<T>): TableViewport {
  const { rows, rowKey, virtual, onScroll } = o
  const density = useDensity()
  const scroller = useRef<HTMLDivElement>(null)
  const thead = useRef<HTMLTableSectionElement>(null)
  const estimate = ROW_ESTIMATE[density ?? 'comfortable']
  const [headHeight, setHeadHeight] = useState<number>(estimate)
  const [edges, setEdges] = useState({ start: false, end: false, overflow: false })

  useLayoutEffect(() => {
    const el = scroller.current
    const head = thead.current
    if (!el) return
    // 内容是否滚到了固定列下面（从右到左的页面中 scrollLeft 为负）
    const updateEdges = () => {
      const max = el.scrollWidth - el.clientWidth
      const x = Math.abs(el.scrollLeft)
      const start = x > 0.5
      const end = max - x > 0.5
      const overflow = max > 0.5
      setEdges((p) =>
        p.start === start && p.end === end && p.overflow === overflow
          ? p
          : { start, end, overflow },
      )
    }
    const measure = () => {
      updateEdges()
      if (head) setHeadHeight(head.offsetHeight)
    }
    measure()
    const handleScroll = () => {
      updateEdges()
      onScroll()
    }
    el.addEventListener('scroll', handleScroll, { passive: true })
    if (typeof ResizeObserver === 'undefined')
      return () => el.removeEventListener('scroll', handleScroll)
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    if (el.firstElementChild) observer.observe(el.firstElementChild)
    if (head) observer.observe(head)
    return () => {
      el.removeEventListener('scroll', handleScroll)
      observer.disconnect()
    }
  }, [onScroll])

  // 行的键：数据变化（排序、换页）时取键函数随之换新，虚拟列表重新取键；rowKey 常是内联函数，不跟着它换新，
  // 否则每次渲染都要为全部行重新计算位置
  const getItemKey = useItemKey(rows, rowKey)
  // 焦点所在的行：虚拟滚动时它滚出可见区域也保持挂载，否则行被卸载、焦点丢到 body 上（键盘用户失去位置）
  const retained = useRetainedFocus(rows, rowKey, o.indexOf)
  const rangeExtractor = useRetainedRange(virtual ? retained.index : -1)
  const onBodyFocus = (e: FocusEvent<HTMLTableSectionElement>) => {
    const tr = (e.target as Element).closest('tr[data-index]')
    retained.enter(tr ? Number(tr.getAttribute('data-index')) : -1)
  }
  const virtualizer = useVirtualizer({
    count: virtual ? rows.length : 0,
    enabled: virtual,
    rangeExtractor,
    getScrollElement: () => scroller.current,
    estimateSize: () => estimate,
    overscan: OVERSCAN,
    scrollMargin: headHeight,
    getItemKey,
    // 服务端与注水的第一次渲染没有滚动容器：两边都按这个尺寸渲染第一屏，结果一致
    initialRect: { width: 0, height: o.height ?? 480 },
  })

  return {
    scroller,
    thead,
    headHeight,
    edges,
    virtualizer,
    onBodyFocus,
    onBodyBlur: retained.onBlur,
  }
}
