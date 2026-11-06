/**
 * 弹出类组件在真实浏览器中的键盘与时序（docs/11 §6.2「键盘」「弹层」）：
 * Select / TreeSelect / DatePicker / Dropdown / Popconfirm 用键盘打开、方向键选择、Esc 关闭，
 * 关闭后焦点回到触发元素；Tooltip 延迟 500ms 出现，连续悬停时立即切换。
 */
import { describe, expect, it, vi } from 'vitest'
import {
  Button,
  DatePicker,
  Dropdown,
  IconButton,
  Popconfirm,
  Select,
  Tooltip,
  TreeSelect,
} from '../../src/index.ts'
import {
  clock,
  isOpen,
  page,
  parkPointer,
  render,
  settle,
  useFakeTimers,
  userEvent,
  visibleTooltips,
} from './render.tsx'

const fruits = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
]

describe('Select', () => {
  it('Tab 聚焦，方向键打开并移动高亮，Enter 选中并关闭，焦点留在选择器上', async () => {
    const onChange = vi.fn()
    await render(<Select aria-label="Fruit" options={fruits} onChange={onChange} />)
    await userEvent.tab()
    const input = page.getByRole('combobox', { name: 'Fruit' }).element()
    expect(document.activeElement).toBe(input)
    await userEvent.keyboard('{ArrowDown}')
    await expect.poll(() => isOpen('.ant-select-dropdown')).toBe(true)
    expect(input.getAttribute('aria-expanded')).toBe('true')
    const active = () => document.querySelector('.ant-select-item-option-active')?.textContent
    await expect.poll(active).toBe('Apple')
    await userEvent.keyboard('{ArrowDown}')
    await expect.poll(active).toBe('Banana')
    await userEvent.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith('banana')
    await expect.poll(() => isOpen('.ant-select-dropdown')).toBe(false)
    expect(document.activeElement).toBe(input)
  })

  it('allowClear：清除后 onChange 收到 null（「没有值」与 DatePicker、InputNumber 一致）', async () => {
    const onChange = vi.fn()
    await render(
      <Select
        aria-label="Fruit"
        options={fruits}
        defaultValue="apple"
        allowClear
        onChange={onChange}
      />,
    )
    await userEvent.hover(page.getByRole('combobox', { name: 'Fruit' }))
    const clear = document.querySelector('.ant-select-clear') as HTMLElement
    await userEvent.click(clear)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('Esc 关闭，不改变取值，焦点留在选择器上', async () => {
    const onChange = vi.fn()
    await render(<Select aria-label="Fruit" options={fruits} onChange={onChange} />)
    await userEvent.tab()
    await userEvent.keyboard('{ArrowDown}')
    await expect.poll(() => isOpen('.ant-select-dropdown')).toBe(true)
    await userEvent.keyboard('{ArrowDown}')
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => isOpen('.ant-select-dropdown')).toBe(false)
    expect(onChange).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(page.getByRole('combobox', { name: 'Fruit' }).element())
  })
})

describe('TreeSelect', () => {
  const tree = [
    {
      value: 'eng',
      title: 'Engineering',
      children: [{ value: 'frontend', title: 'Frontend' }],
    },
    { value: 'ops', title: 'Operations' },
  ]

  it('方向键打开并在节点间移动，Enter 选中并关闭；Esc 关闭；焦点始终在选择器上', async () => {
    const onChange = vi.fn()
    await render(
      <TreeSelect aria-label="Team" defaultExpandAll options={tree} onChange={onChange} />,
    )
    await userEvent.tab()
    const input = page.getByRole('combobox', { name: 'Team' }).element()
    expect(document.activeElement).toBe(input)
    await userEvent.keyboard('{ArrowDown}')
    await expect.poll(() => isOpen('.ant-tree-select-dropdown')).toBe(true)
    const active = () => document.querySelector('.ant-select-tree-treenode-active')?.textContent
    await expect.poll(active).toBe('Engineering')
    await userEvent.keyboard('{ArrowDown}')
    await expect.poll(active).toBe('Frontend')
    await userEvent.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith('frontend')
    await expect.poll(() => isOpen('.ant-tree-select-dropdown')).toBe(false)
    expect(document.activeElement).toBe(input)

    await userEvent.keyboard('{ArrowDown}')
    await expect.poll(() => isOpen('.ant-tree-select-dropdown')).toBe(true)
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => isOpen('.ant-tree-select-dropdown')).toBe(false)
    expect(document.activeElement).toBe(input)
  })
})

