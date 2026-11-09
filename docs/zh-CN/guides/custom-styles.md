[English](../../en-US/guides/custom-styles.md) | **简体中文**

# 自定义样式

应用什么时候可以在 vellum-ui 旁边写自己的 CSS，以及要遵守的规则：只写没有组件能提供的业务特有视觉；颜色、尺寸、圆角、阴影、时长一律通过 `var(--vl-…)` 引用设计令牌；像素字面量只允许 `0` 与 `1px`；不写内联 `style`；可点击的自定义元素用统一状态层（`data-vl-state`）；进场动画用组件库的全局 keyframes；图片背后用中性的看图背景令牌。

## 什么时候写

标准页面不需要 CSS（见[搭建页面](building-pages.md)）。只有属于你的产品、没有组件提供的视觉才自己写 CSS：特殊的聊天气泡、画在图片上的业务标记、座位图、首页上排版独特的卡片。

写 CSS 之前先查[组件总览](../README.md)：如果某个组件差不多合适，就按原样使用它，并提出缺少的参数。不要改写组件库组件的样式（不要用选择器选中它们的元素或类名：这些是内部实现，各版本之间会变化）。

## 规则

1. **取值来自令牌。** 颜色、字号、字重、行高、间距、圆角、阴影、时长与缓动都写成 `var(--vl-…)`。令牌随明暗模式、强调色与主题变化，字面量不会。
2. **像素字面量只允许 `0` 与 `1px`。** 其余一律用令牌（`var(--vl-space-3)`、`var(--vl-radius-lg)`），比例用 `%`、`fr` 等相对单位。
3. **TSX 中不写 `style={…}`。** CSS 写在 CSS Module（`*.module.css`）中，类名加在你自己的元素上；vellum-ui 的组件不接收 `className`。
4. **不用自带色相的颜色。** 用语义令牌（`color-accent`、`color-success` 等）与图表色板（`color-chart-1` … `color-chart-8`），不写十六进制颜色。
5. **悬停与按下用状态层**（见下文），不自己写 `:hover` 背景或 `:active` 缩放。
6. **动效用动效令牌**，「减少动态效果」才能关掉它。

## 令牌

每个令牌都是带 `--vl-` 前缀的 CSS 自定义属性，由 ThemeProvider 写入页面。[令牌清单](../tokens.md)列出了全部令牌及其取值；最常用的是：

| 类别 | 令牌 |
| --- | --- |
| 表面 | `--vl-color-bg-canvas`、`--vl-color-bg-surface`、`--vl-color-bg-sunken`、`--vl-color-bg-elevated` |
| 填充与描边 | `--vl-color-fill`、`--vl-color-fill-strong`、`--vl-color-fill-hover`、`--vl-color-fill-selected`、`--vl-color-border`、`--vl-color-border-strong`、`--vl-border-width` |
| 文字 | `--vl-color-text-primary`、`--vl-color-text-secondary`、`--vl-color-text-tertiary`、`--vl-color-text-on-accent`、`--vl-color-accent-text` |
| 语义色 | `--vl-color-accent`、`--vl-color-success`、`--vl-color-warning`、`--vl-color-danger`、`--vl-color-info`，各有 `-hover`、`-active`、`-disabled`、`-subtle`（浅底）；`success`、`warning`、`danger`、`info` 另有 `-text`（作为文字时可读） |
| 图表 | `--vl-color-chart-1` … `--vl-color-chart-8`（`-on` 是其上的文字色）、`--vl-color-chart-muted`、`--vl-color-chart-grid`、`--vl-color-chart-axis` |
| 间距 | `--vl-space-0` … `--vl-space-8`（0、4、8、12、16、24、32、48、64px） |
| 文字排版 | `--vl-font-size-2xs` … `--vl-font-size-4xl`，`--vl-font-weight-regular`、`-medium`、`-semibold`，`--vl-line-height-body`、`--vl-line-height-heading`，`--vl-font-family-body`、`-heading`、`-mono` |
| 圆角 | `--vl-radius-sm`、`-md`、`-lg`、`-xl`、`-2xl`、`-full` |
| 阴影 | `--vl-shadow-near`（卡片，深色模式没有）、`--vl-shadow-float`（菜单）、`--vl-shadow-pop`（对话框） |
| 动效 | `--vl-motion-duration-fast`、`-base`、`-slow`，`--vl-motion-ease-standard`、`--vl-motion-ease-exit` |
| 焦点 | `--vl-color-focus-ring`、`--vl-color-focus-halo` |
| 层级 | `--vl-z-overlay`、`--vl-z-viewer`、`--vl-z-message` |

名称来自主题：语义色 `bgSurface` 编译为 `--vl-color-bg-surface`。原始色板（`--vl-neutral-…`、`--vl-blue-…`）也会输出，但请用语义令牌：原始令牌不随明暗模式变化。`--vl-control-height-md` 这类组件令牌随密度变化。

在 TypeScript 中，`cssVar('color-accent')` 返回 `'var(--vl-color-accent)'`，用于接收 CSS 颜色字符串的地方，如 SVG 元素的 `fill`、第三方库的选项。`useTheme().cssVars` 是当前主题解析后的取值，用于读不到 CSS 变量的画布。

