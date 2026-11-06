/**
 * 主题编译：把三层令牌编译成 CSS 变量（`--vl-…`）。纯函数，无需构建步骤，可在浏览器或 Node 中运行。
 */
import type { ThemeDefinition } from '../themes/index.ts'
import { componentTokens, type Density } from '../tokens/component.ts'
import { contrastRatio, deriveStates, formatOklch, type Oklch } from '../tokens/oklch.ts'
import { primitiveColors } from '../tokens/primitive.ts'
import type { ColorMode, SemanticColors, SemanticScale } from '../tokens/semantic.ts'
import { viewerStageTokens } from '../tokens/viewer-stage.ts'

/** CSS 变量前缀。 */
export const CSS_VAR_PREFIX = '--vl-'

/** 编译结果：完整的 CSS 变量名 → 值。 */
export type CssVars = Readonly<Record<string, string>>

/** 主题覆盖（品牌色等）。 */
export interface ThemeOverrides {
  readonly id?: string
  readonly nameKey?: string
  /** 同时覆盖浅色与深色两套颜色（例如品牌强调色）。 */
  readonly colors?: Partial<SemanticColors>
  /** 只覆盖浅色模式的颜色。 */
  readonly light?: Partial<SemanticColors>
  /** 只覆盖深色模式的颜色。 */
  readonly dark?: Partial<SemanticColors>
  readonly scale?: Partial<SemanticScale>
  /**
   * 直接覆盖编译后的令牌（不含 `--vl-` 前缀的键，如 `color-accent`、`viewer-bg-dark`），两种模式都生效。
   * 组件令牌（控件高度等，随密度变化）不受覆盖影响。
   */
  readonly tokens?: Readonly<Record<string, string>>
}

/** 已扩展的主题定义：主题定义 + 令牌级覆盖。 */
export interface ExtendedThemeDefinition extends ThemeDefinition {
  readonly tokenOverrides: Readonly<Record<string, string>>
}

/** 按明暗模式解析后的主题：编译 CSS 变量与 antd 主题都以它为输入。 */
export interface Theme {
  readonly id: string
  readonly nameKey: string
  readonly mode: ColorMode
  readonly colors: SemanticColors
  readonly scale: SemanticScale
  readonly tokenOverrides: Readonly<Record<string, string>>
}

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)

const overridesOf = (def: ThemeDefinition | ExtendedThemeDefinition) =>
  'tokenOverrides' in def ? def.tokenOverrides : {}

/** 按明暗模式解析主题定义。 */
export function resolveTheme(
  def: ThemeDefinition | ExtendedThemeDefinition,
  mode: ColorMode,
): Theme {
  return {
    id: def.id,
    nameKey: def.nameKey,
    mode,
    colors: mode === 'dark' ? def.dark : def.light,
    scale: def.scale,
    tokenOverrides: overridesOf(def),
  }
}

/**
 * 在已有主题定义上叠加覆盖，生成新的主题定义。后叠加的覆盖优先。
 */
export function extendTheme(
  base: ThemeDefinition | ExtendedThemeDefinition,
  overrides: ThemeOverrides,
): ExtendedThemeDefinition {
  return {
    id: overrides.id ?? base.id,
    nameKey: overrides.nameKey ?? base.nameKey,
    light: { ...base.light, ...overrides.colors, ...overrides.light },
    dark: { ...base.dark, ...overrides.colors, ...overrides.dark },
    scale: { ...base.scale, ...overrides.scale },
    tokenOverrides: { ...overridesOf(base), ...overrides.tokens },
  }
}

/**
 * 作为文字使用的状态色：沿亮度方向调整，直到在表面、画布与该状态的浅底色上都达到 WCAG AA（4.5:1）。
 * 浅色主题中黄、绿等高亮度状态色直接当文字太浅，这里自动加深；深色主题反之提亮。
 */
function readable(color: Oklch, backgrounds: Oklch[], mode: Theme['mode']): Oklch {
  const step = mode === 'light' ? -0.01 : 0.01
  let c = color
  for (let i = 0; i < 60; i++) {
    if (Math.min(...backgrounds.map((b) => contrastRatio(c, b))) >= 4.6) return c
    c = { ...c, l: Math.min(1, Math.max(0, c.l + step)) }
  }
  return c
}

