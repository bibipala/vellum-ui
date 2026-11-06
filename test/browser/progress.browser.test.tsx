/**
 * Progress 在真实浏览器中的表现：
 * - 读屏：progressbar 角色、取值范围、读屏名称；有结果（status）时读出「60%，失败」；
 * - 量表颜色（dataviz 的 meter 规则）：填充按色调取 color-meter-*，轨道是同一色阶更靠近背景的一级（同色相、有彩度，
 *   不是中性灰），填充与轨道的对比度 ≥ 3:1，浅色与深色模式都是；
 * - 线形：填充的长度对应数值，从右到左的页面中从右边开始；数值文字宽度固定，数值变化时轨道长度不变；三档粗细；
 * - 环形：数值在中间，三档直径；完成与失败显示 Lucide 的勾与叉；
 * - 到 100% 且没有指定色调时自动为完成；超出 0–100 按两端处理。
 */
import { describe, expect, it } from 'vitest'
import { Progress } from '../../src/index.ts'
import { css, luminance, page, render, rgba, sameColor, settle, token } from './render.tsx'

const bar = (name: string) => page.getByRole('progressbar', { name }).element() as HTMLElement

/** WCAG 对比度。 */
function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

/** sRGB 颜色的色相（度）与彩度（max − min，0–255）。 */
function hueOf(color: string): { hue: number; chroma: number } {
  const [r, g, b] = rgba(color)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  if (d === 0) return { hue: 0, chroma: 0 }
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { hue: (h * 60 + 360) % 360, chroma: d }
}

/** 看得见的文字（去掉对读屏隐藏的占位）。 */
function shownText(el: HTMLElement): string {
  const copy = el.cloneNode(true) as HTMLElement
  for (const n of copy.querySelectorAll('[aria-hidden="true"]')) n.remove()
  return copy.textContent ?? ''
}

const hueDistance = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b))

/** 线形的轨道与填充。 */
function lineParts(el: HTMLElement) {
  const track = el.firstElementChild as HTMLElement
  const fill = track.firstElementChild as HTMLElement
  return { track, fill }
}

/** 填充露出的长度占轨道的比例（填充被轨道裁剪）。 */
function shownRatio(el: HTMLElement): number {
  const { track, fill } = lineParts(el)
  const t = track.getBoundingClientRect()
  const f = fill.getBoundingClientRect()
  const visible = Math.min(t.right, f.right) - Math.max(t.left, f.left)
  return Math.max(0, visible) / t.width
}

describe('Progress：读屏与数值', () => {
  it('progressbar 角色、取值范围与读屏名称；数值为等宽数字，向下取整', async () => {
    await render(<Progress percent={45.8} aria-label="Import" />)
    const el = bar('Import')
    expect(el.getAttribute('aria-valuenow')).toBe('45.8')
    expect(el.getAttribute('aria-valuemin')).toBe('0')
    expect(el.getAttribute('aria-valuemax')).toBe('100')
    expect(el.getAttribute('aria-valuetext')).toBe('45%')
    expect(shownText(el)).toBe('45%')
    expect(css(el).fontVariantNumeric).toBe('tabular-nums')
  })

  it('超出 0–100 按两端处理', async () => {
    await render(
      <>
        <Progress percent={150} tone="accent" aria-label="Over" />
        <Progress percent={-5} aria-label="Under" />
      </>,
    )
    expect(bar('Over').getAttribute('aria-valuenow')).toBe('100')
    expect(bar('Under').getAttribute('aria-valuenow')).toBe('0')
    expect(shownRatio(bar('Under'))).toBe(0)
  })

  it('完成与失败：显示勾与叉代替数字，读屏读出结果；没有色调时到 100% 自动为完成，指定了色调则不会', async () => {
    await render(
      <>
        <Progress percent={100} aria-label="Done" />
        <Progress percent={30} status="error" aria-label="Failed" />
        <Progress variant="circle" percent={100} aria-label="Ring done" />
        <Progress percent={100} tone="danger" aria-label="Full" />
      </>,
      { locale: 'zh-CN' },
    )
    const done = bar('Done')
    expect(done.querySelector('svg.lucide-check')).not.toBeNull()
    expect(done.getAttribute('aria-valuetext')).toBe('100%，已完成')
    expect(sameColor(css(lineParts(done).fill).backgroundColor, token('color-meter-success'))).toBe(
      true,
    )
    const failed = bar('Failed')
    expect(failed.querySelector('svg.lucide-x')).not.toBeNull()
    expect(failed.getAttribute('aria-valuetext')).toBe('30%，失败')
    expect(
      sameColor(css(lineParts(failed).fill).backgroundColor, token('color-meter-danger')),
    ).toBe(true)
    expect(bar('Ring done').querySelector('svg.lucide-check')).not.toBeNull()
    // 量表（如存储空间满了）指定了色调：100% 不是「完成」
    const full = bar('Full')
    expect(shownText(full)).toBe('100%')
    expect(full.querySelector('svg.lucide-check')).toBeNull()
  })
})

