import { Inline, Pill } from 'vellum-ui'

/**
 * Basic usage
 * Statuses get a dot; the same status uses the same tone throughout the application.
 * @zh 基本用法
 * 状态加圆点；同一种状态在整个应用中用同一个色调。
 */
export function Basic() {
  return (
    <Inline gap={2}>
      <Pill tone="success" dot>
        In progress
      </Pill>
      <Pill dot>Disabled</Pill>
      <Pill tone="warning" dot>
        Pending
      </Pill>
      <Pill tone="danger" dot>
        Connection failed
      </Pill>
    </Inline>
  )
}

/**
 * Marks and tags
 * Pills without a dot are used for marks such as "Owner" and for content tags.
 * @zh 标记与标签
 * 不带圆点的胶囊用于「负责人」等标记与内容标签。
 * @section Variants
 */
export function Tags() {
  return (
    <Inline gap={2}>
      <Pill tone="accent">Owner</Pill>
      <Pill icon="pin">Pinned</Pill>
      <Pill>Design</Pill>
    </Inline>
  )
}
