/**
 * 快捷键：useHotkeys 注册、HotkeysProvider 隔离、useRegisteredHotkeys 列出（供「快捷键帮助」使用）。
 *
 * - 每个注册表只挂一个 keydown 监听（冒泡阶段，组件自己先处理按键；已被 preventDefault 的不再处理），
 *   第一个注册时挂上、最后一个注销时摘下；页面共用的注册表在 window 上，HotkeysProvider 的在 document 上（先处理）。
 *   模块顶层不访问浏览器对象。
 * - 同一个按键由最近注册的、可用的那个快捷键处理（后打开的弹层先于页面），其余不再触发。
 * - 默认在输入框、可编辑区域内不触发；输入法组字期间的按键一律不当作快捷键。
 * - 同一作用域内的同一组合同时被两个可用的注册占用时，开发模式下在控制台警告。
 */
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import {
  comboId,
  detectPlatform,
  isComposing,
  isTypingTarget,
  type KeyCombo,
  matchesCombo,
  parseCombo,
} from './keys.ts'

// 打包工具会把 process.env.NODE_ENV 替换为常量（antd 与 React 同样依赖这一点）；这里只声明用到的部分
declare const process: { readonly env: { readonly NODE_ENV?: string } }

/**
 * Options of useHotkeys.
 * @zh useHotkeys 的选项。
 */
export interface UseHotkeysOptions {
  /**
   * Whether the hotkey is active. A disabled hotkey stays registered (it is still listed by
   * useRegisteredHotkeys, with `enabled: false`) but does not fire.
   * @zh 是否生效。不生效的快捷键仍在注册表中（useRegisteredHotkeys 照样列出，`enabled` 为 false），但不会触发。
   * @default true
   */
  readonly enabled?: boolean
  /**
   * Calls `preventDefault()` on the key event before the handler runs, so the browser does not also act on it
   * (such as `Ctrl+K` focusing the address bar).
   * @zh 在调用处理函数之前对按键事件调用 `preventDefault()`，浏览器不再执行默认操作（如 `Ctrl+K` 聚焦地址栏）。
   * @default true
   */
  readonly preventDefault?: boolean
  /**
   * Also fires while the focus is in a text input, a text area, a select or an editable area. Off by default,
   * so that typing `?` or `[` in a field does not trigger anything. Keys pressed while an input method is
   * composing text never fire.
   * @zh 焦点在文字输入框、文本域、下拉框或可编辑区域内时也触发。默认关闭，在输入框中键入 `?`、`[` 不会触发任何操作。
   * 输入法组字期间的按键始终不触发。
   */
  readonly allowInInputs?: boolean
  /**
   * Fires again while the key is held down (auto-repeat), such as moving through a list. Off by default.
   * @zh 按住不放时重复触发（自动重复），如在列表中移动。默认关闭。
   */
  readonly repeat?: boolean
  /**
   * What the hotkey does, shown in shortcut help. Hotkeys without a description are not listed by
   * useRegisteredHotkeys.
   * @zh 快捷键的作用，显示在快捷键帮助中。没有说明的快捷键不会被 useRegisteredHotkeys 列出。
   */
  readonly description?: string
  /**
   * Scope of the hotkey, used to group the list of registered hotkeys and to detect conflicts: registering the
   * same combination twice in one scope logs a warning in development.
   * @zh 作用域：用于给已注册的快捷键分组，以及检查冲突：同一作用域内重复注册同一组合时，开发模式下在控制台警告。
   * @default 'global'
   */
  readonly scope?: string
}

/**
 * A registered hotkey, as listed by useRegisteredHotkeys.
 * @zh 已注册的快捷键（useRegisteredHotkeys 列出的一项）。
 */
export interface RegisteredHotkey {
  /** Unique id of the registration. @zh 注册的唯一编号。 */
  readonly id: string
  /** The combinations, as written in useHotkeys (pass them to Kbd). @zh 组合，与 useHotkeys 中的写法相同（可直接交给 Kbd）。 */
  readonly keys: readonly string[]
  /** What the hotkey does. @zh 快捷键的作用。 */
  readonly description: string
  /** Scope of the hotkey. @zh 作用域。 */
  readonly scope: string
  /** Whether the hotkey is active right now. @zh 当前是否生效。 */
  readonly enabled: boolean
}

interface Entry {
  readonly id: number
  readonly keys: readonly string[]
  readonly combos: readonly KeyCombo[]
  readonly scope: string
  enabled: boolean
  description: string | undefined
  readonly handler: (event: KeyboardEvent) => void
  readonly options: () => UseHotkeysOptions
}

/** 一个快捷键注册表：注册、按键分发、列出。 */
interface HotkeyRegistry {
  register(entry: Omit<Entry, 'id'>): Entry
  unregister(entry: Entry): void
  update(entry: Entry, patch: { enabled: boolean; description: string | undefined }): void
  subscribe(listener: () => void): () => void
  snapshot(): readonly RegisteredHotkey[]
}

