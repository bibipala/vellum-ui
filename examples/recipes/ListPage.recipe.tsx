import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Avatar,
  Button,
  DataTable,
  type DataTableColumn,
  type DataTableSort,
  EmptyState,
  Icon,
  Inline,
  Input,
  LinkButton,
  Page,
  PageSkeleton,
  Pagination,
  Panel,
  Pill,
  type PillTone,
  Select,
  Text,
  useConfirmDanger,
  useDelayedPending,
  useMessage,
} from 'vellum-ui'

// —— Data of the recipe: replace with your API ——

type Status = 'active' | 'paused' | 'archived'

interface Project {
  readonly id: string
  readonly name: string
  readonly owner: string
  readonly status: Status
  readonly files: number
  /** A decimal string: amounts never go through floating point. */
  readonly budget: string
  /** An ISO date. */
  readonly updated: string
}

const OWNERS = ['Alex Morgan', 'Sam Lee', 'Jordan Park', 'Riley Chen', 'Casey Diaz']
const NAMES = ['Atlas', 'Beacon', 'Cedar', 'Delta', 'Echo', 'Fjord', 'Grove']
const TOPICS = ['brand refresh', 'catalog shoot', 'website launch', 'annual report']
const STATUSES: readonly Status[] = ['active', 'active', 'paused', 'archived']

const pick = <T,>(list: readonly T[], i: number) => list[i % list.length] as T

const PROJECTS: readonly Project[] = Array.from({ length: 23 }, (_, i) => ({
  id: `p${i + 1}`,
  name: `${pick(NAMES, i)} ${pick(TOPICS, i)}`,
  owner: pick(OWNERS, i * 3),
  status: pick(STATUSES, i),
  files: (i * 37) % 420,
  budget: `${1200 + ((i * 715) % 9000)}.${pick(['00', '50', '25'], i)}`,
  updated: `2026-10-${String((i % 28) + 1).padStart(2, '0')}`,
}))

const STATUS: Record<Status, { readonly label: string; readonly tone: PillTone }> = {
  active: { label: 'Active', tone: 'success' },
  paused: { label: 'Paused', tone: 'warning' },
  archived: { label: 'Archived', tone: 'neutral' },
}

const STATUS_OPTIONS = (Object.keys(STATUS) as Status[]).map((value) => ({
  value,
  label: STATUS[value].label,
}))

const PAGE_SIZE = 8

// Intl formats decimal strings exactly, without turning them into floating-point numbers
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const formatMoney = (amount: string) => money.format(amount as Intl.StringNumericLiteral)
// Dates without a time are formatted in UTC, so that they do not move by a day in other time zones
const day = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' })
const formatDay = (iso: string) => day.format(new Date(iso))

/** Replace with the navigation of your router. */
function openProject(id: string) {
  window.location.hash = `#/projects/${id}`
}

// —— A simulated server, so that the recipe runs without a network ——

const LATENCY = 600

class ApiError extends Error {
  readonly code: string
  constructor(code: string) {
    super(code)
    this.code = code
  }
}

/** Turns an error into a text for users; never show raw exception messages. */
function readableError(error: unknown): string {
  if (error instanceof ApiError && error.code === 'unavailable')
    return 'The server is not responding. Check your connection and try again.'
  return 'Something went wrong. Try again.'
}

interface ProjectQuery {
  readonly search: string
  readonly status: Status | null
  readonly sort: DataTableSort | null
  readonly page: number
}

interface ProjectPage {
  readonly items: readonly Project[]
  readonly total: number
}

function compareBy(key: string, a: Project, b: Project): number {
  if (key === 'files') return a.files - b.files
  if (key === 'name' || key === 'owner' || key === 'updated') return a[key].localeCompare(b[key])
  return 0
}

function listProjects(records: readonly Project[], q: ProjectQuery): Promise<ProjectPage> {
  return new Promise((resolve, reject) =>
    setTimeout(() => {
      // Searching for "error" simulates a failed request, so that the error state can be seen
      if (q.search.trim().toLowerCase() === 'error') return reject(new ApiError('unavailable'))
      const text = q.search.trim().toLowerCase()
      const found = records.filter(
        (p) =>
          (!text || p.name.toLowerCase().includes(text)) && (!q.status || p.status === q.status),
      )
      const { sort } = q
      const sorted = sort
        ? [...found].sort((a, b) => compareBy(sort.key, a, b) * (sort.direction === 'asc' ? 1 : -1))
        : found
      const start = (q.page - 1) * PAGE_SIZE
      resolve({ items: sorted.slice(start, start + PAGE_SIZE), total: found.length })
    }, LATENCY),
  )
}

