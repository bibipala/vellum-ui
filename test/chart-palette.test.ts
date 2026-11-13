/**
 * 图表配色的可计算检查（docs/11 §4「图表配色」）。颜色不靠肉眼挑选：分类色要通过亮度区间、彩度下限、
 * 色觉障碍模拟下的色差、正常视觉色差与对表面的对比度；顺序色与发散色检查亮度单调与对称。
 *
 * 色觉障碍模拟用 Machado、Oliveira、Fernandes（2009）严重度 1.0 的红色盲、绿色盲矩阵（作用于线性 sRGB），
 * 色差是 OKLab 欧氏距离 ×100。阈值以这个模拟模型为准：相邻色 ≥ 8，正常视觉 ≥ 15。
 */
import { describe, expect, it } from 'vitest'
import { compileTheme, resolveTheme } from '../src/theme/compile.ts'
import { builtinThemes } from '../src/themes/index.ts'
import { contrastRatio, type Oklch, toHex } from '../src/tokens/oklch.ts'
import { CHART_CATEGORICAL_COUNT, CHART_RAMP_STEPS } from '../src/tokens/semantic.ts'

type Rgb = readonly [number, number, number]

const MACHADO: Record<'protan' | 'deutan', readonly [Rgb, Rgb, Rgb]> = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** 屏幕上实际显示的颜色（裁剪到 sRGB 色域并取整后）的线性 sRGB 分量。 */
function linearRgb(color: Oklch): Rgb {
  const hex = toHex({ ...color, alpha: undefined })
  const ch = (i: number) => {
    const v = Number.parseInt(hex.slice(i, i + 2), 16) / 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return [ch(1), ch(3), ch(5)]
}

function oklab([r, g, b]: Rgb): Rgb {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

function simulate(rgb: Rgb, kind: keyof typeof MACHADO): Rgb {
  const [r, g, b] = rgb
  const row = (i: 0 | 1 | 2) => {
    const k = MACHADO[kind][i]
    return clamp01(k[0] * r + k[1] * g + k[2] * b)
  }
  return [row(0), row(1), row(2)]
}

const distance = (a: Rgb, b: Rgb) => {
  const [l1, a1, b1] = oklab(a)
  const [l2, a2, b2] = oklab(b)
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2) * 100
}

/** 红色盲、绿色盲模拟下的较小色差。 */
const cvdDelta = (x: Oklch, y: Oklch) =>
  Math.min(
    ...(['protan', 'deutan'] as const).map((k) =>
      distance(simulate(linearRgb(x), k), simulate(linearRgb(y), k)),
    ),
  )
const normalDelta = (x: Oklch, y: Oklch) => distance(linearRgb(x), linearRgb(y))
/** 实际显示颜色的 OKLab 亮度与彩度。 */
const lc = (c: Oklch) => {
  const [l, a, b] = oklab(linearRgb(c))
  return { l, c: Math.hypot(a, b) }
}

const CVD_TARGET = 8
const NORMAL_FLOOR = 15
const BAND = { light: [0.43, 0.77], dark: [0.48, 0.67] } as const
const CHROMA_FLOOR = 0.1
/**
 * 对表面对比度低于 3:1 的分类色（编号从 1 开始）。这些颜色合法的前提是图表提供表格视图并直接标注关键数值；
 * 名单写死在这里，颜色变化导致名单变化时测试失败，提醒同步 docs/11。
 */
const LOW_CONTRAST_SLOTS = { light: [3, 4, 5], dark: [] } as const
/** 散点等任意两点都可能相邻的图形，只有前几个分类色两两都能分清。 */
const ALL_PAIRS_SLOTS = 3

const variants = Object.values(builtinThemes).flatMap((t) =>
  (['light', 'dark'] as const).map((m) => resolveTheme(t, m)),
)

describe('图表分类色', () => {
  for (const theme of variants) {
    const { categorical } = theme.colors.chart
    const surface = theme.colors.bgSurface
    const name = `${theme.id}-${theme.mode}`

    it(`${name}：8 个颜色都在亮度区间内，彩度不低于下限`, () => {
      expect(categorical).toHaveLength(CHART_CATEGORICAL_COUNT)
      const [lo, hi] = BAND[theme.mode]
      for (const c of categorical) {
        const v = lc(c)
        expect(v.l).toBeGreaterThanOrEqual(lo)
        expect(v.l).toBeLessThanOrEqual(hi)
        expect(v.c).toBeGreaterThanOrEqual(CHROMA_FLOOR)
      }
    })

    it(`${name}：相邻颜色在色觉障碍模拟下色差 ≥ ${CVD_TARGET}，正常视觉 ≥ ${NORMAL_FLOOR}`, () => {
      for (let i = 0; i + 1 < categorical.length; i++) {
        const a = categorical[i] as Oklch
        const b = categorical[i + 1] as Oklch
        expect(cvdDelta(a, b), `第 ${i + 1}、${i + 2} 个`).toBeGreaterThanOrEqual(CVD_TARGET)
        expect(normalDelta(a, b), `第 ${i + 1}、${i + 2} 个`).toBeGreaterThanOrEqual(NORMAL_FLOOR)
      }
    })

    it(`${name}：前 ${ALL_PAIRS_SLOTS} 个颜色两两之间都能分清（散点图的系列上限）`, () => {
      const head = categorical.slice(0, ALL_PAIRS_SLOTS)
      for (let i = 0; i < head.length; i++)
        for (let j = i + 1; j < head.length; j++) {
          expect(cvdDelta(head[i] as Oklch, head[j] as Oklch)).toBeGreaterThanOrEqual(CVD_TARGET)
          expect(normalDelta(head[i] as Oklch, head[j] as Oklch)).toBeGreaterThanOrEqual(
            NORMAL_FLOOR,
          )
        }
    })

    it(`${name}：对表面对比度低于 3:1 的颜色与文档记录的一致`, () => {
      const low = categorical
        .map((c, i) => [i + 1, contrastRatio(c, surface)] as const)
        .filter(([, ratio]) => ratio < 3)
        .map(([slot]) => slot)
      expect(low).toEqual(LOW_CONTRAST_SLOTS[theme.mode])
    })

    it(`${name}：编译为 color-chart-1…8，色块内文字只有浅色模式的黄色用近黑色`, () => {
      const vars = compileTheme(theme)
      const darkLabel = vars['--vl-color-chart-4-on']
      for (let i = 1; i <= CHART_CATEGORICAL_COUNT; i++) {
        expect(vars[`--vl-color-chart-${i}`]).toMatch(/^oklch\(/)
        const on = vars[`--vl-color-chart-${i}-on`]
        if (theme.mode === 'light' && i === 4) expect(on).not.toBe('oklch(100% 0 none)')
        else expect(on).toBe('oklch(100% 0 none)')
      }
      expect(darkLabel).toMatch(/^oklch\(/)
    })
  }
})

describe('图表顺序色与发散色', () => {
  for (const theme of variants) {
    const { sequential, diverging, muted, grid, axis } = theme.colors.chart
    const surface = theme.colors.bgSurface
    const name = `${theme.id}-${theme.mode}`
    // 数值越大越远离表面：浅色模式越来越深，深色模式越来越亮
    const away = theme.mode === 'light' ? -1 : 1

    it(`${name}：顺序色 7 级单一色相，亮度单调且每级相差 ≥ 0.06`, () => {
      expect(sequential).toHaveLength(CHART_RAMP_STEPS)
      const hues = new Set(sequential.map((c) => c.h))
      expect(hues.size).toBe(1)
      for (let i = 0; i + 1 < sequential.length; i++) {
        const step = (lc(sequential[i + 1] as Oklch).l - lc(sequential[i] as Oklch).l) * away
        expect(step).toBeGreaterThanOrEqual(0.06)
      }
    })

    it(`${name}：顺序色第 3–7 级对表面对比度 ≥ 2:1（可用于有序分类）`, () => {
      for (const c of sequential.slice(2))
        expect(contrastRatio(c, surface)).toBeGreaterThanOrEqual(2)
    })

    it(`${name}：发散色中点是中性灰，两端冷暖相对、亮度对称，越靠两端越远离中点`, () => {
      expect(diverging).toHaveLength(CHART_RAMP_STEPS)
      const mid = diverging[3] as Oklch
      expect(mid.c).toBeLessThan(0.02)
      const cool = diverging.slice(0, 3)
      const warm = diverging.slice(4).reverse()
      expect(new Set(cool.map((c) => c.h)).size).toBe(1)
      expect(new Set(warm.map((c) => c.h)).size).toBe(1)
      // 冷端与暖端色相相差足够大（不能是蓝 ↔ 青这样的两个冷色）
      const gap = Math.abs((cool[0] as Oklch).h - (warm[0] as Oklch).h) % 360
      expect(Math.min(gap, 360 - gap)).toBeGreaterThanOrEqual(120)
      for (let i = 0; i < 3; i++) {
        const c = lc(cool[i] as Oklch).l
        const w = lc(warm[i] as Oklch).l
        expect(Math.abs(c - w)).toBeLessThanOrEqual(0.05)
      }
      // 从中点往外，亮度单调离开中点
      const midL = lc(mid).l
      for (const arm of [cool, warm]) {
        const dist = arm.map((c) => Math.abs(lc(c).l - midL))
        expect(dist[0]).toBeGreaterThan(dist[1] as number)
        expect(dist[1]).toBeGreaterThan(dist[2] as number)
      }
    })

    it(`${name}：弱化色对表面 ≥ 3:1；网格线比坐标轴更淡但仍可见`, () => {
      expect(contrastRatio(muted, surface)).toBeGreaterThanOrEqual(3)
      const g = contrastRatio(grid, surface)
      const a = contrastRatio(axis, surface)
      expect(g).toBeGreaterThan(1.1)
      expect(g).toBeLessThan(a)
      expect(muted.c).toBeLessThan(0.02)
    })

    it(`${name}：编译出顺序色、发散色、弱化色、网格与坐标轴令牌`, () => {
      const vars = compileTheme(theme)
      for (let i = 1; i <= CHART_RAMP_STEPS; i++) {
        expect(vars[`--vl-color-chart-seq-${i}`]).toMatch(/^oklch\(/)
        expect(vars[`--vl-color-chart-div-${i}`]).toMatch(/^oklch\(/)
      }
      for (const k of ['muted', 'grid', 'axis'])
        expect(vars[`--vl-color-chart-${k}`]).toMatch(/^oklch\(/)
    })
  }
})
