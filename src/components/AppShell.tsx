/**
 * 应用框架：顶栏、侧栏（通常是 Nav）与主内容区。占满视口，主内容区与侧栏各自滚动；侧栏可收起为图标窄栏，
 * 宽度不足时变为浮在内容上的抽屉。主内容区带 `view-transition-name: vl-main`，global.css 的页面切换无需额外样式。
 *
 * 宽窄按 AppShell 自身的宽度判断（不是视口）：嵌在预览、示例中时同样正确。布局由容器查询完成（服务端渲染时也
 * 正确），行为（切换按钮的含义、抽屉的焦点约束）由 ResizeObserver 测得的宽度决定，两者用同一个断点。
 */

import {
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useT } from '../i18n/index.ts'
import styles from './app-shell.module.css'
import {
  APP_SHELL_NARROW_BELOW,
  AppShellContext,
  type AppShellState,
  SidebarContext,
  type SidebarState,
  useAppShellState,
} from './appShellContext.ts'
import { IconButton } from './Extras.tsx'
import { FocusScope } from './FocusScope.tsx'

// 服务端没有布局，useLayoutEffect 换成 useEffect（React 19 不再警告，但这样更明确）
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/**
 * Props of AppShell.
 * @zh AppShell 属性。
 */
export interface AppShellProps {
  /**
   * Content of the top bar, laid out in a row with step 3 gaps: usually AppShell.Toggle, the name of the
   * application, a Spacer, then search and the account menu. Rendered in a `header` landmark.
   * @zh 顶栏内容，按行排列、间距档位 3：通常是 AppShell.Toggle、应用名称、Spacer，然后是搜索与账户菜单。
   * 输出为 `header` 区域。
   */
  readonly header?: ReactNode
  /**
   * Content of the sidebar, usually a Nav; it scrolls on its own. A Nav inside follows the collapsed state.
   * @zh 侧栏内容，通常是一个 Nav；侧栏单独滚动。其中的 Nav 跟随收起状态。
   */
  readonly sidebar?: ReactNode
  /**
   * The page, rendered in the `main` landmark, which scrolls on its own; usually a Page.
   * @zh 页面内容，输出在单独滚动的 `main` 区域中；通常是一个 Page。
   */
  readonly children?: ReactNode
  /**
   * Collapsed sidebar (controlled): icons only. Applies to wide layouts; on narrow ones, the sidebar is a drawer
   * that is closed until AppShell.Toggle opens it.
   * @zh 侧栏收起（受控）：只显示图标。只作用于宽布局；窄布局中侧栏是抽屉，AppShell.Toggle 打开前一直关闭。
   */
  readonly collapsed?: boolean
  /**
   * Initial collapsed state (uncontrolled).
   * @zh 初始的收起状态（非受控）。
   * @default false
   */
  readonly defaultCollapsed?: boolean
  /**
   * Called with the new state when AppShell.Toggle collapses or expands the sidebar of a wide layout.
   * @zh 宽布局中 AppShell.Toggle 收起或展开侧栏时，以新状态调用。
   */
  readonly onCollapsedChange?: (collapsed: boolean) => void
  /**
   * What the collapsed sidebar shows: an icon rail (the Nav inside shows icons only, with tooltips), or nothing
   * with `rail={false}`, for navigation without icons such as documentation.
   * @zh 收起的侧栏显示什么：图标窄栏（其中的 Nav 只显示图标，带提示）；`rail={false}` 时什么都不显示，用于没有图标的导航，
   * 如文档。
   * @default true
   */
  readonly rail?: boolean
  /**
   * Width step of the expanded sidebar: `sm` 240, `md` 280, `lg` 320 px (the widths of SplitView).
   * @zh 展开的侧栏宽度档位：sm 240、md 280、lg 320px（与 SplitView 相同）。
   * @default 'sm'
   */
  readonly sidebarWidth?: 'sm' | 'md' | 'lg'
  /**
   * Main area without padding, for full-screen interfaces (a chat, image viewing) whose root is a flush SplitView.
   * @zh 主内容区没有内边距，用于以贴边 SplitView 为根的全屏界面（聊天、看图）。
   */
  readonly flush?: boolean
  /**
   * Fills its container instead of the viewport: for an application inside a frame, a preview or an example.
   * @zh 占满所在容器而不是视口：用于框架内的应用、预览与示例。
   */
  readonly contained?: boolean
  /**
   * `id` of the `main` element, the target of the skip link; generated when omitted.
   * @zh `main` 元素的 `id`，也是跳转链接的目标；不传时自动生成。
   */
  readonly mainId?: string
  /**
   * Test id, rendered as `data-testid`.
   * @zh 测试定位，输出为 `data-testid`。
   */
  readonly testId?: string
}

