/**
 * 组件库内部：对话框类弹层（Modal、Drawer、Lightbox、危险确认）的焦点约束，不从入口导出。
 *
 * - 激活时，焦点不在对话框内就移到对话框根元素上（根元素没有 tabindex 时补上 -1，如 Drawer 的面板）；
 * - `Tab` / `Shift+Tab` 在对话框内循环：到最后一个可聚焦元素时回到第一个，反之亦然；焦点意外落到对话框外时拉回；
 * - `restoreFocus` 时，停用或卸载后把焦点还给激活前的元素（antd 的 Modal、Drawer 自己会还，Lightbox 需要）。
 *
 * 为什么不直接用 antd：rc-dialog / rc-drawer 的焦点锁只在面板已经挂载后才生效，每个实例第一次打开时
 * （以及每个 modal.confirm）都没有焦点锁，Drawer 第一次打开时焦点也不会进入面板。
 *
 * 用法：在对话框内容中放一个 `<FocusScope active={open} />`，它渲染一个隐藏元素，向上找到 `role="dialog"` 的根元素。
 * 多个对话框叠放时只有最上面的一个生效。
 */
import { useEffect, useRef } from 'react'

const TABBABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]',
  '[contenteditable="true"]',
].join(',')

/** 根元素内按 Tab 顺序可达的元素（不可见、tabindex 为负的不算）。 */
function tabbables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(TABBABLE)].filter(
    (el) => el.tabIndex >= 0 && el.getClientRects().length > 0,
  )
}

/** 激活中的对话框根元素，最后一个在最上面。 */
const stack: HTMLElement[] = []

function onKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Tab' || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return
  const root = stack.at(-1)
  if (!root) return
  const list = tabbables(root)
  const active = document.activeElement
  const first = list[0]
  const last = list.at(-1)
  if (!first || !last) {
    e.preventDefault()
    root.focus({ preventScroll: true })
    return
  }
  if (!(active instanceof Node) || !root.contains(active)) {
    e.preventDefault()
    ;(e.shiftKey ? last : first).focus()
  } else if (e.shiftKey && (active === first || active === root)) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && active === last) {
    e.preventDefault()
    first.focus()
  }
}

/** FocusScope 属性。 */
export interface FocusScopeProps {
  /** 是否生效（对话框打开时）。 */
  readonly active: boolean
  /** 停用或卸载后把焦点还给激活前的元素。 */
  readonly restoreFocus?: boolean
}

/** 对话框的焦点约束：见文件说明。 */
export function FocusScope({ active, restoreFocus }: FocusScopeProps) {
  const marker = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!active) return
    const root = marker.current?.closest<HTMLElement>('[role="dialog"]')
    if (!root) return
    const previous = document.activeElement
    if (!root.contains(document.activeElement)) {
      if (!root.hasAttribute('tabindex')) root.tabIndex = -1
      root.focus({ preventScroll: true })
    }
    stack.push(root)
    if (stack.length === 1) window.addEventListener('keydown', onKeyDown, true)
    return () => {
      const i = stack.lastIndexOf(root)
      if (i >= 0) stack.splice(i, 1)
      if (stack.length === 0) window.removeEventListener('keydown', onKeyDown, true)
      if (restoreFocus && previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true })
    }
  }, [active, restoreFocus])
  return <span ref={marker} hidden />
}
