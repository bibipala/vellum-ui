import { useState } from 'react'
import { Button, Inline, Stack, Tabs, Text } from 'vellum-ui'

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

/**
 * Controlled
 * `activeKey` with `onChange(key)`: the selected tab lives in your state (or in the URL), and can also be changed
 * from outside the tabs.
 * @zh 受控
 * `activeKey` 配合 `onChange(key)`：选中的标签保存在自己的状态（或 URL）中，也可以从标签页之外切换。
 * @section Advanced
 */
export function Controlled() {
  const [tab, setTab] = useState('info')
  return (
    <Stack gap={3}>
      <Inline>
        <Button size="sm" onClick={() => setTab('audit')}>
          Show the activity log
        </Button>
        <Text tone="secondary">Selected: {tab}</Text>
      </Inline>
      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          { key: 'info', label: 'Details', children: <Text>Details</Text> },
          { key: 'history', label: 'Change history', children: <Text>Change history</Text> },
          { key: 'audit', label: 'Activity log', children: <Text>Activity log</Text> },
        ]}
      />
    </Stack>
  )
}
