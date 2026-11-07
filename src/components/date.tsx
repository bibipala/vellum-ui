/**
 * 日期与时间选择：DatePicker（含 RangePicker）、TimePicker（含 RangePicker）。
 * 对外的值是 ISO 字符串，不暴露 dayjs（ADR 0021 §3）：值可以直接存储、传给接口。内部用 dayjs 与 antd 交换。
 */
import { DatePicker as AntDatePicker, TimePicker as AntTimePicker } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import type { JSX } from 'react'
import type { ControlSize } from './basic.tsx'
import styles from './inputs.module.css'
import { toAntSize, withInjected } from './internal.ts'
import type { FieldAttributes } from './select.tsx'

// antd 的属性类型与本库的声明在结构上兼容，但 antd 的泛型与重载让直接传递很繁琐：内部统一转成宽松的对象再交给 antd
type Loose = Record<string, unknown>

/** 日期与时间选择共有的属性。 */
interface PickerFieldProps extends FieldAttributes {
  /**
   * Display format of the value in the field, such as `YYYY/MM/DD` or `HH:mm` (dayjs tokens). It does not change the
   * format of the value.
   * @zh 框中显示的格式，如 `YYYY/MM/DD`、`HH:mm`（dayjs 的格式记号）。不改变值的格式。
   */
  readonly format?: string
  /**
   * Shows a clear button while there is a value.
   * @zh 有值时显示清除按钮。
   * @default true
   */
  readonly allowClear?: boolean
  /**
   * Disables the field.
   * @zh 禁用。
   */
  readonly disabled?: boolean
  /**
   * Size: `sm` in table rows and toolbars, `lg` for prominent forms. Without it, the size follows the density.
   * @zh 尺寸：`sm` 用于表格行内与工具栏，`lg` 用于醒目的表单。省略时随密度。
   */
  readonly size?: ControlSize
  /**
   * Appearance: `filled` (neutral background, the default) or `borderless`.
   * @zh 外观：`filled` 填充式（中性底，默认）或 `borderless` 无底色。
   * @default 'filled'
   */
  readonly variant?: 'filled' | 'borderless'
  /**
   * Validation status, usually set by Form.Item.
   * @zh 校验状态，通常由 Form.Item 设置。
   */
  readonly status?: 'error' | 'warning'
  /**
   * Fills the width of the container.
   * @zh 占满容器的宽度。
   */
  readonly block?: boolean
}

/** 单个日期与日期范围共有的属性。 */
interface DateFieldProps extends PickerFieldProps {
  /**
   * What is picked: a `date` (the default), a `month` or a `year`. The value is `2026-11-06`, `2026-11` or `2026`.
   * @zh 选择什么：日期（`date`，默认）、月份（`month`）或年份（`year`）。值分别是 `2026-11-06`、`2026-11`、`2026`。
   * @default 'date'
   */
  readonly picker?: 'date' | 'month' | 'year'
  /**
   * Also picks a time; the value becomes an ISO date-time with the local offset, such as
   * `2026-11-06T14:30:00+08:00`.
   * @zh 同时选择时间；值变为带本地时区偏移的 ISO 日期时间，如 `2026-11-06T14:30:00+08:00`。
   */
  readonly showTime?: boolean
  /**
   * Days that cannot be picked, such as dates in the past. Receives the date as `YYYY-MM-DD`.
   * @zh 不能选择的日期，如过去的日期。参数是 `YYYY-MM-DD` 格式的日期。
   */
  readonly disabledDate?: (date: string) => boolean
}

/** DatePicker 自有的属性。 */
interface DatePickerOwnProps extends DateFieldProps {
  /**
   * The picked date as an ISO string (controlled); `null` when empty.
   * @zh 选择的日期，ISO 字符串（受控）；为空时是 `null`。
   */
  readonly value?: string | null
  /**
   * Initial date (uncontrolled).
   * @zh 初始日期（非受控）。
   */
  readonly defaultValue?: string | null
  /**
   * Called with the new value as an ISO string; `null` when cleared.
   * @zh 值变化时调用，参数是 ISO 字符串；清除时是 `null`。
   */
  readonly onChange?: (value: string | null) => void
  /**
   * Text shown while there is no value.
   * @zh 没有值时显示的文字。
   */
  readonly placeholder?: string
}

