/**
 * 语义令牌（semantic）：按用途命名，组件只引用这一层。主题通过提供语义令牌的取值来改变外观。
 */
import type { Oklch } from './oklch.ts'
import { fontSizeScale, fontWeightScale, radiusScale, spaceScale } from './primitive.ts'
import type { MotionSpring } from './spring.ts'

/**
 * The spring of the default theme for things that appear, move or change size (`motionSpring`): response 260 ms,
 * damping 0.9, which settles in about 240 ms without visible overshoot.
 * @zh 默认主题中出现、移动、改变尺寸的元素所用的弹簧（`motionSpring`）：response 260ms、阻尼 0.9，约 240ms 落定，
 * 看不出越过终点。
 * @group Theme
 */
export const defaultSpring: MotionSpring = { response: 260, damping: 0.9 }

/**
 * The livelier spring of the default theme for small indicators (`motionSpringBounce`): response 280 ms, damping
 * 0.72, which overshoots by about 4 % and settles in about 340 ms.
 * @zh 默认主题中小型指示所用的、更轻快的弹簧（`motionSpringBounce`）：response 280ms、阻尼 0.72，约越过终点 4%，
 * 约 340ms 落定。
 * @group Theme
 */
export const defaultSpringBounce: MotionSpring = { response: 280, damping: 0.72 }

/**
 * A resolved color mode: `light` or `dark`.
 * @zh 解析后的明暗模式：`light` 浅色或 `dark` 深色。
 */
export type ColorMode = 'light' | 'dark'

/**
 * A pair of colors for a tinted element: a background and the text on it, with a contrast of at least 4.5:1
 * (WCAG AA). Used for the tones of Avatar.
 * @zh 一组色调：底色与其上的文字色，对比度不低于 4.5:1（WCAG AA）。用于 Avatar 的色调。
 */
export interface ToneColors {
  /**
   * Background color.
   * @zh 底色。
   */
  readonly bg: Oklch
  /**
   * Color of the text and icons on the background.
   * @zh 底色上文字与图标的颜色。
   */
  readonly text: Oklch
}

/** 头像色调的数量：蓝、绿、橙、紫、青。 */
export const AVATAR_TONE_COUNT = 5

/**
 * Number of categorical chart colors, `8`: series are assigned the colors in a fixed order; there is no 9th color,
 * and colors are not reused for more series.
 * @zh 图表分类色的数量 `8`：系列按固定顺序取色；没有第 9 个颜色，系列更多时也不循环使用。
 * @group Colors
 */
export const CHART_CATEGORICAL_COUNT = 8

/**
 * Number of steps of the sequential and diverging chart color ramps, `7`.
 * @zh 图表顺序色与发散色的级数 `7`。
 * @group Colors
 */
export const CHART_RAMP_STEPS = 7

/**
 * Chart colors. Each kind of color has one job: categorical colors tell series apart, sequential colors show
 * magnitude, and diverging colors show on which side of a baseline a value is. Status (good / bad) is not here:
 * use the semantic `danger`, `warning` and `success` colors, always with an icon and text.
 *
 * The default values are checked by the tests of the library (lightness range, minimum chroma, difference between
 * neighbors for color vision deficiencies, contrast with the surface). A theme that replaces them should meet the
 * same rules; do not pick them by eye.
 * @zh 图表颜色。每种颜色只做一件事：分类色区分系列，顺序色表示大小，发散色表示在基线哪一侧。状态（好 / 坏）不在
 * 这里，用语义状态色 `danger` / `warning` / `success`，并且总要配图标与文字。
 *
 * 默认取值由组件库的测试检查（亮度区间、彩度下限、色觉障碍模拟下的相邻色差、对表面的对比度）。主题替换它们时
 * 应满足同样的规则，不能凭肉眼挑选。
 */
