/**
 * 图表引擎用的颜色换算（纯函数，不访问 DOM）。
 *
 * 令牌的取值是 `oklch(…)`，使用方覆盖时也可能写十六进制或 `rgb(…)`；ECharts 只认识 sRGB 的写法，
 * 而且悬停提亮、热力图插值要在数值上计算，所以统一换算成 `#rrggbb`。插值在 OKLab 中进行（感知均匀），
 * 与色标的 CSS 渐变 `linear-gradient(in oklab, …)` 一致。
 */
import { type Oklch, toHex } from '../../tokens/oklch.ts'

/** sRGB 颜色：分量 0–255，透明度 0–1。 */
export interface Rgba {
  readonly r: number
  readonly g: number
  readonly b: number
  readonly a: number
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/** 数值或百分比：`50%` → 0.5 × `percentOf`。`none` 视为 0（CSS Color 4）。 */
function num(token: string | undefined, percentOf: number): number {
  if (token === undefined) return Number.NaN
  const s = token.trim().toLowerCase()
  if (s === 'none') return 0
  if (s.endsWith('%')) return (Number.parseFloat(s) / 100) * percentOf
  return Number.parseFloat(s)
}

/** 色相：度数，或带 `deg` / `rad` / `turn` 单位。 */
function hue(token: string | undefined): number {
  if (token === undefined) return Number.NaN
  const s = token.trim().toLowerCase()
  if (s === 'none') return 0
  const n = Number.parseFloat(s)
  if (s.endsWith('rad')) return (n * 180) / Math.PI
  if (s.endsWith('turn')) return n * 360
  return n
}

/** `fn(a b c / d)` 或 `fn(a, b, c, d)` 的参数。 */
function args(value: string, fn: RegExp): string[] | null {
  const m = fn.exec(value)
  if (!m) return null
  const body = (m[1] ?? '').trim()
  const [main = '', alpha] = body.split('/')
  const parts = main.includes(',') ? main.split(',') : main.trim().split(/\s+/)
  const out = parts.map((p) => p.trim()).filter(Boolean)
  if (alpha !== undefined) out.push(alpha.trim())
  return out
}

function fromHexDigits(hex: string): Rgba | null {
  const h = hex.length <= 4 ? [...hex].map((c) => c + c).join('') : hex
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(h)) return null
  const n = (i: number) => Number.parseInt(h.slice(i, i + 2), 16)
  return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 }
}

function fromOklch(l: number, c: number, h: number, a: number): Rgba | null {
  if (![l, c, h].every(Number.isFinite)) return null
  const rgb = fromHexDigits(toHex({ l, c, h }).slice(1))
  return rgb && { ...rgb, a: Number.isFinite(a) ? clamp(a, 0, 1) : 1 }
}

/**
 * 解析 CSS 颜色：`#rgb`、`#rrggbb`、`#rrggbbaa`、`rgb()` / `rgba()`、`oklch()`、`oklab()`。
 * 其他写法（颜色名、`hsl()`、`color-mix()`）返回 null，由浏览器换算（见 palette.ts）。
 */
export function parseColor(value: string): Rgba | null {
  const v = value.trim().toLowerCase()
  if (v.startsWith('#')) return fromHexDigits(v.slice(1))
  const rgb = args(v, /^rgba?\((.*)\)$/)
  if (rgb) {
    const [r, g, b, a] = rgb
    const out = {
      r: clamp(num(r, 255), 0, 255),
      g: clamp(num(g, 255), 0, 255),
      b: clamp(num(b, 255), 0, 255),
      a: a === undefined ? 1 : clamp(num(a, 1), 0, 1),
    }
    return [out.r, out.g, out.b, out.a].every(Number.isFinite) ? out : null
  }
  const lch = args(v, /^oklch\((.*)\)$/)
  if (lch) {
    const [l, c, h, a] = lch
    return fromOklch(num(l, 1), num(c, 0.4), hue(h), a === undefined ? 1 : num(a, 1))
  }
  const lab = args(v, /^oklab\((.*)\)$/)
  if (lab) {
    const [l, x, y, a] = lab
    const L = num(l, 1)
    const A = num(x, 0.4)
    const B = num(y, 0.4)
    return fromOklch(
      L,
      Math.hypot(A, B),
      (Math.atan2(B, A) * 180) / Math.PI,
      a === undefined ? 1 : num(a, 1),
    )
  }
  return null
}

/** `#rrggbb`（不透明时）或 `#rrggbbaa`。 */
export function formatHex(c: Rgba): string {
  const ch = [c.r, c.g, c.b].map((v) => Math.round(clamp(v, 0, 255)))
  if (c.a < 1) ch.push(Math.round(clamp(c.a, 0, 1) * 255))
  return `#${ch.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

/** 解析并换算成十六进制；无法解析时返回 null。 */
export function toHexColor(value: string): string | null {
  const c = parseColor(value)
  return c ? formatHex(c) : null
}

// —— OKLab：插值与提亮 ——

const linear = (v: number) => {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** sRGB → OKLab（Björn Ottosson 的公式）。 */
function toOklab(c: Rgba): [number, number, number] {
  const r = linear(c.r)
  const g = linear(c.g)
  const b = linear(c.b)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

function oklabToOklch([l, a, b]: [number, number, number]): Oklch {
  return { l, c: Math.hypot(a, b), h: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360 }
}

/** 在两个颜色之间按 OKLab 插值（t 0–1），返回 `#rrggbb`。 */
export function mixColors(from: string, to: string, t: number): string {
  const a = parseColor(from)
  const b = parseColor(to)
  if (!a || !b) return from
  const [l1, a1, b1] = toOklab(a)
  const [l2, a2, b2] = toOklab(b)
  const k = clamp(t, 0, 1)
  return toHex(oklabToOklch([l1 + (l2 - l1) * k, a1 + (a2 - a1) * k, b1 + (b2 - b1) * k]))
}

/** 沿着一组色阶插值：t 0 是第一级、1 是最后一级，中间在相邻两级之间按 OKLab 插值。 */
export function rampColor(stops: readonly string[], t: number): string {
  if (stops.length === 0) return '#000000'
  if (stops.length === 1) return stops[0] as string
  const x = clamp(Number.isFinite(t) ? t : 0, 0, 1) * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(x))
  return mixColors(stops[i] as string, stops[i + 1] as string, x - i)
}

/**
 * 悬停、键盘聚焦时让图形「稍微提亮」：OKLab 亮度提高 0.06，色相与彩度不变（两种模式都是变亮，
 * 浅色模式下在白色表面上仍能看出变化）。
 */
export function liftColor(color: string, amount = 0.06): string {
  const c = parseColor(color)
  if (!c) return color
  const lch = oklabToOklch(toOklab(c))
  return toHex({ ...lch, l: clamp(lch.l + amount, 0, 1) })
}
