/**
 * Small building blocks shared by the pages: inline markup of documentation texts, and what is downloaded when a
 * page opens (page data, Markdown, examples and recipes) with its loading and error states.
 */
import {
  Component,
  createContext,
  type ReactNode,
  Suspense,
  use,
  useCallback,
  useMemo,
  useState,
} from 'react'
import { ErrorState, Loading, Stack, Text } from 'vellum-ui'

/**
 * The inline markup of TSDoc texts in `components.json`: only `code` and **bold** (see CONTRIBUTING.md). Each match
 * is keyed by its position, which is stable for a given text.
 */
export function inline(text: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /`([^`]+)`|\*\*([^*]+)\*\*/g
  let last = 0
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push(text.slice(last, m.index))
    out.push(
      m[1] !== undefined ? (
        <Text key={m.index} as="code" mono size="sm">
          {m[1]}
        </Text>
      ) : (
        <Text key={m.index} weight="semibold">
          {m[2]}
        </Text>
      ),
    )
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

/** A documentation text: paragraphs separated by blank lines, each with inline markup. */
export function Prose(props: {
  readonly text: string
  readonly tone?: 'secondary'
  readonly size?: 'sm'
}) {
  const paragraphs = props.text.split(/\n\s*\n/).filter((p) => p.trim())
  return (
    <Stack gap={2}>
      {paragraphs.map((p) => (
        <Text key={p} as="p" tone={props.tone} size={props.size}>
          {inline(p.replace(/\s*\n\s*/g, ' '))}
        </Text>
      ))}
    </Stack>
  )
}

/**
 * Downloads by id (modules, Markdown, page data). A rejected promise stays here until the user retries: dropping it
 * right away would make React render again with a new request, in a loop while the network is down.
 */
const downloads = new Map<string, Promise<unknown>>()

/** Starts the download of `id` on first use and returns it; later calls (and other parts of a page) share it. */
export function download<T>(id: string, loader: () => Promise<T>): Promise<T> {
  let p = downloads.get(id) as Promise<T> | undefined
  if (!p) {
    p = loader()
    downloads.set(id, p)
  }
  return p
}

/** Error boundary: shows an ErrorState instead of its content when it throws (nothing when `silent`). */
class Boundary extends Component<
  {
    readonly title?: string
    readonly message?: string
    /** Renders nothing on failure: another part of the page shows the error and its "Retry". */
    readonly silent?: boolean
    readonly onRetry?: () => void
    readonly children: ReactNode
  },
  { failed: boolean }
> {
  override state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  override render() {
    if (!this.state.failed) return this.props.children
    if (this.props.silent) return null
    return (
      <ErrorState
        size="sm"
        title={this.props.title}
        message={this.props.message}
        onRetry={() => {
          // With onRetry the parent mounts a new boundary; otherwise render the content again
          if (this.props.onRetry) this.props.onRetry()
          else this.setState({ failed: false })
        }}
      />
    )
  }
}

interface DownloadState {
  readonly promise: Promise<unknown>
  /** Changes when the download is retried, mounting the parts that show it again. */
  readonly attempt: number
  readonly retry: () => void
}

const DownloadContext = createContext<DownloadState | null>(null)

/**
 * Downloads `loader` (once per `id`) for the parts of the page below it (Downloaded), such as the lede in the header
 * and the body of a Markdown page. "Retry" in any of them downloads it again for all of them.
 */
export function Download<T>(props: {
  readonly id: string
  readonly loader: () => Promise<T>
  readonly children: ReactNode
}) {
  const { id } = props
  const [attempt, setAttempt] = useState(0)
  const promise = download(id, props.loader)
  const retry = useCallback(() => {
    downloads.delete(id)
    setAttempt((n) => n + 1)
  }, [id])
  const state = useMemo(() => ({ promise, attempt, retry }), [promise, attempt, retry])
  return <DownloadContext value={state}>{props.children}</DownloadContext>
}

function Read<T>(props: {
  readonly promise: Promise<T>
  readonly children: (value: T) => ReactNode
}) {
  return props.children(use(props.promise))
}

/**
 * A part of the page that shows the download of the nearest Download: `fallback` while it downloads; when it fails,
 * an ErrorState with "Retry" if `failed` is given, otherwise nothing.
 */
export function Downloaded<T>(props: {
  readonly fallback?: ReactNode
  readonly failed?: { readonly title: string; readonly message: string }
  readonly children: (value: T) => ReactNode
}) {
  const state = use(DownloadContext)
  if (!state) throw new Error('Downloaded needs a Download around it')
  return (
    <Boundary
      key={state.attempt}
      title={props.failed?.title}
      message={props.failed?.message}
      silent={!props.failed}
      onRetry={state.retry}
    >
      <Suspense fallback={props.fallback ?? null}>
        <Read promise={state.promise as Promise<T>}>{props.children}</Read>
      </Suspense>
    </Boundary>
  )
}

/**
 * Renders `children` with something that is downloaded on first use (a module or data): Loading while it downloads,
 * an ErrorState with "Retry" when the download fails.
 */
export function WithModule<T>(props: {
  readonly id: string
  readonly loader: () => Promise<T>
  readonly failedTitle: string
  readonly failedMessage: string
  readonly children: (value: T) => ReactNode
}) {
  return (
    <Download id={props.id} loader={props.loader}>
      <Downloaded<T>
        fallback={<Loading />}
        failed={{ title: props.failedTitle, message: props.failedMessage }}
      >
        {props.children}
      </Downloaded>
    </Download>
  )
}

/** An error boundary around one live example, so that an example that throws does not break the page. */
export function ExampleBoundary(props: {
  readonly title: string
  readonly message: string
  readonly children: ReactNode
}) {
  return (
    <Boundary title={props.title} message={props.message}>
      {props.children}
    </Boundary>
  )
}
