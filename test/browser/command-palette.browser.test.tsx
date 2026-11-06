/**
 * CommandPalette 在真实浏览器中的交互（docs/11 §6.1「命令面板」、§6.2「键盘」「对话框」）：
 * - 打开后焦点在搜索框（combobox），关闭后焦点回到打开前的元素；
 * - 输入筛选（模糊、分组聚在一起）、↑/↓ 移动当前项（aria-activedescendant / aria-selected）、Enter 执行、Esc 关闭；
 *   悬停移动当前项、点击执行；输入法组字期间的 Enter 不执行；
 * - 空状态、结果超过 limit 时截断并提示剩余数量；
 * - 异步 onSearch：停止输入后调用，查询变化时取消上一次，结果排在本地结果之后，失败时提示并上报；
 * - 面板的按键注册在 commandPalette 作用域，关闭时也能被列出（enabled 随打开变化）；文字随语言切换。
 */
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  Button,
  CommandPalette,
  type CommandPaletteItem,
  type CommandPaletteProps,
  useRegisteredHotkeys,
} from '../../src/index.ts'
import { page, render, settle, userEvent } from './render.tsx'

afterEach(() => {
  vi.restoreAllMocks()
})

const ran: string[] = []
const base: CommandPaletteItem[] = [
  { id: 'home', title: 'Home', group: 'Pages', icon: 'home' },
  { id: 'new', title: 'New project', group: 'Actions', icon: 'plus', shortcut: 'mod+alt+n' },
  { id: 'projects', title: 'Projects', group: 'Pages', icon: 'project', keywords: ['work'] },
  { id: 'settings', title: 'Settings', group: 'Pages', icon: 'settings' },
]
const items = base.map((i) => ({ ...i, onSelect: () => ran.push(i.id) }))

function Harness(props: Partial<CommandPaletteProps> & { onOpenChange?: (o: boolean) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open palette</Button>
      <CommandPalette
        items={items}
        testId="palette"
        {...props}
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          props.onOpenChange?.(o)
        }}
      />
    </>
  )
}

/** 列出 commandPalette 作用域中的快捷键：`组合=说明:是否生效`。 */
function Keys() {
  const list = useRegisteredHotkeys('commandPalette')
  return (
    <output>
      {list.map((h) => `${h.keys.join('/')}=${h.description}:${h.enabled}`).join(';')}
    </output>
  )
}

const input = () => page.getByTestId('palette-input').element() as HTMLInputElement
const options = () => [...document.querySelectorAll('[role="option"]')]
const titleOf = (o: Element | undefined) =>
  o?.querySelector('[class*="itemTitle"]')?.textContent ?? null
const activeTitle = () =>
  titleOf(document.getElementById(input().getAttribute('aria-activedescendant') ?? '') ?? undefined)
const listTitles = () => options().map((o) => titleOf(o))
const paletteOpen = () => document.querySelector('[data-testid="palette"]') !== null

async function openPalette() {
  const trigger = page.getByRole('button', { name: 'Open palette' }).element() as HTMLElement
  trigger.focus()
  await userEvent.keyboard('{Enter}')
  await expect
    .poll(() => document.activeElement === document.querySelector('[data-testid="palette-input"]'))
    .toBe(true)
  return trigger
}

