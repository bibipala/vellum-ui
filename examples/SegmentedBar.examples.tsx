import { DataTable, Inline, Panel, SegmentedBar, Stack, Text } from 'vellum-ui'

const storage = [
  { key: 'images', name: 'Images', value: 413 },
  { key: 'videos', name: 'Videos', value: 286 },
  { key: 'documents', name: 'Documents', value: 92 },
  { key: 'audio', name: 'Audio', value: 41 },
  { key: 'archives', name: 'Archives', value: 18 },
]

/**
 * Basic usage
 * A tall bar standing alone: each block prints its share where it fits, and the legend lists the names in block
 * order. Hover a block, or press `Tab` and then `←` / `→`, to see its amount, share and name.
 * @zh 基本用法
 * 单独出现的高条：放得下的块里写着占比，图例按色块顺序列出名称。悬停在块上，或按 `Tab` 后用 `←` / `→`，
 * 查看数量、占比与名称。
 */
export function Basic() {
  return (
    <Panel>
      <Stack gap={3}>
        <Text weight="medium">Storage by file type</Text>
        <SegmentedBar
          variant="tall"
          label="Storage by file type"
          items={storage}
          format={(v) => `${v} GB`}
        />
      </Stack>
    </Panel>
  )
}

/**
 * Amounts and folding
 * `show="value"` prints the amount instead of the share. Past `maxItems` parts (6 by default), the tail is folded
 * into "Other", in the de-emphasis color.
 * @zh 数量与合并
 * `show="value"` 在块里写数量而不是占比。超过 `maxItems` 个部分（默认 6 个）时，尾部合并为「其他」，用弱化色。
 * @section Variants
 */
export function Variants() {
  return (
    <Panel>
      <Stack gap={5}>
        <SegmentedBar
          variant="tall"
          label="Budget by team"
          show="value"
          format="compact"
          items={[
            { key: 'engineering', name: 'Engineering', value: 413_000_000 },
            { key: 'design', name: 'Design', value: 182_000_000 },
            { key: 'marketing', name: 'Marketing', value: 96_000_000 },
            { key: 'support', name: 'Support', value: 54_000_000 },
          ]}
        />
        <SegmentedBar
          variant="tall"
          label="Visits by country"
          maxItems={4}
          items={[
            { key: 'us', name: 'United States', value: 4_210 },
            { key: 'de', name: 'Germany', value: 1_830 },
            { key: 'jp', name: 'Japan', value: 1_240 },
            { key: 'br', name: 'Brazil', value: 610 },
            { key: 'in', name: 'India', value: 540 },
            { key: 'fr', name: 'France', value: 320 },
          ]}
        />
      </Stack>
    </Panel>
  )
}

/**
 * Thin, next to its figures
 * The thin bar has no text: the figures are beside it. In table rows, use `dense` (4 px) and give the whole table
 * one legend, here on the bar of the total.
 * @zh 细条，放在数字旁边
 * 细条不写文字：数字就在旁边。表格行中用 `dense`（4px），整张表共用一个图例，这里放在合计的那条上。
 * @section Variants
 */
export function Thin() {
  const tasks = (done: number, review: number, todo: number) => [
    { key: 'done', name: 'Done', value: done },
    { key: 'review', name: 'In review', value: review },
    { key: 'todo', name: 'To do', value: todo },
  ]
  const rows = [
    { name: 'Atlas', done: 24, review: 6, todo: 10 },
    { name: 'Beacon', done: 8, review: 2, todo: 21 },
    { name: 'Cobalt', done: 15, review: 0, todo: 3 },
  ]
  return (
    <Panel>
      <Stack gap={4}>
        <Stack gap={2}>
          <Inline justify="between">
            <Text weight="medium">All projects</Text>
            <Text size="sm" tone="secondary">
              47 of 89 tasks done
            </Text>
          </Inline>
          <SegmentedBar
            variant="thin"
            legend
            label="Tasks in all projects"
            items={tasks(47, 8, 34)}
          />
        </Stack>
        <DataTable
          aria-label="Projects"
          rowKey={(row) => row.name}
          rows={rows}
          columns={[
            { key: 'name', title: 'Project' },
            {
              key: 'tasks',
              title: 'Tasks',
              width: 240,
              render: (row) => (
                <SegmentedBar
                  variant="thin"
                  dense
                  label={`Tasks in ${row.name}`}
                  items={tasks(row.done, row.review, row.todo)}
                />
              ),
            },
          ]}
        />
      </Stack>
    </Panel>
  )
}

/**
 * No data
 * Without parts, or when every part is 0, the bar is an empty track of the same height. Negative or non-finite
 * values are treated the same way, with a warning in development.
 * @zh 没有数据
 * 没有部分或全部为 0 时，显示同样高度的空轨道。负数与非有限数也这样处理，并在开发模式下给出警告。
 * @section States
 */
export function Empty() {
  return (
    <Panel>
      <Stack gap={4}>
        <SegmentedBar variant="tall" label="Storage by file type" items={[]} />
        <SegmentedBar
          variant="thin"
          label="Tasks"
          items={[
            { key: 'done', name: 'Done', value: 0 },
            { key: 'todo', name: 'To do', value: 0 },
          ]}
        />
      </Stack>
    </Panel>
  )
}
