/**
 * 应用侧栏的纵向导航：图标、文字、计数，可分组；当前页 `aria-current="page"`；收起后只显示图标。
 * 放在 AppShell 的侧栏中时，收起状态跟随侧栏，选择一项后关闭窄屏抽屉（appShellContext.ts）。
 */
import { type JSX, type KeyboardEvent, type MouseEvent, useEffect, useId, useRef } from 'react'
import { useT } from '../i18n/index.ts'
import { useSidebarState } from './appShellContext.ts'
import { Icon, type IconName } from './Icon.tsx'
import { CountBadge } from './items.tsx'
import styles from './nav.module.css'
import { Tooltip } from './overlays.tsx'

/**
 * An item of Nav: a page of the application.
 * @zh Nav 的一项：应用中的一个页面。
 */
export interface NavItem {
  /**
   * Unique key, passed to `onSelect` and compared with `value`.
   * @zh 唯一标识，传给 `onSelect`，并与 `value` 比较。
   */
  readonly key: string
  /**
   * Text of the item; also the tooltip and the accessible name when Nav is collapsed.
   * @zh 文字；Nav 收起时也是提示与读屏名称。
   */
  readonly label: string
  /**
   * Icon name. Give every item an icon, or none: a collapsed Nav shows a dot for items without one.
   * @zh 图标名称。要么每一项都有图标，要么都没有：收起时没有图标的项显示一个圆点。
   */
  readonly icon?: IconName
  /**
   * Count shown at the end (CountBadge); nothing is shown when it is 0 or omitted.
   * @zh 末尾的计数（CountBadge）；为 0 或不传时不显示。
   */
  readonly count?: number
  /**
   * Tone of the count: `accent` for unread items and to-dos, `neutral` for plain counts.
   * @zh 计数的色调：未读与待办用 `accent`，普通计数用 `neutral`。
   * @default 'neutral'
   */
  readonly countTone?: 'neutral' | 'accent'
  /**
   * Address of the page: the item is a real link (`<a href>`), so it can be opened in a new tab. Without it, the
   * item is a button that calls `onSelect`.
   * @zh 页面地址：该项是真正的链接（`<a href>`），可以在新标签页中打开。不传时该项是调用 `onSelect` 的按钮。
   */
  readonly href?: string
  /**
   * Disabled: shown faded, cannot be focused or chosen.
   * @zh 禁用：淡化显示，不能聚焦与选择。
   */
  readonly disabled?: boolean
}

/**
 * A group of Nav items with a heading.
 * @zh Nav 中带标题的一组项。
 */
export interface NavGroup {
  /**
   * Marks the entry as a group.
   * @zh 表示这一项是分组。
   */
  readonly type: 'group'
  /**
   * Unique key of the group; the label is used when omitted.
   * @zh 分组的唯一标识；不传时用标题。
   */
  readonly key?: string
  /**
   * Heading of the group; hidden when Nav is collapsed (screen readers still read it).
   * @zh 分组标题；Nav 收起时隐藏（读屏仍会读出）。
   */
  readonly label: string
  /**
   * Items of the group (groups are not nested).
   * @zh 分组中的项（分组不能嵌套）。
   */
  readonly items: readonly NavItem[]
}

/**
 * Props of Nav.
 * @zh Nav 属性。
 */
