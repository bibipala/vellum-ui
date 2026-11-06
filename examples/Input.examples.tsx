import { useState } from 'react'
import { Input, Stack, Text } from 'vellum-ui'

/**
 * Basic usage
 * Single-line text, password, search and multi-line text.
 * @zh 基本用法
 * 单行文本、密码、搜索与多行文本。
 */
export function Basic() {
  return (
    <Stack gap={3}>
      <Input placeholder="Project name" />
      <Input.Password placeholder="Password" />
      <Input.Search placeholder="Search projects" allowClear />
      <Input.TextArea placeholder="Notes" autoSize={{ minRows: 2, maxRows: 6 }} />
    </Stack>
  )
}

/**
 * Search
 * The search icon sits at the start inside the box, with no attached button: `Enter` triggers `onSearch`, and with
 * `allowClear` the clear button triggers it with an empty string as well. While `loading`, the icon becomes a
 * loading indicator and `Enter` does not trigger it again.
 * @zh 搜索
 * 搜索图标在框内前面，没有附着的按钮：按回车触发 `onSearch`，`allowClear` 时点清除按钮也会以空字符串触发；
 * `loading` 时图标换成加载指示，期间回车不重复触发。
 * @section Variants
 */
export function Search() {
  const [q, setQ] = useState('')
  return (
    <Stack gap={2}>
      <Input.Search placeholder="Search by name, press Enter" allowClear onSearch={setQ} />
      <Text tone="secondary" size="sm">
        {q ? `Searching for "${q}"` : 'No search yet'}
      </Text>
      <Input.Search placeholder="Searching" loading defaultValue="Alex Morgan" />
    </Stack>
  )
}

/**
 * Tabular numbers
 * Add `numeric` to inputs for amounts, quantities and IDs: digits have the same width, which makes values easier to
 * align and check. Pass amounts as strings, never as floating-point numbers.
 * @zh 等宽数字
 * 金额、数量、编号的输入加 `numeric`，数字位宽一致，便于对齐与核对。金额以字符串传递，不用浮点。
 * @section Variants
 */
export function Numeric() {
  return <Input numeric placeholder="0.00" defaultValue="12800.50" />
}

/**
 * Disabled and error
 * @zh 禁用与错误
 * @section States
 */
export function States() {
  return (
    <Stack gap={3}>
      <Input disabled value="Read only" />
      <Input status="error" defaultValue="Name already exists" />
    </Stack>
  )
}