/** What the page uses from a data-fetching hook; libraries such as TanStack Query return the same fields. */
interface Query<T> {
  /** The latest data, kept while a newer request runs. */
  readonly data: T | undefined
  /** A text for users when the latest request failed. */
  readonly error: string | undefined
  /** No response yet: the first load. */
  readonly isPending: boolean
  /** A request is running: the first load or a refresh. */
  readonly isFetching: boolean
  readonly refetch: () => void
}

/**
 * For this recipe only: runs `fetcher` whenever it changes, keeps the previous data while the next request runs
 * and ignores responses that arrive after a newer request. Use the data-fetching library of your application.
 */
function useFakeQuery<T>(fetcher: () => Promise<T>): Query<T> {
  const [state, setState] = useState<{
    readonly data?: T
    readonly error?: string
    readonly settled: boolean
    readonly fetching: boolean
  }>({ settled: false, fetching: true })
  const latest = useRef(0)
  const run = useCallback(() => {
    const id = ++latest.current
    setState((s) => ({ ...s, error: undefined, fetching: true }))
    fetcher().then(
      (data) => {
        if (id === latest.current) setState({ data, settled: true, fetching: false })
      },
      (error: unknown) => {
        if (id === latest.current)
          setState((s) => ({ ...s, error: readableError(error), settled: true, fetching: false }))
      },
    )
  }, [fetcher])
  useEffect(run, [run])
  return {
    data: state.data,
    error: state.error,
    isPending: !state.settled,
    isFetching: state.fetching,
    refetch: run,
  }
}

// —— The page ——

/**
 * List page
 * A page with a title, a primary action, a search and a filter in the toolbar, and a DataTable with
 * pagination, selection and bulk actions; loading, empty and error states. Search for "error" to see the error
 * state. Render it inside App, like every page.
 * @zh 列表页
 * 标题、主操作，工具栏中的搜索与筛选，带分页、多选与批量操作的 DataTable；加载、空、错误状态。搜索「error」可以看到
 * 错误状态。与所有页面一样，放在 App 之内渲染。
 */
