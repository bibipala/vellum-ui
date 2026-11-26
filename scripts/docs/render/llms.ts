/**
 * 给 AI 编程智能体的入口（llms.txt 约定：标题、引用块中的简介、说明、链接列表）。放在包的根目录，链接是相对它
 * 的路径：装在项目里时是 `node_modules/vellum-ui/llms.txt`，智能体可以直接读本地文件，与安装的版本一致。
 */
import { CATEGORIES } from '../bilingual.ts'
import { CORE_ENTRY, RECIPE_LEVELS } from '../model.ts'
import { firstSentence, type OverviewInput } from './markdown.ts'
import { UI } from './ui.ts'

export function llmsTxt(d: OverviewInput): string {
  const lines = [
    '# vellum-ui',
    '',
    '> A React component library with design tokens, light and dark modes, accent colors and density settings. Compose interfaces with semantic props and a shared theme.',
    '',
    'Usage conventions:',
    '',
    '- Import components, hooks and types from the three entries of the package only: `vellum-ui` (the core), `vellum-ui/charts` (LineChart, AreaChart, BarChart, PieChart, DonutChart, ScatterChart, Heatmap, ChartContainer; the application must install `echarts`) and `vellum-ui/ai` (MessageList, Message, PromptInput, Markdown, useStream and the other AI and streaming exports; Markdown needs `@ant-design/x-markdown` installed). Each component page shows its import. Do not import `antd`, `@ant-design/*` or `lucide-react` directly, even though the library uses them inside.',
    '- Components accept no `style` or `className`; use their semantic props (`size` is `sm` / `md` / `lg`, semantic colors are `tone`, appearances are `variant`, spacing uses the steps `0`–`8`).',
    '- The props are the library\'s own, not Ant Design\'s: for example `<Button variant="primary">`, `<Select multiple>`, Form.Item `status`. Read [conventions](docs/en-US/guides/conventions.md) before writing code.',
    '- Text inputs (`Input`, `Input.Search`, `Input.Password`, `Input.TextArea`) call `onChange(event)`; read `event.target.value`. `Input.Search.onSearch(value)` receives a string. Value controls such as `Select` and `InputNumber` call `onChange(value)`; "no value" is `null`; dates and times are ISO strings; decimal amounts are strings. See each component page for its exact callback type.',
    '- Wrap the application once in `ThemeProvider` (and `App` for `useMessage` / `useConfirmDanger`), and import `vellum-ui/styles.css` once (all styles), or `vellum-ui/core.css` plus `vellum-ui/charts.css` and `vellum-ui/ai.css` for the entries you use; see the [README](README.md#usage).',
    '- Every component page has the import, complete examples, the props (by mode when they differ, such as single and multiple selection), static members such as `Form.Item`, and the types used. The TypeScript declarations of the package carry the same descriptions.',
    '',
    'Links are relative to this file. Installed documentation is available at `node_modules/vellum-ui/llms.txt` and matches the package version.',
    '',
  ]
  if (d.guides.length) {
    lines.push('## Guides', '')
    for (const g of d.guides)
      lines.push(`- [${g.title.en}](docs/en-US/guides/${g.slug}.md): ${g.summary.en}`)
    lines.push('')
  }
  if (d.recipes.length) {
    lines.push('## Recipes', '')
    for (const level of RECIPE_LEVELS) {
      const list = d.recipes.filter((r) => r.level === level)
      if (!list.length) continue
      lines.push(`### ${UI.en.levels[level].title}`, '', UI.en.levels[level].intro, '')
      for (const r of list)
        lines.push(
          `- [${r.title.en}](docs/en-US/recipes/${r.name}.md): ${firstSentence(r.description.en, 'en')}`,
        )
      lines.push('')
    }
  }
  lines.push('## Components', '')
  for (const cat of CATEGORIES) {
    const list = d.components.filter((c) => c.category.en === cat.en)
    if (!list.length) continue
    lines.push(`### ${cat.en}`, '')
    for (const c of list)
      lines.push(
        `- [${c.name}](docs/en-US/components/${c.name}.md)${c.entry === CORE_ENTRY ? '' : ` (\`${c.entry}\`)`}: ${firstSentence(c.summary.en, 'en')}`,
      )
    lines.push('')
  }
  const groups = d.api.filter((g) => g.entries.length)
  if (groups.length) {
    lines.push('## API reference', '')
    for (const g of groups)
      lines.push(
        `- [${g.title.en}](docs/en-US/api/${g.slug}.md): ${g.entries.map((e) => `\`${e.name}\``).join(', ')}`,
      )
    lines.push('')
  }
  lines.push(
    '## Optional',
    '',
    '- [Design tokens](docs/en-US/tokens.md): the CSS variables of the theme, for custom CSS in an application',
    '- [Migration guides](MIGRATION.md): upgrading to 2.0, and migrating from 0.x to 1.0 (old props in the Ant Design style and their replacements)',
    '- [Component overview](docs/en-US/README.md): the same index as tables, with common uses',
    '- [Simplified Chinese documentation](docs/zh-CN/README.md): the same documentation in Chinese',
    '- [components.json](docs/components.json): the component documentation as data, in both languages',
    '',
  )
  return lines.join('\n')
}
