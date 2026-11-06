/**
 * 右键菜单：包住任意内容，右键、`Shift+F10` 或菜单键在指针处（键盘打开时在聚焦元素处）弹出菜单。
 *
 * 菜单本身就是组件库的 Dropdown（样式、方向键、Enter、Esc 都与之相同）：触发元素是一个放在 body 上、1×1、固定定位的
 * 锚点，打开时移到指针或元素的位置。锚点与 Dropdown 第一次打开时才挂载，长列表中每一行都包一层也不额外占用弹层。
 * 焦点：打开时记下当前焦点，关闭后（Esc、执行菜单项）还回去；在页面别处点击关闭时焦点留在被点击的元素上。
 */
import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import styles from './context-menu.module.css'
import type { IconName } from './Icon.tsx'
import { isTypingTarget } from './keys.ts'
import type { BaseProps } from './layout.tsx'
import { Dropdown, returnFocusLater } from './overlays.tsx'

/**
 * An action in a ContextMenu.
 * @zh ContextMenu 的一个菜单项。
 */
export interface ContextMenuAction {
  /** Unique key, passed to `onSelect`. @zh 唯一键，传给 `onSelect`。 */
  readonly key: string
  /** Text of the item. @zh 菜单项文字。 */
  readonly label: ReactNode
  /** Icon before the text. @zh 文字前的图标。 */
  readonly icon?: IconName
  /** Destructive action, shown in the danger color. @zh 危险操作，用危险色显示。 */
  readonly danger?: boolean
  /** Disabled: shown but cannot be chosen. @zh 禁用：显示但不能选择。 */
  readonly disabled?: boolean
  /**
   * Shortcut hint shown at the end of the item with Kbd, such as `'mod+c'`. Only a hint: register the shortcut
   * itself with useHotkeys.
   * @zh 显示在菜单项末尾的快捷键提示（用 Kbd 显示），如 `'mod+c'`。只是提示：快捷键本身用 useHotkeys 注册。
   */
  readonly shortcut?: string | readonly string[]
  /** Called when the item is chosen. @zh 选择该项时调用。 */
  readonly onClick?: () => void
}

/**
 * A divider between groups of ContextMenu items.
 * @zh ContextMenu 菜单项之间的分隔线。
 */
export interface ContextMenuDivider {
  readonly type: 'divider'
  readonly key?: string
}

/**
 * An item of a ContextMenu: an action or a divider.
 * @zh ContextMenu 的菜单项：操作或分隔线。
 */
export type ContextMenuItem = ContextMenuAction | ContextMenuDivider

/**
 * Props of ContextMenu.
 * @zh ContextMenu 属性。
 */
export interface ContextMenuProps extends Pick<BaseProps, 'testId'> {
  /**
   * Menu items: actions (`key`, `label`, `icon`, `danger`, `disabled`, `shortcut`, `onClick`) and dividers
   * (`{ type: 'divider' }`). With no items, the browser's own menu is shown.
   * @zh 菜单项：操作（`key`、`label`、`icon`、`danger`、`disabled`、`shortcut`、`onClick`）与分隔线
   * （`{ type: 'divider' }`）。没有菜单项时显示浏览器自己的菜单。
   */
  readonly items: readonly ContextMenuItem[]
  /**
   * The content that has the menu: a list row, a file, an image, a message. For keyboard users, the content (or
   * an element inside it) must be focusable.
   * @zh 带菜单的内容：列表行、文件、图片、消息。键盘用户要能打开菜单，内容（或其中的元素）必须可以聚焦。
   */
  readonly children: ReactNode
  /**
   * Called with the key of the chosen item, after its `onClick`.
   * @zh 选择菜单项后调用（在该项的 `onClick` 之后），参数是菜单项的 key。
   */
  readonly onSelect?: (key: string) => void
  /**
   * Called when the menu opens or closes.
   * @zh 菜单打开或关闭时调用。
   */
  readonly onOpenChange?: (open: boolean) => void
  /**
   * Disables the menu: right click shows the browser's own menu.
   * @zh 禁用：右键时显示浏览器自己的菜单。
   */
  readonly disabled?: boolean
}

const isDivider = (item: ContextMenuItem): item is ContextMenuDivider =>
  'type' in item && item.type === 'divider'

/** 键盘打开菜单的按键：`Shift+F10` 与菜单键（ContextMenu）。 */
const isMenuKey = (e: KeyboardEvent) =>
  e.key === 'ContextMenu' ||
  (e.key === 'F10' && e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey)

/**
 * 键盘打开后，浏览器可能紧接着再发一次 contextmenu（如 Windows 上菜单键在松开时才发），这段时间内的 contextmenu
 * 只拦下、不再移动菜单。
 */
const KEYBOARD_ECHO_MS = 500

