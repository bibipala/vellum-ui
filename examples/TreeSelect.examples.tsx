import { TreeSelect } from 'vellum-ui'

const teams = [
  {
    value: 'product',
    title: 'Product',
    children: [
      { value: 'design', title: 'Design' },
      { value: 'dev', title: 'Engineering' },
    ],
  },
  { value: 'marketing', title: 'Marketing' },
]

/**
 * Basic usage
 * Select one node of a team tree.
 * @zh 基本用法
 * 从团队树中选择一个节点。
 */
export function Basic() {
  return (
    <TreeSelect
      block
      showSearch
      allowClear
      defaultExpandAll
      placeholder="Select a team"
      options={teams}
    />
  )
}

/**
 * Checking several nodes
 * `treeCheckable` checks several nodes; with `showCheckedStrategy={TreeSelect.SHOW_PARENT}`, only the parent is
 * filled in when all of its children are checked.
 * @zh 勾选多个
 * `treeCheckable` 勾选多个节点；`showCheckedStrategy={TreeSelect.SHOW_PARENT}` 在子节点全选时只回填父节点。
 * @section Variants
 */
export function Checkable() {
  return (
    <TreeSelect
      block
      multiple
      checkable
      showChecked="parent"
      defaultExpandAll
      placeholder="Select who can see it"
      options={teams}
    />
  )
}
