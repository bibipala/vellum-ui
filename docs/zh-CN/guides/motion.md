[English](../../en-US/guides/motion.md) | **简体中文**

# 动效

组件库的动效追求自然、跟手：元素从触发它的地方出现，沿弹簧移动和落定，随时可以打断并从当前状态折返。本指南说明这些原则、各组件的动效、动效令牌，以及在自己的样式与主题中如何保持同样的手感。

## 原则

- **有来处。** 弹层从触发它的元素一侧长出（缩放原点在靠近触发元素的那条边上），对话框从点击的位置长出，关闭时缩回去。看得出它属于谁。
- **可以打断。** 打开到一半再关闭，元素从当前的样子往回走，而不是先跳到完全打开再播放关闭动画。实现上用过渡（transition）代替一次性的关键帧动画：过渡总是从当前值出发。
- **沿弹簧运动。** 出现、移动、改变尺寸的元素沿阻尼弹簧运动：起步干脆、收尾柔和地落定。小型指示（开关手柄、勾选标记）略微越过终点再回来，显得轻快；移动距离长的元素（滑块、面板、弹层）不回弹，不会晃。
- **保持连续。** 同一个东西在两个状态之间是「变过去」的：选中浅底滑到新的一项，展开的面板高度连续变化，标签页的新内容淡入、旧内容淡出，图片从缩略图中长出而不是盖在上面出现。
- **手势跟手。** 拖动时元素随指针移动，没有延迟；松手后带着速度继续，沿弹簧落定（轻轻一甩就能切换或关闭）。
- **反馈立即。** 按下的瞬间状态层就加深，松开后再恢复；按下时不缩放、不位移，也不提前播放动画。
- **离开比进入快。** 离场用退出曲线与较短的时长，不挡住接下来的操作；离场中的元素不再接收点击与焦点。

## 组件的动效

| 组件 | 动效 |
| --- | --- |
| Dropdown、Select、DatePicker、Cascader 等弹层 | 从触发元素一侧缩放（0.95 → 1）并淡入，沿弹簧；关闭时缩小淡出；可以中途折返 |
| Tooltip、Popover、Popconfirm | 从箭头一侧长出（0.94 → 1），其余同上 |
| Modal | 从点击的位置长出，遮罩淡入；关闭时缩小淡出，结束后卸载内容 |
| Drawer | 沿弹簧从边缘滑入，离场更快；关闭途中再次打开从当前位置折返 |
| FilePreview、Lightbox | 从缩略图打开的图片从缩略图中长出，关闭时飞回缩略图（否则淡入，加载后放大到位）；切换文件时沿轨道滑动；缩放、拖动、滑动跟手，松手后沿弹簧落定；上下拖动时背景随距离变淡 |
| Switch | 手柄沿回弹的弹簧落到另一端（合成线程执行，主线程繁忙时也不卡） |
| Checkbox、Radio | 勾选标记与圆点沿回弹的弹簧放大，不等方框变色 |
| Segmented、Tabs | 选中滑块与下划线沿弹簧滑动；Tabs 切换时新内容淡入并轻微上移 |
| Nav | 选中浅底沿弹簧滑到新的当前项；收起侧栏时立即跟上 |
| Reasoning、ToolCalls、Sources、折叠面板、树 | 展开、收起时高度沿弹簧变化，箭头同步旋转；Sources 可以中途折返 |
| useMessage | 沿弹簧从底部滑入，其余消息平滑移到新位置 |
| Page | 内容淡入并轻微上移 |

## 动效令牌