/**
 * A context menu: wraps any content and opens a menu of actions on right click, `Shift+F10` or the menu key, at
 * the pointer or next to the focused element. The menu is the Dropdown menu of the library.
 *
 * **Interaction**: right click opens the menu at the pointer; `Shift+F10` or the menu key opens it below the
 * focused element. Focus moves into the menu: `↑` / `↓` move between items (skipping disabled items and
 * dividers), `Enter` runs one and `Esc` closes the menu; after closing, focus returns to the element that was
 * focused before. Clicking elsewhere closes it and leaves focus on the clicked element. Inside text fields the
 * browser's own menu (copy, paste) is kept. Shortcut hints are shown with Kbd.
 * @zh 右键菜单：包住任意内容，右键、`Shift+F10` 或菜单键时在指针处或聚焦元素旁弹出操作菜单。菜单就是组件库的 Dropdown 菜单。
 *
 * **交互**：右键在指针处打开；`Shift+F10` 或菜单键在聚焦元素下方打开。焦点进入菜单：`↑` / `↓` 在菜单项之间移动
 * （跳过禁用项与分隔线），`Enter` 执行，`Esc` 关闭；关闭后焦点回到打开前的元素。在别处点击时关闭，焦点留在被点击的元素上。
 * 在文字输入框中保留浏览器自己的菜单（复制、粘贴）。快捷键提示用 Kbd 显示。
 * @category Basic
 * @usage Actions on list rows, files, images and messages, in the habits of desktop applications
 * @usageZh 列表行、文件、图片、消息上的操作，符合桌面应用习惯
 */
export function ContextMenu(props: ContextMenuProps) {
  const { items, onSelect, onOpenChange, disabled } = props
  const [open, setOpen] = useState(false)
  // 锚点位置与序号：每次打开换一个序号重新挂载 Dropdown，菜单在新位置重新对齐（antd 不会因锚点移动而重新对齐）
  const [anchor, setAnchor] = useState<{ x: number; y: number; n: number } | null>(null)
  const opener = useRef<Element | null>(null)
  const keyboardAt = useRef(Number.NEGATIVE_INFINITY)

  const show = useCallback(
    (x: number, y: number) => {
      // 菜单开着时在别处再次右键：焦点可能还在旧菜单里，仍然记住最初的元素
      const focused = document.activeElement
      if (!focused?.closest('.ant-dropdown')) opener.current = focused
      setAnchor((a) => ({ x, y, n: (a?.n ?? 0) + 1 }))
      setOpen(true)
      onOpenChange?.(true)
    },
    [onOpenChange],
  )

  const active = !disabled && items.length > 0

  const onContextMenu = (e: MouseEvent<HTMLDivElement>) => {
    if (!active || isTypingTarget(e.target)) return
    e.preventDefault()
    // 嵌套的右键菜单：最里面的处理，外层不再打开
    e.stopPropagation()
    if (Date.now() - keyboardAt.current < KEYBOARD_ECHO_MS) return
    // 键盘触发的 contextmenu 在有些浏览器中坐标为 (0, 0)：改用目标元素的位置
    if (e.clientX === 0 && e.clientY === 0 && e.target instanceof Element) {
      const r = e.target.getBoundingClientRect()
      show(r.left, r.bottom)
    } else show(e.clientX, e.clientY)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!active || !isMenuKey(e) || isTypingTarget(e.target)) return
    e.preventDefault()
    e.stopPropagation()
    keyboardAt.current = Date.now()
    const target = e.target instanceof Element ? e.target : e.currentTarget
    const r = target.getBoundingClientRect()
    show(Math.max(0, r.left), Math.min(r.bottom, window.innerHeight))
  }

  const close = () => {
    setOpen(false)
    onOpenChange?.(false)
    returnFocusLater(opener.current, (el) => el.closest('.ant-dropdown') !== null)
    opener.current = null
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: 只是转发内容上的右键与 Shift+F10，可聚焦、可操作的是其中的内容
    <div
      className={styles.area}
      data-testid={props.testId}
      onContextMenu={onContextMenu}
      onKeyDown={onKeyDown}
    >
      {props.children}
      {anchor &&
        createPortal(
          <Dropdown
            key={anchor.n}
            open={open}
            trigger={['click']}
            placement="bottomLeft"
            onOpenChange={(next) => {
              if (!next) close()
            }}
            menu={{
              // 菜单项与 Dropdown 的菜单项同形（图标、危险色、禁用、快捷键提示）；各项的 onClick 在这里调用
              items,
              onClick: ({ key }) => {
                const item = items.find(
                  (x): x is ContextMenuAction => !isDivider(x) && x.key === key,
                )
                item?.onClick?.()
                onSelect?.(key)
              },
            }}
          >
            <span
              className={styles.anchor}
              style={{ left: anchor.x, top: anchor.y }}
              aria-hidden="true"
            />
          </Dropdown>,
          document.body,
        )}
    </div>
  )
}
