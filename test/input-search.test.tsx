import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// 测试环境没有 DOM：把 antd 的 Input 换成只记录属性的桩，检查 Input.Search 把搜索语义转换成了什么，
// 并直接调用记录下来的事件处理函数，模拟回车、输入法组字与清除。
const received = vi.hoisted(() => ({ input: [] as Record<string, unknown>[] }))
vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>()
  const Input = Object.assign((props: Record<string, unknown>) => {
    received.input.push(props)
    return null
  }, actual.Input)
  return { ...actual, Input }
})

const { Input } = await import('../src/index.ts')

type Handler = (e: unknown) => void
const last = () => received.input.at(-1) as Record<string, unknown>
const call = (name: string, e: unknown) => (last()[name] as Handler)(e)
const enter = (value: string) => ({ currentTarget: { value }, key: 'Enter' })

beforeEach(() => {
  received.input.length = 0
})

describe('Input.Search（v3：框内搜索图标，不附着按钮）', () => {
  it('搜索图标放在框内前面，输入框类型为 search，没有附着的按钮', () => {
    renderToStaticMarkup(<Input.Search placeholder="搜索" />)
    const props = last()
    expect(props.type).toBe('search')
    expect(props.enterButton).toBeUndefined()
    const prefix = renderToStaticMarkup(props.prefix as ReactElement)
    expect(prefix).toContain('lucide-search')
    expect(prefix).toContain('aria-hidden="true"')
  })

  it('回车以当前文字触发 onSearch，并保留调用方的 onPressEnter', () => {
    const onSearch = vi.fn()
    const onPressEnter = vi.fn()
    renderToStaticMarkup(<Input.Search onSearch={onSearch} onPressEnter={onPressEnter} />)
    const e = enter('林晓')
    call('onPressEnter', e)
    expect(onSearch).toHaveBeenCalledWith('林晓', { source: 'input' })
    expect(onPressEnter).toHaveBeenCalledWith(e)
  })

  it('输入法组字过程中的回车不触发，组字结束后恢复', () => {
    const onSearch = vi.fn()
    const onCompositionEnd = vi.fn()
    renderToStaticMarkup(<Input.Search onSearch={onSearch} onCompositionEnd={onCompositionEnd} />)
    call('onCompositionStart', {})
    call('onPressEnter', enter('lin'))
    expect(onSearch).not.toHaveBeenCalled()
    call('onCompositionEnd', {})
    expect(onCompositionEnd).toHaveBeenCalled()
    call('onPressEnter', enter('林'))
    expect(onSearch).toHaveBeenCalledWith('林', { source: 'input' })
  })

  it('点清除按钮以空字符串触发 onSearch（source 为 clear），普通输入只调用 onChange', () => {
    const onSearch = vi.fn()
    const onChange = vi.fn()
    renderToStaticMarkup(<Input.Search allowClear onSearch={onSearch} onChange={onChange} />)
    const typing = { type: 'change', target: { value: '林' } }
    call('onChange', typing)
    expect(onSearch).not.toHaveBeenCalled()
    expect(onChange).toHaveBeenCalledWith(typing)
    const clear = { type: 'click', target: { value: '' } }
    call('onChange', clear)
    expect(onSearch).toHaveBeenCalledWith('', { source: 'clear' })
    expect(onChange).toHaveBeenCalledWith(clear)
  })

  it('loading 时图标换成加载指示，回车不重复触发', () => {
    const onSearch = vi.fn()
    renderToStaticMarkup(<Input.Search loading onSearch={onSearch} />)
    expect(renderToStaticMarkup(last().prefix as ReactElement)).toContain('lucide-loader-circle')
    call('onPressEnter', enter('林晓'))
    expect(onSearch).not.toHaveBeenCalled()
  })
})
