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

/**
 * A message as an object, for the methods of `MessageApi` (`success`, `error` and so on): the content plus a
 * duration, a key or a close callback.
 * @zh 对象形式的消息条参数，用于 `MessageApi` 的方法（`success`、`error` 等）：内容，以及时长、键或关闭回调。
 */
export interface MessageOptions {
  /**
   * Content of the message: a short text, such as "Project saved".
   * @zh 消息内容：简短的文字，如「项目已保存」。
   */
  readonly content: ReactNode
  /**
   * Seconds the message is shown; `0` keeps it until it is closed; a negative value is not a duration and the
   * default is used. The timer pauses while the pointer or keyboard
   * focus is on a message. Takes precedence over the second argument of the method; the default is the `duration`
   * of App's `message` setting (4 seconds).
   * @zh 显示的秒数；`0` 表示不自动关闭，直到被关闭；负数不是合法的时长，按默认时长。鼠标悬停或键盘焦点在消息条上时暂停计时。优先于方法的第二个
   * 参数；默认取 App 的 `message` 设置中的 `duration`（4 秒）。
   */
  readonly duration?: number
  /**
   * Unique key: showing a message with the key of a message that is still shown updates that message in place (its
   * content, type and timer), such as turning "Saving" into "Saved". Also used by `destroy(key)`.
   * @zh 唯一键：用仍在显示的消息条的键再显示一条时，原地更新那一条（内容、类型与计时），如把「保存中」更新为
   * 「已保存」。`destroy(key)` 也用它。
   */
  readonly key?: string | number
  /**
   * Called once when the message closes: when its time is up, when it is closed by the returned function or
   * `destroy`, or when it is pushed out by newer messages. Not called when the message is updated through its `key`
   * (the new options replace it), nor when App unmounts.
   * @zh 消息条关闭时调用一次：时间到、被返回的关闭函数或 `destroy` 关闭、被更新的消息挤出时。通过 `key` 原地更新时
   * 不调用（由新的参数替换），App 卸载时也不调用。
   */
  readonly onClose?: () => void
}

/**
 * Options of `MessageApi.undoable`: a message with an "Undo" button.
 * @zh `MessageApi.undoable` 的参数：带「撤销」按钮的消息条。
 */
export interface UndoableMessageOptions {
  /**
   * Content of the message: what was just done, such as "Moved 3 files to the trash".
   * @zh 消息内容：说明刚才做了什么，如「已将 3 个文件移到回收站」。
   */
  readonly content: ReactNode
  /**
   * Called when "Undo" is clicked (only once, even on a double click); the message closes at the same time. Revert
   * the action here.
   * @zh 点击「撤销」时调用（只调用一次，连点也一样），消息条同时关闭。在这里撤回刚才的操作。
   */
  readonly onUndo: () => void
  /**
   * Seconds the message is shown; `0` keeps it until it is closed; a negative value is not a duration and the
   * default is used. The timer pauses while the pointer or keyboard
   * focus is on a message.
   * @zh 显示的秒数；`0` 表示不自动关闭。鼠标悬停或键盘焦点在消息条上时暂停计时。
   * @default 6
   */
  readonly duration?: number
}

/**
 * Closes the message it was returned for (returned by the methods of `MessageApi`). Calling it after the message
 * has closed does nothing, unless a new message with the same `key` is shown by then: it closes that one.
 * @zh 关闭对应的那一条消息（由 `MessageApi` 的方法返回）。消息已经关闭后再调用不起作用；但如果此时又显示了同一个
 * `key` 的消息，会关闭那一条。
 */
export type CloseMessage = () => void

/**
 * Shows a message of one type. The first argument is the content (`message.success('Saved')`) or a
 * `MessageOptions` object (`{ content, key, duration, onClose }`); the optional second argument is the number of
 * seconds it is shown. Returns a function that closes the message.
 * @zh 显示一种类型的消息条。第一个参数是内容（`message.success('已保存')`）或 `MessageOptions` 对象
 * （`{ content, key, duration, onClose }`）；可选的第二个参数是显示的秒数。返回关闭这条消息的函数。
 */
export type ShowMessage = (content: ReactNode | MessageOptions, duration?: number) => CloseMessage

/**
 * The messages API returned by useMessage: one method per type of message, plus `undoable` and `destroy`.
 * @zh useMessage 返回的消息条接口：每种类型一个方法，另有 `undoable` 与 `destroy`。
 */
export interface MessageApi {
  /**
   * Shows a success message, such as "Saved".
   * @zh 显示成功消息，如「已保存」。
   */
  readonly success: ShowMessage
  /**
   * Shows an error message. Write a readable text for the user rather than the raw exception. Screen readers announce
   * it immediately.
   * @zh 显示失败消息。内容写成用户能看懂的文字，不要显示原始异常。读屏立即播报。
   */
  readonly error: ShowMessage
  /**
   * Shows a neutral information message.
   * @zh 显示一般信息。
   */
  readonly info: ShowMessage
  /**
   * Shows a warning message.
   * @zh 显示警告消息。
   */
  readonly warning: ShowMessage
  /**
   * Shows a message for work in progress, with a spinning icon. Pass `{ content, key, duration: 0 }` so that it
   * stays, then show the result with the same `key` to replace it.
   * @zh 显示进行中的消息，图标转动。传 `{ content, key, duration: 0 }` 使它不自动关闭，完成后用同一个 `key` 显示结果，
   * 替换它。
   */
  readonly loading: ShowMessage
  /**
   * Shows the result of a reversible action (moving, archiving, deleting to the trash) with an "Undo" button and a
   * success icon, for 6 seconds by default; the timer pauses on hover. Clicking "Undo" closes the message and calls
   * `onUndo`. Returns a function that closes the message. For irreversible actions, ask first with
   * useConfirmDanger instead.
   * @zh 显示可恢复操作（移动、归档、删除到回收站）的结果，带「撤销」按钮与成功图标，默认显示 6 秒，悬停时暂停计时。
   * 点击「撤销」关闭消息条并调用 `onUndo`。返回关闭这条消息的函数。不可恢复的操作不要用它，改用 useConfirmDanger
   * 先确认。
   */
  readonly undoable: (options: UndoableMessageOptions) => CloseMessage
  /**
   * Closes the message with the given `key`, or all messages when no key is passed.
   * @zh 关闭指定 `key` 的消息；不传时关闭全部。
   */
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
