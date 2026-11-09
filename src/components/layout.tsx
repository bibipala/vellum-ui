/**
 * 布局原语：使用方用它们排版，不写布局 CSS。
 * 参数只接受令牌档位与有限的枚举值；不接受 style / className，这样整个应用的间距、对齐方式保持一致。
 */
import type { AriaRole, JSX, ReactNode } from 'react'
import styles from './layout.module.css'

/**
 * Spacing step: the tokens `space-0` … `space-8`, which are 0, 4, 8, 12, 16, 24, 32, 48 and 64 px.
 * @zh 间距档位，对应令牌 `space-0` … `space-8`（0、4、8、12、16、24、32、48、64px）。
 */
export type SpaceStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

/**
 * Alignment on the cross axis (vertical in Inline, horizontal in Stack).
 * @zh 交叉轴对齐（Inline 中为纵向，Stack 中为横向）。
 */
export type Align = 'start' | 'center' | 'end' | 'stretch' | 'baseline'

/**
 * Distribution on the main axis; `between` puts the free space between the children.
 * @zh 主轴分布；`between` 把剩余空间分配在子元素之间。
 */
export type Justify = 'start' | 'center' | 'end' | 'between'

/**
 * Accessibility and test props shared by all layout primitives (and, partly, by other components): `testId`,
 * `aria-label`, `role` and `id`, rendered on the root element.
 * @zh 所有布局原语（以及部分其他组件）共有的可访问性与测试属性：`testId`、`aria-label`、`role`、`id`，输出在根元素上。
 */
export interface BaseProps {
  /**
   * Test id, rendered as `data-testid`.
   * @zh 测试定位，输出为 `data-testid`。
   */
  readonly testId?: string
  /**
   * Accessible name, rendered as `aria-label`.
   * @zh 读屏名称，输出为 `aria-label`。
   */
  readonly 'aria-label'?: string
  /**
   * ARIA role of the root element, such as `region` or `list`.
   * @zh 根元素的 ARIA 角色，如 `region`、`list`。
   */
  readonly role?: AriaRole
  /**
   * `id` of the root element.
   * @zh 根元素的 `id`。
   */
  readonly id?: string
}

type Tag = 'div' | 'section' | 'header' | 'footer' | 'nav' | 'aside' | 'main' | 'ul' | 'ol' | 'li'

const space = (s: SpaceStep | undefined) => (s === undefined ? undefined : `var(--vl-space-${s})`)

const base = (p: BaseProps) => ({
  'data-testid': p.testId,
  'aria-label': p['aria-label'],
  role: p.role,
  id: p.id,
})

/**
 * Props of Stack.
 * @zh Stack 属性。
 */
export interface StackProps extends BaseProps {
  /**
   * Space between children, as a spacing step.
   * @zh 子元素之间的间距档位。
   * @default 3
   */
  readonly gap?: SpaceStep
  /**
   * Padding on all sides, as a spacing step; no padding when omitted.
   * @zh 四周内边距档位；不传则没有内边距。
   */
  readonly padding?: SpaceStep
  /**
   * Horizontal alignment of the children.
   * @zh 子元素在横向上的对齐。
   * @default 'stretch'
   */
  readonly align?: Align
  /**
   * Vertical distribution of the children (takes effect when the container has spare height).
   * @zh 子元素在纵向上的分布（父容器有剩余高度时生效）。
   * @default 'start'
   */
  readonly justify?: Justify
  /**
   * Takes up the remaining space in a parent Stack or Inline.
   * @zh 在父级 Stack / Inline 中占满剩余空间。
   */
  readonly grow?: boolean
  /**
   * Scrolls inside this container when the content overflows (and lets the container shrink).
   * @zh 内容超出时在本容器内滚动（同时允许本容器被压缩）。
   */
  readonly scroll?: boolean
  /**
   * HTML element to render, for semantics (`ul` / `li` for lists, `section` for page regions, and so on).
   * @zh 输出的 HTML 元素，用于语义（列表用 ul/li，页面区域用 section 等）。
   * @default 'div'
   */
  readonly as?: Tag
  /**
   * Content.
   * @zh 内容。
   */
  readonly children?: ReactNode
}

