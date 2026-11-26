/**
 * 组件令牌（component）：由组件库内部维护，取值引用语义令牌的 CSS 变量，主题不覆盖。
 * 密度（舒适 / 紧凑）只影响这一层。
 *
 * 只把这几类尺寸写成公开的 CSS 变量（2.0 起）：
 * - 随密度变化的（密度就是靠它们实现的）；
 * - 几个组件共用、必须一致的（如流式光标、弹层的内边距、分栏手柄）；
 * - 使用方的布局需要对齐的（控件高度、页面宽度、分栏宽度、Grid 的列宽、聊天的阅读宽度、状态圆点等）；
 * - 同一份取值也传给 antd 主题的（控件高度、开关的尺寸，base.css 由 CSS 变量读取）。
 * 只有一个组件用、又不随密度变化的尺寸写在组件自己的样式中（局部的自定义属性，或带注释的数值）。
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
 * 控件的几何尺寸（px），唯一的一份取值。控件高度（sm / md / lg）写成本库的组件令牌 control-height-*，也传给 antd 的
 * controlHeightSM / controlHeight / controlHeightLG（theme/antd.ts）。输入类控件左右的内边距（14 / 12 / 16px，md / sm /
 * lg）传给 antd 输入框、数字输入、日期的 paddingInline*；选择器的内边距不是 antd 的组件令牌，base.css 写同样的取值
 * （测试检查两处一致）。表单里上下相邻的输入框、选择器、日期，文字的起点因此对齐。
 */
export function controlGeometry(density: Density) {
  const compact = density === 'compact'
  return {
    height: compact ? { sm: 26, md: 30, lg: 36 } : { sm: 30, md: 36, lg: 44 },
    fieldPaddingInline: { sm: 12, md: 14, lg: 16 },
  } as const
}

/**
 * 开关（Switch）的几何尺寸（px），唯一的一份取值：传给 antd 的 Switch 令牌（theme/antd.ts），也写成本库的组件令牌
 * switch-*（base.css 用它们算出选中时手柄的平移距离，不读 antd 生成的 CSS 变量）。
 * 小号沿用 antd 的默认算法：轨道高度为 md 控件高度的一半，手柄比轨道矮上下两侧的内边距，轨道宽度为两个手柄加两侧内边距。
 */
export function switchGeometry(density: Density) {
  const trackPadding = 2
  const trackHeightSm = controlGeometry(density).height.md / 2
  const handleSizeSm = trackHeightSm - trackPadding * 2
  return {
    trackPadding,
    trackHeight: 20,
    trackWidth: 36,
    handleSize: 16,
    trackHeightSm,
    trackWidthSm: handleSizeSm * 2 + trackPadding * 2,
    handleSizeSm,
  } as const
}

/**
 * The component tokens for a density: sizes maintained by the library, such as `control-height-md` (36 px
 * comfortable, 30 px compact), table cell padding and the widths of panels. They are the sizes that change with
 * the density, that several components share, that your own layouts may need to line up with, or that are also
 * given to Ant Design's theme; the other sizes of a component are in its own styles. `density` is `comfortable` or
 * `compact`. Returns a new object of token names without the `--vl-` prefix → CSS values, some of which reference
 * semantic tokens (`var(--vl-space-2)`). compileTheme adds them last, so theme overrides do not change them; call it
 * yourself only to inspect the values.
 * @zh 某种密度下的组件令牌：由组件库维护的尺寸，如 `control-height-md`（舒适 36px、紧凑 30px）、表格单元格内边距、
 * 面板宽度。它们是随密度变化、几个组件共用、使用方的布局可能需要对齐，或同时传给 Ant Design 主题的尺寸；组件的其他
 * 尺寸写在组件自己的样式中。`density` 是 `comfortable` 或 `compact`。返回新对象：不含 `--vl-` 前缀的令牌名 → CSS
 * 值，其中一些引用语义令牌（`var(--vl-space-2)`）。compileTheme 最后写入它们，所以主题覆盖改变不了；自己调用只用于
 * 查看取值。
 * @group Theme
 */
