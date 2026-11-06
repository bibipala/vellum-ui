import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createDelayedPending,
  DELAYED_PENDING_DEFAULTS,
} from '../src/components/useDelayedPending.ts'

// docs/11 §6.2「不闪」：加载超过 200ms 才显示加载态，一旦显示至少保持 400ms。
// useDelayedPending 只是把这个状态机接到 React 的 effect 上，这里用假定时器测试状态机本身。
const { delay, minDuration } = DELAYED_PENDING_DEFAULTS

function setup() {
  const changes: boolean[] = []
  const machine = createDelayedPending((show) => changes.push(show))
  const update = (pending: boolean) => machine.update(pending, delay, minDuration)
  return { changes, machine, update }
}

describe('useDelayedPending 的防闪状态机', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('默认延迟 200ms、至少显示 400ms', () => {
    expect(DELAYED_PENDING_DEFAULTS).toEqual({ delay: 200, minDuration: 400 })
  })

  it('加载在延迟内完成：始终不显示加载态', () => {
    const { changes, update } = setup()
    update(true)
    vi.advanceTimersByTime(delay - 1)
    update(false)
    vi.advanceTimersByTime(2000)
    expect(changes).toEqual([])
  })

  it('加载超过延迟：恰好在延迟到达时显示', () => {
    const { changes, update } = setup()
    update(true)
    vi.advanceTimersByTime(delay - 1)
    expect(changes).toEqual([])
    vi.advanceTimersByTime(1)
    expect(changes).toEqual([true])
  })

  it('显示后加载很快结束：保持到显示满 400ms 才隐藏', () => {
    const { changes, update } = setup()
    update(true)
    vi.advanceTimersByTime(delay) // 显示
    vi.advanceTimersByTime(50)
    update(false)
    vi.advanceTimersByTime(minDuration - 50 - 1)
    expect(changes).toEqual([true])
    vi.advanceTimersByTime(1)
    expect(changes).toEqual([true, false])
  })

  it('显示已超过 400ms 后加载结束：立即隐藏', () => {
    const { changes, update } = setup()
    update(true)
    vi.advanceTimersByTime(delay + minDuration + 100)
    update(false)
    expect(changes).toEqual([true, false])
  })

  it('最短显示期内又开始加载：继续显示，不闪一下，也不重新等待延迟', () => {
    const { changes, update } = setup()
    update(true)
    vi.advanceTimersByTime(delay)
    update(false)
    vi.advanceTimersByTime(100)
    update(true)
    vi.advanceTimersByTime(2000)
    expect(changes).toEqual([true])
    update(false)
    expect(changes).toEqual([true, false])
  })

  it('延迟期间加载状态反复变化：重新计算延迟', () => {
    const { changes, update } = setup()
    update(true)
    vi.advanceTimersByTime(150)
    update(false)
    update(true)
    vi.advanceTimersByTime(150)
    expect(changes).toEqual([])
    vi.advanceTimersByTime(50)
    expect(changes).toEqual([true])
  })

  it('可以自定义延迟与最短显示时长', () => {
    const changes: boolean[] = []
    const machine = createDelayedPending((show) => changes.push(show))
    machine.update(true, 0, 1000)
    vi.advanceTimersByTime(0)
    expect(changes).toEqual([true])
    machine.update(false, 0, 1000)
    vi.advanceTimersByTime(999)
    expect(changes).toEqual([true])
    vi.advanceTimersByTime(1)
    expect(changes).toEqual([true, false])
  })

  it('卸载（dispose）后不再回调', () => {
    const { changes, machine, update } = setup()
    update(true)
    machine.dispose()
    vi.advanceTimersByTime(2000)
    expect(changes).toEqual([])
  })
})