时长与曲线都来自令牌，主题可以修改，「减少动态效果」时时长归零。完整的取值见[令牌清单](../tokens.md#动效)。

| 令牌 | 用途 |
| --- | --- |
| `--vl-motion-ease-spring`、`--vl-motion-duration-spring` | 出现、移动、改变尺寸：弹层、面板、滑块、展开。不回弹 |
| `--vl-motion-ease-spring-bounce`、`--vl-motion-duration-spring-bounce` | 小型指示落到新状态：开关手柄、勾选标记。略微回弹 |
| `--vl-motion-ease-standard` | 颜色、透明度等不是位移的变化 |
| `--vl-motion-ease-exit` | 离场 |
| `--vl-motion-duration-fast`、`-base`、`-slow` | 悬停（120ms）、颜色与透明度（200ms）、大面板（280ms，可配合弹簧曲线） |

弹簧的曲线是 CSS 的 `linear()` 缓动，时长是弹簧落定所需的时间，两者成对使用。大面板想要同样的手感但慢一些时，可以把弹簧曲线配上 `--vl-motion-duration-slow`。

## 在自己的样式中使用

自定义视觉（见[自定义样式](custom-styles.md)）中的动效同样只引用令牌，并遵循上面的原则。

### 用过渡实现进场与离场

元素挂载时的起点用 `@starting-style` 给出，离场用一个属性或类名切换到离场状态。两个方向都是过渡，可以随时折返：

```css
.panel {
  transition:
    opacity var(--vl-motion-duration-base) var(--vl-motion-ease-standard),
    transform var(--vl-motion-duration-spring) var(--vl-motion-ease-spring);
}

@starting-style {
  .panel {
    opacity: 0;
    transform: scale(0.96);
  }
}

.panel[data-leaving] {
  opacity: 0;
  transform: scale(0.98);
  pointer-events: none;
  transition-duration: var(--vl-motion-duration-fast);
  transition-timing-function: var(--vl-motion-ease-exit);
}
```

离场结束后再卸载元素：监听元素自身的 `transitionend`，并按离场时长设一个兜底的定时器。「减少动态效果」时时长为 0，时长为 0 的过渡不会触发 `transitionend`，这时直接卸载。

### 展开与收起

高度从 0 过渡到内容高度，用网格的行代替 `height: auto`（不需要量高度，各浏览器都支持，可以中途折返）：

```css
.collapse {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--vl-motion-duration-spring) var(--vl-motion-ease-spring);
}

.collapse[data-expanded] {
  grid-template-rows: 1fr;
}

.collapse > .clip {
  min-height: 0;
  overflow: hidden;
}
```

收起后的内容要对读屏与 `Tab` 隐藏：`visibility: hidden`，并让它在收起的过渡结束后才生效（见 Sources 的实现）。

### 在脚本中使用弹簧

Web Animations API 等由脚本驱动的动画，用 `springEasing` 把弹簧编译为同样的缓动与时长：

```ts
import { defaultSpring, springEasing } from 'vellum-ui'

const { easing, duration } = springEasing(defaultSpring)
element.animate([{ transform: 'translateY(8px)' }, { transform: 'none' }], { duration, easing })
```

脚本中先检查「减少动态效果」（`matchMedia('(prefers-reduced-motion: reduce)')`，以及根元素的 `data-vl-reduced-motion="true"`），打开时不做位移。

## 在主题中调整弹簧

弹簧由两个参数描述：`response` 是无阻尼时摆动一周的时间（毫秒，越小越快），`damping` 是阻尼比（1 不回弹，越小回弹越明显）。主题只需给出参数，曲线与时长由 `compileTheme` 算出：

```ts
import { defaultTheme, extendTheme } from 'vellum-ui'

const calmTheme = extendTheme(defaultTheme, {
  id: 'calm',
  scale: {
    // 更慢、完全不回弹的弹簧
    motionSpring: { response: 320, damping: 1 },
    // 小型指示几乎不回弹
    motionSpringBounce: { response: 300, damping: 0.85 },
  },
})
```

默认值是 `defaultSpring`（response 260ms、阻尼 0.9，约 240ms 落定）与 `defaultSpringBounce`（response 280ms、阻尼 0.72，约越过终点 4%）。

## 减少动态效果

系统的「减少动态效果」设置与 ThemeProvider 的 `reducedMotion` 都会把所有动效时长归零：弹层、对话框、抽屉立即开关，滑块直接到位，加载指示不旋转。组件内部的过渡至少保留 1ms，使 antd 的动画状态机照常收尾，界面上看不出动画。

## 浏览器支持

弹簧曲线使用 CSS `linear()` 缓动（Chrome 113、Safari 17.2、Firefox 112 起）。更早的浏览器中弹簧令牌退回到相近的贝塞尔曲线，动效仍然存在，只是没有弹簧的落定感。`@starting-style` 用于挂载时的进场，不支持的浏览器直接显示，不影响使用。实测 WebKitGTK 2.52（Tauri 的 Linux 版）全部支持。
