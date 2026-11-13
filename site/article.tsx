/**
 * The frame of every page of the site, in the editorial style of the DocsArticle recipe: the group of the page above
 * a large title, a lede, the body in a column of a comfortable measure, the previous and next pages at the end, and
 * "On this page" beside it with the section in view marked while scrolling.
 *
 * The outline is read from the rendered headings (`h2`, `h3`), since Markdown and the examples render after their code
 * has loaded; headings inside live examples and recipes (`data-toc-skip`) are left out.
 */
import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react'
import { type DocLanguage, Icon } from 'vellum-ui'
import { hrefOf, type SitePage, slugify } from './routes.ts'
import styles from './site.module.css'
import { TEXT } from './text.ts'

/** A page of the navigation, linked from another page. */
export interface PageLink {
  readonly page: SitePage
  readonly label: string
}

/** Where a page sits in the navigation: the label of its group, and the pages before and after it. */
export interface PageContext {
  readonly group: string | null
  readonly prev: PageLink | null
  readonly next: PageLink | null
}

export const NO_CONTEXT: PageContext = { group: null, prev: null, next: null }

/**
 * The width of the column: `prose` for guides and overviews (a reading measure, the body one step larger),
 * `reference` for component and API pages (wide enough for tables of props), `wide` for recipes (the live page needs
 * the room).
 */
export type ArticleWidth = 'prose' | 'reference' | 'wide'

interface OutlineEntry {
  readonly slug: string
  readonly text: string
  readonly level: 2 | 3
  readonly element: HTMLElement
}

/** The `h2` and `h3` of the body, read again whenever its content changes. */
function useOutline(body: RefObject<HTMLDivElement | null>): OutlineEntry[] {
  const [outline, setOutline] = useState<OutlineEntry[]>([])
  useEffect(() => {
    const root = body.current
    if (!root) return
    const read = () => {
      const next = [...root.querySelectorAll<HTMLElement>('h2, h3')]
        .filter((h) => !h.closest('[data-toc-skip]') && h.textContent?.trim())
        .map((h) => {
          const text = (h.textContent ?? '').trim()
          return {
            slug: slugify(text),
            text,
            level: h.tagName === 'H2' ? 2 : 3,
            element: h,
          } as const
        })
      setOutline((prev) =>
        prev.length === next.length && prev.every((e, i) => e.element === next[i]?.element)
          ? prev
          : next,
      )
    }
    read()
    const observer = new MutationObserver(read)
    observer.observe(root, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [body])
  return outline
}

/**
 * The section in view: the last heading above a line a little below the top of the scrolling area. At the very end
 * of the page the last heading wins, even when it cannot scroll up to that line.
 */
function useActiveSection(
  body: RefObject<HTMLDivElement | null>,
  outline: readonly OutlineEntry[],
): string | null {
  const [active, setActive] = useState<string | null>(null)
  useEffect(() => {
    const scroller = body.current?.closest('main')
    if (!scroller || outline.length === 0) return
    let frame = 0
    const update = () => {
      frame = 0
      const top = scroller.getBoundingClientRect().top + scroller.clientHeight * 0.2
      const atEnd = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2
      let current: OutlineEntry | null = atEnd ? (outline.at(-1) ?? null) : null
      if (!current)
        for (const entry of outline) {
          if (entry.element.getBoundingClientRect().top > top) break
          current = entry
        }
      setActive(current ? current.slug : null)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      scroller.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [body, outline])
  return active
}

function Pager(props: { readonly lang: DocLanguage; readonly context: PageContext }) {
  const t = TEXT[props.lang]
  const { prev, next } = props.context
  if (!prev && !next) return null
  return (
    <nav aria-label={t.pager} className={styles.pager}>
      {prev && (
        <a
          className={styles.pagerLink}
          data-vl-state=""
          data-direction="prev"
          href={hrefOf({ lang: props.lang, page: prev.page })}
        >
          <span className={styles.pagerHint}>
            <Icon name="arrow-left" size={14} />
            {t.previous}
          </span>
          <span className={styles.pagerTitle}>{prev.label}</span>
        </a>
      )}
      {next && (
        <a
          className={styles.pagerLink}
          data-vl-state=""
          data-direction="next"
          href={hrefOf({ lang: props.lang, page: next.page })}
        >
          <span className={styles.pagerHint}>
            {t.next}
            <Icon name="arrow-right" size={14} />
          </span>
          <span className={styles.pagerTitle}>{next.label}</span>
        </a>
      )}
    </nav>
  )
}

export function Article(props: {
  readonly lang: DocLanguage
  readonly page: SitePage
  readonly context: PageContext
  readonly title: ReactNode
  /** The sentence or paragraph under the title, larger and quieter than the body. */
  readonly lede?: ReactNode
  /** Small actions on the right of the title, such as a link to the Markdown source. */
  readonly actions?: ReactNode
  readonly width: ArticleWidth
  readonly children?: ReactNode
}) {
  const t = TEXT[props.lang]
  const body = useRef<HTMLDivElement>(null)
  const outline = useOutline(body)
  const active = useActiveSection(body, outline)
  const hasToc = outline.filter((e) => e.level === 2).length >= 2
  return (
    <div className={styles.doc} data-toc={hasToc || undefined}>
      <article className={styles.article} data-width={props.width}>
        <header className={styles.articleHeader}>
          {props.context.group && <p className={styles.eyebrow}>{props.context.group}</p>}
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{props.title}</h1>
            {props.actions && <div className={styles.titleActions}>{props.actions}</div>}
          </div>
          {props.lede && <div className={styles.lede}>{props.lede}</div>}
        </header>
        <div ref={body} className={styles.articleBody}>
          {props.children}
        </div>
        <Pager lang={props.lang} context={props.context} />
      </article>
      {hasToc && (
        <aside className={styles.toc} aria-labelledby="vl-docs-toc-title">
          <p id="vl-docs-toc-title" className={styles.tocTitle}>
            {t.onThisPage}
          </p>
          <ul className={styles.tocList}>
            {outline.map((e) => (
              <li key={`${e.slug}-${e.level}`}>
                <a
                  className={styles.tocLink}
                  data-level={e.level}
                  aria-current={active === e.slug ? 'location' : undefined}
                  href={hrefOf({ lang: props.lang, page: props.page, anchor: e.slug })}
                >
                  {e.text}
                </a>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  )
}