describe('Progress：量表颜色', () => {
  for (const mode of ['light', 'dark'] as const)
    it(`${mode}：填充按色调取量表色，轨道是同一色相更靠近背景的一级，与填充的对比度 ≥ 3:1`, async () => {
      const tones = ['accent', 'success', 'warning', 'danger'] as const
      await render(
        <div>
          {tones.map((tone) => (
            <Progress key={tone} percent={50} tone={tone} aria-label={tone} />
          ))}
        </div>,
        { defaultColorMode: mode },
      )
      const surface = token('color-bg-surface')
      for (const tone of tones) {
        const { track, fill } = lineParts(bar(tone))
        const f = css(fill).backgroundColor
        const t = css(track).backgroundColor
        expect(sameColor(f, token(`color-meter-${tone}`)), tone).toBe(true)
        expect(sameColor(t, token(`color-meter-${tone}-track`)), tone).toBe(true)
        expect(contrast(f, t), tone).toBeGreaterThanOrEqual(3)
        // 同一色阶：色相相同、轨道有彩度（不是中性灰）
        expect(hueDistance(hueOf(f).hue, hueOf(t).hue), tone).toBeLessThan(15)
        expect(hueOf(t).chroma, tone).toBeGreaterThan(20)
        // 更靠近背景：浅色模式比填充亮，深色模式比填充暗；轨道看得出来（与表面不同）
        const towardSurface =
          mode === 'light' ? luminance(t) > luminance(f) : luminance(t) < luminance(f)
        expect(towardSurface, tone).toBe(true)
        expect(contrast(t, surface), tone).toBeGreaterThanOrEqual(1.25)
      }
    })
})

describe('Progress：线形', () => {
  it('填充的长度对应数值；数值变化时轨道长度不变（数值文字宽度固定）', async () => {
    const { rerender } = await render(
      <div style={{ width: 400 }}>
        <Progress percent={5} aria-label="Import" />
      </div>,
    )
    await settle(400)
    const width = lineParts(bar('Import')).track.getBoundingClientRect().width
    expect(shownRatio(bar('Import'))).toBeCloseTo(0.05, 2)
    await rerender(
      <div style={{ width: 400 }}>
        <Progress percent={60} tone="accent" aria-label="Import" />
      </div>,
    )
    await expect.poll(() => shownRatio(bar('Import'))).toBeCloseTo(0.6, 2)
    expect(lineParts(bar('Import')).track.getBoundingClientRect().width).toBe(width)
    await rerender(
      <div style={{ width: 400 }}>
        <Progress percent={100} tone="accent" aria-label="Import" />
      </div>,
    )
    expect(lineParts(bar('Import')).track.getBoundingClientRect().width).toBe(width)
  })

  it('从右到左的页面中，填充从右边开始', async () => {
    await render(
      <div dir="rtl" style={{ width: 400 }}>
        <Progress percent={25} aria-label="Import" />
      </div>,
    )
    await settle(400)
    const { track, fill } = lineParts(bar('Import'))
    const t = track.getBoundingClientRect()
    const f = fill.getBoundingClientRect()
    expect(f.left).toBeCloseTo(t.right - t.width * 0.25, 0)
    expect(shownRatio(bar('Import'))).toBeCloseTo(0.25, 2)
  })

  it('三档粗细 4 / 8 / 12px；不显示数值时轨道占满宽度', async () => {
    await render(
      <div style={{ width: 400 }}>
        <Progress percent={30} size="sm" aria-label="Small" />
        <Progress percent={30} aria-label="Medium" />
        <Progress percent={30} size="lg" aria-label="Large" />
        <Progress percent={30} showValue={false} aria-label="Bare" />
      </div>,
    )
    const height = (name: string) => lineParts(bar(name)).track.getBoundingClientRect().height
    expect([height('Small'), height('Medium'), height('Large')]).toEqual([4, 8, 12])
    expect(bar('Bare').textContent).toBe('')
    expect(lineParts(bar('Bare')).track.getBoundingClientRect().width).toBe(400)
  })
})

describe('Progress：环形', () => {
  it('数值在中间；三档直径 48 / 80 / 120px；弧的颜色是量表色', async () => {
    await render(
      <>
        <Progress variant="circle" size="sm" percent={72} aria-label="Small" />
        <Progress variant="circle" percent={72} aria-label="Storage" />
        <Progress variant="circle" size="lg" percent={72} aria-label="Large" />
      </>,
    )
    const el = bar('Storage')
    expect(shownText(el)).toBe('72%')
    const box = el.getBoundingClientRect()
    const value = (el.querySelector('span') as HTMLElement).getBoundingClientRect()
    expect(value.left + value.width / 2).toBeCloseTo(box.left + box.width / 2, 0)
    expect(value.top + value.height / 2).toBeCloseTo(box.top + box.height / 2, 0)
    expect(['Small', 'Storage', 'Large'].map((n) => bar(n).getBoundingClientRect().width)).toEqual([
      48, 80, 120,
    ])
    const [ringTrack, ringBar] = [...el.querySelectorAll('circle')] as SVGCircleElement[]
    expect(sameColor(css(ringBar as Element).stroke, token('color-meter-accent'))).toBe(true)
    expect(sameColor(css(ringTrack as Element).stroke, token('color-meter-accent-track'))).toBe(
      true,
    )
    expect(ringBar?.getAttribute('stroke-dashoffset')).toBe('28')
  })
})
