import { DatePicker, Stack } from 'vellum-ui'

/**
 * Basic usage
 * Pick a date.
 * @zh 基本用法
 * 选择一个日期。
 */
export function Basic() {
  return <DatePicker placeholder="Due date" />
}

/**
 * Month, time and range
 * `picker="month"` picks a month, `showTime` includes the time, and `DatePicker.RangePicker` picks a start and an
 * end date.
 * @zh 月份、时间与范围
 * `picker="month"` 选月份，`showTime` 含时间，`DatePicker.RangePicker` 选择起止日期。
 * @section Variants
 */
export function Variants() {
  return (
    <Stack gap={3}>
      <DatePicker picker="month" placeholder="Select month" />
      <DatePicker showTime placeholder="Select time" />
      <DatePicker.RangePicker />
    </Stack>
  )
}
