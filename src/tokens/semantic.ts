/**
 * 语义令牌（semantic）：按用途命名，组件只引用这一层。主题通过提供语义令牌的取值来改变外观。
 */
import type { Oklch } from './oklch.ts'
import { fontSizeScale, fontWeightScale, radiusScale, spaceScale } from './primitive.ts'

/** 明暗模式。 */
export type ColorMode = 'light' | 'dark'

/** 一组色调：底色 + 文字色。文字与底色的对比度 ≥ 4.5（WCAG AA）。 */
export interface ToneColors {
  /** 底色。 */
  readonly bg: Oklch
  /** 文字与图标色。 */
  readonly text: Oklch
}

/** 头像色调的数量：蓝、绿、橙、紫、青。 */
export const AVATAR_TONE_COUNT = 5

/** 图表分类色的数量（固定顺序，不循环、不生成第 9 个）。 */
export const CHART_CATEGORICAL_COUNT = 8

/** 图表顺序色与发散色的级数。 */
export const CHART_RAMP_STEPS = 7

/**
 * 图表颜色。每种颜色只做一件事：分类色区分系列，顺序色表示大小，发散色表示在基线哪一侧。
 * 状态（好 / 坏）不在这里，用语义状态色 `danger` / `warning` / `success`，并且总要配图标与文字。
 *
 * 取值要通过 `test/chart-palette.test.ts` 的检查（亮度区间、彩度下限、色觉障碍模拟下的相邻色差、对表面的对比度），
 * 不能凭肉眼挑选；规则见 docs/11 §4「图表配色」。
 */
export interface ChartColors {
  /**
   * 分类色 8 个，按固定顺序分配给系列：第 n 个系列永远是第 n 个颜色，筛掉某个系列不会让其他系列变色。
   * 顺序本身是色觉障碍友好的保证，不要调换。编译为 `color-chart-1` … `color-chart-8`。
   */
  readonly categorical: readonly [Oklch, Oklch, Oklch, Oklch, Oklch, Oklch, Oklch, Oklch]
  /**
   * 顺序色 7 级，从「小」到「大」排列（浅色模式由浅到深，深色模式由暗到亮），单一色相。
   * 用于热力图等连续数值；有序分类（漏斗阶段、档位）只用第 3–7 级（对表面对比度 ≥ 2:1）。
   * 编译为 `color-chart-seq-1` … `color-chart-seq-7`。
   */
  readonly sequential: readonly [Oklch, Oklch, Oklch, Oklch, Oklch, Oklch, Oklch]
  /**
   * 发散色 7 级：第 1 级是负向一端，第 4 级是中性灰（表示「没有偏离」），第 7 级是正向一端；两端色相冷暖相对。
   * 编译为 `color-chart-div-1` … `color-chart-div-7`。
   */
  readonly diverging: readonly [Oklch, Oklch, Oklch, Oklch, Oklch, Oklch, Oklch]
  /** 弱化色：「其他」、强调某个系列时其余系列、迷你图的历史部分。 */
  readonly muted: Oklch
  /** 网格线（1px 实线，不用虚线）。 */
  readonly grid: Oklch
  /** 坐标轴基线。 */
  readonly axis: Oklch
}

