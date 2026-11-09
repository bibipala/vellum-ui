/**
 * 内置主题（数据）。主题只提供语义令牌取值，不改变布局与行为。
 *
 * 视觉方向 v3「清透分层」：一个主题同时提供浅色与深色两套颜色，用户在「浅色 / 深色 / 跟随系统」
 * 之间选择。内置只有一套 `default`：中性灰画布配白色卡片，强调色「晴蓝」。
 * 看图区域使用中性的看图背景令牌（viewer-*），不随明暗与强调色变化。
 */

import { oklch } from '../tokens/oklch.ts'
import { ACCENT_HUE, blue, neutral } from '../tokens/primitive.ts'
import {
  type ChartColors,
  type ColorMode,
  defaultScale,
  type SemanticColors,
  type SemanticScale,
} from '../tokens/semantic.ts'

/**
 * A theme: semantic colors for light and for dark mode, plus the non-color tokens. Pass it to ThemeProvider's
 * `theme`; create variants of an existing theme with extendTheme.
 * @zh 主题定义：浅色与深色两套语义颜色，加上非颜色令牌。传给 ThemeProvider 的 `theme`；在已有主题上生成变体用
 * extendTheme。
 */
export interface ThemeDefinition {
  /**
   * Theme ID, such as `default`; written to `data-vl-theme` on `<html>`.
   * @zh 主题 ID，如 `default`；写到 `<html>` 的 `data-vl-theme` 上。
   */
  readonly id: string
  /**
   * Text key of the display name of the theme, such as `theme.default` ("Vellum"), for theme pickers.
   * @zh 主题显示名称的文本键，如 `theme.default`（「Vellum」），供主题选择器使用。
   */
  readonly nameKey: string
  /**
   * Semantic colors in light mode.
   * @zh 浅色模式的语义颜色。
   */
  readonly light: SemanticColors
  /**
   * Semantic colors in dark mode.
   * @zh 深色模式的语义颜色。
   */
  readonly dark: SemanticColors
  /**
   * Non-color semantic tokens: fonts, sizes, spacing, radius, motion.
   * @zh 非颜色语义令牌：字体、字号、间距、圆角、动效。
   */
  readonly scale: SemanticScale
}

/**
 * The color mode chosen by the user: `light`, `dark`, or `system` to follow the setting of the operating system
 * (and to change with it).
 * @zh 用户选择的明暗模式：`light` 浅色、`dark` 深色，或 `system` 跟随操作系统的设置（并随之变化）。
 */
export type ColorModePreference = ColorMode | 'system'

/** 发散色暖端（红）的色相。冷端用强调色色相，冷暖相对，中点是中性灰。 */
const DIVERGING_WARM_HUE = 25

/**
 * 浅色模式的图表颜色（表面 #ffffff）。
 * 分类色：第 1 个是强调色晴蓝，其余 7 个的色相与顺序来自 dataviz 方法的参考调色板（橙、青绿、黄、品红、绿、紫、红），
 * 实测相邻色在红色盲、绿色盲模拟下的最小色差 ΔE 9.1（目标 ≥ 8），正常视觉 19.6（下限 15）。
 * 青绿、黄、品红对白色表面的对比度低于 3:1，因此图表必须能切换为表格查看，并直接标注关键数值。
 */
