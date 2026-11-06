/**
 * ContextMenu 在真实浏览器中的交互（docs/11 §6.1「右键菜单」、§6.2「键盘」「弹层」）：
 * - 右键在指针处打开，焦点进入菜单；方向键跳过禁用项与分隔线，Enter 执行（onClick 与 onSelect），关闭后焦点回到行；
 * - Shift+F10 与菜单键在聚焦元素下方打开，Esc 关闭后焦点归还；
 * - 菜单项的危险样式、禁用、分隔线、用 Kbd 显示的快捷键提示；
 * - 在别处点击关闭时焦点留在被点击的元素上；输入框中保留浏览器的菜单；disabled 与空菜单不拦截；嵌套时只开最里层。
 */
import { describe, expect, it, vi } from 'vitest'
import { ContextMenu, type ContextMenuItem, ListItem } from '../../src/index.ts'
import { isOpen, page, render, userEvent } from './render.tsx'

const items: ContextMenuItem[] = [
  { key: 'open', label: 'Open', icon: 'external-link' },
  { key: 'share', label: 'Share', disabled: true },
  { type: 'divider' },
  { key: 'rename', label: 'Rename', shortcut: 'f2' },
  { key: 'delete', label: 'Delete', danger: true, shortcut: 'mod+backspace' },
]

const focusedItem = () =>
  document.activeElement?.getAttribute('role') === 'menuitem'
    ? (document.activeElement.querySelector('.ant-dropdown-menu-title-content > :first-child')
        ?.textContent ?? document.activeElement.textContent)
    : undefined
const menu = () => document.querySelector('.ant-dropdown:not(.ant-dropdown-hidden)') as HTMLElement
const menuOpen = () => isOpen('.ant-dropdown')

function Rows(props: { onSelect?: (key: string) => void; onOpen?: () => void }) {
  return (
    <>
      <input aria-label="Elsewhere" />
      <ContextMenu items={items} onSelect={props.onSelect} testId="area">
        <ListItem title="Brief.pdf" onClick={() => {}} />
      </ContextMenu>
    </>
  )
}

const row = () => page.getByRole('button', { name: 'Brief.pdf' }).element() as HTMLElement