/**
 * Props of DatePicker.
 * @zh DatePicker 属性。
 */
export interface DatePickerProps extends DatePickerOwnProps {}

/** DatePicker.RangePicker 自有的属性。 */
interface RangePickerOwnProps extends DateFieldProps {
  /**
   * Start and end as ISO strings (controlled); `null` when empty.
   * @zh 开始与结束，ISO 字符串（受控）；为空时是 `null`。
   */
  readonly value?: readonly [string, string] | null
  /**
   * Initial range (uncontrolled).
   * @zh 初始范围（非受控）。
   */
  readonly defaultValue?: readonly [string, string] | null
  /**
   * Called with the new range; `null` when cleared.
   * @zh 范围变化时调用；清除时是 `null`。
   */
  readonly onChange?: (value: [string, string] | null) => void
  /**
   * Texts shown in the start and end fields while there is no value.
   * @zh 没有值时开始与结束框中显示的文字。
   */
  readonly placeholder?: readonly [string, string]
}

/**
 * Props of DatePicker.RangePicker.
 * @zh DatePicker.RangePicker 属性。
 */
export interface RangePickerProps extends RangePickerOwnProps {}

/** 选择的粒度对应的值格式。 */
function dateFormat(picker: DateFieldProps['picker'], showTime: boolean | undefined) {
  if (showTime) return null // 带时区偏移的完整 ISO（dayjs 的默认 format()）
  return picker === 'month' ? 'YYYY-MM' : picker === 'year' ? 'YYYY' : 'YYYY-MM-DD'
}

const toDayjs = (value: string | null | undefined) =>
  value === undefined ? undefined : value === null || value === '' ? null : dayjs(value)

const fromDayjs = (value: Dayjs | null | undefined, format: string | null) =>
  value ? (format === null ? value.format() : value.format(format)) : null

function dateProps(props: DateFieldProps) {
  const { picker, showTime, disabledDate, size, block, ...rest } = props
  return {
    rest,
    format: dateFormat(picker, showTime),
    common: {
      picker: picker === 'date' ? undefined : picker,
      showTime,
      disabledDate: disabledDate ? (d: Dayjs) => disabledDate(d.format('YYYY-MM-DD')) : undefined,
      size: toAntSize(size),
      className: withInjected(block ? styles.block : undefined, rest),
    },
  }
}

function DatePickerRoot(props: DatePickerProps) {
  const { value, defaultValue, onChange, ...fields } = props
  const { rest, format, common } = dateProps(fields)
  return (
    <AntDatePicker
      {...(rest as Loose)}
      {...common}
      value={toDayjs(value)}
      defaultValue={toDayjs(defaultValue)}
      onChange={onChange ? (d: Dayjs | null) => onChange(fromDayjs(d, format)) : undefined}
    />
  )
}

const toRange = (value: readonly [string, string] | null | undefined) =>
  value === undefined
    ? undefined
    : value === null
      ? null
      : ([dayjs(value[0]), dayjs(value[1])] as const)

function RangePicker(props: RangePickerProps) {
  const { value, defaultValue, onChange, placeholder, ...fields } = props
  const { rest, format, common } = dateProps(fields)
  return (
    <AntDatePicker.RangePicker
      {...(rest as Loose)}
      {...common}
      placeholder={placeholder as [string, string] | undefined}
      value={toRange(value) as [Dayjs, Dayjs] | null | undefined}
      defaultValue={(toRange(defaultValue) ?? undefined) as [Dayjs, Dayjs] | undefined}
      onChange={
        onChange
          ? (range: [Dayjs | null, Dayjs | null] | null) =>
              onChange(
                range?.[0] && range[1]
                  ? [fromDayjs(range[0], format) ?? '', fromDayjs(range[1], format) ?? '']
                  : null,
              )
          : undefined
      }
    />
  )
}

