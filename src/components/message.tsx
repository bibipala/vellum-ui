/**
 * 消息条：从底部居中滑入，最多叠 3 条（新的在下）；默认 4 秒、带「撤销」的 6 秒，悬停或键盘焦点
 * 在消息条上时暂停计时；同一个 key 原地更新。计时与叠放的规则在 messageStore.ts（与 React 无关），这里只做界面。
 *
 * antd 的 App 仍然保留：Modal、Popconfirm、useConfirmDanger 需要它的上下文；但不再使用它的 message（只能在顶部）。
 */
import { App as AntApp } from 'antd'
import {
  createContext,
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { createPortal } from 'react-dom'
import { useT } from '../i18n/index.ts'
import { Icon, type IconProps } from './Icon.tsx'
import styles from './message.module.css'
import {
  createMessageApi,
  createMessageStore,
  MESSAGE_DEFAULTS,
  type MessageEntry,
  type MessageKind,
  type MessageStore,
} from './messageStore.ts'

/**
 * Global settings of messages.
 * @zh 消息条的全局设置。
 */
export interface MessageConfig {
  /**
   * Maximum number of messages shown at the same time; beyond that, the oldest one leaves first.
   * @zh 最多同时显示几条；超出时最早的一条先离开。
   * @default 3
   */
  readonly maxCount?: number
  /**
   * Default number of seconds a message is shown (messages with "Undo" have their own default of 6 seconds).
   * @zh 普通消息的默认显示秒数（带「撤销」的消息条另有默认值 6 秒）。
   * @default 4
   */
  readonly duration?: number
}

/** App 自有的属性。 */
interface AppOwnProps {
  /**
   * The application.
   * @zh 应用的内容。
   */
  readonly children?: ReactNode
  /**
   * Global settings of messages. Only applies to the outermost App: nested Apps use the messages of the outer one.
   * @zh 消息条的全局设置。只在最外层的 App 上生效：嵌套的 App 沿用外层的消息条。
   */
  readonly message?: MessageConfig
}

/**
 * Props of App.
 * @zh App 属性。
 */
export interface AppProps extends AppOwnProps {}

/** 消息条的参数（对象形式）。 */
export interface MessageOptions {
  /** 消息内容。 */
  readonly content: ReactNode
  /** 显示秒数；0 表示不自动关闭。默认 4 秒，悬停时暂停计时。 */
  readonly duration?: number
  /** 唯一键：同一个键的消息原地更新，例如把「保存中」更新为「已保存」。 */
  readonly key?: string | number
  /** 消息关闭后调用。 */
  readonly onClose?: () => void
}

/** 带「撤销」的消息条的参数。 */
export interface UndoableMessageOptions {
  /** 消息内容：说明刚才做了什么，如「已将林晓移出项目」。 */
  readonly content: ReactNode
  /** 点击「撤销」时调用（只调用一次），消息条随即关闭。 */
  readonly onUndo: () => void
  /** 显示秒数，默认 6 秒，悬停时暂停计时。 */
  readonly duration?: number
}

/** 关闭一条消息。 */
export type CloseMessage = () => void

/** 显示一种类型的消息条：传文字，或传对象设置时长、键；第二个参数是显示秒数。返回关闭函数。 */
export type ShowMessage = (content: ReactNode | MessageOptions, duration?: number) => CloseMessage

/** useMessage 的返回值。 */
export interface MessageApi {
  /** 成功。 */
  readonly success: ShowMessage
  /** 失败：内容用转换后的用户可读文本，不要显示原始异常。读屏立即播报。 */
  readonly error: ShowMessage
  /** 一般信息。 */
  readonly info: ShowMessage
  /** 警告。 */
  readonly warning: ShowMessage
  /** 进行中：传 `{ content, key, duration: 0 }` 不自动关闭，完成后用同一个 key 更新为结果。 */
  readonly loading: ShowMessage
  /**
   * 可恢复操作（移动、归档、删除到回收站）的结果：消息条带「撤销」按钮，默认 6 秒，悬停时暂停计时。
   * 点击「撤销」立即关闭消息条并调用 `onUndo`。不可恢复的操作不要用它，改用 useConfirmDanger 先确认。
   */
  readonly undoable: (options: UndoableMessageOptions) => CloseMessage
  /** 关闭指定键的消息；不传则关闭全部。 */
  readonly destroy: (key?: string | number) => void
}

const MessageApiContext = createContext<MessageApi | null>(null)

const KIND_ICON: Record<MessageKind, Pick<IconProps, 'name' | 'tone'>> = {
  success: { name: 'check-circle', tone: 'success' },
  error: { name: 'x-circle', tone: 'danger' },
  warning: { name: 'alert', tone: 'warning' },
  info: { name: 'info', tone: 'accent' },
  loading: { name: 'loader', tone: 'accent' },
}

/**
 * 一条消息。组件库内部使用（测试中直接渲染以检查结构），不从入口导出。
 * error 用 role="alert" 让读屏立即播报，其余用 role="status" 礼貌播报。
 */
export function MessageItem(props: {
  readonly entry: MessageEntry<ReactNode>
  readonly store?: MessageStore<ReactNode>
}) {
  const t = useT()
  const { entry, store } = props
  const icon = KIND_ICON[entry.kind]
  const reason = `item-${entry.id}`
  // 卸载时（离开动画结束、被移除）解除这一条登记的暂停：指针停在被移除的元素上时浏览器不会再发 mouseleave
  useEffect(
    () => () => {
      store?.resume(`hover:${reason}`)
      store?.resume(`focus:${reason}`)
    },
    [store, reason],
  )
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: 元素的角色是 status / alert（按类型取值，静态检查看不出）；悬停与焦点只用于暂停计时，不是交互
    <div
      className={styles.message}
      data-id={entry.id}
      data-kind={entry.kind}
      data-leaving={entry.leaving || undefined}
      role={entry.kind === 'error' ? 'alert' : 'status'}
      aria-live={entry.kind === 'error' ? undefined : 'polite'}
      onMouseEnter={() => store?.pause(`hover:${reason}`)}
      onMouseLeave={() => store?.resume(`hover:${reason}`)}
      onFocus={() => store?.pause(`focus:${reason}`)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) store?.resume(`focus:${reason}`)
      }}
    >
      <span className={styles.icon} data-spin={entry.kind === 'loading' || undefined}>
        <Icon name={icon.name} tone={icon.tone} />
      </span>
      <span className={styles.content}>{entry.content}</span>
      {entry.undo && (
        <button type="button" className={styles.undo} data-vl-state="" onClick={entry.undo}>
          {t('message.undo')}
        </button>
      )}
    </div>
  )
}