describe('ContextMenu', () => {
  it('右键在指针处打开，焦点进入菜单；↓ 跳过禁用项与分隔线，Enter 执行并关闭，焦点回到行', async () => {
    const onSelect = vi.fn()
    const onOpen = vi.fn()
    await render(
      <ContextMenu
        items={items.map((i) => ('key' in i && i.key === 'rename' ? { ...i, onClick: onOpen } : i))}
        onSelect={onSelect}
      >
        <ListItem title="Brief.pdf" onClick={() => {}} />
      </ContextMenu>,
    )
    const r = row().getBoundingClientRect()
    await userEvent.click(row(), { button: 'right', position: { x: 40, y: 10 } })
    await expect.poll(menuOpen).toBe(true)
    // 弹层先放在屏幕外，对齐之后才移到锚点处
    await expect
      .poll(() => Math.abs(menu().getBoundingClientRect().left - (r.left + 40)))
      .toBeLessThanOrEqual(8)
    const top = menu().getBoundingClientRect().top - (r.top + 10)
    expect(top).toBeGreaterThanOrEqual(-1)
    expect(top).toBeLessThanOrEqual(12)
    await expect.poll(focusedItem).toBe('Open')
    await userEvent.keyboard('{ArrowDown}')
    await expect.poll(focusedItem).toBe('Rename')
    await userEvent.keyboard('{Enter}')
    expect(onOpen).toHaveBeenCalledOnce()
    expect(onSelect).toHaveBeenCalledWith('rename')
    await expect.poll(menuOpen).toBe(false)
    await expect.poll(() => document.activeElement).toBe(row())
  })

  it('Shift+F10 在聚焦元素下方打开；Esc 关闭后焦点回到该元素；菜单键同样打开', async () => {
    await render(<Rows />)
    row().focus()
    await userEvent.keyboard('{Shift>}{F10}{/Shift}')
    await expect.poll(menuOpen).toBe(true)
    const r = row().getBoundingClientRect()
    await expect
      .poll(() => Math.abs(menu().getBoundingClientRect().left - r.left))
      .toBeLessThanOrEqual(8)
    expect(menu().getBoundingClientRect().top).toBeGreaterThanOrEqual(r.bottom - 1)
    await expect.poll(focusedItem).toBe('Open')
    await userEvent.keyboard('{Escape}')
    await expect.poll(menuOpen).toBe(false)
    await expect.poll(() => document.activeElement).toBe(row())
    await userEvent.keyboard('{ContextMenu}')
    await expect.poll(menuOpen).toBe(true)
    await expect.poll(focusedItem).toBe('Open')
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => document.activeElement).toBe(row())
  })

  it('菜单项：图标、危险项、禁用项、分隔线，快捷键提示用 Kbd 显示（随平台）', async () => {
    await render(<Rows />)
    await userEvent.click(row(), { button: 'right' })
    await expect.poll(menuOpen).toBe(true)
    const m = menu()
    const li = (text: string) =>
      [...m.querySelectorAll('[role="menuitem"]')].find((el) => el.textContent?.startsWith(text))
    expect(li('Open')?.querySelector('svg')).not.toBeNull()
    expect(li('Share')?.getAttribute('aria-disabled')).toBe('true')
    expect(li('Delete')?.className).toMatch(/danger/)
    expect(m.querySelectorAll('.ant-dropdown-menu-item-divider')).toHaveLength(1)
    const kbd = (text: string) =>
      [...(li(text)?.querySelectorAll('kbd > kbd') ?? [])].map(
        (k) => k.querySelector('[aria-hidden="true"]')?.textContent ?? k.textContent,
      )
    expect(kbd('Rename')).toEqual(['F2'])
    // 测试环境是 Linux：Mod 显示 Ctrl
    expect(kbd('Delete')).toEqual(['Ctrl', 'Backspace'])
  })

  it('在页面别处点击关闭，焦点留在被点击的元素上', async () => {
    await render(<Rows />)
    await userEvent.click(row(), { button: 'right' })
    await expect.poll(menuOpen).toBe(true)
    const elsewhere = page.getByRole('textbox', { name: 'Elsewhere' }).element()
    await userEvent.click(elsewhere)
    await expect.poll(menuOpen).toBe(false)
    expect(document.activeElement).toBe(elsewhere)
  })

  it('输入框中保留浏览器的菜单；disabled 或没有菜单项时不拦截右键', async () => {
    const seen: boolean[] = []
    const record = (e: MouseEvent) => queueMicrotask(() => seen.push(e.defaultPrevented))
    window.addEventListener('contextmenu', record)
    try {
      await render(
        <>
          <ContextMenu items={items}>
            <input aria-label="Field" />
          </ContextMenu>
          <ContextMenu items={items} disabled>
            <button type="button">Disabled</button>
          </ContextMenu>
          <ContextMenu items={[]}>
            <button type="button">Empty</button>
          </ContextMenu>
        </>,
      )
      for (const target of [
        page.getByRole('textbox', { name: 'Field' }).element(),
        page.getByRole('button', { name: 'Disabled' }).element(),
        page.getByRole('button', { name: 'Empty' }).element(),
      ])
        target.dispatchEvent(
          new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            button: 2,
            clientX: 5,
            clientY: 5,
          }),
        )
      await Promise.resolve()
      expect(seen).toEqual([false, false, false])
      expect(menuOpen()).toBe(false)
    } finally {
      window.removeEventListener('contextmenu', record)
    }
  })

  it('嵌套时只打开最里层的菜单', async () => {
    const outer = vi.fn()
    const inner = vi.fn()
    await render(
      <ContextMenu items={[{ key: 'outer', label: 'Outer action' }]} onOpenChange={outer}>
        <div>
          <ContextMenu items={[{ key: 'inner', label: 'Inner action' }]} onOpenChange={inner}>
            <button type="button">Inner</button>
          </ContextMenu>
        </div>
      </ContextMenu>,
    )
    await userEvent.click(page.getByRole('button', { name: 'Inner' }), { button: 'right' })
    await expect.poll(menuOpen).toBe(true)
    expect(inner).toHaveBeenCalledWith(true)
    expect(outer).not.toHaveBeenCalled()
    expect(menu().textContent).toContain('Inner action')
  })
})
