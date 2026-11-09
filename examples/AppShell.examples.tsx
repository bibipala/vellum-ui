import { useState } from 'react'
import {
  AppShell,
  Avatar,
  Button,
  EmptyState,
  IconButton,
  Kbd,
  ListItem,
  Nav,
  type NavGroup,
  type NavItem,
  Page,
  Panel,
  Spacer,
  SplitView,
  Stack,
  Text,
  useHotkeys,
} from 'vellum-ui'

const ITEMS: readonly (NavItem | NavGroup)[] = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'inbox', label: 'Inbox', icon: 'inbox', count: 4, countTone: 'accent' },
  { key: 'projects', label: 'Projects', icon: 'folder' },
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

const TITLES: Readonly<Record<string, string>> = {
  home: 'Home',
  inbox: 'Inbox',
  projects: 'Projects',
  members: 'Members',
  reports: 'Reports',
  settings: 'Settings',
}

/**
 * Basic usage
 * The header holds AppShell.Toggle, the name of the application and the account; the sidebar holds a Nav; the
 * page goes in the children. The sidebar collapses to icons with the toggle, and becomes a drawer when the frame
 * is narrower than 960 px. `contained` keeps the example inside this page: an application leaves it out, so that
 * the frame fills the window.
 * @zh 基本用法
 * 顶栏放 AppShell.Toggle、应用名称与账户；侧栏放一个 Nav；页面放在子元素中。切换按钮把侧栏收起为图标；框架宽度
 * 小于 960px 时侧栏变为抽屉。`contained` 让示例留在本页之内：应用中不写它，框架占满窗口。
 */
export function Basic() {
  const [page, setPage] = useState('inbox')
  return (
    <AppShell
      contained
      header={
        <>
          <AppShell.Toggle />
          <Text weight="semibold">Acme</Text>
          <Spacer />
          <IconButton icon="bell" label="Notifications" />
          <Avatar name="Alex Morgan" size={28} />
        </>
      }
      sidebar={<Nav items={ITEMS} value={page} onSelect={setPage} />}
    >
      <Page
        title={TITLES[page] ?? page}
        subtitle="Everything that needs your attention"
        actions={<Button variant="primary">New project</Button>}
      >
        <Panel flush>
          <Stack gap={1} padding={2}>
            <ListItem title="Quarterly review" description="Due on Friday" onClick={() => {}} />
            <ListItem title="Website refresh" description="3 open tasks" onClick={() => {}} />
            <ListItem title="Onboarding guide" description="Draft" onClick={() => {}} />
          </Stack>
        </Panel>
      </Page>
    </AppShell>
  )
}

/**
 * Controlled collapse with a shortcut
 * Keep `collapsed` in your state to save it or to change it from elsewhere, such as with the `[` key. AppShell.Toggle
 * calls `onCollapsedChange`.
 * @zh 受控收起与快捷键
 * 把 `collapsed` 放在自己的状态中，就可以保存它，或在别处修改它，如用 `[` 键。AppShell.Toggle 调用 `onCollapsedChange`。
 * @section Advanced
 */
export function Controlled() {
  const [collapsed, setCollapsed] = useState(true)
  const [page, setPage] = useState('home')
  useHotkeys('[', () => setCollapsed((c) => !c), { description: 'Collapse or expand the sidebar' })
  return (
    <AppShell
      contained
      collapsed={collapsed}
      onCollapsedChange={setCollapsed}
      header={
        <>
          <AppShell.Toggle />
          <Text weight="semibold">Acme</Text>
        </>
      }
      sidebar={<Nav items={ITEMS} value={page} onSelect={setPage} />}
    >
      <Page title={TITLES[page] ?? page}>
        <Text tone="secondary">
          Press <Kbd keys="[" /> to collapse or expand the sidebar.
        </Text>
      </Page>
    </AppShell>
  )
}

/**
 * Full-screen interface
 * `flush` removes the padding of the main area, for interfaces whose root is a flush SplitView, such as a chat.
 * @zh 全屏界面
 * `flush` 去掉主内容区的内边距，用于以贴边 SplitView 为根的界面，如聊天。
 * @section Variants
 */
export function FullScreen() {
  const [page, setPage] = useState('inbox')
  return (
    <AppShell
      contained
      flush
      defaultCollapsed
      header={
        <>
          <AppShell.Toggle />
          <Text weight="semibold">Acme</Text>
        </>
      }
      sidebar={<Nav items={ITEMS} value={page} onSelect={setPage} />}
    >
      <SplitView
        variant="flush"
        aside={
          <Stack gap={1} padding={2}>
            <ListItem title="Design team" description="See you at 3" selected onClick={() => {}} />
            <ListItem title="Jordan Lee" description="Thanks!" onClick={() => {}} />
          </Stack>
        }
      >
        <EmptyState icon="messages" title="Design team" description="Messages appear here" fill />
      </SplitView>
    </AppShell>
  )
}