export interface ChartColors {
  /**
   * The 8 categorical colors, assigned to series in a fixed order: the n-th series always gets the n-th color, so
   * hiding a series does not recolor the others. The order itself keeps neighbors distinguishable for color vision
   * deficiencies; do not reorder. Compiled to `color-chart-1` … `color-chart-8`.
   * @zh 分类色 8 个，按固定顺序分配给系列：第 n 个系列永远是第 n 个颜色，筛掉某个系列不会让其他系列变色。顺序本身
   * 保证了色觉障碍下相邻色可区分，不要调换。编译为 `color-chart-1` … `color-chart-8`。
   */
  readonly categorical: readonly [Oklch, Oklch, Oklch, Oklch, Oklch, Oklch, Oklch, Oklch]
  /**
   * The 7 sequential colors of one hue, ordered from the smallest to the largest value (light to dark in light
   * mode, dark to light in dark mode). For continuous values such as a heatmap; ordered categories (funnel stages, levels) use only steps 3–7,
   * which have a contrast of at least 2:1 with the surface. Compiled to `color-chart-seq-1` … `color-chart-seq-7`.
   * @zh 顺序色 7 级，单一色相，从「小」到「大」排列（浅色模式由浅到深，深色模式由暗到亮）。用于热力图等连续数值；
   * 有序分类（漏斗阶段、档位）只用第 3–7 级（对表面对比度 ≥ 2:1）。编译为 `color-chart-seq-1` … `color-chart-seq-7`。
   */
  readonly sequential: readonly [Oklch, Oklch, Oklch, Oklch, Oklch, Oklch, Oklch]
  /**
   * The 7 diverging colors: step 1 is the negative end, step 4 a neutral gray ("no deviation"), step 7 the positive
   * end; the two ends have opposite (cool and warm) hues. Compiled to `color-chart-div-1` … `color-chart-div-7`.
   * @zh 发散色 7 级：第 1 级是负向一端，第 4 级是中性灰（表示「没有偏离」），第 7 级是正向一端；两端色相冷暖相对。
   * 编译为 `color-chart-div-1` … `color-chart-div-7`。
   */
  readonly diverging: readonly [Oklch, Oklch, Oklch, Oklch, Oklch, Oklch, Oklch]
  /**
   * Muted color: "Other", the series that are not highlighted, the history part of a sparkline.
   * @zh 弱化色：「其他」、强调某个系列时的其余系列、迷你图的历史部分。
   */
  readonly muted: Oklch
  /**
   * Grid lines (1 px solid lines, not dashed).
   * @zh 网格线（1px 实线，不用虚线）。
   */
  readonly grid: Oklch
  /**
   * The baseline of an axis.
   * @zh 坐标轴基线。
   */
  readonly axis: Oklch
}

/**
 * The semantic colors a theme provides for one color mode. These are base colors: the hover, active, disabled and
 * subtle variants are derived from them in OKLCH when the theme is compiled. Each field is compiled to
 * `color-<name in kebab case>`, such as `bgCanvas` → `--vl-color-bg-canvas`.
 * @zh 主题为一种明暗模式提供的语义颜色。这些是基础色：悬停、按下、禁用、浅底等状态色在编译主题时按 OKLCH 自动派生。
 * 每个字段编译为 `color-<短横线形式的名称>`，如 `bgCanvas` → `--vl-color-bg-canvas`。
 */
