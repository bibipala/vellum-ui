import { type ReactNode, useState } from 'react'
import {
  Avatar,
  Button,
  CopyButton,
  Descriptions,
  DonutChart,
  Heading,
  Icon,
  IconButton,
  type IconName,
  Inline,
  Input,
  LinkButton,
  ListItem,
  Modal,
  Panel,
  Pill,
  Progress,
  Segmented,
  SegmentedBar,
  SettingRow,
  Stack,
  Switch,
  Text,
  useMessage,
} from 'vellum-ui'
import styles from './MobileWallet.module.css'

// —— Data of the recipe: replace with your API ——

const USER = { name: 'Alex Morgan', email: 'alex.morgan@example.com' }
const CARD = { last4: '4821', expires: '09/29', holder: 'ALEX MORGAN' }

/** A color of the chart palette, as its number: the CSS turns `data-tone="3"` into `--vl-color-chart-3`. */
type Tone = 1 | 2 | 3 | 4 | 5 | 6 | 7

type Category = 'groceries' | 'dining' | 'transport' | 'shopping' | 'bills' | 'income' | 'transfer'

/** The name, icon and color of each category, shared by the chips, the bar and the donut. */
const CATEGORIES: Record<
  Category,
  { readonly label: string; readonly icon: IconName; readonly tone: Tone }
> = {
  groceries: { label: 'Groceries', icon: 'receipt', tone: 3 },
  dining: { label: 'Dining', icon: 'smile', tone: 2 },
  transport: { label: 'Transport', icon: 'truck', tone: 1 },
  shopping: { label: 'Shopping', icon: 'package', tone: 5 },
  bills: { label: 'Bills', icon: 'zap', tone: 4 },
  income: { label: 'Income', icon: 'briefcase', tone: 6 },
  transfer: { label: 'Transfer', icon: 'send', tone: 7 },
}

interface Transaction {
  readonly id: string
  readonly merchant: string
  readonly category: Category
  /** Negative for money spent, positive for money received. */
  readonly amount: number
  readonly day: string
  readonly time: string
  readonly note?: string
}

const TRANSACTIONS: readonly Transaction[] = [
  {
    id: 'TX-8F2K-1043',
    merchant: 'Blue Bottle Coffee',
    category: 'dining',
    amount: -6.5,
    day: 'Today',
    time: '08:42',
  },
  {
    id: 'TX-8F2K-1042',
    merchant: 'Riley Chen',
    category: 'transfer',
    amount: 45,
    day: 'Today',
    time: '07:15',
    note: 'Dinner split',
  },
  {
    id: 'TX-8F2J-0991',
    merchant: 'Whole Foods',
    category: 'groceries',
    amount: -84.32,
    day: 'Yesterday',
    time: '18:20',
  },
  {
    id: 'TX-8F2J-0987',
    merchant: 'Acme Inc.',
    category: 'income',
    amount: 3200,
    day: 'Yesterday',
    time: '09:00',
  },
  {
    id: 'TX-8F2J-0975',
    merchant: 'Metro card',
    category: 'transport',
    amount: -25,
    day: 'Yesterday',
    time: '08:05',
  },
  {
    id: 'TX-8F2G-0930',
    merchant: 'City Power',
    category: 'bills',
    amount: -96.4,
    day: 'Mon, Nov 10',
    time: '12:00',
  },
  {
    id: 'TX-8F2G-0921',
    merchant: 'Paper & Ink',
    category: 'shopping',
    amount: -32.99,
    day: 'Mon, Nov 10',
    time: '10:31',
  },
]

type Period = 'week' | 'month'

/** Spending per category; categories without spending are left out of the charts. */
const SPENDING: Record<Period, Partial<Record<Category, number>>> = {
  week: { shopping: 120, groceries: 86.4, dining: 64.2, transport: 38 },
  month: { groceries: 412.8, shopping: 389.9, dining: 268.5, bills: 214, transport: 146 },
}