export function ListPage() {
  const message = useMessage()
  const confirmDanger = useConfirmDanger()
  // Demo only: the records of the simulated server
  const [records, setRecords] = useState(PROJECTS)
  // The text in the field, and the search that was run with `Enter`
  const [text, setText] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<Status | null>(null)
  const [sort, setSort] = useState<DataTableSort | null>({ key: 'updated', direction: 'desc' })
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<readonly string[]>([])

  const fetcher = useCallback(
    () => listProjects(records, { search, status, sort, page }),
    [records, search, status, sort, page],
  )
  const projects = useFakeQuery(fetcher)
  // No flash: the skeleton appears only after 200 ms and then stays for at least 400 ms
  const showSkeleton = useDelayedPending(projects.isPending)
  if (projects.isPending || showSkeleton) return <PageSkeleton />

  const filtered = search !== '' || status !== null
  const clearFilters = () => {
    setText('')
    setSearch('')
    setStatus(null)
    setPage(1)
  }

  // Reversible: archive right away and offer "Undo" instead of asking first
  const archive = () => {
    const before = records.filter((p) => selected.includes(p.id))
    setRecords((list) =>
      list.map((p) => (selected.includes(p.id) ? { ...p, status: 'archived' } : p)),
    )
    setSelected([])
    message.undoable({
      content: before.length === 1 ? 'Archived 1 project' : `Archived ${before.length} projects`,
      onUndo: () => setRecords((list) => list.map((p) => before.find((b) => b.id === p.id) ?? p)),
    })
  }

  // Irreversible: confirm first
  const remove = async () => {
    const count = selected.length
    const ok = await confirmDanger({
      title: count === 1 ? 'Delete 1 project' : `Delete ${count} projects`,
      description: 'Their files and history are deleted as well. This cannot be undone.',
      okText: 'Delete',
    })
    if (!ok) return
    setRecords((list) => list.filter((p) => !selected.includes(p.id)))
    setSelected([])
    message.success(count === 1 ? 'Deleted 1 project' : `Deleted ${count} projects`)
  }

  const columns: DataTableColumn<Project>[] = [
    {
      key: 'name',
      title: 'Project',
      hideable: false,
      truncate: true,
      sortable: true,
      // The main column holds a link, so that keyboard users can open a row as well
      render: (p) => <LinkButton onClick={() => openProject(p.id)}>{p.name}</LinkButton>,
    },
    {
      key: 'owner',
      title: 'Owner',
      width: 200,
      sortable: true,
      render: (p) => (
        <Inline gap={2}>
          <Avatar name={p.owner} size={20} />
          <Text truncate>{p.owner}</Text>
        </Inline>
      ),
    },
    {
      key: 'status',
      title: 'Status',
      width: 120,
      render: (p) => (
        <Pill tone={STATUS[p.status].tone} dot>
          {STATUS[p.status].label}
        </Pill>
      ),
    },
    // Numbers are aligned at the end; table cells already use tabular numbers
    { key: 'files', title: 'Files', width: 96, align: 'end', sortable: true },
    {
      key: 'budget',
      title: 'Budget',
      width: 132,
      align: 'end',
      render: (p) => formatMoney(p.budget),
    },
    {
      key: 'updated',
      title: 'Updated',
      width: 136,
      sortable: true,
      render: (p) => (
        <Text as="time" dateTime={p.updated}>
          {formatDay(p.updated)}
        </Text>
      ),
    },
  ]

  return (
    <Page
      title="Projects"
      subtitle="Active, paused and archived projects of the team"
      actions={
        <Button variant="primary" icon={<Icon name="plus" />} href="#/projects/new">
          New project
        </Button>
      }
    >
      <Panel flush>
        <DataTable
          aria-label="Projects"
          columns={columns}
          rows={projects.data?.items ?? []}
          rowKey={(p) => p.id}
          rowLabel={(p) => p.name}
          onRowClick={(p) => openProject(p.id)}
          sort={sort}
          onSortChange={(next) => {
            setSort(next)
            setPage(1)
          }}
          selectable
          selectedKeys={selected}
          onSelectionChange={setSelected}
          // The rows stay while a page, a search or a filter loads; the indicator appears after 200 ms
          loading={projects.isFetching}
          error={projects.error}
          onRetry={projects.refetch}
          toolbar={
            <>
              <Input.Search
                aria-label="Search projects"
                placeholder="Search by name"
                allowClear
                value={text}
                // Text inputs pass the native change event
                onChange={(e) => setText(e.target.value)}
                onSearch={(value) => {
                  setSearch(value)
                  setPage(1)
                }}
              />
              <Select
                aria-label="Status"
                placeholder="Status"
                allowClear
                options={STATUS_OPTIONS}
                value={status}
                onChange={(value) => {
                  setStatus(value)
                  setPage(1)
                }}
              />
            </>
          }
          bulkActions={
            <>
              <Button icon={<Icon name="archive" />} onClick={archive}>
                Archive
              </Button>
              <Button tone="danger" icon={<Icon name="trash" />} onClick={remove}>
                Delete
              </Button>
            </>
          }
          empty={
            filtered ? (
              <EmptyState
                size="sm"
                icon="search"
                title="No matching projects"
                description="Try another name, or clear the search and the filter"
                action={<Button onClick={clearFilters}>Clear filters</Button>}
              />
            ) : (
              <EmptyState
                icon="project"
                title="No projects yet"
                description="Create a project to collect its files and track its budget here"
                action={
                  <Button variant="primary" href="#/projects/new">
                    New project
                  </Button>
                }
              />
            )
          }
          footer={
            <Inline justify="end">
              <Pagination
                size="sm"
                current={page}
                pageSize={PAGE_SIZE}
                total={projects.data?.total ?? 0}
                showSizeChanger={false}
                showTotal={(total) => (total === 1 ? '1 project' : `${total} projects`)}
                onChange={setPage}
              />
            </Inline>
          }
        />
      </Panel>
    </Page>
  )
}
