import { useState } from 'react'
import { ChartContainer, Progress, Stack, Text } from 'vellum-ui'

const quotas = [
  { team: 'Design', used: 72 },
  { team: 'Research', used: 45 },
  { team: 'Operations', used: 18 },
]

/**
 * Basic usage
 * A custom graphic in the same frame as the other charts: title, description, states and a table view built from
 * the same data (`table`). The graphic fills the body, which is `height` pixels high.
 * @zh 基本用法
 * 自定义图形使用与其他图表相同的外框：标题、说明、状态，以及由同一份数据生成的表格视图（`table`）。
 * 图形占满主体，主体高 `height` 像素。
 */
export function Basic() {
  return (
    <ChartContainer
      title="Storage quota used"
      description="Share of each team's quota"
      height={160}
      table={{
        columns: [
          { key: 'team', title: 'Team' },
          { key: 'used', title: 'Used', numeric: true },
        ],
        rows: quotas.map((q) => ({ team: q.team, used: `${q.used}%` })),
      }}
    >
      <Stack gap={3} justify="center">
        {quotas.map((q) => (
          <Stack key={q.team} gap={1}>
            <Text size="sm">{q.team}</Text>
            <Progress percent={q.used} aria-label={`${q.team} quota used`} />
          </Stack>
        ))}
      </Stack>
    </ChartContainer>
  )
}

/**
 * Legend
 * Legend items with `onHiddenKeysChange` become toggle buttons; the graphic decides what hiding means. The
 * legend appears from two items on.
 * @zh 图例
 * 提供 `onHiddenKeysChange` 后图例项成为切换按钮，隐藏的含义由图形自己决定。两项及以上时显示图例。
 * @section Advanced
 */
export function Legend() {
  const [hidden, setHidden] = useState<readonly string[]>([])
  return (
    <ChartContainer
      title="Teams"
      height={120}
      legend={quotas.map((q, i) => ({
        key: q.team,
        name: q.team,
        color: ((i % 8) + 1) as 1 | 2 | 3,
      }))}
      hiddenKeys={hidden}
      onHiddenKeysChange={setHidden}
    >
      <Stack gap={1} justify="center">
        {quotas
          .filter((q) => !hidden.includes(q.team))
          .map((q) => (
            <Text key={q.team} size="sm">
              {q.team}: {q.used}%
            </Text>
          ))}
      </Stack>
    </ChartContainer>
  )
}
