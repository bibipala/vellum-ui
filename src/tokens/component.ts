/**
 * 组件令牌（component）：由组件库内部维护，取值引用语义令牌的 CSS 变量，主题不覆盖。
 * 密度（舒适 / 紧凑）只影响这一层。
 */

/**
 * Density of the interface: `comfortable` for everyday use, `compact` for data-dense screens that use tables a lot.
 * It changes the component tokens only: control heights, table cell padding and similar sizes.
 * @zh 界面密度：`comfortable` 舒适适合日常，`compact` 紧凑适合数据密集、频繁使用表格的场景。只影响组件令牌：控件高度、
 * 表格单元格内边距等尺寸。
 */
export type Density = 'comfortable' | 'compact'

const v = (name: string) => `var(--vl-${name})`

/**
 * The component tokens for a density: sizes maintained by the library, such as `control-height-md` (32 px
 * comfortable, 28 px compact), table cell padding and the widths of panels. `density` is `comfortable` or
 * `compact`. Returns a new object of token names without the `--vl-` prefix → CSS values, some of which reference
 * semantic tokens (`var(--vl-space-2)`). compileTheme adds them last, so theme overrides do not change them; call it
 * yourself only to inspect the values.
 * @zh 某种密度下的组件令牌：由组件库维护的尺寸，如 `control-height-md`（舒适 32px、紧凑 28px）、表格单元格内边距、
 * 面板宽度。`density` 是 `comfortable` 或 `compact`。返回新对象：不含 `--vl-` 前缀的令牌名 → CSS 值，其中一些引用
 * 语义令牌（`var(--vl-space-2)`）。compileTheme 最后写入它们，所以主题覆盖改变不了；自己调用只用于查看取值。
 * @group Theme
 */
