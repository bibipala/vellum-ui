/**
 * 派生颜色（组件库内部，不从入口导出）：由一种明暗模式的语义颜色算出的状态色、状态层、填充、光环、遮罩与链接色，
 * 唯一的一份取值。compile.ts 把它们写成 CSS 变量（formatOklch），antd.ts 把它们转成 antd 主题的十六进制（toHex）或
 * 引用对应的 CSS 变量；两处都不再自己计算颜色。
 *
 * 两处原来各算一份，其中几处已经不一致。为了外观不变，这几处同时返回两份当前的取值：不带前缀的是本库自己的 CSS
 * 用的，`antd` 前缀的只给 antd 主题用，各自的注释写明偏差在哪里。统一与否是外观上的变化，由维护者看过截图后决定。
 */
import {
  contrastRatio,
  deriveStates,
  type Oklch,
  oklch,
  type StateColors,
} from '../tokens/oklch.ts'
import type { ColorMode, SemanticColors } from '../tokens/semantic.ts'

/** 派生悬停、按下、禁用与浅底的交互色。 */
export const INTERACTIVE_COLORS = [
  'accent',
  'accentFill',
  'danger',
  'warning',
  'success',
  'info',
] as const satisfies readonly (keyof SemanticColors)[]

/** 另有作为文字使用的颜色（`-text`）的状态色。 */
export const STATUS_COLORS = ['danger', 'warning', 'success', 'info'] as const

export type InteractiveColor = (typeof INTERACTIVE_COLORS)[number]
export type StatusColor = (typeof STATUS_COLORS)[number]

/** 由一种明暗模式的语义颜色派生的全部颜色，见 deriveColors。 */
export interface DerivedColors {
  /** 交互色的悬停、按下、禁用与浅底（deriveStates）：CSS 变量 `color-<色>-hover` 等 */
  readonly states: Readonly<Record<InteractiveColor, StateColors>>
  /** 状态色作为文字使用时的颜色：在表面、画布与该状态的浅底上都达到 WCAG AA。CSS 变量 `color-<色>-text` */
  readonly text: Readonly<Record<StatusColor, Oklch>>
  /** 状态层的透明度：悬停、按下（CSS 变量 `state-*-opacity`，data-vl-state 的状态层用它叠加内容色） */
  readonly stateOpacity: { readonly hover: number; readonly press: number }
  /** 状态层的颜色：正文色按上面的透明度叠加（`color-fill-hover`、`color-fill-active`，antd 的 fill 与菜单、选项悬停） */
  readonly fillHover: Oklch
  readonly fillActive: Oklch
  /** 选中：强调色浅底，配 accent-text 文字（`color-fill-selected`，antd 的选中项底色） */
  readonly fillSelected: Oklch
  /** 最浅一档的中性填充（只有 antd 的 colorFillQuaternary 用） */
  readonly fillFaint: Oklch
  /** 次要按钮的半透明中性底色，见 controlFill；disabled 只有 antd 的按钮用 */
  readonly controlFill: {
    readonly rest: Oklch
    readonly hover: Oklch
    readonly active: Oklch
    readonly disabled: Oklch
  }
  /** 输入类控件的底色，见 fieldFill；disabled 只有 antd 的 colorBgContainerDisabled 用 */
  readonly fieldFill: { readonly rest: Oklch; readonly hover: Oklch; readonly disabled: Oklch }
  /** 描边式控件悬停时的描边色，见 borderStrongHover */
  readonly borderStrongHover: Oklch
  /** 滚动条滑块：静止与悬停 */
  readonly scrollbar: { readonly rest: Oklch; readonly hover: Oklch }
  /** 键盘焦点环（实色强调色）与输入框聚焦时外圈的半透明光环 */
  readonly focusRing: Oklch
  readonly focusHalo: Oklch
  /**
   * 错误、警告状态的输入框聚焦时的光环：默认的填充式输入框（base.css 用 color-mix 混入同样的比例，测试检查两处一致）。
   * 偏差：antd 的描边式（variant="outlined"）用 antdStatusHalo，透明度不同，深色模式的错误光环比强调色的光环还淡。
   */
  readonly statusHalo: { readonly danger: Oklch; readonly warning: Oklch }
  /** 偏差：antd 描边式输入框的错误、警告光环（errorActiveShadow、warningActiveShadow），见 statusHalo */
  readonly antdStatusHalo: { readonly danger: Oklch; readonly warning: Oklch }
  /** 文字链接（LinkButton、Markdown 的链接）的悬停与按下：浅色模式加深、深色模式提亮，都是「更醒目」 */
  readonly accentTextHover: Oklch
  readonly accentTextActive: Oklch
  /** 危险色调的文字链接的悬停与按下 */
  readonly dangerTextHover: Oklch
  /**
   * 偏差：antd 的链接（colorLinkHover、colorLinkActive）。悬停在浅色模式只加深 0.06（本库 0.07）；按下的方向与
   * accentTextActive 相反：浅色模式变浅、深色模式变暗
   */
  readonly antdLinkHover: Oklch
  readonly antdLinkActive: Oklch
  /**
   * 偏差：antd 主按钮的悬停与按下（colorPrimaryHover、colorPrimaryActive），两种模式都是悬停略亮 0.04、按下略暗 0.05；
   * 本库的 `color-accent-fill-hover` / `-active`（states.accentFill）是浅色 +0.06 / -0.08、深色 -0.06 / +0.08，
   * 深色模式方向相反
   */
  readonly antdPrimaryHover: Oklch
  readonly antdPrimaryActive: Oklch
  /** 对话框与抽屉的遮罩：带一点正文色色相的半透明暗色，比 antd 默认的 45% 纯黑轻，页面仍然可辨（`color-mask`） */
  readonly mask: Oklch
  /** 提示气泡的底色：两种模式下都是深底浅字，和页面内容明显区分（只有 antd 的 Tooltip 用） */
  readonly tooltipBg: Oklch
  /** 第四级文字（只有 antd 的 colorTextQuaternary 用） */
  readonly textQuaternary: Oklch
  /** 开关轨道悬停时的颜色（未选中的轨道是 fillStrong；只有 antd 的 Switch 用） */
  readonly switchTrackHover: Oklch
  /** 滑块轨道与选中段悬停时的颜色（只有 antd 的 Slider 用） */
  readonly sliderRailHover: Oklch
  readonly sliderTrackHover: Oklch
}

