/**
 * useHotkeys 在真实浏览器中的行为：
 * - `mod` 跨平台：模拟 macOS（⌘）与非 macOS（Ctrl），另一个修饰键不触发；
 * - 默认在输入框、文本域、可编辑区域内不触发，`allowInInputs` 时触发；输入法组字期间不触发；
 * - enabled、preventDefault、repeat、组件已处理过的按键；最近注册的优先，卸载后恢复；
 * - 注册表：useRegisteredHotkeys 列出带说明的快捷键（含不生效的），随注册与变化更新，按作用域过滤；
 *   HotkeysProvider 隔离；同一作用域重复注册时开发模式下警告。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  HotkeysProvider,
  type UseHotkeysOptions,
  useHotkeys,
  useRegisteredHotkeys,
} from '../../src/index.ts'
import { page, render, userEvent } from './render.tsx'

// userEvent.keyboard 中 `[` 与 `{` 是按键描述的开头，按键本身要写两次：`[[` 即按下 `[`

afterEach(() => {
  vi.restoreAllMocks()
})

function stubPlatform(name: 'macOS' | 'Windows') {
  vi.spyOn(navigator, 'platform', 'get').mockReturnValue(name === 'macOS' ? 'MacIntel' : 'Win32')
  if ('userAgentData' in navigator)
    vi.spyOn(navigator, 'userAgentData' as never, 'get').mockReturnValue({
      platform: name,
    } as never)
}

function Hotkey(props: {
  keys: string | readonly string[]
  onFire: (e: KeyboardEvent) => void
  options?: UseHotkeysOptions
}) {
  useHotkeys(props.keys, props.onFire, props.options)
  return null
}

/** 页面与其上的对话框都注册了 Esc。 */
function Layered(props: {
  dialog: boolean
  tag: string
  onPage: (tag: string) => void
  onDialog: () => void
}) {
  return (
    <>
      <Hotkey keys="escape" onFire={() => props.onPage(props.tag)} />
      {props.dialog && (
        <Hotkey keys="escape" onFire={props.onDialog} options={{ scope: 'dialog' }} />
      )}
    </>
  )
}

/** 列出注册表中的快捷键：`作用域|组合|说明`。 */
function List(props: { scope?: string; label?: string }) {
  const list = useRegisteredHotkeys(props.scope)
  return (
    <ul aria-label={props.label ?? props.scope ?? 'all'}>
      {list.map((h) => (
        <li key={h.id} data-enabled={h.enabled}>
          {`${h.scope}|${h.keys.join(',')}|${h.description}`}
        </li>
      ))}
    </ul>
  )
}

function RegistryPage(props: { open: boolean; extra: boolean; label: string }) {
  return (
    <>
      <Hotkey keys="mod+k" onFire={() => {}} options={{ description: props.label }} />
      <Hotkey keys="[" onFire={() => {}} />
      <Hotkey
        keys={['arrowup', 'arrowdown']}
        onFire={() => {}}
        options={{ description: 'Move', scope: 'palette', enabled: props.open }}
      />
      {props.extra && <Hotkey keys="?" onFire={() => {}} options={{ description: 'Help' }} />}
      <List />
      <List scope="palette" />
      <HotkeysProvider>
        <Hotkey keys="mod+s" onFire={() => {}} options={{ description: 'Save' }} />
        <List scope="inner" />
        <List label="provider" />
      </HotkeysProvider>
    </>
  )
}

/** 在 window 上记录按键事件最终是否被阻止默认操作（在快捷键的监听之后执行）。 */
function lastKeyDefaultPrevented() {
  const seen: boolean[] = []
  const listener = (e: KeyboardEvent) => {
    // 放到微任务里读取：所有冒泡监听执行完之后
    queueMicrotask(() => seen.push(e.defaultPrevented))
  }
  window.addEventListener('keydown', listener)
  return {
    get: async () => {
      await Promise.resolve()
      return seen.at(-1)
    },
    stop: () => window.removeEventListener('keydown', listener),
  }
}

