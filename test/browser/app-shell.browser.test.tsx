/**
 * Nav 与 AppShell 在真实浏览器中的行为：
 * Nav：导航区域与读屏名称、当前项 aria-current="page" 与选中浅底、链接与按钮、Tab 顺序与方向键（跳过禁用项）、
 * 内收的焦点环与状态层、带 href 的项在有 onSelect 时不跳转、收起后文字只给读屏并在提示中显示。
 * AppShell：header / nav / main 区域、跳转链接是第一个可聚焦元素且不改地址、主内容区的 view-transition-name
 * （嵌套时不设置）、占满视口且主内容区单独滚动、受控与非受控的收起、窄布局的抽屉（焦点、Esc、点击外部、选择后关闭；
 * 面板离场比进场快，遮罩淡入淡出、可以中途折返，淡出结束后卸载）。
 */
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppShell, Nav, type NavGroup, type NavItem } from '../../src/index.ts'
import { pauseTransition } from './animation.ts'
import {
  afterPaint,
  css,
  expectFocusRing,
  focused,
  ms,
  page,
  render,
  sameColor,
  sameEasing,
  token,
  transitionOf,
  userEvent,
  visibleTooltips,
} from './render.tsx'

const ITEMS: readonly (NavItem | NavGroup)[] = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'inbox', label: 'Inbox', icon: 'inbox', count: 4, countTone: 'accent' },
  {
    type: 'group',
    label: 'Workspace',
    items: [
      { key: 'members', label: 'Members', icon: 'users' },
      { key: 'archive', label: 'Archive', icon: 'archive', disabled: true },
      { key: 'settings', label: 'Settings', icon: 'settings' },
    ],
  },
]

const navItem = (name: string) => page.getByRole('button', { name, exact: true })
const el = (locator: { element(): Element }) => locator.element() as HTMLElement

function Controlled(props: { onSelect?: (key: string) => void; collapsed?: boolean }) {
  const [value, setValue] = useState('inbox')
  return (
    <Nav
      items={ITEMS}
      value={value}
      collapsed={props.collapsed}
      onSelect={(key) => {
        setValue(key)
        props.onSelect?.(key)
      }}
    />
  )
}