const clampL = (l: number) => Math.min(1, Math.max(0, l))
const withAlpha = (c: Oklch, alpha: number): Oklch => ({ ...c, alpha })
/** 只调亮度，彩度、色相与透明度不变 */
const shiftL = (c: Oklch, dl: number): Oklch => ({ ...c, l: clampL(c.l + dl) })

/**
 * 次要按钮（中性填充的 Button、soft 的 IconButton）的底色，静止、悬停、按下三档：正文色的半透明叠加。叠在画布、卡片
 * 与浮层上都比底色深（浅色模式）或亮（深色模式）一档；实色的中性填充在深色的浮层上（对话框、抽屉，L 0.235）与按钮
 * 底色（L 0.245）几乎没有差别，按钮像是没有底色。
 */
function controlFill(
  textPrimary: Oklch,
  mode: ColorMode,
  state: 'rest' | 'hover' | 'active',
): Oklch {
  const alpha =
    mode === 'dark'
      ? { rest: 0.08, hover: 0.12, active: 0.16 }
      : { rest: 0.065, hover: 0.095, active: 0.125 }
  return withAlpha(textPrimary, alpha[state])
}

/**
 * 输入类控件（输入框、选择器、日期）的底色，静止与悬停两档：正文色的半透明叠加，比次要按钮的底色（controlFill）浅
 * 一档。输入框不描边，是表面上的一道「凹槽」（另有一层极淡的内阴影，见 base.css），与凸起的按钮区分。
 */
function fieldFill(textPrimary: Oklch, mode: ColorMode, state: 'rest' | 'hover'): Oklch {
  const alpha = mode === 'dark' ? { rest: 0.06, hover: 0.09 } : { rest: 0.04, hover: 0.065 }
  return withAlpha(textPrimary, alpha[state])
}

/**
 * 作为文字使用的状态色：沿亮度方向调整，直到在表面、画布与该状态的浅底色上都达到 WCAG AA（4.5:1）。
 * 浅色主题中黄、绿等高亮度状态色直接当文字太浅，这里自动加深；深色主题反之提亮。
 */
function readable(color: Oklch, backgrounds: Oklch[], mode: ColorMode): Oklch {
  const step = mode === 'light' ? -0.01 : 0.01
  let c = color
  for (let i = 0; i < 60; i++) {
    if (Math.min(...backgrounds.map((b) => contrastRatio(c, b))) >= 4.6) return c
    c = { ...c, l: clampL(c.l + step) }
  }
  return c
}

