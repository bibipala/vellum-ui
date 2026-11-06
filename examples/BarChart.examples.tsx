import { BarChart, Stack } from 'vellum-ui'

const regions = [
  { region: 'North', orders: 1840, returns: 120 },
  { region: 'South', orders: 1320, returns: 95 },
  { region: 'East', orders: 2210, returns: 160 },
  { region: 'West', orders: 1560, returns: 88 },
  { region: 'Central', orders: 980, returns: 54 },
]

const quarters = [
  { quarter: 'Q1', hardware: 420, software: 610, services: 280 },
  { quarter: 'Q2', hardware: 455, software: 680, services: 310 },
  { quarter: 'Q3', hardware: 390, software: 720, services: 355 },
  { quarter: 'Q4', hardware: 510, software: 790, services: 402 },
]

const ranked = [
  { team: 'Platform engineering', tickets: 182 },
  { team: 'Customer success', tickets: 141 },
  { team: 'Design systems', tickets: 96 },
  { team: 'Data and analytics', tickets: 73 },
  { team: 'Security', tickets: 41 },
]

/**
 * Basic usage
 * One series compares a value across categories: every bar has the same color, and the title says what it is.
 * @zh 基本用法
 * 一个系列比较各类别的数值：所有柱同一个颜色，由标题说明画的是什么。
 */
export function Basic() {
  return (
    <BarChart
      title="Orders by region"
      description="Last 30 days"
      data={regions}
      x="region"
      xLabel="Region"
      series={[{ key: 'orders', name: 'Orders' }]}
    />
  )
}

/**
 * Grouped and stacked
 * Several series are grouped side by side; `stacked` puts them in one bar per category, whose end is the total.
 * Neighbors are separated by a 2 px gap, and only the data end is rounded.
 * @zh 分组与堆叠
 * 多个系列默认并排分组；`stacked` 把它们叠成每个类别一根柱，柱端是总和。相邻的柱与段之间有 2px 间隙，只有数据端圆角。
 * @section Variants
 */
export function GroupedAndStacked() {
  const series = [
    { key: 'hardware', name: 'Hardware' },
    { key: 'software', name: 'Software' },
    { key: 'services', name: 'Services' },
  ] as const
  return (
    <Stack gap={4}>
      <BarChart title="Revenue by quarter" data={quarters} x="quarter" series={series} />
      <BarChart
        title="Revenue by quarter, stacked"
        data={quarters}
        x="quarter"
        series={series}
        stacked
        showValues
      />
    </Stack>
  )
}

/**
 * Horizontal and ranked
 * `orientation="horizontal"` suits long category names and rankings: sort the rows, largest first. `showValues`
 * writes each value at the end of its bar.
 * @zh 横向与排名
 * `orientation="horizontal"` 适合类别名较长与排名：把行按从大到小排好。`showValues` 在每根柱的末端写出数值。
 * @section Variants
 */
export function Horizontal() {
  return (
    <BarChart
      title="Open tickets by team"
      data={ranked}
      x="team"
      xLabel="Team"
      orientation="horizontal"
      showValues
      series={[{ key: 'tickets', name: 'Open tickets' }]}
    />
  )
}

/**
 * Negative values
 * Bars below zero grow down from the baseline and are rounded at their own end.
 * @zh 负值
 * 小于 0 的柱从基线向下，圆角在它自己的末端。
 * @section Variants
 */
export function Negative() {
  return (
    <BarChart
      title="Change in headcount"
      data={[
        { month: 'Jan', change: 4 },
        { month: 'Feb', change: -2 },
        { month: 'Mar', change: 6 },
        { month: 'Apr', change: -5 },
        { month: 'May', change: 3 },
      ]}
      x="month"
      series={[{ key: 'change', name: 'Change' }]}
      showValues
    />
  )
}