describe('DatePicker', () => {
  it('Tab 聚焦后 Enter 打开面板；键入日期按 Enter 选中并关闭；Esc 关闭；焦点留在输入框上', async () => {
    const picked: string[] = []
    await render(
      <DatePicker
        aria-label="Due date"
        format="YYYY-MM-DD"
        onChange={(d) => picked.push(d ?? '')}
      />,
    )
    await userEvent.tab()
    const input = page.getByRole('textbox', { name: 'Due date' }).element()
    expect(document.activeElement).toBe(input)
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => isOpen('.ant-picker-dropdown')).toBe(true)
    await userEvent.keyboard('2026-03-14')
    await userEvent.keyboard('{Enter}')
    expect(picked).toEqual(['2026-03-14'])
    await expect.poll(() => isOpen('.ant-picker-dropdown')).toBe(false)
    expect(document.activeElement).toBe(input)

    await userEvent.keyboard('{Enter}')
    await expect.poll(() => isOpen('.ant-picker-dropdown')).toBe(true)
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => isOpen('.ant-picker-dropdown')).toBe(false)
    expect(document.activeElement).toBe(input)
    expect(picked).toEqual(['2026-03-14'])
  })
})

describe('Dropdown', () => {
  const menu = {
    items: [
      { key: 'edit', label: 'Edit' },
      { key: 'archive', label: 'Archive' },
      { key: 'delete', label: 'Delete', danger: true },
    ],
  }
  const focusedItem = () =>
    document.activeElement?.getAttribute('role') === 'menuitem'
      ? document.activeElement.textContent
      : undefined

  it('点击触发：Enter 打开后焦点进入菜单，方向键移动，Enter 执行并关闭，焦点回到触发按钮', async () => {
    const onClick = vi.fn()
    await render(
      <Dropdown trigger={['click']} menu={{ ...menu, onClick: (i) => onClick(i.key) }}>
        <Button>More</Button>
      </Dropdown>,
    )
    await userEvent.tab()
    const trigger = page.getByRole('button', { name: 'More' }).element()
    expect(document.activeElement).toBe(trigger)
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => isOpen('.ant-dropdown')).toBe(true)
    await expect.poll(focusedItem).toBe('Edit')
    await userEvent.keyboard('{ArrowDown}')
    await expect.poll(focusedItem).toBe('Archive')
    await userEvent.keyboard('{ArrowUp}')
    await expect.poll(focusedItem).toBe('Edit')
    await userEvent.keyboard('{ArrowDown}')
    await userEvent.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalledWith('archive')
    await expect.poll(() => isOpen('.ant-dropdown')).toBe(false)
    expect(document.activeElement).toBe(trigger)
  })

  it('Esc 关闭，焦点回到触发按钮（IconButton 作为触发元素）', async () => {
    await render(
      <Dropdown trigger={['click']} menu={menu}>
        <IconButton icon="more" label="More actions" tooltip={false} />
      </Dropdown>,
    )
    await userEvent.tab()
    const trigger = page.getByRole('button', { name: 'More actions' }).element()
    await userEvent.keyboard(' ')
    await expect.poll(focusedItem).toBe('Edit')
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => isOpen('.ant-dropdown')).toBe(false)
    expect(document.activeElement).toBe(trigger)
  })

  it('鼠标点开、在页面其他位置点击关闭时，焦点不被拉回触发按钮', async () => {
    await render(
      <>
        <input aria-label="Elsewhere" />
        <Dropdown trigger={['click']} menu={menu}>
          <Button>More</Button>
        </Dropdown>
      </>,
    )
    await userEvent.click(page.getByRole('button', { name: 'More' }))
    await expect.poll(() => isOpen('.ant-dropdown')).toBe(true)
    const elsewhere = page.getByRole('textbox', { name: 'Elsewhere' }).element()
    await userEvent.click(elsewhere)
    await expect.poll(() => isOpen('.ant-dropdown')).toBe(false)
    expect(document.activeElement).toBe(elsewhere)
  })
})

