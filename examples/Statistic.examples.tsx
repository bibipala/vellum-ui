import { useState } from 'react'
import { Grid, Inline, Panel, Stack, Statistic, Switch, Text } from 'vellum-ui'

const signups = [312, 298, 341, 356, 330, 372, 389, 401, 377, 420, 436, 458]

/**
 * Basic usage
 * A label, a value, its change compared with an earlier period and a trend of the last 12 periods. The tile has
 * no background of its own: place it in a Panel.
 * @zh 基本用法
 * 标签、数值、与之前某个时期相比的增减，以及最近 12 期的趋势。指标卡本身没有底色：放进 Panel。
 */
export function Basic() {
  return (
    <Panel>
      <Statistic
        label="Weekly sign-ups"
        value={458}
        delta={{ value: 0.05, period: 'vs last week' }}
        trend={signups}
      />
    </Panel>
  )
}

/**
 * KPI row
 * Put several tiles in a Grid. Large values are compact (12.9K); `prefix` and `suffix` add a currency or a unit.
 * When a lower value is better, set `goodWhen: 'down'`: a decrease is then shown in the success color.
 * @zh 指标行
 * 多个指标卡放进 Grid。较大的数值用紧凑写法（1.3万）；`prefix`、`suffix` 加上货币或单位。
 * 数值越小越好时设置 `goodWhen: 'down'`：下降显示为成功色。
 */
export function KpiRow() {
  return (
    <Grid columns={4}>
      <Panel>
        <Statistic
          label="Active users"
          value={12_894}
          delta={{ value: 0.125, period: 'vs last month' }}
        />
      </Panel>
      <Panel>
        <Statistic
          label="Revenue"
          value={48_210}
          prefix="$"
          delta={{ value: -0.032, period: 'vs last month' }}
        />
      </Panel>
      <Panel>
        <Statistic
          label="Error rate"
          value={0.0042}
          format="percent"
          delta={{ value: -0.18, period: 'vs last week', goodWhen: 'down' }}
        />
      </Panel>
      <Panel>
        <Statistic
          label="Median response time"
          value={182}
          suffix="ms"
          delta={{ value: 0.06, period: 'vs last week', goodWhen: 'down' }}
        />
      </Panel>
    </Grid>
  )
}

/**
 * Changes and sizes
 * `goodWhen: 'none'` keeps the change in the secondary text color when neither direction is better; no change
 * shows a flat arrow. An absolute change uses its own `format`. `size="lg"` is for the main figure of an area.
 * @zh 增减与尺寸
 * 两个方向没有好坏之分时用 `goodWhen: 'none'`，增减显示为次要文字色；没有变化时显示水平箭头。
 * 绝对数量的增减用它自己的 `format`。`size="lg"` 用于区域内的主要数字。
 * @section Variants
 */
export function Variants() {
  return (
    <Grid>
      <Panel>
        <Statistic
          label="Open tickets"
          value={64}
          delta={{ value: 0.08, period: 'vs yesterday', goodWhen: 'none' }}
        />
      </Panel>
      <Panel>
        <Statistic
          label="Uptime"
          value={0.998}
          format="percent"
          delta={{ value: 0, period: 'vs last month' }}
        />
      </Panel>
      <Panel>
        <Statistic
          label="Orders shipped"
          value={1_284}
          delta={{ value: 36, format: 'number', period: 'vs yesterday' }}
        />
      </Panel>
      <Panel>
        <Statistic
          label="Storage used"
          value={3.6}
          suffix="TB"
          size="lg"
          delta={{ value: 0.02, period: 'vs last month', goodWhen: 'none' }}
        />
      </Panel>
    </Grid>
  )
}

/**
 * Loading and no data
 * While `loading`, skeletons take the place of the value, the change and the trend, and appear after 200 ms; the
 * tile keeps its size when the data arrives. A `null` value shows a dash.
 * @zh 加载与没有数据
 * `loading` 时数值、增减与趋势的位置显示骨架，200ms 后才出现；数据到来时指标卡尺寸不变。`null` 显示为短横线。
 * @section States
 */
export function States() {
  const [loading, setLoading] = useState(true)
  return (
    <Stack gap={4}>
      <Inline gap={2} align="center">
        <Switch checked={loading} onChange={setLoading} aria-label="Loading" />
        <Text size="sm">Loading</Text>
      </Inline>
      <Grid>
        <Panel>
          <Statistic
            label="Weekly sign-ups"
            value={458}
            delta={{ value: 0.05, period: 'vs last week' }}
            trend={signups}
            loading={loading}
          />
        </Panel>
        <Panel>
          <Statistic label="Refunds" value={null} />
        </Panel>
      </Grid>
    </Stack>
  )
}
