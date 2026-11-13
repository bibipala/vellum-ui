import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import {
  Avatar,
  Button,
  Checkbox,
  DatePicker,
  Drawer,
  Dropdown,
  type DropdownMenuItem,
  Icon,
  IconButton,
  Inline,
  Input,
  Kbd,
  LinkButton,
  Popover,
  Progress,
  Section,
  Select,
  Stack,
  Text,
  type TextAreaRef,
  Timeline,
  Tooltip,
  useHotkeys,
  useMessage,
} from 'vellum-ui'
import styles from './KanbanBoard.module.css'

// —— Data of the recipe: replace with your API ——

type ColumnKey = 'backlog' | 'todo' | 'progress' | 'review' | 'done'
type LabelKey = 'frontend' | 'backend' | 'design' | 'bug' | 'infra' | 'research' | 'docs' | 'perf'
type Priority = 'urgent' | 'high' | 'medium' | 'low'

/** The columns in board order; `limit` is the work-in-progress limit of the column. */
const COLUMNS: readonly {
  readonly key: ColumnKey
  readonly name: string
  readonly limit?: number
}[] = [
  { key: 'backlog', name: 'Backlog' },
  { key: 'todo', name: 'To do' },
  { key: 'progress', name: 'In progress', limit: 3 },
  { key: 'review', name: 'Review', limit: 2 },
  { key: 'done', name: 'Done' },
]
const columnName = (key: ColumnKey) => COLUMNS.find((c) => c.key === key)?.name ?? key

/** Each label keeps one color of the chart palette: the CSS turns `data-tone="3"` into `--vl-color-chart-3`. */
const LABELS: Record<LabelKey, { readonly name: string; readonly tone: number }> = {
  frontend: { name: 'Frontend', tone: 1 },
  backend: { name: 'Backend', tone: 7 },
  design: { name: 'Design', tone: 5 },
  bug: { name: 'Bug', tone: 8 },
  infra: { name: 'Infra', tone: 3 },
  research: { name: 'Research', tone: 4 },
  docs: { name: 'Docs', tone: 6 },
  perf: { name: 'Performance', tone: 2 },
}
const LABEL_KEYS = Object.keys(LABELS) as LabelKey[]

const PRIORITIES: Record<Priority, { readonly name: string; readonly bars: number }> = {
  urgent: { name: 'Urgent', bars: 3 },
  high: { name: 'High', bars: 3 },
  medium: { name: 'Medium', bars: 2 },
  low: { name: 'Low', bars: 1 },
}

const MEMBERS = ['Riley Chen', 'Sam Lee', 'Jordan Park', 'Taylor Kim', 'Morgan Diaz']
const ME = 'Riley Chen'

interface Activity {
  readonly who: string
  readonly text: string
  readonly when: string
  readonly comment?: boolean
}

interface Card {
  readonly id: string
  readonly column: ColumnKey
  readonly title: string
  readonly description?: string
  readonly labels: readonly LabelKey[]
  readonly assignees: readonly string[]
  readonly priority: Priority
  /** An ISO date, or null without a due date. */
  readonly due: string | null
  readonly checklist: readonly { readonly text: string; readonly done: boolean }[]
  readonly attachments: number
  readonly activity: readonly Activity[]
}

/** A checklist whose first `done` steps are checked. */
const steps = (done: number, ...texts: string[]) =>
  texts.map((text, i) => ({ text, done: i < done }))
const created = (who: string, when: string): Activity => ({ who, text: 'created this card', when })
const said = (who: string, text: string, when: string): Activity => ({
  who,
  text,
  when,
  comment: true,
})

/** A card on one line: id, column, title, labels, assignees, priority, and the due day in November. */
type Row = readonly [
  string,
  ColumnKey,
  string,
  readonly LabelKey[],
  readonly string[],
  Priority,
  number?,
]

