import { expect } from 'vitest'

/**
 * 在触发变化前监听样式与动画帧，捕获并暂停指定属性的新 CSS 过渡。
 * 同一元素上的其他新过渡也一起暂停，透明度与变换不会因驱动交互的耗时而错开。
 * 保留真实 CSS、缓动和中断行为；轮询只等过渡创建，不重试中间值断言。
 */
export async function pauseTransition(
  get: () => Element | null | undefined,
  property: string,
  change: () => unknown,
) {
  const previous = new Set(get()?.getAnimations() ?? [])
  let captured: CSSTransition | undefined
  let animations: Animation[] = []
  let frame = 0
  const capture = () => {
    if (captured) return
    const current = (get()?.getAnimations() ?? []).filter((animation) => !previous.has(animation))
    captured = current.find(
      (animation): animation is CSSTransition =>
        animation instanceof CSSTransition && animation.transitionProperty === property,
    )
    if (captured) {
      animations = current
      for (const animation of animations) animation.pause()
    }
  }
  const tick = () => {
    capture()
    if (!captured) frame = requestAnimationFrame(tick)
  }
  const observer = new MutationObserver(capture)
  observer.observe(document.body, { subtree: true, childList: true, attributes: true })
  frame = requestAnimationFrame(tick)
  try {
    await change()
    capture()
    await expect.poll(() => captured, { timeout: 3000 }).toBeDefined()
    await Promise.all(animations.map((animation) => animation.ready))
  } finally {
    observer.disconnect()
    cancelAnimationFrame(frame)
  }
  return {
    /** 按各条真实过渡自身的总时长定位（含延迟），0 为起点，1 为终点。 */
    at(progress: number) {
      for (const animation of animations) {
        const duration = Number(animation.effect?.getComputedTiming().endTime)
        expect(duration, '真实过渡有有限的正时长').toBeGreaterThan(0)
        expect(Number.isFinite(duration)).toBe(true)
        animation.currentTime = duration * progress
      }
    },
    /** 从当前进度恢复播放，让真实的结束事件和组件状态机完成清理。 */
    play() {
      for (const animation of animations) animation.play()
    },
  }
}
