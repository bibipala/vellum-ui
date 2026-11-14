[English](../../en-US/guides/custom-styles.md) | **简体中文**

# 自定义样式

自定义 CSS 用于现有组件无法覆盖的产品特有视觉。本指南说明 CSS Module 的使用边界、设计令牌、交互状态层、页面动效与看图背景的约定，使自定义视觉与当前主题保持一致。

## 什么时候写

标准页面无需自定义 CSS（见[搭建页面](building-pages.md)）。仅在缺少对应组件时，为产品特有视觉编写样式，例如特殊聊天气泡、图片标记、座位图或独特的首页卡片布局。

先查阅[组件总览](../README.md)。如果组件适用但缺少选项，应使用已有 API，并提出新增参数的需求。不要通过 CSS 选择器访问组件库的元素或类名；这些内部实现可能随版本变化。

## 规则

1. **使用设计令牌。** 颜色、字号、字重、行高、间距、圆角、阴影、时长与缓动均通过 `var(--vl-…)` 引用，以适应明暗模式、强调色与主题。
2. **像素字面量只允许 `0` 与 `1px`。** 其余一律用令牌（`var(--vl-space-3)`、`var(--vl-radius-lg)`），比例用 `%`、`fr` 等相对单位。
3. **使用 CSS Module，避免内联样式。** 样式放在 `*.module.css` 中，类名仅用于应用自身的元素。vellum-ui 组件不接收 `className`。
4. **使用语义色。** 引用语义令牌（`color-accent`、`color-success` 等）与图表色板（`color-chart-1` … `color-chart-8`），不写十六进制颜色字面量。
5. **使用统一状态层**表达悬停与按下反馈（见下文），不添加自定义 `:hover` 背景或 `:active` 缩放。
6. **使用动效令牌**，以遵循用户的「减少动态效果」设置；动效的原则与写法见[动效](motion.md)。

## 令牌

ThemeProvider 通过带 `--vl-` 前缀的 CSS 自定义属性提供令牌。完整名称与取值见[令牌清单](../tokens.md)，常用令牌如下：

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
| 阴影 | `--vl-shadow-near`（卡片，深色模式没有）、`--vl-shadow-thumb`（轨道中的选中项，深色模式没有）、`--vl-shadow-float`（菜单）、`--vl-shadow-pop`（对话框） |
| 动效 | `--vl-motion-ease-spring`、`--vl-motion-duration-spring`（出现、移动、改变尺寸），`-spring-bounce`（小型指示），`--vl-motion-duration-fast`、`-base`、`-slow`，`--vl-motion-ease-standard`、`--vl-motion-ease-exit` |
| 焦点 | `--vl-color-focus-ring`、`--vl-color-focus-halo` |
| 层级 | `--vl-z-overlay`、`--vl-z-viewer`、`--vl-z-message` |

令牌名对应主题字段，例如 `bgSurface` 编译为 `--vl-color-bg-surface`。原始色板（`--vl-neutral-…`、`--vl-blue-…`）同样可用，但应优先使用随明暗模式变化的语义令牌。`--vl-control-height-md` 等组件令牌随密度变化。

在 TypeScript 中，`cssVar('color-accent')` 返回 `'var(--vl-color-accent)'`，用于 SVG `fill` 或第三方选项等接收 CSS 颜色字符串的接口。画布等无法解析 CSS 变量的接口可使用 `useTheme().cssVars` 中已解析的主题值。

## 可点击的自定义元素：`data-vl-state`

为自定义交互元素添加 `data-vl-state`，即可应用统一状态层：悬停时叠加内容色，按下时立即加深且不缩放，键盘聚焦时显示焦点环。`disabled` 或 `aria-disabled="true"` 会禁用状态层；触屏设备不显示悬停层。

```tsx
<button type="button" className={styles.entry} data-vl-state="" onClick={open}>
  …
</button>
```

- 状态层占用元素的 `::before`，请为组件库保留该伪元素。
- 元素会变成 `position: relative` 并创建层叠上下文；状态层继承它的 `border-radius`。
- 使用原生 `<button>` 或 `<a>`，确保支持键盘聚焦与触发。

## 进场动画

`vellum-ui/styles.css` 定义了 Page 使用的淡入上移动画 `vl-rise`。在 CSS Module 中通过 `global()` 引用，避免名称被局部化：

```css
.card {
  /* biome-ignore lint/correctness/noUnknownFunction: global() references keyframes outside the CSS Module */
  animation: global(vl-rise) var(--vl-motion-duration-slow) var(--vl-motion-ease-standard) both;
}
```

检查指令允许 CSS Modules 的 `global()` 语法。自定义 keyframes 定义在同一个 CSS Module 中。「减少动态效果」会将时长令牌设为 0，从而停用引用这些令牌的动画。导入 `vellum-ui/global.css` 后，还可使用页面切换（`view-transition-name: vl-main`）所需的 `vl-fade-in` 与 `vl-fade-out`。

## 页面切换

`vellum-ui/global.css` 为名为 `vl-main` 的元素定义页面切换动效：旧页面淡出，新页面淡入并轻微上移，导航与周围内容保持不动。

1. AppShell 已将主内容区命名为 `vl-main`。自定义外壳需为页面容器添加 `view-transition-name: vl-main;`。
2. 在 `document.startViewTransition` 中切换页面并同步渲染，使浏览器能捕获新内容：

```tsx
import { flushSync } from 'react-dom'

function navigate(next: PageKey) {
  if (!document.startViewTransition) return setPage(next)
  document.startViewTransition(() => flushSync(() => setPage(next)))
}
```

不支持 View Transitions 的浏览器直接切换页面，不播放动画。「减少动态效果」会将切换时长设为 0。

## 图片背后：看图背景令牌

图片与视频区域（画布、查看器、缩略图说明）使用看图背景令牌。令牌采用中性灰，在不同明暗模式与强调色下保持一致，避免影响对图像颜色的判断。

| 令牌 | 用途 |
| --- | --- |
| `--vl-viewer-bg-mid`、`--vl-viewer-bg-dark`、`--vl-viewer-bg-black` | 图片背后的背景（中灰、深灰、黑） |
| `--vl-viewer-text`、`--vl-viewer-text-muted` | 这个背景上的文字 |
| `--vl-viewer-control-bg`、`--vl-viewer-control-bg-hover`、`--vl-viewer-control-border` | 图片上的控件 |
| `--vl-viewer-placeholder` | 图片加载时的占位 |

`useTheme().viewerStage` 提供 Lightbox 的背景选择（`'mid'`、`'dark'` 或 `'black'`）。自定义查看器应使用相同选择。

## 示例

首页项目卡片示例：通过令牌定义表面、圆角、状态层与进场动画。整页都有自己的风格、并与组件库的组件并用的例子，见 [WorkspaceHome 配方](../recipes/WorkspaceHome.md)。

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

Text 提供文字排版与颜色，CSS 仅定义卡片特有的布局与外观。
