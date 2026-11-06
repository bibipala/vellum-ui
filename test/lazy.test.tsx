/**
 * 按需加载的模块（lazy.ts）：只加载一次、加载中共用同一个 Promise、完成时通知订阅者、失败后可以重新加载；
 * 服务端渲染时 useLazy 总是「还没有加载」，也不开始加载（effect 不在服务端运行）。
 */
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { lazy, useLazy } from '../src/components/lazy.ts'

describe('lazy()', () => {
  it('只加载一次：加载中共用同一个 Promise，完成后 current() 返回结果并通知订阅者', async () => {
    const loader = vi.fn(async () => ({ name: 'module' }))
    const m = lazy(loader)
    const notified = vi.fn()
    const unsubscribe = m.subscribe(notified)
    expect(m.current()).toBeNull()
    const a = m.load()
    const b = m.load()
    expect(a).toBe(b)
    const value = await a
    expect(value).toEqual({ name: 'module' })
    expect(m.current()).toBe(value)
    expect(notified).toHaveBeenCalledTimes(1)
    await expect(m.load()).resolves.toBe(value)
    expect(loader).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('失败后再次调用会重新加载；失败不通知订阅者', async () => {
    let attempt = 0
    const m = lazy(async () => {
      attempt++
      if (attempt === 1) throw new Error('offline')
      return 'ok'
    })
    const notified = vi.fn()
    m.subscribe(notified)
    await expect(m.load()).rejects.toThrow('offline')
    expect(m.current()).toBeNull()
    expect(notified).not.toHaveBeenCalled()
    await expect(m.load()).resolves.toBe('ok')
    expect(m.current()).toBe('ok')
    expect(attempt).toBe(2)
    expect(notified).toHaveBeenCalledTimes(1)
  })

  it('取消订阅后不再通知', async () => {
    const m = lazy(async () => 1)
    const notified = vi.fn()
    m.subscribe(notified)()
    await m.load()
    expect(notified).not.toHaveBeenCalled()
  })
})

const probeLoader = vi.fn(async () => 'value')
const probeModule = lazy(probeLoader)

function Probe() {
  const { value, failed } = useLazy(probeModule, 'the probe')
  return <span>{`${value ?? 'none'} ${failed}`}</span>
}

describe('useLazy()：服务端渲染', () => {
  it('服务端总是「还没有加载」（即使已经加载过），不开始加载', async () => {
    expect(renderToString(<Probe />)).toBe('<span>none false</span>')
    expect(probeLoader).not.toHaveBeenCalled()
    await probeModule.load()
    // 已经加载过：服务端快照仍是 null，注水的第一次渲染与服务端一致
    expect(renderToString(<Probe />)).toBe('<span>none false</span>')
  })
})