describe('Nav', () => {
  const apple: NavItem = { key: 'a', label: 'Apple' }
  const banana: NavItem = { key: 'b', label: 'Banana' }
  it.each([
    { name: '重新排序', before: [apple, banana], after: [banana, apple] },
    {
      name: '重新分组',
      before: [
        { type: 'group', key: 'one', label: 'First group', items: [apple] },
        { type: 'group', key: 'two', label: 'Second group', items: [banana] },
      ],
      after: [
        { type: 'group', key: 'one', label: 'First group', items: [banana] },
        { type: 'group', key: 'two', label: 'Second group', items: [apple] },
      ],
    },
  ] satisfies { name: string; before: (NavItem | NavGroup)[]; after: (NavItem | NavGroup)[] }[])(
    '$name：整体尺寸未变时滑块也立即跟随当前项',
    async ({ before, after }) => {
      const { container, rerender } = await render(<Nav items={before} value="b" />)
      await afterPaint()
      const nav = container.querySelector('nav') as HTMLElement
      const indicator = nav.querySelector('span[aria-hidden="true"]') as HTMLElement
      const size = [nav.offsetWidth, nav.offsetHeight]
      const oldTransform = indicator.style.transform
      await rerender(<Nav items={after} value="b" />)
      expect([nav.offsetWidth, nav.offsetHeight]).toEqual(size)
      expect(indicator.style.transform).not.toBe(oldTransform)
      const selected = nav.querySelector('[aria-current="page"]') as HTMLElement
      expect(indicator.getBoundingClientRect().top).toBe(selected.getBoundingClientRect().top)
      expect(indicator.getAnimations().filter((a) => a instanceof CSSTransition)).toHaveLength(0)
      await afterPaint()
      expect(indicator.getBoundingClientRect().top).toBe(selected.getBoundingClientRect().top)
    },
  )

  it.each([
    { name: '同一个数组', fresh: false },
    { name: '每次渲染新的数组字面量', fresh: true },
  ])('只改变选中项时仍沿真实 CSS 过渡滑动（$name）', async ({ fresh }) => {
    const items = [apple, banana]
    // 使用方常写 items={[...]}：数组身份每次都变，但结构没变，选中项变化仍要滑动
    const itemsFor = () => (fresh ? [...items] : items)
    const { container, rerender } = await render(<Nav items={itemsFor()} value="a" />)
    await afterPaint()
    const indicator = container.querySelector('nav > span[aria-hidden="true"]') as HTMLElement
    const start = indicator.getBoundingClientRect().top
    const end = page.getByRole('button', { name: 'Banana' }).element().getBoundingClientRect().top
    const sliding = await pauseTransition(
      () => indicator,
      'transform',
      () => rerender(<Nav items={itemsFor()} value="b" />),
    )
    sliding.at(0.25)
    expect(indicator.getBoundingClientRect().top).toBeGreaterThan(start)
    expect(indicator.getBoundingClientRect().top).toBeLessThan(end)
    sliding.play()
    await expect.poll(() => indicator.getBoundingClientRect().top).toBe(end)
  })

  it('nav 区域带读屏名称；当前项 aria-current="page"、选中浅底；点击以 key 调用 onSelect', async () => {
    const onSelect = vi.fn()
    await render(<Controlled onSelect={onSelect} />)
    await expect.element(page.getByRole('navigation', { name: 'Main' })).toBeVisible()
    const inbox = el(page.getByRole('button', { name: 'Inbox 4' }))
    expect(inbox.getAttribute('aria-current')).toBe('page')
    expect(el(navItem('Home')).hasAttribute('aria-current')).toBe(false)
    // 选中浅底由导航里的滑块显示：滑块盖住当前项
    const indicator = document.querySelector('nav > span[aria-hidden="true"]') as HTMLElement
    expect(sameColor(css(indicator).backgroundColor, token('color-fill-selected'))).toBe(true)
    expect(css(indicator).opacity).toBe('1')
    const a = indicator.getBoundingClientRect()
    const b = inbox.getBoundingClientRect()
    expect([a.top, a.left, a.width, a.height]).toEqual([b.top, b.left, b.width, b.height])
    expect(inbox.hasAttribute('data-vl-state')).toBe(true)
    // 分组：标题是列表的名称
    await expect.element(page.getByRole('list', { name: 'Workspace' })).toBeVisible()
    await userEvent.click(navItem('Members'))
    expect(onSelect).toHaveBeenCalledWith('members')
    expect(el(navItem('Members')).getAttribute('aria-current')).toBe('page')
    expect(inbox.hasAttribute('aria-current')).toBe(false)
  })

  it('Tab 按顺序到达各项并跳过禁用项；↑ / ↓ / Home / End 在项之间移动；焦点环向内收', async () => {
    await render(<Controlled />)
    await userEvent.tab()
    expect(focused()).toBe(el(navItem('Home')))
    expectFocusRing(focused() as Element, -2)
    await userEvent.tab()
    expect(focused()).toBe(el(page.getByRole('button', { name: 'Inbox 4' })))
    await userEvent.tab()
    expect(focused()).toBe(el(navItem('Members')))
    await userEvent.tab()
    // 禁用的 Archive 不可聚焦
    expect(focused()).toBe(el(navItem('Settings')))
    await userEvent.keyboard('{ArrowUp}')
    expect(focused()).toBe(el(navItem('Members')))
    await userEvent.keyboard('{ArrowDown}')
    expect(focused()).toBe(el(navItem('Settings')))
    await userEvent.keyboard('{ArrowDown}')
    expect(focused()).toBe(el(navItem('Settings')))
    await userEvent.keyboard('{Home}')
    expect(focused()).toBe(el(navItem('Home')))
    await userEvent.keyboard('{End}')
    expect(focused()).toBe(el(navItem('Settings')))
    // Enter 选择
    await userEvent.keyboard('{Enter}')
    expect(el(navItem('Settings')).getAttribute('aria-current')).toBe('page')
  })

  it('带 href 的项是链接：有 onSelect 时普通点击调用它而不跳转；禁用的链接没有 href', async () => {
    const onSelect = vi.fn()
    const before = location.href
    await render(
      <Nav
        aria-label="Account"
        value="overview"
        onSelect={onSelect}
        items={[
          { key: 'overview', label: 'Overview', href: '#overview' },
          { key: 'billing', label: 'Billing', href: '#billing' },
          { key: 'legacy', label: 'Legacy', href: '#legacy', disabled: true },
        ]}
      />,
    )
    const billing = page.getByRole('link', { name: 'Billing' })
    await expect.element(billing).toHaveAttribute('href', '#billing')
    await expect
      .element(page.getByRole('link', { name: 'Overview' }))
      .toHaveAttribute('aria-current', 'page')
    await userEvent.click(billing)
    expect(onSelect).toHaveBeenCalledWith('billing')
    expect(location.href).toBe(before)
    const legacy = el(page.getByRole('link', { name: 'Legacy' }))
    expect(legacy.hasAttribute('href')).toBe(false)
    expect(legacy.getAttribute('aria-disabled')).toBe('true')
  })

  it('收起：只显示图标，文字仍是读屏名称并在提示中显示；分组标题隐藏但仍是列表名称', async () => {
    await render(<Controlled collapsed />)
    const home = el(navItem('Home'))
    expect(home.getBoundingClientRect().width).toBe(Number.parseFloat(token('control-height-md')))
    const label = [...home.querySelectorAll('span')].find((s) => s.textContent === 'Home')
    expect(label?.getBoundingClientRect().width).toBeLessThanOrEqual(1)
    await expect.element(page.getByRole('list', { name: 'Workspace' })).toBeInTheDocument()
    await userEvent.tab()
    expect(focused()).toBe(home)
    await expect.poll(() => visibleTooltips()).toEqual(['Home'])
  })
})

