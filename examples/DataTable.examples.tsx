import { useEffect, useState } from 'react'
import {
  Avatar,
  Button,
  DataTable,
  type DataTableColumn,
  type DataTableSort,
  Inline,
  Input,
  LinkButton,
  Pagination,
  Panel,
  Pill,
  Segmented,
  Text,
  useMessage,
} from 'vellum-ui'

interface Project {
  readonly id: string
  readonly name: string
  readonly owner: string
  readonly status: 'active' | 'paused' | 'done'
  readonly files: number
  readonly updated: string
}

const owners = ['Alex Morgan', 'Sam Lee', 'Jordan Park', 'Riley Chen', 'Casey Diaz']
const names = ['Atlas', 'Beacon', 'Cedar', 'Delta', 'Echo', 'Fjord', 'Grove']
const topics = ['brand refresh', 'catalog shoot', 'website launch', 'annual report']
const projects: Project[] = Array.from({ length: 57 }, (_, i) => ({
  id: `p${i + 1}`,
  name: `${names[i % names.length]} ${topics[i % topics.length]}`,
  owner: owners[(i * 3) % owners.length] as string,
  status: (['active', 'paused', 'done'] as const)[i % 3] as Project['status'],
  files: (i * 37) % 420,
  updated: `2026-10-${String((i % 28) + 1).padStart(2, '0')}`,
}))

function StatusPill(props: { readonly status: Project['status'] }) {
  if (props.status === 'active')
    return (
      <Pill tone="success" dot>
        Active
      </Pill>
    )
  if (props.status === 'paused')
    return (
      <Pill tone="warning" dot>
        Paused
      </Pill>
    )
  return <Pill dot>Done</Pill>
}

/** The same columns for most examples: a main column, an owner, a status, a number and a date. */
const projectColumns: DataTableColumn<Project>[] = [
  {
    key: 'name',
    title: 'Project',
    hideable: false,
    truncate: true,
    compare: (a, b) => a.name.localeCompare(b.name),
  },
  {
    key: 'owner',
    title: 'Owner',
    width: 200,
    compare: (a, b) => a.owner.localeCompare(b.owner),
    render: (p) => (
      <Inline gap={2}>
        <Avatar name={p.owner} size={20} />
        <Text size="sm" truncate>
          {p.owner}
        </Text>
      </Inline>
    ),
  },
  { key: 'status', title: 'Status', width: 120, render: (p) => <StatusPill status={p.status} /> },
  {
    key: 'files',
    title: 'Files',
    width: 96,
    align: 'end',
    compare: (a, b) => a.files - b.files,
  },
  {
    key: 'updated',
    title: 'Updated',
    width: 144,
    compare: (a, b) => a.updated.localeCompare(b.updated),
  },
]

/**
 * Basic usage
 * Columns with `compare` can be sorted by clicking their header (or with `Enter` on it); numbers use
 * `align: 'end'`. Drag the edge of a header, or focus it with `Tab` and press `←` / `→`, to change a column width.
 * Place the table in a Panel with `flush`.
 * @zh 基本用法
 * 提供 `compare` 的列可以点击表头排序（或聚焦表头后按 `Enter`）；数字列用 `align: 'end'`。拖动表头的边缘，或用 `Tab`
 * 聚焦后按 `←` / `→`，可以调整列宽。表格放在带 `flush` 的 Panel 中。
 */
export function Basic() {
  return (
    <Panel flush>
      <DataTable
        aria-label="Projects"
        columns={projectColumns}
        rows={projects.slice(0, 6)}
        rowKey={(p) => p.id}
      />
    </Panel>
  )
}

/**
 * Selection and bulk actions
 * `selectable` adds a checkbox to each row; the header checkbox selects every row shown and is mixed when only
 * some are. `Shift`-click selects a range. Finished projects cannot be selected here (`isRowSelectable`). With
 * `bulkActions`, the toolbar row turns into a bar with the count, "Clear selection" and the actions while rows are
 * selected; archiving runs right away and can be undone from the message.
 * @zh 多选与批量操作
 * `selectable` 给每行加一个复选框；表头的复选框选择当前显示的全部行，部分选中时为半选。按住 `Shift` 点击选择一段。
 * 这里已完成的项目不能选择（`isRowSelectable`）。设置 `bulkActions` 后，有已选行时工具栏这一行换成批量操作栏：已选数量、
 * 「清除选择」与操作；归档直接执行，可以在消息条中撤销。
 * @section Variants
 */