// The order of the rows is the order of the cards inside each column
// biome-ignore format: one card per line reads as a table
const ROWS: readonly Row[] = [
  ['ATL-231', 'backlog', 'Spike: offline drafts with IndexedDB', ['research', 'frontend'], [], 'low'],
  ['ATL-228', 'backlog', 'Audit the contrast of chart tooltips', ['design'], ['Morgan Diaz'], 'low'],
  ['ATL-224', 'backlog', 'Document the webhook retry policy', ['docs', 'backend'], ['Taylor Kim'], 'medium', 27],
  ['ATL-219', 'todo', 'Rate-limit the public search endpoint', ['backend', 'infra'], ['Jordan Park'], 'high', 18],
  ['ATL-217', 'todo', 'Empty states for the project list', ['design', 'frontend'], ['Morgan Diaz', 'Sam Lee'], 'medium', 20],
  ['ATL-214', 'todo', 'Flaky upload test on Safari', ['bug'], ['Sam Lee'], 'high', 12],
  ['ATL-209', 'progress', 'Billing settings on the new form layout', ['frontend'], ['Riley Chen'], 'medium', 17],
  ['ATL-207', 'progress', 'Session expires during long uploads', ['bug', 'backend'], ['Jordan Park'], 'urgent', 11],
  ['ATL-205', 'progress', 'Warm the dashboard cache after deploys', ['infra', 'perf'], ['Taylor Kim'], 'medium'],
  ['ATL-203', 'progress', 'Keyboard shortcut help overlay', ['frontend', 'design'], ['Sam Lee', 'Riley Chen'], 'low', 14],
  ['ATL-198', 'review', 'Dark mode for the invoice PDF preview', ['design', 'frontend'], ['Morgan Diaz'], 'medium', 13],
  ['ATL-196', 'review', 'Paginate the audit log API', ['backend'], ['Jordan Park', 'Taylor Kim'], 'high', 15],
  ['ATL-192', 'done', 'Fix the double submit on sign-up', ['bug'], ['Sam Lee'], 'high'],
  ['ATL-190', 'done', 'Move the charts to the new palette', ['frontend', 'design'], ['Riley Chen'], 'medium'],
  ['ATL-187', 'done', 'P95 latency alert for the API gateway', ['infra'], ['Taylor Kim'], 'medium'],
  ['ATL-185', 'done', 'Interview notes: admin onboarding', ['research', 'docs'], ['Morgan Diaz'], 'low'],
]

/** What some cards have beyond their row: a description, a checklist, attachments and comments. */
const EXTRAS: Record<string, Partial<Card>> = {
  'ATL-219': {
    checklist: steps(0, 'Pick the limits per plan', 'Add the middleware', 'Return Retry-After'),
  },
  'ATL-217': { attachments: 3 },
  'ATL-214': {
    attachments: 1,
    activity: [
      created('Sam Lee', 'Nov 7'),
      said('Jordan Park', 'Fails one run in five on CI.', 'Nov 10'),
    ],
  },
  'ATL-209': {
    description:
      'Move the billing page to Section and SettingRow and drop the old two-column grid.',
    checklist: steps(3, 'Plan and seats', 'Payment method', 'Invoices', 'Tax details', 'Clean up'),
    attachments: 1,
    activity: [
      created('Riley Chen', 'Nov 6'),
      said('Morgan Diaz', 'The invoice table should keep its sticky header.', 'Nov 11'),
      said('Riley Chen', 'Done, and the totals line up again.', 'Nov 12'),
    ],
  },
  'ATL-207': {
    description: 'Uploads over 20 minutes fail with a 401: the token is not refreshed meanwhile.',
    checklist: steps(1, 'Reproduce with a 2 GB file', 'Refresh during uploads', 'Regression test'),
    attachments: 2,
    activity: [
      created('Taylor Kim', 'Nov 5'),
      said('Jordan Park', 'Reproduced: the refresh timer pauses in hidden tabs.', 'Yesterday'),
    ],
  },
  'ATL-205': { checklist: steps(2, 'Job definition', 'Run after deploys', 'Metrics', 'Alerting') },
  'ATL-198': {
    checklist: steps(4, 'Colors', 'Logo variant', 'Print styles', 'Screenshots'),
    attachments: 4,
  },
  'ATL-196': {
    checklist: steps(3, 'Cursor pagination', 'Client update', 'Docs'),
    activity: [
      created('Jordan Park', 'Oct 29'),
      said('Taylor Kim', 'One question on the cursors.', '2 h ago'),
    ],
  },
  'ATL-190': { checklist: steps(3, 'Line', 'Bar', 'Donut') },
  'ATL-185': { attachments: 5 },
}

