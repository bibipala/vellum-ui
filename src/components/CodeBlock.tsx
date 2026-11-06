/**
 * 代码块：等宽字体、凹陷底色、保留换行与缩进，超出时在块内滚动。用于展示 JSON Schema、示例、命令。
 * `copyable` 时右上角有复制按钮（CopyButton）。
 */

import { CopyButton } from './CopyButton.tsx'
import code from './code-block.module.css'
import type { BaseProps } from './layout.tsx'

/**
 * Props of CodeBlock.
 * @zh CodeBlock 属性。
 */
export interface CodeBlockProps extends Pick<BaseProps, 'testId' | 'id'> {
  /**
   * Code text; convert objects with `JSON.stringify(value, null, 2)` first.
   * @zh 代码文本；对象请先 `JSON.stringify(value, null, 2)`。
   */
  readonly code: string
  /**
   * Maximum height step: `sm` 160 px, `md` 320 px, `lg` 560 px; `none` for no limit.
   * @zh 最大高度档位：sm 160px、md 320px、lg 560px；none 不限高。
   * @default 'md'
   */
  readonly maxHeight?: 'sm' | 'md' | 'lg' | 'none'
  /**
   * Wraps long lines (by default they scroll horizontally).
   * @zh 长行自动换行（默认横向滚动）。
   */
  readonly wrap?: boolean
  /**
   * Shows a copy button (CopyButton) in the top right corner that copies `code`. The code leaves room for the
   * button, so the button does not cover the end of the first lines.
   * @zh 在右上角显示复制按钮（CopyButton），复制 `code`。代码为按钮留出位置，按钮不会盖住前几行的末尾。
   */
  readonly copyable?: boolean
  /**
   * Name of the language, such as `ts` or `json`, shown in a header row above the code (with the copy button
   * of `copyable` on the right). It is only a label: the code is not highlighted.
   * @zh 语言名称，如 `ts`、`json`，显示在代码上方的标题行中（`copyable` 的复制按钮在同一行右侧）。只是标签，不做语法高亮。
   */
  readonly language?: string
}

/**
 * A code block in a monospace font that keeps line breaks and indentation and scrolls inside the block when the
 * content overflows.
 *
 * **Interaction**: with `copyable`, the copy button in the top right corner copies the code (see CopyButton); it
 * stays in place while the code scrolls. With `language`, the language and the copy button sit in a header row
 * above the code.
 * @zh 代码块：等宽字体、保留换行与缩进，内容超出时在块内滚动。
 *
 * **交互**：`copyable` 时右上角的复制按钮复制代码（见 CopyButton），代码滚动时按钮位置不变。
 * 有 `language` 时，语言与复制按钮在代码上方的标题行中。
 * @category Data
 * @usage Schemas and examples in API documentation, command-line examples, log excerpts
 * @usageZh 接口文档中的 Schema 与示例、命令行示例、日志片段
 */
export function CodeBlock(props: CodeBlockProps) {
  const header = Boolean(props.language)
  const block = (
    <pre
      data-testid={header ? undefined : props.testId}
      id={header ? undefined : props.id}
      className={code.code}
      data-max-height={props.maxHeight ?? 'md'}
      data-wrap={props.wrap || undefined}
      data-copyable={(props.copyable && !header) || undefined}
    >
      <code>{props.code}</code>
    </pre>
  )
  if (header)
    return (
      <div className={code.frame} data-header="" data-testid={props.testId} id={props.id}>
        <div className={code.header}>
          <span className={code.language}>{props.language}</span>
          {props.copyable && <CopyButton text={props.code} size="sm" />}
        </div>
        {block}
      </div>
    )
  if (!props.copyable) return block
  // 按钮放在 pre 之外：pre 的文字内容仍然只有代码（测试、复制选区都依赖这一点），按钮也不随代码横向滚动
  return (
    <div className={code.frame}>
      {block}
      <span className={code.copy}>
        <CopyButton text={props.code} size="sm" />
      </span>
    </div>
  )
}
