/**
 * 「减少动态效果」是否打开（组件库内部使用，不从入口导出）：系统设置（prefers-reduced-motion）或 ThemeProvider 的
 * `reducedMotion`（根元素的 data-vl-reduced-motion）。服务端为 false，任一设置变化时立即更新。
 *
 * CSS 中的动效由令牌归零处理（base.css）；这个 hook 用于由脚本驱动的动效（打字机），以及从令牌读取时长、需要在
 * 设置变化时重新读取的地方（图表）。
 */
import { useSyncExternalStore } from 'react'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function readReducedMotion(): boolean {
  if (typeof document === 'undefined') return false
  if (document.documentElement.dataset.vlReducedMotion === 'true') return true
  return typeof matchMedia === 'function' && matchMedia(REDUCED_MOTION_QUERY).matches
}

function subscribeReducedMotion(onChange: () => void): () => void {
  const mql = typeof matchMedia === 'function' ? matchMedia(REDUCED_MOTION_QUERY) : null
  mql?.addEventListener('change', onChange)
  // ThemeProvider 在根元素上设置 data-vl-reduced-motion；应用内开关切换时它会变化
  const observer = typeof MutationObserver === 'function' ? new MutationObserver(onChange) : null
  observer?.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-vl-reduced-motion'],
  })
  return () => {
    mql?.removeEventListener('change', onChange)
    observer?.disconnect()
  }
}

/** 「减少动态效果」是否打开（系统设置或应用内开关）。 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, readReducedMotion, () => false)
}
