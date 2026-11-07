/**
 * 主题编译：把三层令牌编译成 CSS 变量（`--vl-…`）。纯函数，无需构建步骤，可在浏览器或 Node 中运行。
 */
import type { ThemeDefinition } from '../themes/index.ts'
import { componentTokens, type Density } from '../tokens/component.ts'
import { contrastRatio, deriveStates, formatOklch, type Oklch } from '../tokens/oklch.ts'
import { primitiveColors } from '../tokens/primitive.ts'
import type { ColorMode, SemanticColors, SemanticScale } from '../tokens/semantic.ts'
import { viewerStageTokens } from '../tokens/viewer-stage.ts'

/**
 * Prefix of every CSS variable of the library, `'--vl-'`: the token `color-accent` is the CSS variable
 * `--vl-color-accent`.
 * @zh 组件库全部 CSS 变量的前缀 `'--vl-'`：令牌 `color-accent` 即 CSS 变量 `--vl-color-accent`。
 * @group Theme
 */
export const CSS_VAR_PREFIX = '--vl-'

/**
 * Compiled CSS variables, as returned by compileTheme: full variable names (with the `--vl-` prefix) → values,
 * such as `'--vl-color-accent': 'oklch(57% 0.215 263)'`.
 * @zh 编译出的 CSS 变量（compileTheme 的返回值）：完整的变量名（含 `--vl-` 前缀）→ 值，如
 * `'--vl-color-accent': 'oklch(57% 0.215 263)'`。
 */
export type CssVars = Readonly<Record<string, string>>

/**
 * Changes to apply to a theme with extendTheme, such as a brand accent color. Every field is optional; what is not
 * given stays as in the base theme.
 * @zh 用 extendTheme 叠加到主题上的修改，如品牌强调色。每个字段都可以省略，省略的部分保持基础主题的取值。
 */
export interface ThemeOverrides {
  /**
   * ID of the new theme, written to `data-vl-theme` on `<html>`; the ID of the base theme by default.
   * @zh 新主题的 ID，写到 `<html>` 的 `data-vl-theme` 上；默认沿用基础主题的 ID。
   */
  readonly id?: string
  /**
   * Text key of the display name of the new theme, looked up in the text table (add the text with ThemeProvider's
   * `messages`); that of the base theme by default.
   * @zh 新主题显示名称的文本键，在文本表中查找（用 ThemeProvider 的 `messages` 补上文字）；默认沿用基础主题的。
   */
  readonly nameKey?: string
  /**
   * Semantic colors for both color modes, such as a brand accent color. To change the accent color, set `accent`,
   * `accentFill` and `accentText` together.
   * @zh 两种明暗模式共用的语义颜色，如品牌强调色。要改强调色时，同时设置 `accent`、`accentFill` 与 `accentText`。
   */
  readonly colors?: Partial<SemanticColors>
  /**
   * Semantic colors for light mode only; applied after `colors`.
   * @zh 只用于浅色模式的语义颜色；在 `colors` 之后叠加。
   */
  readonly light?: Partial<SemanticColors>
  /**
   * Semantic colors for dark mode only; applied after `colors`.
   * @zh 只用于深色模式的语义颜色；在 `colors` 之后叠加。
   */
  readonly dark?: Partial<SemanticColors>
  /**
   * Non-color semantic tokens to replace (fonts, sizes, spacing, radius, motion). Each field given replaces that
   * field as a whole, such as the whole `radius` object.
   * @zh 要替换的非颜色语义令牌（字体、字号、间距、圆角、动效）。给出的字段整体替换，如整个 `radius` 对象。
   */
  readonly scale?: Partial<SemanticScale>
  /**
   * Compiled tokens to override directly, by name without the `--vl-` prefix (such as `color-accent` or
   * `viewer-bg-dark`), in both modes. Component tokens (control heights and other sizes that depend on the density)
   * are not affected by overrides.
   * @zh 直接覆盖编译后的令牌，键是不含 `--vl-` 前缀的名称（如 `color-accent`、`viewer-bg-dark`），两种模式都生效。
   * 组件令牌（控件高度等随密度变化的尺寸）不受覆盖影响。
   */
  readonly tokens?: Readonly<Record<string, string>>
}

/**
 * A theme definition created by extendTheme: a ThemeDefinition plus overrides of compiled tokens. Accepted wherever
 * a ThemeDefinition is (ThemeProvider's `theme`, resolveTheme, extendTheme).
 * @zh extendTheme 生成的主题定义：ThemeDefinition 加上对编译后令牌的覆盖。凡是接受 ThemeDefinition 的地方都接受它
 * （ThemeProvider 的 `theme`、resolveTheme、extendTheme）。
 */
export interface ExtendedThemeDefinition extends ThemeDefinition {
  /**
   * Compiled tokens to override, by name without the `--vl-` prefix: the `tokens` of all extendTheme calls, later
   * ones winning.
   * @zh 要覆盖的编译后令牌，键不含 `--vl-` 前缀：各次 extendTheme 的 `tokens` 合并而成，后叠加的优先。
   */
  readonly tokenOverrides: Readonly<Record<string, string>>
}

