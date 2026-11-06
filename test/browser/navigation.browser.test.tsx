/**
 * 导航组件在真实浏览器中的键盘与焦点（docs/11 §6.2「键盘」「焦点」）：
 * Steps：当前步骤 aria-current、已完成的步骤显示 Lucide 的勾、当前步骤用强调色；可点击时 Tab 逐个聚焦、Enter / 空格切换、
 * 禁用的步骤跳过。Breadcrumb：导航区域的读屏名称、当前页 aria-current 且不可交互、链接与按钮的焦点环、
 * 带菜单的项用 Enter 打开菜单、Esc 关闭后焦点回到该项。
 */
import { describe, expect, it, vi } from 'vitest'
import { Breadcrumb, Steps } from '../../src/index.ts'
import {
  css,
  expectFocusRing,
  focused,
  isOpen,
  page,
  render,
  sameColor,
  token,
  userEvent,
} from './render.tsx'

const items = [
  { title: 'Details', content: 'Name and owner' },
  { title: 'Members', content: 'Who has access' },
  { title: 'Review', content: 'Check and create' },
]

const stepItems = () => [...document.querySelectorAll<HTMLElement>('.ant-steps-item')]

describe('Steps', () => {
  it('当前步骤带 aria-current="step" 并用强调色；已完成的步骤显示 Lucide 的勾；不可点击时没有按钮', async () => {
    await render(<Steps current={1} items={items} aria-label="Project setup" />)
    const [done, current, waiting] = stepItems()
    expect(current?.getAttribute('aria-current')).toBe('step')
    expect(done?.getAttribute('aria-current')).toBeNull()
    expect(done?.querySelector('.ant-steps-item-icon svg.lucide-check')).not.toBeNull()
    expect(done?.querySelector('.anticon')).toBeNull()
    const icon = current?.querySelector('.ant-steps-item-icon') as Element
    expect(sameColor(css(icon).backgroundColor, token('color-accent-fill'))).toBe(true)
    expect(waiting?.textContent).toContain('3')
    expect(document.querySelector('.ant-steps [role="button"]')).toBeNull()
    expect(page.getByLabelText('Project setup').element()).toBeDefined()
  })

  it('出错的步骤显示 Lucide 的叉', async () => {
    await render(<Steps current={1} status="error" items={items} />)
    expect(stepItems()[1]?.querySelector('.ant-steps-item-icon svg.lucide-x')).not.toBeNull()
  })

  it('可点击时：Tab 逐个聚焦步骤并显示焦点环，Enter / 空格切换；禁用的步骤跳过', async () => {
    const onChange = vi.fn()
    await render(
      <Steps
        current={0}
        onChange={onChange}
        items={[...items.slice(0, 2), { ...items[2], disabled: true }]}
      />,
    )
    const [first, second, third] = stepItems()
    await userEvent.tab()
    expect(focused()).toBe(first)
    expect(first?.getAttribute('role')).toBe('button')
    expectFocusRing(first as Element, 2)
    await userEvent.tab()
    expect(focused()).toBe(second)
    await userEvent.keyboard('{Enter}')
    expect(onChange).toHaveBeenLastCalledWith(1)
    await userEvent.keyboard(' ')
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(third?.getAttribute('role')).toBeNull()
    await userEvent.tab()
    expect(third?.contains(focused())).toBe(false)
  })
})

describe('Breadcrumb', () => {
  it('导航区域有读屏名称；最后一项是当前页（aria-current），不是链接；分隔符是 Lucide 图标', async () => {
    await render(
      <Breadcrumb
        items={[
          { title: 'Projects', href: '#projects' },
          { title: 'Website redesign', href: '#website' },
          { title: 'Mockups', href: '#mockups' },
        ]}
      />,
    )
    const nav = page.getByRole('navigation', { name: 'Breadcrumb' }).element()
    expect(nav.querySelectorAll('a')).toHaveLength(2)
    const current = nav.querySelector('[aria-current="page"]') as HTMLElement
    expect(current.textContent).toBe('Mockups')
    expect(current.closest('a')).toBeNull()
    expect(nav.querySelector('.ant-breadcrumb-separator svg.lucide-chevron-right')).not.toBeNull()
  })

  it('语言跟随 locale：zh-CN 时读屏名称为中文', async () => {
    await render(<Breadcrumb items={[{ title: 'A', href: '#a' }, { title: 'B' }]} />, {
      locale: 'zh-CN',
    })
    expect(page.getByRole('navigation', { name: '面包屑' }).element()).toBeDefined()
  })

  it('Tab 依次聚焦链接与按钮并显示焦点环；只有 onClick 的项是按钮，Enter 触发；当前页跳过', async () => {
    const onClick = vi.fn()
    await render(
      <Breadcrumb
        items={[
          { title: 'Projects', href: '#projects' },
          { title: 'Files', onClick },
          { title: 'Logos' },
        ]}
      />,
    )
    await userEvent.tab()
    const link = page.getByRole('link', { name: 'Projects' }).element()
    expect(focused()).toBe(link)
    expectFocusRing(link, 2)
    await userEvent.tab()
    const button = page.getByRole('button', { name: 'Files' }).element()
    expect(focused()).toBe(button)
    expectFocusRing(button, 2)
    await userEvent.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalledOnce()
    await userEvent.tab()
    expect(focused()?.textContent).not.toBe('Logos')
  })

  it('带菜单的项：Enter 打开菜单，焦点进入菜单，方向键移动；Esc 关闭后焦点回到该项', async () => {
    const onMenuClick = vi.fn()
    await render(
      <Breadcrumb
        items={[
          {
            title: 'Design',
            menu: {
              items: [
                { key: 'design', label: 'Design' },
                { key: 'marketing', label: 'Marketing' },
              ],
              onClick: (info) => onMenuClick(info.key),
            },
          },
          { title: 'Logos' },
        ]}
      />,
    )
    await userEvent.tab()
    const trigger = page.getByRole('button', { name: 'Design' }).element()
    expect(focused()).toBe(trigger)
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => isOpen('.ant-dropdown')).toBe(true)
    const focusedItem = () =>
      focused()?.getAttribute('role') === 'menuitem' ? focused()?.textContent : undefined
    await expect.poll(focusedItem).toBe('Design')
    await userEvent.keyboard('{ArrowDown}')
    await expect.poll(focusedItem).toBe('Marketing')
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => isOpen('.ant-dropdown')).toBe(false)
    await expect.poll(focused).toBe(trigger)
    // 再次打开：焦点回到菜单中（antd 记住上次的高亮项），Enter 选择后菜单关闭，焦点回到该项
    await userEvent.keyboard('{Enter}')
    await expect.poll(focusedItem).toBe('Marketing')
    await userEvent.keyboard('{Enter}')
    expect(onMenuClick).toHaveBeenCalledWith('marketing')
    await expect.poll(() => isOpen('.ant-dropdown')).toBe(false)
    await expect.poll(focused).toBe(trigger)
  })
})
