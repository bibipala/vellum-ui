import { Tabs, Text } from 'vellum-ui'

/**
 * Basic usage
 * Tabs are given in `items`; the indicator line slides between tabs.
 * @zh 基本用法
 * 标签用 `items` 给出；选中下划线在标签之间滑动。
 */
export function Basic() {
  return (
    <Tabs
      defaultActiveKey="info"
      items={[
        { key: 'info', label: 'Details', children: <Text>Details</Text> },
        { key: 'history', label: 'Change history', children: <Text>Change history</Text> },
        { key: 'audit', label: 'Activity log', children: <Text>Activity log</Text> },
      ]}
    />
  )
}
