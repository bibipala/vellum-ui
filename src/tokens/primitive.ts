/**
 * 原始令牌（primitive）：调色板与尺度阶梯，与用途无关。
 * 组件不得直接引用原始令牌，只能引用语义令牌。
 *
 * 视觉方向 v3「清透分层」：中性灰带一丝强调色的色相（极低彩度），只有一个强调色「晴蓝」，
 * 层次靠底色而不是描边。
 */
import { type Oklch, oklch } from './oklch.ts'

/** 强调色与中性色共用的色相：晴蓝（2026-11-04 用户选定）。 */
export const ACCENT_HUE = 263

/** 中性色阶：彩度极低、带晴蓝色相，浅色与深色模式共用。 */
export const neutral = {
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
} as const

/** 晴蓝色阶。500 为浅色模式强调色；深色模式指示色用 400，按钮底色用 550（白字对比度 ≥ 4.5）。 */
export const blue = {
  300: oklch(0.76, 0.12, ACCENT_HUE),
  400: oklch(0.66, 0.18, ACCENT_HUE),
  500: oklch(0.57, 0.215, ACCENT_HUE),
  550: oklch(0.565, 0.19, ACCENT_HUE),
  600: oklch(0.5, 0.2, ACCENT_HUE),
} as const

/** 状态色基准（各模式按需调亮度）。 */
export const status = {
  danger: oklch(0.6, 0.21, 25),
  warning: oklch(0.78, 0.15, 75),
  success: oklch(0.66, 0.15, 155),
  info: oklch(0.62, 0.14, 245),
} as const

/** 4px 基础网格的间距阶梯。 */
export const spaceScale = [0, 4, 8, 12, 16, 24, 32, 48, 64] as const

/** 字号阶梯（px）。 */
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
 * 圆角阶梯（px）：sm 小控件、md 控件、lg 菜单与消息条、xl 卡片、2xl 对话框、full 胶囊与圆形。
 */
export const radiusScale = { sm: 6, md: 8, lg: 12, xl: 16, '2xl': 20, full: 999 } as const

/**
 * 字重阶梯（只用 400 / 500 / 600）。`bold` 暂与 semibold 相同，组件库重构时移除。
 */
export const fontWeightScale = { regular: 400, medium: 500, semibold: 600, bold: 600 } as const

/** 所有原始颜色，按「色阶名-级别」编译为 CSS 变量。 */
export const primitiveColors: Record<string, Record<string | number, Oklch>> = {
  neutral,
  blue,
  status,
}