const CONTACTS = ['Riley Chen', 'Sam Lee', 'Jordan Park', 'Taylor Kim', 'Morgan Diaz'] as const

type Tab = 'home' | 'cards' | 'stats' | 'profile'

const TABS: readonly { readonly key: Tab; readonly label: string; readonly icon: IconName }[] = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'cards', label: 'Cards', icon: 'wallet' },
  { key: 'stats', label: 'Stats', icon: 'chart' },
  { key: 'profile', label: 'Profile', icon: 'user' },
]

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const signed = (n: number) => (n > 0 ? `+${usd.format(n)}` : usd.format(n))
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** The spending of a period as chart items, largest first; `slot` keeps the color of the category chip. */
function spendingItems(period: Period) {
  return Object.entries(SPENDING[period])
    .map(([key, value]) => ({ key, value: value ?? 0, category: CATEGORIES[key as Category] }))
    .sort((a, b) => b.value - a.value)
    .map(({ key, value, category }) => ({ key, name: category.label, value, slot: category.tone }))
}

/** Transactions grouped by day, in the order they come. */
function byDay(list: readonly Transaction[]) {
  const groups = new Map<string, Transaction[]>()
  for (const t of list) groups.set(t.day, [...(groups.get(t.day) ?? []), t])
  return [...groups]
}

// —— Small pieces ——

/** A round icon chip in the color of a category. */
function Chip(props: { readonly category: Category; readonly large?: boolean }) {
  const c = CATEGORIES[props.category]
  return (
    <span className={styles.chip} data-tone={c.tone} data-large={props.large || undefined}>
      <Icon name={c.icon} size={props.large ? 24 : 18} />
    </span>
  )
}

/** A large amount: the dollars at full size, the cents smaller, or dots while amounts are hidden. */
function BigAmount(props: { readonly value: number; readonly hidden?: boolean }) {
  if (props.hidden) return <span className={styles.bigAmount}>$ ••••••</span>
  const [whole, cents] = usd.format(props.value).split('.')
  return (
    <span className={styles.bigAmount}>
      {whole}
      <span className={styles.cents}>.{cents}</span>
    </span>
  )
}

/** One transaction: a native button, so the whole row (amount included) is one target with one name. */
function TransactionRow(props: { readonly t: Transaction; readonly onOpen: () => void }) {
  const { t } = props
  return (
    <button type="button" className={styles.txn} data-vl-state="" onClick={props.onOpen}>
      <Chip category={t.category} />
      <span className={styles.txnText}>
        <Text weight="semibold" truncate>
          {t.merchant}
        </Text>
        <Text size="sm" tone="secondary" truncate>
          {t.note ?? CATEGORIES[t.category].label} · {t.time}
        </Text>
      </span>
      <Text weight="semibold" numeric tone={t.amount > 0 ? 'success' : 'primary'}>
        {signed(t.amount)}
      </Text>
    </button>
  )
}

/** A view of the phone: its title row and content, rising in when the tab changes. */
function View(props: {
  readonly title: ReactNode
  readonly action?: ReactNode
  readonly children: ReactNode
}) {
  return (
    <div className={styles.view}>
      <Inline justify="between">
        <Heading level={2}>{props.title}</Heading>
        {props.action}
      </Inline>
      {props.children}
    </div>
  )
}

// —— The send sheet: its state lives inside the Modal, so it starts afresh each time it opens ——

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'] as const