/**
 * Lays out children vertically, with spacing from the token steps. Use it to stack page blocks, form groups and
 * drawer content.
 * @zh 纵向排列子元素，间距取令牌档位。页面区块、表单分组、抽屉内容都用它堆叠。
 * @category Primitives
 * @usage Stacking blocks, form fields and lists vertically; replaces hand-written layout classes and layout CSS
 * @usageZh 纵向堆叠区块、表单项、列表；替代手写的布局类与布局 CSS
 */
export function Stack(props: StackProps) {
  const El = props.as ?? 'div'
  return (
    <El
      {...base(props)}
      className={styles.stack}
      data-align={props.align ?? 'stretch'}
      data-justify={props.justify ?? 'start'}
      data-grow={props.grow || undefined}
      data-scroll={props.scroll || undefined}
      style={{ gap: space(props.gap ?? 3), padding: space(props.padding) }}
    >
      {props.children}
    </El>
  )
}

/**
 * Props of Inline.
 * @zh Inline 属性。
 */
export interface InlineProps extends BaseProps {
  /**
   * Space between children, as a spacing step.
   * @zh 子元素之间的间距档位。
   * @default 2
   */
  readonly gap?: SpaceStep
  /**
   * Padding on all sides, as a spacing step; no padding when omitted.
   * @zh 四周内边距档位；不传则没有内边距。
   */
  readonly padding?: SpaceStep
  /**
   * Vertical alignment of the children.
   * @zh 子元素在纵向上的对齐。
   * @default 'center'
   */
  readonly align?: Align
  /**
   * Horizontal distribution of the children; `between` pushes the first and last children to the two ends.
   * @zh 子元素在横向上的分布；`between` 把首尾元素推到两端。
   * @default 'start'
   */
  readonly justify?: Justify
  /**
   * Wraps onto new lines when there is not enough space (groups of tags or buttons).
   * @zh 空间不足时换行（标签组、按钮组）。
   */
  readonly wrap?: boolean
  /**
   * Takes up the remaining space in a parent Stack or Inline.
   * @zh 在父级 Stack / Inline 中占满剩余空间。
   */
  readonly grow?: boolean
  /**
   * HTML element to render.
   * @zh 输出的 HTML 元素。
   * @default 'div'
   */
  readonly as?: Tag
  /**
   * Content.
   * @zh 内容。
   */
  readonly children?: ReactNode
}

/**
 * Lays out children horizontally, vertically centered by default. Use it for toolbars, button groups and
 * "icon + text" combinations.
 * @zh 横向排列子元素，默认垂直居中。工具栏、按钮组、「图标 + 文字」组合都用它。
 * @category Primitives
 * @usage Buttons, tags, icons and text side by side; with a Spacer, pushing the rest to the right
 * @usageZh 横向排列按钮、标签、图标与文字；配合 Spacer 把后面的元素推到右侧
 */
export function Inline(props: InlineProps) {
  const El = props.as ?? 'div'
  return (
    <El
      {...base(props)}
      className={styles.inline}
      data-align={props.align ?? 'center'}
      data-justify={props.justify ?? 'start'}
      data-wrap={props.wrap || undefined}
      data-grow={props.grow || undefined}
      style={{ gap: space(props.gap ?? 2), padding: space(props.padding) }}
    >
      {props.children}
    </El>
  )
}

/**
 * Props of Grid.
 * @zh Grid 属性。
 */
export interface GridProps extends BaseProps {
  /**
   * Fixed number of columns; when omitted, columns are filled automatically by `minColumn` (responsive to the
   * width).
   * @zh 固定列数；不传则按 `minColumn` 自动填充（响应宽度变化）。
   */
  readonly columns?: 1 | 2 | 3 | 4 | 5 | 6
  /**
   * Minimum column width when filling automatically: `sm` 160 px, `md` 240 px, `lg` 320 px.
   * @zh 自动填充时每列的最小宽度档位：sm 160px、md 240px、lg 320px。
   * @default 'md'
   */
  readonly minColumn?: 'sm' | 'md' | 'lg'
  /**
   * Space between rows and columns, as a spacing step.
   * @zh 行列间距档位。
   * @default 3
   */
  readonly gap?: SpaceStep
  /**
   * Padding on all sides, as a spacing step; no padding when omitted.
   * @zh 四周内边距档位；不传则没有内边距。
   */
  readonly padding?: SpaceStep
  /**
   * HTML element to render.
   * @zh 输出的 HTML 元素。
   * @default 'div'
   */
  readonly as?: Tag
  /**
   * Content.
   * @zh 内容。
   */
  readonly children?: ReactNode
}

