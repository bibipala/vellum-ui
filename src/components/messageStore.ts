/**
 * 消息条的状态机：计时、叠放、按 key 原地更新、悬停暂停。
 * 与 React 无关，便于用假定时器测试；`message.tsx` 只负责把它接到上下文与界面上。组件库内部使用，不从入口导出。
 */

/** 消息条的类型：决定左侧的状态图标与状态色，error 还决定读屏立即播报。 */
export type MessageKind = 'success' | 'error' | 'info' | 'warning' | 'loading'

/** 消息条的唯一键。 */
export type MessageId = string | number

/** 界面渲染用的一条消息（不可变快照）。 */
export interface MessageEntry<C> {
  /** 内部序号，作为列表键：同一个 key 原地更新时保持不变，界面不会重新播放进入动画。 */
  readonly id: number
  readonly key: MessageId
  readonly kind: MessageKind
  readonly content: C
  /** 带「撤销」的消息条：点击按钮时调用。 */
  readonly undo?: () => void
  /** 正在播放离开动画，结束后移除。 */
  readonly leaving: boolean
}

/** 打开（或按 key 更新）一条消息。 */
export interface MessageOpenInput<C> {
  /** 不传则自动生成；同一个键的消息原地更新，并重新计时。 */
  readonly key?: MessageId
  readonly kind: MessageKind
  readonly content: C
  /** 显示毫秒数；0 表示不自动关闭。 */
  readonly durationMs: number
  /** 消息关闭（开始离开）时调用一次。 */
  readonly onClose?: () => void
  readonly undo?: () => void
}

/** 状态机的选项。 */
export interface MessageStoreOptions {
  /** 最多同时显示几条，超出时最早的一条先离开。 */
  readonly maxCount: number
  /** 离开动画的时长（毫秒），之后从列表中移除。 */
  readonly leaveMs: number
}

/** 消息条状态机。 */
export interface MessageStore<C> {
  /** 打开一条消息，或按 key 原地更新已有的消息；返回它的键。 */
  open(input: MessageOpenInput<C>): MessageId
  /** 关闭指定键的消息；不传则关闭全部。 */
  close(key?: MessageId): void
  /** 暂停全部计时（悬停、键盘焦点在消息条上）；不同的原因分别登记，全部解除后才继续计时。 */
  pause(reason: string): void
  /** 解除一个暂停原因。 */
  resume(reason: string): void
  /** 订阅变化（`useSyncExternalStore`）。 */
  subscribe(listener: () => void): () => void
  /** 当前的消息列表，按出现顺序（新的在后）；没有变化时返回同一个数组。 */
  getSnapshot(): readonly MessageEntry<C>[]
  /** 清除全部消息与定时器（App 卸载时），不调用 onClose。 */
  dispose(): void
}

/** 默认取值：最多 3 条，默认 4 秒，带「撤销」的 6 秒，离开约 140ms。 */
export const MESSAGE_DEFAULTS = {
  maxCount: 3,
  duration: 4,
  undoableDuration: 6,
  leaveMs: 140,
} as const

interface Slot<C> {
  entry: MessageEntry<C>
  durationMs: number
  /** 剩余的显示时间；暂停时冻结。 */
  remaining: number
  startedAt: number
  timer?: ReturnType<typeof setTimeout>
  removeTimer?: ReturnType<typeof setTimeout>
  onClose?: () => void
}