function Shell(props: {
  collapsed?: boolean
  defaultCollapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
  onSelect?: (key: string) => void
  contained?: boolean
  nested?: boolean
  rail?: boolean
  items?: readonly (NavItem | NavGroup)[]
  initial?: string
}) {
  const [value, setValue] = useState(props.initial ?? 'inbox')
  return (
    <AppShell
      testId="shell"
      rail={props.rail}
      contained={props.contained}
      collapsed={props.collapsed}
      defaultCollapsed={props.defaultCollapsed}
      onCollapsedChange={props.onCollapsedChange}
      header={
        <>
          <AppShell.Toggle testId="toggle" />
          <span>Acme</span>
          <button type="button">Account</button>
        </>
      }
      sidebar={
        <Nav
          items={props.items ?? ITEMS}
          value={value}
          onSelect={(key) => {
            setValue(key)
            props.onSelect?.(key)
          }}
        />
      }
    >
      <h1>Page {value}</h1>
      <div style={{ height: 3000 }}>Long content</div>
      <button type="button">In page</button>
      <Nav aria-label="In page" items={[{ key: 'local', label: 'Local section', icon: 'list' }]} />
      {props.nested && (
        <AppShell contained testId="nested">
          Nested
        </AppShell>
      )}
    </AppShell>
  )
}

/** 窄布局：AppShell 放在 600px 宽的容器中（按自身宽度判断，不是视口）。 */
function Narrow(props: { onSelect?: (key: string) => void }) {
  return (
    <div style={{ width: 600, height: 500 }}>
      <Shell contained onSelect={props.onSelect} />
    </div>
  )
}

const toggle = () => el(page.getByTestId('toggle'))
const sidebarOf = () => document.getElementById(toggle().getAttribute('aria-controls') ?? '')

