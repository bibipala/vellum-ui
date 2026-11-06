import { Panel, Sparkline, Stack, Table, Text } from 'vellum-ui'

const visits = [182, 196, 171, 204, 229, 214, 238, 251, 236, 262, 279, 301]

/**
 * Basic usage
 * By default the history is in the de-emphasis color and the latest value is an accent dot. The width fills the
 * container; `label` is what screen readers read, followed by a summary of the values. The dot has a ring in the
 * surface color, so place sparklines on a surface such as a Panel.
 * @zh 基本用法
 * 默认历史部分用弱化色，最新的值是强调色圆点。宽度撑满容器；`label` 是读屏读出的名称，后面跟着数值摘要。
 * 圆点外有一圈面板表面色，所以迷你图放在 Panel 等面板表面上。
 */
export function Basic() {
  return (
    <Panel>
      <Stack gap={2}>
        <Text size="sm" tone="secondary">
          Visits, last 12 weeks
        </Text>
        <Sparkline data={visits} label="Visits in the last 12 weeks" area />
      </Stack>
    </Panel>
  )
}

/**
 * Highlight and color
 * `highlight="none"` draws one plain line in the first chart color; `slot` draws the whole line in another chart
 * color, for a sparkline that stands for a series shown elsewhere in that color.
 * @zh 突出与颜色
 * `highlight="none"` 用第一个图表颜色画一条普通的线；`slot` 让整条线用另一个图表颜色，用于代表别处同色系列的迷你图。
 * @section Variants
 */
export function Variants() {
  return (
    <Panel>
      <Stack gap={5}>
        <Sparkline data={visits} label="Visits, plain line" highlight="none" />
        <Sparkline data={visits} label="Visits, in the second chart color" slot={2} area />
        <Sparkline
          data={visits}
          label="Visits, in the second chart color without a dot"
          slot={2}
          highlight="none"
        />
      </Stack>
    </Panel>
  )
}

/**
 * In a table
 * `size="sm"` (20 px high) fits a table cell or a list item; give the column a width.
 * @zh 表格中
 * `size="sm"`（20px 高）放进表格单元格或列表行；给这一列设置宽度。
 * @section Variants
 */
export function InTable() {
  return (
    <Panel flush>
      <Table
        rowKey="name"
        pagination={false}
        dataSource={[
          { name: 'Atlas', builds: [12, 14, 13, 17, 19, 18, 22, 24] },
          { name: 'Beacon', builds: [31, 29, 30, 26, 24, 25, 21, 19] },
          { name: 'Cobalt', builds: [8, 9, 8, 8, 9, 8, 9, 9] },
        ]}
        columns={[
          { title: 'Project', dataIndex: 'name' },
          {
            title: 'Builds, last 8 weeks',
            dataIndex: 'builds',
            width: 200,
            render: (builds: number[], row: { name: string; builds: number[] }) => (
              <Sparkline
                data={builds}
                label={`${row.name}, builds in the last 8 weeks`}
                size="sm"
              />
            ),
          },
        ]}
      />
    </Panel>
  )
}

/**
 * Gaps and short data
 * A `null` breaks the line, and a lone value between gaps is drawn as a small dot. A single value is a dot at
 * the end; no values draw nothing.
 * @zh 缺失与数据很少
 * `null` 让线断开，两个缺口之间孤立的值画成小圆点。只有一个值时在末端画一个圆点；没有值时什么也不画。
 * @section States
 */
export function Gaps() {
  return (
    <Panel>
      <Stack gap={5}>
        <Sparkline
          data={[40, 44, 41, null, null, 52, 55, null, 49, null, 58, 61]}
          label="Uptime checks with missing days"
        />
        <Sparkline data={[42]} label="First week" />
        <Sparkline data={[]} label="No data yet" />
      </Stack>
    </Panel>
  )
}
