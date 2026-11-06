/**
 * 图表配色与排版参数：运行时从图表容器上读取设计令牌（CSS 变量），换算成 ECharts 能用的取值。
 *
 * - 颜色令牌的值是 `oklch(…)`，使用方覆盖时也可能是十六进制、`rgb(…)` 或其他写法，统一换算成十六进制
 *   （浏览器中用 canvas 兜底换算解析不了的写法）；
 * - 间隙与外圈用图表背后的实际底色（向上查找第一个不透明的背景），放在面板、画布或对话框中都与背景一致；
 * - 动效时长取令牌：「减少动态效果」时 base.css 把时长令牌置为 0，图表随之关闭动画；
 * - 缺少令牌（没有 ThemeProvider、也没有加载样式）时用默认主题浅色模式的取值。
 *
 * `paletteFrom` 是纯函数（测试用编译好的主题调用它），`readPalette` 只在浏览器中、effect 里调用。
 */
import { compileTheme, resolveTheme } from '../../theme/compile.ts'
import { defaultTheme } from '../../themes/index.ts'
import { formatHex, parseColor, toHexColor } from './color.ts'
import { CHART_SLOTS } from './format.ts'

/** 图表引擎使用的配色与排版参数（颜色都是十六进制）。 */
export interface ChartPalette {
  /** 分类色 1–8（`color-chart-1` … `color-chart-8`）。 */
  readonly categorical: readonly string[]
  /** 弱化色：「其他」、强调某个系列时的其余系列、第 9 个起的系列。 */
  readonly muted: string
  readonly grid: string
  readonly axis: string
  /** 顺序色 7 级。 */
  readonly sequential: readonly string[]
  /** 发散色 7 级，第 4 级是中点。 */
  readonly diverging: readonly string[]
  /** 图表背后的底色：相邻色块之间的间隙、数据点的外圈。 */
  readonly surface: string
  readonly textPrimary: string
  readonly textSecondary: string
  readonly textTertiary: string
  readonly fontFamily: string
  /** 坐标轴文字字号（`font-size-xs`）。 */
  readonly fontSize: number
  /** 首次渲染动画时长（`motion-duration-slow`，毫秒）；0 表示关闭动画。 */
  readonly enterMs: number
  /** 更新动画时长（`motion-duration-base`，毫秒）。 */
  readonly updateMs: number
  /** 标准缓动（`motion-ease-standard`），供 ECharts 使用的缓动函数。 */
  readonly easing: (t: number) => number
}

let fallbackVars: Readonly<Record<string, string>> | undefined

/** 默认主题浅色模式的令牌（缺少令牌时的兜底），首次用到时编译一次。 */
function fallback(name: string): string {
  fallbackVars ??= compileTheme(resolveTheme(defaultTheme, 'light'))
  return fallbackVars[name] ?? ''
}

const px = (v: string, d: number) => {
  const n = Number.parseFloat(v)
  return Number.isFinite(n) ? n : d
}

const ms = (v: string) => {
  const s = v.trim()
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n)) return 0
  return s.endsWith('ms') ? n : s.endsWith('s') ? n * 1000 : n
}

/**
 * CSS `cubic-bezier(x1, y1, x2, y2)` 的缓动函数（ECharts 只内置具名缓动）。解析失败时用 ease-out 的三次曲线。
 * 已知进度 x 求 t 用牛顿迭代，再按 t 求 y。
 */
export function bezierEasing(css: string): (x: number) => number {
  const m = /cubic-bezier\(([^)]*)\)/.exec(css)
  const p = m?.[1]?.split(',').map((s) => Number.parseFloat(s))
  if (p?.length !== 4 || !p.every(Number.isFinite)) return (x) => 1 - (1 - x) ** 3
  const [x1, y1, x2, y2] = p as [number, number, number, number]
  const curve = (t: number, a: number, b: number) =>
    3 * a * t * (1 - t) ** 2 + 3 * b * t ** 2 * (1 - t) + t ** 3
  const slope = (t: number, a: number, b: number) =>
    3 * a * (1 - t) ** 2 + 6 * (b - a) * t * (1 - t) + 3 * (1 - b) * t ** 2
  return (x) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let t = x
    for (let i = 0; i < 8; i++) {
      const d = slope(t, x1, x2)
      if (Math.abs(d) < 1e-6) break
      t -= (curve(t, x1, x2) - x) / d
      t = Math.min(1, Math.max(0, t))
    }
    return curve(t, y1, y2)
  }
}