describe('AppShell', () => {
  it('header / nav / main 区域；占满视口，主内容区单独滚动并带 vl-main（嵌套的不带）', async () => {
    await render(<Shell nested />)
    await expect.element(page.getByRole('banner')).toBeVisible()
    await expect.element(page.getByRole('navigation', { name: 'Main' })).toBeVisible()
    const main = el(page.getByRole('main').first())
    expect(main.tagName).toBe('MAIN')
    const root = el(page.getByTestId('shell'))
    expect(Math.round(root.getBoundingClientRect().height)).toBe(window.innerHeight)
    expect(css(main).overflowY).toBe('auto')
    expect(main.scrollHeight).toBeGreaterThan(main.clientHeight)
    expect(css(main).viewTransitionName).toBe('vl-main')
    const nested = el(page.getByTestId('nested')).querySelector('main') as HTMLElement
    expect(css(nested).viewTransitionName).toBe('none')
    // 页面滚动时侧栏不动：滚动的是主内容区，不是文档
    main.scrollTop = 500
    expect(document.scrollingElement?.scrollTop ?? 0).toBe(0)
    expect(el(navItem('Home')).getBoundingClientRect().top).toBeGreaterThan(0)
  })

  it('跳转链接是第一个可聚焦元素：Tab 时出现，Enter 把焦点移到主内容区且不改地址', async () => {
    const before = location.href
    await render(<Shell />)
    await userEvent.tab()
    const skip = el(page.getByRole('link', { name: 'Skip to content' }))
    expect(focused()).toBe(skip)
    expect(skip.getBoundingClientRect().width).toBeGreaterThan(40)
    expectFocusRing(skip, 2)
    await userEvent.keyboard('{Enter}')
    expect(focused()).toBe(el(page.getByRole('main')))
    expect(location.href).toBe(before)
    // 之后的 Tab 从主内容区继续
    await userEvent.tab()
    expect(focused()).toBe(el(page.getByRole('button', { name: 'In page' })))
  })

  it('跳转链接的文字随 locale', async () => {
    await render(<Shell />, { locale: 'zh-CN' })
    await expect.element(page.getByRole('link', { name: '跳到正文' })).toBeInTheDocument()
    await expect.element(page.getByRole('button', { name: '收起侧栏' })).toBeInTheDocument()
  })

  it('非受控收起：切换按钮收起为图标窄栏并调用 onCollapsedChange，再次点击展开', async () => {
    const onCollapsedChange = vi.fn()
    await render(<Shell onCollapsedChange={onCollapsedChange} />)
    const button = toggle()
    expect(button.getAttribute('aria-label')).toBe('Collapse sidebar')
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(sidebarOf()?.getBoundingClientRect().width).toBe(240)
    await userEvent.click(button)
    expect(onCollapsedChange).toHaveBeenLastCalledWith(true)
    await expect.poll(() => button.getAttribute('aria-label')).toBe('Expand sidebar')
    expect(button.getAttribute('aria-expanded')).toBe('false')
    // 窄栏 = 导航项的正方形 + 两侧内边距；其中的 Nav 跟随收起，文字只给读屏
    const rail =
      Number.parseFloat(token('control-height-md')) + 2 * Number.parseFloat(token('space-3'))
    await expect.poll(() => sidebarOf()?.getBoundingClientRect().width).toBe(rail)
    expect(el(navItem('Home')).getBoundingClientRect().width).toBe(
      Number.parseFloat(token('control-height-md')),
    )
    await userEvent.click(button)
    expect(onCollapsedChange).toHaveBeenLastCalledWith(false)
    await expect.poll(() => sidebarOf()?.getBoundingClientRect().width).toBe(240)
  })

  it('受控收起：切换按钮只调用 onCollapsedChange，由使用方更新 collapsed', async () => {
    const onCollapsedChange = vi.fn()
    const { rerender } = await render(<Shell collapsed onCollapsedChange={onCollapsedChange} />)
    expect(toggle().getAttribute('aria-label')).toBe('Expand sidebar')
    await userEvent.click(toggle())
    expect(onCollapsedChange).toHaveBeenCalledWith(false)
    expect(toggle().getAttribute('aria-label')).toBe('Expand sidebar')
    await rerender(<Shell collapsed={false} onCollapsedChange={onCollapsedChange} />)
    expect(toggle().getAttribute('aria-label')).toBe('Collapse sidebar')
  })

  it('defaultCollapsed：开始时收起', async () => {
    await render(<Shell defaultCollapsed />)
    expect(toggle().getAttribute('aria-label')).toBe('Expand sidebar')
  })

  it('窄布局：侧栏是关闭的抽屉；打开后焦点在当前项并留在抽屉内，Esc 关闭并把焦点还给切换按钮', async () => {
    await render(<Narrow />)
    const button = toggle()
    await expect.poll(() => button.getAttribute('aria-label')).toBe('Open navigation')
    expect(button.getAttribute('aria-expanded')).toBe('false')
    const sidebar = sidebarOf() as HTMLElement
    expect(css(sidebar).visibility).toBe('hidden')
    // 关闭的抽屉不可聚焦：Tab 从跳转链接直接到切换按钮
    await userEvent.tab()
    await userEvent.tab()
    expect(focused()).toBe(button)
    await userEvent.keyboard('{Enter}')
    const dialog = page.getByRole('dialog', { name: 'Navigation' })
    await expect.element(dialog).toBeVisible()
    expect(button.getAttribute('aria-expanded')).toBe('true')
    // 抽屉里的 Nav 是展开的
    await expect.poll(() => focused()).toBe(el(page.getByRole('button', { name: 'Inbox 4' })))
    expect(
      el(page.getByRole('button', { name: 'Inbox 4' })).getBoundingClientRect().width,
    ).toBeGreaterThan(100)
    // 顶栏与主内容区不可操作
    expect(el(page.getByRole('main')).inert).toBe(true)
    // 焦点留在抽屉内
    for (let i = 0; i < 5; i++) await userEvent.tab()
    expect(sidebar.contains(focused())).toBe(true)
    await userEvent.keyboard('{Escape}')
    await expect.element(dialog).not.toBeInTheDocument()
    expect(focused()).toBe(button)
    await expect.poll(() => css(sidebar).visibility).toBe('hidden')
  })

  it('窄布局：选择一项后关闭抽屉；点击抽屉外部也关闭', async () => {
    const onSelect = vi.fn()
    await render(<Narrow onSelect={onSelect} />)
    await expect.poll(() => toggle().getAttribute('aria-label')).toBe('Open navigation')
    await userEvent.click(toggle())
    const dialog = page.getByRole('dialog', { name: 'Navigation' })
    await expect.element(dialog).toBeVisible()
    await userEvent.click(dialog.getByRole('button', { name: 'Members' }))
    expect(onSelect).toHaveBeenCalledWith('members')
    await expect.element(dialog).not.toBeInTheDocument()
    await expect.element(page.getByRole('heading', { name: 'Page members' })).toBeVisible()

    await userEvent.click(toggle())
    await expect.element(dialog).toBeVisible()
    // 点击抽屉右侧的遮罩
    const box = (sidebarOf() as HTMLElement).getBoundingClientRect()
    const scrim = document.elementFromPoint(box.right + 40, box.top + 200) as HTMLElement
    await userEvent.click(scrim)
    await expect.element(dialog).not.toBeInTheDocument()
  })
  it('rail={false}：收起即隐藏侧栏（宽度为 0、不可聚焦）', async () => {
    await render(<Shell rail={false} />)
    await userEvent.click(toggle())
    await expect.poll(() => sidebarOf()?.getBoundingClientRect().width).toBe(0)
    expect(css(sidebarOf() as HTMLElement).visibility).toBe('hidden')
    await userEvent.click(toggle())
    await expect.poll(() => sidebarOf()?.getBoundingClientRect().width).toBe(240)
  })

  it('只有侧栏中的 Nav 跟随收起；主内容区中的 Nav 不受影响', async () => {
    await render(<Shell defaultCollapsed />)
    expect(el(navItem('Home')).getBoundingClientRect().width).toBe(
      Number.parseFloat(token('control-height-md')),
    )
    expect(el(navItem('Local section')).getBoundingClientRect().width).toBeGreaterThan(100)
  })

  it('侧栏把当前项滚到可见处；页面中的 Nav 不滚动主内容区', async () => {
    const many: NavItem[] = Array.from({ length: 60 }, (_, i) => ({
      key: `p${i}`,
      label: `Page ${i}`,
      icon: 'file-text',
    }))
    await render(<Shell items={many} initial="p55" />)
    const sidebar = sidebarOf() as HTMLElement
    expect(sidebar.scrollTop).toBeGreaterThan(0)
    const box = el(navItem('Page 55')).getBoundingClientRect()
    const view = sidebar.getBoundingClientRect()
    expect(box.top).toBeGreaterThanOrEqual(view.top)
    expect(box.bottom).toBeLessThanOrEqual(view.bottom)
    // 主内容区中的 Nav（在长内容之后）没有把主内容区滚走
    expect(el(page.getByRole('main').first()).scrollTop).toBe(0)
  })
})