/**
 * 派生一种明暗模式的全部颜色（见 DerivedColors）。`colors` 是该模式的语义颜色。纯函数，返回新对象。
 */
export function deriveColors(colors: SemanticColors, mode: ColorMode): DerivedColors {
  const dark = mode === 'dark'
  const ink = colors.textPrimary
  const states = Object.fromEntries(
    INTERACTIVE_COLORS.map((key) => [key, deriveStates(colors[key], mode)]),
  ) as Record<InteractiveColor, StateColors>
  const text = Object.fromEntries(
    STATUS_COLORS.map((key) => [
      key,
      readable(colors[key], [colors.bgSurface, colors.bgCanvas, states[key].subtle], mode),
    ]),
  ) as Record<StatusColor, Oklch>
  const stateOpacity = { hover: dark ? 0.08 : 0.06, press: dark ? 0.12 : 0.1 }
  // 文字链接的悬停步长：浅色模式加深、深色模式提亮；按下是它的 1.6 倍
  const linkStep = dark ? 0.06 : -0.07
  return {
    states,
    text,
    stateOpacity,
    fillHover: withAlpha(ink, stateOpacity.hover),
    fillActive: withAlpha(ink, stateOpacity.press),
    fillSelected: withAlpha(colors.accent, dark ? 0.18 : 0.1),
    fillFaint: withAlpha(ink, dark ? 0.04 : 0.03),
    controlFill: {
      rest: controlFill(ink, mode, 'rest'),
      hover: controlFill(ink, mode, 'hover'),
      active: controlFill(ink, mode, 'active'),
      // 禁用：比静止时更浅的底色，配禁用文字色
      disabled: withAlpha(ink, dark ? 0.05 : 0.04),
    },
    fieldFill: {
      rest: fieldFill(ink, mode, 'rest'),
      hover: fieldFill(ink, mode, 'hover'),
      // 禁用：比静止时明显更浅（静止 4% / 深色 6%）。两者只差一点时，空的禁用输入框与可用的看不出区别
      disabled: withAlpha(ink, dark ? 0.03 : 0.02),
    },
    // 透明度 ×1.8
    borderStrongHover: withAlpha(
      colors.borderStrong,
      Math.min(1, (colors.borderStrong.alpha ?? 1) * 1.8),
    ),
    // 比分隔线明显得多，横向滚动条一眼可见；悬停时加深
    scrollbar: {
      rest: withAlpha(ink, dark ? 0.3 : 0.26),
      hover: withAlpha(ink, dark ? 0.48 : 0.44),
    },
    focusRing: colors.accent,
    focusHalo: withAlpha(colors.accent, dark ? 0.26 : 0.16),
    statusHalo: { danger: withAlpha(colors.danger, 0.2), warning: withAlpha(colors.warning, 0.22) },
    antdStatusHalo: {
      danger: withAlpha(colors.danger, dark ? 0.3 : 0.18),
      warning: withAlpha(colors.warning, dark ? 0.3 : 0.18),
    },
    accentTextHover: shiftL(colors.accentText, linkStep),
    accentTextActive: shiftL(colors.accentText, linkStep * 1.6),
    dangerTextHover: shiftL(text.danger, linkStep),
    antdLinkHover: shiftL(colors.accentText, dark ? 0.06 : -0.06),
    antdLinkActive: shiftL(colors.accentText, dark ? -0.04 : 0.04),
    antdPrimaryHover: shiftL(colors.accentFill, 0.04),
    antdPrimaryActive: shiftL(colors.accentFill, -0.05),
    mask: dark ? oklch(0.1, 0.01, ink.h, 0.6) : oklch(0.2, 0.02, ink.h, 0.32),
    tooltipBg: dark ? oklch(0.32, 0.01, ink.h) : oklch(0.24, 0.012, ink.h),
    textQuaternary: withAlpha(colors.textTertiary, 0.7),
    switchTrackHover: shiftL(colors.fillStrong, dark ? 0.05 : -0.05),
    sliderRailHover: shiftL(colors.fillStrong, dark ? 0.03 : -0.025),
    sliderTrackHover: shiftL(colors.accent, dark ? 0.04 : -0.04),
  }
}
