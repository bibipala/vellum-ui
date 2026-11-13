import { useState } from 'react'
import {
  Avatar,
  Button,
  CountBadge,
  EmptyState,
  IconButton,
  Inline,
  ListItem,
  Page,
  Panel,
  Segmented,
  Stack,
  StatusDot,
  Text,
  Toolbar,
  useMessage,
} from 'vellum-ui'

// —— Data of the recipe: replace with your API ——

type Kind = 'comment' | 'mention' | 'assign' | 'status'

interface Notification {
  readonly id: string
  readonly kind: Kind
  readonly actor: string
  /** What happened, after the name of the actor. */
  readonly text: string
  /** The project or the item it is about. */
  readonly subject: string
  /** An ISO date and time. */
  readonly at: string
  readonly read: boolean
}

const NOTIFICATIONS: readonly Notification[] = [
  {
    id: 'n1',
    kind: 'mention',
    actor: 'Sam Lee',
    text: 'mentioned you',
    subject: 'Atlas brand refresh',
    at: '2026-11-13T09:42:00Z',
    read: false,
  },
  {
    id: 'n2',
    kind: 'comment',
    actor: 'Riley Chen',
    text: 'commented',
    subject: 'Homepage hero, version 3',
    at: '2026-11-13T08:15:00Z',
    read: false,
  },
  {
    id: 'n3',
    kind: 'assign',
    actor: 'Jordan Park',
    text: 'assigned it to you',
    subject: 'Catalog shoot: shot list',
    at: '2026-11-12T16:30:00Z',
    read: false,
  },
  {
    id: 'n4',
    kind: 'status',
    actor: 'Casey Diaz',
    text: 'moved it to review',
    subject: 'Annual report layout',
    at: '2026-11-11T11:05:00Z',
    read: true,
  },
  {
    id: 'n5',
    kind: 'mention',
    actor: 'Alex Morgan',
    text: 'mentioned you',
    subject: 'Website launch checklist',
    at: '2026-11-10T14:20:00Z',
    read: true,
  },
]

type Filter = 'all' | 'unread' | 'mentions'

/** Notifications of this day are listed under "Today"; in a real app, the current date. */
const TODAY = '2026-11-13'

const time = new Intl.DateTimeFormat('en-US', { timeStyle: 'short', timeZone: 'UTC' })
const day = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})
const formatWhen = (iso: string) =>
  iso.startsWith(TODAY) ? time.format(new Date(iso)) : day.format(new Date(iso))

/** Replace with the navigation of your router. */
function openSubject(id: string) {
  window.location.hash = `#/notifications/${id}`
}

// —— The page ——

/**
 * Notifications
 * A narrow Page with a Segmented filter in the Toolbar (with a CountBadge of the unread ones), and the
 * notifications in Panels grouped by day. Each ListItem opens its subject and marks it as read; its actions appear
 * on hover. Unread rows have a StatusDot. "Mark all as read" is disabled with a reason when there is nothing to do,
 * and an empty filter shows an EmptyState.
 * @zh 通知
 * 窄 Page，Toolbar 中是 Segmented 筛选（未读数用 CountBadge 显示），通知按日期分组放在 Panel 中。点击 ListItem
 * 打开相关内容并标记为已读，行内操作在悬停时出现；未读的行带 StatusDot。没有未读时「Mark all as read」禁用并说明原因，
 * 筛选结果为空时显示 EmptyState。
 * @level basic
 */
export function Notifications() {
  const message = useMessage()
  const [items, setItems] = useState(NOTIFICATIONS)
  const [filter, setFilter] = useState<Filter>('all')
  const unread = items.filter((n) => !n.read).length

  const setRead = (id: string, read: boolean) =>
    setItems((list) => list.map((n) => (n.id === id ? { ...n, read } : n)))
  const mute = (n: Notification) => {
    setItems((list) => list.filter((x) => x.subject !== n.subject))
    message.success(`You won't get notifications about ${n.subject}`)
  }

  const shown = items.filter(
    (n) => filter === 'all' || (filter === 'unread' ? !n.read : n.kind === 'mention'),
  )
  const groups = [
    { label: 'Today', items: shown.filter((n) => n.at.startsWith(TODAY)) },
    { label: 'Earlier', items: shown.filter((n) => !n.at.startsWith(TODAY)) },
  ].filter((g) => g.items.length > 0)

  return (
    <Page
      width="narrow"
      title="Notifications"
      actions={
        <Button
          icon="check"
          disabled={unread === 0}
          disabledReason="Everything is read"
          onClick={() => setItems((list) => list.map((n) => ({ ...n, read: true })))}
        >
          Mark all as read
        </Button>
      }
      toolbar={
        <Toolbar>
          <Segmented<Filter>
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All' },
              {
                value: 'unread',
                label: (
                  <Inline gap={1}>
                    Unread
                    <CountBadge count={unread} tone="accent" />
                  </Inline>
                ),
              },
              { value: 'mentions', label: 'Mentions' },
            ]}
          />
        </Toolbar>
      }
    >
      {groups.length === 0 ? (
        <EmptyState
          icon="inbox"
          title={filter === 'unread' ? 'No unread notifications' : 'No notifications'}
          description="You're all caught up."
        />
      ) : (
        <Stack gap={5}>
          {groups.map((g) => (
            <Stack key={g.label} gap={2}>
              <Text overline>{g.label}</Text>
              <Panel flush>
                <Stack gap={1} padding={2}>
                  {g.items.map((n) => (
                    <ListItem
                      key={n.id}
                      leading={<Avatar name={n.actor} size={32} />}
                      title={`${n.actor} ${n.text}`}
                      description={n.subject}
                      meta={
                        <Inline gap={2}>
                          <Text as="time" dateTime={n.at} size="xs" tone="tertiary" numeric>
                            {formatWhen(n.at)}
                          </Text>
                          {!n.read && <StatusDot tone="accent" aria-label="Unread" />}
                        </Inline>
                      }
                      onClick={() => {
                        setRead(n.id, true)
                        openSubject(n.id)
                      }}
                      actionsOnHover
                      actions={
                        <>
                          <IconButton
                            size="sm"
                            icon={n.read ? 'eye-off' : 'check'}
                            label={n.read ? 'Mark as unread' : 'Mark as read'}
                            onClick={() => setRead(n.id, !n.read)}
                          />
                          <IconButton
                            size="sm"
                            icon="bell-off"
                            label={`Mute ${n.subject}`}
                            onClick={() => mute(n)}
                          />
                        </>
                      }
                    />
                  ))}
                </Stack>
              </Panel>
            </Stack>
          ))}
        </Stack>
      )}
    </Page>
  )
}
