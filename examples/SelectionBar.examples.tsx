import { type Key, useState } from 'react'
import {
  App,
  Button,
  Icon,
  Input,
  Panel,
  Pill,
  SelectionBar,
  Stack,
  Table,
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
 * Combine it with the `rowSelection` of a table: while rows are selected, the bar replaces the toolbar in place,
 * so the table does not move. "Clear selection" or `Esc` in the bar clears the selection and focus returns to the
 * checkbox used last.
 * @zh 基本用法
 * 与表格的 `rowSelection` 组合：有选中行时操作栏在原位替换工具栏，表格不会移动。「清除选择」或在栏内按 `Esc` 清除选择，
 * 焦点回到最后使用的复选框。
 */
export function Basic() {
  const [rows, setRows] = useState<readonly Project[]>(PROJECTS)
  const [selected, setSelected] = useState<readonly Key[]>([])
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
          <Toolbar actions={<Button type="primary">New project</Button>}>
            <Input.Search aria-label="Search projects" placeholder="Search projects" />
          </Toolbar>
        }
      >
        <Button icon={<Icon name="archive" />} onClick={archive}>
          Archive
        </Button>
      </SelectionBar>
      <Panel flush>
        <Table<Project>
          rowKey="id"
          pagination={false}
          dataSource={[...rows]}
          rowSelection={{ selectedRowKeys: [...selected], onChange: (keys) => setSelected(keys) }}
          columns={[
            { title: 'Project', dataIndex: 'name' },
            { title: 'Owner', dataIndex: 'owner' },
            {
              title: 'Status',
              dataIndex: 'archived',
              render: (archived: boolean) =>
                archived ? (
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
  const [selected, setSelected] = useState<readonly Key[]>([])
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
        <Button icon={<Icon name="download" />}>Download</Button>
      </SelectionBar>
      <Panel flush>
        <Table
          rowKey="id"
          dataSource={files}
          pagination={{ pageSize: 5 }}
          rowSelection={{ selectedRowKeys: [...selected], onChange: (keys) => setSelected(keys) }}
          columns={[{ title: 'File', dataIndex: 'name' }]}
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
  const [selected, setSelected] = useState<readonly Key[]>([])
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
        <Button danger icon={<Icon name="trash" />} onClick={remove}>
          Move to trash
        </Button>
      </SelectionBar>
      <Panel flush>
        <Table<FileItem>
          rowKey="id"
          pagination={false}
          dataSource={[...files]}
          rowSelection={{ selectedRowKeys: [...selected], onChange: (keys) => setSelected(keys) }}
          columns={[{ title: 'File', dataIndex: 'name' }]}
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
