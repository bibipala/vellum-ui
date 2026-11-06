/**
 * 十进制数字字符串（组件库内部使用，不从入口导出）：InlineEdit 的数字类型用它比较取值与范围、写出本地化的数字。
 * 金额、数量以字符串传递（如 `"1250.50"`），比较与格式化都不经过浮点。
 */

const DECIMAL = /^([+-])?(\d*)(?:\.(\d*))?$/

interface Decimal {
  readonly negative: boolean
  /** 整数部分，去掉前导零；为零时是空字符串。 */
  readonly int: string
  /** 小数部分，去掉末尾的零。 */
  readonly frac: string
}

function parse(text: string): Decimal | null {
  const m = DECIMAL.exec(text.trim())
  if (!m || (!m[2] && !m[3])) return null
  const int = (m[2] ?? '').replace(/^0+/, '')
  const frac = (m[3] ?? '').replace(/0+$/, '')
  // -0 与 0 相同
  return { negative: m[1] === '-' && Boolean(int || frac), int, frac }
}

/**
 * 把取值写成十进制字符串：字符串原样（去掉首尾空白，不是合法的十进制数时为 null）；数字写成不带指数的形式
 * （`1e21` → `"1000000000000000000000"`），非有限数为 null。
 */
export function toDecimalText(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    const plain = String(value)
    return /e/i.test(plain)
      ? value.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 20 })
      : plain
  }
  const text = value.trim()
  return parse(text) ? text : null
}

/** 规范写法：`"+012.50"` → `"12.5"`，`"-0"` → `"0"`；不是合法的十进制数时为 null。 */
export function normalizeDecimal(text: string): string | null {
  const d = parse(text)
  if (!d) return null
  return `${d.negative ? '-' : ''}${d.int || '0'}${d.frac ? `.${d.frac}` : ''}`
}

/** 比较两个十进制字符串：a < b 为 -1，相等为 0，a > b 为 1；有一个不是合法的十进制数时为 null。 */
export function compareDecimal(a: string, b: string): -1 | 0 | 1 | null {
  const x = parse(a)
  const y = parse(b)
  if (!x || !y) return null
  if (x.negative !== y.negative) return x.negative ? -1 : 1
  const sign = x.negative ? -1 : 1
  // 整数部分：位数多的大，位数相同时逐位比较；再比较补齐长度的小数部分
  const byInt =
    x.int.length !== y.int.length
      ? x.int.length - y.int.length
      : x.int < y.int
        ? -1
        : x.int > y.int
          ? 1
          : 0
  if (byInt !== 0) return (Math.sign(byInt) * sign) as -1 | 1
  const len = Math.max(x.frac.length, y.frac.length)
  const fx = x.frac.padEnd(len, '0')
  const fy = y.frac.padEnd(len, '0')
  if (fx === fy) return 0
  return ((fx < fy ? -1 : 1) * sign) as -1 | 1
}

const formatters = new Map<string, Intl.NumberFormat>()

/**
 * 按语言写出十进制字符串（千分位、小数点随语言）。`precision` 给定时固定为该位数的小数，否则按原值写出
 * （最多 20 位小数）。不经过浮点：Intl.NumberFormat 直接格式化十进制字符串。
 */
export function formatDecimal(text: string, locale: string, precision?: number): string {
  const normalized = normalizeDecimal(text)
  if (normalized === null) return text
  const key = `${locale}|${precision ?? ''}`
  let f = formatters.get(key)
  if (!f) {
    f = new Intl.NumberFormat(locale, {
      minimumFractionDigits: precision ?? 0,
      maximumFractionDigits: precision ?? 20,
    })
    formatters.set(key, f)
  }
  return f.format(normalized as Intl.StringNumericLiteral)
}
