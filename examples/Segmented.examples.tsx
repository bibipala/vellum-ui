import { Segmented } from 'vellum-ui'

/**
 * Basic usage
 * Switches between two to five mutually exclusive options.
 * @zh 基本用法
 * 两到五个互斥选项的切换。
 */
export function Basic() {
  return (
    <Segmented
      defaultValue="list"
      options={[
        { value: 'list', label: 'List' },
        { value: 'grid', label: 'Grid' },
      ]}
    />
  )
}

/**
 * Time range
 * @zh 时间范围
 * @section Variants
 */
export function Range() {
  return (
    <Segmented
      defaultValue="week"
      options={[
        { value: 'today', label: 'Today' },
        { value: 'week', label: 'This week' },
        { value: 'month', label: 'This month' },
      ]}
    />
  )
}
