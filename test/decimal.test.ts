/**
 * 十进制数字字符串（InlineEdit 的数字类型）：规范写法、比较与本地化的写法都不经过浮点，
 * 超出双精度的位数也保持精确。
 */
import { describe, expect, it } from 'vitest'
import {
  compareDecimal,
  formatDecimal,
  normalizeDecimal,
  toDecimalText,
} from '../src/components/decimal.ts'

describe('normalizeDecimal', () => {
  it('去掉正号、前导零与小数末尾的零；-0 与 0 相同', () => {
    expect(normalizeDecimal('+012.50')).toBe('12.5')
    expect(normalizeDecimal('0012')).toBe('12')
    expect(normalizeDecimal('-0.000')).toBe('0')
    expect(normalizeDecimal('.5')).toBe('0.5')
    expect(normalizeDecimal('-.50')).toBe('-0.5')
    expect(normalizeDecimal(' 7 ')).toBe('7')
  })

  it('不是十进制数时为 null', () => {
    for (const bad of ['', '.', '-', '1e3', '1,000', '12a', '--1', 'NaN', 'Infinity'])
      expect(normalizeDecimal(bad), bad).toBeNull()
  })
})

describe('compareDecimal', () => {
  it('比较大小：符号、整数位数、逐位、补齐的小数', () => {
    expect(compareDecimal('1250.5', '1250.50')).toBe(0)
    expect(compareDecimal('-0', '0')).toBe(0)
    expect(compareDecimal('9.99', '10')).toBe(-1)
    expect(compareDecimal('10', '9.99')).toBe(1)
    expect(compareDecimal('-1', '0')).toBe(-1)
    expect(compareDecimal('-10', '-9')).toBe(-1)
    expect(compareDecimal('-9.5', '-9.25')).toBe(-1)
    expect(compareDecimal('0.1', '0.09')).toBe(1)
    expect(compareDecimal('123', '124')).toBe(-1)
  })

  it('超出双精度的位数也精确比较（浮点会认为相等）', () => {
    expect(Number('9007199254740993') === Number('9007199254740992')).toBe(true)
    expect(compareDecimal('9007199254740993', '9007199254740992')).toBe(1)
    expect(compareDecimal('0.10000000000000000001', '0.1')).toBe(1)
  })

  it('有一个不是十进制数时为 null', () => {
    expect(compareDecimal('abc', '1')).toBeNull()
    expect(compareDecimal('1', '')).toBeNull()
  })
})

describe('toDecimalText', () => {
  it('字符串原样（去掉空白），数字写成不带指数的形式；空值、非有限数、不合法的字符串为 null', () => {
    expect(toDecimalText(' 12.50 ')).toBe('12.50')
    expect(toDecimalText(12.5)).toBe('12.5')
    expect(toDecimalText(1e21)).toBe('1000000000000000000000')
    expect(toDecimalText(1e-7)).toBe('0.0000001')
    expect(toDecimalText(null)).toBeNull()
    expect(toDecimalText(undefined)).toBeNull()
    expect(toDecimalText(Number.NaN)).toBeNull()
    expect(toDecimalText('12a')).toBeNull()
  })
})

describe('formatDecimal', () => {
  it('按语言写出千分位与小数点；precision 固定小数位数', () => {
    expect(formatDecimal('1250.5', 'en-US', 2)).toBe('1,250.50')
    expect(formatDecimal('1250.5', 'en-US')).toBe('1,250.5')
    expect(formatDecimal('1250.5', 'de-DE', 2)).toBe('1.250,50')
    expect(formatDecimal('-0.125', 'zh-CN', 2)).toBe('-0.13')
    expect(formatDecimal('12', 'zh-CN')).toBe('12')
  })

  it('直接格式化十进制字符串，不经过浮点', () => {
    expect(formatDecimal('9007199254740993', 'en-US')).toBe('9,007,199,254,740,993')
    expect(formatDecimal('0.1234567890123456789', 'en-US')).toBe('0.1234567890123456789')
  })

  it('不是十进制数时原样返回', () => {
    expect(formatDecimal('n/a', 'en-US')).toBe('n/a')
  })
})