export interface SemanticColors {
  /**
   * Background of the page (the canvas).
   * @zh 页面背景（画布）。
   */
  readonly bgCanvas: Oklch
  /**
   * Surfaces such as cards and panels.
   * @zh 卡片、面板等表面。
   */
  readonly bgSurface: Oklch
  /**
   * Elevated surfaces: overlays such as menus, popovers and dialogs.
   * @zh 浮层表面：菜单、气泡卡片、对话框等弹层。
   */
  readonly bgElevated: Oklch
  /**
   * Sunken areas that are deeper than the surface, such as code blocks and tracks.
   * @zh 凹陷区域：代码块、轨道等比表面更深的区域。
   */
  readonly bgSunken: Oklch
  /**
   * Neutral fill of filled controls without a border: secondary buttons, inputs, the track of a segmented control.
   * @zh 中性填充：次要按钮、输入框、分段控件轨道等填充式控件（不描边）。
   */
  readonly fill: Oklch
  /**
   * Stronger neutral fill: the track of a switch that is off, an unchecked checkbox.
   * @zh 较深的中性填充：关闭状态的开关轨道、未选中的复选框。
   */
  readonly fillStrong: Oklch
  /**
   * Divider lines, only between table rows and list items.
   * @zh 分隔线：只用于表格行、列表行之间。
   */
  readonly border: Oklch
  /**
   * Outline of the few controls that need one, such as outlined buttons.
   * @zh 轮廓：描边按钮等少数需要轮廓的控件。
   */
  readonly borderStrong: Oklch
  /**
   * Main text color.
   * @zh 主要文字颜色。
   */
  readonly textPrimary: Oklch
  /**
   * Secondary text: descriptions, labels, metadata.
   * @zh 次要文字：说明、标签、元信息。
   */
  readonly textSecondary: Oklch
  /**
   * Tertiary text: placeholders, hints, the least important information.
   * @zh 第三级文字：占位文字、提示、最不重要的信息。
   */
  readonly textTertiary: Oklch
  /**
   * Text on the solid accent fill, such as on a primary button.
   * @zh 强调色实心底上的文字，如主按钮上的文字。
   */
  readonly textOnAccent: Oklch
  /**
   * The only accent color: switches, indicators, focus rings, selection.
   * @zh 唯一的强调色：开关、选中指示、焦点环、选中状态。
   */
  readonly accent: Oklch
  /**
   * Solid accent fill: primary buttons, checked checkboxes. In dark mode it is darker than `accent`, so that white
   * text keeps a contrast of at least 4.5:1.
   * @zh 强调色实心底：主按钮、选中的复选框。深色模式下比 `accent` 暗，保证白字对比度 ≥ 4.5。
   */
  readonly accentFill: Oklch
  /**
   * Danger (destructive actions, errors).
   * @zh 危险（危险操作、错误）。
   */
  readonly danger: Oklch
  /**
   * Warning.
   * @zh 警告。
   */
  readonly warning: Oklch
  /**
   * Success.
   * @zh 成功。
   */
  readonly success: Oklch
  /**
   * Information.
   * @zh 信息。
   */
  readonly info: Oklch
  /**
   * Base color of shadows, with transparency.
   * @zh 阴影的基色（含透明度）。
   */
  readonly shadow: Oklch
  /**
   * The accent color as text or icons on the canvas, such as links; easier to read than `accent`.
   * @zh 作为文字或图标出现在画布上的强调色，如链接；比 `accent` 更易读。
   */
  readonly accentText: Oklch
  /**
   * The five avatar tones (blue, green, orange, purple, cyan): light backgrounds with dark text in light mode, dark
   * backgrounds with light text in dark mode, no border. Avatar picks one stably from the name. Compiled to
   * `color-avatar-1-bg` / `color-avatar-1-text` … `color-avatar-5-*`.
   * @zh 头像色调：蓝、绿、橙、紫、青五种，浅色模式为浅底深字、深色模式为暗底浅字，不描边。Avatar 按名称稳定地取其中
   * 一种；编译为 `color-avatar-1-bg` / `color-avatar-1-text` … `color-avatar-5-*`。
   */
  readonly avatar: readonly [ToneColors, ToneColors, ToneColors, ToneColors, ToneColors]
  /**
   * Chart colors, see ChartColors.
   * @zh 图表颜色，见 ChartColors。
   */
  readonly chart: ChartColors
}

/**
 * The non-color semantic tokens: fonts, sizes, spacing, radius, motion. A theme may replace them (`scale` of
 * extendTheme). Sizes are in pixels and durations in milliseconds.
 * @zh 与颜色无关的语义令牌：字体、字号、间距、圆角、动效。主题可以替换（extendTheme 的 `scale`）。尺寸单位为像素，
 * 时长单位为毫秒。
 */