describe('Popconfirm', () => {
  it('Enter 打开后焦点在「取消」上，Tab 移到「确认」，Enter 确认并关闭，焦点回到触发按钮', async () => {
    const onConfirm = vi.fn()
    await render(
      <Popconfirm title="Remove this member?" onConfirm={onConfirm}>
        <Button>Remove</Button>
      </Popconfirm>,
    )
    await userEvent.tab()
    const trigger = page.getByRole('button', { name: 'Remove' }).element()
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => isOpen('.ant-popconfirm')).toBe(true)
    await expect.poll(() => document.activeElement?.textContent).toBe('Cancel')
    await userEvent.tab()
    expect(document.activeElement?.textContent).toBe('OK')
    await userEvent.keyboard('{Enter}')
    expect(onConfirm).toHaveBeenCalledOnce()
    await expect.poll(() => isOpen('.ant-popconfirm')).toBe(false)
    expect(document.activeElement).toBe(trigger)
  })

  it('Esc 关闭，不确认，焦点回到触发按钮', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    await render(
      <Popconfirm title="Remove this member?" onConfirm={onConfirm} onCancel={onCancel}>
        <Button>Remove</Button>
      </Popconfirm>,
    )
    await userEvent.tab()
    const trigger = page.getByRole('button', { name: 'Remove' }).element()
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => document.activeElement?.textContent).toBe('Cancel')
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => isOpen('.ant-popconfirm')).toBe(false)
    expect(onConfirm).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(trigger)
  })
})

describe('Tooltip', () => {
  it('悬停 500ms 后出现，不足 500ms 不出现；移开后消失', async () => {
    useFakeTimers()
    await render(
      <Tooltip title="Last synced 2 minutes ago">
        <Button>Status</Button>
      </Tooltip>,
    )
    const before = clock()
    await userEvent.hover(page.getByRole('button', { name: 'Status' }))
    const after = clock()
    await before.to(450)
    expect(visibleTooltips()).toEqual([])
    await after.to(550)
    expect(visibleTooltips()).toEqual(['Last synced 2 minutes ago'])
    await parkPointer()
    await settle(300)
    await expect.poll(visibleTooltips).toEqual([])
  })

  it('连续悬停：一个提示打开后移到相邻元素，新提示立即出现；停一会儿再悬停又恢复延迟', async () => {
    useFakeTimers()
    // 延迟设为 3 秒：相邻提示在远不到 3 秒时就出现，只可能来自「连续悬停立即切换」，与交互耗时无关
    await render(
      <>
        <Tooltip title="Bold" mouseEnterDelay={3}>
          <Button>B</Button>
        </Tooltip>
        <Tooltip title="Italic" mouseEnterDelay={3}>
          <Button>I</Button>
        </Tooltip>
        <Tooltip title="Underline" mouseEnterDelay={3}>
          <Button>U</Button>
        </Tooltip>
      </>,
    )
    await userEvent.hover(page.getByRole('button', { name: 'B' }))
    await clock().to(3050)
    expect(visibleTooltips()).toEqual(['Bold'])
    const switching = clock()
    await userEvent.hover(page.getByRole('button', { name: 'I' }))
    await settle()
    expect(visibleTooltips()).toContain('Italic')
    await userEvent.hover(page.getByRole('button', { name: 'U' }))
    await settle()
    expect(visibleTooltips()).toContain('Underline')
    expect(switching.elapsed()).toBeLessThan(3000)
    // 上一个提示立即让位，不等它自己的离开延迟
    await expect.poll(visibleTooltips).toEqual(['Underline'])
    // 离开后过一段时间，提示不再「热」：下一次悬停重新等待延迟
    await parkPointer()
    await settle(1500)
    await expect.poll(visibleTooltips).toEqual([])
    const before = clock()
    await userEvent.hover(page.getByRole('button', { name: 'B' }))
    const after = clock()
    await before.to(2900)
    expect(visibleTooltips()).toEqual([])
    await after.to(3050)
    expect(visibleTooltips()).toEqual(['Bold'])
  })

  it('键盘聚焦时立即出现，失焦或 Esc 时消失；鼠标点击（非键盘焦点）不立即弹出', async () => {
    useFakeTimers()
    await render(
      <>
        <input aria-label="Before" />
        <Tooltip title="Sync now">
          <Button>Sync</Button>
        </Tooltip>
      </>,
    )
    await userEvent.click(page.getByRole('textbox', { name: 'Before' }))
    await userEvent.tab()
    await settle()
    expect(visibleTooltips()).toEqual(['Sync now'])
    await userEvent.keyboard('{Escape}')
    await settle(300)
    await expect.poll(visibleTooltips).toEqual([])
    await userEvent.tab({ shift: true })
    await settle(300)
    await expect.poll(visibleTooltips).toEqual([])

    // 鼠标点击：按钮获得焦点但不是键盘焦点，提示仍按悬停延迟出现
    const before = clock()
    await userEvent.click(page.getByRole('button', { name: 'Sync' }))
    await before.to(400)
    expect(visibleTooltips()).toEqual([])
    await expect.poll(visibleTooltips).toEqual(['Sync now'])
  })
})