/**
 * 由令牌的读取函数得到配色。`read` 接收完整的变量名（`--vl-color-chart-1`），返回原始取值；
 * `convert` 把颜色写法换算成十六进制（默认只认识十六进制、`rgb()`、`oklch()`、`oklab()`）。
 */
export function paletteFrom(
  read: (name: string) => string,
  options: { readonly surface?: string; readonly convert?: (value: string) => string | null } = {},
): ChartPalette {
  const convert = options.convert ?? toHexColor
  const raw = (token: string) => {
    const name = `--vl-${token}`
    const v = read(name).trim()
    return v || fallback(name)
  }
  const color = (token: string) =>
    convert(raw(token)) ?? convert(fallback(`--vl-${token}`)) ?? '#808080'
  const list = (prefix: string, n: number) =>
    Array.from({ length: n }, (_, i) => color(`${prefix}${i + 1}`))
  return {
    categorical: list('color-chart-', CHART_SLOTS),
    muted: color('color-chart-muted'),
    grid: color('color-chart-grid'),
    axis: color('color-chart-axis'),
    sequential: list('color-chart-seq-', 7),
    diverging: list('color-chart-div-', 7),
    surface: options.surface ?? color('color-bg-surface'),
    textPrimary: color('color-text-primary'),
    textSecondary: color('color-text-secondary'),
    textTertiary: color('color-text-tertiary'),
    fontFamily: raw('font-family-body'),
    fontSize: px(raw('font-size-xs'), 12),
    enterMs: ms(raw('motion-duration-slow')),
    updateMs: ms(raw('motion-duration-base')),
    easing: bezierEasing(raw('motion-ease-standard')),
  }
}

/** 浏览器换算：先用纯函数解析，解析不了的（颜色名、hsl、color-mix）交给 canvas。 */
function browserConvert(value: string): string | null {
  const direct = toHexColor(value)
  if (direct || !value.trim()) return direct
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) return null
  // 无法识别的写法不会改变 fillStyle：分别从黑、白出发各设一次，结果不同说明浏览器也不认识它
  const normalize = (start: string) => {
    ctx.fillStyle = start
    ctx.fillStyle = value
    return String(ctx.fillStyle)
  }
  const a = normalize('#000000')
  return a === normalize('#ffffff') ? toHexColor(a) : null
}

/** 图表背后的实际底色：从元素向上找第一个不透明的背景色。 */
function surfaceBehind(el: HTMLElement): string | null {
  for (let n: HTMLElement | null = el; n; n = n.parentElement) {
    const bg = getComputedStyle(n).backgroundColor
    const c = parseColor(bg) ?? (bg ? parseColor(browserConvert(bg) ?? '') : null)
    if (c && c.a >= 0.99) return formatHex({ ...c, a: 1 })
  }
  return null
}

/** 从图表容器上读取当前的配色（主题、明暗切换后重新调用）。 */
export function readPalette(el: HTMLElement): ChartPalette {
  const style = getComputedStyle(el)
  return paletteFrom((name) => style.getPropertyValue(name), {
    surface: surfaceBehind(el) ?? undefined,
    convert: browserConvert,
  })
}

/** 颜色令牌名（如 `color-chart-3`、`color-chart-muted`）在配色中的取值。 */
export function tokenColor(p: ChartPalette, token: string): string {
  if (token === 'color-chart-muted') return p.muted
  const m = /^color-chart-(\d)$/.exec(token)
  const i = m ? Number(m[1]) - 1 : -1
  return p.categorical[i] ?? p.muted
}
