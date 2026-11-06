import { describe, expect, it } from 'vitest'
import { formatValue, seriesColorToken } from '../src/components/charts/format.ts'
import { enUS, zhCN } from '../src/i18n/index.ts'

describe('图表数值格式化', () => {
  const en = (v: number | null | undefined, f: Parameters<typeof formatValue>[1] = 'auto') =>
    formatValue(v, f, enUS['format.locale'], enUS['format.missing'])
  const zh = (v: number | null | undefined, f: Parameters<typeof formatValue>[1] = 'auto') =>
    formatValue(v, f, zhCN['format.locale'], zhCN['format.missing'])

  it('auto：小于 10,000 写全，从 10,000 起用紧凑写法（按语言）', () => {
    expect(en(1284)).toBe('1,284')
    expect(en(9999.5)).toBe('9,999.5')
    expect(en(12_900)).toBe('12.9K')
    expect(en(4_200_000)).toBe('4.2M')
    expect(en(-12_900)).toBe('-12.9K')
    expect(zh(12_900)).toBe('1.3万')
    expect(zh(4_200_000)).toBe('420万')
  })

  it('number / compact / percent / 函数', () => {
    expect(en(1_234_567, 'number')).toBe('1,234,567')
    expect(en(950, 'compact')).toBe('950')
    expect(en(0.125, 'percent')).toBe('12.5%')
    expect(zh(0.125, 'percent')).toBe('12.5%')
    expect(en(3, (v) => `${v} items`)).toBe('3 items')
  })

  it('空值与非有限数显示为占位符', () => {
    for (const v of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY])
      expect(en(v)).toBe(enUS['format.missing'])
  })

  it('分类色按序号取 1–8，超过 8 个用弱化色；可固定序号', () => {
    expect(seriesColorToken(0)).toBe('color-chart-1')
    expect(seriesColorToken(7)).toBe('color-chart-8')
    expect(seriesColorToken(8)).toBe('color-chart-muted')
    expect(seriesColorToken(0, 5)).toBe('color-chart-5')
  })
})