function GridRoot(props: GridProps) {
  const El = props.as ?? 'div'
  const min = `var(--vl-grid-column-${props.minColumn ?? 'md'})`
  return (
    <El
      {...base(props)}
      className={styles.grid}
      style={{
        gap: space(props.gap ?? 3),
        padding: space(props.padding),
        gridTemplateColumns: props.columns
          ? `repeat(${props.columns}, minmax(0, 1fr))`
          : `repeat(auto-fill, minmax(min(${min}, 100%), 1fr))`,
      }}
    >
      {props.children}
    </El>
  )
}

/**
 * Props of Grid.Item.
 * @zh Grid.Item 属性。
 */
export interface GridItemProps extends BaseProps {
  /**
   * Number of columns the item spans, or `full` for the whole row (from the first to the last column). With
   * automatic columns (`minColumn`), a number larger than the columns that fit adds columns and overflows the
   * grid; use `full` for items that must take the whole row.
   * @zh 跨越的列数，或 `full` 占满整行（从第一列到最后一列）。自动列数（`minColumn`）时，大于放得下的列数的数字会
   * 增加列、使网格溢出；必须占满整行的项用 `full`。
   * @default 1
   */
  readonly span?: 1 | 2 | 3 | 4 | 5 | 6 | 'full'
  /**
   * HTML element to render (`li` inside a Grid rendered as `ul`).
   * @zh 输出的 HTML 元素（Grid 输出为 `ul` 时用 `li`）。
   * @default 'div'
   */
  readonly as?: Tag
  /**
   * Content.
   * @zh 内容。
   */
  readonly children?: ReactNode
}

function GridItem(props: GridItemProps) {
  const El = props.as ?? 'div'
  const span = props.span ?? 1
  return (
    <El
      {...base(props)}
      className={styles.gridItem}
      style={{ gridColumn: span === 'full' ? '1 / -1' : `span ${span}` }}
    >
      {props.children}
    </El>
  )
}

/**
 * Grid and its static members.
 * @zh Grid 及其静态成员。
 */
export interface GridComponent {
  /**
   * Renders a grid.
   * @zh 渲染网格。
   */
  (props: GridProps): JSX.Element
  /**
   * A cell that spans several columns (`span={2}`) or the whole row (`span="full"`), such as a wide chart in a
   * dashboard or a full-width field in a two-column form. Other children of Grid take one column each and need no
   * Grid.Item.
   * @zh 跨越多列（`span={2}`）或整行（`span="full"`）的格子，如仪表盘中较宽的图表、两栏表单中占满一行的字段。Grid 的
   * 其他子元素各占一列，不需要 Grid.Item。
   */
  readonly Item: (props: GridItemProps) => JSX.Element
}

/**
 * Arranges children in a grid, with a fixed number of columns or filled automatically by a minimum column width.
 * Use it for card walls, grids of entry points and two-column forms. Each child takes one column; wrap a child in
 * `Grid.Item` with `span` to make it wider.
 * @zh 网格排列：固定列数，或按最小列宽自动填充。卡片墙、入口宫格、表单两栏都用它。每个子元素占一列；要更宽时用带
 * `span` 的 `Grid.Item` 包住它。
 * @category Primitives
 * @usage Card grids, grids of entry points on a home page, two- or three-column forms
 * @usageZh 卡片网格、首页入口宫格、两栏或三栏表单
 */
export const Grid: GridComponent = /* @__PURE__ */ Object.assign(GridRoot, { Item: GridItem })

/**
 * Props of Box.
 * @zh Box 属性。
 */
