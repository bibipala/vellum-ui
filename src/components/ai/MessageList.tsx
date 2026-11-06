/**
 * 消息列表：虚拟化（只渲染可见的消息，DOM 节点数与消息数量无关，行高可变），贴底滚动。
 *
 * 贴底由 TanStack Virtual 的「以末端为锚」完成（`anchorTo: 'end'`）：位于末端时，新消息与正在增长的最后一条消息
 * 都让视图保持在末端；顶部插入更早的消息时按可见的那一条保持位置，不跳动。本组件在此之上加「用户意图」：
 * 滚轮、触摸、键盘向上，或拖动滚动条时立即暂停贴底（把末端阈值设为 -1，虚拟化库就不再跟随），显示「回到最新」；
 * 滚回末端时恢复。滚动停下后视图不在末端（如焦点移到上方的消息、页内查找），同样暂停。
 *
 * 读屏：列表不是实时区域（虚拟化时向上滚动会挂载旧消息，实时区域会把它们当作新内容读出来）。生成中列表带
 * `aria-busy`，回复完成时由一个礼貌的状态区读一次这条回复，不逐字播报。
 */
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  forwardRef,
  type KeyboardEvent,
  memo,
  type PointerEvent,
  type ReactNode,
  type Ref,
  type TouchEvent,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type WheelEvent,
} from 'react'
import { useT } from '../../i18n/index.ts'
import { Icon } from '../Icon.tsx'
import type { BaseProps } from '../layout.tsx'
import hidden from '../visually-hidden.module.css'
import styles from './message-list.module.css'

/** 离末端多近算「在末端」（像素）：在这个范围内，新内容让视图跟到末端，用户滚回这里恢复贴底。 */
const END_THRESHOLD = 24

/**
 * Controls the scrolling of a MessageList through `ref`.
 * @zh 通过 ref 控制 MessageList 的滚动。
 */
export interface MessageListHandle {
  /**
   * Scrolls to the end and follows new content again, for example after sending a message. `smooth` animates the
   * scroll (it jumps when motion is reduced).
   * @zh 滚动到末端并恢复贴底，如发送消息之后。`smooth` 为平滑滚动（减少动态效果时直接跳到末端）。
   */
  scrollToEnd(options?: { readonly smooth?: boolean }): void
  /**
   * Scrolls to a message; following pauses unless it ends at the end.
   * @zh 滚动到某条消息；不在末端时暂停贴底。
   */
  scrollToIndex(index: number, align?: 'start' | 'center' | 'end'): void
  /**
   * Whether the view is at the end (within 24 px).
   * @zh 视图是否在末端（24px 以内）。
   */
  isAtEnd(): boolean
}

/**
 * Props of MessageList.
 * @zh MessageList 属性。
 */
