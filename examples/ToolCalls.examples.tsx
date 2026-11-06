import { useEffect, useState } from 'react'
import { Button, Inline, Stack, type ToolCallItem, ToolCalls } from 'vellum-ui'

const SEARCH: ToolCallItem = {
  key: 'call_1',
  title: 'Search the web',
  status: 'success',
  description: 'release checklist best practices',
  input: { query: 'release checklist best practices', limit: 5 },
  output: [
    { title: 'Shipping checklists', url: 'https://example.com/shipping' },
    { title: 'Release notes that people read', url: 'https://example.org/notes' },
  ],
}

/**
 * Basic usage
 * Each step shows its state as an icon and a text. Steps with an `input` or `output` can be expanded to show them
 * as JSON; the reason of a failure is always visible.
 * @zh 基本用法
 * 每步以图标加文字显示状态。有 `input` 或 `output` 的步骤可以展开，以 JSON 显示它们；失败的原因总是直接显示。
 */
export function Basic() {
  return (
    <ToolCalls
      items={[
        SEARCH,
        {
          key: 'call_2',
          title: 'Read file',
          status: 'error',
          description: 'docs/launch-plan.md',
          input: { path: 'docs/launch-plan.md' },
          error: 'The file does not exist.',
        },
        { key: 'call_3', title: 'Write summary', status: 'cancelled' },
      ]}
    />
  )
}

const STEPS: readonly ToolCallItem[] = [
  { key: 'plan', title: 'Plan the answer', status: 'pending' },
  {
    key: 'search',
    title: 'Search the project notes',
    status: 'pending',
    input: { query: 'launch date' },
  },
  { key: 'draft', title: 'Draft the reply', status: 'pending' },
]

/**
 * Running steps
 * Update `status` as the agent works: waiting steps, the running one with a spinning icon, then the result.
 * @zh 进行中的步骤
 * 智能体工作时更新 `status`：等待中的步骤、正在进行的一步（图标旋转），然后是结果。
 * @section States
 */
export function Running() {
  const [current, setCurrent] = useState(-1)
  useEffect(() => {
    if (current < 0 || current >= STEPS.length) return
    const timer = setTimeout(() => setCurrent((n) => n + 1), 1200)
    return () => clearTimeout(timer)
  }, [current])
  const items = STEPS.map((step, i): ToolCallItem => {
    if (current < 0 || i > current) return step
    if (i === current) return { ...step, status: 'running' }
    return {
      ...step,
      status: 'success',
      output: step.key === 'search' ? { found: 2, date: '2026-12-01' } : undefined,
    }
  })
  return (
    <Stack gap={3}>
      <Inline gap={2}>
        <Button
          type="primary"
          disabled={current >= 0 && current < STEPS.length}
          onClick={() => setCurrent(0)}
        >
          Run
        </Button>
      </Inline>
      <ToolCalls items={items} />
    </Stack>
  )
}
