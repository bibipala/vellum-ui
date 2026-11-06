import { Cascader, Stack } from 'vellum-ui'

const regions = [
  {
    value: 'europe',
    label: 'Europe',
    children: [
      {
        value: 'germany',
        label: 'Germany',
        children: [
          { value: 'berlin', label: 'Berlin' },
          { value: 'munich', label: 'Munich' },
        ],
      },
      {
        value: 'france',
        label: 'France',
        children: [{ value: 'paris', label: 'Paris' }],
      },
    ],
  },
  {
    value: 'asia',
    label: 'Asia',
    children: [
      {
        value: 'japan',
        label: 'Japan',
        children: [
          { value: 'tokyo', label: 'Tokyo' },
          { value: 'osaka', label: 'Osaka' },
        ],
      },
    ],
  },
]

/**
 * Basic usage
 * Each level opens in its own column; `→` opens the next level and `←` goes back.
 * @zh 基本用法
 * 每一层在单独的一列中展开；`→` 展开下一层，`←` 返回上一层。
 */
export function Basic() {
  return <Cascader options={regions} placeholder="Select an office" />
}

/**
 * Search and multiple selection
 * `showSearch` searches across all levels; `multiple` picks several values.
 * @zh 搜索与多选
 * `showSearch` 跨层级搜索；`multiple` 选择多个值。
 * @section Variants
 */
export function Variants() {
  return (
    <Stack gap={3}>
      <Cascader options={regions} showSearch placeholder="Search offices" block />
      <Cascader options={regions} multiple placeholder="Select offices" block />
    </Stack>
  )
}

/**
 * Disabled
 * @zh 禁用
 * @section States
 */
export function Disabled() {
  return <Cascader options={regions} disabled defaultValue={['asia', 'japan', 'tokyo']} />
}
