import { useState } from 'react'
import { Button, LineChart, Stack } from 'vellum-ui'

const months = [
  { month: 'Jan', visits: 4200, signups: 820, trials: 310 },
  { month: 'Feb', visits: 4650, signups: 910, trials: 365 },
  { month: 'Mar', visits: 5120, signups: 1040, trials: 402 },
  { month: 'Apr', visits: 4980, signups: 980, trials: 388 },
  { month: 'May', visits: 5610, signups: 1180, trials: 455 },
  { month: 'Jun', visits: 6240, signups: 1320, trials: 510 },
  { month: 'Jul', visits: 6010, signups: 1265, trials: 498 },
  { month: 'Aug', visits: 6580, signups: 1410, trials: 560 },
]

/**
 * Basic usage
 * One series: the title says what is plotted, so there is no legend. Hover or focus the chart and use `←` / `→`
 * to read the values; the "Chart / Table" switch lists them all.
 * @zh 基本用法
 * 一个系列：标题说明画的是什么，不显示图例。悬停或聚焦图表后用 `←` / `→` 读数；「图表 / 表格」切换列出全部数值。
 */
export function Basic() {
  return (
    <LineChart
      title="Visits per month"
      description="January to August"
      data={months}
      x="month"
      xLabel="Month"
      series={[{ key: 'visits', name: 'Visits' }]}
    />
  )
}

/**
 * Several series
 * From two series on, the legend appears; click an item to hide or show its series. Colors follow the position
 * in `series`, so the other series keep their colors.
 * @zh 多个系列
 * 两个及以上系列时显示图例；点击图例项隐藏或显示该系列。颜色按 `series` 中的位置分配，其他系列不会变色。
 * @section Variants
 */
export function Series() {
  return (
    <LineChart
      title="Signups and trials"
      data={months}
      x="month"
      series={[
        { key: 'signups', name: 'Signups' },
        { key: 'trials', name: 'Trials' },
      ]}
    />
  )
}

/**
 * Emphasis
 * When the chart is about one series, `emphasis` keeps its color and mutes the others.
 * @zh 突出一个系列
 * 图表只关心其中一个系列时，用 `emphasis` 保留它的颜色，其余系列用弱化色。
 * @section Variants
 */
export function Emphasis() {
  return (
    <LineChart
      title="Trials compared with the other funnels"
      data={months}
      x="month"
      emphasis="trials"
      series={[
        { key: 'signups', name: 'Signups' },
        { key: 'trials', name: 'Trials' },
        { key: 'visits', name: 'Visits' },
      ]}
      format="compact"
    />
  )
}

/**
 * Loading, empty and error
 * The first load shows a delayed loading indicator at the height of the chart; reloading keeps the previous
 * lines at reduced opacity. Without rows the empty state is shown, and `error` with `onRetry` shows the error
 * state with "Retry".
 * @zh 加载、空与错误
 * 首次加载显示延迟出现的加载指示，高度与图表相同；重新加载时保留上一次的折线并降低不透明度。没有数据时显示
 * 空状态；`error` 加 `onRetry` 显示带「重试」的错误状态。
 * @section States
 */
export function States() {
  const [loading, setLoading] = useState(false)
  return (
    <Stack gap={4}>
      <LineChart
        title="Visits per month"
        data={months}
        x="month"
        series={[{ key: 'visits', name: 'Visits' }]}
        loading={loading}
        actions={
          <Button size="small" onClick={() => setLoading((v) => !v)}>
            {loading ? 'Stop' : 'Reload'}
          </Button>
        }
      />
      <LineChart
        title="Visits per month"
        data={[]}
        x="month"
        series={[{ key: 'visits', name: 'Visits' }]}
        height={160}
      />
      <LineChart
        title="Visits per month"
        data={[]}
        x="month"
        series={[{ key: 'visits', name: 'Visits' }]}
        height={160}
        error="The analytics service did not respond."
        onRetry={() => {}}
      />
    </Stack>
  )
}
