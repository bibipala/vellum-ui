/**
 * 选择类组件在真实浏览器中的键盘与选中指示（docs/11 §6.2「键盘」「选中指示」「不跳」）：
 * Tabs / Segmented / Radio / Checkbox / Switch 的方向键、空格、Enter；选中指示滑动（200ms）；Tabs 选中后相邻项不移位。
 * ListItem：可点击时 Enter / 空格激活，焦点环向内收。
 */
import { describe, expect, it, vi } from 'vitest'
import { Checkbox, IconButton, ListItem, Radio, Segmented, Switch, Tabs } from '../../src/index.ts'
import {
  css,
  expectFocusRing,
  expectNoFocusRing,
  focused,
  ms,
  page,
  press,
  pseudo,
  render,
  token,
  transitionOf,
  userEvent,
} from './render.tsx'

/** 选中指示滑动的时长（motion-duration-base，200ms）。令牌在 ThemeProvider 渲染后才写入，用时再读。 */
const base = () => ms(token('motion-duration-base'))

describe('Tabs', () => {
  const items = [
    { key: 'overview', label: 'Overview', children: 'Overview panel' },
    { key: 'members', label: 'Members', children: 'Members panel' },
    { key: 'settings', label: 'Settings', children: 'Settings panel' },
  ]

  it('Tab 聚焦当前标签并显示焦点环；← / → 移动焦点不切换，Enter / 空格切换', async () => {
    const onChange = vi.fn()
    await render(<Tabs items={items} onChange={onChange} />)
    await userEvent.tab()
    const overview = page.getByRole('tab', { name: /Overview/ }).element()
    expect(focused()).toBe(overview)
    expectFocusRing(overview, 2)
    await userEvent.keyboard('{ArrowRight}')
    expect(focused()).toBe(page.getByRole('tab', { name: /Members/ }).element())
    expect(onChange).not.toHaveBeenCalled()
    await userEvent.keyboard('{Enter}')
    expect(onChange).toHaveBeenLastCalledWith('members')
    await expect
      .element(page.getByRole('tab', { name: /Members/ }))
      .toHaveAttribute('aria-selected', 'true')
    await userEvent.keyboard('{ArrowRight}')
    await userEvent.keyboard(' ')
    expect(onChange).toHaveBeenLastCalledWith('settings')
    await expect.element(page.getByRole('tabpanel')).toHaveTextContent('Settings panel')
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(focused()).toBe(overview)
  })

  it('受控：显示 activeKey，切换只调用 onChange；父组件更新 activeKey 后才切换（也可以由外部切换）', async () => {
    const onChange = vi.fn()
    const { rerender } = await render(
      <Tabs items={items} activeKey="members" onChange={onChange} />,
    )
    const selected = () => page.getByRole('tab', { selected: true }).element().textContent
    expect(selected()).toBe('Members')
    await userEvent.click(page.getByRole('tab', { name: /Settings/ }))
    expect(onChange).toHaveBeenLastCalledWith('settings')
    // 父组件没有更新 activeKey：仍是 Members
    expect(selected()).toBe('Members')
    await expect.element(page.getByRole('tabpanel')).toHaveTextContent('Members panel')
    await rerender(<Tabs items={items} activeKey="settings" onChange={onChange} />)
    expect(selected()).toBe('Settings')
    await expect.element(page.getByRole('tabpanel')).toHaveTextContent('Settings panel')
    // 外部切换（如 URL 变化）不调用 onChange
    onChange.mockClear()
    await rerender(<Tabs items={items} activeKey="overview" onChange={onChange} />)
    expect(selected()).toBe('Overview')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('选中下划线在标签之间滑动：left / width 过渡 200ms、标准曲线', async () => {
    await render(<Tabs items={items} />)
    const ink = document.querySelector('.ant-tabs-ink-bar') as HTMLElement
    for (const prop of ['left', 'width']) expect(transitionOf(ink, prop), prop).toBe(base())
    expect(css(ink).transitionTimingFunction).toBe(token('motion-ease-standard'))
    const before = ink.getBoundingClientRect().left
    await userEvent.click(page.getByRole('tab', { name: /Settings/ }))
    await expect.poll(() => ink.getBoundingClientRect().left).toBeGreaterThan(before + 50)
    const settings = page.getByRole('tab', { name: /Settings/ }).element()
    await expect
      .poll(() =>
        Math.abs(ink.getBoundingClientRect().width - settings.getBoundingClientRect().width),
      )
      .toBeLessThan(1)
  })

  it('选中后各标签的位置与宽度不变（选中只变色、不加粗）', async () => {
    await render(<Tabs items={items} />)
    const rects = () =>
      page
        .getByRole('tab')
        .elements()
        .map((el) => {
          const r = el.getBoundingClientRect()
          return [Math.round(r.left * 10) / 10, Math.round(r.width * 10) / 10]
        })
    const before = rects()
    const weight = css(page.getByRole('tab', { name: /Members/ }).element()).fontWeight
    await userEvent.click(page.getByRole('tab', { name: /Members/ }))
    await expect
      .element(page.getByRole('tab', { name: /Members/ }))
      .toHaveAttribute('aria-selected', 'true')
    expect(rects()).toEqual(before)
    expect(css(page.getByRole('tab', { name: /Members/ }).element()).fontWeight).toBe(weight)
  })
})

describe('Segmented', () => {
  it('Tab 直接落到当前选项上；← / → 切换选项；键盘焦点显示焦点环', async () => {
    const onChange = vi.fn()
    await render(
      <>
        <input aria-label="Before" />
        <Segmented options={['List', 'Grid', 'Board']} onChange={onChange} />
      </>,
    )
    await userEvent.click(page.getByRole('textbox', { name: 'Before' }))
    await userEvent.tab()
    const list = page.getByRole('radio', { name: 'List' }).element()
    expect(focused()).toBe(list)
    expectFocusRing(list.closest('.ant-segmented-item') as Element, 2)
    await userEvent.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenLastCalledWith('Grid')
    expect(focused()).toBe(page.getByRole('radio', { name: 'Grid' }).element())
    await userEvent.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenLastCalledWith('Board')
    await userEvent.keyboard('{ArrowLeft}')
    expect(onChange).toHaveBeenLastCalledWith('Grid')
  })

  it('选中滑块在选项之间滑动（transform 与 width 过渡 200ms），选项宽度不变', async () => {
    await render(<Segmented options={['List', 'Grid', 'Board']} />)
    const items = () =>
      [...document.querySelectorAll('.ant-segmented-item')].map((el) =>
        Math.round(el.getBoundingClientRect().width * 10),
      )
    const widths = items()
    await userEvent.click(page.getByText('Board'))
    // antd 在滑动期间显示滑块（准备阶段之后进入 -active 阶段，开始过渡），滑动结束后移除
    const thumb = await vi.waitUntil(
      () => document.querySelector<HTMLElement>('.ant-segmented-thumb[class*="-active"]'),
      { timeout: 1000, interval: 5 },
    )
    expect(transitionOf(thumb, 'transform')).toBe(base())
    expect(transitionOf(thumb, 'width')).toBe(base())
    await expect.poll(() => document.querySelector('.ant-segmented-thumb')).toBeNull()
    expect(document.querySelector('.ant-segmented-item-selected')?.textContent).toBe('Board')
    expect(items()).toEqual(widths)
  })
})

describe('Radio', () => {
  it('Tab 落到选中项上并显示焦点环；↓ / → 选中下一项，↑ / ← 选中上一项', async () => {
    const onChange = vi.fn()
    await render(
      <Radio.Group
        options={[
          { value: 'read', label: 'Read' },
          { value: 'write', label: 'Write' },
          { value: 'admin', label: 'Admin' },
        ]}
        defaultValue="write"
        onChange={onChange}
      />,
    )
    await userEvent.tab()
    const write = page.getByRole('radio', { name: 'Write' }).element()
    expect(focused()).toBe(write)
    expectFocusRing(write.closest('.ant-radio') as Element, 2)
    await userEvent.keyboard('{ArrowDown}')
    expect(onChange).toHaveBeenLastCalledWith('admin')
    await userEvent.keyboard('{ArrowUp}{ArrowLeft}')
    expect(onChange).toHaveBeenLastCalledWith('read')
    await expect.element(page.getByRole('radio', { name: 'Read' })).toBeChecked()
  })

  it('选中圆点有过渡（不是瞬间出现），鼠标点击不显示焦点环', async () => {
    await render(<Radio.Group options={['Read', 'Write']} />)
    const write = page.getByRole('radio', { name: 'Write' })
    await userEvent.click(page.getByText('Write'))
    await expect.element(write).toBeChecked()
    expectNoFocusRing(write.element().closest('.ant-radio') as Element)
    // antd 6 的单选圆点画在 .ant-radio::after 上
    const radio = write.element().closest('.ant-radio') as Element
    expect(ms(css(radio).transitionDuration)).toBeGreaterThan(0)
    expect(ms(pseudo(radio, '::after').transitionDuration)).toBeGreaterThan(0)
  })
})

describe('Checkbox', () => {
  it('Tab 聚焦显示焦点环，空格勾选与取消；勾选标记有过渡', async () => {
    const onChange = vi.fn()
    await render(<Checkbox onChange={(checked) => onChange(checked)}>Notify me</Checkbox>)
    await userEvent.tab()
    const box = page.getByRole('checkbox', { name: 'Notify me' }).element()
    expect(focused()).toBe(box)
    expectFocusRing(box.closest('.ant-checkbox') as Element, 2)
    await userEvent.keyboard(' ')
    expect(onChange).toHaveBeenLastCalledWith(true)
    await userEvent.keyboard(' ')
    expect(onChange).toHaveBeenLastCalledWith(false)
    // antd 6 的勾选标记画在 .ant-checkbox::after 上：勾选时有过渡，不是瞬间出现
    const mark = box.closest('.ant-checkbox') as Element
    await userEvent.keyboard(' ')
    expect(pseudo(mark, '::after').transitionProperty).toMatch(/all|transform/)
    expect(ms(pseudo(mark, '::after').transitionDuration)).toBeGreaterThan(0)
  })

  it('Checkbox.Group：Tab 逐项聚焦，空格切换', async () => {
    const onChange = vi.fn()
    await render(<Checkbox.Group options={['Read', 'Write']} onChange={onChange} />)
    await userEvent.tab()
    await userEvent.keyboard(' ')
    await userEvent.tab()
    await userEvent.keyboard(' ')
    expect(onChange).toHaveBeenLastCalledWith(['Read', 'Write'])
  })
})

describe('Switch', () => {
  it('onClick 收到点击事件（不是 rc-switch 传的勾选状态）', async () => {
    const onClick = vi.fn()
    await render(<Switch aria-label="Enabled" onClick={onClick} />)
    await userEvent.click(page.getByRole('switch', { name: 'Enabled' }))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onClick.mock.lastCall?.[0]?.type).toBe('click')
  })

  it('Tab 聚焦显示焦点环，空格与 Enter 切换；滑块有过渡', async () => {
    const onChange = vi.fn()
    await render(<Switch aria-label="Enabled" onChange={onChange} />)
    await userEvent.tab()
    const sw = page.getByRole('switch', { name: 'Enabled' }).element()
    expect(focused()).toBe(sw)
    expectFocusRing(sw, 2)
    await userEvent.keyboard(' ')
    expect(onChange).toHaveBeenLastCalledWith(true)
    await userEvent.keyboard('{Enter}')
    expect(onChange).toHaveBeenLastCalledWith(false)
    const handle = sw.querySelector('.ant-switch-handle') as Element
    expect(ms(css(handle).transitionDuration)).toBeGreaterThan(0)
    await expect.element(page.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })
})

describe('ListItem', () => {
  it('可点击时 Tab 聚焦，焦点环画在整行上、向内收 2px；Enter 与空格激活', async () => {
    const onClick = vi.fn()
    await render(<ListItem title="Lin Xiao" description="Design" onClick={onClick} />)
    await userEvent.tab()
    const hit = page.getByRole('button', { name: /Lin Xiao/ }).element()
    expect(focused()).toBe(hit)
    const row = hit.parentElement as HTMLElement
    expectFocusRing(row, -2)
    expectNoFocusRing(hit)
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard(' ')
    expect(onClick).toHaveBeenCalledTimes(2)
  })

  it('鼠标点击不显示焦点环；悬停、按下叠加状态层', async () => {
    const onClick = vi.fn()
    await render(<ListItem title="Lin Xiao" onClick={onClick} />)
    const hit = page.getByRole('button', { name: /Lin Xiao/ }).element()
    const row = hit.parentElement as HTMLElement
    await userEvent.hover(hit)
    await expect
      .poll(() => Number(pseudo(row, '::before').opacity))
      .toBeCloseTo(Number(token('state-hover-opacity')), 3)
    const release = await press(hit)
    await expect
      .poll(() => Number(pseudo(row, '::before').opacity))
      .toBeCloseTo(Number(token('state-press-opacity')), 3)
    await release()
    expect(onClick).toHaveBeenCalledOnce()
    expectNoFocusRing(row)
  })

  it('actionsOnHover：操作在悬停或键盘焦点进入该行时出现；按下行内操作时整行保持悬停、不跟着变深', async () => {
    const onEdit = vi.fn()
    await render(
      <ListItem
        title="Lin Xiao"
        onClick={() => {}}
        actionsOnHover
        actions={<IconButton icon="edit" label="Edit" tooltip={false} onClick={onEdit} />}
      />,
    )
    const hit = page.getByRole('button', { name: /Lin Xiao/ }).element()
    const row = hit.parentElement as HTMLElement
    const actions = page.getByRole('button', { name: 'Edit' }).element()
      .parentElement as HTMLElement
    expect(css(actions).opacity).toBe('0')
    await userEvent.tab()
    await expect.poll(() => css(actions).opacity).toBe('1')
    await userEvent.tab()
    expect(focused()).toBe(page.getByRole('button', { name: 'Edit' }).element())
    ;(focused() as HTMLElement).blur()
    await expect.poll(() => css(actions).opacity).toBe('0')
    const edit = page.getByRole('button', { name: 'Edit' }).element()
    const release = await press(edit)
    await expect.poll(() => css(actions).opacity).toBe('1')
    await expect
      .poll(() => Number(pseudo(row, '::before').opacity))
      .toBeCloseTo(Number(token('state-hover-opacity')), 3)
    await release()
    expect(onEdit).toHaveBeenCalledOnce()
  })

  it('不可点击时只是展示行：没有按钮、没有状态层', async () => {
    const { container } = await render(<ListItem title="Lin Xiao" />)
    expect(container.querySelector('button')).toBeNull()
    expect(container.querySelector('[data-vl-state]')).toBeNull()
  })
})