function colorTokens(colors: SemanticColors, mode: Theme['mode']): Record<string, string> {
  const out: Record<string, string> = {}
  const interactive = new Set<keyof SemanticColors>([
    'accent',
    'accentFill',
    'danger',
    'warning',
    'success',
    'info',
  ])
  const { avatar, chart, ...single } = colors
  // 作为文字使用的状态色（color-*-text），文字链接按钮的危险色调还要在它的基础上派生悬停色
  const textColors = new Map<keyof SemanticColors, Oklch>()
  for (const [key, color] of Object.entries(single) as [keyof SemanticColors, Oklch][]) {
    const name = `color-${kebab(key)}`
    out[name] = formatOklch(color)
    if (interactive.has(key)) {
      const s = deriveStates(color, mode)
      out[`${name}-hover`] = formatOklch(s.hover)
      out[`${name}-active`] = formatOklch(s.active)
      out[`${name}-disabled`] = formatOklch(s.disabled)
      out[`${name}-subtle`] = formatOklch(s.subtle)
      if (key !== 'accent' && key !== 'accentFill') {
        const text = readable(color, [colors.bgSurface, colors.bgCanvas, s.subtle], mode)
        textColors.set(key, text)
        out[`${name}-text`] = formatOklch(text)
      }
    }
  }
  const dark = mode === 'dark'
  // 焦点环用实色强调色；输入框聚焦时外圈的半透明光环
  out['color-focus-ring'] = formatOklch(colors.accent)
  out['color-focus-halo'] = formatOklch({ ...colors.accent, alpha: dark ? 0.3 : 0.2 })
  // 状态层：悬停、按下统一用「内容色 + 固定透明度」叠加
  const hover = dark ? 0.08 : 0.06
  const press = dark ? 0.12 : 0.1
  out['state-hover-opacity'] = String(hover)
  out['state-press-opacity'] = String(press)
  const ink = colors.textPrimary
  out['color-fill-hover'] = formatOklch({ ...ink, alpha: hover })
  out['color-fill-active'] = formatOklch({ ...ink, alpha: press })
  // 选中：强调色浅底（配 accent-text 文字）
  out['color-fill-selected'] = formatOklch({ ...colors.accent, alpha: dark ? 0.18 : 0.1 })
  // 文字链接按钮（LinkButton）的悬停与按下：浅色模式加深、深色模式提亮，都是「更醒目」
  const linkStep = dark ? 0.06 : -0.07
  const shift = (c: Oklch, dl: number): Oklch => ({ ...c, l: Math.min(1, Math.max(0, c.l + dl)) })
  out['color-accent-text-hover'] = formatOklch(shift(colors.accentText, linkStep))
  out['color-accent-text-active'] = formatOklch(shift(colors.accentText, linkStep * 1.6))
  const dangerText = textColors.get('danger') ?? colors.danger
  out['color-danger-text-hover'] = formatOklch(shift(dangerText, linkStep))
  // 头像色调：编号从 1 开始
  avatar.forEach((tone, i) => {
    out[`color-avatar-${i + 1}-bg`] = formatOklch(tone.bg)
    out[`color-avatar-${i + 1}-text`] = formatOklch(tone.text)
  })
  Object.assign(out, chartTokens(chart))
  return out
}

/**
 * 写在分类色色块里面的文字（如分段条上的占比）：白色或近黑色，两种模式用同样的两种颜色，按色块亮度选择。
 * 阈值 0.74 与 APCA 的判断一致：浅色模式只有黄色块用近黑色，深色模式全部用白色。
 */
const LABEL_ON_FILL_DARK_FROM = 0.74
const LABEL_ON_FILL_LIGHT = formatOklch({ l: 1, c: 0, h: 0 })
const LABEL_ON_FILL_DARK = formatOklch({ l: 0.21, c: 0.01, h: 263 })

function chartTokens(chart: SemanticColors['chart']): Record<string, string> {
  const out: Record<string, string> = {}
  chart.categorical.forEach((c, i) => {
    out[`color-chart-${i + 1}`] = formatOklch(c)
    out[`color-chart-${i + 1}-on`] =
      c.l >= LABEL_ON_FILL_DARK_FROM ? LABEL_ON_FILL_DARK : LABEL_ON_FILL_LIGHT
  })
  chart.sequential.forEach((c, i) => {
    out[`color-chart-seq-${i + 1}`] = formatOklch(c)
  })
  chart.diverging.forEach((c, i) => {
    out[`color-chart-div-${i + 1}`] = formatOklch(c)
  })
  out['color-chart-muted'] = formatOklch(chart.muted)
  // 「其他」色块（弱化色）里的文字：与分类色块同一规则
  out['color-chart-muted-on'] =
    chart.muted.l >= LABEL_ON_FILL_DARK_FROM ? LABEL_ON_FILL_DARK : LABEL_ON_FILL_LIGHT
  out['color-chart-grid'] = formatOklch(chart.grid)
  out['color-chart-axis'] = formatOklch(chart.axis)
  return out
}

