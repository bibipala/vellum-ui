/**
 * 展示与导航组件：
 * 提示条、描述列表、标签页、树、分页、分隔线、时间线、骨架。
 * antd 只作为内部实现；属性类型去掉 style / className 等外观入口，外观由令牌统一定义。
 */
import {
  type AlertRef,
  Alert as AntAlert,
  type AlertProps as AntAlertProps,
  Descriptions as AntDescriptions,
  type DescriptionsProps as AntDescriptionsProps,
  Divider as AntDivider,
  type DividerProps as AntDividerProps,
  Pagination as AntPagination,
  type PaginationProps as AntPaginationProps,
  Skeleton as AntSkeleton,
  type SkeletonProps as AntSkeletonProps,
  Tabs as AntTabs,
  type TabsProps as AntTabsProps,
  Timeline as AntTimeline,
  type TimelineProps as AntTimelineProps,
  Tree as AntTree,
  type TreeDataNode as AntTreeDataNode,
  type TreeProps as AntTreeProps,
  type DescriptionsRef,
  type DividerRef,
  type GetProps,
  type GetRef,
  type SkeletonRef,
  type TabsRef,
} from 'antd'
import type { JSX, ReactNode, RefAttributes } from 'react'
import type { StyleKeys } from './internal.ts'

// —— Alert ——

/**
 * Props of Alert.
 * @zh Alert 属性。
 */
export interface AlertProps extends Omit<AntAlertProps, StyleKeys>, RefAttributes<AlertRef> {}

/**
 * An alert for persistent information on a page or in an area that needs the user's attention (warnings,
 * limits, next steps); `type` sets the meaning. For brief feedback on the result of an action, use useMessage
 * instead.
 * @zh 提示条：页面或区域内需要用户注意的持续性信息（警告、限制、后续步骤），以 `type` 区分语义。
 * 操作结果的短暂反馈用 useMessage，不用它。
 * @category Feedback
 * @usage Reminders that a feature is not configured, secrets shown only once, notes in a danger zone
 * @usageZh 功能未配置的提醒、只显示一次的密钥、危险区域的说明
 */
export function Alert(props: AlertProps) {
  return <AntAlert {...props} />
}

// —— Descriptions ——

/** Descriptions 已弃用的外观入口。 */
type DescriptionsStyleKeys = 'labelStyle' | 'contentStyle'

/**
 * Props of Descriptions.
 * @zh Descriptions 属性。
 */
export interface DescriptionsProps
  extends Omit<AntDescriptionsProps, StyleKeys | DescriptionsStyleKeys>,
    RefAttributes<DescriptionsRef> {}

type AntDescriptionsItemProps = GetProps<typeof AntDescriptions.Item>
/** Descriptions.Item 属性。 */
export interface DescriptionsItemProps
  extends Omit<AntDescriptionsItemProps, StyleKeys | DescriptionsStyleKeys> {}

function DescriptionsRoot(props: DescriptionsProps) {
  return <AntDescriptions {...props} />
}

// Descriptions 只读取子元素的属性（label、span、children），不会渲染子元素本身
function DescriptionsItem(props: DescriptionsItemProps) {
  return <AntDescriptions.Item {...props} />
}

/** Descriptions 及其静态成员。 */
export interface DescriptionsComponent {
  /** 渲染描述列表。 */
  (props: DescriptionsProps): JSX.Element
  /** 一个字段：`label` 为名称，子元素为值。也可以改用 Descriptions 的 `items`。 */
  readonly Item: (props: DescriptionsItemProps) => JSX.Element
}

/**
 * A description list that shows groups of read-only "label: value" fields aligned in columns. Provide the fields
 * with `items` or `Descriptions.Item`.
 * @zh 描述列表：成组展示只读的「名称：值」字段，按列对齐。用 `items` 或 `Descriptions.Item` 给出字段。
 * @category Data
 * @usage Basic information on detail pages and in drawers, metadata of an API
 * @usageZh 详情页与抽屉中的基本信息、接口的元数据
 */
export const Descriptions: DescriptionsComponent = /* @__PURE__ */ Object.assign(DescriptionsRoot, {
  Item: DescriptionsItem,
})

// —— Tabs ——

/**
 * Props of Tabs.
 * @zh Tabs 属性。
 */
export interface TabsProps extends Omit<AntTabsProps, StyleKeys>, RefAttributes<TabsRef> {}

/**
 * Tabs switch between several groups of sibling content in the same area, with the selection underline sliding
 * between tabs. Provide the tabs with `items`.
 *
 * **Interaction**: the selection underline slides between tabs (200 ms); the selected tab only changes color, it
 * is not bolded, and the tab widths stay the same; `Tab` moves focus to the current tab, `←` / `→` move focus
 * between tabs, and `Enter` / `Space` switch to the focused tab.
 * @zh 标签页：在同一区域内切换几组平级内容，选中下划线在标签之间滑动。标签用 `items` 给出。
 *
 * **交互**：选中下划线在标签之间滑动（200ms）；选中项只变色、不加粗，标签宽度不变；`Tab` 聚焦到当前标签，
 * `←` / `→` 在标签之间移动焦点，`Enter` / `Space` 切换。
 * @category Basic
 * @usage Groups on a detail page (Overview / Related records), categories of a settings page
 * @usageZh 详情页的分组（基本信息 / 关联记录）、设置页的分类
 */
