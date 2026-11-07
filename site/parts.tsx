/**
 * Small building blocks shared by the pages: inline markup of documentation texts, lazily loaded modules
 * (examples and recipes) with their loading and error states.
 */
import { Component, type ReactNode, Suspense, use, useState } from 'react'
import { ErrorState, Loading, Stack, Text } from 'vellum-ui'
import type { ExampleModule } from './content.ts'

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
 * Loaded modules by key. A rejected promise stays here until the user retries: dropping it right away would make
 * React render again with a new request, in a loop while the network is down.
 */
const modules = new Map<string, Promise<ExampleModule>>()

function load(key: string, loader: () => Promise<ExampleModule>): Promise<ExampleModule> {
  let p = modules.get(key)
  if (!p) {
    p = loader()
    modules.set(key, p)
  }
  return p
}

/** Error boundary: shows an ErrorState instead of its content when it throws; retrying renders the content again. */
class Boundary extends Component<
  {
    readonly title: string
    readonly message: string
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

function Loaded(props: {
  readonly id: string
  readonly loader: () => Promise<ExampleModule>
  readonly children: (module: ExampleModule) => ReactNode
}) {
  return props.children(use(load(props.id, props.loader)))
}

/**
 * Renders `children` with a module that is downloaded on first use: Loading while it downloads, an ErrorState with
 * "Retry" when the download fails.
 */
export function WithModule(props: {
  readonly id: string
  readonly loader: () => Promise<ExampleModule>
  readonly failedTitle: string
  readonly failedMessage: string
  readonly children: (module: ExampleModule) => ReactNode
}) {
  // Changing the key mounts a new boundary and a new request after a retry
  const [attempt, setAttempt] = useState(0)
  return (
    <Boundary
      key={attempt}
      title={props.failedTitle}
      message={props.failedMessage}
      onRetry={() => {
        modules.delete(props.id)
        setAttempt((n) => n + 1)
      }}
    >
      <Suspense fallback={<Loading />}>
        <Loaded id={props.id} loader={props.loader}>
          {props.children}
        </Loaded>
      </Suspense>
    </Boundary>
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
