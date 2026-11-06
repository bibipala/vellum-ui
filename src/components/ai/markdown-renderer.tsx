/**
 * Markdown 的渲染部分（组件库内部）：XMarkdown 加上组件库固定的设置（安全、组件表、引用、样式）。
 * 只由 Markdown.tsx 用 `import()` 加载（第一次渲染时），不要静态引入，否则 XMarkdown 与它的解析、清洗依赖、
 * 渲染链接与代码的组件（markdown-parts.tsx）会进入使用方的入口包。
 */
// 引入 ES 模块的路径（es/），不用包名：见 Markdown.tsx 的说明
import { XMarkdown, type XMarkdownProps } from '@ant-design/x-markdown/es/index.js'
import styles from './markdown.module.css'
import { CITATION_CONFIG } from './markdown-citations.ts'
import {
  MARKDOWN_COMPONENTS,
  type MarkdownSettings,
  MarkdownSettingsContext,
} from './markdown-parts.tsx'

/** XMarkdown 的流式选项。 */
export type MarkdownStreamingOptions = Exclude<NonNullable<XMarkdownProps['streaming']>, boolean>

/**
 * 清洗时允许的地址：http、https、mailto 与相对地址（DOMPurify 默认的写法去掉了 ftp、tel 等协议）。
 * 渲染链接、图片的组件还会再检查一次。对象引用固定，渲染器不会因此重建。
 */
const PURIFY_CONFIG = {
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
} as const

export interface MarkdownRendererProps {
  readonly content: string
  readonly streaming: MarkdownStreamingOptions
  /** 链接、图片、引用的设置（由 markdown-parts.tsx 的组件读取）。 */
  readonly settings: MarkdownSettings
}

/** 渲染 Markdown：原始 HTML 一律转义（没有打开的开关），链接、图片、代码、表格由组件库自己的组件渲染。 */
export function MarkdownRenderer(props: MarkdownRendererProps) {
  return (
    <MarkdownSettingsContext.Provider value={props.settings}>
      <XMarkdown
        content={props.content}
        streaming={props.streaming}
        components={MARKDOWN_COMPONENTS}
        config={props.settings.sources ? CITATION_CONFIG : undefined}
        escapeRawHtml
        dompurifyConfig={PURIFY_CONFIG}
        disableDefaultStyles
        rootClassName={styles.md}
      />
    </MarkdownSettingsContext.Provider>
  )
}
