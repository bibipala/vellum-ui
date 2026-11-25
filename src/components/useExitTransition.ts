/**
 * 离场过渡结束后回调（组件库内部使用，不从入口导出）：元素切换到离场状态（`leaving` 为 true）后，等它自己的离场过渡
 * （CSS transition）真正结束再调用 `onExited`，用于淡出之后卸载元素、从列表中移除。时长只写在 CSS 里（动效令牌），
 * 脚本不另记一份。
 *
 * - 结束：元素自身的 transitionend / transitioncancel 到达，并且元素上已经没有进行中的过渡。几个属性同时过渡时等最后
 *   一个；打断进场的离场会让进场的过渡取消（transitioncancel），这时离场的过渡还在进行，不算结束。
 * - 没有过渡时立即结束：「减少动态效果」时时长为 0，不会产生过渡，也不会触发 transitionend；样式没有加载时同样如此。
 * - 兜底：按计算样式中的过渡时长（含延迟）加一点余量的定时器，过渡事件没有到达时（如页面在后台）也会结束。
 * - `leaving` 变回 false（离场途中又打开）时取消等待，元素从当前状态过渡回来。
 */
import { type RefObject, useLayoutEffect, useRef } from 'react'

/** 兜底定时器在过渡时长之外的余量（毫秒）：过渡事件在结束后的下一帧派发，正常情况下总是先到。 */
const FALLBACK_SLACK_MS = 50

/** 元素自身（不含子元素）是否还有没有结束的 CSS 过渡（暂停中的也算）。 */
function hasPendingTransition(el: Element): boolean {
  if (typeof el.getAnimations !== 'function' || typeof CSSTransition === 'undefined') return false
  return el
    .getAnimations()
    .some((a) => a instanceof CSSTransition && a.playState !== 'finished' && a.playState !== 'idle')
}

/** 毫秒数（`0.14s`、`140ms`）；无法解析时为 0。 */
const toMs = (v: string) => {
  const n = Number.parseFloat(v)
  if (!Number.isFinite(n)) return 0
  return v.trim().endsWith('ms') ? n : n * 1000
}

/** 计算样式中最长的「延迟 + 时长」（两个列表长度不同时按 CSS 的规则循环取值）。 */
function longestTransitionMs(el: Element): number {
  const style = getComputedStyle(el)
  const durations = style.transitionDuration.split(',').map(toMs)
  const delays = style.transitionDelay.split(',').map(toMs)
  let longest = 0
  for (let i = 0; i < Math.max(durations.length, delays.length); i++)
    longest = Math.max(
      longest,
      (delays[i % delays.length] ?? 0) + (durations[i % durations.length] ?? 0),
    )
  return longest
}

/** `leaving` 为 true 后，等 `ref` 指向的元素的离场过渡结束，再调用一次 `onExited`。 */
export function useExitTransition(
  ref: RefObject<HTMLElement | null>,
  leaving: boolean,
  onExited: () => void,
): void {
  const latest = useRef(onExited)
  useLayoutEffect(() => {
    latest.current = onExited
  })
  useLayoutEffect(() => {
    const el = ref.current
    if (!leaving || !el) return
    // 离场的样式已经提交：读取动画会先计算样式，离场的过渡此时已经开始
    if (!hasPendingTransition(el)) {
      latest.current()
      return
    }
    const stop = () => {
      clearTimeout(timer)
      el.removeEventListener('transitionend', onEnd)
      el.removeEventListener('transitioncancel', onEnd)
    }
    const finish = () => {
      stop()
      latest.current()
    }
    const onEnd = (e: TransitionEvent) => {
      if (e.target === el && !hasPendingTransition(el)) finish()
    }
    const timer = setTimeout(finish, longestTransitionMs(el) + FALLBACK_SLACK_MS)
    el.addEventListener('transitionend', onEnd)
    el.addEventListener('transitioncancel', onEnd)
    return stop
  }, [leaving, ref])
}
