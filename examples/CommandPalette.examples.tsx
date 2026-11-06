import { useState } from 'react'
import {
  Button,
  CommandPalette,
  type CommandPaletteItem,
  HotkeysProvider,
  Inline,
  Kbd,
  Text,
  useHotkeys,
} from 'vellum-ui'

const items: CommandPaletteItem[] = [
  { id: 'home', title: 'Home', group: 'Pages', icon: 'home' },
  { id: 'projects', title: 'Projects', group: 'Pages', icon: 'project', keywords: ['work'] },
  {
    id: 'files',
    title: 'Files',
    group: 'Pages',
    icon: 'folder',
    keywords: ['assets', 'documents'],
  },
  {
    id: 'settings',
    title: 'Settings',
    group: 'Pages',
    icon: 'settings',
    keywords: ['preferences'],
  },
  {
    id: 'new-project',
    title: 'New project',
    group: 'Actions',
    icon: 'plus',
    shortcut: 'mod+alt+n',
  },
  { id: 'invite', title: 'Invite a member', group: 'Actions', icon: 'users' },
  {
    id: 'theme',
    title: 'Switch to dark mode',
    group: 'Actions',
    icon: 'moon',
    keywords: ['theme'],
  },
]

function Palette() {
  const [open, setOpen] = useState(false)
  const [last, setLast] = useState('Nothing yet')
  // Mod+K opens and closes the palette, also from inside text fields
  useHotkeys('mod+k', () => setOpen((o) => !o), {
    description: 'Search and jump',
    allowInInputs: true,
  })
  return (
    <Inline gap={3} align="center">
      <Button onClick={() => setOpen(true)}>
        Search <Kbd keys="mod+k" />
      </Button>
      <Text size="sm" tone="secondary">
        Last run: {last}
      </Text>
      <CommandPalette
        open={open}
        onOpenChange={setOpen}
        items={items.map((item) => ({ ...item, onSelect: () => setLast(item.title) }))}
      />
    </Inline>
  )
}

/**
 * Basic usage
 * Open it with the button or `Mod+K` (registered with useHotkeys), type to filter, `↑` / `↓` and `Enter` to run.
 * Matching is fuzzy: "nwp" finds "New project". HotkeysProvider keeps the `Mod+K` of this example from clashing
 * with the one of the page that shows it.
 * @zh 基本用法
 * 用按钮或 `Mod+K`（用 useHotkeys 注册）打开，输入以筛选，`↑` / `↓` 与 `Enter` 执行。模糊匹配：输入 “nwp” 能找到
 * “New project”。HotkeysProvider 让示例的 `Mod+K` 不与展示它的页面自己的 `Mod+K` 冲突。
 */
export function Basic() {
  return (
    <HotkeysProvider>
      <Palette />
    </HotkeysProvider>
  )
}

const people = ['Alex Kim', 'Maria Garcia', 'Sam Lee', 'Noah Brown', 'Emma Wilson']

/** A fake server search: waits a moment, and stops when the query changes. */
function searchPeople(query: string, signal: AbortSignal): Promise<CommandPaletteItem[]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const q = query.toLowerCase()
      resolve(
        people
          .filter((name) => name.toLowerCase().includes(q))
          .map((name) => ({ id: `person:${name}`, title: name, group: 'People', icon: 'user' })),
      )
    }, 400)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    })
  })
}

function AsyncPalette() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Find people</Button>
      <CommandPalette
        open={open}
        onOpenChange={setOpen}
        items={items}
        onSearch={searchPeople}
        placeholder="Search pages, actions and people"
      />
    </>
  )
}

/**
 * Searching a server
 * `onSearch` adds results from a server after the local matches. It is called when typing stops, and the
 * signal is aborted when the query changes; "Searching" appears only when the search takes a while.
 * @zh 搜索服务器
 * `onSearch` 把服务器上的结果加在本地匹配之后。停止输入后调用，查询变化时 signal 被取消；搜索较慢时才显示「正在搜索」。
 * @section Advanced
 */
export function AsyncSearch() {
  return (
    <HotkeysProvider>
      <AsyncPalette />
    </HotkeysProvider>
  )
}

const many: CommandPaletteItem[] = Array.from({ length: 120 }, (_, i) => ({
  id: `file-${i + 1}`,
  title: `Report ${String(i + 1).padStart(3, '0')}.pdf`,
  group: 'Files',
  icon: 'file-text',
}))

function ManyPalette() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open 120 files</Button>
      <CommandPalette open={open} onOpenChange={setOpen} items={many} emptyText="No files found" />
    </>
  )
}

/**
 * Many results
 * At most `limit` results (50 by default) are shown; a line below the list says how many more there are.
 * @zh 大量结果
 * 最多显示 `limit` 条（默认 50），列表下方提示还有多少条。
 * @section States
 */
export function ManyResults() {
  return (
    <HotkeysProvider>
      <ManyPalette />
    </HotkeysProvider>
  )
}