describe('AppShell 窄布局抽屉的进出场', () => {
  const root = document.documentElement
  afterEach(() => {
    root.style.removeProperty('--vl-motion-duration-base')
    root.style.removeProperty('--vl-motion-duration-slow')
  })
  /** 抽屉的遮罩：侧栏前面带 aria-hidden 的元素（只在打开时、以及关闭后淡出的过程中存在） */
  const scrimOf = () => {
    const prev = sidebarOf()?.previousElementSibling
    return prev?.getAttribute('aria-hidden') === 'true' ? (prev as HTMLElement) : null
  }
  const opacityOf = (el: Element) => Number(css(el).opacity)
  const dialog = () => page.getByRole('dialog', { name: 'Navigation' })
  const openDrawer = async () => {
    await expect.poll(() => toggle().getAttribute('aria-label')).toBe('Open navigation')
    await userEvent.click(toggle())
    await expect.element(dialog()).toBeVisible()
  }
  /** 放慢离场（exit-slow = base）与进场（slow）：暂停的过渡检查完之前，兜底定时器不会卸载遮罩 */
  const slowDown = () => {
    root.style.setProperty('--vl-motion-duration-base', '10000ms')
    root.style.setProperty('--vl-motion-duration-slow', '10000ms')
  }

  it('面板关闭时比打开时快：离场用 exit-slow，进场用 slow', async () => {
    await render(<Narrow />)
    await expect.poll(() => toggle().getAttribute('aria-label')).toBe('Open navigation')
    const sidebar = sidebarOf() as HTMLElement
    const closing = transitionOf(sidebar, 'transform')
    await openDrawer()
    const opening = transitionOf(sidebar, 'transform')
    expect(opening).toBe(ms(token('motion-duration-slow')))
    expect(closing).toBe(ms(token('motion-duration-exit-slow')))
    expect(closing).toBeLessThan(opening ?? 0)
  })

  it('关闭时遮罩淡出（不再接收点击），淡出结束后才卸载', async () => {
    await render(<Narrow />)
    await openDrawer()
    const scrim = scrimOf() as HTMLElement
    await expect.poll(() => opacityOf(scrim)).toBe(1)
    slowDown()
    const fading = await pauseTransition(scrimOf, 'opacity', () => userEvent.keyboard('{Escape}'))
    fading.at(0.5)
    await expect.element(dialog()).not.toBeInTheDocument()
    expect(scrimOf(), '关闭后遮罩还在，正在淡出').toBe(scrim)
    expect(opacityOf(scrim)).toBeGreaterThan(0.05)
    expect(opacityOf(scrim)).toBeLessThan(0.95)
    expect(css(scrim).pointerEvents, '淡出中不接收点击').toBe('none')
    fading.at(0.99)
    fading.play()
    await expect.poll(() => scrimOf(), { timeout: 3000 }).toBeNull()
  })

  it('遮罩淡出途中再次打开：从当前的透明度折返，不从透明重新开始', async () => {
    await render(<Narrow />)
    await openDrawer()
    const scrim = scrimOf() as HTMLElement
    await expect.poll(() => opacityOf(scrim)).toBe(1)
    slowDown()
    const fading = await pauseTransition(scrimOf, 'opacity', () => userEvent.keyboard('{Escape}'))
    fading.at(0.5)
    const faded = opacityOf(scrim)
    // 关闭后焦点回到切换按钮；滑出中的侧栏还盖在它上面，用键盘再次打开
    await expect.poll(() => focused()).toBe(toggle())
    const back = await pauseTransition(scrimOf, 'opacity', () => userEvent.keyboard('{Enter}'))
    back.at(0)
    expect(scrimOf(), '同一个遮罩，没有重新挂载').toBe(scrim)
    expect(opacityOf(scrim), '从淡出途中的透明度折返').toBeCloseTo(faded, 2)
    back.at(0.5)
    expect(opacityOf(scrim)).toBeGreaterThan(faded)
    expect(css(scrim).pointerEvents).toBe('auto')
    back.at(0.99)
    back.play()
    await expect.poll(() => opacityOf(scrim), { timeout: 3000 }).toBe(1)
  })

  it('「减少动态效果」时遮罩立即出现，关闭后立即卸载', async () => {
    await render(<Narrow />, { reducedMotion: true })
    await openDrawer()
    const scrim = scrimOf() as HTMLElement
    expect(opacityOf(scrim)).toBe(1)
    await userEvent.keyboard('{Escape}')
    await expect.element(dialog()).not.toBeInTheDocument()
    await afterPaint()
    expect(scrimOf()).toBeNull()
  })
})

