/**
 * 虚拟列表：只渲染视口内的行，行高可变（渲染后测量）。用于聊天消息、长成员列表等。
 */
import { useVirtualizer } from '@tanstack/react-virtual'
import { forwardRef, type ReactNode, type Ref, useEffect, useImperativeHandle, useRef } from 'react'
import styles from './VirtualList.module.css'

/** 通过 ref 控制滚动。 */
export interface VirtualListHandle {
  /** 滚动到某一行。 */
  scrollToIndex(index: number, align?: 'start' | 'center' | 'end'): void
  /** 滚动到底部。 */
  scrollToEnd(): void
  /** 当前是否位于底部（容差约一行半）。 */
  isAtEnd(): boolean
}

/** VirtualList 属性。 */
export interface VirtualListProps<T> {
  /**
   * The data.
   * @zh 数据。
   */
  readonly items: readonly T[]
  /**
   * Stable key of a row (such as the message ID).
   * @zh 行的稳定键（如消息 ID）。
   */
  readonly getKey: (item: T, index: number) => string
  /**
   * Renders a row.
   * @zh 渲染一行。
   */
  readonly renderItem: (item: T, index: number) => ReactNode
  /**
   * Estimated row height in pixels, 48 by default.
   * @zh 估计行高（像素），默认 48。
   */
  readonly estimateSize?: number
  /**
   * Number of extra rows rendered outside the visible area (overscan), 6 by default.
   * @zh 可视区域外额外渲染的行数，默认 6。
   */
  readonly overscan?: number
  /**
   * Called when scrolled near the top (to load earlier data).
   * @zh 滚动到顶部附近时回调（加载更早的数据）。
   */
  readonly onReachStart?: () => void
  /**
   * Called when scrolled near the bottom.
   * @zh 滚动到底部附近时回调。
   */
  readonly onReachEnd?: () => void
  /**
   * Shown when there are no items.
   * @zh 内容为空时显示。
   */
  readonly empty?: ReactNode
  /**
   * Accessible name.
   * @zh 读屏名称。
   */
  readonly 'aria-label'?: string
  /**
   * Test ID for locating the element in tests.
   * @zh 测试定位。
   */
  readonly 'data-testid'?: string
}

function VirtualListInner<T>(props: VirtualListProps<T>, ref: Ref<VirtualListHandle>) {
  const { items, getKey, renderItem, estimateSize = 48, overscan = 6 } = props
  const scrollRef = useRef<HTMLElement>(null)
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateSize,
    overscan,
    getItemKey: (i) => {
      const item = items[i]
      return item === undefined ? i : getKey(item, i)
    },
  })

  useImperativeHandle(
    ref,
    () => ({
      scrollToIndex: (index, align = 'start') => virtualizer.scrollToIndex(index, { align }),
      scrollToEnd: () => {
        if (items.length) virtualizer.scrollToIndex(items.length - 1, { align: 'end' })
      },
      isAtEnd: () => {
        const el = scrollRef.current
        if (!el) return true
        return el.scrollHeight - el.scrollTop - el.clientHeight < estimateSize * 1.5
      },
    }),
    [virtualizer, items.length, estimateSize],
  )

  const { onReachStart, onReachEnd } = props
  useEffect(() => {
    const el = scrollRef.current
    if (!el || (!onReachStart && !onReachEnd)) return
    const onScroll = () => {
      if (onReachStart && el.scrollTop < estimateSize) onReachStart()
      if (onReachEnd && el.scrollHeight - el.scrollTop - el.clientHeight < estimateSize)
        onReachEnd()
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [onReachStart, onReachEnd, estimateSize])

  return (
    <section
      ref={scrollRef}
      className={styles.scroller}
      aria-label={props['aria-label']}
      data-testid={props['data-testid']}
    >
      {items.length === 0 ? (
        (props.empty ?? null)
      ) : (
        <div className={styles.inner} style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((row) => (
            <div
              key={row.key}
              data-index={row.index}
              ref={virtualizer.measureElement}
              className={styles.row}
              style={{ transform: `translateY(${row.start}px)` }}
            >
              {renderItem(items[row.index] as T, row.index)}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/**
 * Virtualized list with variable row heights: a long list renders only its visible part, and scrolling to the end
 * can load more. The height comes from the parent.
 * @zh 虚拟列表（行高可变）：长列表只渲染可见部分，滚动到底部可加载更多。容器高度由父元素决定。
 * @category Data
 * @usage Message lists, long conversation lists, search results
 * @usageZh 消息列表、长会话列表、搜索结果
 */
export const VirtualList = forwardRef(VirtualListInner) as <T>(
  props: VirtualListProps<T> & { ref?: Ref<VirtualListHandle> },
) => ReturnType<typeof VirtualListInner>
