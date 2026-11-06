/**
 * Sources 与 Citation：AI 回复的引用来源（自己写，不用 X 的 Sources：它的行内弹层用 antd 的 Popover 与轮播，
 * 链接不检查协议，列表只有标题，也不能显示域名与说明）。
 *
 * - 来源列表：默认收起为「N 个来源」，展开后是有编号的列表（标题、站点域名、说明）；
 * - 行内引用：上标编号，悬停或键盘聚焦时弹出卡片（标题、域名、说明）；有安全地址时编号本身就是链接；
 * - 链接走协议白名单与 rel（safe-url.ts）；不自动加载远程网站图标（同样可以把数据带出去），图标只能由使用方传入。
 */
import { type KeyboardEvent, type ReactNode, useId, useState } from 'react'
import { useT } from '../../i18n/index.ts'
import { Icon } from '../Icon.tsx'
import type { BaseProps } from '../layout.tsx'
import { Popover } from '../overlays.tsx'
import hidden from '../visually-hidden.module.css'
import { hostOf, safeLink } from './safe-url.ts'
import styles from './sources.module.css'

/**
 * One source of Sources and Citation.
 * @zh Sources 与 Citation 中的一个来源。
 */
export interface SourceItem {
  /**
   * Stable key; the index is used when omitted.
   * @zh 稳定的标识；省略时用序号。
   */
  readonly key?: string
  /**
   * Title of the page or document.
   * @zh 网页或文档的标题。
   */
  readonly title: string
  /**
   * Address. Only http, https, mailto and relative addresses become links (others are shown as text); the site
   * name is taken from it.
   * @zh 地址。只有 http、https、mailto 与相对地址会成为链接（其他的显示为文字）；站点域名从中取得。
   */
  readonly url?: string
  /**
   * A short excerpt or summary.
   * @zh 简短的摘录或摘要。
   */
  readonly description?: string
  /**
   * An icon for the site, provided by the application (such as an image from its own server). Remote site icons
   * are never loaded automatically.
   * @zh 站点图标，由使用方提供（如自己服务器上的图片）。不会自动加载远程网站的图标。
   */
  readonly icon?: ReactNode
}

/**
 * Props of Sources.
 * @zh Sources 属性。
 */
export interface SourcesProps extends Pick<BaseProps, 'testId'> {
  /**
   * The sources, in the order of their numbers (the first is 1).
   * @zh 来源，按编号顺序排列（第一个是 1）。
   */
  readonly items: readonly SourceItem[]
  /**
   * Shows the list expanded at first.
   * @zh 一开始就展开列表。
   * @default false
   */
  readonly defaultExpanded?: boolean
}

/** 来源的标题：有安全地址时是链接（外部链接在新标签页打开）。 */
function SourceTitle(props: { readonly source: SourceItem; readonly className?: string }) {
  const t = useT()
  const link = safeLink(props.source.url)
  if (!link) return <span className={props.className}>{props.source.title}</span>
  return (
    <a
      className={props.className}
      href={link.href}
      target={link.external ? '_blank' : undefined}
      rel={link.external ? 'noopener noreferrer' : undefined}
    >
      {props.source.title}
      {link.external && <span className={hidden.hidden}> ({t('markdown.newTab')})</span>}
    </a>
  )
}

/**
 * The sources of an AI reply: collapsed to "3 sources" at first, and a numbered list with the title, the site and
 * a short description of each when expanded. The numbers match the inline Citation markers.
 *
 * **Interaction**: the header is a button: hover and press add the state layer, `Tab` shows the focus ring,
 * `Enter` / `Space` expand and collapse the list, and it has `aria-expanded` and `aria-controls`. Titles with a safe
 * address are links (other sites open in a new tab with `rel="noopener noreferrer"`); addresses with other
 * protocols are shown as text. Remote site icons are never loaded automatically.
 * @zh AI 回复的引用来源：一开始收起为「3 个来源」，展开后是有编号的列表，每项有标题、站点与简短说明。编号与行内引用
 * Citation 的编号一致。
 *
 * **交互**：标题是按钮：悬停、按下叠加状态层，`Tab` 聚焦显示焦点环，`Enter` / `Space` 展开、收起，带
 * `aria-expanded` 与 `aria-controls`。地址安全的标题是链接（其他网站在新标签页打开，带
 * `rel="noopener noreferrer"`），其他协议的地址显示为文字。不会自动加载远程网站的图标。
 * @category AI
 * @usage Sources under an AI answer, search results that back a reply, the documents behind a summary
 * @usageZh AI 回答下方的引用来源、支撑回复的搜索结果、摘要所依据的文档
 */