const lightChart: ChartColors = {
  categorical: [
    blue[500],
    oklch(0.671, 0.175, 40.6),
    oklch(0.669, 0.141, 162.1),
    oklch(0.764, 0.161, 75.1),
    oklch(0.716, 0.141, 357.4),
    oklch(0.529, 0.18, 142.5),
    oklch(0.527, 0.197, 283.4),
    oklch(0.623, 0.191, 24.9),
  ],
  sequential: [
    oklch(0.93, 0.03, ACCENT_HUE),
    oklch(0.85, 0.065, ACCENT_HUE),
    oklch(0.76, 0.12, ACCENT_HUE),
    oklch(0.67, 0.165, ACCENT_HUE),
    oklch(0.58, 0.2, ACCENT_HUE),
    oklch(0.49, 0.19, ACCENT_HUE),
    oklch(0.4, 0.15, ACCENT_HUE),
  ],
  diverging: [
    oklch(0.47, 0.17, ACCENT_HUE),
    oklch(0.63, 0.15, ACCENT_HUE),
    oklch(0.8, 0.07, ACCENT_HUE),
    oklch(0.95, 0.004, ACCENT_HUE),
    oklch(0.8, 0.07, DIVERGING_WARM_HUE),
    oklch(0.63, 0.17, DIVERGING_WARM_HUE),
    oklch(0.47, 0.16, DIVERGING_WARM_HUE),
  ],
  muted: oklch(0.64, 0.012, ACCENT_HUE),
  grid: oklch(0.92, 0.005, ACCENT_HUE),
  axis: neutral[300],
}

/**
 * 深色模式的图表颜色（表面 neutral-900，约 #17191d）：同样的 8 个色相按深色表面重新取级，不是浅色的自动翻转。
 * 实测相邻色的色觉障碍模拟最小色差 ΔE 8.4，正常视觉 19.3；8 个颜色对表面的对比度都 ≥ 3:1。
 * 顺序色在深色模式下由暗到亮（数值越大越亮）；发散色的中点是接近表面的暗灰，两端越远越亮。
 */
const darkChart: ChartColors = {
  categorical: [
    blue[400],
    oklch(0.622, 0.173, 40.1),
    oklch(0.621, 0.128, 163.1),
    oklch(0.67, 0.143, 73.2),
    oklch(0.622, 0.171, 0.8),
    oklch(0.529, 0.18, 142.5),
    oklch(0.67, 0.145, 286.8),
    oklch(0.669, 0.159, 22.3),
  ],
  sequential: [
    oklch(0.33, 0.06, ACCENT_HUE),
    oklch(0.41, 0.1, ACCENT_HUE),
    oklch(0.49, 0.14, ACCENT_HUE),
    oklch(0.57, 0.17, ACCENT_HUE),
    oklch(0.66, 0.17, ACCENT_HUE),
    oklch(0.75, 0.115, ACCENT_HUE),
    oklch(0.84, 0.065, ACCENT_HUE),
  ],
  diverging: [
    oklch(0.78, 0.1, ACCENT_HUE),
    oklch(0.64, 0.17, ACCENT_HUE),
    oklch(0.46, 0.12, ACCENT_HUE),
    oklch(0.32, 0.006, ACCENT_HUE),
    oklch(0.46, 0.12, DIVERGING_WARM_HUE),
    oklch(0.64, 0.17, DIVERGING_WARM_HUE),
    oklch(0.78, 0.12, DIVERGING_WARM_HUE),
  ],
  muted: oklch(0.55, 0.012, ACCENT_HUE),
  grid: oklch(0.28, 0.01, ACCENT_HUE),
  axis: oklch(0.37, 0.012, ACCENT_HUE),
}

const lightColors: SemanticColors = {
  bgCanvas: neutral[50],
  bgSurface: neutral[0],
  bgElevated: neutral[0],
  bgSunken: neutral[50],
  fill: neutral[100],
  fillStrong: neutral[200],
  border: oklch(0.25, 0.02, ACCENT_HUE, 0.075),
  borderStrong: oklch(0.25, 0.02, ACCENT_HUE, 0.16),
  textPrimary: oklch(0.21, 0.01, ACCENT_HUE),
  textSecondary: oklch(0.45, 0.014, ACCENT_HUE),
  textTertiary: oklch(0.505, 0.013, ACCENT_HUE),
  textOnAccent: neutral[0],
  accent: blue[500],
  accentFill: blue[500],
  accentText: oklch(0.52, 0.2, ACCENT_HUE),
  danger: oklch(0.58, 0.2, 25),
  warning: oklch(0.72, 0.15, 70),
  success: oklch(0.6, 0.14, 155),
  info: blue[500],
  shadow: oklch(0.25, 0.03, ACCENT_HUE, 0.1),
  // 头像色调：浅底深字（视觉稿 proto.css 的 .a1–.a5），文字对比度 ≥ 4.5
  avatar: [
    { bg: oklch(0.942, 0.027, 265), text: oklch(0.5, 0.2, 264) },
    { bg: oklch(0.955, 0.024, 157), text: oklch(0.5, 0.115, 155) },
    { bg: oklch(0.957, 0.027, 68), text: oklch(0.53, 0.125, 52) },
    { bg: oklch(0.944, 0.03, 305), text: oklch(0.5, 0.18, 297) },
    { bg: oklch(0.954, 0.02, 205), text: oklch(0.5, 0.08, 207) },
  ],
  chart: lightChart,
}

