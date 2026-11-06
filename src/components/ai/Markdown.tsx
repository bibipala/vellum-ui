/**
 * Markdown：渲染 AI 回复（基于 @ant-design/x-markdown 的 XMarkdown，只作为内部实现）。
 *
 * - 流式：`streaming` 时写到一半的语法按写完显示（`incompleteMarkdown: 'complete'`），按标题分段增量渲染
 *   （`incremental`，只有正在增长的最后一段重新解析），结尾有光标（样式画出，见下方 options 的说明）；
 *   `typewriter` 可选，减少动态效果时关闭。
 * - 安全：原始 HTML 一律转义为文字（`escapeRawHtml`，没有打开的开关）；清洗时只允许 http、https、mailto 与相对地址；
 *   链接、图片、代码、表格由组件库自己的组件渲染（markdown-parts.tsx），再按协议白名单检查一次。
 * - 第一次渲染时才加载渲染部分（markdown-renderer.tsx，`import()`，见 lazy.ts）：没有用到 Markdown 的应用不包含
 *   XMarkdown 与它的解析、清洗依赖。加载完成之前输出转义后的纯文本（保留换行，流式时也有光标），内容立即可见；
 *   加载失败时一直显示纯文本（原因输出到控制台）。
 * - 服务端渲染：XMarkdown 的清洗需要 DOM，没有 window 时什么也不输出。服务端与注水的第一次渲染同样输出纯文本，
 *   注水完成后再换成 Markdown，两边一致，没有注水不一致的警告。
 */
import { useMemo } from 'react'
import { useT } from '../../i18n/index.ts'
import type { BaseProps } from '../layout.tsx'
import { lazy, useLazy } from '../lazy.ts'
import { useReducedMotion } from './client.ts'
import { StreamCursor } from './cursor.tsx'
import styles from './markdown.module.css'
import type { MarkdownSettings } from './markdown-parts.tsx'
import type { MarkdownStreamingOptions } from './markdown-renderer.tsx'
import type { SourceItem } from './Sources.tsx'

/** 渲染部分（XMarkdown 与组件库的设置、组件表）：第一次渲染 Markdown 时加载。 */
const renderer = lazy(() => import('./markdown-renderer.tsx'))

/** 打字机：按片段到达的节奏逐字放出（XMarkdown 内置）。 */
const TYPEWRITER = { unit: 'char' } as const

/**
 * Props of Markdown.
 * @zh Markdown 属性。
 */
export interface MarkdownProps extends Pick<BaseProps, 'testId' | 'id'> {
  /**
   * The Markdown text (CommonMark and GitHub Flavored Markdown: tables, task lists, strikethrough, autolinks).
   * It can grow while the reply streams in.
   * @zh Markdown 文本（CommonMark 与 GitHub 风格的 Markdown：表格、任务列表、删除线、自动链接）。回复流式到达时可以不断变长。
   */
  readonly content: string
  /**
   * More content is coming: half-written syntax is shown as if finished (`**bold` is already bold, the text of a
   * link appears before its address), only the part that is still growing is parsed again, and a cursor marks the
   * end. When it becomes `false`, everything is rendered as final.
   * @zh 还有后续内容：写到一半的语法按写完显示（`**加粗` 已经是粗体，链接的文字先于地址出现），只重新解析还在增长的部分，
   * 结尾显示光标。变为 `false` 时按最终内容渲染。
   * @default false
   */
  readonly streaming?: boolean
  /**
   * Types new content out at a steady pace while `streaming`, instead of showing each chunk as it arrives. Off
   * with "reduce motion".
   * @zh `streaming` 时把新内容按匀速逐字放出，而不是每个片段到达时整块出现。打开「减少动态效果」时不生效。
   * @default false
   */
  readonly typewriter?: boolean
  /**
   * Decides whether an image is loaded, by its address (only http, https and relative addresses are passed in).
   * By default no image is loaded: an address written by an AI can send data from the conversation to another
   * site. Images that are not loaded are shown as their alternative text, linked to the address.
   * @zh 按地址决定是否加载图片（只会传入 http、https 与相对地址）。默认不加载任何图片：AI 写出的图片地址可以把对话中的
   * 数据带到别的网站。不加载的图片显示为替代文字，并链接到图片地址。
   */
  readonly allowImage?: (src: string) => boolean
  /**
   * The sources the reply cites. With them, `[1]` (or `[^1]`) in the text is shown as a Citation of the first
   * source, with a popover on hover and focus; numbers without a source stay as text. Show the list itself with
   * Sources.
   * @zh 回复引用的来源。设置后，文本中的 `[1]`（或 `[^1]`）显示为第一个来源的 Citation，悬停与聚焦时弹出卡片；
   * 没有对应来源的编号保持为文字。来源列表本身用 Sources 显示。
   */
  readonly sources?: readonly SourceItem[]
}