/** 创建消息条状态机。 */
export function createMessageStore<C>(options: MessageStoreOptions): MessageStore<C> {
  let slots: Slot<C>[] = []
  let snapshot: readonly MessageEntry<C>[] = []
  let seq = 0
  let autoKey = 0
  const listeners = new Set<() => void>()
  const pauses = new Set<string>()

  const emit = () => {
    snapshot = slots.map((s) => s.entry)
    for (const l of listeners) l()
  }
  const stopTimer = (s: Slot<C>) => {
    if (s.timer === undefined) return
    clearTimeout(s.timer)
    s.timer = undefined
    s.remaining = Math.max(0, s.remaining - (Date.now() - s.startedAt))
  }
  const startTimer = (s: Slot<C>) => {
    if (s.durationMs <= 0 || s.entry.leaving || pauses.size > 0 || s.timer !== undefined) return
    s.startedAt = Date.now()
    s.timer = setTimeout(() => {
      s.timer = undefined
      leave(s)
      emit()
    }, s.remaining)
  }
  const remove = (s: Slot<C>) => {
    slots = slots.filter((x) => x !== s)
  }
  // 开始离开：停止计时、调用 onClose，离开动画结束后移除。只改状态，由调用方统一 emit
  const leave = (s: Slot<C>) => {
    if (s.entry.leaving) return
    stopTimer(s)
    s.entry = { ...s.entry, leaving: true }
    const onClose = s.onClose
    s.onClose = undefined
    onClose?.()
    if (options.leaveMs <= 0) remove(s)
    else
      s.removeTimer = setTimeout(() => {
        s.removeTimer = undefined
        remove(s)
        emit()
      }, options.leaveMs)
  }

  return {
    open(input) {
      const key = input.key ?? `vl-message-${++autoKey}`
      const existing = slots.find((s) => s.entry.key === key)
      if (existing) {
        // 原地更新：位置与列表键不变；正在离开的也召回
        if (existing.timer !== undefined) clearTimeout(existing.timer)
        if (existing.removeTimer !== undefined) clearTimeout(existing.removeTimer)
        existing.timer = undefined
        existing.removeTimer = undefined
        existing.entry = {
          id: existing.entry.id,
          key,
          kind: input.kind,
          content: input.content,
          undo: input.undo,
          leaving: false,
        }
        existing.durationMs = input.durationMs
        existing.remaining = input.durationMs
        existing.onClose = input.onClose
        startTimer(existing)
      } else {
        const s: Slot<C> = {
          entry: {
            id: ++seq,
            key,
            kind: input.kind,
            content: input.content,
            undo: input.undo,
            leaving: false,
          },
          durationMs: input.durationMs,
          remaining: input.durationMs,
          startedAt: Date.now(),
          onClose: input.onClose,
        }
        slots = [...slots, s]
        startTimer(s)
      }
      // 超出上限：最早的先离开（新的在下，最早的在最上面）
      const active = slots.filter((s) => !s.entry.leaving)
      for (const s of active.slice(0, Math.max(0, active.length - options.maxCount))) leave(s)
      emit()
      return key
    },
    close(key) {
      const targets = slots.filter((s) => key === undefined || s.entry.key === key)
      if (!targets.some((s) => !s.entry.leaving)) return
      for (const s of targets) leave(s)
      emit()
    },
    pause(reason) {
      if (pauses.has(reason)) return
      pauses.add(reason)
      for (const s of slots) stopTimer(s)
    },
    resume(reason) {
      if (!pauses.delete(reason) || pauses.size > 0) return
      for (const s of slots) startTimer(s)
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSnapshot: () => snapshot,
    dispose() {
      for (const s of slots) {
        if (s.timer !== undefined) clearTimeout(s.timer)
        if (s.removeTimer !== undefined) clearTimeout(s.removeTimer)
      }
      slots = []
      pauses.clear()
      emit()
    },
  }
}

/** 消息条的参数（对象形式）。 */
export interface MessageOptions<C> {
  readonly content: C
  readonly duration?: number
  readonly key?: MessageId
  readonly onClose?: () => void
}

/** createMessageApi 的选项。 */
export interface MessageApiOptions {
  /** 普通消息的默认显示秒数。 */
  readonly duration: number
}

/** 与 React 无关的消息接口；`message.tsx` 中的 `MessageApi` 是它在 ReactNode 上的实例。 */
export interface MessageApiOf<C> {
  readonly success: (content: C | MessageOptions<C>, duration?: number) => () => void
  readonly error: (content: C | MessageOptions<C>, duration?: number) => () => void
  readonly info: (content: C | MessageOptions<C>, duration?: number) => () => void
  readonly warning: (content: C | MessageOptions<C>, duration?: number) => () => void
  readonly loading: (content: C | MessageOptions<C>, duration?: number) => () => void
  readonly undoable: (options: {
    readonly content: C
    readonly onUndo: () => void
    readonly duration?: number
  }) => () => void
  readonly destroy: (key?: MessageId) => void
}

// 对象形式的参数：有 content 字段，且不是 React 元素（React 元素是带 $$typeof 的对象）
const isOptions = <C>(v: C | MessageOptions<C>): v is MessageOptions<C> =>
  typeof v === 'object' && v !== null && !('$$typeof' in v) && 'content' in v

/**
 * 秒数换成毫秒。`0` 表示不自动关闭；负数与非数字不是合法的时长，用默认时长（否则负数会被当成 0，消息条一直不关）。
 */
const ms = (seconds: number, fallback: number) =>
  (Number.isFinite(seconds) && seconds >= 0 ? seconds : fallback) * 1000

/**
 * 在状态机上构造消息接口。参数约定与此前基于 antd 的实现一致：
 * 第一个参数传内容或对象；对象中的 `duration` 优先于第二个参数；都不传时用默认时长。
 */
export function createMessageApi<C>(
  store: MessageStore<C>,
  options: MessageApiOptions,
): MessageApiOf<C> {
  let undoableSeq = 0
  const show =
    (kind: MessageKind) =>
    (content: C | MessageOptions<C>, duration?: number): (() => void) => {
      const o: MessageOptions<C> = isOptions(content) ? content : { content }
      const key = store.open({
        key: o.key,
        kind,
        content: o.content,
        durationMs: ms(o.duration ?? duration ?? options.duration, options.duration),
        onClose: o.onClose,
      })
      return () => store.close(key)
    }
  return {
    success: show('success'),
    error: show('error'),
    info: show('info'),
    warning: show('warning'),
    loading: show('loading'),
    destroy: (key) => store.close(key),
    undoable: ({ content, onUndo, duration = MESSAGE_DEFAULTS.undoableDuration }) => {
      undoableSeq += 1
      const key = `vl-undoable-${undoableSeq}`
      let done = false
      // 离开动画期间按钮仍在，连点两次也只撤销一次
      const undo = () => {
        if (done) return
        done = true
        store.close(key)
        onUndo()
      }
      // 撤销的对象是一个已经成功的操作：用成功图标
      store.open({
        key,
        kind: 'success',
        content,
        durationMs: ms(duration, MESSAGE_DEFAULTS.undoableDuration),
        undo,
      })
      return () => store.close(key)
    },
  }
}
