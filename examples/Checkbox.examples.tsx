import { Checkbox, Stack } from 'vellum-ui'

/**
 * Basic usage
 * A single checkbox: an option that takes effect when the form is submitted.
 * @zh 基本用法
 * 单个勾选：需要提交才生效的选项。
 */
export function Basic() {
  return <Checkbox defaultChecked>Also delete related files</Checkbox>
}

/**
 * Checkbox group
 * The value of `Checkbox.Group` is an array of the checked options.
 * @zh 一组复选
 * `Checkbox.Group` 的值为选中项的数组。
 * @section Variants
 */
export function Group() {
  return (
    <Checkbox.Group
      defaultValue={['read']}
      options={[
        { value: 'read', label: 'View' },
        { value: 'write', label: 'Edit' },
        { value: 'manage', label: 'Manage' },
      ]}
    />
  )
}

/**
 * Disabled and indeterminate
 * @zh 禁用与半选
 * @section States
 */
export function States() {
  return (
    <Stack gap={2}>
      <Checkbox disabled>Cannot be changed</Checkbox>
      <Checkbox indeterminate>Partially selected</Checkbox>
    </Stack>
  )
}
