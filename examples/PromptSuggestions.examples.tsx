import { useState } from 'react'
import { PromptSuggestions, Stack, Text } from 'vellum-ui'

/**
 * Basic usage
 * Suggestions in rows that wrap; choosing one with a click, `Enter` or `Space` calls `onSelect`.
 * @zh 基本用法
 * 横向排列、放不下时换行的建议；用点击、`Enter` 或空格选择时调用 `onSelect`。
 */
export function Basic() {
  const [chosen, setChosen] = useState('')
  return (
    <Stack gap={3}>
      <PromptSuggestions
        items={[
          { key: 'plan', label: 'Plan the launch', icon: 'sparkles' },
          { key: 'notes', label: 'Summarize the meeting notes', icon: 'file-text' },
          { key: 'mail', label: 'Draft a status update', icon: 'message' },
          { key: 'files', label: 'Find recent files', icon: 'search' },
        ]}
        onSelect={(s) => setChosen(s.label)}
      />
      <Text tone="tertiary" size="sm">
        Chosen: {chosen || '—'}
      </Text>
    </Stack>
  )
}

/**
 * Vertical with descriptions
 * `layout="vertical"` stacks the suggestions with the full width, which suits longer texts. A disabled suggestion
 * with `disabledReason` stays focusable and explains why.
 * @zh 纵向排列与说明
 * `layout="vertical"` 让建议纵向排列、占满宽度，适合较长的文字。带 `disabledReason` 的禁用建议仍可聚焦，并说明原因。
 * @section Variants
 */
export function Vertical() {
  return (
    <PromptSuggestions
      layout="vertical"
      items={[
        {
          key: 'review',
          label: 'Review the design brief',
          description: 'Point out missing goals and open questions',
          icon: 'file-text',
        },
        {
          key: 'timeline',
          label: 'Turn the plan into a timeline',
          description: 'A table with owners and dates',
          icon: 'calendar',
        },
        {
          key: 'export',
          label: 'Export the conversation',
          description: 'As a PDF file',
          icon: 'download',
          disabled: true,
          disabledReason: 'Exports are turned off for this workspace',
        },
      ]}
    />
  )
}
