import { useEffect, useRef, useState } from 'react'
import {
  Avatar,
  Button,
  Checkbox,
  DatePicker,
  Form,
  Grid,
  Heading,
  Icon,
  IconButton,
  Inline,
  Input,
  Modal,
  Popover,
  Segmented,
  Select,
  Stack,
  Text,
  TimePicker,
  useConfirmDanger,
  useHotkeys,
  useMessage,
} from 'vellum-ui'
import styles from './CalendarWeek.module.css'

// —— Data of the recipe: replace with your API ——

type CalendarId = 'product' | 'design' | 'engineering' | 'marketing' | 'personal' | 'away'

interface Calendar {
  readonly id: CalendarId
  readonly name: string
  /** A color of the chart palette, as its number: the CSS turns `data-calendar-tone="3"` into `--vl-color-chart-3`. */
  readonly tone: 1 | 2 | 3 | 4 | 5 | 7
}

const CALENDARS: readonly Calendar[] = [
  { id: 'product', name: 'Product', tone: 1 },
  { id: 'design', name: 'Design', tone: 7 },
  { id: 'engineering', name: 'Engineering', tone: 3 },
  { id: 'marketing', name: 'Marketing', tone: 2 },
  { id: 'personal', name: 'Personal', tone: 5 },
  { id: 'away', name: 'Out of office', tone: 4 },
]

const calendarOf = (id: CalendarId) =>
  CALENDARS.find((c) => c.id === id) ?? (CALENDARS[0] as Calendar)

const PEOPLE = ['Alex Morgan', 'Riley Chen', 'Sam Lee', 'Jordan Park', 'Taylor Kim', 'Casey Wong']

interface CalEvent {
  readonly id: string
  readonly title: string
  readonly calendar: CalendarId
  /** The (first) day, as an ISO date such as `2026-11-13`. */
  readonly date: string
  /** Start and end as `HH:mm`; empty for all-day events. */
  readonly start: string
  readonly end: string
  /** Number of days of an all-day event; 0 for an event with times. */
  readonly days: number
  readonly location: string
  readonly guests: readonly string[]
}

/**
 * Day from the Monday of this week (negative: earlier weeks), start and end; an empty start makes an all-day
 * event, whose end is then its number of days. Then the title, the calendar and the location.
 */
type Seed = readonly [number, string, string, string, CalendarId, string?]

const SEEDS: readonly Seed[] = [
  [-7, '10:00', '11:00', 'Roadmap review', 'product', 'Room 4'],
  [-5, '14:00', '15:30', 'Design critique', 'design', 'Studio'],
  [0, '', '2', 'Taylor out of office', 'away'],
  [0, '10:00', '11:00', 'Roadmap review', 'product', 'Room 4'],
  [0, '13:00', '14:30', 'Design critique', 'design', 'Studio'],
  [0, '13:30', '14:00', '1:1 with Riley', 'personal'],
  [0, '16:00', '17:00', 'Campaign kickoff', 'marketing', 'Video call'],
  [1, '08:00', '09:00', 'Gym', 'personal'],
  [1, '11:00', '12:00', 'Sprint planning', 'engineering', 'Room 2'],
  [1, '11:30', '12:30', 'Customer call: Northwind', 'product', 'Video call'],
  [1, '14:00', '15:30', 'Onboarding flows workshop', 'design', 'Studio'],
  [1, '15:00', '16:00', 'Launch copy review', 'marketing'],
  [2, '', '2', 'Design offsite', 'design', 'Lakeside lodge'],
  [2, '10:00', '12:00', 'Architecture review', 'engineering', 'Room 2'],
  [2, '12:30', '13:30', 'Lunch with Sam', 'personal', 'Noodle bar'],
  [2, '15:00', '15:30', 'Pricing sync', 'product'],
  [3, '09:00', '10:30', 'Usability tests', 'design', 'Lab'],
  [3, '10:00', '11:00', 'API deprecation plan', 'engineering'],
  [3, '14:00', '15:00', 'Quarterly business review', 'product', 'Board room'],
  [3, '17:00', '18:00', 'Dentist', 'personal'],
  [4, '', '1', 'Release 4.2 ships', 'product'],
  [4, '10:00', '11:00', 'Release go / no-go', 'engineering', 'Room 2'],
  [4, '11:30', '12:15', 'Interview: senior designer', 'design', 'Video call'],
  [4, '14:00', '15:00', 'Launch retro', 'product', 'Room 4'],
  [4, '15:30', '17:00', 'Focus time', 'personal'],
  [4, '16:00', '16:30', 'Weekly metrics', 'marketing'],
  [4, '17:30', '18:30', 'Team drinks', 'personal', 'The Anchor'],
  [5, '10:00', '12:00', 'Farmers market', 'personal'],
  [6, '18:00', '18:30', 'Plan the week', 'personal'],
  [7, '10:00', '11:00', 'Roadmap review', 'product', 'Room 4'],
  [8, '', '3', 'Riley out of office', 'away'],
  [9, '13:00', '14:30', 'Design critique', 'design', 'Studio'],
]

