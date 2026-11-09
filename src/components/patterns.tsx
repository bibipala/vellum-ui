/**
 * 页面级模式：页面骨架、工具栏、主从分栏、面板、分组。
 * 使用方把内容填进插槽，不写布局与外观样式（参考 Compose 的 Scaffold）。
 */
import type { MouseEvent, ReactNode, Ref } from 'react'
import { Heading } from './basic.tsx'
import { Icon } from './Icon.tsx'
import type { BaseProps, SpaceStep } from './layout.tsx'
import { Tooltip } from './overlays.tsx'
import styles from './patterns.module.css'

const space = (s: SpaceStep | undefined) => (s === undefined ? undefined : `var(--vl-space-${s})`)
const base = (p: BaseProps) => ({
  'data-testid': p.testId,
  'aria-label': p['aria-label'],
  role: p.role,
  id: p.id,
})

/**
 * The back action of Page and PageHeader: an icon button with an arrow before the title, which goes to the parent
 * page (from a record to its list). Give `href` for a link, `onClick` for an action, or both for client-side
 * routing (call `event.preventDefault()` in `onClick`).
 * @zh Page 与 PageHeader 的返回操作：标题前带箭头的图标按钮，回到上一级页面（从一条记录回到列表）。给 `href` 时是链接，
 * 给 `onClick` 时是按钮；客户端路由两者都给（在 `onClick` 中调用 `event.preventDefault()`）。
 */
export interface PageBack {
  /**
   * Accessible name and tooltip, naming where it goes, such as "Back to projects".
   * @zh 读屏名称与提示，说明回到哪里，如「返回项目列表」。
   */
  readonly label: string
  /**
   * Address of the parent page: the button is rendered as a link (`<a>`).
   * @zh 上一级页面的地址：按钮输出为链接（`<a>`）。
   */
  readonly href?: string
  /**
   * Called on click (and on `Enter`, and `Space` for a button).
   * @zh 点击（以及 `Enter`，按钮还有空格）时调用。
   */
  readonly onClick?: (event: MouseEvent<HTMLElement>) => void
}

/** PageHeader 与 Page 共有的标题属性。 */
interface PageTitleProps {
  /**
   * Page title.
   * @zh 页面标题。
   */
  readonly title: ReactNode
  /**
   * One sentence of description below the title.
   * @zh 标题下的一句说明。
   */
  readonly subtitle?: ReactNode
  /**
   * Back action shown before the title, such as from a detail page to its list.
   * @zh 标题前的返回操作，如从详情页回到列表。
   */
  readonly back?: PageBack
  /**
   * The `<h1>` of the title. It has `tabIndex={-1}`, so it can be focused from code without entering the `Tab`
   * order: after a client-side navigation, call `titleRef.current?.focus()` so that screen readers announce the new
   * page and the next `Tab` starts from the top of the content.
   * @zh 标题的 `<h1>`。它带 `tabIndex={-1}`，可以用代码聚焦而不进入 `Tab` 顺序：客户端路由切换页面后调用
   * `titleRef.current?.focus()`，读屏读出新页面，下一次 `Tab` 从内容的开头开始。
   */
  readonly titleRef?: Ref<HTMLHeadingElement>
}

/** PageHeader 属性。 */
export interface PageHeaderProps extends BaseProps, PageTitleProps {
  /**
   * Actions on the right: the primary action goes rightmost, as `Button variant="primary"`; the others are default
   * buttons or IconButtons.
   * @zh 右侧操作区：主操作放最右，用 `Button variant="primary"`；其余为普通按钮或 IconButton。
   */
  readonly actions?: ReactNode
}

function BackButton({ back }: { readonly back: PageBack }) {
  const icon = <Icon name="arrow-left" />
  // 有地址时是链接（新标签页打开、复制地址都可用），否则是按钮；外观与 IconButton 一致
  const el = back.href ? (
    <a
      href={back.href}
      aria-label={back.label}
      className={styles.back}
      data-vl-state=""
      onClick={back.onClick}
    >
      {icon}
    </a>
  ) : (
    <button
      type="button"
      aria-label={back.label}
      className={styles.back}
      data-vl-state=""
      onClick={back.onClick}
    >
      {icon}
    </button>
  )
  return <Tooltip title={back.label}>{el}</Tooltip>
}