/** 主题必须提供的语义颜色（基础色；悬停/按下/禁用等状态色由 OKLCH 自动派生）。 */
export interface SemanticColors {
  /** 页面画布背景。 */
  readonly bgCanvas: Oklch
  /** 卡片、面板等表面。 */
  readonly bgSurface: Oklch
  /** 弹出层、浮层。 */
  readonly bgElevated: Oklch
  /** 凹陷区域：代码块、轨道等比表面更深的区域。 */
  readonly bgSunken: Oklch
  /** 中性填充：次要按钮、输入框、分段控件轨道（填充式控件，不描边）。 */
  readonly fill: Oklch
  /** 较深的中性填充：关闭状态的开关轨道、未选中的复选框。 */
  readonly fillStrong: Oklch
  /** 分隔线：只用于表格行、列表行之间。 */
  readonly border: Oklch
  /** 轮廓：描边按钮等少数需要轮廓的控件。 */
  readonly borderStrong: Oklch
  readonly textPrimary: Oklch
  readonly textSecondary: Oklch
  readonly textTertiary: Oklch
  /** 强调色上的文字。 */
  readonly textOnAccent: Oklch
  /** 唯一强调色：开关、下划线、焦点、选中指示。 */
  readonly accent: Oklch
  /**
   * 强调色实心底：主按钮、选中的复选框。深色模式下比 accent 暗，保证白字对比度 ≥ 4.5。
   */
  readonly accentFill: Oklch
  readonly danger: Oklch
  readonly warning: Oklch
  readonly success: Oklch
  readonly info: Oklch
  /** 阴影基色（含透明度）。 */
  readonly shadow: Oklch
  /** 作为文字或图标出现在画布上的强调色（比 accent 更易读）。 */
  readonly accentText: Oklch
  /**
   * 头像色调：蓝、绿、橙、紫、青五种，浅色模式为浅底深字、深色模式为暗底浅字，不描边。
   * Avatar 按名称稳定地取其中一种；编译为 `color-avatar-1-bg` / `color-avatar-1-text` … `color-avatar-5-*`。
   */
  readonly avatar: readonly [ToneColors, ToneColors, ToneColors, ToneColors, ToneColors]
  /** 图表颜色，见 {@link ChartColors}。 */
  readonly chart: ChartColors
}

/** 与颜色无关的语义令牌：字体、间距、圆角、动效、层级。主题可以覆盖。 */
export interface SemanticScale {
  readonly fontFamilyHeading: string
  readonly fontFamilyBody: string
  readonly fontFamilyAccent: string
  readonly fontFamilyMono: string
  readonly fontSize: Readonly<Record<keyof typeof fontSizeScale, number>>
  readonly fontWeight: Readonly<Record<keyof typeof fontWeightScale, number>>
  readonly lineHeightBody: number
  readonly lineHeightHeading: number
  readonly space: readonly number[]
  readonly radius: Readonly<Record<keyof typeof radiusScale, number>>
  readonly borderWidth: number
  readonly motionDurationFast: number
  readonly motionDurationBase: number
  readonly motionDurationSlow: number
  readonly motionEaseStandard: string
  /** 退出类过渡（元素离开）。 */
  readonly motionEaseExit: string
  /** 标题字重与字距。 */
  readonly fontWeightHeading: number
  readonly letterSpacingHeading: string
  /** 分组小标题的字距。 */
  readonly letterSpacingOverline: string
}

/**
 * 字体栈：只用 SIL OFL 开源可商用字体。
 * 西文 Inter（可变字体，随前端打包），中文优先思源黑体 / Noto Sans CJK，再回退到各平台系统字体；
 * 等宽字体 JetBrains Mono 用于编号、代码与接口名。不使用衬线与书法类字体。
 */
export const fontStacks = {
  heading:
    "'Inter Variable', 'Inter', 'Source Han Sans SC', 'Noto Sans CJK SC', 'Microsoft YaHei UI', 'PingFang SC', system-ui, sans-serif",
  body: "'Inter Variable', 'Inter', 'Source Han Sans SC', 'Noto Sans CJK SC', 'Microsoft YaHei UI', 'PingFang SC', system-ui, -apple-system, 'Segoe UI', sans-serif",
  accent:
    "'Inter Variable', 'Inter', 'Source Han Sans SC', 'Noto Sans CJK SC', 'Microsoft YaHei UI', 'PingFang SC', sans-serif",
  mono: "'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, 'Cascadia Mono', 'SFMono-Regular', Consolas, monospace",
} as const

/** 默认的非颜色语义令牌。 */
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
  fontWeightHeading: 600,
  letterSpacingHeading: '-0.01em',
  letterSpacingOverline: '0.02em',
}
