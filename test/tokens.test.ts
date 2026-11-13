import { describe, expect, it } from 'vitest'
import {
  compileTheme,
  cssVar,
  extendTheme,
  METER_TONES,
  resolveTheme,
  toCssText,
} from '../src/theme/compile.ts'
import { builtinThemes, defaultTheme } from '../src/themes/index.ts'
import { contrastRatio, deriveStates, formatOklch, oklch, toHex } from '../src/tokens/oklch.ts'
import { viewerStageTokens } from '../src/tokens/viewer-stage.ts'

describe('OKLCH', () => {
  it('格式化为 CSS oklch()', () => {
    expect(formatOklch(oklch(0.5, 0.1, 30))).toBe('oklch(50% 0.1 30)')
    expect(formatOklch(oklch(0, 0, 0, 0.45))).toBe('oklch(0% 0 none / 0.45)')
    // 灰色没有色相：输出 `none`，color-mix(in oklch) 时取另一种颜色的色相
    expect(formatOklch(oklch(1, 0, 263))).toBe('oklch(100% 0 none)')
    expect(formatOklch(oklch(1.2, 0.5, -30))).toBe('oklch(100% 0.4 330)')
  })

  it('转换为 sRGB 十六进制', () => {
    expect(toHex(oklch(1, 0, 0))).toBe('#ffffff')
    expect(toHex(oklch(0, 0, 0))).toBe('#000000')
    expect(toHex(oklch(0, 0, 0, 0.5))).toBe('#00000080')
    // 纯红 #ff0000 ≈ oklch(0.628 0.2577 29.23)
    expect(toHex(oklch(0.628, 0.2577, 29.23))).toBe('#ff0000')
  })

  it('浅色模式：悬停变亮、按下变暗，色相不变', () => {
    const base = oklch(0.56, 0.18, 32)
    const s = deriveStates(base, 'light')
    expect(s.hover.l).toBeGreaterThan(base.l)
    expect(s.active.l).toBeLessThan(base.l)
    expect(s.hover.h).toBe(base.h)
    expect(s.active.h).toBe(base.h)
  })

  it('深色模式：悬停变暗方向相反', () => {
    const base = oklch(0.64, 0.17, 33)
    const s = deriveStates(base, 'dark')
    expect(s.hover.l).toBeLessThan(base.l)
    expect(s.active.l).toBeGreaterThan(base.l)
  })

  it('禁用色降低彩度与不透明度，浅底色贴近背景亮度', () => {
    const base = oklch(0.56, 0.18, 32)
    const light = deriveStates(base, 'light')
    expect(light.disabled.c).toBeLessThan(base.c)
    expect(light.disabled.alpha).toBeLessThan(1)
    expect(light.subtle.l).toBeGreaterThan(0.9)
    expect(deriveStates(base, 'dark').subtle.l).toBeLessThan(0.4)
  })

  it('亮度结果被裁剪在 0–1', () => {
    expect(deriveStates(oklch(0.98, 0.05, 10), 'light').hover.l).toBeLessThanOrEqual(1)
    expect(deriveStates(oklch(0.02, 0.05, 10), 'light').active.l).toBeGreaterThanOrEqual(0)
  })
})

const light = resolveTheme(defaultTheme, 'light')
const dark = resolveTheme(defaultTheme, 'dark')
/** 每个内置主题的浅色与深色两种解析结果。 */
const variants = Object.values(builtinThemes).flatMap((t) =>
  (['light', 'dark'] as const).map((m) => resolveTheme(t, m)),
)