/**
 * Page header: title, description and actions on the right, with an optional back action before the title.
 * Usually not used on its own but rendered through the slots of Page.
 *
 * **Interaction**: the back action is an icon button (a link with `href`) with a tooltip; `Tab` reaches it before
 * the actions. The title can be focused from code through `titleRef` and is not in the `Tab` order.
 * @zh 页面头：标题、说明与右侧操作，标题前可以有返回操作。通常不单独使用，而是通过 Page 的插槽生成。
 *
 * **交互**：返回操作是带提示的图标按钮（有 `href` 时是链接），`Tab` 先于右侧操作到达它。标题可以通过 `titleRef`
 * 用代码聚焦，不在 `Tab` 顺序中。
 * @category Patterns
 * @usage Title row of a page; on its own when a drawer or a standalone area needs the same title row
 * @usageZh 页面标题行；抽屉或独立区域需要同样的标题行时单独使用
 */
export function PageHeader(props: PageHeaderProps) {
  return (
    <header {...base(props)} className={styles.header}>
      <div className={styles.headerLead}>
        {props.back && <BackButton back={props.back} />}
        <div className={styles.headerText}>
          <h1 ref={props.titleRef} tabIndex={-1} className={styles.title}>
            {props.title}
          </h1>
          {props.subtitle && <p className={styles.subtitle}>{props.subtitle}</p>}
        </div>
      </div>
      {props.actions && <div className={styles.headerActions}>{props.actions}</div>}
    </header>
  )
}

/** Page 属性。 */
export interface PageProps extends BaseProps, PageTitleProps {
  /**
   * Actions on the right of the page header.
   * @zh 页面头右侧的操作。
   */
  readonly actions?: ReactNode
  /**
   * Toolbar below the page header (filters, search, view switching), usually a Toolbar.
   * @zh 页面头下方的工具栏（筛选、搜索、视图切换），通常放一个 Toolbar。
   */
  readonly toolbar?: ReactNode
  /**
   * Maximum width of the content: `narrow` for forms and settings, `default` for lists and details, `full` for no
   * limit.
   * @zh 内容最大宽度：narrow 适合表单与设置，default 适合列表与详情，full 不限宽。
   * @default 'default'
   */
  readonly width?: 'narrow' | 'default' | 'full'
  /**
   * The content area fills the remaining height (for pages whose content scrolls by itself, such as a split view).
   * @zh 内容区占满剩余高度（内容自己滚动的页面，如主从分栏）。
   */
  readonly fill?: boolean
  /**
   * Body of the page.
   * @zh 页面主体。
   */
  readonly children?: ReactNode
}

/**
 * Page layout: page header (title, description, actions, an optional back action), toolbar and content, with
 * consistent spacing, maximum width and entrance motion. Every page should have Page as its root (except
 * full-screen interfaces such as image viewing or chat).
 * @zh 页面骨架：页面头（标题、说明、操作，可选的返回操作）、工具栏、内容，统一间距、最大宽度与进入动效。
 * 每个页面都应以 Page 为根（看图、聊天等全屏界面除外）。
 * @category Patterns
 * @usage Root component of list, detail and settings pages
 * @usageZh 列表页、详情页、设置页的根组件
 */
export function Page(props: PageProps) {
  return (
    <div
      {...base(props)}
      className={styles.page}
      data-width={props.width ?? 'default'}
      data-fill={props.fill || undefined}
    >
      <PageHeader
        title={props.title}
        subtitle={props.subtitle}
        back={props.back}
        titleRef={props.titleRef}
        actions={props.actions}
      />
      {props.toolbar}
      <div className={styles.body}>{props.children}</div>
    </div>
  )
}

/** Toolbar 属性。 */
export interface ToolbarProps extends BaseProps {
  /**
   * Left side: search field, filters, view switching and so on.
   * @zh 左侧：搜索框、筛选、视图切换等。
   */
  readonly children?: ReactNode
  /**
   * Right side: actions related to the current view.
   * @zh 右侧：与当前视图相关的操作。
   */
  readonly actions?: ReactNode
}

