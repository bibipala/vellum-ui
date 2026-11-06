import { Text, Timeline } from 'vellum-ui'

/**
 * Basic usage
 * Shows events in chronological order; `tone` distinguishes statuses.
 * @zh 基本用法
 * 按时间顺序展示事件，`tone` 区分状态。
 */
export function Basic() {
  return (
    <Timeline
      items={[
        { tone: 'success', content: <Text>2026-03-01 Project created · Alex Morgan</Text> },
        { tone: 'accent', content: <Text>2026-09-01 Testing started</Text> },
        { tone: 'neutral', content: <Text tone="secondary">2026-11-04 Planned launch</Text> },
      ]}
    />
  )
}