export interface MessageListProps<T> extends Pick<BaseProps, 'testId'> {
  /**
   * The messages, oldest first.
   * @zh 消息，最早的在前。
   */
  readonly items: readonly T[]
  /**
   * Stable key of a message (such as its ID); keeps the position when earlier messages are inserted.
   * @zh 消息的稳定键（如消息 ID）；在前面插入更早的消息时据此保持位置。
   */
  readonly getKey: (item: T, index: number) => string
  /**
   * Renders a message, usually a Message. A message is rendered again when the item, its index or this function
   * changes: an inline function updates every visible message on each render, a stable function (`useCallback`)
   * must change when other data it reads changes.
   * @zh 渲染一条消息，通常是 Message。消息本身、它的位置或这个函数变化时重新渲染：内联函数在每次渲染时更新所有可见的消息；
   * 稳定的函数（`useCallback`）在它读取的其他数据变化时也要随之变化。
   */
  readonly renderItem: (item: T, index: number) => ReactNode
  /**
   * Estimated height of a message in pixels, used until it is measured.
   * @zh 消息的估计高度（像素），测量之前使用。
   * @default 120
   */
  readonly estimateSize?: number
  /**
   * Number of messages rendered outside the visible area on each side (overscan).
   * @zh 可视区域两侧额外渲染的消息数。
   * @default 4
   */
  readonly overscan?: number
  /**
   * Set while the last message is being generated: the list is marked `aria-busy`, and when it turns off, screen
   * readers hear the finished message once (instead of every piece as it arrives).
   * @zh 最后一条消息生成中时设置：列表标记为 `aria-busy`；变回 false 时读屏读一次完成的消息（而不是逐段播报）。
   */
  readonly streaming?: boolean
  /**
   * Called while the person scrolls near the top (within half the visible height), to load earlier messages.
   * Insert them at the start of `items`; the visible messages stay in place. Leave it out when there is nothing
   * more to load.
   * @zh 向上滚动到顶部附近（可见高度的一半以内）时调用，用于加载更早的消息。把它们插到 `items` 的开头，可见的消息位置不变。
   * 没有更早的消息时不要传。
   */
  readonly onReachStart?: () => void
  /**
   * Shows "Loading earlier messages" at the top and stops calling `onReachStart` while true.
   * @zh 为 true 时在顶部显示「正在加载更早的消息」，并且不再调用 `onReachStart`。
   */
  readonly loadingStart?: boolean
  /**
   * Shown when there are no messages, such as a welcome text with PromptSuggestions.
   * @zh 没有消息时显示，如欢迎语与 PromptSuggestions。
   */
  readonly empty?: ReactNode
  /**
   * Accessible name of the list; "Conversation" by default.
   * @zh 列表的读屏名称，默认「对话」。
   */
  readonly 'aria-label'?: string
}

/** 「减少动态效果」：系统设置或应用内开关（ThemeProvider 把动效时长令牌设为 0）。 */
function prefersReducedMotion(el: Element): boolean {
  const base = getComputedStyle(el).getPropertyValue('--vl-motion-duration-base').trim()
  if (base === '0ms' || base === '0s' || base === '0') return true
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** 按键是否在可编辑元素中（其中的方向键移动光标，不滚动列表）。 */
function isEditable(target: EventTarget): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  )
}

/**
 * 一行的内容。滚动引起的重新渲染（可见范围变化）中，使用方的属性没有变（同一个 renderItem、同一条消息），已经在屏幕上的
 * 消息不必重新渲染，只挂载新进入的消息；流式输出时使用方重新渲染，renderItem 是新的函数，各行照常更新。
 */
const RowContent = memo(function RowContent<T>(props: {
  readonly item: T
  readonly index: number
  readonly render: (item: T, index: number) => ReactNode
}) {
  return props.render(props.item, props.index)
}) as <T>(props: {
  readonly item: T
  readonly index: number
  readonly render: (item: T, index: number) => ReactNode
}) => ReactNode