/**
 * Toolbar with filters and search on the left and actions on the right, wrapping when space runs out. The gap is
 * fixed at step 3.
 *
 * **Interaction**: the controls are reached one by one with `Tab`, in reading order. It is not an ARIA toolbar with
 * arrow-key navigation, because it usually contains a search field, where the arrow keys move the cursor. With an
 * `aria-label`, it is announced as a labeled group.
 * @zh 工具栏：左侧放筛选与搜索，右侧放操作，空间不足时换行。间距固定为档位 3。
 *
 * **交互**：按阅读顺序用 `Tab` 逐个到达其中的控件。它不是用方向键切换的 ARIA 工具栏：里面通常有搜索框，方向键要用来移动光标。
 * 提供 `aria-label` 时，读屏把它读作带名称的分组。
 * @category Patterns
 * @usage Search, filters and bulk actions above a list; title rows of split panes
 * @usageZh 列表上方的搜索、筛选与批量操作；分栏标题行
 */
export function Toolbar(props: ToolbarProps) {
  return (
    <div
      {...base(props)}
      className={styles.toolbar}
      // 带名称时是一个分组；role="toolbar" 要求方向键漫游焦点，而这里的控件用 Tab 逐个到达
      role={props.role ?? (props['aria-label'] ? 'group' : undefined)}
    >
      {props.children}
      {props.actions && <div className={styles.toolbarActions}>{props.actions}</div>}
    </div>
  )
}

/** SplitView 属性。 */
export interface SplitViewProps extends BaseProps {
  /**
   * Narrow column on the left (aside): a tree, a list of conversations, categories.
   * @zh 左侧窄栏：树、会话列表、分类。
   */
  readonly aside: ReactNode
  /**
   * Main area on the right.
   * @zh 右侧主区域。
   */
  readonly children?: ReactNode
  /**
   * Width step of the aside: `sm` 240, `md` 280, `lg` 320 px.
   * @zh 左栏宽度档位：sm 240、md 280、lg 320px。
   * @default 'md'
   */
  readonly asideWidth?: 'sm' | 'md' | 'lg'
  /**
   * Appearance: `panel` shows two separate panels (inside a page); `flush` shows a divider line edge to edge (in
   * full-screen interfaces).
   * @zh 外观：panel 为两块独立面板（页面内使用）；flush 为贴边分割线（全屏界面使用）。
   * @default 'panel'
   */
  readonly variant?: 'panel' | 'flush'
}

/**
 * Split view: choose in the narrow column on the left, see the details on the right; each side scrolls on its own.
 * @zh 主从分栏：左侧窄栏选择、右侧显示详情，两侧各自滚动。
 * @category Patterns
 * @usage Teams + members, roles + permissions, conversations + messages
 * @usageZh 团队列表 + 成员、角色列表 + 权限、会话列表 + 消息
 */
export function SplitView(props: SplitViewProps) {
  return (
    <div
      {...base(props)}
      className={styles.split}
      data-variant={props.variant ?? 'panel'}
      style={{
        gridTemplateColumns: `var(--vl-split-aside-${props.asideWidth ?? 'md'}) minmax(0, 1fr)`,
      }}
    >
      <aside className={styles.splitAside}>{props.aside}</aside>
      <section className={styles.splitMain}>{props.children}</section>
    </div>
  )
}

/** Panel 属性。 */
export interface PanelProps extends BaseProps {
  /**
   * Panel title; without it, the panel has no title row.
   * @zh 面板标题；不传则没有标题行。
   */
  readonly title?: ReactNode
  /**
   * Actions on the right of the title.
   * @zh 标题右侧的操作。
   */
  readonly actions?: ReactNode
  /**
   * Flush content (tables, lists, trees) without padding.
   * @zh 内容贴边（表格、列表、树），不加内边距。
   */
  readonly flush?: boolean
  /**
   * Padding step of the content (ignored with `flush`).
   * @zh 内容内边距档位（flush 时无效）。
   * @default 4
   */
  readonly padding?: SpaceStep
  /**
   * Fills the remaining height of the parent; the content scrolls inside the panel.
   * @zh 占满父容器的剩余高度，内容在面板内滚动。
   */
  readonly fill?: boolean
  /**
   * Contents of the panel.
   * @zh 面板内容。
   */
  readonly children?: ReactNode
}

