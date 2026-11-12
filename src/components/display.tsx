/**
 * 展示与导航组件：
 * 提示条、描述列表、标签页、树、分页、分隔线、时间线、骨架。
 * antd 只作为内部实现；对外的属性与数据类型由本库声明（ADR 0021），外观由令牌统一定义。
 */
import {
  Alert as AntAlert,
  Descriptions as AntDescriptions,
  Divider as AntDivider,
  Pagination as AntPagination,
  Skeleton as AntSkeleton,
  Tabs as AntTabs,
  Timeline as AntTimeline,
  Tree as AntTree,
  type TreeDataNode as AntTreeDataNode,
} from 'antd'
import { type JSX, type ReactNode, useMemo } from 'react'
import type { ControlSize } from './basic.tsx'
import feedback from './feedback.module.css'
import { Icon } from './Icon.tsx'
import { toAntSize } from './internal.ts'

/**
 * 组件库内部：树（Tree、TreeSelect）的展开图标。与其他地方一样的线性箭头（antd 默认是实心小三角），收起时由 antd
 * 转 -90° 指向右侧。外面套一层 span：antd 给图标加类名，本库的 Icon 不接受类名。不从入口导出。
 */
export const treeSwitcherIcon: JSX.Element = (
  <span>
    <Icon name="chevron-down" size={14} />
  </span>
)

// —— Alert ——

/** Alert 自有的属性。 */
interface AlertOwnProps {
  /**
   * Meaning of the alert: `info` for neutral information, `success`, `warning` for limits and risks, `danger` for
   * errors.
   * @zh 提示的语义：`info` 一般信息，`success` 成功，`warning` 限制与风险，`danger` 错误。
   * @default 'info'
   */
  readonly tone?: 'info' | 'success' | 'warning' | 'danger'
  /**
   * Main text of the alert.
   * @zh 提示的主要文字。
   */
  readonly title: ReactNode
  /**
   * Additional text below the title.
   * @zh 标题下方的补充说明。
   */
  readonly description?: ReactNode
  /**
   * Shows the icon of the tone before the text.
   * @zh 在文字前显示语义对应的图标。
   */
  readonly showIcon?: boolean
  /**
   * Shows a close button; the alert disappears when it is clicked.
   * @zh 显示关闭按钮，点击后提示条消失。
   */
  readonly closable?: boolean
  /**
   * Called when the close button is clicked.
   * @zh 点击关闭按钮时调用。
   */
  readonly onClose?: () => void
}

/**
 * Props of Alert.
 * @zh Alert 属性。
 */
export interface AlertProps extends AlertOwnProps {}

/**
 * An alert for persistent information on a page or in an area that needs the user's attention (warnings,
 * limits, next steps); `tone` sets the meaning. For brief feedback on the result of an action, use useMessage
 * instead.
 * @zh 提示条：页面或区域内需要用户注意的持续性信息（警告、限制、后续步骤），以 `tone` 区分语义。
 * 操作结果的短暂反馈用 useMessage，不用它。
 * @category Feedback
 * @usage Reminders that a feature is not configured, secrets shown only once, notes in a danger zone
 * @usageZh 功能未配置的提醒、只显示一次的密钥、危险区域的说明
 */
export function Alert(props: AlertProps) {
  const { tone = 'info', title, description, showIcon, closable, onClose } = props
  return (
    <AntAlert
      type={tone === 'danger' ? 'error' : tone}
      title={title}
      description={description}
      showIcon={showIcon}
      closable={closable ? { onClose: onClose && (() => onClose()) } : undefined}
    />
  )
}

// —— Descriptions ——

/**
 * Props of Descriptions.Item.
 * @zh Descriptions.Item 属性。
 */
export interface DescriptionsItemProps {
  /**
   * Name of the field.
   * @zh 字段名称。
   */
  readonly label: ReactNode
  /**
   * Value of the field.
   * @zh 字段的值。
   */
  readonly children?: ReactNode
}

/**
 * A field in the `items` of Descriptions.
 * @zh Descriptions 的 `items` 中的一个字段。
 */
export interface DescriptionsItem extends DescriptionsItemProps {
  /**
   * Unique key; the position in the list by default.
   * @zh 唯一键，默认取在列表中的位置。
   */
  readonly key?: string
}

