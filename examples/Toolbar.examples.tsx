import { Button, Input, Segmented, Select, Toolbar } from 'vellum-ui'

/**
 * Basic usage
 * Filters and search on the left, actions on the right.
 * @zh 基本用法
 * 左侧筛选与搜索，右侧操作。
 */
export function Basic() {
  return (
    <Toolbar actions={<Button>Export</Button>}>
      <Input.Search placeholder="Search" allowClear />
      <Select
        placeholder="Status"
        allowClear
        options={[
          { value: 'active', label: 'Active' },
          { value: 'archived', label: 'Archived' },
        ]}
      />
    </Toolbar>
  )
}

/**
 * View switch
 * @zh 视图切换
 * @section Variants
 */
export function ViewSwitch() {
  return (
    <Toolbar actions={<Segmented options={['Grid', 'List']} />}>
      <Input.Search placeholder="Search by file name" allowClear />
    </Toolbar>
  )
}