export interface NavProps {
  /**
   * Items and groups, in order. Items outside groups come first, usually (Home, Inbox).
   * @zh 项与分组，按顺序排列。不属于分组的项通常放在最前面（首页、收件箱）。
   */
  readonly items: readonly (NavItem | NavGroup)[]
  /**
   * Key of the current page: the item gets the selected style and `aria-current="page"`. `null` when no item is
   * current.
   * @zh 当前页面的 key：该项显示为选中，并带 `aria-current="page"`。没有当前项时为 `null`。
   */
  readonly value?: string | null
  /**
   * Called with the key when an item is chosen. On items with `href`, plain clicks call it instead of following the
   * link (for client-side routing); clicks with a modifier key or the middle button open the link as usual.
   * Without `onSelect`, links are followed by the browser.
   * @zh 选择一项时以 key 调用。对带 `href` 的项，普通点击调用它而不跳转（客户端路由）；按住修饰键或用中键点击时照常打开链接。
   * 不传 `onSelect` 时，链接由浏览器打开。
   */
  readonly onSelect?: (key: string) => void
  /**
   * Icons only: the labels show in tooltips on the right and remain the accessible names; group headings are
   * hidden. Inside the sidebar of AppShell, it follows the sidebar when omitted.
   * @zh 只显示图标：文字在右侧的提示中显示，仍是读屏名称；分组标题隐藏。在 AppShell 的侧栏中不传时跟随侧栏。
   */
  readonly collapsed?: boolean
  /**
   * Accessible name of the navigation landmark; "Main" when omitted. Give each Nav of a page its own name.
   * @zh 导航区域的读屏名称；不传时为「主导航」。同一页面有多个 Nav 时各起一个名称。
   */
  readonly 'aria-label'?: string
  /**
   * Test id, rendered as `data-testid`.
   * @zh 测试定位，输出为 `data-testid`。
   */
  readonly testId?: string
  /**
   * `id` of the `nav` element.
   * @zh `nav` 元素的 `id`。
   */
  readonly id?: string
}

const isGroup = (entry: NavItem | NavGroup): entry is NavGroup => 'type' in entry

/** 方向键在其中移动的项：可聚焦的链接与按钮（禁用的不算）。 */
const ITEM_SELECTOR = '[data-vl-nav-item]:not(:disabled):not([aria-disabled="true"])'

/** 交给浏览器处理的点击：修饰键（新标签页、新窗口、下载）或非左键。 */
const opensElsewhere = (e: MouseEvent) =>
  e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey

interface ItemViewProps {
  readonly item: NavItem
  readonly current: boolean
  readonly collapsed: boolean
  readonly onChoose: (key: string, e: MouseEvent) => void
}

function ItemView({ item, current, collapsed, onChoose }: ItemViewProps) {
  const count = item.count && item.count > 0 ? item.count : 0
  const content = (
    <>
      {item.icon ? (
        <span className={styles.icon}>
          <Icon name={item.icon} size={16} />
        </span>
      ) : (
        collapsed && <span className={styles.dot} aria-hidden="true" />
      )}
      <span className={styles.label}>{item.label}</span>
      {count > 0 && (
        <span className={styles.count}>
          <CountBadge count={count} tone={item.countTone ?? 'neutral'} />
        </span>
      )}
    </>
  )
  const common = {
    className: styles.item,
    'data-vl-nav-item': '',
    'data-vl-state': '',
    'aria-current': current ? ('page' as const) : undefined,
  }
  let element: JSX.Element
  if (item.disabled)
    element = item.href ? (
      // 禁用的链接没有 href：不可聚焦、不能打开；role 让读屏仍把它读作（禁用的）链接
      <a {...common} role="link" aria-disabled="true">
        {content}
      </a>
    ) : (
      <button {...common} type="button" disabled>
        {content}
      </button>
    )
  else if (item.href)
    element = (
      <a {...common} href={item.href} onClick={(e) => onChoose(item.key, e)}>
        {content}
      </a>
    )
  else
    element = (
      <button {...common} type="button" onClick={(e) => onChoose(item.key, e)}>
        {content}
      </button>
    )
  return (
    <li className={styles.entry}>
      {collapsed ? (
        <Tooltip title={item.label} placement="right">
          {element}
        </Tooltip>
      ) : (
        element
      )}
    </li>
  )
}