export function componentTokens(density: Density): Record<string, string> {
  const compact = density === 'compact'
  const switchSize = switchGeometry(density)
  const { height } = controlGeometry(density)
  return {
    'control-height-sm': `${height.sm}px`,
    'control-height-md': `${height.md}px`,
    'control-height-lg': `${height.lg}px`,
    'table-cell-padding-y': compact ? v('space-1') : v('space-3'),
    'table-cell-padding-x': compact ? v('space-2') : v('space-4'),
    'image-grid-gap': compact ? v('space-1') : v('space-2'),
    'image-grid-min-column': compact ? '140px' : '200px',
    // 页面与分栏
    'page-width-form': '400px',
    'page-width-narrow': '720px',
    'page-width-default': '1280px',
    'split-aside-sm': '240px',
    'split-aside-md': '280px',
    'split-aside-lg': '320px',
    'badge-size': compact ? '16px' : '18px',
    // 开关：轨道宽度、手柄直径、轨道内边距（与 antd 的 Switch 令牌同一份取值，见 switchGeometry）
    'switch-track-width': `${switchSize.trackWidth}px`,
    'switch-track-width-sm': `${switchSize.trackWidthSm}px`,
    'switch-handle-size': `${switchSize.handleSize}px`,
    'switch-handle-size-sm': `${switchSize.handleSizeSm}px`,
    'switch-track-padding': `${switchSize.trackPadding}px`,
    'status-dot-size': '8px',
    'toolbar-field-width': '280px',
    // Grid 原语按最小列宽自动填充的三档
    'grid-column-sm': '160px',
    'grid-column-md': '240px',
    'grid-column-lg': '320px',
    // 弹层（下拉菜单、选择器的选项列表）：四周的内边距，与选项的圆角。嵌套圆角：内圆角 = 外圆角 − 间距，
    // 选项的圆弧与弹层（radius-lg）的圆弧同心
    'popup-padding': v('space-1'),
    'popup-item-radius': `calc(${v('radius-lg')} - ${v('space-1')})`,
    // 按键帽（Kbd）的高度，也是单个字符按键帽的最小宽度
    'kbd-height': compact ? '18px' : '20px',
    // 可拖拽分栏的手柄：可拖动的宽度（不占内容的位置时也够鼠标对准）；DataTable 调整列宽的手柄也用它
    'splitter-handle-size': v('space-2'),
    // 命令面板结果图标的底块
    'command-palette-icon-size': compact ? '22px' : '26px',
    // 迷你图的两档高度（Statistic 没有趋势数据时按 md 留出同样的高度）
    'sparkline-height-sm': '20px',
    'sparkline-height-md': '32px',
    // 图表的表格视图：单元格内边距比 DataTable 紧凑
    'chart-table-cell-padding-y': compact ? v('space-1') : v('space-2'),
    'chart-table-cell-padding-x': compact ? v('space-2') : v('space-3'),
    // 流式内容结尾的光标（随字号缩放的细块）：StreamingText 与 Markdown 共用
    'stream-cursor-width': '0.45em',
    'stream-cursor-gap': '0.1em',
    'stream-cursor-radius': '0.1em',
    // 行内引用与来源编号的圆块
    'citation-size': compact ? '16px' : '18px',
    // AI 对话：消息与输入框所在的阅读宽度（居中）
    'chat-max-width': '768px',
    // 批量操作栏：强调色浅底向左右伸出的距离（不占布局位置）
    'selection-bar-bleed-x': compact ? v('space-1') : v('space-2'),
    // 数据表格：选择列的宽度（表格两端的内缩 + 两侧单元格内边距 + 16px 的复选框，随密度变化）
    'data-table-selection-width': compact ? '40px' : '56px',
  }
}