/** Descriptions 自有的属性。 */
interface DescriptionsOwnProps {
  /**
   * The fields: `label` and the value in `children`. Instead of `items`, the fields can be given as
   * `Descriptions.Item` children.
   * @zh 各个字段：名称 `label` 与值 `children`。也可以不用 `items`，改为以 `Descriptions.Item` 作为子元素给出。
   */
  readonly items?: readonly DescriptionsItem[]
  /**
   * Number of columns. By default it follows the width of the window: 1 on phones up to 3 on wide screens.
   * @zh 列数。默认随窗口宽度变化：手机上 1 列，宽屏上最多 3 列。
   */
  readonly column?: number
  /**
   * Size: `sm` in drawers and panels, where the fields are close together.
   * @zh 尺寸：`sm` 用于抽屉与面板中，字段排得更紧凑。
   */
  readonly size?: ControlSize
  /**
   * `Descriptions.Item` elements, instead of `items`.
   * @zh `Descriptions.Item` 元素，代替 `items`。
   */
  readonly children?: ReactNode
}

/**
 * Props of Descriptions.
 * @zh Descriptions 属性。
 */
export interface DescriptionsProps extends DescriptionsOwnProps {}

function DescriptionsRoot({ items, column, size, children }: DescriptionsProps) {
  return (
    <AntDescriptions
      items={items?.map((item, index) => ({ ...item, key: item.key ?? index }))}
      column={column}
      size={toAntSize(size)}
      // 标签后不加冒号：标签用次要文字色，与值之间靠间距区分（主题映射 Descriptions 的 labelColor 与 colonMarginRight）
      colon={false}
    >
      {children}
    </AntDescriptions>
  )
}

// Descriptions 只读取子元素的属性（label、children），不会渲染子元素本身
function DescriptionsItemElement(props: DescriptionsItemProps) {
  return <AntDescriptions.Item label={props.label}>{props.children}</AntDescriptions.Item>
}

/**
 * Descriptions and its static members.
 * @zh Descriptions 及其静态成员。
 */
export interface DescriptionsComponent {
  /**
   * Renders a description list.
   * @zh 渲染描述列表。
   */
  (props: DescriptionsProps): JSX.Element
  /**
   * One field written as JSX: `label` is the name, the children are the value. An alternative to the `items` prop,
   * convenient when fields are shown conditionally; when `items` is given, the children are ignored. Descriptions
   * reads the props of its direct children, so a Descriptions.Item must be a direct child (fragments are fine), not
   * rendered inside another component.
   * @zh 以 JSX 写出的一个字段：`label` 是名称，子元素是值。可以代替 `items` 属性，按条件显示字段时较方便；给出了
   * `items` 时忽略子元素。Descriptions 读取直接子元素的属性，所以 Descriptions.Item 必须是直接子元素（可以放在
   * Fragment 中），不能由其他组件渲染。
   */
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
  Item: DescriptionsItemElement,
})

// —— Tabs ——

/**
 * A tab of Tabs.
 * @zh Tabs 的一个标签。
 */
export interface TabsItem {
  /**
   * Unique key, passed to `onChange`.
   * @zh 唯一键，传给 `onChange`。
   */
  readonly key: string
  /**
   * Text of the tab.
   * @zh 标签的文字。
   */
  readonly label: ReactNode
  /**
   * Content shown while the tab is selected.
   * @zh 选中这个标签时显示的内容。
   */
  readonly children?: ReactNode
}

/** Tabs 自有的属性。 */
interface TabsOwnProps {
  /**
   * The tabs: `key`, `label` and the content in `children`.
   * @zh 各个标签：`key`、`label` 与内容 `children`。
   */
  readonly items: readonly TabsItem[]
  /**
   * Key of the selected tab (controlled): the tabs show it, and switching only calls `onChange`, so update it there.
   * Use it when the selected tab lives elsewhere, such as in the URL. The name pairs with `defaultActiveKey`.
   * @zh 选中的标签的 key（受控）：标签页显示它，切换时只调用 `onChange`，要在那里更新它。选中的标签保存在别处（如
   * URL 中）时使用。名称与 `defaultActiveKey` 成对。
   */
  readonly activeKey?: string
  /**
   * Key of the tab selected at first (uncontrolled); the first tab by default.
   * @zh 最初选中的标签的 key（非受控），默认为第一个标签。
   */
  readonly defaultActiveKey?: string
  /**
   * Called with the key of the newly selected tab.
   * @zh 切换标签时调用，参数是新选中的标签的 key。
   */
  readonly onChange?: (key: string) => void
}