const cssMs = (name: string) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  const n = Number.parseFloat(v)
  return Number.isFinite(n) ? (v.endsWith('ms') ? n : n * 1000) : 0
}

/**
 * 叠放的消息有增减时，其余消息平滑移到新位置（FLIP），不是瞬间跳过去。
 * 列表贴底排列，所以用「到列表底部的距离」比较位置；时长与曲线取令牌，「减少动态效果」时为 0，不做位移。
 */
function useFlip(list: RefObject<HTMLDivElement | null>, items: readonly unknown[]) {
  const last = useRef(new Map<string, number>())
  // biome-ignore lint/correctness/useExhaustiveDependencies: items 是触发条件，位置从 DOM 读取
  useLayoutEffect(() => {
    const el = list.current
    if (!el) return
    const next = new Map<string, number>()
    const height = el.offsetHeight
    const duration = cssMs('--vl-motion-duration-base')
    const easing = getComputedStyle(document.documentElement)
      .getPropertyValue('--vl-motion-ease-standard')
      .trim()
    for (const child of Array.from(el.children)) {
      if (!(child instanceof HTMLElement) || !child.dataset.id) continue
      const fromBottom = height - child.offsetTop
      const prev = last.current.get(child.dataset.id)
      next.set(child.dataset.id, fromBottom)
      if (prev === undefined || prev === fromBottom || duration <= 0) continue
      child.animate(
        [{ transform: `translateY(${fromBottom - prev}px)` }, { transform: 'translateY(0)' }],
        { duration, easing: easing || 'ease-out', composite: 'add' },
      )
    }
    last.current = next
  }, [items, list])
}

function MessageHost(props: { readonly store: MessageStore<ReactNode> }) {
  const t = useT()
  const { store } = props
  const items = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const list = useRef<HTMLDivElement>(null)
  useFlip(list, items)
  return createPortal(
    // 带名称的 section 即 region 地标（读屏可以按地标跳到这里）
    <section aria-label={t('message.region')} className={styles.region}>
      <div ref={list} className={styles.list}>
        {items.map((m) => (
          <MessageItem key={m.id} entry={m} store={store} />
        ))}
      </div>
    </section>,
    document.body,
  )
}