function MessageListInner<T>(props: MessageListProps<T>, ref: Ref<MessageListHandle>) {
  const { items, getKey, renderItem, estimateSize = 120, overscan = 4 } = props
  const t = useT()
  const scrollRef = useRef<HTMLElement>(null)
  // 贴底：React 状态驱动外观与虚拟化库的阈值；ref 供事件处理中同步读取
  const [following, setFollowing] = useState(true)
  const followingRef = useRef(true)
  const [jump, setJump] = useState({ visible: false, count: 0 })
  // 暂停时最后一条消息的键：之后追加的消息数显示在「回到最新」上
  const pausedLastKey = useRef<string | null>(null)
  const dragging = useRef(false)
  // 拖动滚动条时，最后一次滚动是否到了末端
  const dragAtEnd = useRef(false)
  const smoothing = useRef(false)
  const wasScrolling = useRef(false)
  const touchY = useRef<number | null>(null)

  const keyAt = (i: number) => {
    const item = items[i]
    return item === undefined ? String(i) : getKey(item, i)
  }

  const virtualizer = useVirtualizer<HTMLElement, HTMLLIElement>({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateSize,
    overscan,
    getItemKey: keyAt,
    // 以末端为锚：在末端时跟随增长与追加；顶部插入时保持可见内容的位置
    anchorTo: 'end',
    followOnAppend: true,
    // 暂停贴底时阈值为 -1：距离永远不小于它，虚拟化库不再把视图当作在末端
    scrollEndThreshold: following ? END_THRESHOLD : -1,
    // 首次显示就在末端：初始位置取估计的总高度（浏览器会把它限制到实际的最大滚动位置）
    initialOffset: () => items.length * estimateSize,
    // 消息增长、测量时直接改写位置与总高度，不重新渲染整个列表（流式输出时每秒几十次）
    directDomUpdates: true,
    onChange: (instance) => {
      // 滚动停下（150ms 没有新的滚动）：贴底中却不在末端，说明视图被别的方式移走了（焦点、页内查找），暂停
      const scrolling = instance.isScrolling
      if (wasScrolling.current && !scrolling) settle()
      wasScrolling.current = scrolling
    },
  })

  // 离末端的距离直接从元素读取：总高度已由虚拟化库写入，行的溢出被裁切，与虚拟化库的布局一致；
  // 不读虚拟化库自己记录的位置，它在同一个滚动事件中可能还没更新
  const distanceFromEnd = () => {
    const el = scrollRef.current
    return el ? Math.max(el.scrollHeight - el.clientHeight - el.scrollTop, 0) : 0
  }

  const updateJump = () => {
    const visible = !followingRef.current && distanceFromEnd() > END_THRESHOLD
    let count = 0
    if (visible && pausedLastKey.current !== null) {
      for (let i = items.length - 1; i >= 0; i--) {
        if (keyAt(i) === pausedLastKey.current) break
        count++
      }
      if (count === items.length) count = 0 // 暂停时的最后一条已经不在列表中
    }
    setJump((prev) =>
      prev.visible === visible && prev.count === count ? prev : { visible, count },
    )
  }

  const pause = () => {
    if (!followingRef.current) return
    followingRef.current = false
    smoothing.current = false
    // 立即生效，不等下一次渲染：正在流式增长时，下一次测量就不能再把视图拉回末端
    virtualizer.options.scrollEndThreshold = -1
    pausedLastKey.current = items.length ? keyAt(items.length - 1) : null
    setFollowing(false)
  }

  const resume = () => {
    if (followingRef.current) return
    followingRef.current = true
    virtualizer.options.scrollEndThreshold = END_THRESHOLD
    pausedLastKey.current = null
    setFollowing(true)
  }

  function settle() {
    if (!followingRef.current || smoothing.current || dragging.current) return
    if (distanceFromEnd() > END_THRESHOLD) {
      pause()
      updateJump()
    }
  }

  const scrollToEnd = (smooth: boolean) => {
    const el = scrollRef.current
    resume()
    const animate = smooth && el !== null && !prefersReducedMotion(el)
    smoothing.current = animate
    virtualizer.scrollToEnd({ behavior: animate ? 'smooth' : 'auto' })
    updateJump()
  }

  useImperativeHandle(ref, () => ({
    scrollToEnd: (options) => scrollToEnd(Boolean(options?.smooth)),
    scrollToIndex: (index, align = 'start') => {
      pause()
      virtualizer.scrollToIndex(index, { align })
    },
    isAtEnd: () => distanceFromEnd() <= END_THRESHOLD,
  }))

  // 暂停时内容还在增长：「回到最新」的出现与新消息数随之更新
  useLayoutEffect(() => {
    if (!followingRef.current) updateJump()
  })

  // 列表从空变为有消息（如挂载之后才加载的历史）：虚拟化库的「追加时跟随」在这种情况下不起作用，这里直接到末端
  const hadItems = useRef(items.length > 0)
  useLayoutEffect(() => {
    const has = items.length > 0
    if (has && !hadItems.current && followingRef.current) virtualizer.scrollToEnd()
    hadItems.current = has
  })

  // 滚动：回到末端时恢复贴底；暂停时向上滚到顶部附近，加载更早的消息。
  // 只订阅一次：虚拟化库在它自己的滚动监听中同步重新渲染（flushSync），如果每次渲染都重新订阅，监听会在
  // 同一个事件的派发过程中被移除又加上，这次事件就收不到了
  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const distance = distanceFromEnd()
    if (smoothing.current && distance <= END_THRESHOLD) smoothing.current = false
    // 拖动滚动条时不恢复（不和拖动抢位置），只记下是否拖到了末端，松开时再决定
    if (dragging.current) dragAtEnd.current = distance <= END_THRESHOLD
    else if (!followingRef.current && distance <= END_THRESHOLD) resume()
    updateJump()
    if (
      props.onReachStart &&
      !props.loadingStart &&
      !followingRef.current &&
      el.scrollTop < el.clientHeight / 2
    )
      props.onReachStart()
  }
  const latestOnScroll = useRef(onScroll)
  latestOnScroll.current = onScroll
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const listener = () => latestOnScroll.current()
    // 捕获阶段：先于虚拟化库自己的监听执行。它在监听中同步渲染、测量新进入的消息，内容可能随之变高；这里读到的是
    // 用户滚动到的位置（如拖到底），恢复贴底也在它处理之前生效
    el.addEventListener('scroll', listener, { passive: true, capture: true })
    return () => el.removeEventListener('scroll', listener, { capture: true })
  }, [])

  // —— 用户向上滚动的意图：在滚动事件之前就暂停，流式增长不会和用户抢滚动位置 ——
  // 只要列表能滚动就算：滚轮与触摸由合成线程直接滚动，事件到达时 scrollTop 可能已经是新的位置
  const scrollable = () => {
    const el = scrollRef.current
    return el !== null && el.scrollHeight > el.clientHeight
  }

  const onWheel = (e: WheelEvent<HTMLElement>) => {
    if (e.deltaY < 0 && !e.ctrlKey && scrollable()) pause()
  }
  const onTouchStart = (e: TouchEvent<HTMLElement>) => {
    touchY.current = e.touches[0]?.clientY ?? null
  }
  const onTouchMove = (e: TouchEvent<HTMLElement>) => {
    const y = e.touches[0]?.clientY
    if (y === undefined) return
    // 手指向下移动，内容向上滚
    if (touchY.current !== null && y > touchY.current + 2 && scrollable()) pause()
    touchY.current = y
  }
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    // 已被内部组件处理（如工具栏的 Home / End）或在输入框中：不是滚动列表
    if (e.defaultPrevented || isEditable(e.target) || !scrollable()) return
    const onList = e.target === scrollRef.current
    if (
      e.key === 'ArrowUp' ||
      e.key === 'PageUp' ||
      e.key === 'Home' ||
      (onList && e.key === ' ' && e.shiftKey)
    )
      pause()
  }
  // 拖动滚动条：按下时暂停，松开时如果在末端就恢复。滚动条在元素的内容区之外
  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    const el = scrollRef.current
    if (!el || e.target !== el || e.button !== 0) return
    const x = e.clientX - el.getBoundingClientRect().left
    if (x >= el.clientLeft && x < el.clientLeft + el.clientWidth) return
    dragging.current = true
    dragAtEnd.current = distanceFromEnd() <= END_THRESHOLD
    pause()
    const release = () => {
      dragging.current = false
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', release)
      // 松开时在末端（或只是按了一下没有拖动）：恢复贴底，并跟到测量之后真正的末端
      if (dragAtEnd.current) scrollToEnd(false)
      else updateJump()
    }
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', release)
  }

  // 读屏：回复完成时读一次（不逐字播报）
  const [announcement, setAnnouncement] = useState('')
  const wasStreaming = useRef(Boolean(props.streaming))
  useEffect(() => {
    const was = wasStreaming.current
    wasStreaming.current = Boolean(props.streaming)
    if (!was || props.streaming) return
    const row = scrollRef.current?.querySelector(`[data-index="${items.length - 1}"]`)
    if (!row) return
    const parts = [...row.querySelectorAll('[data-vl-announce]')]
      .map((n) => n.textContent?.trim() ?? '')
      .filter(Boolean)
    setAnnouncement(parts.length ? parts.join('. ') : (row.textContent?.trim() ?? ''))
  })

  const jumpLabel = t('messageList.latest')
  const rows = virtualizer.getVirtualItems()
  const last = items.length - 1
  return (
    <div className={styles.root} data-testid={props.testId}>
      <section
        ref={scrollRef}
        className={styles.scroller}
        aria-label={props['aria-label'] ?? t('messageList.label')}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: 滚动区要能用键盘聚焦，才能用方向键、翻页键滚动（键盘可达）
        tabIndex={0}
        data-following={following || undefined}
        onWheel={onWheel}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
      >
        {items.length === 0 ? (
          <div className={styles.empty}>{props.empty}</div>
        ) : (
          <ul
            ref={virtualizer.containerRef}
            className={styles.inner}
            aria-busy={props.streaming || undefined}
          >
            {rows.map((row) => (
              <li
                key={row.key}
                ref={virtualizer.measureElement}
                data-index={row.index}
                data-last={row.index === last || undefined}
                className={styles.row}
                aria-posinset={row.index + 1}
                aria-setsize={items.length}
              >
                <div className={styles.rowInner}>
                  <RowContent item={items[row.index] as T} index={row.index} render={renderItem} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {props.loadingStart && (
        <div className={styles.loadingStart} role="status">
          <span className={styles.spin}>
            <Icon name="loader" size={14} />
          </span>
          {t('messageList.loadingEarlier')}
        </div>
      )}
      {jump.visible && (
        <button
          type="button"
          className={styles.jump}
          data-vl-state=""
          onClick={() => {
            scrollToEnd(true)
            // 按钮随即消失：焦点留在列表上（而不是落到 body），键盘可以继续滚动
            scrollRef.current?.focus({ preventScroll: true })
          }}
        >
          <Icon name="arrow-down" />
          {jumpLabel}
          {jump.count > 0 && (
            <span className={styles.count}>
              {t('messageList.newMessages', { count: jump.count })}
            </span>
          )}
        </button>
      )}
      <div className={hidden.hidden} role="status">
        {announcement}
      </div>
    </div>
  )
}

/**
 * A virtualized list of messages that stays at the latest message: only the visible messages are rendered (the
 * number of DOM nodes does not depend on the number of messages, and heights can vary), and new messages or a
 * reply that is still growing keep the view at the end. The height comes from the parent.
 *
 * **Interaction**: it opens at the end. Scrolling up (wheel, touch, keyboard or the scroll bar) pauses following
 * and shows "Back to latest" at the bottom center, with the number of new messages; pressing it scrolls smoothly to
 * the end (it jumps when motion is reduced) and follows again, and so does scrolling back to the end. Earlier
 * messages inserted at the start (`onReachStart`) do not move the visible ones. The list can be focused with `Tab`
 * and scrolled with the arrow keys, `Page Up` / `Page Down` and `Home` / `End`. Screen readers are not interrupted
 * by every piece of a reply: the list is `aria-busy` while `streaming`, and the finished reply is announced once.
 * @zh 虚拟化的消息列表，停留在最新的消息上：只渲染可见的消息（DOM 节点数与消息数量无关，高度可以不同），新消息与仍在增长
 * 的回复都让视图保持在末端。高度由父元素决定。
 *
 * **交互**：打开时就在末端。向上滚动（滚轮、触摸、键盘、滚动条）会暂停贴底，并在底部居中显示「回到最新」与新消息数；按下后
 * 平滑滚到末端（减少动态效果时直接跳过去）并恢复贴底，自己滚回末端也会恢复。在开头插入更早的消息（`onReachStart`）时，
 * 可见的消息不会移动。列表可以用 `Tab` 聚焦，用方向键、`Page Up` / `Page Down`、`Home` / `End` 滚动。读屏不会被回复的
 * 每一段打断：`streaming` 时列表为 `aria-busy`，回复完成后读一次。
 * @category AI
 * @usage AI chat conversations, long chat histories with earlier messages loaded on scroll
 * @usageZh AI 对话、向上滚动加载更早消息的长聊天记录
 */
export const MessageList = forwardRef(MessageListInner) as <T>(
  props: MessageListProps<T> & { ref?: Ref<MessageListHandle> },
) => ReturnType<typeof MessageListInner>
