import { useState } from 'react'
import {
  App,
  Button,
  DataTable,
  Icon,
  Inline,
  Input,
  Pagination,
  Panel,
  Pill,
  SelectionBar,
  Stack,
  Toolbar,
  useMessage,
} from 'vellum-ui'

interface Project {
  readonly id: string
  readonly name: string
  readonly owner: string
  readonly archived: boolean
}

const PROJECTS: readonly Project[] = [
  { id: 'p1', name: 'Website redesign', owner: 'Alex Morgan', archived: false },
  { id: 'p2', name: 'Spring catalog', owner: 'Sam Lee', archived: false },
  { id: 'p3', name: 'Gallery opening', owner: 'Jordan Kim', archived: false },
  { id: 'p4', name: 'Annual report', owner: 'Alex Morgan', archived: false },
]

/**
 * Basic usage
 * Combine it with a `selectable` DataTable: while rows are selected, the bar replaces the toolbar in place,
 * so the table does not move. "Clear selection" or `Esc` in the bar clears the selection and focus returns to the
 * checkbox used last.
 * @zh 基本用法
 * 与 `selectable` 的 DataTable 组合：有选中行时操作栏在原位替换工具栏，表格不会移动。「清除选择」或在栏内按 `Esc` 清除选择，
 * 焦点回到最后使用的复选框。
 */
export function Basic() {
  const [rows, setRows] = useState<readonly Project[]>(PROJECTS)
  const [selected, setSelected] = useState<readonly string[]>([])
  const archive = () => {
    setRows((list) => list.map((p) => (selected.includes(p.id) ? { ...p, archived: true } : p)))
    setSelected([])
  }
  return (
    <Stack gap={4}>
      <SelectionBar
        count={selected.length}
        total={rows.length}
        onClear={() => setSelected([])}
        onSelectAll={() => setSelected(rows.map((p) => p.id))}
        toolbar={
          <Toolbar actions={<Button variant="primary">New project</Button>}>
            <Input.Search aria-label="Search projects" placeholder="Search projects" />
          </Toolbar>
        }
      >
        <Button icon="archive" onClick={archive}>
          Archive
        </Button>
      </SelectionBar>
      <Panel flush>
        <DataTable<Project>
          aria-label="Projects"
          rowKey={(p) => p.id}
          rows={rows}
          selectable
          selectedKeys={selected}
          onSelectionChange={setSelected}
          columns={[
            { key: 'name', title: 'Project' },
            { key: 'owner', title: 'Owner' },
            {
              key: 'archived',
              title: 'Status',
              render: (p) =>
                p.archived ? (
                  <Pill>Archived</Pill>
                ) : (
                  <Pill tone="success" dot>
                    Active
                  </Pill>
                ),
            },
          ]}
        />
      </Panel>
    </Stack>
  )
}

/** Rows per page in the example. */
const PAGE_SIZE = 5

/**
 * Selecting all results
 * With `total` and `onSelectAll`, the bar offers "Select all N" while only some of the results are selected, for
 * example the rows of the current page, and says "All N selected" once everything is selected.
 * @zh 选择全部结果
 * 提供 `total` 与 `onSelectAll` 后，只选中了部分结果（如当前页的行）时操作栏显示「选择全部 N 项」，全部选中后显示「已选全部 N 项」。
 * @section Variants
 */
export function SelectAll() {
  const files = Array.from({ length: 23 }, (_, i) => ({
    id: `f${i + 1}`,
    name: `Sketch ${String(i + 1).padStart(2, '0')}.png`,
  }))
  const [selected, setSelected] = useState<readonly string[]>([])
  const [page, setPage] = useState(1)
  return (
    <Stack gap={4}>
      <SelectionBar
        count={selected.length}
        total={files.length}
        onClear={() => setSelected([])}
        onSelectAll={() => setSelected(files.map((f) => f.id))}
        toolbar={
          <Toolbar>
            <Input.Search aria-label="Search files" placeholder="Search files" />
          </Toolbar>
        }
      >
        <Button icon="download">Download</Button>
      </SelectionBar>
      <Panel flush>
        <DataTable
          aria-label="Files"
          rowKey={(f) => f.id}
          rows={files.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)}
          selectable
          selectedKeys={selected}
          onSelectionChange={setSelected}
          columns={[{ key: 'name', title: 'File' }]}
          footer={
            <Inline justify="end">
              <Pagination
                size="sm"
                current={page}
                pageSize={PAGE_SIZE}
                total={files.length}
                onChange={setPage}
              />
            </Inline>
          }
        />
      </Panel>
    </Stack>
  )
}

interface FileItem {
  readonly id: string
  readonly name: string
}

const FILES: readonly FileItem[] = [
  { id: 'a', name: 'Cover draft.psd' },
  { id: 'b', name: 'Cover final.tif' },
  { id: 'c', name: 'Interview notes.docx' },
  { id: 'd', name: 'Invoice 0142.pdf' },
]

function FilesWithUndo() {
  const message = useMessage()
  const [files, setFiles] = useState<readonly FileItem[]>(FILES)
  const [selected, setSelected] = useState<readonly string[]>([])
  const remove = () => {
    const removed = files.filter((f) => selected.includes(f.id))
    // A reversible action runs right away; the message offers "Undo" instead of asking first
    setFiles((list) => list.filter((f) => !selected.includes(f.id)))
    setSelected([])
    message.undoable({
      content:
        removed.length === 1
          ? 'Moved 1 file to the trash'
          : `Moved ${removed.length} files to the trash`,
      onUndo: () =>
        setFiles((list) => [...list, ...removed].sort((x, y) => x.id.localeCompare(y.id))),
    })
  }
  return (
    <Stack gap={4}>
      <SelectionBar
        count={selected.length}
        total={files.length}
        onClear={() => setSelected([])}
        toolbar={
          <Toolbar>
            <Input.Search aria-label="Search files" placeholder="Search files" />
          </Toolbar>
        }
      >
        <Button tone="danger" icon="trash" onClick={remove}>
          Move to trash
        </Button>
      </SelectionBar>
      <Panel flush>
        <DataTable<FileItem>
          aria-label="Files"
          rowKey={(f) => f.id}
          rows={files}
          selectable
          selectedKeys={selected}
          onSelectionChange={setSelected}
          columns={[{ key: 'name', title: 'File' }]}
        />
      </Panel>
    </Stack>
  )
}

/**
 * Deleting with undo
 * Moving to the trash can be undone, so it runs right away and `useMessage().undoable` offers "Undo" instead of a
 * confirmation. When the bar hides after the action, focus moves to the toolbar because the rows are gone.
 * @zh 删除后可撤销
 * 移到回收站可以恢复，所以直接执行，用 `useMessage().undoable` 提供「撤销」，不弹确认。操作之后栏隐藏，原来的行已经不在，焦点移到工具栏。
 * @section Advanced
 */
export function UndoDelete() {
  return (
    <App>
      <FilesWithUndo />
    </App>
  )
}