const darkColors: SemanticColors = {
  // 深色模式越靠上的层越亮；卡片不加阴影
  bgCanvas: neutral[950],
  bgSurface: neutral[900],
  bgElevated: oklch(0.235, 0.009, ACCENT_HUE),
  bgSunken: neutral[975],
  fill: neutral[850],
  fillStrong: neutral[750],
  border: oklch(1, 0, 0, 0.065),
  borderStrong: oklch(1, 0, 0, 0.14),
  textPrimary: oklch(0.95, 0.004, ACCENT_HUE),
  textSecondary: oklch(0.75, 0.012, ACCENT_HUE),
  textTertiary: oklch(0.63, 0.013, ACCENT_HUE),
  textOnAccent: neutral[0],
  accent: blue[400],
  accentFill: blue[550],
  accentText: oklch(0.76, 0.13, ACCENT_HUE),
  danger: oklch(0.66, 0.19, 25),
  warning: oklch(0.8, 0.14, 80),
  success: oklch(0.74, 0.15, 158),
  info: blue[400],
  shadow: oklch(0, 0, 0, 0.55),
  // 头像色调：暗底浅字。视觉稿是叠在表面上的半透明色，这里取叠加后的实色，对比度在任何底色上都可预期
  avatar: [
    { bg: oklch(0.305, 0.055, 265), text: oklch(0.8, 0.1, 265) },
    { bg: oklch(0.315, 0.04, 165), text: oklch(0.82, 0.11, 160) },
    { bg: oklch(0.325, 0.035, 58), text: oklch(0.84, 0.1, 55) },
    { bg: oklch(0.31, 0.057, 295), text: oklch(0.79, 0.12, 300) },
    { bg: oklch(0.315, 0.037, 213), text: oklch(0.83, 0.085, 206) },
  ],
  chart: darkChart,
}

/**
 * The built-in theme `default`: a neutral gray canvas with white surfaces and a blue accent color, in light and dark
 * mode. ThemeProvider uses it when no `theme` is given; start from it with extendTheme to create your own theme.
 * @zh 内置主题 `default`：中性灰画布配白色面板，强调色为蓝色，有浅色与深色两套颜色。ThemeProvider 没有传 `theme`
 * 时使用它；自定义主题时用 extendTheme 在它的基础上修改。
 * @group Theme
 */
export const defaultTheme: ThemeDefinition = {
  id: 'default',
  nameKey: 'theme.default',
  light: lightColors,
  dark: darkColors,
  scale: defaultScale,
}

/**
 * The built-in themes by ID. There is one, `default` (the same object as `defaultTheme`).
 * @zh 按 ID 排列的内置主题。目前只有一个：`default`（与 `defaultTheme` 是同一个对象）。
 * @group Theme
 */
export const builtinThemes: Readonly<Record<'default', ThemeDefinition>> = {
  default: defaultTheme,
}

/**
 * ID of a built-in theme: `'default'`.
 * @zh 内置主题的 ID：`'default'`。
 */
export type BuiltinThemeId = keyof typeof builtinThemes

/**
 * ID of the default built-in theme, `'default'`: the key of `defaultTheme` in `builtinThemes`.
 * @zh 默认内置主题的 ID `'default'`：`defaultTheme` 在 `builtinThemes` 中的键。
 * @group Theme
 */
export const DEFAULT_THEME_ID: BuiltinThemeId = 'default'
