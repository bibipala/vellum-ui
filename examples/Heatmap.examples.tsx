import { Heatmap } from 'vellum-ui'

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const hours = ['00', '03', '06', '09', '12', '15', '18', '21']

// Neutral sample data: busier on weekday working hours
const activity = days.flatMap((day, d) =>
  hours.map((hour, h) => {
    const work = d < 5 && h >= 3 && h <= 6 ? 60 : 0
    return { x: hour, y: day, value: 8 + work + ((d * 7 + h * 11) % 17) }
  }),
)

const teams = ['Design', 'Platform', 'Research', 'Support']
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
const changes = teams.flatMap((team, i) =>
  months.map((month, j) => ({ x: month, y: team, value: ((i * 5 + j * 3) % 11) - 5 })),
)

/**
 * Basic usage
 * A sequential scale for magnitude: lighter is less, darker is more (in dark mode, brighter is more). The color
 * scale under the cells gives the smallest and largest values.
 * @zh 基本用法
 * 顺序色阶表示大小：越浅越小、越深越大（深色模式下越亮越大）。格子下方的色标标出最小值与最大值。
 */
export function Basic() {
  return (
    <Heatmap
      title="Sign-ins by weekday and hour"
      xCategories={hours}
      yCategories={days}
      data={activity}
      xLabel="Hour"
      yLabel="Weekday"
      valueLabel="Sign-ins"
      height={280}
    />
  )
}

/**
 * Diverging
 * `scale="diverging"` colors values above and below `midpoint` (0 by default) with two opposite hues, and the
 * midpoint itself in gray.
 * @zh 发散色阶
 * `scale="diverging"` 用冷暖相对的两种色相表示高于、低于 `midpoint`（默认 0）的数值，中点本身为灰色。
 * @section Variants
 */
export function Diverging() {
  return (
    <Heatmap
      title="Change against the plan"
      description="Points per month"
      xCategories={months}
      yCategories={teams}
      data={changes}
      scale="diverging"
      xLabel="Month"
      yLabel="Team"
      valueLabel="Change"
      format={(v) => (v > 0 ? `+${v}` : String(v))}
      height={200}
    />
  )
}
