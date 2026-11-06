/**
 * 通用命令面板：搜索框 + 结果列表 + 底部按键提示，放在贴边的对话框中。
 *
 * - 匹配用 matchCommands（分词、每个词都要命中、模糊、排序），结果按分组聚在一起（分组按最先出现的顺序）；
 * - 键盘：输入框是 combobox，结果是 listbox，`↑` / `↓` 移动当前项（aria-activedescendant，焦点始终在输入框中），
 *   `Enter` 执行，`Esc` 关闭。这些按键用 useHotkeys 注册在 `commandPalette` 作用域中（面板打开时生效），快捷键帮助
 *   可以列出它们；输入法组字期间的按键不会被当作命令；
 * - 可选的异步 `onSearch`：停止输入 150ms 后调用，新的输入或关闭时通过 AbortSignal 取消上一次；结果排在本地结果之后；
 *   失败时在列表下方提示，并用 reportError 上报（不吞掉异常）；
 * - 结果超过 `limit`（默认 50）时截断，并在列表下方提示还有多少条。
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useT } from '../i18n/index.ts'
import styles from './command-palette.module.css'
import { matchCommands } from './commandMatch.ts'
import { Icon, type IconName } from './Icon.tsx'
import { Input, type InputRef } from './inputs.tsx'
import { Kbd } from './Kbd.tsx'
import type { BaseProps } from './layout.tsx'
import { Modal } from './overlays.tsx'
import { useDelayedPending } from './useDelayedPending.ts'
import { useHotkeys } from './useHotkeys.tsx'

/** 停止输入多久之后调用 onSearch（毫秒）。 */
const SEARCH_DELAY_MS = 150

/**
 * An item of a CommandPalette: a page to go to or an action to run.
 * @zh CommandPalette 的一个条目：要跳转的页面或要执行的操作。
 */
export interface CommandPaletteItem {
  /** Unique id. @zh 唯一编号。 */
  readonly id: string
  /** Title, shown and matched first. @zh 标题，显示并优先匹配。 */
  readonly title: string
  /** Group shown at the end of the row, such as "Pages" or "Actions"; items of a group are kept together. @zh 显示在行末的分组，如「页面」「操作」；同一分组的条目排在一起。 */
  readonly group?: string
  /** Icon at the start of the row. @zh 行首的图标。 */
  readonly icon?: IconName
  /** Extra words that also match, such as synonyms or an English name. @zh 也能命中的其他词，如同义词、英文名。 */
  readonly keywords?: readonly string[]
  /** Shortcut hint shown with Kbd, such as `'mod+n'`. @zh 用 Kbd 显示的快捷键提示，如 `'mod+n'`。 */
  readonly shortcut?: string | readonly string[]
  /** Runs the item; the palette closes first. @zh 执行条目；面板会先关闭。 */
  readonly onSelect?: () => void
}

/**
 * Props of CommandPalette.
 * @zh CommandPalette 属性。
 */
export interface CommandPaletteProps extends Pick<BaseProps, 'testId'> {
  /**
   * Whether the palette is open.
   * @zh 是否打开。
   */
  readonly open: boolean
  /**
   * Called when the palette asks to open or close (`Esc`, clicking outside, running an item).
   * @zh 面板要求打开或关闭时调用（`Esc`、点击外部、执行条目后）。
   */
  readonly onOpenChange: (open: boolean) => void
  /**
   * The items, matched locally while typing (see matchCommands).
   * @zh 条目，输入时在本地匹配（见 matchCommands）。
   */
  readonly items: readonly CommandPaletteItem[]
  /**
   * Searches more items for a query, such as people or files on a server. Called 150 ms after typing stops; the
   * signal is aborted when the query changes or the palette closes. The results are shown after the local
   * matches, as they are (not matched again).
   * @zh 按查询搜索更多条目，如服务器上的人员、文件。停止输入 150ms 后调用；查询变化或面板关闭时 signal 被取消。
   * 结果原样排在本地匹配的结果之后（不再匹配一次）。
   */
  readonly onSearch?: (query: string, signal: AbortSignal) => Promise<readonly CommandPaletteItem[]>
  /**
   * Placeholder of the search field, "Search or run a command" by default (follows `locale`).
   * @zh 搜索框的占位文字，默认「搜索或执行命令」（随 `locale`）。
   */
  readonly placeholder?: string
  /**
   * Text shown when nothing matches, "No results" by default (follows `locale`).
   * @zh 没有匹配结果时的文字，默认「没有匹配的结果」（随 `locale`）。
   */
  readonly emptyText?: string
  /**
   * Accessible name of the dialog and the search field, "Command palette" by default (follows `locale`).
   * @zh 对话框与搜索框的读屏名称，默认「命令面板」（随 `locale`）。
   */
  readonly label?: string
  /**
   * Largest number of results shown; beyond it, a line below the list says how many more there are.
   * @zh 最多显示的结果数；超过时列表下方提示还有多少条。
   * @default 50
   */
  readonly limit?: number
}