/**
 * DatePicker and its static members.
 * @zh DatePicker 及其静态成员。
 */
export interface DatePickerComponent {
  /**
   * Renders a date picker.
   * @zh 渲染日期选择。
   */
  (props: DatePickerProps): JSX.Element
  /**
   * Picks a date range in one field with a start and an end. The value is a pair of ISO strings,
   * `['2026-11-01', '2026-11-30']`, in the same format as DatePicker (`picker` and `showTime` apply to both ends);
   * `null` when empty. Use it for filters and periods such as "from … to …".
   * @zh 在一个框中选择日期范围，有开始与结束。值是一对 ISO 字符串，如 `['2026-11-01', '2026-11-30']`，格式与
   * DatePicker 相同（`picker`、`showTime` 对两端都生效）；为空时是 `null`。用于筛选条件、起止时间段等。
   */
  readonly RangePicker: (props: RangePickerProps) => JSX.Element
}

/**
 * Date picker: picks a date (with a time when `showTime` is set, or a month with `picker="month"`). Use
 * `DatePicker.RangePicker` for a date range. Values are ISO strings such as `2026-11-06`, so they can be stored and
 * sent to a server as they are.
 * @zh 日期选择：选择日期（`showTime` 时含时间、`picker="month"` 选月份）。日期范围用 `DatePicker.RangePicker`。
 * 值是 ISO 字符串，如 `2026-11-06`，可以直接存储、传给服务端。
 * @category Basic
 * @usage Date filters, due dates, start dates
 * @usageZh 筛选日期、到期日、开始日期
 */
export const DatePicker: DatePickerComponent = /* @__PURE__ */ Object.assign(DatePickerRoot, {
  RangePicker,
})

// —— TimePicker ——

/** 时间选择共有的属性。 */
interface TimeFieldProps extends PickerFieldProps {
  /**
   * Step of the minute column, such as `15` for quarter hours.
   * @zh 分钟列的步长，如 `15` 表示按刻钟选择。
   * @default 1
   */
  readonly minuteStep?: number
}

/** TimePicker 自有的属性。 */
interface TimePickerOwnProps extends TimeFieldProps {
  /**
   * The picked time (controlled), `HH:mm:ss`, or `HH:mm` when `format` has no seconds; `null` when empty.
   * @zh 选择的时间（受控），`HH:mm:ss`；`format` 不含秒时为 `HH:mm`。为空时是 `null`。
   */
  readonly value?: string | null
  /**
   * Initial time (uncontrolled).
   * @zh 初始时间（非受控）。
   */
  readonly defaultValue?: string | null
  /**
   * Called with the new time; `null` when cleared.
   * @zh 时间变化时调用；清除时是 `null`。
   */
  readonly onChange?: (value: string | null) => void
  /**
   * Text shown while there is no value.
   * @zh 没有值时显示的文字。
   */
  readonly placeholder?: string
}

/**
 * Props of TimePicker.
 * @zh TimePicker 属性。
 */
export interface TimePickerProps extends TimePickerOwnProps {}

/** TimePicker.RangePicker 自有的属性。 */
interface TimeRangePickerOwnProps extends TimeFieldProps {
  /**
   * Start and end times (controlled); `null` when empty.
   * @zh 开始与结束时间（受控）；为空时是 `null`。
   */
  readonly value?: readonly [string, string] | null
  /**
   * Initial range (uncontrolled).
   * @zh 初始范围（非受控）。
   */
  readonly defaultValue?: readonly [string, string] | null
  /**
   * Called with the new range; `null` when cleared.
   * @zh 范围变化时调用；清除时是 `null`。
   */
  readonly onChange?: (value: [string, string] | null) => void
  /**
   * Texts shown in the start and end fields while there is no value.
   * @zh 没有值时开始与结束框中显示的文字。
   */
  readonly placeholder?: readonly [string, string]
}