export function Sources(props: SourcesProps) {
  const t = useT()
  const listId = useId()
  const [expanded, setExpanded] = useState(props.defaultExpanded ?? false)
  const count = props.items.length
  if (count === 0) return null
  return (
    <div className={styles.sources} data-testid={props.testId}>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={expanded}
        aria-controls={listId}
        onClick={() => setExpanded((v) => !v)}
      >
        <Icon name="link" size={14} />
        <span>{count === 1 ? t('sources.one') : t('sources.other', { count })}</span>
        <span className={styles.chevron}>
          <Icon name="chevron-right" size={14} />
        </span>
      </button>
      <ol id={listId} className={styles.list} hidden={!expanded}>
        {props.items.map((item, i) => {
          const host = hostOf(item.url)
          return (
            <li key={item.key ?? i} className={styles.item}>
              <span className={styles.index}>{i + 1}</span>
              <div className={styles.body}>
                <div className={styles.line}>
                  {item.icon && <span className={styles.icon}>{item.icon}</span>}
                  <SourceTitle source={item} className={styles.title} />
                  {host && <span className={styles.host}>{host}</span>}
                </div>
                {item.description && <p className={styles.description}>{item.description}</p>}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/**
 * Props of Citation.
 * @zh Citation 属性。
 */
export interface CitationProps {
  /**
   * The number shown, usually the position of the source in Sources (starting at 1).
   * @zh 显示的编号，通常是来源在 Sources 中的位置（从 1 开始）。
   */
  readonly index: number
  /**
   * The source it refers to.
   * @zh 引用的来源。
   */
  readonly source: SourceItem
}

/** 引用弹出的卡片：标题、域名、说明。 */
function CitationCard(props: { readonly source: SourceItem }) {
  const host = hostOf(props.source.url)
  return (
    <div className={styles.card} data-citation-card="">
      <div className={styles.cardTitle}>{props.source.title}</div>
      {host && (
        <div className={styles.cardHost}>
          {props.source.icon && <span className={styles.icon}>{props.source.icon}</span>}
          {host}
        </div>
      )}
      {props.source.description && (
        <p className={styles.cardDescription}>{props.source.description}</p>
      )}
    </div>
  )
}

/**
 * An inline citation marker, such as a superscript 1 after a sentence, that shows its source on hover or focus.
 * Markdown renders `[1]` as a Citation when it is given `sources`.
 *
 * **Interaction**: hovering or focusing it with `Tab` shows a popover with the title, the site and the description
 * of the source, and leaving or `Esc` hides it; it does not move focus. With a safe address the marker is a link
 * to the source (other sites open in a new tab with `rel="noopener noreferrer"`); otherwise it is a button that
 * only shows the popover. Screen readers read "Source 1: title".
 * @zh 行内引用标记，如句末的上标 1，悬停或聚焦时显示它的来源。Markdown 设置了 `sources` 时把 `[1]` 渲染为 Citation。
 *
 * **交互**：悬停或用 `Tab` 聚焦时弹出卡片，显示来源的标题、站点与说明，离开或按 `Esc` 隐藏；不移动焦点。地址安全时编号本身
 * 是指向来源的链接（其他网站在新标签页打开，带 `rel="noopener noreferrer"`），否则是只显示卡片的按钮。读屏读出
 * 「来源 1：标题」。
 * @category AI
 * @usage Numbered citations in AI answers, footnote-style references in generated text
 * @usageZh AI 回答中的编号引用、生成文字中脚注式的引用
 */
export function Citation(props: CitationProps) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const link = safeLink(props.source.url)
  const label = t('citation.label', { index: props.index, title: props.source.title })
  // 悬停、聚焦出现的内容要能不移开指针就关掉（WCAG 1.4.13）：Esc 关闭
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && open) {
      e.stopPropagation()
      setOpen(false)
    }
  }
  const marker = link ? (
    <a
      className={styles.marker}
      href={link.href}
      target={link.external ? '_blank' : undefined}
      rel={link.external ? 'noopener noreferrer' : undefined}
      aria-label={label}
      data-citation={props.index}
      onKeyDown={onKeyDown}
    >
      {props.index}
    </a>
  ) : (
    <button
      type="button"
      className={styles.marker}
      aria-label={label}
      data-citation={props.index}
      onKeyDown={onKeyDown}
    >
      {props.index}
    </button>
  )
  return (
    <sup className={styles.citation}>
      <Popover
        content={<CitationCard source={props.source} />}
        trigger={['hover', 'focus']}
        placement="top"
        open={open}
        onOpenChange={setOpen}
      >
        {marker}
      </Popover>
    </sup>
  )
}