type Remote =
  | { readonly status: 'idle' }
  | { readonly status: 'loading'; readonly query: string }
  | {
      readonly status: 'done'
      readonly query: string
      readonly items: readonly CommandPaletteItem[]
    }
  | { readonly status: 'error'; readonly query: string }

const IDLE: Remote = { status: 'idle' }

const isAbort = (error: unknown) =>
  typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError'

/** 把错误交给全局的错误处理（控制台、错误监控）：搜索失败不能被悄悄吞掉。 */
function report(error: unknown) {
  if (typeof globalThis.reportError === 'function') globalThis.reportError(error)
  else console.error(error)
}

/** 同一分组的条目排在一起：分组按最先出现的顺序，组内保持顺序。 */
function byGroup(items: readonly CommandPaletteItem[]): CommandPaletteItem[] {
  const groups = new Map<string, CommandPaletteItem[]>()
  for (const item of items) {
    const key = item.group ?? ''
    const list = groups.get(key)
    if (list) list.push(item)
    else groups.set(key, [item])
  }
  return [...groups.values()].flat()
}

/**
 * A command palette: a search field with a list of pages and actions to jump to or run, usually opened with
 * `Mod+K` (register it with useHotkeys). Matching is fuzzy and every word of the query must match; results of the
 * same group stay together; an optional `onSearch` adds results from a server.
 *
 * **Interaction**: when it opens, focus is in the search field. `↑` / `↓` move the current result (also on
 * hover), `Enter` runs it and `Esc` closes the palette; focus then returns to the element that was focused
 * before. Keys pressed while an input method is composing text are left to the input method. Beyond `limit`
 * results, a line below the list says how many more there are. The key hints at the bottom use Kbd; the keys of
 * the palette are registered with useHotkeys in the `commandPalette` scope, so shortcut help can list them.
 * @zh 通用命令面板：搜索框加页面与操作的结果列表，用于跳转或执行，通常用 `Mod+K` 打开（用 useHotkeys 注册）。
 * 模糊匹配，查询的每个词都要命中；同一分组的结果排在一起；可选的 `onSearch` 加入服务器上的结果。
 *
 * **交互**：打开后焦点在搜索框中。`↑` / `↓` 移动当前项（悬停也会移动），`Enter` 执行，`Esc` 关闭，关闭后焦点回到打开前的元素。
 * 输入法组字期间的按键交给输入法。结果超过 `limit` 条时，列表下方提示还有多少条。底部的按键提示用 Kbd；面板的按键用 useHotkeys
 * 注册在 `commandPalette` 作用域中，快捷键帮助可以列出它们。
 * @category Patterns
 * @usage Global search and jump (`Mod+K`), running actions by name, finding people and files
 * @usageZh 全局搜索与跳转（`Mod+K`）、按名称执行操作、查找人员与文件
 */