export function Selection() {
  const message = useMessage()
  const [rows, setRows] = useState<readonly Project[]>(() => projects.slice(0, 8))
  const [selected, setSelected] = useState<readonly string[]>(['p2'])
  const archive = () => {
    const archived = rows.filter((p) => selected.includes(p.id))
    // A reversible action runs right away; the message offers "Undo" instead of asking first
    setRows((list) => list.filter((p) => !selected.includes(p.id)))
    setSelected([])
    message.undoable({
      content:
        archived.length === 1 ? 'Archived 1 project' : `Archived ${archived.length} projects`,
      onUndo: () =>
        setRows((list) =>
          projects.slice(0, 8).filter((p) => list.includes(p) || archived.includes(p)),
        ),
    })
  }
  return (
    <Panel flush>
      <DataTable
        aria-label="Projects"
        columns={projectColumns}
        rows={rows}
        rowKey={(p) => p.id}
        rowLabel={(p) => p.name}
        selectable
        selectedKeys={selected}
        onSelectionChange={setSelected}
        isRowSelectable={(p) => p.status !== 'done'}
        toolbar={<Input.Search aria-label="Search projects" placeholder="Search projects" />}
        bulkActions={
          <Button icon="archive" onClick={archive}>
            Archive
          </Button>
        }
      />
    </Panel>
  )
}

/**
 * Pinned columns
 * `pin` keeps a column at the start or the end while the others scroll horizontally; a faint line appears where
 * content passes under it. A typical use is an actions column pinned to the end. Columns without `width` share
 * the remaining space.
 * @zh 固定列
 * `pin` 让列在横向滚动时停在开头或结尾；内容滚到它下面时，交界处出现一条极淡的分隔线。常见的用法是把操作列固定在结尾。
 * 没有 `width` 的列分享剩余的空间。
 * @section Variants
 */
export function Pinned() {
  const columns: DataTableColumn<Project>[] = [
    { ...(projectColumns[0] as DataTableColumn<Project>), pin: 'start', width: 220 },
    ...projectColumns.slice(1).map((c) => ({ ...c, width: 220 })),
    {
      key: 'actions',
      title: 'Actions',
      width: 112,
      pin: 'end',
      resizable: false,
      render: () => <LinkButton onClick={() => {}}>Open</LinkButton>,
    },
  ]
  return (
    <Panel flush>
      <DataTable
        aria-label="Projects"
        columns={columns}
        rows={projects.slice(0, 5)}
        rowKey={(p) => p.id}
      />
    </Panel>
  )
}

/** A fake server: sorts and pages the projects after a short delay. */
function fetchProjects(sort: DataTableSort | null, page: number, size: number) {
  const sorted = [...projects]
  if (sort) {
    const sign = sort.direction === 'asc' ? 1 : -1
    const key = sort.key as keyof Project
    sorted.sort(
      (a, b) => sign * String(a[key]).localeCompare(String(b[key]), 'en', { numeric: true }),
    )
  }
  return new Promise<{ items: Project[]; total: number }>((resolve) =>
    setTimeout(
      () => resolve({ items: sorted.slice((page - 1) * size, page * size), total: sorted.length }),
      600,
    ),
  )
}

/**
 * Server-side sorting and pagination
 * With `sort` and `onSortChange` the server sorts: give the columns `sortable` instead of `compare`. Pagination
 * goes in `footer` and search in `toolbar`. While a page loads, the current rows stay and the loading indicator
 * appears only after 200 ms; the main column holds a link, so keyboard users can open a row as well.
 * @zh 服务端排序与分页
 * 用 `sort` 与 `onSortChange` 由服务端排序：列上写 `sortable`，不写 `compare`。分页放在 `footer`，搜索放在 `toolbar`。
 * 加载下一页时保留当前的行，200ms 后才出现加载指示；主列放链接，键盘用户也能打开一行。
 * @section Advanced
 */
export function ServerSide() {
  const [sort, setSort] = useState<DataTableSort | null>({ key: 'updated', direction: 'desc' })
  const [page, setPage] = useState(1)
  const [data, setData] = useState<{ items: Project[]; total: number } | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    setLoading(true)
    fetchProjects(sort, page, 8).then((result) => {
      if (!active) return
      setData(result)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [sort, page])
  const columns: DataTableColumn<Project>[] = [
    {
      key: 'name',
      title: 'Project',
      hideable: false,
      truncate: true,
      sortable: true,
      render: (p) => <LinkButton onClick={() => {}}>{p.name}</LinkButton>,
    },
    { key: 'owner', title: 'Owner', width: 180, sortable: true },
    { key: 'files', title: 'Files', width: 96, align: 'end', sortable: true },
    { key: 'updated', title: 'Updated', width: 144, sortable: true },
  ]
  return (
    <Panel flush>
      <DataTable
        aria-label="Projects"
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(p) => p.id}
        sort={sort}
        onSortChange={(next) => {
          setSort(next)
          setPage(1)
        }}
        loading={loading}
        onRowClick={() => {}}
        toolbar={<Input.Search allowClear variant="filled" placeholder="Search projects" />}
        footer={
          <Inline justify="end">
            <Pagination
              size="sm"
              current={page}
              pageSize={8}
              total={data?.total ?? 0}
              onChange={setPage}
            />
          </Inline>
        }
      />
    </Panel>
  )
}

