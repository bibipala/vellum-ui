import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Button,
  ErrorState,
  Inline,
  InputNumber,
  Page,
  PageSkeleton,
  Panel,
  Section,
  Select,
  SettingRow,
  Switch,
  useConfirmDanger,
  useDelayedPending,
  useMessage,
} from 'vellum-ui'

// —— Data of the recipe: replace with your API ——

/** Settings that take effect as soon as they are switched. */
interface Notifications {
  readonly email: boolean
  readonly digest: boolean
  readonly mentionsOnly: boolean
}

/** Settings that are saved together with the "Save changes" button. */
interface Workspace {
  /** Minutes of inactivity before signing out. */
  readonly sessionTimeout: number | null
  readonly currency: string
  /** A decimal string, such as "85.00": amounts never go through floating point. */
  readonly hourlyRate: string | null
  readonly weekStart: 'monday' | 'sunday'
}

interface Settings {
  readonly workspaceName: string
  readonly notifications: Notifications
  readonly workspace: Workspace
}

const SETTINGS: Settings = {
  workspaceName: 'Northwind Studio',
  notifications: { email: true, digest: false, mentionsOnly: false },
  workspace: { sessionTimeout: 60, currency: 'USD', hourlyRate: '85.00', weekStart: 'monday' },
}

const CURRENCIES = [
  { value: 'USD', label: 'US dollar (USD)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'GBP', label: 'Pound sterling (GBP)' },
  { value: 'JPY', label: 'Japanese yen (JPY)' },
]

const WEEK_STARTS = [
  { value: 'monday' as const, label: 'Monday' },
  { value: 'sunday' as const, label: 'Sunday' },
]

const NOTIFICATION_LABEL: Record<keyof Notifications, string> = {
  email: 'Email notifications',
  digest: 'Weekly digest',
  mentionsOnly: 'Only when mentioned',
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
    return 'The server is not responding. Check your connection and try again.'
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
  let settings = SETTINGS
  let digestFailed = false
  return {
    settings: () => later(() => settings),
    saveNotification: (key: keyof Notifications, value: boolean) => {
      // The first change of "Weekly digest" fails, so that the rollback can be seen
      const fail = key === 'digest' && !digestFailed
      return later(() => {
        if (fail) {
          digestFailed = true
          throw new ApiError('unavailable')
        }
        settings = { ...settings, notifications: { ...settings.notifications, [key]: value } }
      })
    },
    saveWorkspace: (workspace: Workspace) =>
      later(() => {
        settings = { ...settings, workspace }
      }),
  }
}

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

type Server = ReturnType<typeof createServer>

// —— The page ——

/** The loaded settings: separate from the page, so that the form state starts from the loaded values. */
function SettingsForm(props: { readonly initial: Settings; readonly server: Server }) {
  const { initial, server } = props
  const message = useMessage()
  const confirmDanger = useConfirmDanger()

  // Switches: update right away (optimistically), roll back and explain when saving fails
  const [notifications, setNotifications] = useState(initial.notifications)
  const toggle = async (key: keyof Notifications, value: boolean) => {
    setNotifications((n) => ({ ...n, [key]: value }))
    try {
      await server.saveNotification(key, value)
    } catch (error) {
      setNotifications((n) => ({ ...n, [key]: !value }))
      message.error(`Couldn't save "${NOTIFICATION_LABEL[key]}". ${readableError(error)}`)
    }
  }

  // The workspace group: edited together and saved with one button
  const [saved, setSaved] = useState(initial.workspace)
  const [draft, setDraft] = useState(initial.workspace)
  const [saving, setSaving] = useState(false)
  const edit = (change: Partial<Workspace>) => setDraft((d) => ({ ...d, ...change }))
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const save = async () => {
    setSaving(true)
    try {
      await server.saveWorkspace(draft)
      setSaved(draft)
      message.success('Workspace settings saved')
    } catch (error) {
      message.error(`Couldn't save the workspace settings. ${readableError(error)}`)
    } finally {
      setSaving(false)
    }
  }

  const deleteWorkspace = async () => {
    const ok = await confirmDanger({
      title: 'Delete workspace',
      description:
        'All projects, files and members of this workspace are deleted. This cannot be undone.',
      confirmText: initial.workspaceName,
      okText: 'Delete workspace',
    })
    if (ok) message.success(`Deleted "${initial.workspaceName}"`)
  }

  const switchRow = (key: keyof Notifications, description: string) => (
    <SettingRow
      title={NOTIFICATION_LABEL[key]}
      description={description}
      control={
        // The row names its control: the switch is announced with the title of the row
        <Switch checked={notifications[key]} onChange={(checked) => toggle(key, checked)} />
      }
    />
  )

  return (
    <Page title="Settings" subtitle={`Preferences of ${initial.workspaceName}`} width="narrow">
      <Section title="Notifications" description="Changes take effect immediately">
        <Panel>
          {switchRow('email', 'Send an email when a project you follow changes')}
          {switchRow('digest', 'A summary of the week, every Monday morning')}
          {switchRow('mentionsOnly', 'Notify me only when someone mentions me')}
        </Panel>
      </Section>

      <Section title="Workspace" description="Saved together for everyone in the workspace">
        <Panel>
          <SettingRow
            title="Session timeout (minutes)"
            description="Members are signed out after this many minutes without activity"
            control={
              <InputNumber
                min={5}
                max={1440}
                step={5}
                value={draft.sessionTimeout}
                onChange={(sessionTimeout) => edit({ sessionTimeout })}
              />
            }
          />
          <SettingRow
            title="Currency"
            description="Used for budgets and invoices"
            control={
              <Select
                options={CURRENCIES}
                value={draft.currency}
                onChange={(currency) => edit({ currency })}
              />
            }
          />
          <SettingRow
            title={`Default hourly rate (${draft.currency})`}
            description="Suggested for new members; each project can change it"
            control={
              // `decimal`: the value, `min` and `step` are decimal strings, never floating-point numbers
              <InputNumber
                decimal
                min="0"
                step="0.50"
                precision={2}
                value={draft.hourlyRate}
                onChange={(hourlyRate) => edit({ hourlyRate })}
              />
            }
          />
          <SettingRow
            title="First day of the week"
            control={
              <Select
                options={WEEK_STARTS}
                value={draft.weekStart}
                onChange={(weekStart) => edit({ weekStart })}
              />
            }
          />
        </Panel>
        <Inline justify="end">
          <Button disabled={!dirty || saving} onClick={() => setDraft(saved)}>
            Discard
          </Button>
          <Button
            variant="primary"
            loading={saving}
            disabled={!dirty}
            disabledReason="There are no changes to save"
            onClick={save}
          >
            Save changes
          </Button>
        </Inline>
      </Section>

      <Section title="Danger zone">
        <Panel>
          <SettingRow
            title="Delete workspace"
            description="Deletes all projects, files and members"
            control={
              <Button tone="danger" onClick={deleteWorkspace}>
                Delete workspace
              </Button>
            }
          />
        </Panel>
      </Section>
    </Page>
  )
}

/**
 * Settings page
 * A narrow page of Sections and Panels with SettingRow: switches that take effect immediately (and roll back
 * when saving fails), and a group of InputNumber and Select saved with one button, with a message as feedback;
 * a danger zone at the end. The first change of "Weekly digest" fails, to show the rollback.
 * @zh 设置页
 * 窄页面，由 Section、Panel 与 SettingRow 组成：立即生效的开关（保存失败时回滚），以及一组用一个按钮保存的 InputNumber
 * 与 Select，用消息条反馈结果；最后是危险操作区。第一次切换「Weekly digest」会失败，用来展示回滚。
 */
export function SettingsPage() {
  const [server] = useState(createServer)
  const settings = useFakeQuery(server.settings)
  const showSkeleton = useDelayedPending(settings.isPending)
  if (settings.isPending || showSkeleton) return <PageSkeleton variant="detail" />
  if (!settings.data) return <ErrorState fill message={settings.error} onRetry={settings.refetch} />
  return <SettingsForm initial={settings.data} server={server} />
}