/**
 * Props of AppShell.Toggle.
 * @zh AppShell.Toggle 属性。
 */
export interface AppShellToggleProps {
  /**
   * Test id, rendered as `data-testid`.
   * @zh 测试定位，输出为 `data-testid`。
   */
  readonly testId?: string
}

/**
 * AppShell and its static members.
 * @zh AppShell 及其静态成员。
 */
export interface AppShellComponent {
  /**
   * Renders the frame of an application.
   * @zh 渲染应用框架。
   */
  (props: AppShellProps): ReactElement
  /**
   * The button that shows or hides the sidebar, to place in the header (usually first) or anywhere inside
   * AppShell: on wide layouts it collapses and expands the sidebar ("Collapse sidebar" / "Expand sidebar"), on
   * narrow ones it opens the sidebar drawer ("Open navigation"). It is an IconButton with `aria-expanded` and
   * `aria-controls`; outside AppShell it renders nothing.
   * @zh 显示或隐藏侧栏的按钮，放在顶栏（通常是第一个）或 AppShell 内的任意位置：宽布局中收起、展开侧栏
   * （「收起侧栏」/「展开侧栏」），窄布局中打开侧栏抽屉（「打开导航」）。它是带 `aria-expanded` 与 `aria-controls`
   * 的 IconButton；在 AppShell 之外不渲染。
   */
  readonly Toggle: (props: AppShellToggleProps) => ReactElement | null
}

function AppShellToggle(props: AppShellToggleProps) {
  const t = useT()
  const shell = useAppShellState()
  if (!shell) return null
  const label = shell.narrow
    ? t(shell.overlayOpen ? 'appShell.closeNavigation' : 'appShell.openNavigation')
    : t(shell.collapsed ? 'appShell.expand' : 'appShell.collapse')
  return (
    <IconButton
      icon="sidebar"
      label={label}
      aria-expanded={shell.narrow ? shell.overlayOpen : !shell.collapsed}
      aria-controls={shell.sidebarId}
      data-testid={props.testId}
      onClick={shell.toggle}
    />
  )
}

/** 抽屉打开时首先聚焦的元素：当前页的导航项，没有时是第一个可聚焦的元素。 */
function initialFocus(root: HTMLElement): HTMLElement | null {
  return (
    root.querySelector<HTMLElement>('[aria-current="page"]:not([aria-disabled="true"])') ??
    root.querySelector<HTMLElement>('a[href], button:not(:disabled), [tabindex="0"]')
  )
}

