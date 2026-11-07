import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Avatar,
  Button,
  CountBadge,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  Input,
  ListItem,
  Loading,
  Page,
  PageSkeleton,
  Pill,
  Section,
  SplitView,
  Stack,
  useDelayedPending,
  useMessage,
} from 'vellum-ui'

// —— Data of the recipe: replace with your API ——

interface Team {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly memberCount: number
}

interface Member {
  readonly id: string
  readonly name: string
  readonly email: string
  readonly role: 'lead' | 'member' | 'guest'
}

const TEAMS: readonly Team[] = [
  { id: 'design', name: 'Design', description: 'Brand, product and web design', memberCount: 4 },
  { id: 'engineering', name: 'Engineering', description: 'Apps and services', memberCount: 5 },
  { id: 'research', name: 'Research', description: 'Interviews and studies', memberCount: 2 },
  { id: 'support', name: 'Support', description: 'Help desk and onboarding', memberCount: 0 },
]

const PEOPLE = [
  'Alex Morgan',
  'Sam Lee',
  'Jordan Park',
  'Riley Chen',
  'Casey Diaz',
  'Taylor Brooks',
]

const ROLE_LABEL: Record<Member['role'], string> = {
  lead: 'Lead',
  member: 'Member',
  guest: 'Guest',
}

function membersOf(team: Team): Member[] {
  return Array.from({ length: team.memberCount }, (_, i) => {
    const name = PEOPLE[(i + team.name.length) % PEOPLE.length] as string
    return {
      id: `${team.id}-${i}`,
      name,
      email: `${name.toLowerCase().replace(' ', '.')}@example.com`,
      role: i === 0 ? 'lead' : i === team.memberCount - 1 && i > 1 ? 'guest' : 'member',
    }
  })
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
    return 'The member directory is not responding. Try again in a moment.'
  return 'Something went wrong. Try again.'
}

function later<T>(answer: () => T): Promise<T> {
  return new Promise((resolve, reject) =>
    setTimeout(() => {
      try {
        resolve(answer())
      } catch (error) {
        reject(error)
      }
    }, LATENCY),
  )
}

/** One simulated server per page, with its own records. */
function createServer() {
  const members = new Map(TEAMS.map((t) => [t.id, membersOf(t)]))
  let researchFailed = false
  return {
    teams: () => later(() => TEAMS),
    members: (teamId: string) => {
      // The first request for "Research" fails, so that the error state can be seen; "Retry" succeeds
      const fail = teamId === 'research' && !researchFailed
      return later(() => {
        if (fail) {
          researchFailed = true
          throw new ApiError('unavailable')
        }
        return members.get(teamId) ?? []
      })
    },
    setMembers: (teamId: string, list: readonly Member[]) =>
      later(() => {
        members.set(teamId, [...list])
      }),
  }
}

type Server = ReturnType<typeof createServer>

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

/** The right side: the members of one team. It is keyed by the team, so each team starts with its own loading. */
function TeamMembers(props: { readonly team: Team; readonly server: Server }) {
  const { team, server } = props
  const message = useMessage()
  const fetcher = useCallback(() => server.members(team.id), [server, team.id])
  const members = useFakeQuery(fetcher)
  // A spinner for the pane: it appears after 200 ms and then stays for at least 400 ms
  const showLoading = useDelayedPending(members.isPending)
  if (members.isPending || showLoading) return <Loading fill />
  if (members.error && !members.data)
    return <ErrorState fill message={members.error} onRetry={members.refetch} />
  const list = members.data ?? []

  // Reversible: remove right away and offer "Undo"
  const removeMember = async (member: Member) => {
    await server.setMembers(
      team.id,
      list.filter((m) => m.id !== member.id),
    )
    members.refetch()
    message.undoable({
      content: `Removed ${member.name} from ${team.name}`,
      onUndo: async () => {
        await server.setMembers(team.id, list)
        members.refetch()
      },
    })
  }

  return (
    <Stack padding={5} gap={5}>
      <Section
        title={team.name}
        description={team.description}
        actions={
          <Button size="sm" icon={<Icon name="user-plus" />}>
            Add member
          </Button>
        }
      >
        {list.length === 0 ? (
          <EmptyState
            size="sm"
            icon="users"
            title="No members yet"
            description="Add people to this team to share its projects with them"
          />
        ) : (
          <Stack gap={1}>
            {list.map((m) => (
              <ListItem
                key={m.id}
                leading={<Avatar name={m.name} size={32} />}
                title={m.name}
                description={m.email}
                meta={m.role === 'member' ? undefined : <Pill>{ROLE_LABEL[m.role]}</Pill>}
                actionsOnHover
                actions={
                  <IconButton
                    icon="user-minus"
                    label={`Remove ${m.name}`}
                    size="sm"
                    onClick={() => removeMember(m)}
                  />
                }
              />
            ))}
          </Stack>
        )}
      </Section>
    </Stack>
  )
}

/**
 * Master-detail page
 * A SplitView: a searchable list of ListItem on the left, the details of the selected item on the right, each
 * side scrolling on its own. Nothing selected, loading, empty and error states of the right side; the members
 * of "Research" fail on the first request.
 * @zh 主从页
 * SplitView：左侧是可搜索的 ListItem 列表，右侧是选中项的详情，两侧各自滚动。右侧有未选择、加载、空、错误状态；
 * 「Research」的成员第一次请求会失败。
 */
export function MasterDetail() {
  const [server] = useState(createServer)
  const teams = useFakeQuery(server.teams)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const showSkeleton = useDelayedPending(teams.isPending)
  if (teams.isPending || showSkeleton) return <PageSkeleton variant="split" />
  if (!teams.data) return <ErrorState fill message={teams.error} onRetry={teams.refetch} />

  const text = search.trim().toLowerCase()
  const visible = teams.data.filter((t) => t.name.toLowerCase().includes(text))
  const selected = teams.data.find((t) => t.id === selectedId)

  return (
    // `fill`: the split view takes the remaining height, and each side scrolls on its own
    <Page title="Teams" subtitle="Who works on which projects" fill>
      <SplitView
        aside={
          <Stack gap={2} padding={2}>
            <Input.Search
              aria-label="Search teams"
              placeholder="Search teams"
              allowClear
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {visible.length === 0 ? (
              <EmptyState size="sm" icon="search" title="No matching teams" />
            ) : (
              <Stack gap={1}>
                {visible.map((t) => (
                  <ListItem
                    key={t.id}
                    leading={<Avatar name={t.name} size={28} />}
                    title={t.name}
                    meta={<CountBadge count={t.memberCount} />}
                    selected={t.id === selectedId}
                    onClick={() => setSelectedId(t.id)}
                  />
                ))}
              </Stack>
            )}
          </Stack>
        }
      >
        {selected ? (
          <TeamMembers key={selected.id} team={selected} server={server} />
        ) : (
          <EmptyState
            icon="users"
            title="Select a team"
            description="Its members and their roles are shown here"
            fill
          />
        )}
      </SplitView>
    </Page>
  )
}
