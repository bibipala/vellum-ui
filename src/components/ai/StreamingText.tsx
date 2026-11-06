/**
 * StreamingText：纯文本的打字机效果。文字按片段到达的节奏匀速放出（typewriter.ts），流结束时立即放完；
 * 流式期间结尾有光标；「减少动态效果」时不做逐字放出，收到的文字直接显示。
 */
import type { BaseProps } from '../layout.tsx'
import { useReducedMotion } from './client.ts'
import { StreamCursor } from './cursor.tsx'
import styles from './streaming-text.module.css'
import { useTypewriter } from './typewriter.ts'

/**
 * Props of StreamingText.
 * @zh StreamingText 属性。
 */
export interface StreamingTextProps extends Pick<BaseProps, 'testId' | 'id'> {
  /**
   * The text received so far. It grows while the stream runs; line breaks are kept.
   * @zh 到目前为止收到的文字。流进行时不断变长；保留换行。
   */
  readonly text: string
  /**
   * More text is coming: the new text is typed out and a cursor is shown at the end. When it becomes `false`,
   * the rest of the text appears at once and the cursor goes away.
   * @zh 还有后续内容：新到的文字逐字放出，结尾显示光标。变为 `false` 时剩下的文字立即全部显示，光标消失。
   * @default false
   */
  readonly streaming?: boolean
}

/**
 * Plain text that is typed out while it streams in: new text is revealed at a steady pace that follows the
 * arrival of the chunks, instead of appearing in blocks. Line breaks and spaces are kept. For replies that contain
 * Markdown use Markdown.
 *
 * **Interaction**: not interactive. Text present when it mounts is shown at once; only text that arrives later is
 * typed out, and a character is never shown half-built (emoji, accented letters). While `streaming`, a static
 * cursor marks the end and the element is `aria-busy`. When the stream ends, the rest of the text appears at once.
 * With "reduce motion" on, the text is shown as it arrives, without typing.
 * @zh 流式到达时逐字放出的纯文字：新到的文字按片段到达的节奏匀速显示，而不是一块一块地出现。保留换行与空格。
 * 包含 Markdown 的回复用 Markdown。
 *
 * **交互**：不可交互。挂载时已有的文字立即显示，之后到达的才逐字放出，不会显示半个字（emoji、带附加符号的字母）。
 * `streaming` 时结尾有静止的光标，元素带 `aria-busy`。流结束时剩下的文字立即全部显示。
 * 打开「减少动态效果」时，文字到达即显示，不逐字放出。
 * @category AI
 * @usage Streaming plain-text replies, generated titles and summaries, live transcripts
 * @usageZh 流式的纯文本回复、生成中的标题与摘要、实时转写
 */
export function StreamingText(props: StreamingTextProps) {
  const streaming = props.streaming ?? false
  const reduced = useReducedMotion()
  const shown = useTypewriter(props.text, streaming && !reduced)
  return (
    <span
      className={styles.root}
      data-testid={props.testId}
      id={props.id}
      aria-busy={streaming || undefined}
      data-streaming={streaming || undefined}
    >
      {shown}
      {streaming && <StreamCursor />}
    </span>
  )
}
