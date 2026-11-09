/**
 * The primitive tokens: the color palettes and the size scales of the default theme, named by value rather than by
 * use (`neutral[50]`, `blue[500]`, `spaceScale`). Components never use them directly, only the semantic tokens;
 * use them when defining a theme by hand. All primitive colors are also compiled to CSS variables, such as
 * `--vl-neutral-50` and `--vl-blue-500`.
 * @zh 原始令牌：默认主题的调色板与尺寸阶梯，按取值而不是用途命名（`neutral[50]`、`blue[500]`、`spaceScale`）。组件不
 * 直接使用它们，只使用语义令牌；手写主题定义时可以使用。全部原始颜色也会编译为 CSS 变量，如 `--vl-neutral-50`、
 * `--vl-blue-500`。
 * @group Theme
 */
// 视觉方向 v3「清透分层」：中性灰带一丝强调色的色相（极低彩度），只有一个强调色「晴蓝」，层次靠底色而不是描边。
import { type Oklch, oklch } from './oklch.ts'

/**
 * The OKLCH hue shared by the accent color and the neutral grays, `263` (blue).
 * @zh 强调色与中性灰共用的 OKLCH 色相 `263`（蓝）。
 */
export const ACCENT_HUE = 263

/**
 * The neutral grays, from `0` (white) to `975` (almost black): very low chroma with the accent hue, shared by light
 * and dark mode.
 * @zh 中性灰色阶，从 `0`（白）到 `975`（接近黑）：彩度极低、带强调色的色相，浅色与深色模式共用。
 */
export const neutral = Object.freeze({
  0: oklch(1, 0, 0),
  25: oklch(0.985, 0.002, ACCENT_HUE),
  50: oklch(0.968, 0.003, ACCENT_HUE),
  100: oklch(0.952, 0.004, ACCENT_HUE),
  150: oklch(0.928, 0.005, ACCENT_HUE),
  200: oklch(0.9, 0.006, ACCENT_HUE),
  300: oklch(0.83, 0.008, ACCENT_HUE),
  400: oklch(0.71, 0.01, ACCENT_HUE),
  500: oklch(0.58, 0.012, ACCENT_HUE),
  600: oklch(0.47, 0.013, ACCENT_HUE),
  700: oklch(0.37, 0.012, ACCENT_HUE),
  750: oklch(0.32, 0.011, ACCENT_HUE),
  800: oklch(0.275, 0.01, ACCENT_HUE),
  850: oklch(0.245, 0.009, ACCENT_HUE),
  900: oklch(0.215, 0.008, ACCENT_HUE),
  925: oklch(0.19, 0.007, ACCENT_HUE),
  950: oklch(0.165, 0.006, ACCENT_HUE),
  975: oklch(0.14, 0.005, ACCENT_HUE),
} as const)

/**
 * The blue accent scale: `500` is the accent color in light mode; dark mode uses `400` for indicators and `550` for
 * button fills (white text keeps a contrast of at least 4.5:1).
 * @zh 蓝色强调色阶：`500` 是浅色模式的强调色；深色模式的指示色用 `400`，按钮底色用 `550`（白字对比度 ≥ 4.5）。
 */
export const blue = Object.freeze({
  300: oklch(0.76, 0.12, ACCENT_HUE),
  400: oklch(0.66, 0.18, ACCENT_HUE),
  500: oklch(0.57, 0.215, ACCENT_HUE),
  550: oklch(0.565, 0.19, ACCENT_HUE),
  600: oklch(0.5, 0.2, ACCENT_HUE),
} as const)

/**
 * Reference values of the status colors `danger`, `warning`, `success` and `info`; the themes adjust their lightness
 * for each mode.
 * @zh 状态色 `danger`、`warning`、`success`、`info` 的基准值；主题按各个模式调整亮度。
 */
export const status = Object.freeze({
  danger: oklch(0.6, 0.21, 25),
  warning: oklch(0.78, 0.15, 75),
  success: oklch(0.66, 0.15, 155),
  info: oklch(0.62, 0.14, 245),
} as const)

/**
 * The spacing steps in pixels on a 4 px grid, index 0–8: `[0, 4, 8, 12, 16, 24, 32, 48, 64]` (`SpaceStep`).
 * @zh 基于 4px 网格的间距档位（像素），下标 0–8：`[0, 4, 8, 12, 16, 24, 32, 48, 64]`（`SpaceStep`）。
 */
export const spaceScale = [0, 4, 8, 12, 16, 24, 32, 48, 64] as const

/**
 * The font sizes in pixels, from `2xs` (11) to `4xl` (44); `md` (14) is the body text.
 * @zh 字号阶梯（像素），从 `2xs`（11）到 `4xl`（44）；`md`（14）是正文字号。
 */
export const fontSizeScale = {
  /** 角标、计数、快捷键提示等极小文字。 */
  '2xs': 11,
  xs: 12,
  sm: 13,
  md: 14,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 44,
} as const

/**
 * The corner radii in pixels: `sm` small controls, `md` controls, `lg` menus and messages, `xl` cards, `2xl` dialogs,
 * `full` pills and circles.
 * @zh 圆角阶梯（像素）：`sm` 小控件、`md` 控件、`lg` 菜单与消息条、`xl` 卡片、`2xl` 对话框、`full` 胶囊与圆形。
 */
export const radiusScale = { sm: 6, md: 8, lg: 12, xl: 16, '2xl': 20, full: 999 } as const

/**
 * The font weights: 400, 500 and 600. There is no heavier weight: emphasis comes from `semibold`.
 * @zh 字重阶梯：400 / 500 / 600。没有更粗的字重，强调用 `semibold`。
 */
export const fontWeightScale = { regular: 400, medium: 500, semibold: 600 } as const

/**
 * All primitive color scales by name (`neutral`, `blue`, `status`); compileTheme turns each color into a CSS
 * variable named `<scale>-<step>`, such as `--vl-neutral-50` or `--vl-status-danger`.
 * @zh 全部原始色阶，按名称排列（`neutral`、`blue`、`status`）；compileTheme 把每个颜色编译为名为 `<色阶>-<级别>` 的
 * CSS 变量，如 `--vl-neutral-50`、`--vl-status-danger`。
 */
// 冻结：经 `primitives` 公开，改动它们会改变所有主题的编译结果
export const primitiveColors: Readonly<Record<string, Readonly<Record<string | number, Oklch>>>> =
  Object.freeze({ neutral, blue, status })
