/**
 * OKLCH 颜色工具。
 *
 * 所有颜色都以 OKLCH 定义：感知均匀，按亮度偏移生成的悬停/按下色在明暗主题下观感一致。
 * Ant Design 的主题算法只接受 sRGB 颜色，因此这里同时提供到 sRGB 十六进制的转换。
 */

/** OKLCH 颜色。`l` 0–1，`c` 0–0.4，`h` 0–360（度），`alpha` 0–1。 */
export interface Oklch {
  readonly l: number
  readonly c: number
  readonly h: number
  readonly alpha?: number
}

/** 构造 OKLCH 颜色。 */
export function oklch(l: number, c: number, h: number, alpha?: number): Oklch {
  return alpha === undefined ? { l, c, h } : { l, c, h, alpha }
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const round = (v: number, digits: number) => Number(v.toFixed(digits))

/** 输出 CSS `oklch()` 字符串。 */
export function formatOklch(color: Oklch): string {
  const l = round(clamp(color.l, 0, 1) * 100, 2)
  const c = round(clamp(color.c, 0, 0.4), 4)
  const h = round(((color.h % 360) + 360) % 360, 2)
  const a = color.alpha === undefined || color.alpha >= 1 ? '' : ` / ${round(color.alpha, 3)}`
  return `oklch(${l}% ${c} ${h}${a})`
}

/** 交互状态色。 */
export interface StateColors {
  readonly base: Oklch
  readonly hover: Oklch
  readonly active: Oklch
  readonly disabled: Oklch
  /** 低饱和、接近背景的浅底色（选中行、标签底色等）。 */
  readonly subtle: Oklch
}

/**
 * 由基础色派生悬停、按下、禁用、浅底状态色。
 *
 * 浅色主题中悬停变亮、按下变暗；深色主题反之（深色背景上「更亮」才意味着更靠近用户）。
 * 禁用色降低彩度和不透明度，浅底色把亮度推向背景并大幅降低彩度。
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

/** 转换为 sRGB 十六进制（超出色域时裁剪），供 Ant Design 主题算法使用。 */
export function toHex(color: Oklch): string {
  const channels = oklchToLinearSrgb(color).map((v) =>
    Math.round(clamp(gammaEncode(clamp(v, 0, 1)), 0, 1) * 255),
  )
  if (color.alpha !== undefined && color.alpha < 1) {
    channels.push(Math.round(clamp(color.alpha, 0, 1) * 255))
  }
  return `#${channels.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

/** WCAG 相对亮度（忽略透明度）。 */
export function relativeLuminance(color: Oklch): number {
  const [r, g, b] = oklchToLinearSrgb(color).map((v) => clamp(v, 0, 1)) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG 对比度（1–21）。 */
export function contrastRatio(a: Oklch, b: Oklch): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}