describe('useHotkeys：组合与平台', () => {
  it('非 macOS：mod+k 由 Ctrl+K 触发，⌘+K 不触发；默认阻止浏览器的默认操作', async () => {
    stubPlatform('Windows')
    const onFire = vi.fn()
    await render(<Hotkey keys="mod+k" onFire={onFire} />)
    const prevented = lastKeyDefaultPrevented()
    await userEvent.keyboard('{Meta>}k{/Meta}')
    expect(onFire).not.toHaveBeenCalled()
    await userEvent.keyboard('{Control>}k{/Control}')
    expect(onFire).toHaveBeenCalledTimes(1)
    expect(await prevented.get()).toBe(true)
    prevented.stop()
  })

  it('macOS：mod+k 由 ⌘+K 触发，Ctrl+K 不触发', async () => {
    stubPlatform('macOS')
    const onFire = vi.fn()
    await render(<Hotkey keys="mod+k" onFire={onFire} />)
    await userEvent.keyboard('{Control>}k{/Control}')
    expect(onFire).not.toHaveBeenCalled()
    await userEvent.keyboard('{Meta>}k{/Meta}')
    expect(onFire).toHaveBeenCalledTimes(1)
  })

  it('符号键 ? 与 [：不论是否按着 Shift 都匹配，按着 Ctrl 时不匹配；数组注册多个组合', async () => {
    const help = vi.fn()
    const sider = vi.fn()
    const move = vi.fn()
    await render(
      <>
        <Hotkey keys="?" onFire={help} />
        <Hotkey keys="[" onFire={sider} />
        <Hotkey keys={['arrowup', 'arrowdown']} onFire={move} />
      </>,
    )
    await userEvent.keyboard('{Shift>}?{/Shift}')
    expect(help).toHaveBeenCalledTimes(1)
    await userEvent.keyboard('[[')
    expect(sider).toHaveBeenCalledTimes(1)
    await userEvent.keyboard('{Control>}[[{/Control}')
    expect(sider).toHaveBeenCalledTimes(1)
    await userEvent.keyboard('{ArrowUp}{ArrowDown}')
    expect(move.mock.calls.map(([e]) => (e as KeyboardEvent).key)).toEqual(['ArrowUp', 'ArrowDown'])
  })
})

describe('useHotkeys：输入框与输入法', () => {
  it('焦点在输入框、文本域、可编辑区域内时不触发；复选框不算输入；allowInInputs 时触发', async () => {
    const bare = vi.fn()
    const anywhere = vi.fn()
    await render(
      <>
        <Hotkey keys="[" onFire={bare} />
        <Hotkey keys="mod+enter" onFire={anywhere} options={{ allowInInputs: true }} />
        <input aria-label="Name" />
        <textarea aria-label="Notes" />
        <div data-testid="editor" contentEditable suppressContentEditableWarning />
        <input type="checkbox" aria-label="Done" />
      </>,
    )
    for (const field of [
      page.getByRole('textbox', { name: 'Name' }),
      page.getByRole('textbox', { name: 'Notes' }),
      page.getByTestId('editor'),
    ]) {
      await userEvent.click(field)
      await userEvent.keyboard('[[')
      expect(bare).not.toHaveBeenCalled()
    }
    await userEvent.click(page.getByRole('textbox', { name: 'Name' }))
    await userEvent.keyboard('{Control>}{Enter}{/Control}')
    expect(anywhere).toHaveBeenCalledTimes(1)
    await userEvent.click(page.getByRole('checkbox', { name: 'Done' }))
    await userEvent.keyboard('[[')
    expect(bare).toHaveBeenCalledTimes(1)
  })

  it('输入法组字期间的按键（isComposing、keyCode 229）不触发，即使 allowInInputs', async () => {
    const onFire = vi.fn()
    await render(
      <>
        <Hotkey keys="enter" onFire={onFire} options={{ allowInInputs: true }} />
        <input aria-label="Name" />
      </>,
    )
    const input = page.getByRole('textbox', { name: 'Name' }).element()
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true }),
    )
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 229, bubbles: true }))
    expect(onFire).not.toHaveBeenCalled()
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(onFire).toHaveBeenCalledTimes(1)
  })
})