const EMPTY: readonly RegisteredHotkey[] = Object.freeze([])

/**
 * 监听的位置：页面共用的注册表在 window 上；HotkeysProvider 的注册表在 document 上。按键冒泡时先到 document、后到
 * window，所以 Provider 里的快捷键先处理；处理了（preventDefault）之后，外面的不再触发。
 */
type ListenOn = 'window' | 'document'

function createRegistry(listenOn: ListenOn): HotkeyRegistry {
  let nextId = 1
  const entries: Entry[] = []
  const listeners = new Set<() => void>()
  let list: readonly RegisteredHotkey[] = EMPTY
  let attached = false

  const publish = () => {
    list = Object.freeze(
      entries
        .filter((e) => e.description)
        .map((e) => ({
          id: String(e.id),
          keys: e.keys,
          description: e.description ?? '',
          scope: e.scope,
          enabled: e.enabled,
        })),
    )
    for (const l of listeners) l()
  }

  const warnDuplicates = (entry: Entry) => {
    if (process.env.NODE_ENV === 'production' || !entry.enabled) return
    const platform = detectPlatform()
    const mine = new Set(entry.combos.map((c) => comboId(c, platform)))
    for (const other of entries) {
      if (other === entry || !other.enabled || other.scope !== entry.scope) continue
      const same = other.combos.map((c) => comboId(c, platform)).filter((id) => mine.has(id))
      if (same.length)
        console.warn(
          `[vellum-ui] useHotkeys: "${same.join('", "')}" is registered more than once in the scope "${entry.scope}". Only the most recently registered one fires.`,
        )
    }
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || isComposing(event)) return
    const platform = detectPlatform()
    const typing = isTypingTarget(event.composedPath?.()[0] ?? event.target)
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i]
      if (!entry?.enabled) continue
      const options = entry.options()
      if (typing && !options.allowInInputs) continue
      if (event.repeat && !options.repeat) continue
      if (!entry.combos.some((c) => matchesCombo(event, c, platform))) continue
      if (options.preventDefault ?? true) event.preventDefault()
      entry.handler(event)
      return
    }
  }

  const sync = () => {
    if (typeof window === 'undefined') return
    const target: Window | Document = listenOn === 'document' ? document : window
    if (entries.length && !attached) target.addEventListener('keydown', onKeyDown as EventListener)
    else if (!entries.length && attached)
      target.removeEventListener('keydown', onKeyDown as EventListener)
    attached = entries.length > 0
  }

  return {
    register(init) {
      const entry: Entry = { ...init, id: nextId++ }
      entries.push(entry)
      warnDuplicates(entry)
      sync()
      publish()
      return entry
    },
    unregister(entry) {
      const i = entries.indexOf(entry)
      if (i < 0) return
      entries.splice(i, 1)
      sync()
      publish()
    },
    update(entry, patch) {
      if (entry.enabled === patch.enabled && entry.description === patch.description) return
      const enabling = patch.enabled && !entry.enabled
      entry.enabled = patch.enabled
      entry.description = patch.description
      if (enabling) warnDuplicates(entry)
      publish()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    snapshot: () => list,
  }
}

/** 没有 HotkeysProvider 时使用的注册表：第一次用到时才创建（创建本身不访问浏览器对象）。 */
let globalRegistry: HotkeyRegistry | undefined
const defaultRegistry = () => {
  globalRegistry ??= createRegistry('window')
  return globalRegistry
}

const RegistryContext = createContext<HotkeyRegistry | null>(null)
const useRegistry = () => useContext(RegistryContext) ?? defaultRegistry()

/**
 * Props of HotkeysProvider.
 * @zh HotkeysProvider 属性。
 */
export interface HotkeysProviderProps {
  /** Content. @zh 内容。 */
  readonly children?: ReactNode
}

/**
 * A separate hotkey registry for its content: hotkeys registered inside are listed separately from the rest of the
 * page (no conflict warnings with the page either) and are dispatched before the page's: when one of them handles
 * a key, the hotkeys outside do not fire. Without a provider, all hotkeys share one registry for the whole page,
 * which is what most applications need; use it for embedded widgets, previews and documentation examples.
 * @zh 为其中的内容提供独立的快捷键注册表：里面注册的快捷键与页面其他部分分开列出（也不会与页面的快捷键报冲突），
 * 并且先于页面的快捷键处理：其中一个处理了按键，外面的就不再触发。没有 HotkeysProvider 时整个页面共用一个注册表，
 * 大多数应用这样就够了；嵌入的小部件、预览与文档示例可以用它隔离。
 */