/**
 * Props of Tabs.
 * @zh Tabs 属性。
 */
export interface TabsProps extends TabsOwnProps {}

/**
 * Tabs switch between several groups of sibling content in the same area, with the selection underline sliding
 * between tabs. Provide the tabs with `items`. The selected tab is uncontrolled (`defaultActiveKey`) or controlled
 * (`activeKey` with `onChange(key)`).
 *
 * **Interaction**: the selection underline slides between tabs (200 ms); the selected tab only changes color, it
 * is not bolded, and the tab widths stay the same; `Tab` moves focus to the current tab, `←` / `→` move focus
 * between tabs, and `Enter` / `Space` switch to the focused tab.
 * @zh 标签页：在同一区域内切换几组平级内容，选中下划线在标签之间滑动。标签用 `items` 给出。选中的标签可以是非受控的
 * （`defaultActiveKey`），也可以是受控的（`activeKey` 配合 `onChange(key)`）。
 *
 * **交互**：选中下划线在标签之间滑动（200ms）；选中项只变色、不加粗，标签宽度不变；`Tab` 聚焦到当前标签，
 * `←` / `→` 在标签之间移动焦点，`Enter` / `Space` 切换。
 * @category Basic
 * @usage Groups on a detail page (Overview / Related records), categories of a settings page
 * @usageZh 详情页的分组（基本信息 / 关联记录）、设置页的分类
 */
export function Tabs({ items, activeKey, defaultActiveKey, onChange }: TabsProps) {
  return (
    <AntTabs
      items={items.map(({ key, label, children }) => ({ key, label, children }))}
      activeKey={activeKey}
      defaultActiveKey={defaultActiveKey}
      onChange={onChange}
    />
  )
}

// —— Tree ——

/**
 * A node of a Tree.
 * @zh 树节点。
 */
export interface TreeDataNode {
  /**
   * Unique key of the node in the whole tree.
   * @zh 节点在整棵树中的唯一键。
   */
  readonly key: string
  /**
   * Content of the node.
   * @zh 节点的内容。
   */
  readonly title: ReactNode
  /**
   * Child nodes.
   * @zh 子节点。
   */
  readonly children?: readonly TreeDataNode[]
  /**
   * Disabled: shown but cannot be selected, checked or dragged.
   * @zh 禁用：显示但不能选择、勾选或拖动。
   */
  readonly disabled?: boolean
}

/**
 * What happened when a node was dropped onto another node in a draggable Tree.
 * @zh 可拖动的 Tree 中，一个节点被放到另一个节点上时的情况。
 */
export interface TreeDropInfo<T extends TreeDataNode = TreeDataNode> {
  /**
   * The dragged node.
   * @zh 被拖动的节点。
   */
  readonly node: T
  /**
   * The node it was dropped on.
   * @zh 放到的目标节点。
   */
  readonly target: T
  /**
   * Where it was dropped: `inside` the target (as a child), or in the gap `before` / `after` it (as a sibling).
   * @zh 放到的位置：`inside` 目标之内（成为子节点），或者目标之前 `before`、之后 `after` 的缝隙中（成为同级）。
   */
  readonly position: 'before' | 'inside' | 'after'
}

