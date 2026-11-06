import { Radio } from 'vellum-ui'

/**
 * Basic usage
 * For a few mutually exclusive options that are all shown.
 * @zh 基本用法
 * 少量互斥选项全部展示时使用。
 */
export function Basic() {
  return (
    <Radio.Group
      defaultValue="read"
      options={[
        { value: 'read', label: 'Read only' },
        { value: 'write', label: 'Read and write' },
        { value: 'none', label: 'No access' },
      ]}
    />
  )
}

/**
 * Button style
 * `Radio.Button` forms a group of buttons; for switching between two or three views, prefer Segmented.
 * @zh 按钮样式
 * 用 `Radio.Button` 组成一组按钮；两三个选项的视图切换优先用 Segmented。
 * @section Variants
 */
export function Buttons() {
  return (
    <Radio.Group defaultValue="team">
      <Radio.Button value="team">Team</Radio.Button>
      <Radio.Button value="public">Public</Radio.Button>
      <Radio.Button value="private">Only me</Radio.Button>
    </Radio.Group>
  )
}
