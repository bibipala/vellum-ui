import { Stack, TimePicker } from 'vellum-ui'

/**
 * Basic usage
 * Pick a time from the columns, or type it and press `Enter`.
 * @zh 基本用法
 * 在列中选择时间，或直接输入后按 `Enter`。
 */
export function Basic() {
  return <TimePicker placeholder="Start time" />
}

/**
 * Format, step and range
 * `format="HH:mm"` hides the seconds, `minuteStep` sets the interval, and `TimePicker.RangePicker` picks a start
 * and an end time.
 * @zh 格式、间隔与范围
 * `format="HH:mm"` 不显示秒，`minuteStep` 设置间隔，`TimePicker.RangePicker` 选择起止时间。
 * @section Variants
 */
export function Variants() {
  return (
    <Stack gap={3}>
      <TimePicker format="HH:mm" minuteStep={15} placeholder="Reminder" />
      <TimePicker.RangePicker format="HH:mm" />
    </Stack>
  )
}

/**
 * Disabled
 * @zh 禁用
 * @section States
 */
export function Disabled() {
  return <TimePicker disabled placeholder="Start time" />
}
