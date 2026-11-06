import { CodeBlock } from 'vellum-ui'

/**
 * Basic usage
 * Showing JSON: format it as indented text first.
 * @zh 基本用法
 * 展示 JSON：先格式化为带缩进的文本。
 */
export function Basic() {
  return (
    <CodeBlock
      code={JSON.stringify(
        { id: 'proj_01', name: 'Website redesign', settings: { reminderMinutes: 5 } },
        null,
        2,
      )}
    />
  )
}

/**
 * Commands and long lines
 * Use `wrap` for command-line examples so that long lines wrap.
 * @zh 命令与长行
 * 命令行示例用 wrap 让长行换行。
 * @section Variants
 */
export function Wrapped() {
  return (
    <CodeBlock
      wrap
      maxHeight="sm"
      code="docker compose run --rm app node scripts/export.js --project proj_01 --format csv --output ./exports --include-archived --yes"
    />
  )
}

/**
 * Copy button
 * `copyable` adds a copy button in the top right corner; it stays in place while the code scrolls.
 * @zh 复制按钮
 * `copyable` 在右上角加上复制按钮，代码滚动时按钮位置不变。
 * @section Variants
 */
export function Copyable() {
  return <CodeBlock copyable code="pnpm add vellum-ui react react-dom" />
}

/**
 * Language
 * `language` shows the language in a header row above the code, together with the copy button. The code is not
 * highlighted.
 * @zh 语言
 * `language` 在代码上方的标题行中显示语言，复制按钮也在这一行。不做语法高亮。
 * @section Variants
 */
export function Language() {
  return (
    <CodeBlock
      copyable
      language="ts"
      code={
        'import { CodeBlock } from \'vellum-ui\'\n\nexport const example = <CodeBlock code="..." />'
      }
    />
  )
}
