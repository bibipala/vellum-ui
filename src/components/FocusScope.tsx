/**
 * 组件库内部：对话框类弹层（Modal、Drawer、Lightbox、危险确认）的焦点约束，不从入口导出。
 *
 * - 激活时，焦点不在对话框内就移到对话框根元素上（根元素没有 tabindex 时补上 -1，如 Drawer 的面板）；对话框这时
 *   还没有显示出来时（再次打开的 Drawer：面板保持挂载，要等动效切换类名才显示），等它显示出来再移入；
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

const POPUP_REFERENCES = ['aria-describedby', 'aria-controls', 'aria-owns'] as const
const POPUP_ROLES = new Set(['tooltip', 'dialog', 'menu', 'listbox', 'tree'])
const SCOPE_ELEMENTS = `${TABBABLE},${POPUP_REFERENCES.map((name) => `[${name}]`).join(',')}`

const visible = (el: HTMLElement) =>
  !el.closest('[inert], [hidden], [aria-hidden="true"]') && el.getClientRects().length > 0

/**
 * Portal 不在对话框的 DOM 子树内，但触发元素的 ARIA 引用明确标识了它的归属。递归收集这些可见子弹层，
 * 把它们的 Tab 顺序接在触发元素后；页面其他弹层不属于这个 scope，隐藏说明文字也不算弹层。
 */
function tabOrder(root: HTMLElement) {
  const list: HTMLElement[] = []
  const popups: { element: HTMLElement; trigger: HTMLElement }[] = []
  const regions = [root]
  const visit = (region: HTMLElement) => {
    for (const el of region.querySelectorAll<HTMLElement>(SCOPE_ELEMENTS)) {
      if (!visible(el)) continue
      if (el.matches(TABBABLE) && el.tabIndex >= 0) list.push(el)
      for (const attribute of POPUP_REFERENCES) {
        for (const id of (el.getAttribute(attribute) ?? '').split(/\s+/)) {
          const popup = id ? document.getElementById(id) : null
          if (
            !popup ||
            !POPUP_ROLES.has(popup.getAttribute('role') ?? '') ||
            !visible(popup) ||
            regions.some((r) => r.contains(popup)) ||
            popup.contains(root)
          )
            continue
          regions.push(popup)
          popups.push({ element: popup, trigger: el })
          visit(popup)
        }
      }
    }
  }
  visit(root)
  return { list, popups }
}

/** 激活中的对话框根元素，最后一个在最上面。 */
const stack: HTMLElement[] = []

function onKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Tab' || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return
  const root = stack.at(-1)
  if (!root) return
  const { list, popups } = tabOrder(root)
  const active = document.activeElement
  const first = list[0]
  const last = list.at(-1)
  if (!first || !last) {
    e.preventDefault()
    root.focus({ preventScroll: true })
    return
  }
  const popup = popups.findLast((p) => p.element.contains(active))
  const at = list.indexOf(active as HTMLElement)
  const from = at >= 0 ? at : popup ? list.indexOf(popup.trigger) : -1
  const next = list[(from + (e.shiftKey ? -1 : 1) + list.length) % list.length]
  if (popup || (at >= 0 && next && !root.contains(next))) {
    // Portal 的 DOM 顺序与触发元素分离：手动跨过这个边界，也不让外层 rc-dialog 再处理同一次 Tab。
    e.preventDefault()
    e.stopPropagation()
    next?.focus()
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
    // 隐藏的元素（display: none）上的 focus() 不生效：再次打开的 Drawer 在这一刻面板还是隐藏的，逐帧等它显示出来
    // （最多 10 帧）再移入。等待期间焦点被移到了别处（对话框内、它打开的弹层等）就不再移动；只在焦点仍停在打开前的
    // 元素、body 或对话框的外层容器（如 rc-drawer 的根元素）上时补上
    let frame = 0
    const enter = (attempt: number) => {
      const current = document.activeElement
      if (root.contains(current)) return
      if (
        attempt > 0 &&
        current !== previous &&
        current !== document.body &&
        !(current instanceof Node && current.contains(root))
      )
        return
      if (root.getClientRects().length === 0 && attempt < 10) {
        frame = requestAnimationFrame(() => enter(attempt + 1))
        return
      }
      if (!root.hasAttribute('tabindex')) root.tabIndex = -1
      root.focus({ preventScroll: true })
    }
    enter(0)
    stack.push(root)
    if (stack.length === 1) window.addEventListener('keydown', onKeyDown, true)
    return () => {
      cancelAnimationFrame(frame)
      const i = stack.lastIndexOf(root)
      if (i >= 0) stack.splice(i, 1)
      if (stack.length === 0) window.removeEventListener('keydown', onKeyDown, true)
      if (restoreFocus && previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true })
    }
  }, [active, restoreFocus])
  return <span ref={marker} hidden />
}
