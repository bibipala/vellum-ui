/**
 * AppShell 宽布局收起、展开侧栏的动效（组件库内部使用，不从入口导出）。
 *
 * 网格的列一步到位：主内容区只重新布局一次，其中的 ResizeObserver（DataTable、ImageGrid、Splitter、Nav）也只触发一次。
 * 看到的移动由主内容区的 translate 完成：先放回切换前看到的位置，再沿弹簧过渡到 0，只移动已经画好的内容。展开时侧栏
 * 新出现的文字用 clip-path 同步揭开，不压在主内容区下面。时长与曲线只写在 CSS 里（app-shell.module.css 的
 * `[data-moving]`）；「减少动态效果」时时长为 0，不产生过渡，立即到位。
 *
 * - 连续移动的是主内容区内容的起始边（从左到右的布局中是左边，含内边距的变化）：标题、正文、表格开头的列跟着侧栏的边移动。
 *   靠结尾对齐的内容（右侧的按钮、占满宽度的卡片的右边）一开始就换到新布局中的位置，再随整体滑动到位。
 * - 可以中途打断：起点按当前看到的位置（含进行中的 translate）计算，再次切换时从半路折返。
 * - 过渡结束（或兜底定时器到时）后去掉 data-moving 与行内样式，静止时与没有动效时完全相同。
 *
 * 不过渡 grid-template-columns 的原因：那样主内容区每帧重新布局、重绘，其中的 ResizeObserver 每帧触发并更新 React 状态。
 * WebKitGTK 2.52（Tauri 在 Linux 上）中实测，280ms 内只画出 3–6 帧（每帧 31–75ms）；Chromium 同一台机器约 17 帧。
 */
import { type RefObject, useEffect, useLayoutEffect, useRef } from 'react'
import { FALLBACK_SLACK_MS, longestTransitionMs } from './useExitTransition.ts'

// 服务端没有布局，useLayoutEffect 换成 useEffect
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/** 元素当前（含进行中的过渡）的横向 translate（像素）。 */
function translateX(el: HTMLElement): number {
  const value = getComputedStyle(el).translate
  if (!value || value === 'none') return 0
  return Number.parseFloat(value) || 0
}

/** 主内容区内容的起始边相对 AppShell 根元素的横向位置（像素，含当前的 translate）。 */
function contentStart(main: HTMLElement, root: HTMLElement, rtl: boolean): number {
  const box = main.getBoundingClientRect()
  const left = root.getBoundingClientRect().left
  const style = getComputedStyle(main)
  return rtl
    ? box.right - Number.parseFloat(style.paddingRight) - left
    : box.left + Number.parseFloat(style.paddingLeft) - left
}

/**
 * `collapsed` 变化时让主内容区（与展开时的侧栏）从切换前的位置过渡到新位置。`active` 为 false（窄布局、没有侧栏）时
 * 不做动效，只记下位置。
 */
export function useCollapseMotion(
  rootRef: RefObject<HTMLElement | null>,
  frameRef: RefObject<HTMLElement | null>,
  sidebarRef: RefObject<HTMLElement | null>,
  mainRef: RefObject<HTMLElement | null>,
  collapsed: boolean,
  active: boolean,
): void {
  /** 主内容区内容的起始边在静止时（不含 translate）的位置。 */
  const settled = useRef<number | null>(null)
  /** 作废进行中的动效的清理（被下一次切换取代时）。 */
  const detach = useRef<(() => void) | null>(null)
  const previous = useRef(collapsed)

  // 记下静止的位置：开始时，以及布局因为别的原因变化时（密度、侧栏宽度、宽窄布局切换、窗口尺寸）
  useIsoLayoutEffect(() => {
    const main = mainRef.current
    const root = rootRef.current
    const frame = frameRef.current
    if (!main || !root || !frame) return
    const record = () => {
      const rtl = getComputedStyle(frame).direction === 'rtl'
      settled.current = contentStart(main, root, rtl) - translateX(main)
    }
    record()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(record)
    observer.observe(main)
    return () => observer.disconnect()
  }, [mainRef, rootRef, frameRef])

  useEffect(() => () => detach.current?.(), [])

  useIsoLayoutEffect(() => {
    if (previous.current === collapsed) return
    previous.current = collapsed
    const main = mainRef.current
    const root = rootRef.current
    const frame = frameRef.current
    const sidebar = sidebarRef.current
    if (!main || !root || !frame || !sidebar) return
    // 新的列已经提交：先读出进行中的 translate，再量新布局中静止的位置（这里的布局本来就要在绘制前完成）
    const rtl = getComputedStyle(frame).direction === 'rtl'
    const moving = translateX(main)
    const now = contentStart(main, root, rtl) - moving
    const before = settled.current
    settled.current = now
    detach.current?.()
    detach.current = null
    const clear = () => {
      delete frame.dataset.moving
      main.style.translate = ''
      sidebar.style.clipPath = ''
    }
    // 起点：切换前看到的位置
    const offset = before === null ? 0 : before + moving - now
    if (!active || Math.abs(offset) < 0.5) {
      clear()
      return
    }
    // 展开时侧栏结尾一侧被主内容区盖住的部分先剪掉，随主内容区一起揭开
    const covered = rtl ? offset : -offset
    delete frame.dataset.moving
    main.style.translate = `${offset}px`
    sidebar.style.clipPath =
      covered > 0 ? (rtl ? `inset(0 0 0 ${covered}px)` : `inset(0 ${covered}px 0 0)`) : ''
    // 让起点先生效（只计算样式，不重新布局），再打开过渡、设置终点
    void getComputedStyle(main).translate
    void getComputedStyle(sidebar).clipPath
    frame.dataset.moving = ''
    main.style.translate = '0px'
    if (covered > 0) sidebar.style.clipPath = 'inset(0px)'
    // 「减少动态效果」时时长为 0，不产生过渡：立即结束（读取动画会先计算样式，过渡此时已经开始）。
    // 不支持 Web Animations 的环境同样立即结束
    const transition =
      typeof main.getAnimations === 'function' && typeof CSSTransition !== 'undefined'
        ? main
            .getAnimations()
            .find(
              (a): a is CSSTransition =>
                a instanceof CSSTransition &&
                a.transitionProperty === 'translate' &&
                a.playState !== 'idle' &&
                a.playState !== 'finished',
            )
        : undefined
    if (!transition) {
      clear()
      return
    }
    // 只认这一次的过渡：被取代的上一次过渡会在之后派发 transitioncancel，不能把这一次也清理掉
    let over = false
    const finish = () => {
      if (over) return
      over = true
      clearTimeout(timer)
      detach.current = null
      clear()
    }
    const timer = setTimeout(finish, longestTransitionMs(main) + FALLBACK_SLACK_MS)
    // 结束，或被取消（如切到窄布局，过渡规则不再适用）时清理
    transition.finished.then(finish, finish)
    detach.current = () => {
      over = true
      clearTimeout(timer)
    }
  }, [collapsed, active, mainRef, rootRef, frameRef, sidebarRef])
}