function AppShellRoot(props: AppShellProps) {
  const t = useT()
  const outer = useAppShellState()
  const generatedId = useId()
  const mainId = props.mainId ?? `${generatedId}-main`
  const sidebarId = `${generatedId}-sidebar`
  const rootRef = useRef<HTMLDivElement>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)

  const [innerCollapsed, setInnerCollapsed] = useState(props.defaultCollapsed ?? false)
  const collapsed = props.collapsed ?? innerCollapsed
  const [narrow, setNarrow] = useState(false)
  const [overlayOpen, setOverlayOpen] = useState(false)
  const hasSidebar = props.sidebar !== undefined && props.sidebar !== null
  const open = narrow && overlayOpen && hasSidebar

  useIsoLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const measure = () => setNarrow(root.clientWidth < APP_SHELL_NARROW_BELOW)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  // 变宽后抽屉不再存在：下次变窄时从关闭开始
  useEffect(() => {
    if (!narrow) setOverlayOpen(false)
  }, [narrow])

  // 抽屉打开时 Esc 关闭它（弹层、提示先处理自己的 Esc 并阻止默认行为）
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) setOverlayOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  // 抽屉打开：焦点移到当前页的导航项（FocusScope 在子组件中先把焦点放到抽屉上，并在关闭后还给切换按钮）
  useEffect(() => {
    if (!open) return
    const sidebar = sidebarRef.current
    if (sidebar) initialFocus(sidebar)?.focus({ preventScroll: true })
  }, [open])

  const { onCollapsedChange } = props
  const controlled = props.collapsed !== undefined
  const toggle = useCallback(() => {
    if (narrow) {
      setOverlayOpen((v) => !v)
      return
    }
    const next = !collapsed
    if (!controlled) setInnerCollapsed(next)
    onCollapsedChange?.(next)
  }, [narrow, collapsed, controlled, onCollapsedChange])
  const onNavigate = useCallback(() => setOverlayOpen(false), [])

  const state = useMemo<AppShellState>(
    () => ({ sidebarId, collapsed, narrow, overlayOpen: open, toggle }),
    [sidebarId, collapsed, narrow, open, toggle],
  )
  const rail = props.rail ?? true
  const scroller = useCallback(() => sidebarRef.current, [])
  const sidebarState = useMemo<SidebarState>(
    () => ({ rail: rail && collapsed && !narrow, scroller, onNavigate }),
    [rail, collapsed, narrow, scroller, onNavigate],
  )

  // 跳转链接不改地址（用哈希路由的应用会把 #id 当成一个页面），直接把焦点移到主内容区
  const skip = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    document.getElementById(mainId)?.focus()
  }

  return (
    <AppShellContext.Provider value={state}>
      <div
        ref={rootRef}
        className={styles.root}
        data-testid={props.testId}
        data-contained={props.contained || undefined}
      >
        <a className={styles.skip} href={`#${mainId}`} onClick={skip}>
          {t('appShell.skipToContent')}
        </a>
        <div
          className={styles.frame}
          data-sidebar={hasSidebar || undefined}
          data-collapsed={(hasSidebar && collapsed) || undefined}
          data-rail={rail || undefined}
          data-width={props.sidebarWidth ?? 'sm'}
          data-open={open || undefined}
        >
          {props.header !== undefined && props.header !== null && (
            <header className={styles.header} inert={open || undefined}>
              {props.header}
            </header>
          )}
          {hasSidebar && (
            <>
              {open && (
                // 点击遮罩关闭抽屉；键盘用 Esc，读屏不需要它
                <div className={styles.scrim} aria-hidden="true" onClick={onNavigate} />
              )}
              <div
                ref={sidebarRef}
                id={sidebarId}
                className={styles.sidebar}
                // 只在窄布局打开时是对话框；宽布局中只是一列，不是单独的区域
                {...(open
                  ? { role: 'dialog', 'aria-modal': true, 'aria-label': t('appShell.navigation') }
                  : {})}
              >
                {open && <FocusScope active restoreFocus />}
                <SidebarContext.Provider value={sidebarState}>
                  {props.sidebar}
                </SidebarContext.Provider>
              </div>
            </>
          )}
          <main
            id={mainId}
            tabIndex={-1}
            className={styles.main}
            data-flush={props.flush || undefined}
            // 页面切换只认一个 vl-main：嵌套的 AppShell（如文档中的示例）不设置
            data-transition={outer ? undefined : ''}
            inert={open || undefined}
          >
            {props.children}
          </main>
        </div>
      </div>
    </AppShellContext.Provider>
  )
}

/**
 * The frame of an application: a top bar, a sidebar (usually a Nav) and the main area. It fills the viewport; the
 * main area and the sidebar scroll on their own. Every application needs it exactly once, around its pages.
 *
 * **Interaction**: a skip link ("Skip to content") is the first focusable element and moves the focus to the main
 * area. AppShell.Toggle collapses the sidebar to icons on wide layouts (controlled with `collapsed` and
 * `onCollapsedChange`, or uncontrolled with `defaultCollapsed`); with `rail={false}` it hides the sidebar instead.
 * Below 960 px of width (a narrow page next to the
 * narrowest sidebar), the sidebar becomes a drawer over the content: AppShell.Toggle opens it, focus moves to the
 * current item and stays inside, and `Esc`, a click outside or choosing a Nav item close it and return the focus.
 * The main area has `view-transition-name: vl-main`, so the page transition of `vellum-ui/global.css` works
 * without CSS of your own. Landmarks: `header`, the `nav` of Nav, `main`.
 * @zh 应用框架：顶栏、侧栏（通常是 Nav）与主内容区。占满视口，主内容区与侧栏各自滚动。每个应用在页面外层用且只用一次。
 *
 * **交互**：第一个可聚焦元素是跳转链接（「跳到正文」），把焦点移到主内容区。宽布局中 AppShell.Toggle 把侧栏收起为
 * 图标（受控用 `collapsed` 与 `onCollapsedChange`，非受控用 `defaultCollapsed`）；`rail={false}` 时改为隐藏侧栏。宽度小于 960px（窄页面加最窄的
 * 侧栏）时，侧栏变为浮在内容上的抽屉：AppShell.Toggle 打开它，焦点移到当前项并留在抽屉内，`Esc`、点击外部或
 * 选择 Nav 中的一项会关闭它并交还焦点。主内容区带 `view-transition-name: vl-main`，`vellum-ui/global.css` 的页面
 * 切换不需要自己写样式。区域：`header`、Nav 的 `nav`、`main`。
 * @category Patterns
 * @usage The root of an application: top bar, sidebar navigation and the page
 * @usageZh 应用的根：顶栏、侧栏导航与页面
 */
export const AppShell: AppShellComponent = /* @__PURE__ */ Object.assign(AppShellRoot, {
  Toggle: AppShellToggle,
})