function scaleTokens(
  scale: SemanticScale,
  shadow: Oklch,
  mode: Theme['mode'],
): Record<string, string> {
  const out: Record<string, string> = {
    'font-family-heading': scale.fontFamilyHeading,
    'font-family-body': scale.fontFamilyBody,
    'font-family-accent': scale.fontFamilyAccent,
    'font-family-mono': scale.fontFamilyMono,
    'line-height-body': String(scale.lineHeightBody),
    'line-height-heading': String(scale.lineHeightHeading),
    'border-width': `${scale.borderWidth}px`,
    'motion-duration-instant': '0ms',
    'motion-duration-fast': `${scale.motionDurationFast}ms`,
    'motion-duration-base': `${scale.motionDurationBase}ms`,
    'motion-duration-slow': `${scale.motionDurationSlow}ms`,
    'motion-duration-loop': '1000ms',
    // 加载态延迟出现（防闪）：不是动效，「减少动态效果」打开时也保留
    'motion-delay-loading': '200ms',
    'motion-ease-standard': scale.motionEaseStandard,
    'motion-ease-exit': scale.motionEaseExit,
    'font-weight-heading': String(scale.fontWeightHeading),
    'letter-spacing-heading': scale.letterSpacingHeading,
    'letter-spacing-overline': scale.letterSpacingOverline,
    'z-overlay': '1000',
    'z-viewer': '1100',
    // 消息条在对话框、弹层与看图之上（与 antd 消息条原来的层级一致：弹层基准 + 容器最大偏移 + 10）
    'z-message': '2010',
  }
  for (const [k, px] of Object.entries(scale.fontSize)) out[`font-size-${k}`] = `${px}px`
  for (const [k, w] of Object.entries(scale.fontWeight)) out[`font-weight-${k}`] = String(w)
  for (const [k, px] of Object.entries(scale.radius)) out[`radius-${k}`] = `${px}px`
  scale.space.forEach((px, i) => {
    out[`space-${i}`] = `${px}px`
  })
  // 阴影三档：卡片的贴近阴影（深色模式无）、菜单与消息条的浮起、对话框的弹出。
  // 深色模式下浮层用 1px 半透明白色轮廓作为边界
  const a = shadow.alpha ?? 0.1
  const sc = (k: number) => formatOklch({ ...shadow, alpha: Math.min(1, a * k) })
  const dark = mode === 'dark'
  const outline = dark ? ', 0 0 0 1px oklch(100% 0 0 / 0.07)' : ''
  out['shadow-near'] = dark ? 'none' : `0 1px 2px ${sc(0.4)}`
  out['shadow-float'] =
    `0 10px 28px -8px ${sc(dark ? 1 : 1.8)}, 0 2px 6px ${sc(dark ? 0.5 : 0.5)}${outline}`
  out['shadow-pop'] = `0 24px 56px -12px ${sc(dark ? 1.2 : 2.6)}, 0 4px 12px ${sc(0.6)}${outline}`
  return out
}

/** 编译选项。 */
export interface CompileOptions {
  readonly density?: Density
}

/**
 * 把主题编译为 CSS 变量表（键含 `--vl-` 前缀）。
 * 顺序：原始令牌 → 语义令牌 → 看图背景的默认值 → 令牌级覆盖 → 组件令牌（最后写入，不受覆盖影响）。
 */
export function compileTheme(theme: Theme, options: CompileOptions = {}): CssVars {
  const t = theme
  const raw: Record<string, string> = {}
  for (const [palette, steps] of Object.entries(primitiveColors)) {
    for (const [step, color] of Object.entries(steps))
      raw[`${palette}-${step}`] = formatOklch(color)
  }
  Object.assign(
    raw,
    colorTokens(t.colors, t.mode),
    scaleTokens(t.scale, t.colors.shadow, t.mode),
    viewerStageTokens,
    t.tokenOverrides,
    componentTokens(options.density ?? 'comfortable'),
  )
  const out: Record<string, string> = {}
  for (const [k, val] of Object.entries(raw)) out[`${CSS_VAR_PREFIX}${k}`] = val
  return out
}

/** 把 CSS 变量表输出为样式文本，如 `:root{--vl-…:…}`。 */
export function toCssText(vars: CssVars, selector = ':root'): string {
  const body = Object.entries(vars)
    .map(([k, val]) => `${k}:${val};`)
    .join('')
  return `${selector}{${body}}`
}

/** 引用某个令牌的 CSS 表达式，如 `cssVar('color-accent')` → `var(--vl-color-accent)`。 */
export function cssVar(token: string): string {
  return `var(${CSS_VAR_PREFIX}${token})`
}