/** Tree 自有的属性。 */
interface TreeOwnProps<T extends TreeDataNode> {
  /**
   * The nodes: `key`, `title`, `children` and `disabled`. Nodes may carry other fields; callbacks such as `onDrop`
   * receive the original objects.
   * @zh 节点：`key`、`title`、`children` 与 `disabled`。节点上可以带其他字段，`onDrop` 等回调收到的是原来的对象。
   */
  readonly options: readonly T[]
  /**
   * Expands all nodes at first.
   * @zh 最初展开全部节点。
   */
  readonly defaultExpandAll?: boolean
  /**
   * Keys of the expanded nodes (controlled).
   * @zh 展开的节点的 key（受控）。
   */
  readonly expandedKeys?: readonly string[]
  /**
   * Called with the keys of the expanded nodes when a node is expanded or collapsed.
   * @zh 展开或收起节点时调用，参数是展开的节点的 key。
   */
  readonly onExpand?: (keys: string[]) => void
  /**
   * Keys of the selected nodes (controlled).
   * @zh 选中的节点的 key（受控）。
   */
  readonly selectedKeys?: readonly string[]
  /**
   * Keys of the nodes selected at first (uncontrolled).
   * @zh 最初选中的节点的 key（非受控）。
   */
  readonly defaultSelectedKeys?: readonly string[]
  /**
   * Called with the keys of the selected nodes when a node is selected or unselected.
   * @zh 选择或取消选择节点时调用，参数是选中的节点的 key。
   */
  readonly onSelect?: (keys: string[]) => void
  /**
   * Shows a checkbox before each node, for checking several nodes (such as a permission tree).
   * @zh 每个节点前显示复选框，用于勾选多个节点（如权限树）。
   */
  readonly checkable?: boolean
  /**
   * Keys of the checked nodes (controlled); only with `checkable`.
   * @zh 勾选的节点的 key（受控）；只在 `checkable` 时有效。
   */
  readonly checkedKeys?: readonly string[]
  /**
   * Keys of the nodes checked at first (uncontrolled); only with `checkable`.
   * @zh 最初勾选的节点的 key（非受控）；只在 `checkable` 时有效。
   */
  readonly defaultCheckedKeys?: readonly string[]
  /**
   * Called with the keys of the checked nodes when a checkbox changes.
   * @zh 勾选变化时调用，参数是勾选的节点的 key。
   */
  readonly onCheck?: (keys: string[]) => void
  /**
   * Nodes fill the width of the tree, so the whole row can be clicked.
   * @zh 节点占满树的宽度，整行都可以点击。
   */
  readonly blockNode?: boolean
  /**
   * Nodes can be dragged to another place in the tree; handle the result in `onDrop`.
   * @zh 节点可以拖到树中的其他位置，在 `onDrop` 中处理结果。
   */
  readonly draggable?: boolean
  /**
   * Called when a dragged node is dropped. The tree does not move the node itself: update `options`.
   * @zh 拖动的节点放下时调用。树不会自己移动节点：请更新 `options`。
   */
  readonly onDrop?: (info: TreeDropInfo<T>) => void
  /**
   * Test hook, rendered as `data-testid` on the tree.
   * @zh 测试定位，输出为树的 `data-testid`。
   */
  readonly testId?: string
}

/**
 * Props of Tree.
 * @zh Tree 属性。
 */
export interface TreeProps<T extends TreeDataNode = TreeDataNode> extends TreeOwnProps<T> {}

/** 本库的节点换成 antd 的节点（只带列出的字段），同时按 key 记下原来的节点，回调中还给调用方。 */
function toAntNodes<T extends TreeDataNode>(nodes: readonly T[], byKey: Map<string, T>) {
  const walk = (list: readonly TreeDataNode[]): AntTreeDataNode[] =>
    list.map((n) => {
      byKey.set(n.key, n as T)
      return {
        key: n.key,
        title: n.title,
        disabled: n.disabled,
        children: n.children ? walk(n.children) : undefined,
      }
    })
  return walk(nodes)
}

const keyList = (keys: readonly (string | number | bigint)[]) => keys.map(String)

/**
 * 给出了的 key 列表（复制为 antd 要的可变数组）。没给出的不能以 undefined 传下去：rc-tree 按「属性是否存在」判断
 * 受控，`expandedKeys={undefined}` 会让树再也展开不了。
 */
function keyProps(props: Readonly<Record<string, readonly string[] | undefined>>) {
  const out: Record<string, string[]> = {}
  for (const [name, keys] of Object.entries(props)) if (keys) out[name] = [...keys]
  return out
}

/**
 * A tree that shows hierarchical data, with expanding, selecting, checking and drag-to-reorder. Arrow keys move
 * between nodes (WAI-ARIA).
 * @zh 树：展示层级数据，支持展开、选择、勾选与拖动排序。方向键在节点间移动（WAI-ARIA）。
 * @category Data
 * @usage Team hierarchies, folder trees, permission trees
 * @usageZh 团队层级、文件夹树、权限树
 */