/**
 * Renders Markdown written by an AI, also while it streams in. Headings, lists, quotes, tables, inline code and
 * code blocks follow the theme; code blocks are CodeBlocks with the language and a copy button.
 *
 * **Security**: raw HTML in the text is always shown as text, never rendered. Links only work for http, https,
 * mailto and relative addresses (other protocols such as `javascript:` are shown as plain text), and links to
 * other sites open in a new tab with `rel="noopener noreferrer"`. Images are not loaded unless `allowImage`
 * allows their address.
 *
 * **Interaction**: links have the focus ring; a wide table scrolls horizontally inside its frame and can then be
 * focused with `Tab` and scrolled with the arrow keys. While `streaming`, a static cursor marks the end and the
 * element is `aria-busy`. Rendered on the server, it outputs the text as plain text and switches to Markdown after
 * hydration.
 * @zh 渲染 AI 写出的 Markdown，也可以边接收边渲染。标题、列表、引用、表格、行内代码、代码块都跟随主题；代码块是带语言与
 * 复制按钮的 CodeBlock。
 *
 * **安全**：文本中的原始 HTML 一律显示为文字，不会被渲染。链接只对 http、https、mailto 与相对地址有效（`javascript:`
 * 等其他协议显示为纯文字），指向其他网站的链接在新标签页打开并带 `rel="noopener noreferrer"`。图片只有 `allowImage`
 * 允许的地址才加载。
 *
 * **交互**：链接有焦点环；宽表格在外框内横向滚动，这时可以用 `Tab` 聚焦并用方向键滚动。`streaming` 时结尾有静止的
 * 光标，元素带 `aria-busy`。服务端渲染时输出纯文本，注水后换成 Markdown。
 * @category AI
 * @usage AI replies, streamed answers, generated summaries and documentation
 * @usageZh AI 回复、流式的回答、生成的摘要与说明文档
 */
export function Markdown(props: MarkdownProps) {
  const t = useT()
  // 服务端与注水的第一次渲染为 null（两边一致）；之后加载完成才有值
  const { value: loaded } = useLazy(renderer, 'the Markdown renderer')
  const reduced = useReducedMotion()
  const streaming = props.streaming ?? false
  const typewriter = streaming && (props.typewriter ?? false) && !reduced
  const { allowImage, sources } = props
  const settings = useMemo<MarkdownSettings>(
    () => ({ allowImage, sources, t }),
    [allowImage, sources, t],
  )
  const options = useMemo<MarkdownStreamingOptions>(
    () => ({
      hasNextChunk: streaming,
      incremental: true,
      incompleteMarkdown: 'complete',
      typewriter: typewriter ? TYPEWRITER : false,
      // 结尾的光标不用 XMarkdown 的 tail：流结束时去掉 tail 会改变它内部合并后的组件表，解析器与渲染器随之重建，
      // 所有分段在同一个任务中重新渲染（约 10 KB 时是一个长任务）。光标改由样式画在最后一段文字之后（markdown.module.css）
      tail: false,
    }),
    [streaming, typewriter],
  )
  const root = {
    className: styles.root,
    'data-testid': props.testId,
    id: props.id,
    'aria-busy': streaming || undefined,
    'data-streaming': streaming || undefined,
  }
  // 服务端、注水的第一次渲染与渲染器加载完成之前：转义后的纯文本（React 转义），两边一致
  if (!loaded)
    return (
      <div {...root} data-markdown-fallback="">
        <div className={styles.plain}>
          {props.content}
          {streaming && <StreamCursor />}
        </div>
      </div>
    )
  const { MarkdownRenderer } = loaded
  return (
    <div {...root}>
      {props.content ? (
        <MarkdownRenderer content={props.content} streaming={options} settings={settings} />
      ) : (
        streaming && <StreamCursor />
      )}
    </div>
  )
}
