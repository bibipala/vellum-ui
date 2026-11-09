import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createMessageApi,
  createMessageStore,
  MESSAGE_DEFAULTS,
  type MessageStore,
} from '../src/components/messageStore.ts'

// docs/11 §6.2「消息条」：最多叠 3 条（新的在下）；默认 4 秒、带「撤销」的 6 秒；duration 0 不自动关闭；
// 悬停时暂停计时；同一个 key 原地更新。useMessage 只是把这个状态机接到 React 上，这里用假定时器测试状态机本身。
const { leaveMs } = MESSAGE_DEFAULTS

function setup(opts: { maxCount?: number; duration?: number } = {}) {
  const store: MessageStore<string> = createMessageStore<string>({
    maxCount: opts.maxCount ?? MESSAGE_DEFAULTS.maxCount,
    leaveMs,
  })
  const api = createMessageApi(store, { duration: opts.duration ?? MESSAGE_DEFAULTS.duration })
  const visible = () => store.getSnapshot().filter((m) => !m.leaving)
  const contents = () => visible().map((m) => m.content)
  return { store, api, visible, contents }
}

describe('消息条状态机', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('默认最多 3 条、4 秒，带「撤销」的 6 秒，离开动画约 140ms', () => {
    expect(MESSAGE_DEFAULTS).toEqual({
      maxCount: 3,
      duration: 4,
      undoableDuration: 6,
      leaveMs: 140,
    })
  })

  it('默认 4 秒后开始离开，离开动画结束后移除，并调用一次 onClose', () => {
    const { api, store, contents } = setup()
    const onClose = vi.fn()
    api.success({ content: '已保存', onClose })
    expect(store.getSnapshot()).toMatchObject([{ kind: 'success', content: '已保存' }])
    vi.advanceTimersByTime(3999)
    expect(contents()).toEqual(['已保存'])
    expect(onClose).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(contents()).toEqual([])
    expect(store.getSnapshot()).toMatchObject([{ content: '已保存', leaving: true }])
    expect(onClose).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(leaveMs - 1)
    expect(store.getSnapshot()).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(store.getSnapshot()).toEqual([])
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('各类型对应各自的 kind；第二个参数是显示秒数，对象中的 duration 优先', () => {
    const { api, store, contents } = setup()
    api.success('a', 1)
    api.error({ content: 'b', duration: 2 }, 10)
    api.warning({ content: 'c' }, 3)
    expect(store.getSnapshot().map((m) => [m.kind, m.content])).toEqual([
      ['success', 'a'],
      ['error', 'b'],
      ['warning', 'c'],
    ])
    vi.advanceTimersByTime(1000)
    expect(contents()).toEqual(['b', 'c'])
    vi.advanceTimersByTime(1000)
    expect(contents()).toEqual(['c'])
    vi.advanceTimersByTime(1000)
    expect(contents()).toEqual([])
    api.info('d')
    api.loading('e')
    expect(
      store
        .getSnapshot()
        .filter((m) => !m.leaving)
        .map((m) => m.kind),
    ).toEqual(['info', 'loading'])
  })

  it('React 元素作为内容时不会被当成参数对象', () => {
    const store = createMessageStore<unknown>({ maxCount: 3, leaveMs })
    const api = createMessageApi(store, { duration: 4 })
    const element = { $$typeof: Symbol.for('react.element'), props: { content: 'x' } }
    api.info(element)
    expect(store.getSnapshot()[0]?.content).toBe(element)
  })

  it('duration 0 不自动关闭，只能手动关闭', () => {
    const { api, contents } = setup()
    const close = api.loading({ content: '正在保存…', duration: 0 })
    vi.advanceTimersByTime(60_000)
    expect(contents()).toEqual(['正在保存…'])
    close()
    expect(contents()).toEqual([])
  })

  it('负数与非数字的 duration 不是合法时长，按默认时长关闭（不会一直不关）', () => {
    const { api, contents } = setup({ duration: 4 })
    api.info({ content: 'a', duration: -1 })
    api.info('b', Number.NaN)
    api.undoable({ content: 'c', onUndo: () => {}, duration: -5 })
    vi.advanceTimersByTime(4_500)
    expect(contents()).toEqual(['c'])
    vi.advanceTimersByTime(MESSAGE_DEFAULTS.undoableDuration * 1000)
    expect(contents()).toEqual([])
  })

  it('最多叠 3 条，新的在下；超出时最早的一条先离开', () => {
    const { api, store, contents } = setup()
    const onClose = vi.fn()
    api.info({ content: '1', onClose })
    api.info('2')
    api.info('3')
    expect(contents()).toEqual(['1', '2', '3'])
    api.info('4')
    expect(contents()).toEqual(['2', '3', '4'])
    expect(onClose).toHaveBeenCalledOnce()
    // 离开中的那条仍在列表最上面，播完离开动画才移除
    expect(store.getSnapshot().map((m) => [m.content, m.leaving])).toEqual([
      ['1', true],
      ['2', false],
      ['3', false],
      ['4', false],
    ])
    vi.advanceTimersByTime(leaveMs)
    expect(store.getSnapshot().map((m) => m.content)).toEqual(['2', '3', '4'])
  })

  it('上限可以设置', () => {
    const { api, contents } = setup({ maxCount: 1, duration: 2 })
    api.info('a')
    api.info('b')
    expect(contents()).toEqual(['b'])
    vi.advanceTimersByTime(2000)
    expect(contents()).toEqual([])
  })

  it('同一个 key 原地更新：位置与列表键不变，内容与类型更新，并重新计时', () => {
    const { api, store, contents } = setup()
    api.info('前')
    api.loading({ content: '正在保存…', key: 'save', duration: 0 })
    api.info('后')
    const id = store.getSnapshot()[1]?.id
    vi.advanceTimersByTime(3000)
    api.success({ content: '已保存', key: 'save' })
    expect(contents()).toEqual(['前', '已保存', '后'])
    expect(store.getSnapshot()[1]).toMatchObject({ id, kind: 'success', key: 'save' })
    vi.advanceTimersByTime(1000) // 「前」「后」到期
    expect(contents()).toEqual(['已保存'])
    vi.advanceTimersByTime(3000) // 更新后的「已保存」从更新时重新计时 4 秒
    expect(contents()).toEqual([])
  })

  it('同一个 key 在离开动画期间更新：召回原位，不会出现两条', () => {
    const { api, store, contents } = setup()
    api.info({ content: '旧', key: 'k', duration: 1 })
    vi.advanceTimersByTime(1000)
    expect(contents()).toEqual([])
    api.info({ content: '新', key: 'k' })
    vi.advanceTimersByTime(leaveMs)
    expect(store.getSnapshot().map((m) => [m.content, m.leaving])).toEqual([['新', false]])
  })

  it('悬停时暂停全部计时，移开后按剩余时间继续', () => {
    const { api, store, contents } = setup()
    api.info('a')
    vi.advanceTimersByTime(1000)
    api.info('b')
    vi.advanceTimersByTime(1000) // a 剩 2 秒，b 剩 3 秒
    store.pause('hover:item-1')
    vi.advanceTimersByTime(60_000)
    expect(contents()).toEqual(['a', 'b'])
    store.resume('hover:item-1')
    vi.advanceTimersByTime(1999)
    expect(contents()).toEqual(['a', 'b'])
    vi.advanceTimersByTime(1)
    expect(contents()).toEqual(['b'])
    vi.advanceTimersByTime(1000)
    expect(contents()).toEqual([])
  })

  it('暂停期间出现的消息，等解除暂停后才开始计时', () => {
    const { api, store, contents } = setup()
    store.pause('hover:x')
    api.info('a')
    vi.advanceTimersByTime(10_000)
    expect(contents()).toEqual(['a'])
    store.resume('hover:x')
    vi.advanceTimersByTime(3999)
    expect(contents()).toEqual(['a'])
    vi.advanceTimersByTime(1)
    expect(contents()).toEqual([])
  })

  it('多个暂停原因（悬停、键盘焦点）全部解除后才继续计时；重复解除无副作用', () => {
    const { api, store, contents } = setup()
    api.info('a')
    store.pause('hover:item-1')
    store.pause('focus:item-1')
    store.resume('hover:item-1')
    store.resume('hover:item-1')
    vi.advanceTimersByTime(10_000)
    expect(contents()).toEqual(['a'])
    store.resume('focus:item-1')
    vi.advanceTimersByTime(4000)
    expect(contents()).toEqual([])
  })

  it('undoable：默认 6 秒，带撤销；点击撤销立即关闭并只调用一次 onUndo', () => {
    const { api, store, contents } = setup()
    const onUndo = vi.fn()
    api.undoable({ content: '已移出部门：林晓', onUndo })
    const entry = store.getSnapshot()[0]
    expect(entry).toMatchObject({ kind: 'success', content: '已移出部门：林晓' })
    expect(String(entry?.key)).toMatch(/^vl-undoable-/)
    vi.advanceTimersByTime(5999)
    expect(contents()).toEqual(['已移出部门：林晓'])
    entry?.undo?.()
    entry?.undo?.()
    expect(onUndo).toHaveBeenCalledOnce()
    expect(contents()).toEqual([])
  })

  it('undoable：不点撤销则 6 秒后关闭，不调用 onUndo', () => {
    const { api, contents } = setup()
    const onUndo = vi.fn()
    api.undoable({ content: 'a', onUndo })
    vi.advanceTimersByTime(6000)
    expect(contents()).toEqual([])
    expect(onUndo).not.toHaveBeenCalled()
  })

  it('undoable：可以指定时长；每条消息的 key 不同；返回的函数关闭这条消息', () => {
    const { api, store, contents } = setup()
    const close = api.undoable({ content: 'a', onUndo: () => {}, duration: 10 })
    api.undoable({ content: 'b', onUndo: () => {} })
    const [a, b] = store.getSnapshot()
    expect(a?.key).not.toBe(b?.key)
    vi.advanceTimersByTime(6000)
    expect(contents()).toEqual(['a'])
    close()
    expect(contents()).toEqual([])
  })

  it('destroy：按 key 关闭一条；不传则关闭全部', () => {
    const { api, contents } = setup()
    api.info({ content: 'a', key: 'a' })
    api.info({ content: 'b', key: 'b' })
    api.info('c')
    api.destroy('a')
    expect(contents()).toEqual(['b', 'c'])
    api.destroy('不存在')
    expect(contents()).toEqual(['b', 'c'])
    api.destroy()
    expect(contents()).toEqual([])
  })

  it('订阅者在变化时收到通知；没有变化时快照是同一个数组', () => {
    const { api, store } = setup()
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    const before = store.getSnapshot()
    expect(store.getSnapshot()).toBe(before)
    api.info('a')
    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.getSnapshot()).not.toBe(before)
    store.close('不存在')
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    api.info('b')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('dispose：清除全部消息与定时器，之后不再回调', () => {
    const { api, store } = setup()
    const onClose = vi.fn()
    api.info({ content: 'a', onClose })
    store.dispose()
    expect(store.getSnapshot()).toEqual([])
    vi.advanceTimersByTime(60_000)
    expect(onClose).not.toHaveBeenCalled()
  })
})