const CARDS: readonly Card[] = ROWS.map(
  ([id, column, title, labels, assignees, priority, day]) => ({
    id,
    column,
    title,
    labels,
    assignees,
    priority,
    due: day ? `2026-11-${String(day).padStart(2, '0')}` : null,
    checklist: [],
    attachments: 0,
    activity: [created(assignees[0] ?? 'Sam Lee', 'Nov 4')],
    ...EXTRAS[id],
  }),
)

// A fixed "today", so that overdue cards stay overdue in the demo; use the real date in your application
const TODAY = '2026-11-13'
const SPRINT = { name: 'Sprint 47', start: '2026-11-10', end: '2026-11-21' }

const shortDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})
const formatDate = (iso: string) => shortDate.format(new Date(`${iso}T00:00:00Z`))
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000)

/** Overdue, due today, due within two days, or later. */
function dueState(card: Card) {
  if (!card.due || card.column === 'done') return 'later'
  const days = daysBetween(TODAY, card.due)
  return days < 0 ? 'overdue' : days === 0 ? 'today' : days <= 2 ? 'soon' : 'later'
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Moves a card into `column`, before the card `before`, or at the end of the column. Only the order of the cards
 * of one column matters, so "at the end of the column" is simply the end of the list.
 */
function place(list: readonly Card[], id: string, column: ColumnKey, before: string | null) {
  const card = list.find((c) => c.id === id)
  if (!card) return list
  const rest = list.filter((c) => c.id !== id)
  const at = before ? rest.findIndex((c) => c.id === before) : -1
  const index = at < 0 ? rest.length : at
  return [...rest.slice(0, index), { ...card, column }, ...rest.slice(index)]
}

// —— Small parts of a card ——

function LabelChip({ label }: { readonly label: LabelKey }) {
  return (
    <span className={styles.label} data-tone={LABELS[label].tone}>
      {LABELS[label].name}
    </span>
  )
}

/** Signal bars for the priority, an alert icon for urgent work. */
function PriorityMark({ priority }: { readonly priority: Priority }) {
  return (
    <span
      className={styles.priority}
      data-priority={priority}
      title={`${PRIORITIES[priority].name} priority`}
    >
      {priority === 'urgent' ? (
        <Icon name="alert" size={14} tone="danger" />
      ) : (
        [1, 2, 3].map((n) => <span key={n} data-on={n <= PRIORITIES[priority].bars || undefined} />)
      )}
    </span>
  )
}

function Assignees({ names, size }: { readonly names: readonly string[]; readonly size: number }) {
  return (
    <span className={styles.faces}>
      {names.map((n) => (
        <span key={n} className={styles.face} title={n}>
          <Avatar name={n} size={size} />
        </span>
      ))}
    </span>
  )
}

// —— The page ——

/**
 * Kanban board
 * The sprint board of a product team: a full-bleed board of columns that scrolls sideways on the sunken
 * background, with dense cards colored by their labels (the chart palette), work-in-progress limits that turn into
 * a warning, and a detail drawer. Cards move with drag and drop, with a "Move to" menu, or from the keyboard
 * (`Alt` + arrows on a focused card); a column adds cards inline, and the header filters by assignee, by label and
 * by text. The board is a CSS Module of its own made only of tokens; the controls, menus, the Drawer, the checklist
 * and the activity Timeline are library components.
 * @zh 看板
 * 产品团队的迭代看板：在凹陷背景上横向滚动、铺满宽度的列，紧凑的卡片按标签着色（图表色板），超出在制品上限的列给出
 * 警告，详情在抽屉中查看。卡片可以拖放、用「移动到」菜单，或在聚焦后用键盘（`Alt` + 方向键）移动；每列底部可直接
 * 添加卡片，顶部按成员、标签与文字筛选。看板本身是只用令牌写成的 CSS Module；控件、菜单、Drawer、检查清单与动态
 * Timeline 都是组件库的组件。
 * @level scenario
 */
export function KanbanBoard() {
  const message = useMessage()
  const [cards, setCards] = useState<readonly Card[]>(CARDS)
  const [query, setQuery] = useState('')
  const [people, setPeople] = useState<readonly string[]>([])
  const [labels, setLabels] = useState<readonly LabelKey[]>([])
  const [composing, setComposing] = useState<ColumnKey | null>(null)
  const [draft, setDraft] = useState('')
  const [dropTarget, setDropTarget] = useState<ColumnKey | null>(null)
  const [announcement, setAnnouncement] = useState('')
  // The drawer keeps showing its card while it closes, so the id and `open` are separate
  const [openId, setOpenId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const nextId = useRef(232)
  const cardRefs = useRef(new Map<string, HTMLButtonElement>())
  const refocus = useRef<string | null>(null)
  const composer = useRef<TextAreaRef>(null)
  const search = useRef<HTMLDivElement>(null)

  useHotkeys('n', () => setComposing('todo'), { description: 'New card' })
  useHotkeys('/', () => search.current?.querySelector('input')?.focus(), {
    description: 'Search cards',
  })

  // A card moved from the keyboard is rendered again in its new column: give it the focus back
  useEffect(() => {
    const id = refocus.current
    refocus.current = null
    if (id) cardRefs.current.get(id)?.focus()
  })
  useEffect(() => {
    if (composing) composer.current?.focus()
  }, [composing])

  const text = query.trim().toLowerCase()
  const filtering = Boolean(text || people.length || labels.length)
  const matches = (c: Card) =>
    (!text || c.title.toLowerCase().includes(text) || c.id.toLowerCase().includes(text)) &&
    (!people.length || c.assignees.some((a) => people.includes(a))) &&
    (!labels.length || c.labels.some((l) => labels.includes(l)))
  const visible = cards.filter(matches)
  const done = cards.filter((c) => c.column === 'done').length
  const daysLeft = daysBetween(TODAY, SPRINT.end)
  const opened = cards.find((c) => c.id === openId)

  function move(id: string, column: ColumnKey, before: string | null = null) {
    const card = cards.find((c) => c.id === id)
    if (!card) return
    const target = COLUMNS.find((c) => c.key === column)
    const count = cards.filter((c) => c.column === column && c.id !== id).length + 1
    setCards((list) => place(list, id, column, before))
    setAnnouncement(`${id} moved to ${columnName(column)}`)
    if (card.column !== column && target?.limit && count > target.limit)
      message.warning(`${target.name} is over its limit of ${target.limit} cards`)
  }

  function onCardKey(e: KeyboardEvent<HTMLButtonElement>, card: Card) {
    if (!e.altKey) return
    const col = COLUMNS.findIndex((c) => c.key === card.column)
    const siblings = cards.filter((c) => c.column === card.column)
    const i = siblings.findIndex((c) => c.id === card.id)
    let next: [ColumnKey, string | null] | null = null
    if (e.key === 'ArrowLeft' && col > 0) next = [COLUMNS[col - 1]?.key ?? card.column, null]
    if (e.key === 'ArrowRight' && col < COLUMNS.length - 1)
      next = [COLUMNS[col + 1]?.key ?? card.column, null]
    if (e.key === 'ArrowUp' && i > 0) next = [card.column, siblings[i - 1]?.id ?? null]
    if (e.key === 'ArrowDown' && i < siblings.length - 1)
      next = [card.column, siblings[i + 2]?.id ?? null]
    if (!next) return
    e.preventDefault()
    refocus.current = card.id
    move(card.id, ...next)
  }

  function update(id: string, patch: Partial<Card>) {
    setCards((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  function remove(card: Card) {
    const before = cards
    setDrawerOpen(false)
    setCards((list) => list.filter((c) => c.id !== card.id))
    message.undoable({ content: `Deleted ${card.id}`, onUndo: () => setCards(before) })
  }

  function addCard(column: ColumnKey) {
    const title = draft.trim()
    if (!title) return
    const id = `ATL-${nextId.current++}`
    const card: Card = {
      id,
      column,
      title,
      labels: [],
      assignees: [],
      priority: 'medium',
      due: null,
      checklist: [],
      attachments: 0,
      activity: [created(ME, 'just now')],
    }
    setCards((list) => [...list, card])
    setDraft('')
    setAnnouncement(`Added ${id} to ${columnName(column)}`)
  }

  function open(id: string) {
    setOpenId(id)
    setDrawerOpen(true)
  }

  const menuOf = (card: Card): DropdownMenuItem[] => [
    { key: 'open', label: 'Open card', icon: 'external-link' },
    { type: 'divider' },
    ...COLUMNS.filter((c) => c.key !== card.column).map((c) => ({
      key: `move:${c.key}`,
      label: `Move to ${c.name}`,
      icon: 'arrow-right' as const,
    })),
    { type: 'divider' },
    { key: 'delete', label: 'Delete', icon: 'trash', danger: true },
  ]

  function onMenu(card: Card, key: string) {
    if (key === 'open') open(card.id)
    else if (key === 'delete') remove(card)
    else move(card.id, key.slice('move:'.length) as ColumnKey)
  }

  return (
    <div className={styles.board}>
      <header className={styles.header}>
        <div className={styles.identity}>
          <span className={styles.boardIcon}>
            <Icon name="kanban" size={18} />
          </span>
          <div className={styles.titleBlock}>
            <h1 className={styles.boardName}>Atlas web app</h1>
            <Text size="xs" tone="secondary" numeric>
              {SPRINT.name} · {formatDate(SPRINT.start)} to {formatDate(SPRINT.end)} · {daysLeft}{' '}
              days left
            </Text>
          </div>
          <div className={styles.sprintMeter}>
            <Progress
              size="sm"
              percent={Math.round((done / cards.length) * 100)}
              aria-label="Sprint progress"
            />
          </div>
        </div>

        <div className={styles.filters}>
          {/* Toggle buttons: aria-pressed tells screen readers which people filter the board */}
          <fieldset className={styles.people}>
            <legend className={styles.srOnly}>Filter by assignee</legend>
            {MEMBERS.map((m) => (
              <Tooltip key={m} title={m}>
                <button
                  type="button"
                  className={styles.person}
                  data-vl-state=""
                  aria-pressed={people.includes(m)}
                  aria-label={m}
                  onClick={() =>
                    setPeople((list) =>
                      list.includes(m) ? list.filter((p) => p !== m) : [...list, m],
                    )
                  }
                >
                  <Avatar name={m} size={28} />
                </button>
              </Tooltip>
            ))}
          </fieldset>
          <Popover
            trigger="click"
            placement="bottomRight"
            title="Filter by label"
            content={
              <Checkbox.Group
                options={LABEL_KEYS.map((l) => ({ value: l, label: <LabelChip label={l} /> }))}
                value={labels}
                onChange={setLabels}
              />
            }
          >
            <Button size="sm" icon="filter">
              {labels.length ? `Labels · ${labels.length}` : 'Labels'}
            </Button>
          </Popover>
          <div className={styles.search} ref={search}>
            <Input.Search
              size="sm"
              allowClear
              placeholder="Search cards"
              aria-label="Search cards"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Button size="sm" variant="primary" icon="plus" onClick={() => setComposing('todo')}>
            New card
          </Button>
        </div>
      </header>

      <div className={styles.subbar}>
        {filtering ? (
          <Inline gap={2}>
            <Text size="sm" tone="secondary" numeric>
              Showing {visible.length} of {cards.length} cards
            </Text>
            <LinkButton
              onClick={() => {
                setQuery('')
                setPeople([])
                setLabels([])
              }}
            >
              Clear filters
            </LinkButton>
          </Inline>
        ) : (
          <Text size="sm" tone="secondary" numeric>
            {done} of {cards.length} cards done
          </Text>
        )}
        <span className={styles.hint} id="kanban-hint">
          <Text size="xs" tone="tertiary">
            Move a focused card
          </Text>
          <Kbd keys={['Alt', '←', '→']} />
          <Text size="xs" tone="tertiary">
            reorder
          </Text>
          <Kbd keys={['Alt', '↑', '↓']} />
        </span>
      </div>

      {/* The lanes scroll sideways; each column scrolls its own cards */}
      <div className={styles.lanes}>
        {COLUMNS.map((col) => {
          const all = cards.filter((c) => c.column === col.key)
          const shown = all.filter(matches)
          const over = col.limit !== undefined && all.length > col.limit
          const headingId = `kanban-${col.key}`
          return (
            <section
              key={col.key}
              className={styles.column}
              data-column={col.key}
              data-over={over || undefined}
              data-drop={dropTarget === col.key || undefined}
              aria-labelledby={headingId}
              onDragOver={(e) => {
                e.preventDefault()
                setDropTarget(col.key)
              }}
              onDrop={(e) => {
                e.preventDefault()
                setDropTarget(null)
                move(e.dataTransfer.getData('text/plain'), col.key)
              }}
            >
              <header className={styles.columnHead}>
                <span className={styles.columnDot} />
                <h2 className={styles.columnName} id={headingId}>
                  {col.name}
                </h2>
                <Tooltip
                  title={
                    col.limit
                      ? `${all.length} cards, limit ${col.limit}${over ? ': finish work before starting more' : ''}`
                      : `${all.length} cards`
                  }
                >
                  {/* biome-ignore lint/a11y/noNoninteractiveTabindex: focusable so that keyboard users get the tooltip */}
                  <span className={styles.count} data-over={over || undefined} tabIndex={0}>
                    {filtering ? `${shown.length}/${all.length}` : all.length}
                    {col.limit !== undefined && (
                      <span className={styles.limit}> max {col.limit}</span>
                    )}
                  </span>
                </Tooltip>
                <span className={styles.columnAdd}>
                  <IconButton
                    icon="plus"
                    size="sm"
                    label={`Add a card to ${col.name}`}
                    onClick={() => setComposing(col.key)}
                  />
                </span>
              </header>

              <ol className={styles.cards}>
                {shown.map((card) => {
                  const due = dueState(card)
                  const checked = card.checklist.filter((s) => s.done).length
                  const comments = card.activity.filter((a) => a.comment).length
                  return (
                    <li key={card.id} className={styles.cardItem}>
                      <button
                        type="button"
                        ref={(el) => {
                          if (el) cardRefs.current.set(card.id, el)
                          else cardRefs.current.delete(card.id)
                        }}
                        className={styles.card}
                        data-vl-state=""
                        data-tone={card.labels[0] ? LABELS[card.labels[0]].tone : undefined}
                        data-done={card.column === 'done' || undefined}
                        aria-label={`${card.id}: ${card.title}, ${PRIORITIES[card.priority].name} priority${card.due ? `, due ${formatDate(card.due)}` : ''}`}
                        aria-describedby="kanban-hint"
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('text/plain', card.id)}
                        onDragEnd={() => setDropTarget(null)}
                        onClick={() => open(card.id)}
                        onKeyDown={(e) => onCardKey(e, card)}
                      >
                        {card.labels.length > 0 && (
                          <span className={styles.labels}>
                            {card.labels.map((l) => (
                              <LabelChip key={l} label={l} />
                            ))}
                          </span>
                        )}
                        <span className={styles.cardTitle}>{card.title}</span>
                        {card.checklist.length > 0 && (
                          <span className={styles.checklist}>
                            <span className={styles.pips}>
                              {card.checklist.map((s, n) => (
                                <span key={s.text} data-on={n < checked || undefined} />
                              ))}
                            </span>
                            <Text size="2xs" tone="tertiary" numeric>
                              {checked}/{card.checklist.length}
                            </Text>
                          </span>
                        )}
                        <span className={styles.meta}>
                          <span className={styles.cardId}>{card.id}</span>
                          {card.column === 'done' ? (
                            <Icon name="check-circle" size={14} tone="success" />
                          ) : (
                            <PriorityMark priority={card.priority} />
                          )}
                          {card.due && card.column !== 'done' && (
                            <span className={styles.due} data-due={due}>
                              <Icon name="calendar" size={12} />
                              {due === 'today' ? 'Today' : formatDate(card.due)}
                            </span>
                          )}
                          <span className={styles.counts}>
                            {comments > 0 && (
                              <span className={styles.stat}>
                                <Icon name="message" size={12} />
                                {comments}
                              </span>
                            )}
                            {card.attachments > 0 && (
                              <span className={styles.stat}>
                                <Icon name="attach" size={12} />
                                {card.attachments}
                              </span>
                            )}
                          </span>
                          <Assignees names={card.assignees} size={20} />
                        </span>
                      </button>
                      {/* The menu sits on the card, not in it: a button cannot contain another one */}
                      <span className={styles.cardMenu}>
                        <Dropdown
                          trigger={['click']}
                          placement="bottomRight"
                          menu={{ items: menuOf(card), onClick: ({ key }) => onMenu(card, key) }}
                        >
                          <IconButton
                            icon="more"
                            size="sm"
                            label={`Actions for ${card.id}`}
                            tooltip={false}
                          />
                        </Dropdown>
                      </span>
                    </li>
                  )
                })}
                {shown.length === 0 && composing !== col.key && (
                  <li className={styles.emptyColumn}>
                    <Text size="sm" tone="tertiary">
                      {filtering && all.length ? 'No cards match the filters' : 'Drop cards here'}
                    </Text>
                  </li>
                )}
              </ol>

              {composing === col.key ? (
                <form
                  className={styles.composer}
                  onSubmit={(e) => {
                    e.preventDefault()
                    addCard(col.key)
                  }}
                >
                  <Input.TextArea
                    ref={composer}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    autoSize={{ minRows: 2, maxRows: 5 }}
                    placeholder="What needs to be done?"
                    aria-label={`New card in ${col.name}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setComposing(null)
                      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                        e.preventDefault()
                        addCard(col.key)
                      }
                    }}
                  />
                  <Inline gap={1}>
                    <Button size="sm" variant="primary" type="submit" disabled={!draft.trim()}>
                      Add card
                    </Button>
                    <Button size="sm" variant="text" onClick={() => setComposing(null)}>
                      Cancel
                    </Button>
                  </Inline>
                </form>
              ) : (
                <button
                  type="button"
                  className={styles.addCard}
                  data-vl-state=""
                  onClick={() => setComposing(col.key)}
                >
                  <Icon name="plus" size={14} />
                  Add card
                </button>
              )}
            </section>
          )
        })}
      </div>

      <p className={styles.srOnly} aria-live="polite">
        {announcement}
      </p>

      <Drawer
        title={opened ? opened.id : 'Card'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={460}
        footer={
          opened && (
            <Inline justify="between">
              <Button tone="danger" variant="text" icon="trash" onClick={() => remove(opened)}>
                Delete
              </Button>
              <Button onClick={() => setDrawerOpen(false)}>Close</Button>
            </Inline>
          )
        }
      >
        {opened && <CardDetails card={opened} onChange={(patch) => update(opened.id, patch)} />}
      </Drawer>
    </div>
  )
}

// —— The detail drawer ——

function CardDetails({
  card,
  onChange,
}: {
  readonly card: Card
  readonly onChange: (patch: Partial<Card>) => void
}) {
  const [step, setStep] = useState('')
  const [comment, setComment] = useState('')
  const [posting, setPosting] = useState(false)
  const checked = card.checklist.filter((s) => s.done).length

  async function post() {
    setPosting(true)
    await wait(600) // A real application sends the comment here
    onChange({
      activity: [
        ...card.activity,
        { who: ME, text: comment.trim(), when: 'just now', comment: true },
      ],
    })
    setComment('')
    setPosting(false)
  }

  return (
    <Stack gap={5}>
      <Stack gap={2}>
        {card.labels.length > 0 && (
          <span className={styles.labels}>
            {card.labels.map((l) => (
              <LabelChip key={l} label={l} />
            ))}
          </span>
        )}
        <h2 className={styles.detailTitle}>{card.title}</h2>
        {card.description && (
          <Text as="p" size="sm" tone="secondary">
            {card.description}
          </Text>
        )}
      </Stack>

      <div className={styles.fields}>
        <Text as="label" size="sm" tone="secondary" htmlFor="kanban-status">
          Status
        </Text>
        <Select
          id="kanban-status"
          block
          value={card.column}
          options={COLUMNS.map((c) => ({ value: c.key, label: c.name }))}
          onChange={(column) => onChange({ column })}
        />
        <Text as="label" size="sm" tone="secondary" htmlFor="kanban-assignees">
          Assignees
        </Text>
        <Select<string>
          id="kanban-assignees"
          block
          multiple
          placeholder="Nobody yet"
          value={card.assignees}
          options={MEMBERS.map((m) => ({ value: m, label: m }))}
          onChange={(assignees) => onChange({ assignees })}
        />
        <Text as="label" size="sm" tone="secondary" htmlFor="kanban-labels">
          Labels
        </Text>
        <Select<LabelKey>
          id="kanban-labels"
          block
          multiple
          placeholder="No labels"
          value={card.labels}
          options={LABEL_KEYS.map((l) => ({ value: l, label: LABELS[l].name }))}
          onChange={(labels) => onChange({ labels })}
        />
        <Text as="label" size="sm" tone="secondary" htmlFor="kanban-priority">
          Priority
        </Text>
        <Select
          id="kanban-priority"
          block
          value={card.priority}
          options={(Object.keys(PRIORITIES) as Priority[]).map((p) => ({
            value: p,
            label: PRIORITIES[p].name,
          }))}
          onChange={(priority) => onChange({ priority })}
        />
        <Text as="label" size="sm" tone="secondary" htmlFor="kanban-due">
          Due
        </Text>
        <DatePicker
          id="kanban-due"
          block
          value={card.due}
          placeholder="No due date"
          onChange={(due) => onChange({ due })}
        />
      </div>

      <Section
        level={4}
        title="Checklist"
        actions={
          <Text size="sm" tone="secondary" numeric>
            {checked} of {card.checklist.length}
          </Text>
        }
      >
        <Stack gap={2}>
          {card.checklist.map((s, i) => (
            <Checkbox
              key={s.text}
              checked={s.done}
              onChange={(done) =>
                onChange({
                  checklist: card.checklist.map((x, n) => (n === i ? { ...x, done } : x)),
                })
              }
            >
              {s.text}
            </Checkbox>
          ))}
          <Input
            size="sm"
            prefix={<Icon name="plus" size={14} tone="tertiary" />}
            placeholder="Add a step and press Enter"
            aria-label="Add a step"
            value={step}
            onChange={(e) => setStep(e.target.value)}
            onPressEnter={() => {
              if (!step.trim()) return
              onChange({ checklist: [...card.checklist, { text: step.trim(), done: false }] })
              setStep('')
            }}
          />
        </Stack>
      </Section>

      <Section level={4} title="Activity">
        <Timeline
          items={card.activity.map((a, i) => ({
            key: String(i),
            tone: a.comment ? 'accent' : 'neutral',
            content: (
              <Stack gap={1}>
                <Inline gap={2}>
                  <Avatar name={a.who} size={20} />
                  <Text size="sm" weight="medium">
                    {a.who}
                  </Text>
                  {!a.comment && (
                    <Text size="sm" tone="secondary">
                      {a.text}
                    </Text>
                  )}
                  <Text size="xs" tone="tertiary">
                    {a.when}
                  </Text>
                </Inline>
                {a.comment && (
                  <Text as="p" size="sm">
                    {a.text}
                  </Text>
                )}
              </Stack>
            ),
          }))}
        />
        <Input.TextArea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          autoSize={{ minRows: 2, maxRows: 6 }}
          placeholder="Write a comment"
          aria-label="Comment"
        />
        <Inline justify="end">
          <Button size="sm" icon="send" loading={posting} disabled={!comment.trim()} onClick={post}>
            Comment
          </Button>
        </Inline>
      </Section>
    </Stack>
  )
}