export function componentTokens(density: Density): Record<string, string> {
  const compact = density === 'compact'
  return {
    'control-height-sm': compact ? '24px' : '28px',
    'control-height-md': compact ? '28px' : '32px',
    'control-height-lg': compact ? '32px' : '40px',
    'button-height-md': v('control-height-md'),
    'table-cell-padding-y': compact ? v('space-1') : v('space-3'),
    'table-cell-padding-x': compact ? v('space-2') : v('space-4'),
    'table-row-hover-bg': v('color-fill-hover'),
    'table-header-bg': 'transparent',
    'image-grid-gap': compact ? v('space-1') : v('space-2'),
    'image-grid-min-column': compact ? '140px' : '200px',
    // 页面与分栏
    'page-width-narrow': '720px',
    'page-width-default': '1280px',
    'split-aside-sm': '240px',
    'split-aside-md': '280px',
    'split-aside-lg': '320px',
    // 应用框架与侧栏导航：收起的侧栏（图标窄栏）= 导航项的正方形 + 侧栏两侧的内边距；导航项之间的细缝；图标尺寸
    'app-shell-rail-width': `calc(${v('control-height-md')} + 2 * ${v('space-3')})`,
    'nav-item-gap': '2px',
    'nav-icon-size': '16px',
    'badge-size': compact ? '16px' : '18px',
    'status-dot-size': '8px',
    'state-icon-size': '56px',
    'toolbar-field-width': '280px',
    'code-height-sm': '160px',
    'code-height-md': '320px',
    'code-height-lg': '560px',
    // Grid 原语按最小列宽自动填充的三档
    'grid-column-sm': '160px',
    'grid-column-md': '240px',
    'grid-column-lg': '320px',
    // 弹层（下拉菜单、选择器的选项列表）：四周的内边距，与选项的圆角。嵌套圆角：内圆角 = 外圆角 − 间距，
    // 选项的圆弧与弹层（radius-lg）的圆弧同心
    'popup-padding': v('space-1'),
    'popup-item-radius': `calc(${v('radius-lg')} - ${v('space-1')})`,
    // 气泡确认：说明文字的最大宽度（约 20 个汉字），更长的说明换行
    'popconfirm-text-width': '320px',
    // 抽屉：浮在页面之上的卡片，与窗口边缘留出间隙；面板滑出时移到窗口外（自身宽度 + 间隙 + 阴影的范围，
    // 离场的最后一帧不在窗口边缘留下阴影）
    'drawer-inset': v('space-2'),
    'drawer-offscreen': `calc(100% + ${v('space-2')} + ${v('space-6')})`,
    // 媒体网格格子的圆角（图片格子与没有图片的 fallback 格子相同）
    'image-tile-radius': v('radius-lg'),
    'lightbox-control-size': '40px',
    'message-max-width': '560px',
    // 按键帽（Kbd）的高度，也是单个字符按键帽的最小宽度
    'kbd-height': compact ? '18px' : '20px',
    // 可拖拽分栏的手柄：可拖动的宽度（不占内容的位置时也够鼠标对准）与悬停时出现的握把长度
    'splitter-handle-size': v('space-2'),
    'splitter-grip-length': '24px',
    // 命令面板：宽度、结果列表的最大高度（约 10 条）、结果图标的底块
    'command-palette-width': '640px',
    'command-palette-list-height': '440px',
    'command-palette-icon-size': compact ? '22px' : '26px',
    // 数字展示（docs/11 §4「图表形态」）：迷你图的两档高度与末端圆点（≥ 8px）；分段条的三档高度（细条 8px、
    // 密集行 4px、高条 28px 封顶），以及细条每段的悬停与聚焦区域（不小于 24px，比 8px 的色条好对准）
    'sparkline-height-sm': '20px',
    'sparkline-height-md': '32px',
    'sparkline-dot-size': '8px',
    // 迷你图中前后都缺数据的孤立值：比 2px 的线略大的小圆点
    'sparkline-point-size': '4px',
    'segmented-bar-height-dense': '4px',
    'segmented-bar-height-thin': '8px',
    'segmented-bar-height-tall': '28px',
    'segmented-bar-hit-size': '24px',
    // 高分段条每块的圆角：与柱形的数据端相同（4px，比控件的圆角小）
    'segmented-bar-radius': '4px',
    // 图表的表格视图：随行数变高的上限，更长的表格在卡片内滚动（短表格不出现嵌套滚动）；单元格内边距比 DataTable
    // 紧凑（卡片中的图表通常不高，舒适密度下 240px 也能放下表头与 5 行）
    'chart-table-max-height': '480px',
    'chart-table-cell-padding-y': compact ? v('space-1') : v('space-2'),
    'chart-table-cell-padding-x': compact ? v('space-2') : v('space-3'),
    // 进度条（Progress）：线形三档的粗细（4px 用于列表行等密集处），环形三档的直径
    'progress-line-sm': '4px',
    'progress-line-md': '8px',
    'progress-line-lg': '12px',
    'progress-circle-sm': '48px',
    'progress-circle-md': '80px',
    'progress-circle-lg': '120px',
    // AI 与流式（M4）：流式内容结尾的光标（随字号缩放的细块）
    'stream-cursor-width': '0.45em',
    'stream-cursor-gap': '0.1em',
    'stream-cursor-radius': '0.1em',
    // Markdown 引用左侧的竖条（中性填充色，不是描边）
    'markdown-quote-bar-width': '3px',
    // ToolCalls 的状态图标（与 Icon 的默认尺寸相同），步骤之间的连线对准它的中心
    'tool-calls-icon-size': '16px',
    // 引用来源：行内引用与来源编号的圆块、使用方提供的站点图标、引用卡片的最大宽度
    'citation-size': compact ? '16px' : '18px',
    'source-icon-size': '16px',
    'citation-card-width': '320px',
    // AI 对话：消息与输入框所在的阅读宽度（居中）、用户消息气泡的最大宽度（占阅读宽度的比例）、
    // 输入框中附件卡片的最大宽度
    'chat-max-width': '768px',
    'chat-bubble-max-width': '80%',
    'prompt-attachment-max-width': '240px',
    // 数据表格（M5b）：行内编辑的显示按钮与输入框同高（随密度：舒适 32px、紧凑 28px），文字距边缘的距离；
    // 两种状态都伸出到行高之外（负外边距），文字与周围对齐，放在表格中行高不变
    'inline-edit-height': v('control-height-md'),
    'inline-edit-padding-x': v('space-2'),
    // 批量操作栏：与工具栏同高（控件高度），强调色浅底向四周伸出的距离（不占布局位置）
    'selection-bar-bleed-x': compact ? v('space-1') : v('space-2'),
    'selection-bar-bleed-y': v('space-1'),
    // 数据表格（M5）：表格两端的内缩（行间分隔线与悬停底色不贴边）、选择列的宽度（内缩 + 两侧单元格内边距 +
    // 16px 的复选框，随密度变化）、列设置弹层的宽度
    'data-table-inset': v('space-2'),
    'data-table-selection-width': compact ? '40px' : '56px',
    'data-table-settings-width': '320px',
  }
}