## 可点击的自定义元素：`data-vl-state`

可以点击的自定义元素加上 `data-vl-state` 属性，就得到组件库的状态层：悬停时叠加一层内容色，按下时立即加深（不缩放）；键盘聚焦时显示焦点环；`disabled` 或 `aria-disabled="true"` 时没有状态层。触屏设备上没有悬停层。

```tsx
<button type="button" className={styles.entry} data-vl-state="" onClick={open}>
  …
</button>
```

- 状态层是元素的 `::before`：这个元素自己不能再用 `::before`。
- 元素会变成 `position: relative` 并创建层叠上下文；状态层继承它的 `border-radius`。
- 用真正的 `<button>` 或 `<a>`，元素才能用键盘聚焦与触发。

## 进场动画

`vellum-ui/styles.css` 定义了 keyframes `vl-rise`（淡入并上移几个像素），Page 使用它。在 CSS Module 中要以全局名称引用，否则 CSS Modules 会把它改成局部名，动画静默失效：

```css
.card {
  /* biome-ignore lint/correctness/noUnknownFunction: global() references keyframes outside the CSS Module */
  animation: global(vl-rise) var(--vl-motion-duration-slow) var(--vl-motion-ease-standard) both;
}
```

这行注释是给不认识 `global()` 的检查工具看的。自己的 keyframes 定义在同一个 CSS Module 中。「减少动态效果」打开时时长令牌为 0，用这些令牌的动画随之停止。`vellum-ui/global.css` 为页面切换（`view-transition-name: vl-main`）另外定义了 `vl-fade-in` 与 `vl-fade-out`，只在导入这个样式表时存在。

## 页面切换

`vellum-ui/global.css` 中有页面切换的动效：在 View Transition 中切换内容时，名为 `vl-main` 的元素淡出，新内容淡入并
轻微上移，页面的其余部分（导航）保持不动。AppShell 的主内容区已经带有这个名称；你只需要做一步：

1. 用 AppShell 时不用自己命名。自己写外壳时，在它的 CSS 中给放页面的元素命名：`view-transition-name: vl-main;`。
2. 在 `document.startViewTransition` 中切换页面，并同步渲染新页面，浏览器才能截取到它：

```tsx
import { flushSync } from 'react-dom'

function navigate(next: PageKey) {
  if (!document.startViewTransition) return setPage(next)
  document.startViewTransition(() => flushSync(() => setPage(next)))
}
```

不支持 View Transitions 的浏览器直接切换，没有动画。「减少动态效果」打开时时长为 0。

## 图片背后：看图背景令牌

显示图片或视频的区域（画布、查看器、缩略图上的说明文字）用看图背景令牌，不用表面色：它们是不带任何色偏的中性灰，浅色与深色模式相同，也不随强调色变化，因为带色偏的背景会改变人对图片颜色的判断。

| 令牌 | 用途 |
| --- | --- |
| `--vl-viewer-bg-mid`、`--vl-viewer-bg-dark`、`--vl-viewer-bg-black` | 图片背后的背景（中灰、深灰、黑） |
| `--vl-viewer-text`、`--vl-viewer-text-muted` | 这个背景上的文字 |
| `--vl-viewer-control-bg`、`--vl-viewer-control-bg-hover`、`--vl-viewer-control-border` | 图片上的控件 |
| `--vl-viewer-placeholder` | 图片加载时的占位 |

`useTheme().viewerStage` 是用户为 Lightbox 选择的看图背景（`'mid'`、`'dark'` 或 `'black'`）；你自己的查看器也跟随它。

## 示例

首页上打开项目的卡片：表面、圆角、状态层与进场动画，全部来自令牌。

```css
/* ProjectCard.module.css */
.card {
  display: flex;
  flex-direction: column;
  gap: var(--vl-space-1);
  padding: var(--vl-space-4);
  border: 0;
  border-radius: var(--vl-radius-xl);
  background: var(--vl-color-bg-surface);
  box-shadow: var(--vl-shadow-near);
  color: var(--vl-color-text-primary);
  font: inherit;
  text-align: start;
  /* biome-ignore lint/correctness/noUnknownFunction: global() references keyframes outside the CSS Module */
  animation: global(vl-rise) var(--vl-motion-duration-slow) var(--vl-motion-ease-standard) both;
}

.accent {
  height: 1px;
  background: var(--vl-color-accent);
}
```

```tsx
import { Text } from 'vellum-ui'
import styles from './ProjectCard.module.css'

export function ProjectCard(props: { readonly name: string; readonly owner: string; readonly onOpen: () => void }) {
  return (
    <button type="button" className={styles.card} data-vl-state="" onClick={props.onOpen}>
      <span className={styles.accent} />
      <Text weight="semibold">{props.name}</Text>
      <Text size="sm" tone="secondary">{props.owner}</Text>
    </button>
  )
}
```

内容用 Text，字号与颜色仍然来自组件库；CSS 只画这张卡片特有的部分。