export function HotkeysProvider(props: HotkeysProviderProps) {
  const [registry] = useState(() => createRegistry('document'))
  return <RegistryContext.Provider value={registry}>{props.children}</RegistryContext.Provider>
}

/**
 * Registers a keyboard shortcut for as long as the component is mounted, such as
 * `useHotkeys('mod+k', openPalette, { description: 'Search' })`. Combinations are written as keys joined by
 * `+`: the modifiers `mod` (⌘ on macOS, Ctrl elsewhere), `ctrl`, `alt`, `shift` and `meta`, and one key such as
 * `k`, `[`, `?`, `enter`, `escape`, `arrowup` or `f10`. Pass an array to register several combinations for the
 * same action.
 *
 * **Interaction**: hotkeys do not fire while the focus is in a text field or an editable area (unless
 * `allowInInputs`), never fire while an input method is composing text, and ignore key events that a component
 * has already handled (`preventDefault`). Symbol keys such as `?` and `[` match whatever Shift state the keyboard
 * layout needs. When several active hotkeys use the same key, the most recently registered one fires. Hotkeys
 * with a `description` are listed by useRegisteredHotkeys for shortcut help; show them with Kbd.
 * @zh 快捷键：在组件挂载期间注册一个键盘快捷键，如 `useHotkeys('mod+k', openPalette, { description: '搜索' })`。
 * 组合用 `+` 连接：修饰键 `mod`（macOS 上是 ⌘，其他平台是 Ctrl）、`ctrl`、`alt`、`shift`、`meta`，加一个键，如
 * `k`、`[`、`?`、`enter`、`escape`、`arrowup`、`f10`。传数组时同一个操作注册多个组合。
 *
 * **交互**：焦点在文字输入框或可编辑区域内时不触发（除非 `allowInInputs`），输入法组字期间始终不触发，组件已经处理过
 * （`preventDefault`）的按键不再触发。`?`、`[` 等符号键不论键盘布局是否需要 Shift 都能匹配。多个生效的快捷键使用
 * 同一个键时，最近注册的那个触发。带 `description` 的快捷键由 useRegisteredHotkeys 列出，供快捷键帮助使用，
 * 按键用 Kbd 显示。
 * @category Patterns
 * @usage Global shortcuts such as opening a command palette, toggling a sidebar or showing shortcut help; shortcuts of an open panel
 * @usageZh 全局快捷键（打开命令面板、收起侧栏、显示快捷键帮助）；打开中的面板自己的快捷键
 */
export function useHotkeys(
  keys: string | readonly string[],
  handler: (event: KeyboardEvent) => void,
  options: UseHotkeysOptions = {},
): void {
  const registry = useRegistry()
  const latest = useRef({ handler, options })
  useLayoutEffect(() => {
    latest.current = { handler, options }
  })
  const signature = (typeof keys === 'string' ? [keys] : keys).join('\n')
  const scope = options.scope ?? 'global'
  const enabled = options.enabled ?? true
  const description = options.description
  const entry = useRef<Entry | null>(null)
  // 注册只依赖组合与作用域；处理函数与选项每次渲染更新到 latest，按键时读取最新的，不需要重新注册
  // biome-ignore lint/correctness/useExhaustiveDependencies: enabled、description 的初值在注册时读取，之后的变化由下一个 effect 更新
  useEffect(() => {
    const list = signature.split('\n')
    const registered = registry.register({
      keys: list,
      combos: list.map(parseCombo),
      scope,
      enabled,
      description,
      handler: (event) => latest.current.handler(event),
      options: () => latest.current.options,
    })
    entry.current = registered
    return () => {
      registry.unregister(registered)
      entry.current = null
    }
  }, [registry, signature, scope])
  useEffect(() => {
    if (entry.current) registry.update(entry.current, { enabled, description })
  }, [registry, enabled, description])
}

/**
 * Lists the registered hotkeys that have a `description`, in the order they were registered, for shortcut help.
 * Pass a scope to list only that scope. Includes hotkeys that are currently disabled (`enabled: false`), such as
 * the keys of a closed command palette. Updates when hotkeys are registered or changed; on the server it returns
 * an empty list.
 * @zh 列出带 `description` 的已注册快捷键（按注册顺序），供快捷键帮助使用。传入作用域时只列出该作用域。
 * 当前不生效的快捷键（`enabled` 为 false，如关闭中的命令面板的按键）也会列出。注册或变化时随之更新；服务端返回空列表。
 */
export function useRegisteredHotkeys(scope?: string): readonly RegisteredHotkey[] {
  const registry = useRegistry()
  const all = useSyncExternalStore(registry.subscribe, registry.snapshot, () => EMPTY)
  return useMemo(
    () => (scope === undefined ? all : all.filter((h) => h.scope === scope)),
    [all, scope],
  )
}
