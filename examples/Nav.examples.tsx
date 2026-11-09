import { useState } from 'react'
import {
  EmptyState,
  Inline,
  Nav,
  type NavGroup,
  type NavItem,
  SplitView,
  Stack,
  Switch,
  Text,
} from 'vellum-ui'

const ITEMS: readonly (NavItem | NavGroup)[] = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'inbox', label: 'Inbox', icon: 'inbox', count: 4, countTone: 'accent' },
  { key: 'projects', label: 'Projects', icon: 'folder', count: 12 },
  {
    type: 'group',
    label: 'Workspace',
    items: [
      { key: 'members', label: 'Members', icon: 'users' },
      { key: 'reports', label: 'Reports', icon: 'chart' },
      { key: 'settings', label: 'Settings', icon: 'settings' },
    ],
  },
]

const LABELS: Readonly<Record<string, string>> = {
  home: 'Home',
  inbox: 'Inbox',
  projects: 'Projects',
  members: 'Members',
  reports: 'Reports',
  settings: 'Settings',
}

/**
 * Basic usage
 * Items with icons and counts, then a group with a heading. `value` is the key of the current page and
 * `onSelect` receives the key of the chosen item. In an application, Nav goes in the `sidebar` of AppShell.
 * @zh 基本用法
 * 带图标与计数的项，然后是带标题的分组。`value` 是当前页面的 key，`onSelect` 收到所选项的 key。
 * 在应用中，Nav 放在 AppShell 的 `sidebar` 中。
 */
export function Basic() {
  const [page, setPage] = useState('inbox')
  return (
    <SplitView
      asideWidth="sm"
      aside={
        <Stack padding={2}>
          <Nav items={ITEMS} value={page} onSelect={setPage} />
        </Stack>
      }
    >
      <EmptyState icon="file-text" title={LABELS[page] ?? page} description="The page goes here" />
    </SplitView>
  )
}

const LINKS: readonly NavItem[] = [
  { key: 'overview', label: 'Overview', icon: 'dashboard', href: '/overview' },
  { key: 'activity', label: 'Activity', icon: 'activity', href: '/activity' },
  { key: 'billing', label: 'Billing', icon: 'wallet', href: '/billing' },
]

/**
 * Links
 * Items with `href` are real links, so they can be opened in a new tab. With `onSelect`, plain clicks call it
 * instead of following the link: pass your router's navigation there.
 * @zh 链接
 * 带 `href` 的项是真正的链接，可以在新标签页中打开。传入 `onSelect` 时，普通点击调用它而不跳转：在这里调用路由的跳转。
 * @section Variants
 */
export function Links() {
  const [page, setPage] = useState('overview')
  return (
    <SplitView
      asideWidth="sm"
      aside={
        <Stack padding={2}>
          <Nav aria-label="Account" items={LINKS} value={page} onSelect={setPage} />
        </Stack>
      }
    >
      <EmptyState icon="file-text" title={`Opened /${page}`} />
    </SplitView>
  )
}

/**
 * Collapsed
 * `collapsed` shows icons only; the labels appear in tooltips and stay the accessible names. Inside AppShell,
 * Nav follows the sidebar and needs no `collapsed` of its own.
 * @zh 收起
 * `collapsed` 只显示图标；文字在提示中出现，仍是读屏名称。在 AppShell 中 Nav 跟随侧栏，不需要自己设置 `collapsed`。
 * @section Variants
 */
export function Collapsed() {
  const [collapsed, setCollapsed] = useState(true)
  const [page, setPage] = useState('home')
  return (
    <Stack gap={4}>
      <Inline gap={2} align="center">
        <Switch aria-label="Collapsed" checked={collapsed} onChange={setCollapsed} />
        <Text>Collapsed</Text>
      </Inline>
      <Inline gap={4} align="start">
        <Nav items={ITEMS} value={page} onSelect={setPage} collapsed={collapsed} />
        <Text tone="secondary">Current page: {LABELS[page] ?? page}</Text>
      </Inline>
    </Stack>
  )
}

const WITH_DISABLED: readonly NavItem[] = [
  { key: 'files', label: 'Files', icon: 'folder' },
  { key: 'shared', label: 'Shared with me', icon: 'share', count: 2 },
  { key: 'archive', label: 'Archive', icon: 'archive', disabled: true },
]

/**
 * Disabled item
 * A disabled item is faded and skipped by `Tab` and the arrow keys.
 * @zh 禁用的项
 * 禁用的项淡化显示，`Tab` 与方向键都会跳过它。
 * @section States
 */
export function Disabled() {
  const [page, setPage] = useState('files')
  return (
    <SplitView
      asideWidth="sm"
      aside={
        <Stack padding={2}>
          <Nav aria-label="Files" items={WITH_DISABLED} value={page} onSelect={setPage} />
        </Stack>
      }
    >
      <EmptyState icon="folder" title={page === 'files' ? 'Files' : 'Shared with me'} />
    </SplitView>
  )
}