describe('useHotkeys：选项与优先级', () => {
  it('enabled=false 不触发；preventDefault=false 不阻止默认操作；组件已处理（preventDefault）的按键不再触发', async () => {
    const off = vi.fn()
    const plain = vi.fn()
    await render(
      <>
        <Hotkey keys="x" onFire={off} options={{ enabled: false }} />
        <Hotkey keys="y" onFire={plain} options={{ preventDefault: false }} />
        <button type="button" onKeyDown={(e) => e.key === 'y' && e.preventDefault()}>
          Handles y
        </button>
      </>,
    )
    await userEvent.keyboard('x')
    expect(off).not.toHaveBeenCalled()
    const prevented = lastKeyDefaultPrevented()
    await userEvent.keyboard('y')
    expect(plain).toHaveBeenCalledTimes(1)
    expect(await prevented.get()).toBe(false)
    prevented.stop()
    page.getByRole('button', { name: 'Handles y' }).element().focus()
    await userEvent.keyboard('y')
    expect(plain).toHaveBeenCalledTimes(1)
  })

  it('按住不放的自动重复默认忽略，repeat 时触发', async () => {
    const once = vi.fn()
    const repeated = vi.fn()
    await render(
      <>
        <Hotkey keys="a" onFire={once} />
        <Hotkey keys="b" onFire={repeated} options={{ repeat: true }} />
      </>,
    )
    for (const key of ['a', 'b']) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
      window.dispatchEvent(new KeyboardEvent('keydown', { key, repeat: true, bubbles: true }))
    }
    expect(once).toHaveBeenCalledTimes(1)
    expect(repeated).toHaveBeenCalledTimes(2)
  })

  it('同一个键由最近注册的处理；它卸载后之前的恢复；处理函数更新后用最新的', async () => {
    const page1 = vi.fn()
    const dialog = vi.fn()
    const view = await render(<Layered dialog tag="first" onPage={page1} onDialog={dialog} />)
    await userEvent.keyboard('{Escape}')
    expect(dialog).toHaveBeenCalledTimes(1)
    expect(page1).not.toHaveBeenCalled()
    await view.rerender(<Layered dialog={false} tag="second" onPage={page1} onDialog={dialog} />)
    await userEvent.keyboard('{Escape}')
    expect(page1).toHaveBeenCalledTimes(1)
    expect(page1.mock.calls[0]?.[0]).toBe('second')
  })
})

describe('HotkeysProvider 的优先级', () => {
  it('Provider 里的快捷键先于页面的处理，处理后页面的不再触发；Provider 卸载后页面的恢复；不同注册表之间不报冲突', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const outer = vi.fn()
    const inner = vi.fn()
    const view = await render(
      <>
        <Hotkey keys="mod+k" onFire={outer} />
        <HotkeysProvider>
          <Hotkey keys="mod+k" onFire={inner} />
        </HotkeysProvider>
      </>,
    )
    await userEvent.keyboard('{Control>}k{/Control}')
    expect(inner).toHaveBeenCalledTimes(1)
    expect(outer).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
    await view.rerender(<Hotkey keys="mod+k" onFire={outer} />)
    await userEvent.keyboard('{Control>}k{/Control}')
    expect(outer).toHaveBeenCalledTimes(1)
    expect(inner).toHaveBeenCalledTimes(1)
  })
})

describe('快捷键注册表', () => {
  const items = (name: string) =>
    [...page.getByRole('list', { name }).element().querySelectorAll('li')].map((li) => ({
      text: li.textContent,
      enabled: li.getAttribute('data-enabled'),
    }))

  it('列出带说明的快捷键（按注册顺序，含不生效的）；随启用、说明与卸载更新；按作用域过滤；Provider 隔离', async () => {
    const view = await render(<RegistryPage open={false} extra label="Search" />)
    expect(items('all')).toEqual([
      { text: 'global|mod+k|Search', enabled: 'true' },
      { text: 'palette|arrowup,arrowdown|Move', enabled: 'false' },
      { text: 'global|?|Help', enabled: 'true' },
    ])
    expect(items('palette')).toEqual([{ text: 'palette|arrowup,arrowdown|Move', enabled: 'false' }])
    expect(items('inner')).toEqual([])
    // Provider 中的注册表只有自己的快捷键，外面的列表也看不到它的
    expect(items('provider')).toEqual([{ text: 'global|mod+s|Save', enabled: 'true' }])
    await view.rerender(<RegistryPage open extra={false} label="Search and jump" />)
    expect(items('all')).toEqual([
      { text: 'global|mod+k|Search and jump', enabled: 'true' },
      { text: 'palette|arrowup,arrowdown|Move', enabled: 'true' },
    ])
  })

  it('同一作用域内重复注册同一组合（含 mod 与当前平台的 ctrl）时，开发模式下警告；不同作用域或不生效时不警告', async () => {
    stubPlatform('Windows')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const first = await render(
      <>
        <Hotkey keys="mod+k" onFire={() => {}} />
        <Hotkey keys="mod+k" onFire={() => {}} options={{ scope: 'other' }} />
        <Hotkey keys="mod+k" onFire={() => {}} options={{ enabled: false }} />
      </>,
    )
    expect(warn).not.toHaveBeenCalled()
    await first.unmount()
    await render(
      <>
        <Hotkey keys="mod+k" onFire={() => {}} />
        <Hotkey keys="ctrl+k" onFire={() => {}} />
      </>,
    )
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toMatch(
      /registered more than once in the scope "global"/,
    )
  })
})
