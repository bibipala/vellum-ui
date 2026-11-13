/**
 * OKLCH 颜色工具。
 *
 * 所有颜色都以 OKLCH 定义：感知均匀，按亮度偏移生成的悬停/按下色在明暗主题下观感一致。
 * Ant Design 的主题算法只接受 sRGB 颜色，因此这里同时提供到 sRGB 十六进制的转换。
 */

/**
 * A color in OKLCH, the color space in which all colors of the library are defined: perceptually uniform, so colors
 * derived by changing the lightness look alike in light and dark mode. Create one with `oklch()`.
 * @zh OKLCH 颜色，组件库的全部颜色都用它定义：感知均匀，调整亮度派生的颜色在浅色与深色模式下观感一致。用 `oklch()`
 * 创建。
 */
export interface Oklch {
  /**
   * Lightness, 0 (black) to 1 (white).
   * @zh 亮度，0（黑）到 1（白）。
   */
  readonly l: number
  /**
   * Chroma, 0 (gray) to about 0.4 (the most saturated colors).
   * @zh 彩度，0（灰）到约 0.4（最饱和的颜色）。
   */
  readonly c: number
  /**
   * Hue angle in degrees, 0–360 (about 25 red, 150 green, 263 the blue of the default accent color).
   * @zh 色相角（度），0–360（约 25 为红、150 为绿、263 为默认强调色的蓝）。
   */
  readonly h: number
  /**
   * Opacity, 0–1; opaque when omitted.
   * @zh 不透明度，0–1；省略时不透明。
   */
  readonly alpha?: number
}

/**
 * Creates an OKLCH color: `l` lightness 0–1, `c` chroma 0–0.4, `h` hue in degrees, and an optional `alpha` 0–1.
 * Returns a plain `Oklch` object (without `alpha` when it is not given); the values are not checked or clamped
 * here (formatOklch and toHex clamp them).
 * @zh 创建 OKLCH 颜色：`l` 亮度 0–1，`c` 彩度 0–0.4，`h` 色相（度），可选的 `alpha` 不透明度 0–1。返回普通的 `Oklch`
 * 对象（没有传 `alpha` 时不含该字段）；这里不检查也不裁剪取值（formatOklch 与 toHex 会裁剪）。
 * @group Colors
 */