/**
 * A theme resolved for one color mode by resolveTheme, the input of compileTheme. `useTheme().theme` is the current
 * one.
 * @zh 由 resolveTheme 按一种明暗模式解析出的主题，是 compileTheme 的输入。`useTheme().theme` 是当前的主题。
 */
export interface Theme {
  /**
   * ID of the theme definition, such as `default`.
   * @zh 主题定义的 ID，如 `default`。
   */
  readonly id: string
  /**
   * Text key of the display name of the theme.
   * @zh 主题显示名称的文本键。
   */
  readonly nameKey: string
  /**
   * The color mode the theme was resolved for.
   * @zh 解析主题时使用的明暗模式。
   */
  readonly mode: ColorMode
  /**
   * The semantic colors of that mode.
   * @zh 该模式的语义颜色。
   */
  readonly colors: SemanticColors
  /**
   * The non-color semantic tokens.
   * @zh 非颜色的语义令牌。
   */
  readonly scale: SemanticScale
  /**
   * Compiled tokens to override, by name without the `--vl-` prefix; empty for a theme that was not extended.
   * @zh 要覆盖的编译后令牌，键不含 `--vl-` 前缀；没有经过 extendTheme 的主题为空对象。
   */
  readonly tokenOverrides: Readonly<Record<string, string>>
}

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)

const overridesOf = (def: ThemeDefinition | ExtendedThemeDefinition) =>
  'tokenOverrides' in def ? def.tokenOverrides : {}

/**
 * Resolves a theme definition for one color mode: takes its `light` or `dark` colors and keeps the scale and the
 * token overrides. `def` is a ThemeDefinition or the result of extendTheme; `mode` is `light` or `dark` (resolve a
 * `system` preference yourself first). Returns a Theme, the input of compileTheme. ThemeProvider does this itself;
 * call it to compile CSS outside React, such as at build time or in tests.
 * @zh 按一种明暗模式解析主题定义：取它的 `light` 或 `dark` 颜色，保留非颜色令牌与令牌覆盖。`def` 是 ThemeDefinition
 * 或 extendTheme 的结果；`mode` 是 `light` 或 `dark`（`system` 偏好要先自行解析）。返回 Theme，作为 compileTheme 的
 * 输入。ThemeProvider 会自己完成这一步；在 React 之外编译 CSS 时调用，如构建时或测试中。
 * @group Theme
 */
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
 * Creates a new theme definition from an existing one, such as the built-in `defaultTheme` with a brand accent
 * color. `overrides.colors` applies to both color modes, `light` and `dark` to one mode (after `colors`), `scale`
 * replaces fields of the non-color tokens, and `tokens` overrides compiled tokens by name. Returns an
 * ExtendedThemeDefinition to pass to ThemeProvider's `theme`; `base` is not changed. It can be applied to its own
 * result: later overrides win, and the token overrides of `base` are kept.
 * @zh 在已有的主题定义上生成新的主题定义，如在内置的 `defaultTheme` 上换成品牌强调色。`overrides.colors` 用于两种
 * 明暗模式，`light`、`dark` 只用于一种模式（在 `colors` 之后叠加），`scale` 替换非颜色令牌的字段，`tokens` 按名称
 * 覆盖编译后的令牌。返回 ExtendedThemeDefinition，传给 ThemeProvider 的 `theme`；不修改 `base`。可以在它的结果上
 * 再次调用：后叠加的覆盖优先，`base` 的令牌覆盖保留。
 * @group Theme
 * @example
 * ```ts
 * const brandTheme = extendTheme(defaultTheme, {
 *   id: 'brand',
 *   colors: { accent: oklch(0.55, 0.17, 150), accentFill: oklch(0.55, 0.17, 150) },
 *   dark: { accent: oklch(0.7, 0.15, 150) },
 *   tokens: { 'radius-lg': '10px' },
 * })
 * ```
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
  Object.assign(out, meterTokens(colors, mode))
  return out
}

/** 有量表颜色的色调（Progress 的 `tone`）。 */
export const METER_TONES = ['accent', 'success', 'warning', 'danger'] as const

/** 填充与轨道之间的对比度（WCAG 1.4.11 图形对象 3:1）。 */
const METER_FILL_TRACK_CONTRAST = 3
/** 轨道与表面之间至少的对比度：轨道要看得出来，量表的全长（上限）才读得出。 */
const METER_TRACK_VISIBLE = 1.25

/**
 * 量表（Progress）的颜色，按 dataviz 的 meter 规则：填充表示程度（强调色 → 警告 → 危险，完成为成功色）；未填充的
 * 轨道是同一色阶上更靠近背景的一级（蓝底上的蓝，不是中性灰），整条都读得出状态。编译为 `color-meter-<色调>` 与
 * `color-meter-<色调>-track`。
 *
 * - 填充对表面与画布至少 3 × 1.25 = 3.75:1，轨道才能与填充相差 3:1、与表面相差 1.25:1；不够时沿亮度方向加深
 *   （浅色模式）或提亮（深色模式），如浅色模式的警告色；
 * - 轨道从填充出发向表面调整亮度，彩度随之降低（像色阶中更浅的一级），取第一个与填充达到 3:1 的颜色。
 *   深色模式中「更靠近背景」是更暗：比填充更亮的轨道会比填充还醒目。
 */