/**
 * Column settings saved on this device
 * `columnSettings` adds a button on the right of the toolbar to show and hide columns, change their order, pin
 * them and restore the defaults. With `storageKey`, these choices and the column widths are kept on this device.
 * `hideable: false` keeps the main column visible; `defaultHidden` hides a column until users show it.
 * @zh 列设置与保存在本机
 * `columnSettings` 在工具栏右侧加一个按钮：显示、隐藏列，调整顺序，固定列，恢复默认。设置 `storageKey` 后，这些选择与
 * 列宽保存在本机。`hideable: false` 让主列始终显示；`defaultHidden` 的列默认隐藏，用户可以把它显示出来。
 * @section Advanced
 */
export function SavedColumns() {
  const columns: DataTableColumn<Project>[] = [
    ...projectColumns,
    { key: 'id', title: 'ID', width: 96, defaultHidden: true },
  ]
  return (
    <Panel flush>
      <DataTable
        aria-label="Projects"
        columns={columns}
        rows={projects.slice(0, 6)}
        rowKey={(p) => p.id}
        columnSettings
        storageKey="examples.data-table"
        toolbar={<Input.Search allowClear variant="filled" placeholder="Search projects" />}
      />
    </Panel>
  )
}

const events = Array.from({ length: 10_000 }, (_, i) => ({
  id: `e${i}`,
  time: `10:${String(Math.floor(i / 60) % 60).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`,
  user: owners[i % owners.length] as string,
  action: ['Uploaded a file', 'Renamed a folder', 'Shared a link', 'Moved 3 files'][
    i % 4
  ] as string,
  bytes: (i * 7919) % 1_000_000,
}))

/**
 * Large data
 * With `height` (or `fill`) and more than 100 rows, only the visible rows are rendered: ten thousand rows scroll
 * smoothly, the header stays at the top and the pinned column stays in place.
 * @zh 大数据
 * 设置 `height`（或 `fill`）且超过 100 行时，只渲染可见的行：一万行也能流畅滚动，表头吸顶，固定列不动。
 * @section Advanced
 */
export function LargeData() {
  return (
    <Panel flush>
      <DataTable
        aria-label="Activity"
        height={360}
        rows={events}
        rowKey={(e) => e.id}
        selectable
        columns={[
          { key: 'time', title: 'Time', width: 112, pin: 'start' },
          { key: 'user', title: 'User', width: 180 },
          { key: 'action', title: 'Action', truncate: true },
          {
            key: 'bytes',
            title: 'Bytes',
            width: 120,
            align: 'end',
            compare: (a, b) => a.bytes - b.bytes,
          },
        ]}
      />
    </Panel>
  )
}

/**
 * Empty, loading and error
 * Without rows the default empty state is shown (or `empty`); while the first page loads, the loading indicator
 * takes its place after 200 ms; `error` with `onRetry` shows the error state with a "Retry" button. The header
 * stays visible in every state.
 * @zh 空、加载与错误
 * 没有行时显示默认的空状态（或 `empty`）；首次加载时 200ms 后在同一位置出现加载指示；`error` 与 `onRetry` 显示带「重试」
 * 按钮的错误状态。各种状态下表头都保持显示。
 * @section States
 */
export function States() {
  const [state, setState] = useState<'empty' | 'loading' | 'error'>('empty')
  return (
    <Panel flush>
      <DataTable
        aria-label="Projects"
        columns={projectColumns}
        rows={[]}
        rowKey={(p) => p.id}
        loading={state === 'loading'}
        error={state === 'error' ? 'The project list could not be loaded.' : undefined}
        onRetry={() => setState('loading')}
        toolbar={
          <Segmented
            value={state}
            onChange={setState}
            options={[
              { label: 'Empty', value: 'empty' },
              { label: 'Loading', value: 'loading' },
              { label: 'Error', value: 'error' },
            ]}
          />
        }
      />
    </Panel>
  )
}