export interface SemanticScale {
  /**
   * Font stack of headings (`font-family-heading`).
   * @zh 标题的字体栈（`font-family-heading`）。
   */
  readonly fontFamilyHeading: string
  /**
   * Font stack of body text (`font-family-body`).
   * @zh 正文的字体栈（`font-family-body`）。
   */
  readonly fontFamilyBody: string
  /**
   * Font stack for accent text in applications (`font-family-accent`); the components do not use it.
   * @zh 应用中点缀文字的字体栈（`font-family-accent`）；组件本身不使用。
   */
  readonly fontFamilyAccent: string
  /**
   * Monospace font stack, for IDs, code and API names (`font-family-mono`).
   * @zh 等宽字体栈，用于编号、代码与接口名（`font-family-mono`）。
   */
  readonly fontFamilyMono: string
  /**
   * Font sizes in pixels, `2xs` (11) to `4xl` (44); compiled to `font-size-<step>`.
   * @zh 字号（像素），从 `2xs`（11）到 `4xl`（44）；编译为 `font-size-<档位>`。
   */
  readonly fontSize: Readonly<Record<keyof typeof fontSizeScale, number>>
  /**
   * Font weights: `regular`, `medium` and `semibold`; compiled to `font-weight-<name>`.
   * @zh 字重：`regular`、`medium`、`semibold`；编译为 `font-weight-<名称>`。
   */
  readonly fontWeight: Readonly<Record<keyof typeof fontWeightScale, number>>
  /**
   * Line height of body text, as a factor (`1.55`).
   * @zh 正文的行高，倍数（`1.55`）。
   */
  readonly lineHeightBody: number
  /**
   * Line height of headings, as a factor (`1.2`).
   * @zh 标题的行高，倍数（`1.2`）。
   */
  readonly lineHeightHeading: number
  /**
   * Spacing steps in pixels, index 0–8; compiled to `space-0` … `space-8`.
   * @zh 间距档位（像素），下标 0–8；编译为 `space-0` … `space-8`。
   */
  readonly space: readonly number[]
  /**
   * Corner radii in pixels: `sm` small controls, `md` controls, `lg` menus and messages, `xl` cards, `2xl` dialogs,
   * `full` pills and circles; compiled to `radius-<name>`.
   * @zh 圆角（像素）：`sm` 小控件、`md` 控件、`lg` 菜单与消息条、`xl` 卡片、`2xl` 对话框、`full` 胶囊与圆形；编译为
   * `radius-<名称>`。
   */
  readonly radius: Readonly<Record<keyof typeof radiusScale, number>>
  /**
   * Width of borders and dividers in pixels.
   * @zh 描边与分隔线的宽度（像素）。
   */
  readonly borderWidth: number
  /**
   * Fast transitions such as hover, in milliseconds (`motion-duration-fast`).
   * @zh 快速过渡的时长，如悬停（毫秒，`motion-duration-fast`）。
   */
  readonly motionDurationFast: number
  /**
   * Base transitions such as indicators and dialogs, in milliseconds (`motion-duration-base`).
   * @zh 基础过渡的时长，如选中指示、对话框（毫秒，`motion-duration-base`）。
   */
  readonly motionDurationBase: number
  /**
   * Slow transitions such as drawers and pages, in milliseconds (`motion-duration-slow`).
   * @zh 较慢过渡的时长，如抽屉、页面（毫秒，`motion-duration-slow`）。
   */
  readonly motionDurationSlow: number
  /**
   * Easing of most transitions, a CSS easing function (`motion-ease-standard`).
   * @zh 大多数过渡的缓动，CSS 缓动函数（`motion-ease-standard`）。
   */
  readonly motionEaseStandard: string
  /**
   * Easing of exit transitions, when an element leaves (`motion-ease-exit`).
   * @zh 退出类过渡（元素离开）的缓动（`motion-ease-exit`）。
   */
  readonly motionEaseExit: string
  /**
   * The spring of things that appear, move or change size: popups, dialogs, drawers, panels that expand
   * (`motion-ease-spring`, `motion-duration-spring`). Settles without visible overshoot. `defaultSpring` when not
   * given.
   * @zh 出现、移动、改变尺寸的元素所用的弹簧：弹层、对话框、抽屉、展开的面板（`motion-ease-spring`、
   * `motion-duration-spring`）。落定时不明显越过终点。未指定时为 `defaultSpring`。
   */
  readonly motionSpring?: MotionSpring
  /**
   * The livelier spring of small indicators that land on a new state: switch knobs, check marks, selection thumbs
   * (`motion-ease-spring-bounce`, `motion-duration-spring-bounce`). Overshoots slightly. `defaultSpringBounce` when
   * not given.
   * @zh 小型指示落到新状态时所用的、更轻快的弹簧：开关手柄、勾选标记、选中滑块（`motion-ease-spring-bounce`、
   * `motion-duration-spring-bounce`）。略微越过终点再回来。未指定时为 `defaultSpringBounce`。
   */
  readonly motionSpringBounce?: MotionSpring
  /**
   * Font weight of headings.
   * @zh 标题的字重。
   */
  readonly fontWeightHeading: number
  /**
   * Letter spacing of headings, a CSS length such as `-0.01em`.
   * @zh 标题的字距，CSS 长度，如 `-0.01em`。
   */
  readonly letterSpacingHeading: string
  /**
   * Letter spacing of overlines (small group titles).
   * @zh 分组小标题的字距。
   */
  readonly letterSpacingOverline: string
}