/**
 * Vertical navigation for the sidebar of an application: items with an icon, a label and a count, in groups with
 * headings; the current page is selected. Put it in the `sidebar` of AppShell.
 *
 * **Interaction**: a `nav` landmark. Items are links (with `href`) or buttons, reached with `Tab` in order; `↑` /
 * `↓` move to the previous or next item and `Home` / `End` to the first or last, skipping disabled items. Hover and
 * press add the shared state layer; `Tab` focus shows the focus ring inside the item, so a scrolling sidebar does
 * not cut it off; the current item has the subtle selected background and `aria-current="page"`, and when it
 * changes to an item outside the visible part of the sidebar, the sidebar scrolls it into view. `collapsed` shows
 * icons only, with the label in a tooltip on hover and keyboard focus. Inside AppShell, choosing an item closes the
 * sidebar drawer of narrow screens.
 * @zh 应用侧栏的纵向导航：每一项有图标、文字与计数，可按带标题的分组排列；当前页显示为选中。放在 AppShell 的
 * `sidebar` 中。
 *
 * **交互**：输出 `nav` 区域。每一项是链接（带 `href`）或按钮，按顺序用 `Tab` 到达；`↑` / `↓` 移到上一项或下一项，
 * `Home` / `End` 移到第一项或最后一项，跳过禁用的项。悬停与按下叠加统一状态层；`Tab` 聚焦时焦点环画在项的内侧，
 * 滚动的侧栏不会把它裁掉；当前项为选中浅底并带 `aria-current="page"`，当前项变为侧栏可见范围之外的一项时，
 * 侧栏把它滚到可见处。`collapsed` 只显示图标，悬停与键盘聚焦时
 * 在提示中显示文字。在 AppShell 中选择一项后，窄屏的侧栏抽屉随之关闭。
 * @category Patterns
 * @usage The main navigation in the sidebar of an application; the sections of a settings area
 * @usageZh 应用侧栏中的主导航；设置区域中的分区导航
 */
export function Nav(props: NavProps) {
  const t = useT()
  const sidebar = useSidebarState()
  const ref = useRef<HTMLElement>(null)
  const baseId = useId()
  // 在 AppShell 的侧栏中：跟随侧栏（图标窄栏时收起；窄屏抽屉里总是展开）
  const collapsed = props.collapsed ?? sidebar?.rail ?? false

  // 当前项不在侧栏的可见范围内时（如链接打开了列表靠后的一页），把它滚到中间。只在 AppShell 的侧栏中：放在页面
  // 中的 Nav（如文档中的示例）不会滚动页面
  const value = props.value
  const scroller = sidebar?.scroller
  useEffect(() => {
    const view = scroller?.()
    const current = ref.current?.querySelector<HTMLElement>('[aria-current="page"]')
    if (value == null || !view || !current || view.scrollHeight <= view.clientHeight) return
    const box = current.getBoundingClientRect()
    const area = view.getBoundingClientRect()
    if (box.top >= area.top && box.bottom <= area.bottom) return
    view.scrollTop += box.top - area.top - (area.height - box.height) / 2
  }, [value, scroller])

  const choose = (key: string, e: MouseEvent) => {
    const link =
      e.currentTarget instanceof HTMLAnchorElement && e.currentTarget.hasAttribute('href')
    if (link && opensElsewhere(e)) return
    if (link && props.onSelect) e.preventDefault()
    props.onSelect?.(key)
    sidebar?.onNavigate()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    const items = [...(ref.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? [])]
    const at = items.indexOf(document.activeElement as HTMLElement)
    if (at < 0) return
    const last = items.length - 1
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? last
          : Math.min(last, Math.max(0, at + (event.key === 'ArrowDown' ? 1 : -1)))
    event.preventDefault()
    items[next]?.focus()
  }

  const renderItems = (items: readonly NavItem[]) =>
    items.map((item) => (
      <ItemView
        key={item.key}
        item={item}
        current={props.value != null && item.key === props.value}
        collapsed={collapsed}
        onChoose={choose}
      />
    ))

  // 连续的未分组项放在同一个列表中；每个分组是一个带标题的列表
  const blocks: JSX.Element[] = []
  let loose: NavItem[] = []
  const flush = () => {
    if (loose.length === 0) return
    blocks.push(
      <ul key={`items-${blocks.length}`} className={styles.list}>
        {renderItems(loose)}
      </ul>,
    )
    loose = []
  }
  props.items.forEach((entry, index) => {
    if (!isGroup(entry)) {
      loose.push(entry)
      return
    }
    flush()
    const headingId = `${baseId}-group-${index}`
    blocks.push(
      <div key={entry.key ?? entry.label} className={styles.group}>
        <div id={headingId} className={styles.heading}>
          {entry.label}
        </div>
        <ul className={styles.list} aria-labelledby={headingId}>
          {renderItems(entry.items)}
        </ul>
      </div>,
    )
  })
  flush()

  return (
    <nav
      ref={ref}
      id={props.id}
      data-testid={props.testId}
      aria-label={props['aria-label'] ?? t('nav.label')}
      className={styles.nav}
      data-collapsed={collapsed || undefined}
      onKeyDown={onKeyDown}
    >
      {blocks}
    </nav>
  )
}