function SendSheet(props: {
  readonly balance: number
  readonly onSent: (to: string, amount: number, note: string) => void
  readonly onDone: () => void
}) {
  const [to, setTo] = useState<string>(CONTACTS[0])
  const [digits, setDigits] = useState('0')
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<number | null>(null)
  const amount = Number(digits)

  // A keypad of our own: at most two decimals and six whole digits, like a banking app
  const press = (key: (typeof KEYS)[number]) => {
    if (key === 'back') return setDigits((d) => (d.length > 1 ? d.slice(0, -1) : '0'))
    setDigits((d) => {
      if (key === '.') return d.includes('.') ? d : `${d}.`
      const [whole = '', cents] = d.split('.')
      if (cents !== undefined ? cents.length >= 2 : whole.length >= 6) return d
      return d === '0' ? key : d + key
    })
  }

  const send = async () => {
    setSending(true)
    await wait(1200) // The transfer request of your API
    props.onSent(to, amount, note)
    setSending(false)
    setSent(amount)
  }

  if (sent !== null)
    return (
      <div className={styles.success}>
        <span className={styles.successMark}>
          <Icon name="check" size={32} />
        </span>
        <Stack gap={1} align="center">
          <Heading level={2}>Money sent</Heading>
          <Text tone="secondary">
            {usd.format(sent)} is on its way to {to}.
          </Text>
        </Stack>
        <Button variant="primary" size="lg" block onClick={props.onDone}>
          Done
        </Button>
      </div>
    )

  const reason =
    amount <= 0 ? 'Enter an amount' : amount > props.balance ? 'More than your balance' : undefined

  return (
    <Stack gap={4}>
      {/* Contacts: a scrolling row of avatars; the chosen one gets the accent ring */}
      <fieldset className={styles.contacts} aria-label="Recipient">
        {CONTACTS.map((name) => (
          <button
            key={name}
            type="button"
            className={styles.contact}
            data-vl-state=""
            aria-pressed={name === to}
            onClick={() => setTo(name)}
          >
            <Avatar name={name} size={48} ring={name === to} />
            <Text size="xs" weight={name === to ? 'semibold' : 'regular'} truncate>
              {name.split(' ')[0]}
            </Text>
          </button>
        ))}
      </fieldset>

      <Stack gap={1} align="center">
        <output className={styles.entry} aria-live="polite" aria-label="Amount">
          <span className={styles.entryCurrency}>$</span>
          {digits}
        </output>
        <Text size="sm" tone={amount > props.balance ? 'danger' : 'secondary'} numeric>
          {amount > props.balance
            ? 'More than your balance'
            : `Balance ${usd.format(props.balance)}`}
        </Text>
      </Stack>

      <div className={styles.keypad}>
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            className={styles.key}
            data-vl-state=""
            aria-label={
              key === 'back' ? 'Delete last digit' : key === '.' ? 'Decimal point' : undefined
            }
            onClick={() => press(key)}
          >
            {key === 'back' ? <Icon name="arrow-left" size={20} /> : key}
          </button>
        ))}
      </div>

      <Input
        prefix={<Icon name="edit" />}
        placeholder="Add a note (optional)"
        aria-label="Note"
        maxLength={60}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <Button
        variant="primary"
        size="lg"
        block
        icon="send"
        loading={sending}
        disabled={reason !== undefined}
        disabledReason={reason}
        onClick={send}
      >
        Send {amount > 0 ? usd.format(amount) : ''} to {to.split(' ')[0]}
      </Button>
    </Stack>
  )
}

// —— The page ——

/**
 * Mobile wallet
 * A personal finance app drawn for a phone: a vivid gradient balance card with the largest type of the theme,
 * round quick actions, a spending summary, transactions grouped by day and a bottom tab bar, in a device-like
 * column on wide screens that fills the width on narrow ones. Sending money opens a sheet with a contact row,
 * a keypad of its own and a confirmation that loads; a transaction opens its details; the tabs switch to the
 * card with its controls and limit, a donut of spending, and the profile. Every custom color, radius and size
 * is a token, so it follows the color mode, the accent color and the density.
 * @zh 移动钱包
 * 为手机屏幕设计的个人理财应用：鲜艳的渐变余额卡片用主题中最大的字号，圆形快捷操作、支出概览、按天分组的交易与
 * 底部标签栏；宽屏上显示为居中的设备式窄栏，窄屏上铺满宽度。转账打开一个面板：联系人头像行、自己的数字键盘与带加载
 * 状态的确认；点击交易查看详情；标签栏切换到卡片（冻结与额度）、支出环形图与个人资料。自定义的颜色、圆角与尺寸都取
 * 自令牌，因此随颜色模式、强调色与密度变化。
 * @level scenario
 */