/**
 * Panel: a rounded surface (with a very faint contact shadow in light mode and no border), optionally with a title
 * row. It holds one complete piece of content such as a table, a list or a form. The title row has the same
 * horizontal padding as the content; with `flush`, it lines up with the text of the table cells.
 * @zh 面板：圆角表面（浅色模式带极淡的贴近阴影，不描边），可带标题行。承载表格、列表、表单等一块完整内容。
 * 标题行的左右内边距与内容一致；`flush` 时与表格单元格的文字对齐。
 * @category Patterns
 * @usage Wrapping a table or a list; a standalone block of content on a page; one side of a split view
 * @usageZh 包裹表格或列表；页面中的一块独立内容；主从分栏的一侧
 */
export function Panel(props: PanelProps) {
  const hasHead = props.title !== undefined || props.actions !== undefined
  return (
    <section {...base(props)} className={styles.panel} data-fill={props.fill || undefined}>
      {hasHead && (
        <div
          className={styles.panelHead}
          // 标题与内容左对齐：非 flush 时取内容的内边距；flush 时用样式中与表格文字对齐的默认值
          style={{ paddingInline: props.flush ? undefined : space(props.padding ?? 4) }}
        >
          <div className={styles.panelTitle}>{props.title}</div>
          {props.actions && <div className={styles.headerActions}>{props.actions}</div>}
        </div>
      )}
      <div
        className={styles.panelBody}
        style={{ padding: props.flush ? undefined : space(props.padding ?? 4) }}
      >
        {props.children}
      </div>
    </section>
  )
}

/** Section 属性。 */
export interface SectionProps extends BaseProps {
  /**
   * Section title.
   * @zh 分组标题。
   */
  readonly title: ReactNode
  /**
   * Heading level of the title, with the sizes of Heading: 2 for the parts of a page (xl), 3 for parts inside a
   * part (lg), 4 for the lowest level (body size, md). Nest Sections with increasing levels to build an outline
   * under the `h1` of Page; in a drawer, a dialog or a panel, whose own title is small, use 4.
   * @zh 标题的级别，字号与 Heading 相同：2 页面的各个部分（xl），3 部分中的小节（lg），4 最低一级（与正文同字号，md）。
   * 嵌套的 Section 逐级加大级别，在 Page 的 `h1` 之下形成大纲；在抽屉、弹窗、面板中（它们自己的标题较小）用 4。
   * @default 2
   */
  readonly level?: 2 | 3 | 4
  /**
   * One sentence of description below the title.
   * @zh 标题下的一句说明。
   */
  readonly description?: ReactNode
  /**
   * Actions on the right of the title row.
   * @zh 标题行右侧的操作。
   */
  readonly actions?: ReactNode
  /**
   * Spacing step between the title and the content, and between the children of the content.
   * @zh 标题与内容之间、内容子元素之间的间距档位。
   * @default 3
   */
  readonly gap?: SpaceStep
  /**
   * Contents of the section.
   * @zh 分组内容。
   */
  readonly children?: ReactNode
}

/**
 * Section: a group of content with a title and a description, dividing pages, panels and drawers into parts. It
 * replaces section headings that each page would otherwise build on its own. `level` sets the heading level and
 * size (2, 3 or 4, as Heading), so nested Sections form the outline of a page.
 * @zh 分组：带标题与说明的一组内容，用于页面、面板、抽屉内部的分段。替代各页面各自实现的分组小标题。`level` 决定
 * 标题的级别与字号（2、3 或 4，与 Heading 相同），嵌套的 Section 组成页面的大纲。
 * @category Patterns
 * @usage Groups of a settings page, parts of a detail page, groups of form fields in a drawer
 * @usageZh 设置页的分组、详情页的信息分段、抽屉内的表单分组
 */
export function Section(props: SectionProps) {
  return (
    <section {...base(props)} className={styles.section} style={{ gap: space(props.gap ?? 3) }}>
      <div className={styles.sectionHead}>
        <div className={styles.headerText}>
          <Heading level={props.level ?? 2}>{props.title}</Heading>
          {props.description && <p className={styles.subtitle}>{props.description}</p>}
        </div>
        {props.actions && <div className={styles.headerActions}>{props.actions}</div>}
      </div>
      {props.children}
    </section>
  )
}
