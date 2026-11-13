import {
  Avatar,
  Button,
  Grid,
  Icon,
  type IconName,
  Inline,
  LinkButton,
  ListItem,
  Panel,
  Pill,
  type PillProps,
  Progress,
  Section,
  Stack,
  Statistic,
  Text,
  useMessage,
} from 'vellum-ui'
import styles from './WorkspaceHome.module.css'

// —— Data of the recipe: replace with your API ——

const USER = { firstName: 'Alex' }

/** A color of the chart palette, as its number: the CSS turns `data-tone="3"` into `--vl-color-chart-3`. */
type Tone = 1 | 2 | 3 | 4 | 7

interface QuickAction {
  readonly label: string
  readonly hint: string
  readonly icon: IconName
  readonly tone: Tone
}

const QUICK_ACTIONS: readonly QuickAction[] = [
  { label: 'New document', hint: 'Start from a blank page', icon: 'compose', tone: 1 },
  { label: 'Upload files', hint: 'Images, PDFs and sheets', icon: 'upload', tone: 3 },
  { label: 'Invite people', hint: 'Add teammates to the workspace', icon: 'user-plus', tone: 2 },
  { label: 'Schedule a meeting', hint: 'Find a time for everyone', icon: 'calendar', tone: 4 },
]

type Kind = 'doc' | 'board' | 'sheet' | 'design'

/** The icon and the color of each kind of work, for the thumbnails. */
const KINDS: Record<Kind, { readonly icon: IconName; readonly tone: Tone }> = {
  doc: { icon: 'file-text', tone: 1 },
  board: { icon: 'kanban', tone: 7 },
  sheet: { icon: 'grid', tone: 3 },
  design: { icon: 'palette', tone: 2 },
}

type Status = 'Draft' | 'In review' | 'Active' | 'Approved' | 'Shared'

const STATUS_TONE: Record<Status, PillProps['tone']> = {
  Draft: 'neutral',
  'In review': 'warning',
  Active: 'accent',
  Approved: 'success',
  Shared: 'neutral',
}

interface RecentItem {
  readonly title: string
  readonly kind: Kind
  /** When it last changed, as shown on the card. */
  readonly edited: string
  readonly status: Status
}

const RECENT: readonly RecentItem[] = [
  { title: 'Q4 launch plan', kind: 'doc', edited: '12 min ago', status: 'In review' },
  { title: 'Sprint 46 board', kind: 'board', edited: '1 h ago', status: 'Active' },
  { title: 'Pricing experiments', kind: 'sheet', edited: 'yesterday', status: 'Shared' },
  { title: 'Onboarding screens', kind: 'design', edited: 'yesterday', status: 'Approved' },
  { title: 'Customer interview notes', kind: 'doc', edited: 'on Monday', status: 'Draft' },
  { title: 'Release checklist', kind: 'board', edited: 'on Monday', status: 'Active' },
]

interface ActivityEntry {
  readonly id: string
  readonly who: string
  readonly what: string
  readonly when: string
}

const ACTIVITY: readonly ActivityEntry[] = [
  { id: 'a1', who: 'Riley Chen', what: 'Commented on Q4 launch plan', when: '8 min' },
  { id: 'a2', who: 'Sam Lee', what: 'Approved Onboarding screens', when: '1 h' },
  { id: 'a3', who: 'Jordan Park', what: 'Shared Pricing experiments', when: '3 h' },
  { id: 'a4', who: 'Taylor Kim', what: 'Joined the workspace', when: 'Yesterday' },
]

const COMPLETED = [9, 12, 11, 14, 13, 15, 17, 16, 18, 21, 20, 24]

const greetingAt = (hour: number) =>
  hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

const longDate = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
})

// —— The page ——

/**
 * Workspace home
 * A start page with a visual style of its own, built with CSS Modules and design tokens on top of the library
 * components. Its own elements (an accent-tinted greeting band, quick-action tiles and a responsive grid of recent
 * work) take colors, spacing, radii, shadows and type only from `var(--vl-…)` tokens and use `data-vl-state` for
 * hover, press and focus, so they follow the color mode, the accent color and the density; a Statistic, a
 * Progress and an activity feed of ListItems in Panels sit next to them unchanged.
 * @zh 工作区首页
 * 在组件库之上用 CSS Modules 与设计令牌做出自有视觉风格的首页。自己的元素（带强调色调的问候横幅、快捷操作磁贴、
 * 自适应的最近工作卡片网格）的颜色、间距、圆角、阴影与字体只取 `var(--vl-…)` 令牌，悬停、按下与焦点用
 * `data-vl-state`，因此随颜色模式、强调色与密度变化；旁边的 Statistic、Progress 与 Panel 中 ListItem 组成的动态
 * 保持组件库原样。
 * @level scenario
 */