export function Tree<T extends TreeDataNode = TreeDataNode>(props: TreeProps<T>) {
  const { options, onExpand, onSelect, onCheck, onDrop, draggable, testId } = props
  const [antData, byKey] = useMemo(() => {
    const map = new Map<string, T>()
    return [toAntNodes(options, map), map] as const
  }, [options])
  return (
    <AntTree
      treeData={antData}
      {...keyProps({
        expandedKeys: props.expandedKeys,
        selectedKeys: props.selectedKeys,
        defaultSelectedKeys: props.defaultSelectedKeys,
        checkedKeys: props.checkedKeys,
        defaultCheckedKeys: props.defaultCheckedKeys,
      })}
      defaultExpandAll={props.defaultExpandAll}
      switcherIcon={treeSwitcherIcon}
      checkable={props.checkable}
      blockNode={props.blockNode}
      // 不显示 antd 的拖动手柄图标（不是本库的图标），整个节点都可以拖动
      draggable={draggable ? { icon: false } : false}
      onExpand={onExpand && ((keys) => onExpand(keyList(keys)))}
      onSelect={onSelect && ((keys) => onSelect(keyList(keys)))}
      onCheck={
        onCheck &&
        ((checked) => onCheck(keyList(Array.isArray(checked) ? checked : checked.checked)))
      }
      onDrop={
        onDrop &&
        ((info) => {
          const node = byKey.get(String(info.dragNode.key))
          const target = byKey.get(String(info.node.key))
          if (!node || !target) return
          // antd 的 dropPosition 是放下位置在同级中的序号，减去目标自己的序号得到 -1（之前）、0、1（之后）
          const offset = info.dropPosition - Number(info.node.pos.split('-').at(-1))
          const position = !info.dropToGap ? 'inside' : offset < 0 ? 'before' : 'after'
          onDrop({ node, target, position })
        })
      }
      {...(testId === undefined ? {} : { 'data-testid': testId })}
    />
  )
}

// —— Pagination ——

/** Pagination 自有的属性。 */
interface PaginationOwnProps {
  /**
   * Total number of items.
   * @zh 数据的总条数。
   */
  readonly total: number
  /**
   * Current page, starting at 1 (controlled).
   * @zh 当前页，从 1 开始（受控）。
   */
  readonly current?: number
  /**
   * Page shown at first (uncontrolled).
   * @zh 最初显示的页（非受控）。
   * @default 1
   */
  readonly defaultCurrent?: number
  /**
   * Number of items per page.
   * @zh 每页的条数。
   * @default 10
   */
  readonly pageSize?: number
  /**
   * Called with the new page and page size when the page or the page size changes.
   * @zh 翻页或改变每页条数时调用，参数是新的页码与每页条数。
   */
  readonly onChange?: (page: number, pageSize: number) => void
  /**
   * Shows the page size selector. By default it is shown when `total` is more than 50.
   * @zh 显示每页条数的选择器。默认在 `total` 超过 50 时显示。
   */
  readonly showSizeChanger?: boolean
  /**
   * Text before the page numbers, built from the total number of items, such as "128 items".
   * @zh 页码前的文字，由总条数生成，如「共 128 条」。
   */
  readonly showTotal?: (total: number) => ReactNode
  /**
   * Size: `sm` under tables and in panels. Without it, the size follows the density.
   * @zh 尺寸：`sm` 用于表格下方与面板中。省略时随密度。
   */
  readonly size?: ControlSize
}

/**
 * Props of Pagination.
 * @zh Pagination 属性。
 */
export interface PaginationProps extends PaginationOwnProps {}

/**
 * Pagination moves between pages of data. Under a DataTable, put it in the `footer` of the table. When changing
 * pages, keep the old data until the new data arrives so that the content does not flicker.
 *
 * **Interaction**: the current page has a subtle accent background with accent text and no border; other pages
 * add the state layer on hover and press; `Tab` focuses the page numbers one by one and shows the focus ring, and
 * `Enter` goes to the focused page.
 * @zh 分页：在多页数据之间跳转。用在 DataTable 下方时放进表格的 `footer`。
 * 翻页时保留旧数据直到新数据到达，避免内容闪烁。
 *
 * **交互**：当前页为强调色浅底配强调色文字、不描边；其他页悬停、按下叠加状态层；`Tab` 逐个聚焦页码并显示焦点环，
 * `Enter` 翻页。
 * @category Data
 * @usage Pagination of lists that are not tables, such as card lists and search results
 * @usageZh 卡片列表、搜索结果等非表格列表的分页
 */