export function CommandPalette(props: CommandPaletteProps) {
  const t = useT()
  const { open, onOpenChange, items, testId } = props
  const limit = props.limit ?? 50
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [remote, setRemote] = useState<Remote>(IDLE)
  const input = useRef<InputRef>(null)
  const listId = useId()
  const optionId = (i: number) => `${listId}-option-${i}`
  const search = useRef(props.onSearch)
  search.current = props.onSearch
  const searchable = Boolean(props.onSearch)

  // 每次打开都从空查询开始，焦点放进搜索框（对话框自己的焦点处理在挂载之后，放到下一轮）
  useEffect(() => {
    if (!open) return
    setQuery('')
    setActive(0)
    const timer = setTimeout(() => input.current?.focus(), 0)
    return () => clearTimeout(timer)
  }, [open])

  // 异步搜索：停止输入后调用，查询变化、关闭、卸载时取消上一次
  useEffect(() => {
    const q = query.trim()
    if (!open || !searchable || !q) {
      setRemote(IDLE)
      return
    }
    const controller = new AbortController()
    setRemote({ status: 'loading', query })
    const timer = setTimeout(() => {
      const run = search.current
      if (!run) return
      let pending: Promise<readonly CommandPaletteItem[]>
      try {
        pending = run(query, controller.signal)
      } catch (error) {
        setRemote({ status: 'error', query })
        report(error)
        return
      }
      pending.then(
        (found) => {
          if (!controller.signal.aborted) setRemote({ status: 'done', query, items: found })
        },
        (error: unknown) => {
          if (controller.signal.aborted || isAbort(error)) return
          setRemote({ status: 'error', query })
          report(error)
        },
      )
    }, SEARCH_DELAY_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [open, query, searchable])

  const results = useMemo(() => {
    const local = byGroup(matchCommands(items, query))
    if (remote.status !== 'done' || remote.query !== query) return local
    const seen = new Set(local.map((i) => i.id))
    return [...local, ...remote.items.filter((i) => !seen.has(i.id))]
  }, [items, query, remote])
  const shown = results.length > limit ? results.slice(0, limit) : results
  const hidden = results.length - shown.length
  const current = Math.min(active, Math.max(0, shown.length - 1))
  const loading = remote.status === 'loading' && remote.query === query
  // 「正在搜索」延迟出现、出现后至少显示一会儿（不闪）；加载期间也不显示「没有结果」
  const searching = useDelayedPending(loading)
  const failed = remote.status === 'error' && remote.query === query

  // 键盘移动时让当前项保持在可视范围内
  useEffect(() => {
    if (open) document.getElementById(optionId(current))?.scrollIntoView({ block: 'nearest' })
  })

  const run = (item: CommandPaletteItem | undefined) => {
    if (!item) return
    onOpenChange(false)
    item.onSelect?.()
  }

  const inPalette = { scope: 'commandPalette', enabled: open, allowInInputs: true } as const
  useHotkeys('escape', () => onOpenChange(false), {
    ...inPalette,
    description: t('commandPalette.hotkey.close'),
  })
  useHotkeys(
    ['arrowup', 'arrowdown'],
    (e) =>
      setActive(
        e.key === 'ArrowUp'
          ? Math.max(current - 1, 0)
          : Math.min(current + 1, Math.max(0, shown.length - 1)),
      ),
    { ...inPalette, repeat: true, description: t('commandPalette.hotkey.move') },
  )
  useHotkeys('enter', () => run(shown[current]), {
    ...inPalette,
    description: t('commandPalette.hotkey.open'),
  })

  const label = props.label ?? t('commandPalette.label')
  return (
    <Modal
      open={open}
      onCancel={() => onOpenChange(false)}
      footer={null}
      closable={false}
      title={null}
      width="min(var(--vl-command-palette-width), 92vw)"
      destroyOnHidden
      flush
      aria-label={label}
    >
      <div className={styles.palette} data-testid={testId}>
        <div className={styles.searchRow}>
          <span className={styles.searchIcon}>
            <Icon name="search" size={18} />
          </span>
          <Input
            ref={input}
            size="large"
            variant="borderless"
            role="combobox"
            aria-label={label}
            aria-expanded={shown.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={shown.length ? optionId(current) : undefined}
            placeholder={props.placeholder ?? t('commandPalette.placeholder')}
            value={query}
            data-testid={testId ? `${testId}-input` : undefined}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
          />
          <Kbd keys="esc" />
        </div>
        {shown.length === 0 ? (
          !loading &&
          !searching && (
            <div className={styles.empty}>{props.emptyText ?? t('commandPalette.empty')}</div>
          )
        ) : (
          <div
            className={styles.list}
            id={listId}
            role="listbox"
            aria-label={t('commandPalette.results')}
          >
            {shown.map((item, i) => (
              // biome-ignore lint/a11y/useKeyWithClickEvents: 键盘在搜索框中操作（combobox + aria-activedescendant），选项本身不获得焦点
              <div
                key={item.id}
                id={optionId(i)}
                role="option"
                tabIndex={-1}
                aria-selected={i === current}
                className={styles.item}
                data-active={i === current || undefined}
                onMouseMove={() => {
                  if (i !== current) setActive(i)
                }}
                // 点击时焦点留在搜索框中
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => run(item)}
              >
                {item.icon && (
                  <span className={styles.itemIcon}>
                    <Icon name={item.icon} />
                  </span>
                )}
                <span className={styles.itemTitle}>{item.title}</span>
                {item.shortcut && <Kbd keys={item.shortcut} />}
                {item.group && <span className={styles.itemGroup}>{item.group}</span>}
              </div>
            ))}
          </div>
        )}
        {(hidden > 0 || searching || failed) && (
          <div className={styles.status} role="status">
            {failed
              ? t('commandPalette.searchFailed')
              : searching
                ? t('commandPalette.searching')
                : t('commandPalette.more', { count: hidden })}
          </div>
        )}
        <div className={styles.footer}>
          <span className={styles.hint}>
            <Kbd keys={['↑', '↓']} />
            {t('commandPalette.navigate')}
          </span>
          <span className={styles.hint}>
            <Kbd keys="enter" />
            {t('commandPalette.select')}
          </span>
          <span className={styles.hint}>
            <Kbd keys="esc" />
            {t('commandPalette.close')}
          </span>
        </div>
      </div>
    </Modal>
  )
}
