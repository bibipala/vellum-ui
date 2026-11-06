import { DonutChart } from 'vellum-ui'

const plans = [
  { key: 'free', name: 'Free', value: 1240 },
  { key: 'team', name: 'Team', value: 860 },
  { key: 'business', name: 'Business', value: 410 },
  { key: 'enterprise', name: 'Enterprise', value: 95 },
]

/**
 * Basic usage
 * The same as a pie chart, drawn as a ring. Slices are separated by a 2 px gap and carry no numbers: the legend,
 * the tooltip and the table do.
 * @zh 基本用法
 * 与饼图相同，画成圆环。扇区之间有 2px 间隙，扇区上不写数字：由图例、提示与表格提供。
 */
export function Basic() {
  return <DonutChart title="Accounts by plan" data={plans} nameLabel="Plan" valueLabel="Accounts" />
}
