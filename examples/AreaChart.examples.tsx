import { AreaChart } from 'vellum-ui'

const hours = [
  { hour: '00:00', api: 1200, web: 840, jobs: 320 },
  { hour: '03:00', api: 980, web: 610, jobs: 540 },
  { hour: '06:00', api: 1650, web: 1020, jobs: 410 },
  { hour: '09:00', api: 3820, web: 2650, jobs: 380 },
  { hour: '12:00', api: 4410, web: 3120, jobs: 360 },
  { hour: '15:00', api: 4120, web: 2980, jobs: 420 },
  { hour: '18:00', api: 3560, web: 2410, jobs: 450 },
  { hour: '21:00', api: 2140, web: 1580, jobs: 610 },
]

/**
 * Basic usage
 * A single series where the volume matters: the area is a light wash under the line.
 * @zh 基本用法
 * 关心总量的单个系列：线下方是淡色的面积。
 */
export function Basic() {
  return (
    <AreaChart
      title="Requests per hour"
      description="Today, all services"
      data={hours}
      x="hour"
      xLabel="Hour"
      series={[{ key: 'api', name: 'Requests' }]}
    />
  )
}

/**
 * Stacked
 * `stacked` adds the series up: the top line is the total, and each band is one part of it.
 * @zh 堆叠
 * `stacked` 把各系列累加：最上面的线是总和，每一条色带是其中一部分。
 * @section Variants
 */
export function Stacked() {
  return (
    <AreaChart
      title="Requests per hour by source"
      data={hours}
      x="hour"
      stacked
      series={[
        { key: 'api', name: 'API' },
        { key: 'web', name: 'Web' },
        { key: 'jobs', name: 'Background jobs' },
      ]}
    />
  )
}