function meterTokens(colors: SemanticColors, mode: Theme['mode']): Record<string, string> {
  const out: Record<string, string> = {}
  const backgrounds = [colors.bgSurface, colors.bgCanvas]
  const awayFromSurface = mode === 'light' ? -0.01 : 0.01
  const clampL = (l: number) => Math.min(1, Math.max(0, l))
  for (const tone of METER_TONES) {
    let fill = colors[tone]
    const enough = (c: Oklch) =>
      Math.min(...backgrounds.map((b) => contrastRatio(c, b))) >=
      METER_FILL_TRACK_CONTRAST * METER_TRACK_VISIBLE
    for (let i = 0; i < 100 && !enough(fill); i++)
      fill = { ...fill, l: clampL(fill.l + awayFromSurface) }
    let track = fill
    for (let i = 1; i <= 100; i++) {
      const t = i / 100
      track = {
        l: clampL(fill.l + (colors.bgSurface.l - fill.l) * t),
        c: fill.c * (1 - 0.75 * t),
        h: fill.h,
      }
      if (contrastRatio(fill, track) >= METER_FILL_TRACK_CONTRAST) break
    }
    out[`color-meter-${tone}`] = formatOklch(fill)
    out[`color-meter-${tone}-track`] = formatOklch(track)
  }
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

/**
 * Options of compileTheme.
 * @zh compileTheme 的选项。
 */
export interface CompileOptions {
  /**
   * Density of the component tokens (control heights, table cell padding and other sizes).
   * @zh 组件令牌（控件高度、表格单元格内边距等尺寸）使用的密度。
   * @default 'comfortable'
   */
  readonly density?: Density
}

/**
 * Compiles a resolved theme into CSS variables. In order: the primitive tokens (such as `--vl-neutral-50`), the
 * semantic tokens with their derived states (`-hover`, `-active`, `-disabled`, `-subtle`, and readable `-text`
 * variants of the status colors), the viewer stage tokens, the theme's token overrides, and last the component
 * tokens for `options.density` (`comfortable` by default), which overrides cannot change. Returns an object of
 * variable names (with the `--vl-` prefix) → values; turn it into a style sheet with toCssText. A pure function: it
 * runs in the browser or in Node.
 * @zh 把解析后的主题编译为 CSS 变量。依次为：原始令牌（如 `--vl-neutral-50`）、语义令牌及其派生状态（`-hover`、
 * `-active`、`-disabled`、`-subtle`，以及状态色用作文字时的 `-text`）、看图背景令牌、主题的令牌覆盖，最后是按
 * `options.density`（默认 `comfortable`）生成的组件令牌，覆盖改变不了它们。返回变量名（含 `--vl-` 前缀）→ 值的对象；
 * 用 toCssText 转成样式文本。纯函数，可以在浏览器或 Node 中运行。
 * @group Theme
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

/**
 * Turns compiled CSS variables into style sheet text, such as `:root{--vl-color-accent:oklch(…);…}`. `vars` is
 * the result of compileTheme; `selector` is the selector of the rule, `:root` by default (pass another one, such as
 * `[data-brand]`, to apply a theme to part of the page). Returns one line of CSS for a `<style>` element or a file.
 * @zh 把编译出的 CSS 变量转成样式文本，如 `:root{--vl-color-accent:oklch(…);…}`。`vars` 是 compileTheme 的结果；
 * `selector` 是规则的选择器，默认 `:root`（传其他选择器，如 `[data-brand]`，可以只在页面的一部分使用某个主题）。
 * 返回一行 CSS，可以放进 `<style>` 元素或文件。
 * @group Theme
 */
export function toCssText(vars: CssVars, selector = ':root'): string {
  const body = Object.entries(vars)
    .map(([k, val]) => `${k}:${val};`)
    .join('')
  return `${selector}{${body}}`
}

/**
 * Returns the CSS expression that references a token: `cssVar('color-accent')` returns
 * `'var(--vl-color-accent)'`. `token` is the token name without the `--vl-` prefix; the name is not checked. Use it
 * where code needs a CSS value that follows the theme, such as the color of an SVG drawn in code.
 * @zh 返回引用某个令牌的 CSS 表达式：`cssVar('color-accent')` 返回 `'var(--vl-color-accent)'`。`token` 是不含 `--vl-`
 * 前缀的令牌名，不检查名称是否存在。用于代码中需要随主题变化的 CSS 值，如代码绘制的 SVG 的颜色。
 * @group Theme
 */
export function cssVar(token: string): string {
  return `var(${CSS_VAR_PREFIX}${token})`
}