/**
 * The font stacks of the default theme (`heading`, `body`, `accent`, `mono`), as CSS `font-family` values. Only
 * open fonts under the SIL OFL are named: Inter (variable font) for Latin text, then Source Han Sans / Noto Sans CJK
 * for Chinese, then the system fonts of each platform; JetBrains Mono for IDs, code and API names. The fonts
 * themselves are loaded by `vellum-ui/fonts.css` (Inter and JetBrains Mono).
 * @zh 默认主题的字体栈（`heading`、`body`、`accent`、`mono`），是 CSS 的 `font-family` 取值。只列出 SIL OFL 开源字体：
 * 西文 Inter（可变字体），中文优先思源黑体 / Noto Sans CJK，再回退到各平台的系统字体；等宽字体 JetBrains Mono
 * 用于编号、代码与接口名。字体文件由 `vellum-ui/fonts.css` 加载（Inter 与 JetBrains Mono）。
 * @group Theme
 */
export const fontStacks = {
  heading:
    "'Inter Variable', 'Inter', 'Source Han Sans SC', 'Noto Sans CJK SC', 'Microsoft YaHei UI', 'PingFang SC', system-ui, sans-serif",
  body: "'Inter Variable', 'Inter', 'Source Han Sans SC', 'Noto Sans CJK SC', 'Microsoft YaHei UI', 'PingFang SC', system-ui, -apple-system, 'Segoe UI', sans-serif",
  accent:
    "'Inter Variable', 'Inter', 'Source Han Sans SC', 'Noto Sans CJK SC', 'Microsoft YaHei UI', 'PingFang SC', sans-serif",
  mono: "'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, 'Cascadia Mono', 'SFMono-Regular', Consolas, monospace",
} as const

/**
 * The non-color semantic tokens of the default theme: the font stacks of `fontStacks`, font sizes 11–44 px, spacing
 * on a 4 px grid (0–64 px), radii 8–20 px, transitions of 120 / 200 / 280 ms and the springs `defaultSpring` and
 * `defaultSpringBounce`. Spread it to change single fields
 * when defining a theme by hand.
 * @zh 默认主题的非颜色语义令牌：`fontStacks` 中的字体栈、11–44px 的字号、基于 4px 网格的间距（0–64px）、8–20px 的
 * 圆角、120 / 200 / 280ms 的过渡，以及弹簧 `defaultSpring`、`defaultSpringBounce`。手写主题定义时可以展开它，只修改个别字段。
 * @group Theme
 */
export const defaultScale: SemanticScale = {
  fontFamilyHeading: fontStacks.heading,
  fontFamilyBody: fontStacks.body,
  fontFamilyAccent: fontStacks.accent,
  fontFamilyMono: fontStacks.mono,
  fontSize: fontSizeScale,
  fontWeight: fontWeightScale,
  lineHeightBody: 1.55,
  lineHeightHeading: 1.2,
  space: spaceScale,
  radius: radiusScale,
  borderWidth: 1,
  // 悬停 120ms、选中指示与对话框 200ms、抽屉与页面 280ms
  motionDurationFast: 120,
  motionDurationBase: 200,
  motionDurationSlow: 280,
  // 快起慢收、不回弹：起步干脆、收尾柔和，交互显得「跟手」
  motionEaseStandard: 'cubic-bezier(0.2, 0, 0, 1)',
  motionEaseExit: 'cubic-bezier(0.4, 0, 1, 1)',
  motionSpring: defaultSpring,
  motionSpringBounce: defaultSpringBounce,
  fontWeightHeading: 600,
  letterSpacingHeading: '-0.01em',
  letterSpacingOverline: '0.02em',
}