export interface BoxProps extends BaseProps {
  /**
   * Padding on all sides, as a spacing step.
   * @zh 四周内边距档位。
   */
  readonly padding?: SpaceStep
  /**
   * Horizontal padding, as a spacing step (overrides the left and right of `padding`).
   * @zh 横向内边距档位（覆盖 padding 的左右）。
   */
  readonly paddingX?: SpaceStep
  /**
   * Vertical padding, as a spacing step (overrides the top and bottom of `padding`).
   * @zh 纵向内边距档位（覆盖 padding 的上下）。
   */
  readonly paddingY?: SpaceStep
  /**
   * Background surface: `canvas`, `surface` (panel), `sunken` (input backgrounds, table headers) or `elevated`
   * (overlays).
   * @zh 背景表面：canvas 画布、surface 面板、sunken 凹陷（输入底、表头）、elevated 浮层。
   * @default 'none'
   */
  readonly surface?: 'none' | 'canvas' | 'surface' | 'sunken' | 'elevated'
  /**
   * Corner radius step.
   * @zh 圆角档位。
   * @default 'none'
   */
  readonly radius?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full'
  /**
   * Shows a hairline border. Hierarchy comes from backgrounds: separate blocks with `surface`, and use a border
   * only where an outline is really needed, such as drop zones and placeholders.
   * @zh 显示一圈发丝描边。层次靠底色：区分区块用 `surface`，描边只用于拖放区、占位框等确实需要轮廓的场景。
   */
  readonly border?: boolean
  /**
   * Takes up the remaining space in a parent Stack or Inline.
   * @zh 在父级 Stack / Inline 中占满剩余空间。
   */
  readonly grow?: boolean
  /**
   * Scrolls inside this container when the content overflows.
   * @zh 内容超出时在本容器内滚动。
   */
  readonly scroll?: boolean
  /**
   * HTML element to render.
   * @zh 输出的 HTML 元素。
   * @default 'div'
   */
  readonly as?: Tag
  /**
   * Content.
   * @zh 内容。
   */
  readonly children?: ReactNode
}

/**
 * A general-purpose container whose padding, surface, radius and border all come from tokens. Use it when you
 * need an area with a background that is not a full panel.
 * @zh 通用容器：内边距、表面、圆角、描边都取令牌。需要一块有底色的区域但又不是完整面板时使用。
 * @category Primitives
 * @usage Local background blocks, scrollable areas, padding around a group of content
 * @usageZh 局部底色块、可滚动区域、给一组内容加内边距
 */
export function Box(props: BoxProps) {
  const El = props.as ?? 'div'
  return (
    <El
      {...base(props)}
      className={styles.box}
      data-surface={props.surface ?? 'none'}
      data-border={props.border || undefined}
      data-grow={props.grow || undefined}
      data-scroll={props.scroll || undefined}
      style={{
        padding: space(props.padding),
        paddingInline: space(props.paddingX),
        paddingBlock: space(props.paddingY),
        borderRadius:
          props.radius && props.radius !== 'none' ? `var(--vl-radius-${props.radius})` : undefined,
      }}
    >
      {props.children}
    </El>
  )
}

/**
 * Flexible space that fills the remaining space in an Inline or Stack and pushes the following elements to the
 * other end.
 * @zh 弹性空白：在 Inline / Stack 中占满剩余空间，把后面的元素推到另一端。
 * @category Primitives
 * @usage Pushing the action buttons of a toolbar to the right
 * @usageZh 工具栏里把操作按钮推到右侧
 */
export function Spacer() {
  return <span className={styles.spacer} aria-hidden="true" />
}

/**
 * Props of Center.
 * @zh Center 属性。
 */
export interface CenterProps extends BaseProps {
  /**
   * Fills the height of the parent container (such as a full-page empty state).
   * @zh 占满父容器的高度（如整页空状态）。
   */
  readonly fill?: boolean
  /**
   * Padding on all sides, as a spacing step.
   * @zh 四周内边距档位。
   */
  readonly padding?: SpaceStep
  /**
   * Content.
   * @zh 内容。
   */
  readonly children?: ReactNode
}

/**
 * Centers its content horizontally and vertically in the available space.
 * @zh 把内容在可用空间中水平、垂直居中。
 * @category Primitives
 * @usage Empty states, loading indicators and placeholder notes for a whole page or area
 * @usageZh 整页或整块区域的空状态、加载指示、占位说明
 */
export function Center(props: CenterProps) {
  return (
    <div
      {...base(props)}
      className={styles.center}
      data-fill={props.fill || undefined}
      style={{ padding: space(props.padding) }}
    >
      {props.children}
    </div>
  )
}