/**
 * Root component of the application: provides the context for messages (useMessage) and danger confirmations
 * (useConfirmDanger), so that they use the current theme. Place it inside ThemeProvider at the outermost level and
 * wrap the application only once; a nested App uses the messages of the outer one, so there are never two stacks.
 * Messages are rendered at the bottom center of `document.body`, at most 3 at a time; they disappear after 4
 * seconds by default, and the timer pauses while the pointer is over them.
 * @zh 应用根组件：为消息条（useMessage）与危险确认（useConfirmDanger）提供上下文，使它们继承当前主题。
 * 放在 ThemeProvider 之内、应用最外层，整个应用只包一次；嵌套的 App 沿用外层的消息条，不会出现两组。
 * 消息条渲染到 `document.body` 底部居中，最多同时显示 3 条，默认 4 秒后消失，鼠标悬停时暂停计时。
 * @category Feedback
 * @usage Root component of the application; wrap standalone pages or tests that need messages or confirmations
 * @usageZh 应用的根组件；独立页面或测试中需要消息条、确认框时包一层
 */
export function App(props: AppProps) {
  const { message, children } = props
  const outer = useContext(MessageApiContext)
  // 设置只在创建时读取：消息条的上限与默认时长是全局约定，不随渲染变化
  const [own] = useState(() => {
    if (outer) return null
    const store = createMessageStore<ReactNode>({
      maxCount: message?.maxCount ?? MESSAGE_DEFAULTS.maxCount,
      leaveMs: MESSAGE_DEFAULTS.leaveMs,
    })
    const api: MessageApi = createMessageApi(store, {
      duration: message?.duration ?? MESSAGE_DEFAULTS.duration,
    })
    return { store, api }
  })
  // 门户只在客户端挂载后渲染（服务端渲染与测试中没有 document）
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    return () => own?.store.dispose()
  }, [own])
  if (!own) return <AntApp>{children}</AntApp>
  return (
    <AntApp>
      <MessageApiContext.Provider value={own.api}>
        {children}
        {mounted && <MessageHost store={own.store} />}
      </MessageApiContext.Provider>
    </AntApp>
  )
}

/**
 * Messages: short notices about the result of an action; choose `success`, `error`, `info`, `warning` or
 * `loading` by meaning, and use `undoable` to offer "Undo" for reversible actions. Must be used inside `<App>`
 * (exported by this package), otherwise it throws.
 *
 * **Interaction**: messages slide in at the bottom center of the screen and stack up to 3, the newest at the
 * bottom; beyond that, the oldest leaves first. They disappear after 4 seconds by default, or 6 seconds with
 * "Undo"; `duration: 0` keeps a message until it is closed. While the pointer or keyboard focus is on a message,
 * all timers pause; the same `key` updates a message in place and restarts its timer. Entering takes about 200 ms
 * and leaving about 140 ms; with "reduce motion" on, messages only fade. The "Undo" button can be focused with
 * `Tab` and triggered with `Enter` / `Space`, and shows the state layer on hover and press. Screen readers
 * announce errors immediately and other messages politely.
 * @zh 消息条：操作结果的短提示，从 `success` / `error` / `info` / `warning` / `loading` 中按语义选择；
 * 可恢复的操作用 `undoable` 提供「撤销」。必须在 `<App>`（由本包导出）之内使用，否则抛出错误。
 *
 * **交互**：从屏幕底部居中滑入，最多叠 3 条，新的在下，超出时最早的一条先离开；默认 4 秒、带「撤销」的 6 秒后消失，
 * `duration: 0` 不自动关闭；鼠标悬停或键盘焦点在消息条上时暂停全部计时；同一个 `key` 原地更新内容并重新计时。
 * 进入约 200ms、离开约 140ms，「减少动态效果」打开时只淡入淡出。「撤销」按钮可用 `Tab` 聚焦、`Enter` / `Space` 触发，
 * 悬停与按下叠加统一状态层。失败消息读屏立即播报，其余礼貌播报。
 * @category Feedback
 * @usage Results of actions such as saving or deleting; "Undo" for reversible actions (archiving, removing, moving to the trash)
 * @usageZh 保存、删除等操作的结果；可恢复操作（归档、移出、删除到回收站）的「撤销」
 */
export function useMessage(): MessageApi {
  const api = useContext(MessageApiContext)
  if (!api)
    throw new Error(
      'useMessage() must be used inside the <App> of vellum-ui: wrap the root of the application (or a standalone page, test or example) in <App>',
    )
  return api
}