/**
 * Props of TimePicker.RangePicker.
 * @zh TimePicker.RangePicker 属性。
 */
export interface TimeRangePickerProps extends TimeRangePickerOwnProps {}

/** 显示格式不含秒时，值也不含秒。 */
const timeFormat = (format: string | undefined) =>
  format !== undefined && !format.includes('s') ? 'HH:mm' : 'HH:mm:ss'

const toTime = (value: string | null | undefined) =>
  value === undefined ? undefined : value ? dayjs(`1970-01-01T${value}`) : null

function timeProps(props: TimeFieldProps) {
  const { size, block, ...rest } = props
  return {
    rest,
    format: timeFormat(props.format),
    common: {
      size: toAntSize(size),
      className: withInjected(block ? styles.block : undefined, rest),
    },
  }
}

function TimePickerRoot(props: TimePickerProps) {
  const { value, defaultValue, onChange, ...fields } = props
  const { rest, format, common } = timeProps(fields)
  return (
    <AntTimePicker
      {...(rest as Loose)}
      {...common}
      value={toTime(value)}
      defaultValue={toTime(defaultValue)}
      onChange={onChange ? (d: Dayjs | null) => onChange(d ? d.format(format) : null) : undefined}
    />
  )
}

function TimeRangePicker(props: TimeRangePickerProps) {
  const { value, defaultValue, onChange, placeholder, ...fields } = props
  const { rest, format, common } = timeProps(fields)
  const toTimes = (v: readonly [string, string] | null | undefined) =>
    v === undefined ? undefined : v === null ? null : [toTime(v[0]), toTime(v[1])]
  return (
    <AntTimePicker.RangePicker
      {...(rest as Loose)}
      {...common}
      placeholder={placeholder as [string, string] | undefined}
      value={toTimes(value) as [Dayjs, Dayjs] | null | undefined}
      defaultValue={(toTimes(defaultValue) ?? undefined) as [Dayjs, Dayjs] | undefined}
      onChange={
        onChange
          ? (range: [Dayjs | null, Dayjs | null] | null) =>
              onChange(
                range?.[0] && range[1] ? [range[0].format(format), range[1].format(format)] : null,
              )
          : undefined
      }
    />
  )
}

/**
 * TimePicker and its static members.
 * @zh TimePicker 及其静态成员。
 */
export interface TimePickerComponent {
  /**
   * Renders a time picker.
   * @zh 渲染时间选择。
   */
  (props: TimePickerProps): JSX.Element
  /**
   * Picks a time range in one field with a start and an end, such as working hours. The value is a pair of strings
   * in the same format as TimePicker, `['09:00:00', '18:00:00']` (or `['09:00', '18:00']` when `format` has no
   * seconds); `null` when empty.
   * @zh 在一个框中选择时间范围，有开始与结束，如工作时间。值是一对字符串，格式与 TimePicker 相同，如
   * `['09:00:00', '18:00:00']`（`format` 不含秒时为 `['09:00', '18:00']`）；为空时是 `null`。
   */
  readonly RangePicker: (props: TimeRangePickerProps) => JSX.Element
}

/**
 * Time picker: picks a time of day in columns of hours, minutes and seconds; `format` without seconds (`HH:mm`)
 * hides the seconds and the value has none either. Use `TimePicker.RangePicker` for a range. Values are strings
 * such as `14:30`.
 * @zh 时间选择：在时、分、秒的列中选择一天中的时间；`format` 不含秒（`HH:mm`）时不显示秒，值也不含秒。时间范围用
 * `TimePicker.RangePicker`。值是字符串，如 `14:30`。
 * @category Basic
 * @usage Reminder times, opening hours, scheduled tasks
 * @usageZh 提醒时间、营业时间、定时任务
 */
export const TimePicker: TimePickerComponent = /* @__PURE__ */ Object.assign(TimePickerRoot, {
  RangePicker: TimeRangePicker,
})
