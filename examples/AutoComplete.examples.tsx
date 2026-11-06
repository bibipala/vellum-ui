import { useState } from 'react'
import { AutoComplete } from 'vellum-ui'

const domains = ['example.com', 'example.org', 'example.net']

/**
 * Basic usage
 * Suggests complete email addresses while typing; any text can still be entered.
 * @zh 基本用法
 * 输入时建议完整的邮箱地址；仍然可以输入任意文字。
 */
export function Basic() {
  const [options, setOptions] = useState<{ value: string }[]>([])
  return (
    <AutoComplete
      options={options}
      onSearch={(text) => {
        const name = text.split('@')[0]
        setOptions(name ? domains.map((d) => ({ value: `${name}@${d}` })) : [])
      }}
      placeholder="Email address"
      aria-label="Email address"
      block
    />
  )
}

/**
 * Fixed suggestions
 * Filter fixed options with `filterOption`.
 * @zh 固定的建议
 * 用 `filterOption` 过滤固定的选项。
 * @section Variants
 */
export function Fixed() {
  return (
    <AutoComplete
      options={['Design', 'Development', 'Documentation', 'Delivery'].map((value) => ({ value }))}
      filterOption={(input, option) =>
        String(option?.value ?? '')
          .toLowerCase()
          .includes(input.toLowerCase())
      }
      placeholder="Tag"
      aria-label="Tag"
      block
    />
  )
}
