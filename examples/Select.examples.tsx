import { Select, Stack } from 'vellum-ui'

const kinds = [
  { value: 'design', label: 'Design' },
  { value: 'dev', label: 'Engineering' },
  { value: 'ops', label: 'Operations' },
]

/**
 * Basic usage
 * Single selection; add `showSearch` when there are many options.
 * @zh 基本用法
 * 单选；选项多时加 `showSearch`。
 */
export function Basic() {
  return <Select placeholder="Select a category" options={kinds} allowClear />
}

/**
 * Multiple selection and search
 * @zh 多选与搜索
 * @section Variants
 */
export function Multiple() {
  return (
    <Select
      mode="multiple"
      showSearch
      optionFilterProp="label"
      defaultValue={['design']}
      options={kinds}
      block
    />
  )
}

/**
 * Full width
 * Add `block` outside forms when the select must be as wide as other inputs.
 * @zh 占满宽度
 * 表单以外需要与其他输入框等宽时加 `block`。
 * @section Variants
 */
export function Block() {
  return (
    <Stack gap={3}>
      <Select block placeholder="Select a category" options={kinds} />
      <Select
        block
        placeholder="Select a status"
        options={[{ value: 'active', label: 'Active' }]}
      />
    </Stack>
  )
}

/**
 * Loading and disabled
 * @zh 加载与禁用
 * @section States
 */
export function States() {
  return (
    <Stack gap={3}>
      <Select block loading placeholder="Loading…" />
      <Select block disabled defaultValue="design" options={kinds} />
    </Stack>
  )
}
