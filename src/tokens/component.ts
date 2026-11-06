/**
 * 组件令牌（component）：由组件库内部维护，取值引用语义令牌的 CSS 变量，主题不覆盖。
 * 密度（舒适 / 紧凑）只影响这一层。
 */

/** 界面密度：舒适适合日常，紧凑适合数据密集、频繁使用表格的场景。 */
export type Density = 'comfortable' | 'compact'

const v = (name: string) => `var(--vl-${name})`

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
    // 图表的表格视图：随行数变高的上限，更长的表格在卡片内滚动（短表格不出现嵌套滚动）
    'chart-table-max-height': '480px',
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