describe('AppShell 宽布局收起、展开的动效', () => {
  const root = document.documentElement
  afterEach(() => {
    root.style.removeProperty('--vl-motion-duration-slow')
  })
  /** 放慢过渡：暂停的过渡检查完之前，兜底定时器不会把它清理掉 */
  const slowDown = () => root.style.setProperty('--vl-motion-duration-slow', '10000ms')
  const mainOf = () => el(page.getByTestId('shell')).querySelector('main') as HTMLElement
  const frameOf = () => sidebarOf()?.parentElement as HTMLElement
  /** 主内容区内容的起始边（含进行中的 translate）。 */
  const contentLeft = () =>
    mainOf().getBoundingClientRect().left + Number.parseFloat(css(mainOf()).paddingLeft)
  const transitionsOf = (target: Element | null | undefined, property: string) =>
    (target?.getAnimations() ?? []).filter(
      (a): a is CSSTransition => a instanceof CSSTransition && a.transitionProperty === property,
    )
  const railWidth = () =>
    Number.parseFloat(token('control-height-md')) + 2 * Number.parseFloat(token('space-3'))
  /** 点击切换按钮，暂停主内容区的 translate 与侧栏的 clip-path 过渡，可以按进度同时定位。 */
  const toggleAndPause = async () => {
    await userEvent.click(toggle())
    await expect.poll(() => transitionsOf(mainOf(), 'translate').length).toBe(1)
    const all = [
      ...transitionsOf(mainOf(), 'translate'),
      ...transitionsOf(sidebarOf(), 'clip-path'),
    ]
    for (const a of all) a.pause()
    return {
      clips: all.length - 1,
      at(progress: number) {
        for (const a of all)
          a.currentTime = Number(a.effect?.getComputedTiming().endTime) * progress
      },
      async finish() {
        for (const a of all) a.currentTime = Number(a.effect?.getComputedTiming().endTime) * 0.99
        for (const a of all) a.play()
        await expect
          .poll(() => frameOf().hasAttribute('data-moving'), { timeout: 3000 })
          .toBe(false)
      },
    }
  }
  /** 静止时没有任何动效留下的样式。 */
  const expectAtRest = () => {
    expect(frameOf().hasAttribute('data-moving')).toBe(false)
    expect(mainOf().style.translate).toBe('')
    expect(css(mainOf()).translate).toBe('none')
    expect(css(sidebarOf() as HTMLElement).clipPath).toBe('none')
  }

  it('收起：列一步到位，主内容区从原来的位置沿弹簧滑到新位置；结束后不留下任何样式', async () => {
    await render(<Shell />)
    const expanded = contentLeft()
    slowDown()
    const motion = await toggleAndPause()
    motion.at(0)
    // 侧栏的列已经是窄栏的宽度，网格不再逐帧过渡
    expect(sidebarOf()?.getBoundingClientRect().width).toBe(railWidth())
    expect(transitionsOf(frameOf(), 'grid-template-columns')).toHaveLength(0)
    // 时长与曲线都来自令牌：较慢过渡的时长与弹簧曲线
    expect(transitionOf(mainOf(), 'translate')).toBe(10000)
    expect(sameEasing(css(mainOf()).transitionTimingFunction, token('motion-ease-spring'))).toBe(
      true,
    )
    expect(contentLeft(), '起点：主内容看起来还在原来的位置').toBeCloseTo(expanded, 1)
    expect(motion.clips, '收起时侧栏不剪切').toBe(0)
    motion.at(0.5)
    const target = expanded - (240 - railWidth())
    expect(contentLeft()).toBeLessThan(expanded - 10)
    expect(contentLeft()).toBeGreaterThan(target + 10)
    await motion.finish()
    expectAtRest()
    expect(contentLeft()).toBeCloseTo(target, 1)
  })

  it('展开：侧栏新出现的文字先被剪掉，与主内容区的边同步揭开', async () => {
    await render(<Shell defaultCollapsed />)
    const collapsed = contentLeft()
    slowDown()
    const motion = await toggleAndPause()
    expect(motion.clips).toBe(1)
    const sidebar = sidebarOf() as HTMLElement
    /** 侧栏看得见的右边（减去 clip-path 剪掉的部分）应正好接上主内容区的左边。 */
    const visibleRight = () => {
      const inset = /inset\(\s*\S+\s+(\S+)/.exec(css(sidebar).clipPath)?.[1] ?? '0px'
      return sidebar.getBoundingClientRect().right - Number.parseFloat(inset)
    }
    for (const progress of [0, 0.3, 0.7]) {
      motion.at(progress)
      expect(sidebar.getBoundingClientRect().width).toBe(240)
      expect(visibleRight(), `进度 ${progress}`).toBeCloseTo(
        mainOf().getBoundingClientRect().left,
        1,
      )
    }
    motion.at(0)
    expect(contentLeft()).toBeCloseTo(collapsed, 1)
    await motion.finish()
    expectAtRest()
    expect(contentLeft()).toBeCloseTo(collapsed + 240 - railWidth(), 1)
  })

  it('收起到一半又展开：从当前看到的位置折返，不跳回起点或终点', async () => {
    await render(<Shell />)
    const expanded = contentLeft()
    slowDown()
    const collapsing = await toggleAndPause()
    collapsing.at(0.5)
    const halfway = contentLeft()
    expect(halfway).toBeLessThan(expanded - 10)
    const back = await toggleAndPause()
    back.at(0)
    expect(contentLeft(), '从半路折返').toBeCloseTo(halfway, 1)
    back.at(0.5)
    expect(contentLeft()).toBeGreaterThan(halfway)
    await back.finish()
    expectAtRest()
    expect(contentLeft()).toBeCloseTo(expanded, 1)
  })

  it('「减少动态效果」时立即到位：没有过渡，也不留下样式', async () => {
    await render(<Shell />, { reducedMotion: true })
    const expanded = contentLeft()
    await userEvent.click(toggle())
    await afterPaint()
    expect(transitionsOf(mainOf(), 'translate')).toHaveLength(0)
    expectAtRest()
    expect(contentLeft()).toBeCloseTo(expanded - (240 - railWidth()), 1)
  })

  it('收起、展开的过程中主内容区只改变一次尺寸：其中的 ResizeObserver 不逐帧触发', async () => {
    await render(<Shell />)
    const content = page.getByText('Long content').element()
    let calls = 0
    const observer = new ResizeObserver(() => {
      calls++
    })
    observer.observe(content)
    await afterPaint()
    calls = 0
    for (const step of ['collapse', 'expand']) {
      await userEvent.click(toggle())
      // 等过渡走完（原来逐帧过渡列宽时，这段时间里每帧回调一次）
      await new Promise((resolve) => setTimeout(resolve, ms(token('motion-duration-slow')) + 150))
      expect({ step, calls }).toEqual({ step, calls: 1 })
      calls = 0
    }
    observer.disconnect()
  })
})