describe('compileTheme', () => {
  it('输出带 --vl- 前缀的三层令牌', () => {
    const vars = compileTheme(light)
    expect(vars['--vl-neutral-900']).toMatch(/^oklch\(/)
    expect(vars['--vl-color-bg-canvas']).toBe(formatOklch(light.colors.bgCanvas))
    expect(vars['--vl-color-accent']).toBe(formatOklch(light.colors.accent))
    expect(vars['--vl-color-accent-hover']).toBe(
      formatOklch(deriveStates(light.colors.accent, 'light').hover),
    )
    expect(vars['--vl-space-4']).toBe('16px')
    expect(vars['--vl-radius-md']).toBe('10px')
    expect(vars['--vl-motion-duration-fast']).toBe('120ms')
    expect(vars['--vl-motion-ease-standard']).toBe('cubic-bezier(0.2, 0, 0, 1)')
    expect(vars['--vl-button-height-md']).toBe('var(--vl-control-height-md)')
    for (const key of Object.keys(vars)) expect(key.startsWith('--vl-')).toBe(true)
  })

  it('密度只影响组件令牌', () => {
    const comfortable = compileTheme(light, { density: 'comfortable' })
    const compact = compileTheme(light, { density: 'compact' })
    expect(comfortable['--vl-control-height-md']).toBe('36px')
    expect(compact['--vl-control-height-md']).toBe('30px')
    expect(compact['--vl-color-accent']).toBe(comfortable['--vl-color-accent'])
  })

  it('浅色与深色编译出相同的令牌集合', () => {
    const keys = Object.keys(compileTheme(light)).sort()
    for (const v of variants) expect(Object.keys(compileTheme(v)).sort()).toEqual(keys)
  })

  it('解析主题时按明暗取对应的颜色', () => {
    expect(light.mode).toBe('light')
    expect(dark.mode).toBe('dark')
    expect(light.colors).toBe(defaultTheme.light)
    expect(dark.colors).toBe(defaultTheme.dark)
  })

  it('toCssText 与 cssVar', () => {
    expect(toCssText({ '--vl-a': '1px' }, '.x')).toBe('.x{--vl-a:1px;}')
    expect(cssVar('color-accent')).toBe('var(--vl-color-accent)')
  })

  it('主题覆盖可以改变强调色', () => {
    const brand = extendTheme(defaultTheme, {
      id: 'brand',
      colors: { accent: oklch(0.5, 0.1, 260) },
      dark: { accent: oklch(0.7, 0.1, 260) },
    })
    expect(compileTheme(resolveTheme(brand, 'light'))['--vl-color-accent']).toBe(
      'oklch(50% 0.1 260)',
    )
    // 只覆盖某一模式的颜色优先于两种模式共用的覆盖
    expect(compileTheme(resolveTheme(brand, 'dark'))['--vl-color-accent']).toBe(
      'oklch(70% 0.1 260)',
    )
    expect(brand.id).toBe('brand')
  })
})

// 看图背景令牌（viewer-*）是通用的「中性看图背景」：库提供无色偏的默认值，主题可以覆盖。
// 「主题不能修改看图背景」这类产品规则由使用方的预设层实现，不在库内强制。
describe('看图背景令牌', () => {
  it('默认的看图背景彩度为 0（无色偏）', () => {
    for (const key of ['viewer-bg-mid', 'viewer-bg-dark', 'viewer-bg-black']) {
      expect(viewerStageTokens[key]).toMatch(/^oklch\([\d.]+% 0 none\)$/)
    }
  })

  it('不覆盖时，内置主题的浅色、深色编译出相同的默认值', () => {
    const pick = (vars: Record<string, string>) =>
      Object.fromEntries(Object.entries(vars).filter(([k]) => k.startsWith('--vl-viewer-')))
    const expected = Object.fromEntries(
      Object.entries(viewerStageTokens).map(([k, v]) => [`--vl-${k}`, v]),
    )
    for (const v of variants) expect(pick(compileTheme(v))).toEqual(expected)
  })

  it('在库层面可以被主题的令牌级覆盖修改，未覆盖的键保持默认值', () => {
    const warm = extendTheme(defaultTheme, {
      tokens: { 'viewer-bg-dark': 'oklch(22% 0.02 60)', 'color-accent': 'oklch(50% 0.1 100)' },
    })
    for (const mode of ['light', 'dark'] as const) {
      const vars = compileTheme(resolveTheme(warm, mode))
      expect(vars['--vl-viewer-bg-dark']).toBe('oklch(22% 0.02 60)')
      expect(vars['--vl-viewer-bg-mid']).toBe(viewerStageTokens['viewer-bg-mid'])
      expect(vars['--vl-color-accent']).toBe('oklch(50% 0.1 100)')
    }
    // 直接构造的主题对象同样生效
    const vars = compileTheme({ ...light, tokenOverrides: { 'viewer-bg-black': 'white' } })
    expect(vars['--vl-viewer-bg-black']).toBe('white')
  })

  it('组件令牌不受令牌级覆盖影响（随密度编译）', () => {
    const vars = compileTheme({ ...light, tokenOverrides: { 'control-height-md': '99px' } })
    expect(vars['--vl-control-height-md']).toBe('36px')
  })

  it('默认值对象被冻结，修改只能经由主题覆盖', () => {
    expect(Object.isFrozen(viewerStageTokens)).toBe(true)
  })
})

describe('状态色作为文字时的对比度（WCAG AA）', () => {
  // Pill、Text 的状态色调使用 color-*-text：在表面、画布与该状态的浅底色上都要达到 4.5:1
  for (const theme of variants) {
    it(`${theme.id}-${theme.mode}`, () => {
      const vars = compileTheme(theme)
      const parse = (v: string | undefined) => {
        const m = /oklch\(([\d.]+)% ([\d.]+) ([\d.]+|none)/.exec(v ?? '')
        if (!m) throw new Error(`无法解析颜色：${v}`)
        return oklch(Number(m[1]) / 100, Number(m[2]), m[3] === 'none' ? 0 : Number(m[3]))
      }
      for (const k of ['danger', 'warning', 'success', 'info']) {
        const text = parse(vars[`--vl-color-${k}-text`])
        for (const bg of ['bg-surface', 'bg-canvas', `${k}-subtle`])
          expect(contrastRatio(text, parse(vars[`--vl-color-${bg}`]))).toBeGreaterThanOrEqual(4.5)
      }
    })
  }
})

describe('量表颜色（Progress，dataviz 的 meter 规则）', () => {
  const parse = (v: string | undefined) => {
    const m = /oklch\(([\d.]+)% ([\d.]+) ([\d.]+|none)/.exec(v ?? '')
    if (!m) throw new Error(`无法解析颜色：${v}`)
    return oklch(Number(m[1]) / 100, Number(m[2]), m[3] === 'none' ? 0 : Number(m[3]))
  }
  for (const theme of variants) {
    it(`${theme.id}-${theme.mode}：轨道是同一色阶更靠近背景的一级，与填充 ≥ 3:1，与表面看得出来`, () => {
      const vars = compileTheme(theme)
      const surface = theme.colors.bgSurface
      expect([...METER_TONES]).toEqual(['accent', 'success', 'warning', 'danger'])
      for (const tone of METER_TONES) {
        const fill = parse(vars[`--vl-color-meter-${tone}`])
        const track = parse(vars[`--vl-color-meter-${tone}-track`])
        expect(contrastRatio(fill, track), tone).toBeGreaterThanOrEqual(3)
        for (const bg of [surface, theme.colors.bgCanvas])
          expect(contrastRatio(fill, bg), tone).toBeGreaterThanOrEqual(3.75)
        expect(contrastRatio(track, surface), tone).toBeGreaterThanOrEqual(1.25)
        // 同一色阶：色相与填充（即该色调）相同，有彩度，不是中性灰
        expect(track.h, tone).toBeCloseTo(theme.colors[tone].h, 1)
        expect(fill.h, tone).toBeCloseTo(theme.colors[tone].h, 1)
        expect(track.c, tone).toBeGreaterThan(0.04)
        // 更靠近背景：亮度在填充与表面之间
        const [lo, hi] = [Math.min(fill.l, surface.l), Math.max(fill.l, surface.l)]
        expect(track.l, tone).toBeGreaterThan(lo)
        expect(track.l, tone).toBeLessThan(hi)
      }
    })
  }

  it('主题的色调本身对比度足够时，填充就是该色调；不够时（浅色模式的警告色）沿亮度方向加深', () => {
    const light = resolveTheme(defaultTheme, 'light')
    const vars = compileTheme(light)
    expect(vars['--vl-color-meter-accent']).toBe(vars['--vl-color-accent'])
    expect(vars['--vl-color-meter-danger']).toBe(vars['--vl-color-danger'])
    const warning = parse(vars['--vl-color-meter-warning'])
    expect(warning.l).toBeLessThan(light.colors.warning.l)
    expect(warning.h).toBeCloseTo(light.colors.warning.h, 1)
  })
})

describe('内置主题对比度（WCAG AA）', () => {
  for (const theme of variants) {
    it(`${theme.id}-${theme.mode}：正文与次要文字对比度 ≥ 4.5`, () => {
      const c = theme.colors
      for (const bg of [c.bgCanvas, c.bgSurface, c.bgElevated]) {
        expect(contrastRatio(c.textPrimary, bg)).toBeGreaterThanOrEqual(4.5)
        expect(contrastRatio(c.textSecondary, bg)).toBeGreaterThanOrEqual(4.5)
      }
      // 主按钮白字在强调色实心底上（深色模式的实心底单独压暗，ADR 0018）
      expect(contrastRatio(c.textOnAccent, c.accentFill)).toBeGreaterThanOrEqual(4.5)
      // 第三级文字与强调色文字同样要可读（v2 起纳入校验）
      for (const bg of [c.bgCanvas, c.bgSurface]) {
        expect(contrastRatio(c.textTertiary, bg)).toBeGreaterThanOrEqual(4.5)
        expect(contrastRatio(c.accentText, bg)).toBeGreaterThanOrEqual(4.5)
      }
    })

    it(`${theme.id}-${theme.mode}：头像色调为五组，文字与底色对比度 ≥ 4.5`, () => {
      const tones = theme.colors.avatar
      expect(tones).toHaveLength(5)
      for (const tone of tones)
        expect(contrastRatio(tone.text, tone.bg)).toBeGreaterThanOrEqual(4.5)
      // 编译出 color-avatar-1-* … color-avatar-5-*，与主题中的取值一致
      const vars = compileTheme(theme)
      tones.forEach((tone, i) => {
        expect(vars[`--vl-color-avatar-${i + 1}-bg`]).toBe(formatOklch(tone.bg))
        expect(vars[`--vl-color-avatar-${i + 1}-text`]).toBe(formatOklch(tone.text))
      })
    })
  }
})

describe('antd 主题映射的密度', () => {
  it('紧凑密度：控件高度 30px、间距收紧，正文字号保持 14px（antd 的紧凑算法会缩到 12px、24px）', async () => {
    const { theme: antdTheme } = await import('antd')
    const { toAntdTheme } = await import('../src/theme/antd.ts')
    for (const theme of variants) {
      const comfortable = antdTheme.getDesignToken(toAntdTheme(theme))
      const compact = antdTheme.getDesignToken(toAntdTheme(theme, { density: 'compact' }))
      expect(comfortable.controlHeight).toBe(36)
      expect(compact.controlHeight).toBe(30)
      expect(compact.fontSize).toBe(comfortable.fontSize)
      expect(compact.fontSize).toBe(14)
      expect(compact.fontSizeSM).toBe(comfortable.fontSizeSM)
      expect(compact.lineHeight).toBe(comfortable.lineHeight)
      // 间距随紧凑算法收紧
      expect(compact.padding).toBeLessThan(comfortable.padding)
    }
  })
})