describe('CommandPalette', () => {
  it('打开后焦点在搜索框；↓/↑ 移动当前项（两端停住），Enter 执行并关闭，焦点回到打开前的按钮', async () => {
    ran.length = 0
    const onOpenChange = vi.fn()
    await render(<Harness onOpenChange={onOpenChange} />)
    const trigger = await openPalette()
    const field = input()
    expect(field.getAttribute('role')).toBe('combobox')
    expect(field.getAttribute('aria-controls')).toBe(document.querySelector('[role="listbox"]')?.id)
    // 同一分组的条目排在一起：Pages 在前（最先出现），Actions 在后
    expect(listTitles()).toEqual(['Home', 'Projects', 'Settings', 'New project'])
    expect(activeTitle()).toBe('Home')
    await userEvent.keyboard('{ArrowUp}')
    expect(activeTitle()).toBe('Home')
    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    expect(activeTitle()).toBe('Settings')
    expect(document.querySelector('[aria-selected="true"]')?.textContent).toContain('Settings')
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}')
    expect(activeTitle()).toBe('New project')
    await userEvent.keyboard('{Enter}')
    expect(ran).toEqual(['new'])
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
    await expect.poll(paletteOpen).toBe(false)
    await expect.poll(() => document.activeElement).toBe(trigger)
  })

  it('输入筛选：模糊匹配、关键词；输入后当前项回到第一个；Esc 关闭，焦点归还', async () => {
    await render(<Harness />)
    const trigger = await openPalette()
    await userEvent.keyboard('{ArrowDown}')
    await userEvent.fill(input(), 'nwp')
    expect(listTitles()).toEqual(['New project'])
    expect(activeTitle()).toBe('New project')
    await userEvent.fill(input(), 'work')
    expect(listTitles()).toEqual(['Projects'])
    await userEvent.fill(input(), 'zzz')
    expect(options()).toHaveLength(0)
    expect(page.getByText('No results').element()).toBeTruthy()
    expect(input().getAttribute('aria-activedescendant')).toBeNull()
    await userEvent.keyboard('{Escape}')
    await expect.poll(paletteOpen).toBe(false)
    await expect.poll(() => document.activeElement).toBe(trigger)
  })

  it('悬停移动当前项，点击执行；条目显示图标、分组与用 Kbd 显示的快捷键', async () => {
    ran.length = 0
    await render(<Harness />)
    await openPalette()
    const row = options().find((o) => titleOf(o) === 'New project') as HTMLElement
    expect(row.querySelector('svg')).not.toBeNull()
    expect(row.textContent).toContain('Actions')
    expect([...row.querySelectorAll('kbd > kbd')].map((k) => k.textContent)).toEqual([
      'Ctrl',
      'Alt',
      'N',
    ])
    await userEvent.hover(row)
    await expect.poll(activeTitle).toBe('New project')
    await userEvent.click(row)
    expect(ran).toEqual(['new'])
    await expect.poll(paletteOpen).toBe(false)
  })

  it('输入法组字期间的 Enter 不执行', async () => {
    ran.length = 0
    await render(<Harness />)
    await openPalette()
    input().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true }),
    )
    input().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', keyCode: 229, bubbles: true }),
    )
    await settle()
    expect(ran).toEqual([])
    expect(paletteOpen()).toBe(true)
  })

  it('结果超过 limit 时截断，列表下方提示还有多少条；自定义空状态文字', async () => {
    const many = Array.from({ length: 120 }, (_, i) => ({ id: `f${i}`, title: `Report ${i}` }))
    await render(<Harness items={many} emptyText="No files found" />)
    await openPalette()
    expect(options()).toHaveLength(50)
    expect(
      page.getByText('70 more results. Keep typing to narrow them down.').element(),
    ).toBeTruthy()
    await userEvent.fill(input(), 'Report 11')
    // 连续命中的 Report 11、110 … 119 在前，只是按顺序出现的（模糊）Report 101 排在最后
    expect(listTitles()).toEqual([
      'Report 11',
      ...Array.from({ length: 10 }, (_, i) => `Report 11${i}`),
      'Report 101',
    ])
    expect(document.querySelector('[data-testid="palette"] [role="status"]')).toBeNull()
    await userEvent.fill(input(), 'nothing')
    expect(page.getByText('No files found').element()).toBeTruthy()
  })

  it('异步 onSearch：停止输入后调用，查询变化时取消上一次；结果排在本地结果之后，与本地重复的不再显示', async () => {
    const calls: { query: string; signal: AbortSignal }[] = []
    const onSearch = vi.fn((query: string, signal: AbortSignal) => {
      calls.push({ query, signal })
      return Promise.resolve([
        { id: 'person:sam', title: `Sam (${query})`, group: 'People' },
        { id: 'settings', title: 'Settings (remote)' },
      ])
    })
    await render(<Harness onSearch={onSearch} />)
    await openPalette()
    expect(onSearch).not.toHaveBeenCalled()
    await userEvent.fill(input(), 's')
    await userEvent.fill(input(), 'se')
    await expect.poll(() => onSearch.mock.calls.length).toBe(1)
    expect(calls[0]?.query).toBe('se')
    await expect.poll(listTitles).toEqual(['Settings', 'Sam (se)'])
    await userEvent.fill(input(), 'set')
    await expect.poll(() => calls.length).toBe(2)
    expect(calls[0]?.signal.aborted).toBe(true)
    await expect.poll(listTitles).toEqual(['Settings', 'Sam (set)'])
  })

  it('onSearch 失败：在列表下方提示并用 reportError 上报，本地结果照常显示', async () => {
    const reported = vi.spyOn(globalThis, 'reportError').mockImplementation(() => {})
    const failure = new Error('Server unavailable')
    await render(<Harness onSearch={() => Promise.reject(failure)} />)
    await openPalette()
    await userEvent.fill(input(), 'home')
    await expect.poll(() => reported.mock.calls.length).toBe(1)
    expect(reported).toHaveBeenCalledWith(failure)
    expect(listTitles()).toEqual(['Home'])
    await expect.poll(() => page.getByText("Couldn't load more results").query()).not.toBeNull()
  })

  it('面板的按键注册在 commandPalette 作用域：关闭时列出且不生效，打开时生效；文字随语言', async () => {
    await render(
      <>
        <Harness />
        <Keys />
      </>,
      { locale: 'zh-CN' },
    )
    const out = () => document.querySelector('output')?.textContent
    expect(out()).toBe(
      'escape=关闭命令面板:false;arrowup/arrowdown=在结果中移动:false;enter=打开所选项:false',
    )
    await openPalette()
    expect(out()).toBe(
      'escape=关闭命令面板:true;arrowup/arrowdown=在结果中移动:true;enter=打开所选项:true',
    )
    expect(input().placeholder).toBe('搜索或执行命令')
    const footer = document.querySelector('[data-testid="palette"]')?.lastElementChild?.textContent
    expect(footer).toContain('选择')
    expect(footer).toContain('打开')
    expect(footer).toContain('关闭')
  })
})
