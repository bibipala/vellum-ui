import { Tree } from 'vellum-ui'

const treeData = [
  {
    key: 'product',
    title: 'Product',
    children: [
      { key: 'design', title: 'Design' },
      { key: 'dev', title: 'Engineering' },
    ],
  },
  { key: 'marketing', title: 'Marketing' },
]

/**
 * Basic usage
 * Expand and select nodes; the arrow keys move between nodes.
 * @zh 基本用法
 * 展开、选择节点；方向键在节点间移动。
 */
export function Basic() {
  return <Tree defaultExpandAll defaultSelectedKeys={['design']} treeData={treeData} />
}

/**
 * Checkable
 * `checkable` checks several nodes, as in a permission tree.
 * @zh 勾选
 * `checkable` 勾选多个节点，如权限树。
 * @section Variants
 */
export function Checkable() {
  return <Tree checkable defaultExpandAll defaultCheckedKeys={['design']} treeData={treeData} />
}