export function oklch(l: number, c: number, h: number, alpha?: number): Oklch {
  return alpha === undefined ? { l, c, h } : { l, c, h, alpha }
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const round = (v: number, digits: number) => Number(v.toFixed(digits))

/**
 * Formats a color as a CSS `oklch()` string, such as `oklch(57% 0.215 263)` or `oklch(25% 0.03 263 / 0.1)` with
 * transparency. Lightness and chroma are clamped to 0–1 and 0–0.4, the hue is normalized to 0–360, and `alpha` is
 * left out when the color is opaque. A gray (chroma 0) has the hue `none`, such as `oklch(100% 0 none)`: mixed
 * with another color in `color-mix(in oklch, …)`, it takes the hue of that color instead of pulling it toward 0
 * (red).
 * @zh 把颜色输出为 CSS 的 `oklch()` 字符串，如 `oklch(57% 0.215 263)`，有透明度时为 `oklch(25% 0.03 263 / 0.1)`。
 * 亮度与彩度分别裁剪到 0–1 与 0–0.4，色相规范到 0–360，不透明时不输出 `alpha`。灰色（彩度为 0）的色相输出为
 * `none`，如 `oklch(100% 0 none)`：在 `color-mix(in oklch, …)` 中与另一种颜色混合时取那种颜色的色相，而不会把
 * 色相拉向 0（红色）。
 * @group Colors
 */
export function formatOklch(color: Oklch): string {
  const l = round(clamp(color.l, 0, 1) * 100, 2)
  const c = round(clamp(color.c, 0, 0.4), 4)
  const h = c === 0 ? 'none' : round(((color.h % 360) + 360) % 360, 2)
  const a = color.alpha === undefined || color.alpha >= 1 ? '' : ` / ${round(color.alpha, 3)}`
  return `oklch(${l}% ${c} ${h}${a})`
}

/**
 * The interaction states derived from a base color by deriveStates.
 * @zh deriveStates 由基础色派生的交互状态色。
 */
export interface StateColors {
  /**
   * The base color itself.
   * @zh 基础色本身。
   */
  readonly base: Oklch
  /**
   * Hover color.
   * @zh 悬停色。
   */
  readonly hover: Oklch
  /**
   * Pressed (active) color.
   * @zh 按下色。
   */
  readonly active: Oklch
  /**
   * Disabled color: less chroma, 45% opacity.
   * @zh 禁用色：彩度降低，不透明度 45%。
   */
  readonly disabled: Oklch
  /**
   * Subtle background: low chroma and close to the background, such as for selected rows and tags.
   * @zh 浅底：低饱和、接近背景的底色，如选中行、标签的底色。
   */
  readonly subtle: Oklch
}

/**
 * Derives the hover, active, disabled and subtle colors from a base color, as the theme compiler does for the accent
 * and status colors. `mode` is the color mode the color is used in: in light mode hover is lighter (+0.06) and
 * active darker (-0.08); in dark mode the other way round, because on a dark background lighter means closer to
 * the user. Disabled keeps 30% of the chroma at 45% opacity; subtle has a fixed lightness (0.95 in light mode, 0.3 in
 * dark mode) and 25% of the chroma. Returns the five colors as StateColors.
 * @zh 由基础色派生悬停、按下、禁用与浅底色，与编译主题时对强调色、状态色的处理相同。`mode` 是颜色所在的明暗模式：
 * 浅色模式中悬停变亮（+0.06）、按下变暗（-0.08）；深色模式反之，因为深色背景上「更亮」才意味着更靠近用户。禁用色
 * 保留 30% 的彩度、不透明度 45%；浅底色的亮度固定（浅色模式 0.95、深色模式 0.3），彩度为 25%。返回 StateColors
 * 中的五种颜色。
 * @group Colors
 */
export function deriveStates(base: Oklch, mode: 'light' | 'dark'): StateColors {
  const dir = mode === 'light' ? 1 : -1
  const shift = (dl: number, cScale = 1): Oklch =>
    oklch(clamp(base.l + dl, 0, 1), clamp(base.c * cScale, 0, 0.4), base.h, base.alpha)
  return {
    base,
    hover: shift(0.06 * dir),
    active: shift(-0.08 * dir),
    disabled: oklch(base.l, base.c * 0.3, base.h, 0.45),
    subtle: oklch(mode === 'light' ? 0.95 : 0.3, base.c * 0.25, base.h),
  }
}

/** 0–1 的 sRGB 分量（未裁剪前可能越界）。 */
function oklchToLinearSrgb({ l, c, h }: Oklch): [number, number, number] {
  const hr = (h * Math.PI) / 180
  const a = c * Math.cos(hr)
  const b = c * Math.sin(hr)
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b
  const s_ = l - 0.0894841775 * a - 1.291485548 * b
  const L = l_ ** 3
  const M = m_ ** 3
  const S = s_ ** 3
  return [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ]
}

const gammaEncode = (v: number) =>
  v <= 0.0031308 ? 12.92 * v : 1.055 * Math.abs(v) ** (1 / 2.4) - 0.055

/**
 * Converts a color to an sRGB hex string, `#rrggbb`, or `#rrggbbaa` when it is transparent. Colors outside the sRGB
 * gamut are clipped per channel. Use it where OKLCH is not accepted, such as for libraries that only take hex
 * colors; the theme uses it to configure the wrapped Ant Design components.
 * @zh 把颜色转换为 sRGB 十六进制字符串 `#rrggbb`，有透明度时为 `#rrggbbaa`。超出 sRGB 色域的颜色逐个通道裁剪。用于
 * 不接受 OKLCH 的地方，如只接受十六进制颜色的库；主题用它配置封装的 Ant Design 组件。
 * @group Colors
 */
export function toHex(color: Oklch): string {
  const channels = oklchToLinearSrgb(color).map((v) =>
    Math.round(clamp(gammaEncode(clamp(v, 0, 1)), 0, 1) * 255),
  )
  if (color.alpha !== undefined && color.alpha < 1) {
    channels.push(Math.round(clamp(color.alpha, 0, 1) * 255))
  }
  return `#${channels.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

/**
 * The relative luminance of a color as defined by WCAG, from 0 (black) to 1 (white), computed in sRGB (colors outside
 * the gamut are clipped). Transparency is ignored.
 * @zh WCAG 定义的相对亮度，从 0（黑）到 1（白），在 sRGB 中计算（超出色域的颜色先裁剪）。忽略透明度。
 * @group Colors
 */
export function relativeLuminance(color: Oklch): number {
  const [r, g, b] = oklchToLinearSrgb(color).map((v) => clamp(v, 0, 1)) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * The WCAG contrast ratio between two colors, from 1 (no contrast) to 21 (black on white); the order of the colors
 * does not matter. Transparency is ignored, so pass opaque colors. WCAG AA asks for 4.5 for body text and 3 for
 * large text and graphical objects.
 * @zh 两种颜色之间的 WCAG 对比度，从 1（没有对比）到 21（白底黑字）；与参数的先后无关。忽略透明度，请传入不透明的
 * 颜色。WCAG AA 要求正文达到 4.5，大号文字与图形对象达到 3。
 * @group Colors
 */
export function contrastRatio(a: Oklch, b: Oklch): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}
