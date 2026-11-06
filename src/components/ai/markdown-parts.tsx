/**
 * Markdown 中由组件库自己渲染的元素（XMarkdown 的 `components`）：链接、图片、代码、表格、引用标记。
 * 这些组件引用固定（模块级常量），XMarkdown 的解析器与渲染器不会因此重建；每个 Markdown 实例的设置
 * （图片策略、来源、文本）通过上下文传入。组件库内部使用（Markdown），不从入口导出。
 *
 * 安全：
 * - 原始 HTML 在解析阶段已转义为文字（`escapeRawHtml`），这里收到的标签只来自 Markdown 语法本身；
 * - 链接与图片地址在清洗（DOMPurify）之后再按协议白名单检查一次（safe-url.ts），不合格的渲染为纯文字；
 * - 远程图片默认不加载，显示为替代文字与指向图片的链接，由使用方的 `allowImage` 决定是否加载。
 */
import type { ComponentProps } from '@ant-design/x-markdown/es/index.js'
import {
  createContext,
  isValidElement,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { MessageKey } from '../../i18n/index.ts'
import { CodeBlock } from '../CodeBlock.tsx'
import { Icon } from '../Icon.tsx'
import hidden from '../visually-hidden.module.css'
import styles from './markdown.module.css'
import { CITATION_TAG } from './markdown-citations.ts'
import { Citation, type SourceItem } from './Sources.tsx'
import { safeImageSrc, safeLink } from './safe-url.ts'

/** 每个 Markdown 实例的设置。 */
export interface MarkdownSettings {
  readonly allowImage: ((src: string) => boolean) | undefined
  readonly sources: readonly SourceItem[] | undefined
  readonly t: (key: MessageKey, params?: Readonly<Record<string, string | number>>) => string
}

export const MarkdownSettingsContext = createContext<MarkdownSettings>({
  allowImage: undefined,
  sources: undefined,
  t: (key) => key,
})

/** 自定义组件收到的是清洗后 HTML 的原始属性（`href`、`src`、`data-*` 等，均为字符串）。 */
function attr(props: ComponentProps, name: string): string | undefined {
  const value = (props as Readonly<Record<string, unknown>>)[name]
  return typeof value === 'string' ? value : undefined
}

/** 子节点中的文字（代码块的内容）。 */
export function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children)
  return ''
}

/** 链接：协议白名单；外部链接在新标签页打开，并告诉读屏。 */
function MarkdownLink(props: ComponentProps) {
  const { t } = useContext(MarkdownSettingsContext)
  const link = safeLink(attr(props, 'href'))
  if (!link)
    return (
      <span data-markdown-link="blocked" className={styles.blocked}>
        {props.children}
      </span>
    )
  return (
    <a
      className={styles.link}
      href={link.href}
      title={attr(props, 'title')}
      target={link.external ? '_blank' : undefined}
      rel={link.external ? 'noopener noreferrer' : undefined}
      data-markdown-link={link.external ? 'external' : 'internal'}
    >
      {props.children}
      {link.external && <span className={hidden.hidden}> ({t('markdown.newTab')})</span>}
    </a>
  )
}

/**
 * 图片：默认不加载（AI 输出的图片地址可以把对话中的数据带到别的网站），显示为图标、替代文字与指向图片的链接；
 * `allowImage` 返回 true 的地址才加载，加载时不发送来源页地址。
 */
function MarkdownImage(props: ComponentProps) {
  const { allowImage, t } = useContext(MarkdownSettingsContext)
  const src = safeImageSrc(attr(props, 'src'))
  const alt = attr(props, 'alt') ?? ''
  const title = attr(props, 'title')
  if (src && allowImage?.(src))
    return (
      <img
        className={styles.image}
        src={src}
        alt={alt}
        title={title}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
      />
    )
  const label = alt || t('markdown.image')
  const link = src ? safeLink(src) : null
  return (
    <span className={styles.imageRef} data-markdown-image="blocked" title={title}>
      <Icon name="image" size={14} />
      {link ? (
        <a
          className={styles.link}
          href={link.href}
          target={link.external ? '_blank' : undefined}
          rel={link.external ? 'noopener noreferrer' : undefined}
        >
          {label}
          {link.external && <span className={hidden.hidden}> ({t('markdown.newTab')})</span>}
        </a>
      ) : (
        <span>{label}</span>
      )}
    </span>
  )
}

/** 代码块的外层 `pre` 不输出：块级代码由 CodeBlock 渲染（它自己有 `pre`）。 */
function MarkdownPre(props: ComponentProps) {
  return <>{props.children}</>
}

/** 代码：块级用 CodeBlock（可复制，显示语言）；行内用等宽字体与中性填充。 */
function MarkdownCode(props: ComponentProps) {
  if (!props.block) return <code className={styles.inlineCode}>{props.children}</code>
  // info string 的第一个词是语言（```ts title="a.ts" → ts）；末尾的换行是解析器加上的
  const language = props.lang?.trim().split(/\s+/)[0] || undefined
  const code = textOf(props.children).replace(/\n$/, '')
  return (
    <div className={styles.codeBlock} data-markdown-code="">
      <CodeBlock code={code} language={language} copyable maxHeight="none" />
    </div>
  )
}

/**
 * 表格：宽表格在外框内横向滚动。只有确实需要滚动时，外框才可以用键盘聚焦（并带读屏名称），
 * 这样键盘用户也能滚动它，而不需要滚动的表格不多出一个 Tab 停留点。
 */
function MarkdownTable(props: ComponentProps) {
  const { t } = useContext(MarkdownSettingsContext)
  const ref = useRef<HTMLDivElement>(null)
  const [scrollable, setScrollable] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver !== 'function') return
    const check = () => setScrollable(el.scrollWidth > el.clientWidth + 1)
    check()
    const observer = new ResizeObserver(check)
    observer.observe(el)
    const table = el.firstElementChild
    if (table) observer.observe(table)
    return () => observer.disconnect()
  }, [])
  // 需要滚动时才是可聚焦、有名称的区域（role 随状态变化，静态检查无法判断，所以整组属性一起给出）
  const region = scrollable
    ? { tabIndex: 0, role: 'region', 'aria-label': t('markdown.table') }
    : undefined
  return (
    <div
      ref={ref}
      className={styles.tableScroll}
      {...region}
      data-scrollable={scrollable || undefined}
    >
      <table className={styles.table}>{props.children}</table>
    </div>
  )
}

/** 引用标记 `[n]`：有第 n 个来源时渲染为 Citation，没有时原样显示文字。 */
function MarkdownCitation(props: ComponentProps) {
  const { sources } = useContext(MarkdownSettingsContext)
  const index = Number(attr(props, 'data-index'))
  const source = Number.isInteger(index) && index > 0 ? sources?.[index - 1] : undefined
  if (!source) return <>[{attr(props, 'data-index')}]</>
  return <Citation index={index} source={source} />
}

/** XMarkdown 的自定义组件表（模块级常量，引用不变）。 */
export const MARKDOWN_COMPONENTS = {
  a: MarkdownLink,
  img: MarkdownImage,
  pre: MarkdownPre,
  code: MarkdownCode,
  table: MarkdownTable,
  [CITATION_TAG]: MarkdownCitation,
} as const
