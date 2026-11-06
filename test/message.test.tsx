import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MessageItem } from '../src/components/message.tsx'
import { createMessageStore, type MessageKind } from '../src/components/messageStore.ts'
import { App, enUS, useMessage, zhCN } from '../src/index.ts'

// 消息条的界面与 App 的接线（docs/11 §6.2）。计时、叠放、按 key 更新、悬停暂停见 message-store.test.ts。
// 测试环境没有 DOM：服务端渲染不挂载门户，这里检查上下文接线与单条消息的结构。
type Api = ReturnType<typeof useMessage>

let captured: Api | undefined
function Probe() {
  captured = useMessage()
  return null
}
let outer: Api | undefined
function Outer() {
  outer = useMessage()
  return null
}
function capture(app: ReactNode): Api {
  captured = undefined
  renderToStaticMarkup(app)
  if (!captured) throw new Error('useMessage 未返回')
  return captured
}

function entryOf(kind: MessageKind, undo?: () => void) {
  const store = createMessageStore<ReactNode>({ maxCount: 3, leaveMs: 140 })
  store.open({ kind, content: '已移出部门：林晓', durationMs: 0, undo })
  const entry = store.getSnapshot()[0]
  if (!entry) throw new Error('没有打开消息')
  return entry
}

describe('消息条（docs/11 §6.2）', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('在 App 之外调用 useMessage 时给出明确的错误', () => {
    expect(() => renderToStaticMarkup(<Probe />)).toThrow(
      /useMessage\(\) must be used inside .*<App>/,
    )
  })

  it('App：默认 4 秒后关闭；调用方可以覆盖默认时长与上限', () => {
    const onClose = vi.fn()
    capture(
      <App>
        <Probe />
      </App>,
    ).success({ content: '已保存', onClose })
    vi.advanceTimersByTime(3999)
    expect(onClose).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onClose).toHaveBeenCalledOnce()

    const first = vi.fn()
    const api = capture(
      <App message={{ duration: 2, maxCount: 1 }}>
        <Probe />
      </App>,
    )
    api.info({ content: 'a', onClose: first })
    api.info({ content: 'b', onClose: onClose })
    // 上限 1：第二条出现时第一条立即离开
    expect(first).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(2000)
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('App：最多同时显示 3 条', () => {
    const closed: string[] = []
    const api = capture(
      <App>
        <Probe />
      </App>,
    )
    for (const c of ['1', '2', '3', '4']) api.info({ content: c, onClose: () => closed.push(c) })
    expect(closed).toEqual(['1'])
  })

  it('嵌套的 App 沿用外层的消息条，不会出现两组', () => {
    outer = undefined
    const inner = capture(
      <App>
        <Outer />
        <App>
          <Probe />
        </App>
      </App>,
    )
    expect(inner).toBe(outer)
  })

  it('服务端渲染时只渲染子元素，消息条容器在客户端挂载后才通过门户渲染到 body', () => {
    const html = renderToStaticMarkup(
      <App>
        <span>内容</span>
      </App>,
    )
    expect(html).toContain('<span>内容</span>')
    expect(html).not.toContain(enUS['message.region'])
    expect(html).not.toContain(zhCN['message.region'])
  })

  it('普通消息用 role="status" 礼貌播报，失败消息用 role="alert"', () => {
    const ok = renderToStaticMarkup(<MessageItem entry={entryOf('success')} />)
    expect(ok).toMatch(/role="status"/)
    expect(ok).toMatch(/aria-live="polite"/)
    const err = renderToStaticMarkup(<MessageItem entry={entryOf('error')} />)
    expect(err).toMatch(/role="alert"/)
    expect(err).not.toMatch(/aria-live=/)
  })

  it('左侧有状态图标（装饰性，对读屏隐藏）；进行中的图标旋转', () => {
    for (const kind of ['success', 'error', 'info', 'warning', 'loading'] as const) {
      const html = renderToStaticMarkup(<MessageItem entry={entryOf(kind)} />)
      expect(html).toMatch(/<svg[^>]*aria-hidden="true"/)
      expect(html).toContain(`data-kind="${kind}"`)
    }
    expect(renderToStaticMarkup(<MessageItem entry={entryOf('loading')} />)).toContain('data-spin')
    expect(renderToStaticMarkup(<MessageItem entry={entryOf('info')} />)).not.toContain('data-spin')
  })

  it('带撤销的消息条有原生按钮（可用键盘操作），带统一状态层', () => {
    const html = renderToStaticMarkup(<MessageItem entry={entryOf('success', () => {})} />)
    expect(html).toContain('已移出部门：林晓')
    expect(html).toContain(`>${enUS['message.undo']}</button>`)
    expect(html).toMatch(/<button type="button"[^>]*data-vl-state=""[^>]*>Undo<\/button>/)
    expect(renderToStaticMarkup(<MessageItem entry={entryOf('success')} />)).not.toContain(
      '<button',
    )
  })
})