export function Tabs(props: TabsProps) {
  return <AntTabs {...props} />
}

// —— Tree ——

/** 树节点数据：`key`、`title`、`children`，可带 `icon`、`disabled`、`isLeaf`。 */
export type TreeDataNode = AntTreeDataNode

/**
 * Props of Tree.
 * @zh Tree 属性。
 */
export interface TreeProps<T extends TreeDataNode = TreeDataNode>
  extends Omit<AntTreeProps<T>, StyleKeys>,
    RefAttributes<GetRef<typeof AntTree>> {}

/**
 * A tree that shows hierarchical data, with expanding, selecting, checking and drag-to-reorder. Arrow keys move
 * between nodes (WAI-ARIA).
 * @zh 树：展示层级数据，支持展开、选择、勾选与拖动排序。方向键在节点间移动（WAI-ARIA）。
 * @category Data
 * @usage Team hierarchies, folder trees, permission trees
 * @usageZh 团队层级、文件夹树、权限树
 */
export function Tree<T extends TreeDataNode = TreeDataNode>(props: TreeProps<T>) {
  return <AntTree<T> {...props} />
}

// —— Pagination ——

/**
 * Props of Pagination.
 * @zh Pagination 属性。
 */
export interface PaginationProps extends Omit<AntPaginationProps, StyleKeys> {}

/**
 * Pagination moves between pages of data. Tables have their own pagination (the `pagination` prop of Table);
 * use Pagination on its own only for lists outside tables. When changing pages, keep the old data until the new
 * data arrives so that the content does not flicker.
 *
 * **Interaction**: the current page has a subtle accent background with accent text and no border; other pages
 * add the state layer on hover and press; `Tab` focuses the page numbers one by one and shows the focus ring, and
 * `Enter` goes to the focused page.
 * @zh 分页：在多页数据之间跳转。表格自带分页（Table 的 `pagination`），不在表格中的列表才单独用它。
 * 翻页时保留旧数据直到新数据到达，避免内容闪烁。
 *
 * **交互**：当前页为强调色浅底配强调色文字、不描边；其他页悬停、按下叠加状态层；`Tab` 逐个聚焦页码并显示焦点环，
 * `Enter` 翻页。
 * @category Data
 * @usage Pagination of lists that are not tables, such as card lists and search results
 * @usageZh 卡片列表、搜索结果等非表格列表的分页
 */
export function Pagination(props: PaginationProps) {
  return <AntPagination {...props} />
}

// —— Divider ——

/**
 * Props of Divider.
 * @zh Divider 属性。
 */
export interface DividerProps extends Omit<AntDividerProps, StyleKeys>, RefAttributes<DividerRef> {}

/**
 * A divider that separates content at the same level, optionally with text (such as date separators in a message
 * list). Prefer spacing and backgrounds to express hierarchy; use a divider only when a line is really needed.
 * @zh 分隔线：分隔同一层级中的内容，可带文字（如消息列表的日期分隔）。
 * 层次优先用间距与底色区分，只有确实需要一条线时才用它。
 * @category Primitives
 * @usage Date separators in message lists, groups in menus and lists
 * @usageZh 消息列表的日期分隔、菜单与列表中的分组
 */
export function Divider(props: DividerProps) {
  return <AntDivider {...props} />
}

// —— Timeline ——

/**
 * Props of Timeline.
 * @zh Timeline 属性。
 */
export interface TimelineProps extends Omit<AntTimelineProps, StyleKeys> {}

/**
 * A timeline that shows events in chronological order. Provide the nodes with `items`; `color` can distinguish
 * statuses.
 * @zh 时间线：按时间顺序展示事件，节点用 `items` 给出，可用 `color` 区分状态。
 * @category Data
 * @usage Status change history, activity history, task progress
 * @usageZh 状态变更记录、操作历史、任务进度
 */
export function Timeline(props: TimelineProps) {
  return <AntTimeline {...props} />
}

// —— Skeleton ——

/**
 * Props of Skeleton.
 * @zh Skeleton 属性。
 */
export interface SkeletonProps
  extends Omit<AntSkeletonProps, StyleKeys>,
    RefAttributes<SkeletonRef> {
  /**
   * Content shown once loading has finished (when `loading` is false).
   * @zh 加载完成后显示的内容（`loading` 为 false 时显示）。
   */
  readonly children?: ReactNode
}

/**
 * A skeleton: a placeholder shaped like the final content while part of the page loads. For the first load of a
 * whole page, use PageSkeleton.
 * @zh 骨架：局部内容加载时的占位，形状接近最终内容。整页首次加载用 PageSkeleton。
 * @category Feedback
 * @usage Partial loading in message lists, cards and panels
 * @usageZh 消息列表、卡片、面板内部的局部加载
 */
export function Skeleton(props: SkeletonProps) {
  return <AntSkeleton {...props} />
}