export function Pagination(props: PaginationProps) {
  const { showTotal, size, ...rest } = props
  return (
    <AntPagination
      {...rest}
      size={toAntSize(size)}
      showTotal={showTotal && ((total) => showTotal(total))}
    />
  )
}

// —— Divider ——

/** Divider 自有的属性。 */
interface DividerOwnProps {
  /**
   * Text in the middle of the line, such as a date in a message list.
   * @zh 线中间的文字，如消息列表中的日期。
   */
  readonly children?: ReactNode
  /**
   * Shows the text in the regular body style instead of as a heading.
   * @zh 文字用普通正文样式，而不是标题样式。
   */
  readonly plain?: boolean
}

/**
 * Props of Divider.
 * @zh Divider 属性。
 */
export interface DividerProps extends DividerOwnProps {}

/**
 * A divider that separates content at the same level, optionally with text (such as date separators in a message
 * list). Prefer spacing and backgrounds to express hierarchy; use a divider only when a line is really needed.
 * @zh 分隔线：分隔同一层级中的内容，可带文字（如消息列表的日期分隔）。
 * 层次优先用间距与底色区分，只有确实需要一条线时才用它。
 * @category Primitives
 * @usage Date separators in message lists, groups in menus and lists
 * @usageZh 消息列表的日期分隔、菜单与列表中的分组
 */
export function Divider({ children, plain }: DividerProps) {
  return <AntDivider plain={plain}>{children}</AntDivider>
}

// —— Timeline ——

/**
 * An event of a Timeline.
 * @zh Timeline 的一个事件。
 */
export interface TimelineItem {
  /**
   * Unique key; the position in the list by default.
   * @zh 唯一键，默认取在列表中的位置。
   */
  readonly key?: string
  /**
   * Content of the event.
   * @zh 事件的内容。
   */
  readonly content: ReactNode
  /**
   * Color of the dot by meaning: `neutral` for past or ended events, `accent` for the default, `success`,
   * `warning`, `danger` and `info` for statuses.
   * @zh 圆点按语义着色：`neutral` 用于已经过去或结束的事件，`accent` 为默认，`success`、`warning`、`danger`、`info`
   * 表示状态。
   * @default 'accent'
   */
  readonly tone?: 'neutral' | 'accent' | 'info' | 'success' | 'warning' | 'danger'
}

/** Timeline 自有的属性。 */
interface TimelineOwnProps {
  /**
   * The events, in chronological order.
   * @zh 各个事件，按时间顺序排列。
   */
  readonly items: readonly TimelineItem[]
}

/**
 * Props of Timeline.
 * @zh Timeline 属性。
 */
export interface TimelineProps extends TimelineOwnProps {}

/** 色调换成 antd 时间线的颜色：预设色取主题映射的语义色，其余直接用令牌。 */
const TIMELINE_COLORS: Record<NonNullable<TimelineItem['tone']>, string> = {
  neutral: 'gray',
  accent: 'blue',
  success: 'green',
  danger: 'red',
  warning: 'var(--vl-color-warning)',
  info: 'var(--vl-color-info)',
}

/**
 * A timeline that shows events in chronological order. Provide the events with `items`; `tone` can distinguish
 * statuses.
 * @zh 时间线：按时间顺序展示事件，事件用 `items` 给出，可用 `tone` 区分状态。
 * @category Data
 * @usage Status change history, activity history, task progress
 * @usageZh 状态变更记录、操作历史、任务进度
 */
export function Timeline({ items }: TimelineProps) {
  return (
    <AntTimeline
      items={items.map((item, index) => ({
        key: item.key ?? index,
        content: item.content,
        color: TIMELINE_COLORS[item.tone ?? 'accent'],
      }))}
    />
  )
}

// —— Skeleton ——

