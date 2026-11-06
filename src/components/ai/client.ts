/**
 * 与运行环境有关的两个 hook（组件库内部使用，不从入口导出）：
 * - useHydrated：服务端渲染与客户端注水的第一次渲染为 false，之后为 true；纯客户端挂载时一开始就是 true。
 *   用于服务端无法渲染、或两边结果不同的内容（Markdown 的清洗需要 DOM）：先输出两边一致的兜底内容，注水后再换掉，
 *   不产生注水不一致的警告。
 * - useReducedMotion：「减少动态效果」是否打开：系统设置（prefers-reduced-motion）或 ThemeProvider 的
 *   `reducedMotion`（根元素的 data-vl-reduced-motion）。服务端为 false。CSS 中的动效由令牌归零处理，
 *   这个 hook 用于由脚本驱动的动效（打字机）。
 */
import { useSyncExternalStore } from 'react'

const subscribeNothing = () => () => {}

/** 注水完成（或纯客户端渲染）之后为 true。 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  )
}

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