export function WorkspaceHome() {
  const message = useMessage()
  // A real page navigates here, with the router of the application
  const open = (what: string) => message.info(`Open ${what} here`)
  const now = new Date()

  return (
    // No Page: a start page has no title row, the greeting band is its header and holds the h1. The .home
    // column gives it the same width limit and entrance motion as Page
    <div className={styles.home}>
      <header className={styles.hero}>
        <div className={styles.heroText}>
          <Stack gap={2}>
            <Text overline>{longDate.format(now)}</Text>
            {/* An element of our own, for a larger title than Heading offers; its type comes from tokens */}
            <h1 className={styles.greeting}>
              {greetingAt(now.getHours())}, {USER.firstName}
            </h1>
            <Text tone="secondary">
              Three reviews are waiting for you, and the Q4 launch is due in 6 days.
            </Text>
          </Stack>
          <Inline gap={2} wrap>
            <Button variant="primary" icon="plus" onClick={() => open('the new project form')}>
              New project
            </Button>
            <Button icon="inbox" onClick={() => open('the inbox')}>
              Open inbox
            </Button>
          </Inline>
        </div>
        <div className={styles.upNext}>
          <span className={styles.chip}>
            <Icon name="clock" size={18} />
          </span>
          <Stack gap={1}>
            <Text size="xs" tone="secondary" overline>
              Up next
            </Text>
            <Text weight="semibold">Design review</Text>
            <Text size="sm" tone="secondary" numeric>
              10:30 to 11:00, Room 4
            </Text>
          </Stack>
        </div>
      </header>

      <Section title="Quick actions">
        {/* The tiles are native buttons: keyboard focus and activation come for free, data-vl-state adds the
            shared hover, press and focus feedback */}
        <div className={styles.tiles}>
          {QUICK_ACTIONS.map((a) => (
            <button
              key={a.label}
              type="button"
              className={styles.tile}
              data-tone={a.tone}
              data-vl-state=""
              onClick={() => open(a.label.toLowerCase())}
            >
              <span className={styles.chip}>
                <Icon name={a.icon} size={18} />
              </span>
              <span className={styles.tileText}>
                <Text weight="semibold">{a.label}</Text>
                <Text size="sm" tone="secondary">
                  {a.hint}
                </Text>
              </span>
            </button>
          ))}
        </div>
      </Section>

      <div className={styles.columns}>
        <div className={styles.main}>
          <Section
            title="Continue where you left off"
            actions={<LinkButton onClick={() => open('all recent work')}>View all</LinkButton>}
          >
            {/* The library Grid lays out the cards; only the cards themselves are ours */}
            <Grid minColumn="md" gap={4}>
              {RECENT.map((item) => (
                <button
                  key={item.title}
                  type="button"
                  className={styles.card}
                  data-vl-state=""
                  onClick={() => open(`"${item.title}"`)}
                >
                  <span className={styles.thumb} data-tone={KINDS[item.kind].tone}>
                    <span className={styles.chip}>
                      <Icon name={KINDS[item.kind].icon} size={20} />
                    </span>
                  </span>
                  <span className={styles.cardBody}>
                    <Text weight="semibold" truncate>
                      {item.title}
                    </Text>
                    <span className={styles.cardMeta}>
                      <Text size="sm" tone="secondary" truncate>
                        Edited {item.edited}
                      </Text>
                      <Pill tone={STATUS_TONE[item.status]}>{item.status}</Pill>
                    </span>
                  </span>
                </button>
              ))}
            </Grid>
          </Section>
        </div>

        {/* Library components next to the custom ones, unchanged: no className, no style */}
        <div className={styles.aside}>
          <Panel title="This week">
            <Stack gap={4}>
              <Statistic
                label="Tasks completed"
                value={COMPLETED[COMPLETED.length - 1] ?? null}
                delta={{ value: 0.2, period: 'vs last week' }}
                trend={COMPLETED}
              />
              <Stack gap={2}>
                <Inline justify="between">
                  <Text size="sm" weight="medium">
                    Q4 launch
                  </Text>
                  <Text size="sm" tone="secondary">
                    6 days left
                  </Text>
                </Inline>
                <Progress percent={68} aria-label="Q4 launch" />
              </Stack>
            </Stack>
          </Panel>
          <Panel
            title="Activity"
            flush
            actions={<LinkButton onClick={() => open('the activity log')}>All</LinkButton>}
          >
            <Stack gap={1} padding={2}>
              {ACTIVITY.map((e) => (
                <ListItem
                  key={e.id}
                  leading={<Avatar name={e.who} size={32} />}
                  title={e.who}
                  description={e.what}
                  meta={e.when}
                />
              ))}
            </Stack>
          </Panel>
        </div>
      </div>
    </div>
  )
}