export function MobileWallet() {
  const message = useMessage()
  const [tab, setTab] = useState<Tab>('home')
  const [balance, setBalance] = useState(4825.6)
  const [hidden, setHidden] = useState(false)
  const [period, setPeriod] = useState<Period>('month')
  const [transactions, setTransactions] = useState(TRANSACTIONS)
  // The Modal stays rendered: `open` switches, the last transaction stays shown while it closes
  const [detail, setDetail] = useState<Transaction>()
  const [detailOpen, setDetailOpen] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)
  const [frozen, setFrozen] = useState(false)
  const [freezing, setFreezing] = useState(false)

  const spending = spendingItems(period)
  const spent = spending.reduce((sum, s) => sum + s.value, 0)

  const openDetail = (t: Transaction) => {
    setDetail(t)
    setDetailOpen(true)
  }

  const onSent = (to: string, amount: number, note: string) => {
    setBalance((b) => b - amount)
    setTransactions((list) => [
      {
        id: `TX-${Date.now().toString(36).toUpperCase()}`,
        merchant: to,
        category: 'transfer',
        amount: -amount,
        day: 'Today',
        time: 'Just now',
        note: note || undefined,
      },
      ...list,
    ])
    message.success(`Sent ${usd.format(amount)} to ${to}`)
  }

  const toggleFreeze = async (next: boolean) => {
    setFreezing(true)
    await wait(800) // The card API
    setFreezing(false)
    setFrozen(next)
    message.success(next ? 'Card frozen: payments are declined' : 'Card unfrozen')
  }

  const later = (what: string) => message.info(`${what} opens here`)

  const quickActions: readonly { label: string; icon: IconName; run: () => void }[] = [
    { label: 'Send', icon: 'send', run: () => setSendOpen(true) },
    { label: 'Request', icon: 'arrow-down', run: () => later('Request money') },
    { label: 'Top up', icon: 'plus', run: () => later('Top up') },
    { label: 'More', icon: 'more', run: () => later('More actions') },
  ]

  const periodSwitch = (
    <Segmented
      size="sm"
      value={period}
      onChange={setPeriod}
      options={[
        { label: 'Week', value: 'week' },
        { label: 'Month', value: 'month' },
      ]}
    />
  )

  const card = (
    <div className={styles.card} data-frozen={frozen || undefined}>
      <Inline justify="between">
        <span className={styles.cardBrand}>vellum</span>
        {frozen ? <Icon name="lock" size={20} label="Frozen" /> : <Icon name="zap" size={20} />}
      </Inline>
      <span className={styles.cardNumber}>•••• •••• •••• {hidden ? '••••' : CARD.last4}</span>
      <Inline justify="between">
        <span className={styles.cardLabel}>{CARD.holder}</span>
        <span className={styles.cardLabel}>{CARD.expires}</span>
      </Inline>
    </div>
  )

  const views: Record<Tab, ReactNode> = {
    home: (
      <div className={styles.view}>
        <header className={styles.top}>
          <Avatar name={USER.name} size={44} ring />
          <span className={styles.hello}>
            <Text size="sm" tone="secondary">
              Good morning
            </Text>
            <Text size="lg" weight="semibold">
              {USER.name.split(' ')[0]}
            </Text>
          </span>
          <span className={styles.bell}>
            <IconButton
              icon="bell"
              variant="soft"
              size="lg"
              label="Notifications, 2 new"
              onClick={() => later('Notifications')}
            />
            <span className={styles.bellDot} aria-hidden />
          </span>
        </header>

        {/* The balance card: our own surface, a gradient of the accent and two chart colors */}
        <section className={styles.balance} aria-label="Balance">
          <Inline justify="between">
            <span className={styles.balanceLabel}>Total balance</span>
            <button
              type="button"
              className={styles.eye}
              data-vl-state=""
              aria-pressed={hidden}
              aria-label={hidden ? 'Show amounts' : 'Hide amounts'}
              onClick={() => setHidden((h) => !h)}
            >
              <Icon name={hidden ? 'eye-off' : 'eye'} size={18} />
            </button>
          </Inline>
          <BigAmount value={balance} hidden={hidden} />
          <Inline justify="between">
            <span className={styles.cardDigits}>•••• {CARD.last4}</span>
            <span className={styles.trend}>
              <Icon name="arrow-up" size={14} />
              2.4% this month
            </span>
          </Inline>
        </section>

        <nav className={styles.actions} aria-label="Quick actions">
          {quickActions.map((a, i) => (
            <button
              key={a.label}
              type="button"
              className={styles.action}
              data-primary={i === 0 || undefined}
              data-vl-state=""
              onClick={a.run}
            >
              <span className={styles.actionIcon}>
                <Icon name={a.icon} size={22} />
              </span>
              <Text size="sm" weight="medium">
                {a.label}
              </Text>
            </button>
          ))}
        </nav>

        <Panel title="Spending" actions={periodSwitch}>
          <Stack gap={3}>
            <Inline align="baseline" gap={2}>
              <Text size="xl" weight="semibold" numeric>
                {usd.format(spent)}
              </Text>
              <Text size="sm" tone="secondary">
                {period === 'week' ? 'this week' : 'in November'}
              </Text>
            </Inline>
            <SegmentedBar
              variant="tall"
              label="Spending by category"
              items={spending}
              format={usd.format}
            />
          </Stack>
        </Panel>

        <Stack gap={3}>
          <Inline justify="between">
            <Heading level={3}>Activity</Heading>
            <LinkButton onClick={() => later('All transactions')}>See all</LinkButton>
          </Inline>
          {byDay(transactions).map(([day, list]) => (
            <div key={day} className={styles.day}>
              <Inline justify="between">
                <Text overline>{day}</Text>
                <Text size="sm" tone="tertiary" numeric>
                  {signed(list.reduce((sum, t) => sum + t.amount, 0))}
                </Text>
              </Inline>
              <div className={styles.dayList}>
                {list.map((t) => (
                  <TransactionRow key={t.id} t={t} onOpen={() => openDetail(t)} />
                ))}
              </div>
            </div>
          ))}
        </Stack>
      </div>
    ),

    cards: (
      <View
        title="Cards"
        action={
          <IconButton
            icon="plus"
            variant="soft"
            label="Add a card"
            onClick={() => later('Add a card')}
          />
        }
      >
        {card}
        <Panel title="Card settings">
          <Stack gap={2}>
            <SettingRow
              title="Freeze card"
              description="Declines every payment until you unfreeze it."
              control={<Switch checked={frozen} loading={freezing} onChange={toggleFreeze} />}
            />
            <SettingRow
              title="Online payments"
              control={<Switch defaultChecked disabled={frozen} />}
            />
            <SettingRow title="Contactless" control={<Switch defaultChecked disabled={frozen} />} />
          </Stack>
        </Panel>
        <Panel title="Monthly limit">
          <Stack gap={2}>
            <Inline justify="between">
              <Text weight="semibold" numeric>
                {usd.format(spent)}
              </Text>
              <Text size="sm" tone="secondary" numeric>
                of {usd.format(2000)}
              </Text>
            </Inline>
            <Progress
              percent={(spent / 2000) * 100}
              tone={spent > 1600 ? 'warning' : 'accent'}
              showValue={false}
              aria-label="Monthly limit used"
            />
          </Stack>
        </Panel>
      </View>
    ),

    stats: (
      <View title="Stats" action={periodSwitch}>
        <Panel>
          <DonutChart
            plain
            title="Spending by category"
            description={period === 'week' ? 'This week' : 'November'}
            data={spending}
            format={usd.format}
            height={200}
          />
        </Panel>
        <div className={styles.dayList}>
          {spending.map((s) => {
            return (
              <div key={s.key} className={styles.txn}>
                <Chip category={s.key as Category} />
                <span className={styles.txnText}>
                  <Text weight="semibold">{s.name}</Text>
                  <Text size="sm" tone="secondary" numeric>
                    {Math.round((s.value / spent) * 100)}% of spending
                  </Text>
                </span>
                <Text weight="semibold" numeric>
                  {usd.format(s.value)}
                </Text>
              </div>
            )
          })}
        </div>
      </View>
    ),

    profile: (
      <View title="Profile">
        <div className={styles.profile}>
          <Avatar name={USER.name} size={72} ring />
          <Stack gap={0} align="center">
            <Text size="xl" weight="semibold">
              {USER.name}
            </Text>
            <Text size="sm" tone="secondary">
              {USER.email}
            </Text>
          </Stack>
          <Pill tone="success" icon="shield">
            Verified
          </Pill>
        </div>
        <Panel flush>
          <Stack gap={1} padding={2}>
            <ListItem
              leading={<Icon name="user" />}
              title="Personal details"
              onClick={() => later('Personal details')}
            />
            <ListItem
              leading={<Icon name="lock" />}
              title="Security"
              description="Passcode and Face ID"
              onClick={() => later('Security')}
            />
            <ListItem
              leading={<Icon name="bell" />}
              title="Notifications"
              onClick={() => later('Notifications')}
            />
            <ListItem
              leading={<Icon name="logout" />}
              title="Sign out"
              onClick={() => later('Sign out')}
            />
          </Stack>
        </Panel>
      </View>
    ),
  }

  return (
    // The stage centers the phone; the phone is the device-like column, its screen scrolls under the tab bar
    <div className={styles.stage}>
      <div className={styles.phone}>
        <div className={styles.statusBar} aria-hidden>
          <span>9:41</span>
          <span className={styles.island} />
          <span>5G</span>
        </div>
        {/* The key restarts the entrance motion of the view on every tab change */}
        <main key={tab} className={styles.screen}>
          {views[tab]}
        </main>
        <nav className={styles.tabbar} aria-label="Main">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={styles.tab}
              data-vl-state=""
              aria-current={t.key === tab ? 'page' : undefined}
              onClick={() => setTab(t.key)}
            >
              <span className={styles.tabIcon}>
                <Icon name={t.icon} size={20} />
              </span>
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <Modal
        open={detailOpen}
        title="Transaction"
        width="var(--vl-page-width-form)"
        onCancel={() => setDetailOpen(false)}
        footer={
          <Button block onClick={() => later('Report a problem')} icon="alert">
            Report a problem
          </Button>
        }
      >
        {detail && (
          <Stack gap={4}>
            <Stack gap={2} align="center">
              <Chip category={detail.category} large />
              <Text weight="semibold">{detail.merchant}</Text>
              <span className={styles.detailAmount} data-income={detail.amount > 0 || undefined}>
                {signed(detail.amount)}
              </span>
              <Pill tone="success" dot>
                Completed
              </Pill>
            </Stack>
            <Descriptions column={1} size="sm">
              <Descriptions.Item label="Date">
                {detail.day}, {detail.time}
              </Descriptions.Item>
              <Descriptions.Item label="Category">
                {CATEGORIES[detail.category].label}
              </Descriptions.Item>
              {detail.note && <Descriptions.Item label="Note">{detail.note}</Descriptions.Item>}
              <Descriptions.Item label="Card">
                <Text mono>•••• {CARD.last4}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Reference">
                <Inline gap={1}>
                  <Text mono>{detail.id}</Text>
                  <CopyButton text={detail.id} size="sm" label="Copy reference" />
                </Inline>
              </Descriptions.Item>
            </Descriptions>
          </Stack>
        )}
      </Modal>

      <Modal
        open={sendOpen}
        title="Send money"
        width="var(--vl-page-width-form)"
        footer={null}
        maskClosable={false}
        onCancel={() => setSendOpen(false)}
      >
        <SendSheet balance={balance} onSent={onSent} onDone={() => setSendOpen(false)} />
      </Modal>
    </div>
  )
}