/** The events of the three weeks around the given Monday, with a stand-up every working day. */
function seedEvents(monday: string): CalEvent[] {
  const event = ([day, start, end, title, calendar, location = '']: Seed, i: number): CalEvent => ({
    id: `e${i}`,
    title,
    calendar,
    date: addDays(monday, day),
    start,
    end: start ? end : '',
    days: start ? 0 : Number(end),
    location,
    guests: PEOPLE.slice(i % 4, (i % 4) + 1 + (i % 3)),
  })
  const standups = [-7, 0, 7].flatMap((week) =>
    [0, 1, 2, 3, 4].map((d): Seed => [week + d, '09:30', '09:45', 'Stand-up', 'engineering']),
  )
  return [...SEEDS, ...standups].map(event)
}

// —— Dates and times: ISO days (`2026-11-13`) and `HH:mm`, in the local time zone ——

const pad = (n: number) => String(n).padStart(2, '0')
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parseDay = (iso: string) => new Date(`${iso}T00:00`)
const addDays = (iso: string, n: number) => {
  const d = parseDay(iso)
  d.setDate(d.getDate() + n)
  return isoDay(d)
}
const mondayOf = (iso: string) => addDays(iso, -((parseDay(iso).getDay() + 6) % 7))
const toMin = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
const hhmm = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`

const fmt = (options: Intl.DateTimeFormatOptions) => {
  const f = new Intl.DateTimeFormat('en-US', options)
  return (iso: string) => f.format(parseDay(iso))
}
const weekday = fmt({ weekday: 'short' })
const longDay = fmt({ weekday: 'long', month: 'long', day: 'numeric' })
const shortDay = fmt({ month: 'short', day: 'numeric' })
const monthYear = fmt({ month: 'long', year: 'numeric' })

/** ISO week number: the week that holds the Thursday. */
function weekNumber(iso: string) {
  const thursday = parseDay(addDays(mondayOf(iso), 3))
  const jan1 = new Date(thursday.getFullYear(), 0, 1)
  return Math.floor(Math.round((thursday.getTime() - jan1.getTime()) / 86_400_000) / 7) + 1
}

const HOURS = Array.from({ length: 24 }, (_, h) => h)
/** The grid opens scrolled to the start of the working day. */
const FIRST_HOUR = 7
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

/** Which part of the band of the current week a day of the mini month is, for its rounded ends. */
const bandEdge = (before: boolean, after: boolean) =>
  before && after ? 'middle' : before ? 'end' : after ? 'start' : 'single'

interface Placed {
  readonly event: CalEvent
  /** The column of the event among those it overlaps (0-based), and their number (at most 3). */
  readonly lane: number
  readonly lanes: number
}

/** Puts overlapping events side by side: each cluster of overlaps shares its lanes. */
function layoutDay(events: readonly CalEvent[]): Placed[] {
  const sorted = [...events].sort(
    (a, b) => a.start.localeCompare(b.start) || b.end.localeCompare(a.end),
  )
  const placed: Placed[] = []
  let cluster: { event: CalEvent; lane: number }[] = []
  let laneEnds: string[] = []
  const flush = () => {
    for (const c of cluster) placed.push({ ...c, lanes: Math.min(3, laneEnds.length) })
    cluster = []
    laneEnds = []
  }
  for (const event of sorted) {
    if (laneEnds.every((end) => end <= event.start)) flush()
    let lane = laneEnds.findIndex((end) => end <= event.start)
    if (lane < 0) lane = laneEnds.push(event.end) - 1
    else laneEnds[lane] = event.end
    cluster.push({ event, lane: Math.min(2, lane) })
  }
  flush()
  return placed
}

/**
 * Where an event sits, as data attributes that the CSS turns into custom properties: the minute within its
 * starting hour (15-minute steps, plus 5 or 10), and the length in whole hours and quarters.
 */
const offset = (startMin: number) => {
  const minute = startMin % 60
  return {
    'data-at': minute - (minute % 15) || undefined,
    'data-fine': minute % 15 >= 5 ? (minute % 15) - (minute % 5) : undefined,
  }
}
const span = (lengthMin: number) => {
  const quarters = Math.max(1, Math.round(lengthMin / 15))
  return {
    'data-hours': Math.min(6, Math.floor(quarters / 4)) || undefined,
    'data-quarters': quarters % 4 || undefined,
  }
}

/** The values of the event form. */
interface EventValues {
  readonly title: string
  readonly calendar: CalendarId
  readonly date: string
  readonly start: string
  readonly end: string
  readonly guests: string[]
  readonly location: string
}

interface Draft {
  /** The event that is edited; null for a new one. */
  readonly id: string | null
  readonly days: number
  readonly values: EventValues
  /** Remounts the form with these values each time the dialog opens. */
  readonly key: number
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

// —— The page ——

/**
 * Calendar
 * The week view of a team calendar, drawn as a grid of its own: a time gutter and seven day columns in
 * hairlines, events as tinted blocks in the colors of their calendars with a solid leading edge, overlapping
 * events side by side, an all-day row, tinted weekends, a highlighted today and a line at the current time. A
 * sidebar holds a month of day buttons, the calendars as checkboxes, and the next event. Clicking an empty slot
 * opens a Modal with a Form prefilled with that time; clicking an event opens a Popover with its details, to
 * edit it or delete it after a danger confirmation. T, N, J, K, D and W are keyboard shortcuts.
 * @zh 日历
 * 团队日历的周视图，用自己的网格绘制：时间刻度与七个日期列以细线分隔，事件是按所属日历着色的浅色块并带实色前缘，
 * 重叠的事件并排显示，有全天事件行、着色的周末、高亮的今天与当前时间线。侧栏有一个由日期按钮组成的月历、以复选框
 * 显示的日历列表与下一个事件。点击空白时段打开预填该时间的 Modal 与 Form；点击事件打开 Popover 显示详情，可以编辑，
 * 或经危险确认后删除。T、N、J、K、D、W 是键盘快捷键。
 * @level scenario
 */
export function CalendarWeek() {
  const message = useMessage()
  const confirm = useConfirmDanger()
  const [now, setNow] = useState(() => new Date())
  const today = isoDay(now)
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const [events, setEvents] = useState(() => seedEvents(mondayOf(isoDay(new Date()))))
  const [anchor, setAnchor] = useState(today)
  const [month, setMonth] = useState(() => today.slice(0, 8).concat('01'))
  const [view, setView] = useState<'day' | 'week'>('week')
  const [visible, setVisible] = useState<readonly CalendarId[]>(CALENDARS.map((c) => c.id))
  const [sidebar, setSidebar] = useState<'auto' | 'open' | 'closed'>('auto')
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<EventValues>()
  const boardRef = useRef<HTMLDivElement>(null)
  const headRef = useRef<HTMLDivElement>(null)
  const firstHourRef = useRef<HTMLDivElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)

  // The current-time line moves every half minute
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])

  // Open at the start of the working day, just below the sticky day headers
  useEffect(() => {
    const board = boardRef.current
    const hour = firstHourRef.current
    if (!board || !hour || !headRef.current) return
    const top = hour.getBoundingClientRect().top - board.getBoundingClientRect().top
    board.scrollTop = top - headRef.current.offsetHeight - hour.offsetHeight / 3
  }, [])

  const monday = mondayOf(anchor)
  const days = view === 'week' ? Array.from({ length: 7 }, (_, i) => addDays(monday, i)) : [anchor]
  const shown = events.filter((e) => visible.includes(e.calendar))
  const allDayOn = (day: string) =>
    shown.filter((e) => e.days > 0 && e.date <= day && day <= addDays(e.date, e.days - 1))
  const timedOn = (day: string) => shown.filter((e) => e.days === 0 && e.date === day)

  /** Moves to a day, and the mini month with it. */
  const goTo = (iso: string) => {
    setAnchor(iso)
    setMonth(`${iso.slice(0, 8)}01`)
  }
  const step = (direction: 1 | -1) => goTo(addDays(anchor, direction * (view === 'week' ? 7 : 1)))

  const openDialog = (id: string | null, days: number, values: EventValues) => {
    setOpenKey(null)
    setDraft({ id, days, values, key: Date.now() })
    setDialogOpen(true)
  }
  const closeDialog = () => {
    form.resetFields()
    setDialogOpen(false)
  }

  /** A new event at a time, by default the next full hour today or 09:00 on another day. */
  const create = (
    date = anchor,
    startMin = date === today ? Math.min(23, now.getHours() + 1) * 60 : 540,
  ) =>
    openDialog(null, 0, {
      title: '',
      calendar: visible[0] ?? 'product',
      date,
      start: hhmm(startMin),
      end: hhmm(Math.min(startMin + 60, 24 * 60 - 15)),
      guests: [],
      location: '',
    })

  const edit = (e: CalEvent) => openDialog(e.id, e.days, { ...e, guests: [...e.guests] })

  const save = async (v: EventValues) => {
    if (!draft) return
    setSaving(true)
    await wait(600)
    const saved: CalEvent = {
      id: draft.id ?? `e${Date.now()}`,
      title: v.title.trim(),
      calendar: v.calendar,
      date: v.date,
      start: draft.days ? '' : v.start,
      end: draft.days ? '' : v.end,
      days: draft.days,
      location: (v.location ?? '').trim(),
      guests: v.guests ?? [],
    }
    setEvents((list) =>
      draft.id ? list.map((e) => (e.id === draft.id ? saved : e)) : [...list, saved],
    )
    setVisible((list) => (list.includes(saved.calendar) ? list : [...list, saved.calendar]))
    setSaving(false)
    closeDialog()
    goTo(saved.date)
    message.success(
      draft.id ? 'Changes saved' : `"${saved.title}" added to ${shortDay(saved.date)}`,
    )
  }

  const remove = async (e: CalEvent) => {
    setOpenKey(null)
    const ok = await confirm({
      title: 'Delete event',
      description: `"${e.title}" is removed from the calendars of its ${e.guests.length} guests, who get a cancellation.`,
      okText: 'Delete',
    })
    if (!ok) return
    setEvents((list) => list.filter((x) => x.id !== e.id))
    message.success(`Deleted "${e.title}"`)
  }

  const toggleSidebar = () =>
    // Whether the sidebar shows by default depends on the width (a container query): ask the element
    setSidebar((sidebarRef.current?.offsetWidth ?? 0) > 0 ? 'closed' : 'open')

  const idle = !dialogOpen
  useHotkeys('t', () => goTo(today), { description: 'Go to today', enabled: idle })
  useHotkeys('n', () => create(), { description: 'New event', enabled: idle })
  useHotkeys('j', () => step(1), { description: 'Next week or day', enabled: idle })
  useHotkeys('k', () => step(-1), { description: 'Previous week or day', enabled: idle })
  useHotkeys('d', () => setView('day'), { description: 'Day view', enabled: idle })
  useHotkeys('w', () => setView('week'), { description: 'Week view', enabled: idle })

  /** An event block in the grid, or a chip in the all-day row, with its details in a Popover. */
  const renderEvent = (e: CalEvent, day: string, placed?: Placed) => {
    const key = `${e.id}@${day}`
    const start = toMin(e.start)
    const length = toMin(e.end) - start
    const past = day < today || (day === today && placed !== undefined && toMin(e.end) <= nowMin)
    const last = addDays(e.date, e.days - 1)
    return (
      <Popover
        key={key}
        trigger="click"
        placement={placed ? 'right' : 'bottom'}
        open={openKey === key}
        onOpenChange={(open) => setOpenKey(open ? key : null)}
        content={<EventDetails event={e} onEdit={() => edit(e)} onDelete={() => remove(e)} />}
      >
        <button
          type="button"
          className={placed ? styles.event : styles.chip}
          data-vl-state=""
          data-calendar-tone={calendarOf(e.calendar).tone}
          data-selected={openKey === key || undefined}
          data-past={past || undefined}
          {...(placed && { ...offset(start), ...span(length) })}
          data-lane={placed?.lane || undefined}
          data-lanes={placed && placed.lanes > 1 ? placed.lanes : undefined}
          data-short={(placed && length <= 30) || undefined}
          data-continues-before={(!placed && day > e.date) || undefined}
          data-continues-after={(!placed && day < last) || undefined}
        >
          <span className={styles.eventTitle}>{e.title}</span>
          {placed && (
            <span className={styles.eventTime}>
              {length <= 30 ? e.start : `${e.start} – ${e.end}`}
            </span>
          )}
        </button>
      </Popover>
    )
  }

  const nowLine = days.includes(today)
  const nowPosition = offset(nowMin)
  const next = timedOn(today)
    .filter((e) => toMin(e.end) > nowMin)
    .sort((a, b) => a.start.localeCompare(b.start))[0]
  const inRange = (d: string) => (view === 'week' ? mondayOf(d) === monday : d === anchor)
  const monthStart = mondayOf(month)
  const monthDays = Array.from({ length: 42 }, (_, i) => addDays(monthStart, i))
  const lastDay = days[days.length - 1] ?? anchor
  const title =
    monday.slice(0, 7) === lastDay.slice(0, 7) || view === 'day'
      ? monthYear(anchor)
      : `${monthYear(monday).split(' ')[0]} – ${monthYear(lastDay)}`

  return (
    <div className={styles.calendar} data-sidebar={sidebar}>
      <aside className={styles.sidebar} ref={sidebarRef} aria-label="Calendars">
        {/* The mini month: a grid of day buttons; the days of the view form a band */}
        <Stack gap={2}>
          <Inline justify="between">
            <Text weight="semibold">{monthYear(month)}</Text>
            <Inline gap={0}>
              <IconButton
                size="sm"
                icon="chevron-left"
                label="Previous month"
                onClick={() => setMonth(addDays(month, -1).slice(0, 8).concat('01'))}
              />
              <IconButton
                size="sm"
                icon="chevron-right"
                label="Next month"
                onClick={() => setMonth(addDays(month, 31).slice(0, 8).concat('01'))}
              />
            </Inline>
          </Inline>
          <div className={styles.miniGrid}>
            {WEEKDAYS.map((w) => (
              <span key={w} className={styles.miniWeekday} aria-hidden="true">
                {w}
              </span>
            ))}
            {monthDays.map((d, i) => {
              const range = inRange(d)
              return (
                <button
                  key={d}
                  type="button"
                  className={styles.miniDay}
                  data-vl-state=""
                  aria-label={longDay(d)}
                  aria-current={d === today ? 'date' : undefined}
                  data-out={d.slice(0, 7) !== month.slice(0, 7) || undefined}
                  data-today={d === today || undefined}
                  data-busy={shown.some((e) => e.date === d) || undefined}
                  data-range={
                    range
                      ? bandEdge(
                          inRange(addDays(d, -1)) && i % 7 > 0,
                          inRange(addDays(d, 1)) && i % 7 < 6,
                        )
                      : undefined
                  }
                  onClick={() => goTo(d)}
                >
                  <span className={styles.miniNum}>{Number(d.slice(8))}</span>
                </button>
              )
            })}
          </div>
        </Stack>

        <Stack gap={2}>
          <Text overline>My calendars</Text>
          {CALENDARS.map((c) => (
            <Inline key={c.id} justify="between">
              <Checkbox
                checked={visible.includes(c.id)}
                onChange={(on) =>
                  setVisible((list) => (on ? [...list, c.id] : list.filter((id) => id !== c.id)))
                }
              >
                <span className={styles.calendarName} data-calendar-tone={c.tone}>
                  <span className={styles.swatch} />
                  {c.name}
                </span>
              </Checkbox>
              <Text size="xs" tone="tertiary" numeric>
                {events.filter((e) => e.calendar === c.id && mondayOf(e.date) === monday).length}
              </Text>
            </Inline>
          ))}
        </Stack>

        {next && (
          <div className={styles.upNext} data-calendar-tone={calendarOf(next.calendar).tone}>
            <Text size="xs" overline>
              {toMin(next.start) <= nowMin
                ? 'Happening now'
                : `Up next, in ${toMin(next.start) - nowMin} min`}
            </Text>
            <Text weight="semibold" truncate>
              {next.title}
            </Text>
            <Text size="sm" tone="secondary" numeric>
              {next.start} – {next.end}
              {next.location && `, ${next.location}`}
            </Text>
          </div>
        )}
      </aside>

      <main className={styles.main}>
        <header className={styles.toolbar}>
          <IconButton icon="sidebar" label="Show or hide the sidebar" onClick={toggleSidebar} />
          <Button onClick={() => goTo(today)}>Today</Button>
          <Inline gap={0}>
            <IconButton
              icon="chevron-left"
              label={`Previous ${view} (K)`}
              onClick={() => step(-1)}
            />
            <IconButton icon="chevron-right" label={`Next ${view} (J)`} onClick={() => step(1)} />
          </Inline>
          <Inline gap={3} align="baseline" wrap grow>
            <Heading level={1}>{title}</Heading>
            <Text tone="secondary" numeric>
              {view === 'week'
                ? `${shortDay(monday)} – ${shortDay(lastDay)}, week ${weekNumber(monday)}`
                : weekday(anchor)}
            </Text>
          </Inline>
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'day', label: 'Day' },
              { value: 'week', label: 'Week' },
            ]}
          />
          <Button variant="primary" icon="plus" onClick={() => create()}>
            New event
          </Button>
        </header>

        {/* One scroll container: the day headers stick to the top, the time gutter to the start */}
        <div className={styles.board} ref={boardRef} data-view={view}>
          <div className={styles.head} ref={headRef}>
            <div className={styles.corner} />
            {days.map((d) => (
              <button
                key={d}
                type="button"
                className={styles.dayHead}
                data-vl-state=""
                data-today={d === today || undefined}
                aria-label={`${longDay(d)}, show the day`}
                onClick={() => {
                  goTo(d)
                  setView('day')
                }}
              >
                <span className={styles.weekday}>{weekday(d)}</span>
                <span className={styles.dayNumber}>{Number(d.slice(8))}</span>
              </button>
            ))}
            <div className={styles.corner}>
              <Text size="2xs" tone="tertiary">
                All day
              </Text>
            </div>
            {days.map((d) => (
              <div
                key={d}
                className={styles.allDay}
                data-weekend={parseDay(d).getDay() % 6 === 0 || undefined}
              >
                {allDayOn(d).map((e) => renderEvent(e, d))}
              </div>
            ))}
          </div>

          <div className={styles.body}>
            <div className={styles.gutter} aria-hidden="true">
              {HOURS.map((h) => (
                <div
                  key={h}
                  className={styles.hour}
                  ref={h === FIRST_HOUR ? firstHourRef : undefined}
                >
                  {h > 0 && <span className={styles.hourLabel}>{hhmm(h * 60)}</span>}
                  {nowLine && h === now.getHours() && (
                    <span className={styles.nowLabel} {...nowPosition}>
                      {hhmm(nowMin)}
                    </span>
                  )}
                </div>
              ))}
            </div>
            {days.map((d) => {
              const placed = layoutDay(timedOn(d))
              return (
                <div
                  key={d}
                  className={styles.day}
                  data-weekend={parseDay(d).getDay() % 6 === 0 || undefined}
                  data-today={d === today || undefined}
                >
                  {HOURS.map((h) => (
                    <div key={h} className={styles.hour}>
                      {/* Empty half hours create an event there; the keyboard path is "New event" */}
                      {[0, 30].map((m) => (
                        <button
                          key={m}
                          type="button"
                          tabIndex={-1}
                          className={styles.slot}
                          data-vl-state=""
                          aria-label={`New event on ${longDay(d)} at ${hhmm(h * 60 + m)}`}
                          onClick={() => create(d, h * 60 + m)}
                        />
                      ))}
                      {placed
                        .filter((p) => Math.floor(toMin(p.event.start) / 60) === h)
                        .map((p) => renderEvent(p.event, d, p))}
                      {d === today && h === now.getHours() && (
                        <span className={styles.now} {...nowPosition} />
                      )}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </main>

      <Modal
        title={draft?.id ? 'Edit event' : 'New event'}
        open={dialogOpen}
        okText={draft?.id ? 'Save' : 'Create'}
        okLoading={saving}
        onOk={() => form.submit()}
        onCancel={closeDialog}
      >
        {draft && (
          <Form
            key={draft.key}
            form={form}
            initialValues={draft.values}
            onFinish={save}
            disabled={saving}
          >
            <Form.Item
              label="Title"
              name="title"
              rules={[{ required: true, whitespace: true, message: 'Give the event a title' }]}
            >
              <Input autoFocus placeholder="For example: Design review" />
            </Form.Item>
            <Form.Item label="Calendar" name="calendar">
              <Select
                options={CALENDARS.map((c) => ({
                  value: c.id,
                  label: (
                    <span className={styles.calendarName} data-calendar-tone={c.tone}>
                      <span className={styles.swatch} />
                      {c.name}
                    </span>
                  ),
                }))}
              />
            </Form.Item>
            <Grid columns={draft.days > 0 ? 1 : 3} gap={3}>
              <Form.Item
                label={draft.days > 1 ? 'First day' : 'Day'}
                name="date"
                rules={[{ required: true }]}
              >
                <DatePicker allowClear={false} />
              </Form.Item>
              {draft.days === 0 && (
                <>
                  <Form.Item label="Start" name="start" rules={[{ required: true }]}>
                    <TimePicker format="HH:mm" minuteStep={15} allowClear={false} />
                  </Form.Item>
                  <Form.Item
                    label="End"
                    name="end"
                    rules={[
                      { required: true },
                      {
                        validator: (value) =>
                          typeof value === 'string' && value <= String(form.getFieldValue('start'))
                            ? 'Ends before it starts'
                            : undefined,
                      },
                    ]}
                  >
                    <TimePicker format="HH:mm" minuteStep={15} allowClear={false} />
                  </Form.Item>
                </>
              )}
            </Grid>
            <Form.Item label="Guests" name="guests">
              <Select
                multiple
                showSearch
                placeholder="Add people"
                options={PEOPLE.map((p) => ({ value: p, label: p }))}
              />
            </Form.Item>
            <Form.Item label="Location" name="location">
              <Input placeholder="A room, an address or a video link" />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  )
}

/** The details of an event, in the Popover that opens on a click. */
function EventDetails(props: {
  readonly event: CalEvent
  readonly onEdit: () => void
  readonly onDelete: () => void
}) {
  const { event } = props
  const calendar = calendarOf(event.calendar)
  const when =
    event.days > 0
      ? `${longDay(event.date)}${event.days > 1 ? ` – ${shortDay(addDays(event.date, event.days - 1))}` : ''}, all day`
      : `${longDay(event.date)}, ${event.start} – ${event.end}`
  return (
    <div className={styles.details} data-calendar-tone={calendar.tone}>
      <Stack gap={4}>
        <div className={styles.detailsHead}>
          <span className={styles.swatch} />
          <Stack gap={1}>
            <Heading level={3}>{event.title}</Heading>
            <Text size="sm" tone="secondary" numeric>
              {when}
            </Text>
          </Stack>
        </div>
        <Stack gap={2}>
          <Inline gap={2}>
            <Icon name="calendar" tone="tertiary" />
            <Text size="sm">{calendar.name}</Text>
          </Inline>
          {event.location && (
            <Inline gap={2}>
              <Icon name="pin" tone="tertiary" />
              <Text size="sm">{event.location}</Text>
            </Inline>
          )}
          {event.guests.length > 0 && (
            <Inline gap={2} align="start">
              <Icon name="users" tone="tertiary" />
              <Stack gap={1}>
                {event.guests.map((g) => (
                  <Inline key={g} gap={2}>
                    <Avatar name={g} size={20} />
                    <Text size="sm">{g}</Text>
                  </Inline>
                ))}
              </Stack>
            </Inline>
          )}
        </Stack>
        <Inline gap={2} justify="end">
          <Button size="sm" variant="text" tone="danger" icon="trash" onClick={props.onDelete}>
            Delete
          </Button>
          <Button size="sm" icon="edit" onClick={props.onEdit}>
            Edit
          </Button>
        </Inline>
      </Stack>
    </div>
  )
}
