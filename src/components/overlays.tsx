/**
 * 弹层组件：对话框、抽屉、下拉菜单、提示气泡、气泡确认、气泡卡片。
 * antd 只作为内部实现；对外的属性由本库声明（ADR 0021），弹层与容器不接收原生属性。弹层用实色表面与浮起阴影，不加描边。
 */
import {
  Drawer as AntDrawer,
  Dropdown as AntDropdown,
  Modal as AntModal,
  Popconfirm as AntPopconfirm,
  Popover as AntPopover,
  Tooltip as AntTooltip,
  type TooltipRef,
} from 'antd'
import {
  cloneElement,
  type FocusEvent,
  isValidElement,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react'
import { FocusScope } from './FocusScope.tsx'
import { Icon, type IconName } from './Icon.tsx'
import { Kbd } from './Kbd.tsx'
import styles from './overlays.module.css'

// —— Modal ——

/** Modal 自有的属性。 */
interface ModalOwnProps {
  /**
   * Whether the dialog is shown. The dialog does not close by itself: set `open` to false in `onOk` (after the
   * action has succeeded) and in `onCancel`.
   * @zh 是否显示对话框。对话框不会自己关闭：在 `onOk`（操作成功后）与 `onCancel` 中把 `open` 设为 false。
   */
  readonly open?: boolean
  /**
   * Title in the header. `null` removes the header; give the dialog an `aria-label` then.
   * @zh 头部的标题。`null` 去掉头部，这时请给对话框设置 `aria-label`。
   */
  readonly title?: ReactNode
  /**
   * Content of the dialog, laid out with Stack / Section. It is unmounted after the dialog has closed. State
   * owned outside the dialog survives. If `Form.useForm()` lives outside Modal, clear it with `form.resetFields()`
   * while Form is still mounted, for example on cancellation or successful submission before closing.
   * @zh 对话框的内容，用 Stack / Section 排版。关闭后内容随之卸载，但外部持有的状态保留。如果 `Form.useForm()`
   * 在 Modal 外创建，在 Form 仍挂载时调用 `form.resetFields()`，例如取消或提交成功后、关闭之前。
   */
  readonly children?: ReactNode
  /**
   * Called when the OK button is clicked.
   * @zh 点击确认按钮时调用。
   */
  readonly onOk?: () => void
  /**
   * Called when the user dismisses the dialog: the Cancel button, the close button, `Esc`, or a click outside the
   * dialog (see `maskClosable`).
   * @zh 用户放弃对话框时调用：「取消」按钮、关闭按钮、`Esc`，或者点击对话框外（见 `maskClosable`）。
   */
  readonly onCancel?: () => void
  /**
   * Text of the OK button; the built-in text ("OK") by default.
   * @zh 确认按钮的文字，默认为内置文本（「确定」）。
   */
  readonly okText?: ReactNode
  /**
   * Disables the OK button, for example until the required fields are filled in.
   * @zh 禁用确认按钮，例如在必填项填写完整之前。
   */
  readonly okDisabled?: boolean
  /**
   * Shows a loading indicator on the OK button and ignores clicks on it, while the action is running.
   * @zh 操作进行中：确认按钮显示加载指示并忽略点击。
   */
  readonly okLoading?: boolean
  /**
   * Semantic color of the OK button: `danger` for destructive actions such as removing or departing.
   * @zh 确认按钮的语义色：`danger` 用于移除、离职办理等危险操作。
   */
  readonly okTone?: 'danger'
  /**
   * Test hook of the OK button, rendered as its `data-testid`.
   * @zh 确认按钮的测试定位，输出为它的 `data-testid`。
   */
  readonly okTestId?: string
  /**
   * Replaces the buttons at the bottom (Cancel and OK); `null` removes the footer.
   * @zh 替换底部的按钮（取消、确认）；`null` 去掉底部。
   */
  readonly footer?: ReactNode
  /**
   * Shows the close button in the corner of the header.
   * @zh 在头部角上显示关闭按钮。
   * @default true
   */
  readonly closable?: boolean
  /**
   * Clicking outside the dialog dismisses it (calls `onCancel`). Turn it off when the content must not be lost by
   * accident, such as a secret that is shown only once.
   * @zh 点击对话框外放弃对话框（调用 `onCancel`）。内容不能被误关丢失时关掉它，如只显示一次的密钥。
   * @default true
   */
  readonly maskClosable?: boolean
  /**
   * Width of the dialog: a number in pixels or a CSS length such as `'min(420px, 92vw)'`.
   * @zh 对话框的宽度：像素数，或者 CSS 长度，如 `'min(420px, 92vw)'`。
   * @default 520
   */
  readonly width?: number | string
  /**
   * Flush content: removes the padding of the dialog, so the content lays itself out and follows the rounded
   * corners (such as the search field and result list of a command palette). Usually combined with
   * `title={null}`, `footer={null}` and `closable={false}`.
   * @zh 内容贴边：去掉对话框的内边距，内容自己排版并贴合圆角（如命令面板的搜索框与结果列表）。
   * 通常同时设置 `title={null}`、`footer={null}`、`closable={false}`。
   */
  readonly flush?: boolean
  /**
   * Accessible name of the dialog; needed when there is no `title`.
   * @zh 对话框的读屏名称；没有 `title` 时需要提供。
   */
  readonly 'aria-label'?: string
}

/**
 * Props of Modal.
 * @zh Modal 属性。
 */
export interface ModalProps extends ModalOwnProps {}

/**
 * Dialog for a short task that needs the user's full attention (create, edit, confirm). Lay out the content with
 * Stack / Section. Confirm irreversible actions with useConfirmDanger; reversible actions run directly and offer
 * undo instead of asking for confirmation.
 *
 * **Interaction**: when it opens, focus moves into the dialog and `Tab` / `Shift+Tab` cycle inside it; `Esc`
 * closes it, and focus returns to the element that was focused before opening. The content is unmounted after
 * closing.
 * @zh 对话框：需要用户专注完成的短任务（新建、编辑、确认）。内容用 Stack / Section 排版。
 * 不可恢复操作的确认用 useConfirmDanger；可恢复的操作直接执行并提供撤销，不弹确认。
 *
 * **交互**：打开后焦点进入对话框，`Tab` / `Shift+Tab` 在对话框内循环；`Esc` 关闭，关闭后焦点回到打开前的元素。
 * 关闭后内容随之卸载。
 * @category Feedback
 * @usage Create and edit forms, confirmations, command palettes
 * @usageZh 新建与编辑表单、二次确认、命令面板
 */
export function Modal(props: ModalProps) {
  const {
    open,
    flush,
    children,
    okDisabled,
    okLoading,
    okTone,
    okTestId,
    maskClosable,
    'aria-label': ariaLabel,
    ...rest
  } = props
  return (
    <AntModal
      {...rest}
      open={open}
      aria-label={ariaLabel}
      // 关闭后卸载内容；外部持有的 Form 实例由调用方重置，只显示一次的内容（如密钥）不留在 DOM 中
      destroyOnHidden
      mask={maskClosable === undefined ? undefined : { closable: maskClosable }}
      okButtonProps={{
        disabled: okDisabled,
        loading: okLoading,
        danger: okTone === 'danger',
        // antd 把其余属性原样交给按钮元素
        ...(okTestId === undefined ? {} : ({ 'data-testid': okTestId } as object)),
      }}
      classNames={flush ? { container: styles.flush } : undefined}
    >
      {children}
      <FocusScope active={Boolean(open)} />
    </AntModal>
  )
}

// —— Drawer ——

/** Drawer 自有的属性。 */
interface DrawerOwnProps {
  /**
   * Whether the drawer is shown. Set it to false in `onClose`.
   * @zh 是否显示抽屉。在 `onClose` 中把它设为 false。
   */
  readonly open?: boolean
  /**
   * Title in the header.
   * @zh 头部的标题。
   */
  readonly title?: ReactNode
  /**
   * Content of the drawer.
   * @zh 抽屉的内容。
   */
  readonly children?: ReactNode
  /**
   * Called when the user closes the drawer: the close button, `Esc` or a click outside the drawer.
   * @zh 用户关闭抽屉时调用：关闭按钮、`Esc` 或者点击抽屉外。
   */
  readonly onClose?: () => void
  /**
   * Width of the drawer: a number in pixels or a CSS length.
   * @zh 抽屉的宽度：像素数，或者 CSS 长度。
   * @default 378
   */
  readonly width?: number | string
  /**
   * Test hook, rendered as `data-testid` on the drawer.
   * @zh 测试定位，输出为抽屉的 `data-testid`。
   */
  readonly testId?: string
}

/**
 * Props of Drawer.
 * @zh Drawer 属性。
 */
export interface DrawerProps extends DrawerOwnProps {}

/**
 * Drawer that slides in from the right, for viewing details or editing longer content without leaving the
 * current page.
 *
 * **Interaction**: when it opens, focus moves into the drawer and `Tab` / `Shift+Tab` cycle inside it; `Esc`
 * closes it, and focus returns to the element that was focused before opening.
 * @zh 抽屉：从右侧滑出，在不离开当前页面的情况下查看详情或编辑较长的内容。
 *
 * **交互**：打开后焦点进入抽屉，`Tab` / `Shift+Tab` 在抽屉内循环；`Esc` 关闭，关闭后焦点回到打开前的元素。
 * @category Feedback
 * @usage Details and editing that keep the context of a list, such as member details, permission settings or conversation settings
 * @usageZh 成员详情、权限设置、会话设置等需要保留列表上下文的详情与编辑
 */
export function Drawer(props: DrawerProps) {
  const { open, title, children, onClose, width, testId } = props
  return (
    <AntDrawer
      open={open}
      title={title}
      onClose={onClose}
      size={width}
      {...(testId === undefined ? {} : { 'data-testid': testId })}
    >
      {children}
      <FocusScope active={Boolean(open)} />
    </AntDrawer>
  )
}

// —— Dropdown ——

/**
 * An action in a Dropdown menu.
 * @zh Dropdown 菜单中的一个操作。
 */
export interface DropdownMenuAction {
  /**
   * Unique key, passed to the `onClick` of the menu.
   * @zh 唯一键，传给菜单的 `onClick`。
   */
  readonly key: string
  /**
   * Text of the item.
   * @zh 菜单项文字。
   */
  readonly label: ReactNode
  /**
   * Icon before the text.
   * @zh 文字前的图标。
   */
  readonly icon?: IconName
  /**
   * Destructive action, shown in the danger color.
   * @zh 危险操作，用危险色显示。
   */
  readonly danger?: boolean
  /**
   * Disabled: shown but cannot be chosen.
   * @zh 禁用：显示但不能选择。
   */
  readonly disabled?: boolean
  /**
   * Shortcut hint shown at the end of the item with Kbd, such as `'mod+c'`. Only a hint: register the shortcut
   * itself with useHotkeys.
   * @zh 显示在菜单项末尾的快捷键提示（用 Kbd 显示），如 `'mod+c'`。只是提示：快捷键本身用 useHotkeys 注册。
   */
  readonly shortcut?: string | readonly string[]
}

/**
 * A divider between groups of Dropdown menu items.
 * @zh Dropdown 菜单项之间的分隔线。
 */
export interface DropdownMenuDivider {
  /**
   * Marks the item as a divider.
   * @zh 表示这一项是分隔线。
   */
  readonly type: 'divider'
  /**
   * Unique key; the position in the list by default.
   * @zh 唯一键，默认取在列表中的位置。
   */
  readonly key?: string
}

/**
 * An item of a Dropdown menu: an action or a divider.
 * @zh Dropdown 菜单项：操作或分隔线。
 */
export type DropdownMenuItem = DropdownMenuAction | DropdownMenuDivider

/**
 * The menu of a Dropdown.
 * @zh Dropdown 的菜单。
 */
export interface DropdownMenu {
  /**
   * Menu items: actions and dividers (`{ type: 'divider' }`).
   * @zh 菜单项：操作与分隔线（`{ type: 'divider' }`）。
   */
  readonly items: readonly DropdownMenuItem[]
  /**
   * Called with the key of the chosen item; the menu closes afterwards.
   * @zh 选择菜单项时调用，参数中是该项的 key；之后菜单关闭。
   */
  readonly onClick?: (info: { readonly key: string }) => void
  /**
   * Keys of the items shown as selected, such as the current option of a settings menu.
   * @zh 显示为选中的菜单项的 key，如设置菜单的当前选项。
   */
  readonly selectedKeys?: readonly string[]
}

/** Dropdown 自有的属性。 */
interface DropdownOwnProps {
  /**
   * The menu: `items`, `onClick` and `selectedKeys`.
   * @zh 菜单：`items`、`onClick` 与 `selectedKeys`。
   */
  readonly menu: DropdownMenu
  /**
   * What opens the menu: `click`, `hover` or `contextMenu` (right click).
   * @zh 打开菜单的方式：`click` 点击、`hover` 悬停、`contextMenu` 右键。
   * @default ['hover']
   */
  readonly trigger?: readonly ('click' | 'hover' | 'contextMenu')[]
  /**
   * Position of the menu relative to the trigger.
   * @zh 菜单相对触发元素的位置。
   * @default 'bottomLeft'
   */
  readonly placement?: 'bottomLeft' | 'bottom' | 'bottomRight' | 'topLeft' | 'top' | 'topRight'
  /**
   * Whether the menu is open (controlled).
   * @zh 菜单是否打开（受控）。
   */
  readonly open?: boolean
  /**
   * Called when the menu opens or closes.
   * @zh 菜单打开或关闭时调用。
   */
  readonly onOpenChange?: (open: boolean) => void
  /**
   * The trigger: one element that accepts events and a ref, usually a Button or an IconButton.
   * @zh 触发元素：一个能接收事件与 ref 的元素，通常是 Button 或 IconButton。
   */
  readonly children?: ReactNode
}

/**
 * Props of Dropdown.
 * @zh Dropdown 属性。
 */
export interface DropdownProps extends DropdownOwnProps {}

/**
 * 组件库内部（ContextMenu 也用它，不从入口导出）：弹层关闭后把焦点还给触发元素：只在焦点仍在弹层中、或已经丢失（落到 body 上）时才还；在页面别处点击关闭时，
 * 焦点留在被点击的元素上。放到下一帧再判断：按 Enter 选择菜单项时，同一次按键的后续事件会落到当前焦点上，
 * 立即把焦点移到触发按钮会让它被「按下」而重新打开；在别处点击时，鼠标按下后焦点才移到被点击的元素上。
 */
export function returnFocusLater(trigger: unknown, inPopup: (el: Element) => boolean) {
  if (!(trigger instanceof HTMLElement) || trigger === document.body) return
  requestAnimationFrame(() => {
    const active = document.activeElement
    if (!trigger.isConnected) return
    if (!active || active === document.body || inPopup(active))
      trigger.focus({ preventScroll: true })
  })
}

const isMenuDivider = (item: DropdownMenuItem): item is DropdownMenuDivider =>
  'type' in item && item.type === 'divider'

/** 本库的菜单项换成 antd 菜单的项：图标用本库的 Icon，快捷键提示用 Kbd 放在项的末尾。 */
function toMenuItems(items: readonly DropdownMenuItem[]) {
  return items.map((item, i) =>
    isMenuDivider(item)
      ? { type: 'divider' as const, key: item.key ?? `divider-${i}` }
      : {
          key: item.key,
          label: item.label,
          danger: item.danger,
          disabled: item.disabled,
          icon: item.icon ? <Icon name={item.icon} /> : undefined,
          extra: item.shortcut ? <Kbd keys={item.shortcut} /> : undefined,
        },
  )
}

/**
 * Dropdown menu: a list of actions (`menu.items`) that opens when the trigger is clicked or hovered. The trigger is
 * usually an IconButton or a Button.
 *
 * **Interaction**: a menu opened by click (or right click) moves focus into the menu; `↑` / `↓` move between items,
 * `Enter` runs one and `Esc` closes the menu. After closing, focus returns to the trigger (when the menu is closed
 * by clicking elsewhere on the page, focus stays on the clicked element). Menus opened on hover do not move focus.
 * @zh 下拉菜单：点击或悬停触发元素后弹出一组操作（`menu.items`）。触发元素通常是 IconButton 或 Button。
 *
 * **交互**：点击（或右键）触发的菜单打开后焦点进入菜单，`↑` / `↓` 在菜单项之间移动，`Enter` 执行；
 * `Esc` 关闭；关闭后焦点回到触发元素（在页面别处点击关闭时，焦点留在被点击的元素上）。悬停触发的菜单不移动焦点。
 * @category Basic
 * @usage "More" actions in a row, account menus, theme switching, several options for creating something
 * @usageZh 行内「更多」操作、账户菜单、主题切换、新建的多个选项
 */
export function Dropdown(props: DropdownProps) {
  const { menu, trigger = ['hover'], placement, open, onOpenChange, children } = props
  const opener = useRef<Element | null>(null)
  return (
    <AntDropdown
      trigger={[...trigger]}
      placement={placement}
      open={open}
      // 点击、右键打开的菜单：焦点进入菜单，键盘才能用方向键选择（antd 默认不移动焦点）。悬停打开时不抢焦点
      autoFocus={!trigger.includes('hover')}
      menu={{
        items: toMenuItems(menu.items),
        onClick: menu.onClick ? (info) => menu.onClick?.({ key: info.key }) : undefined,
        selectable: menu.selectedKeys !== undefined,
        selectedKeys: menu.selectedKeys ? [...menu.selectedKeys] : undefined,
      }}
      onOpenChange={(next) => {
        if (next) opener.current = document.activeElement
        else {
          // antd 关闭菜单后不会把焦点还给触发元素（rc-dropdown 拿不到触发元素的引用），焦点随菜单隐藏而丢失
          returnFocusLater(opener.current, (el) => el.closest('.ant-dropdown') !== null)
          opener.current = null
        }
        onOpenChange?.(next)
      }}
    >
      {children}
    </AntDropdown>
  )
}

// —— Tooltip ——

/** Tooltip 自有的属性。 */
interface TooltipOwnProps {
  /**
   * Text of the tooltip. Without it, no tooltip is shown.
   * @zh 提示的文字。没有时不显示提示。
   */
  readonly title?: ReactNode
  /**
   * Position of the tooltip relative to the trigger.
   * @zh 提示相对触发元素的位置。
   * @default 'top'
   */
  readonly placement?:
    | 'top'
    | 'topLeft'
    | 'topRight'
    | 'bottom'
    | 'bottomLeft'
    | 'bottomRight'
    | 'left'
    | 'right'
  /**
   * Delay before the tooltip appears on hover, in seconds.
   * @zh 悬停后提示出现前的延迟，单位为秒。
   * @default 0.5
   */
  readonly mouseEnterDelay?: number
  /**
   * What shows the tooltip: `hover`, `focus` (any focus, including from a click) or `click`. Keyboard focus shows
   * a hover tooltip as well.
   * @zh 显示提示的方式：`hover` 悬停、`focus` 聚焦（包括点击得到的焦点）、`click` 点击。悬停提示在键盘聚焦时同样显示。
   * @default 'hover'
   */
  readonly trigger?: 'hover' | 'focus' | 'click' | readonly ('hover' | 'focus' | 'click')[]
  /**
   * The trigger: one element that accepts events and a ref.
   * @zh 触发元素：一个能接收事件与 ref 的元素。
   */
  readonly children?: ReactNode
}

/**
 * Props of Tooltip.
 * @zh Tooltip 属性。
 */
export interface TooltipProps extends TooltipOwnProps {}

/** 提示「热」的时长：一个提示关闭后这段时间内悬停另一个，立即出现（连续悬停时立即切换）。 */
const TOOLTIP_WARM_MS = 300

/** 提示的全局状态：当前打开的提示，与最近一次关闭的时间。 */
const tooltipState: { current: { close: () => void } | null; closedAt: number } = {
  current: null,
  closedAt: Number.NEGATIVE_INFINITY,
}

const tooltipWarm = () =>
  tooltipState.current !== null || Date.now() - tooltipState.closedAt < TOOLTIP_WARM_MS

type TriggerChildProps = {
  onMouseEnter?: (e: MouseEvent<HTMLElement>) => void
  onFocus?: (e: FocusEvent<HTMLElement>) => void
  onBlur?: (e: FocusEvent<HTMLElement>) => void
}

/** 触发方式统一成 antd 接受的可变数组或单个值。 */
const toTriggers = (trigger: NonNullable<TooltipProps['trigger']>) =>
  typeof trigger === 'string' ? trigger : [...trigger]

/**
 * Tooltip: a short explanation shown on hover or focus. By default it appears after 500 ms, so it does not flash
 * when the pointer passes over. Icon buttons have a tooltip of their own and need no Tooltip around them. Use it
 * to show the full text only when the text is actually truncated.
 *
 * **Interaction**: appears after hovering for 500 ms; hovering another one while a tooltip is open or has just
 * closed (within 300 ms) switches to it immediately. Appears immediately on keyboard focus and disappears on blur
 * or `Esc`; focus from a mouse click does not show it immediately.
 * @zh 提示气泡：悬停或聚焦时显示简短说明，默认延迟 500ms 出现，避免划过时闪烁。
 * 图标按钮自带提示，不必再包 Tooltip。只有文字真的被截断时才用它显示完整内容。
 *
 * **交互**：悬停 500ms 后出现；一个提示刚打开或刚关闭时（300ms 内）悬停另一个，立即切换过去；
 * 键盘聚焦时立即出现，失焦或 `Esc` 时消失；鼠标点击得到的焦点不会让提示立即出现。
 * @category Basic
 * @usage Explaining why something is disabled, the meaning of icons or abbreviations, the full text of truncated labels
 * @usageZh 解释禁用原因、补充图标或缩写的含义、显示被截断的完整文字
 */
export function Tooltip({
  title,
  placement,
  mouseEnterDelay = 0.5,
  trigger = 'hover',
  children,
}: TooltipProps) {
  const [open, setOpen] = useState(false)
  const hover = typeof trigger === 'string' ? trigger === 'hover' : trigger.includes('hover')
  const noTitle = !title && title !== 0
  // 当前打开的提示：打开新提示时，上一个立即关闭（切换），而不是等它的离开延迟
  useEffect(() => {
    if (!open) return
    const me = { close: () => setOpen(false) }
    if (tooltipState.current) tooltipState.current.close()
    tooltipState.current = me
    return () => {
      if (tooltipState.current === me) tooltipState.current = null
      tooltipState.closedAt = Date.now()
    }
  }, [open])
  const common = { title, placement, mouseEnterDelay, trigger: toTriggers(trigger) }
  // 没有文字、不是悬停触发的提示：照原样交给 antd
  if (noTitle || !hover || !isValidElement<TriggerChildProps>(children))
    return <AntTooltip {...common}>{children}</AntTooltip>
  const own = children.props
  // antd 先处理这些事件（按延迟打开、关闭），再调用这里合并进去的处理函数
  const child = cloneElement(children, {
    onMouseEnter: (e: MouseEvent<HTMLElement>) => {
      own.onMouseEnter?.(e)
      if (!open && tooltipWarm()) setOpen(true)
    },
    onFocus: (e: FocusEvent<HTMLElement>) => {
      own.onFocus?.(e)
      // 键盘焦点立即显示（图标按钮的名称对键盘用户可见）；鼠标点击得到的焦点仍按悬停延迟
      if (!open && e.currentTarget.matches(':focus-visible')) setOpen(true)
    },
    onBlur: (e: FocusEvent<HTMLElement>) => {
      own.onBlur?.(e)
      if (open) setOpen(false)
    },
  })
  return (
    <AntTooltip {...common} open={open} onOpenChange={setOpen}>
      {child}
    </AntTooltip>
  )
}

/**
 * 组件库内部：给禁用的按钮包上「禁用原因」提示（Button、IconButton 的 `disabledReason`），不从入口导出。
 * 悬停（500ms 后）或键盘聚焦时显示。原因另外渲染在一个隐藏元素里，由按钮的 `aria-describedby` 引用（id 由调用方传入），
 * 读屏随时能读到；气泡里的文字对读屏隐藏：气泡打开时 antd 会把气泡也加进 `aria-describedby`，否则原因会被读两遍。
 */
export function DisabledReasonTooltip(props: {
  /** 隐藏说明元素的 id，与按钮的 `aria-describedby` 一致。 */
  readonly id: string
  /** 禁用原因。 */
  readonly reason: string
  /** 气泡中显示的文字，默认就是原因。 */
  readonly tip?: ReactNode
  /** 按钮（必须能接收鼠标与焦点事件，即不能是原生 disabled）。 */
  readonly children: ReactElement
}) {
  return (
    <>
      <Tooltip
        title={<span aria-hidden="true">{props.tip ?? props.reason}</span>}
        trigger={['hover', 'focus']}
      >
        {props.children}
      </Tooltip>
      <span id={props.id} hidden>
        {props.reason}
      </span>
    </>
  )
}

// —— Popconfirm ——

/** Popconfirm 自有的属性。 */
interface PopconfirmOwnProps {
  /**
   * The question, such as "Remove this member?".
   * @zh 要确认的问题，如「移除这位成员？」。
   */
  readonly title: ReactNode
  /**
   * Explanation below the question: what will happen.
   * @zh 问题下方的说明：会发生什么。
   */
  readonly description?: ReactNode
  /**
   * Text of the confirm button; the built-in text ("OK") by default.
   * @zh 确认按钮的文字，默认为内置文本（「确定」）。
   */
  readonly okText?: ReactNode
  /**
   * Semantic color of the confirm button: `danger` for destructive actions.
   * @zh 确认按钮的语义色：`danger` 用于危险操作。
   */
  readonly okTone?: 'danger'
  /**
   * Called when the user confirms. When it returns a promise, the confirm button shows a loading indicator and the
   * popup stays open until the promise settles.
   * @zh 用户确认时调用。返回 Promise 时，确认按钮显示加载指示，气泡在 Promise 完成后才关闭。
   */
  readonly onConfirm?: () => void
  /**
   * Called when the user cancels with the Cancel button.
   * @zh 用户点击「取消」时调用。
   */
  readonly onCancel?: () => void
  /**
   * The trigger: one element that accepts events and a ref, usually a Button or a LinkButton.
   * @zh 触发元素：一个能接收事件与 ref 的元素，通常是 Button 或 LinkButton。
   */
  readonly children?: ReactNode
}

/**
 * Props of Popconfirm.
 * @zh Popconfirm 属性。
 */
export interface PopconfirmProps extends PopconfirmOwnProps {}

/** 触发元素的 aria-describedby 指向的气泡（antd 在气泡打开时设置）。 */
function describedPopup(trigger: Element): HTMLElement | null {
  for (const id of (trigger.getAttribute('aria-describedby') ?? '').split(/\s+/)) {
    const el = id ? document.getElementById(id) : null
    if (el?.getAttribute('role') === 'tooltip') return el
  }
  return null
}

/**
 * Popconfirm: a lightweight confirmation that pops up next to its trigger, for actions with a small impact that
 * still need confirming (such as removing one access grant). Irreversible actions such as deleting an object or
 * clearing data use useConfirmDanger.
 *
 * **Interaction**: when it opens, focus moves to "Cancel" (pressing `Enter` does not confirm by accident); `Tab`
 * moves between "Cancel" and "Confirm", and `Enter` / `Space` trigger them; `Esc` closes it. After confirming,
 * cancelling or closing with `Esc`, focus returns to the trigger.
 * @zh 气泡确认：在触发元素旁弹出的轻量确认，用于影响范围小、但仍需确认的操作（如移除一条授权）。
 * 删除对象、清除数据等不可恢复的操作用 useConfirmDanger。
 *
 * **交互**：打开后焦点移到「取消」上（回车不会误确认），`Tab` 在「取消」「确认」之间移动，`Enter` / `Space` 触发；
 * `Esc` 关闭；确认、取消或 `Esc` 关闭后焦点回到触发元素。
 * @category Feedback
 * @usage Removing a member, revoking access, deleting a draft row
 * @usageZh 移除成员、撤销授权、删除草稿行
 */
export function Popconfirm(props: PopconfirmProps) {
  const { title, description, okText, okTone, onConfirm, onCancel, children } = props
  const inner = useRef<TooltipRef | null>(null)
  const popup = useRef<HTMLElement | null>(null)
  return (
    <AntPopconfirm
      ref={inner}
      title={title}
      description={description}
      okText={okText}
      okButtonProps={okTone === 'danger' ? { danger: true } : undefined}
      onConfirm={onConfirm}
      onCancel={onCancel}
      onOpenChange={(open) => {
        const trigger = inner.current?.nativeElement
        if (open)
          // 气泡在本次渲染中挂载，触发元素随之带上指向气泡的 aria-describedby：下一帧把焦点移到第一个按钮（取消）上
          requestAnimationFrame(() => {
            popup.current = trigger ? describedPopup(trigger) : null
            popup.current?.querySelector<HTMLElement>('button')?.focus()
          })
        else {
          // antd 关闭气泡后焦点随气泡隐藏而丢失：还给触发元素
          const el = popup.current
          popup.current = null
          returnFocusLater(trigger, (active) => Boolean(el?.contains(active)))
        }
      }}
    >
      {children}
    </AntPopconfirm>
  )
}

// —— Popover ——

/** 弹层中按 Tab 顺序可达的元素。 */
const POPUP_TABBABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * 组件库内部：点击打开的弹层（Popover、ColorPicker）的焦点。不从入口导出。
 *
 * - 打开时记下触发元素；`moveFocus` 时下一帧把焦点移到弹层中第一个可聚焦的元素上（没有就移到弹层本身），
 *   键盘用户才能操作弹层的内容；悬停、聚焦触发的弹层不移动焦点。
 * - 关闭后（`Esc`、点击触发元素、选择完成）把焦点还给触发元素；在页面别处点击关闭时焦点留在被点击的元素上。
 *
 * 弹层元素由触发元素的 `aria-describedby` 找到（antd 的气泡打开时设置），`popupSelector` 用来判断焦点是否在弹层中。
 */
export function usePopupFocus(open: boolean, moveFocus: boolean, popupSelector: string) {
  const opener = useRef<Element | null>(null)
  const wasOpen = useRef(false)
  useEffect(() => {
    if (open) {
      wasOpen.current = true
      const trigger = document.activeElement
      opener.current = trigger
      if (!moveFocus || !trigger || trigger === document.body) return
      const frame = requestAnimationFrame(() => {
        const popup = describedPopup(trigger)
        if (!popup) return
        const target = popup.querySelector<HTMLElement>(POPUP_TABBABLE)
        if (target) target.focus()
        else {
          if (!popup.hasAttribute('tabindex')) popup.tabIndex = -1
          popup.focus({ preventScroll: true })
        }
      })
      return () => cancelAnimationFrame(frame)
    }
    if (!wasOpen.current) return
    wasOpen.current = false
    returnFocusLater(opener.current, (el) => el.closest(popupSelector) !== null)
    opener.current = null
  }, [open, moveFocus, popupSelector])
}

/** Popover 自有的属性。 */
interface PopoverOwnProps {
  /**
   * Title of the card.
   * @zh 卡片的标题。
   */
  readonly title?: ReactNode
  /**
   * Content of the card.
   * @zh 卡片的内容。
   */
  readonly content?: ReactNode
  /**
   * What opens the card: `hover`, `focus` or `click`. Use `click` for content that can be operated (a form,
   * buttons), and `['hover', 'focus']` for details that keyboard users should see too.
   * @zh 打开卡片的方式：`hover` 悬停、`focus` 聚焦、`click` 点击。内容可以操作（表单、按钮）时用 `click`；
   * 键盘用户也要能看到的详情用 `['hover', 'focus']`。
   * @default 'hover'
   */
  readonly trigger?: 'hover' | 'focus' | 'click' | readonly ('hover' | 'focus' | 'click')[]
  /**
   * Position of the card relative to the trigger.
   * @zh 卡片相对触发元素的位置。
   * @default 'top'
   */
  readonly placement?:
    | 'top'
    | 'topLeft'
    | 'topRight'
    | 'bottom'
    | 'bottomLeft'
    | 'bottomRight'
    | 'left'
    | 'right'
  /**
   * Whether the card is open (controlled).
   * @zh 卡片是否打开（受控）。
   */
  readonly open?: boolean
  /**
   * Whether the card is open at first (uncontrolled).
   * @zh 卡片最初是否打开（非受控）。
   * @default false
   */
  readonly defaultOpen?: boolean
  /**
   * Called when the card opens or closes.
   * @zh 卡片打开或关闭时调用。
   */
  readonly onOpenChange?: (open: boolean) => void
  /**
   * The trigger: one element that accepts events and a ref.
   * @zh 触发元素：一个能接收事件与 ref 的元素。
   */
  readonly children?: ReactNode
}

/**
 * Props of Popover.
 * @zh Popover 属性。
 */
export interface PopoverProps extends PopoverOwnProps {}

/**
 * Popover: a floating card next to its trigger with a title and richer content than a tooltip, such as details of
 * a person, a short form or a few actions. For a list of actions use Dropdown; for a confirmation use Popconfirm.
 *
 * **Interaction**: it fades in from the side of the trigger. Opened by click (`trigger="click"`), focus moves to
 * the first focusable element inside it, or to the card itself; `Esc` or clicking the trigger closes it, and focus
 * returns to the trigger (when it is closed by clicking elsewhere on the page, focus stays on the clicked element).
 * Popovers opened on hover or focus do not move focus.
 * @zh 气泡卡片：在触发元素旁浮出的卡片，带标题，内容比提示气泡丰富，如人员详情、简短的表单、几个操作。
 * 一组操作用 Dropdown，二次确认用 Popconfirm。
 *
 * **交互**：从触发元素一侧淡入。点击打开（`trigger="click"`）时焦点移到其中第一个可聚焦的元素上（没有就移到卡片本身）；
 * `Esc` 或再次点击触发元素关闭，焦点回到触发元素（在页面别处点击关闭时，焦点留在被点击的元素上）。悬停、聚焦打开的
 * 气泡卡片不移动焦点。
 * @category Feedback
 * @usage Details of a person or a file on hover, a short form next to a button, filters
 * @usageZh 悬停显示人员或文件的详情、按钮旁的简短表单、筛选条件
 */
export function Popover(props: PopoverProps) {
  const {
    title,
    content,
    trigger = 'hover',
    placement,
    open: openProp,
    defaultOpen,
    onOpenChange,
    children,
  } = props
  const [innerOpen, setInnerOpen] = useState(defaultOpen ?? false)
  const open = openProp ?? innerOpen
  const list = typeof trigger === 'string' ? [trigger] : trigger
  usePopupFocus(open, !list.includes('hover') && !list.includes('focus'), '.ant-popover')
  return (
    <AntPopover
      title={title}
      content={content}
      trigger={toTriggers(trigger)}
      placement={placement}
      open={open}
      onOpenChange={(next) => {
        setInnerOpen(next)
        onOpenChange?.(next)
      }}
    >
      {children}
    </AntPopover>
  )
}