/** Skeleton 自有的属性。 */
interface SkeletonOwnProps {
  /**
   * Animates the placeholder with a shimmer.
   * @zh 占位带闪烁动画。
   */
  readonly active?: boolean
  /**
   * Shows a round placeholder for an avatar before the text.
   * @zh 在文字前显示头像的圆形占位。
   */
  readonly avatar?: boolean
  /**
   * Placeholder of a title line; `false` hides it, the object form sets its width (a number in pixels or a CSS
   * length such as `'50%'`).
   * @zh 标题行的占位：`false` 不显示，对象形式设置它的宽度（像素数或 CSS 长度，如 `'50%'`）。
   * @default true
   */
  readonly title?: boolean | { readonly width?: number | string }
  /**
   * Placeholder of the paragraph; `false` hides it, the object form sets the number of `rows` and their `width`
   * (one value for the last row, or one per row).
   * @zh 段落的占位：`false` 不显示，对象形式设置行数 `rows` 与宽度 `width`（一个值表示最后一行，或者每行一个值）。
   * @default true
   */
  readonly paragraph?:
    | boolean
    | {
        readonly rows?: number
        readonly width?: number | string | readonly (number | string)[]
      }
  /**
   * Shows the placeholder while true and `children` afterwards. Without `children`, the placeholder is always
   * shown.
   * @zh 为 true 时显示占位，之后显示 `children`。没有 `children` 时始终显示占位。
   * @default true
   */
  readonly loading?: boolean
  /**
   * Content shown once loading has finished (when `loading` is false).
   * @zh 加载完成后显示的内容（`loading` 为 false 时显示）。
   */
  readonly children?: ReactNode
  /**
   * Shows the placeholder immediately, without the 200 ms delayed appearance. Only use it when the skeleton is
   * controlled by useDelayedPending and mounted only while that is true, so the delay is not applied twice.
   * @zh 立即显示，不做 200ms 的延迟出现。只在骨架由 useDelayedPending 控制、在它为 true 时才挂载的场景使用，避免重复延迟。
   */
  readonly immediate?: boolean
}

/**
 * Props of Skeleton.
 * @zh Skeleton 属性。
 */
export interface SkeletonProps extends SkeletonOwnProps {}

/**
 * A skeleton: a placeholder shaped like the final content while part of the page loads. For the first load of a
 * whole page, use PageSkeleton.
 *
 * **Interaction**: like Loading and PageSkeleton, the placeholder stays invisible after it appears and fades in
 * after 200 ms, so loads that finish quickly do not flash it; with useDelayedPending, a placeholder that has
 * appeared stays for at least 400 ms: `{query.isPending || showSkeleton ? <Skeleton /> : content}`. Not
 * interactive.
 * @zh 骨架：局部内容加载时的占位，形状接近最终内容。整页首次加载用 PageSkeleton。
 *
 * **交互**：与 Loading、PageSkeleton 一样，占位出现后先保持不可见，200ms 后才淡入，很快完成的加载不会闪出骨架；
 * 配合 useDelayedPending 保证占位一旦出现至少显示 400ms：`{query.isPending || showSkeleton ? <Skeleton /> : content}`。
 * 不可交互。
 * @category Feedback
 * @usage Partial loading in message lists, cards and panels
 * @usageZh 消息列表、卡片、面板内部的局部加载
 */
export function Skeleton({
  active,
  avatar,
  title,
  paragraph,
  loading,
  immediate,
  children,
}: SkeletonProps) {
  return (
    <AntSkeleton
      // 占位与 Loading、PageSkeleton 一样延迟出现；加载完成后 antd 直接渲染 children，不受影响
      className={
        immediate ? `${feedback.partSkeleton} ${feedback.immediate}` : feedback.partSkeleton
      }
      active={active}
      avatar={avatar}
      title={title}
      paragraph={
        typeof paragraph === 'object'
          ? {
              rows: paragraph.rows,
              width: typeof paragraph.width === 'object' ? [...paragraph.width] : paragraph.width,
            }
          : paragraph
      }
      // antd 只在没有传 loading 这个键时默认显示占位；这里总是传键，省略时要显式给出默认值 true
      loading={loading ?? true}
    >
      {children}
    </AntSkeleton>
  )
}
