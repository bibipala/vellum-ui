/**
 * SelectionBar 在真实浏览器中的行为（docs/11 §6.1「多选」「撤销优先于确认」，§6.2「不跳」「焦点」「键盘」）：
 * - 在原位替换工具栏：两层叠在同一位置，容器高度不变、下方内容不移动；隐藏的一层不可见且 inert；
 * - 动效：淡入并轻微上移，离开用离开曲线；减少动态效果时只淡入淡出；
 * - 读屏礼貌播报数量；Esc（焦点在栏内）清除选择，打开着菜单时 Esc 属于菜单；清除后焦点的去处；
 * - 选择全部；数字按语言写出、等宽数字；紧凑密度；与 DataTable 的多选组合。
 */
import { type ReactNode, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import {
  Button,
  DataTable,
  Dropdown,
  Input,
  SelectionBar,
  type SelectionBarProps,
  Toolbar,
} from '../../src/index.ts'
import {
  css,
  focused,
  page,
  pseudo,
  render,
  settle,
  token,
  transitionOf,
  userEvent,
} from './render.tsx'

interface Row {
  readonly id: string
  readonly name: string
}

const ROWS: readonly Row[] = [
  { id: 'a', name: 'Atlas' },
  { id: 'b', name: 'Borealis' },
  { id: 'c', name: 'Cascade' },
  { id: 'd', name: 'Delta' },
]

/** 工具栏 + 批量操作栏 + 带多选的表格，与使用方的写法一致。 */
function Harness(
  props: Partial<Pick<SelectionBarProps, 'returnFocus' | 'onClear'>> & {
    readonly total?: number
    readonly selectAll?: boolean
    readonly initial?: readonly string[]
    readonly actions?: ReactNode
  },
) {
  const [rows, setRows] = useState<readonly Row[]>(ROWS)
  const [selected, setSelected] = useState<readonly string[]>(props.initial ?? [])
  return (
    <>
      <SelectionBar
        count={selected.length}
        total={props.total ?? rows.length}
        onClear={() => {
          props.onClear?.()
          setSelected([])
        }}
        onSelectAll={props.selectAll ? () => setSelected(rows.map((r) => r.id)) : undefined}
        returnFocus={props.returnFocus}
        toolbar={
          <Toolbar>
            <Input.Search aria-label="Search projects" />
          </Toolbar>
        }
        testId="bar"
      >
        {props.actions}
        <Button
          tone="danger"
          onClick={() => {
            setRows((list) => list.filter((r) => !selected.includes(r.id)))
            setSelected([])
          }}
        >
          Delete
        </Button>
      </SelectionBar>
      <DataTable<Row>
        aria-label="Projects"
        rowKey={(r) => r.id}
        rows={rows}
        columns={[{ key: 'name', title: 'Name' }]}
        selectable
        selectedKeys={selected}
        onSelectionChange={setSelected}
      />
      <p data-testid="below">Below the table</p>
    </>
  )
}

/** 工具栏里的按钮触发选择：选择后工具栏被替换。 */
function SelectFromToolbar() {
  const [count, setCount] = useState(0)
  return (
    <SelectionBar
      count={count}
      onClear={() => setCount(0)}
      toolbar={
        <Toolbar>
          <Button onClick={() => setCount(3)}>Select visible</Button>
        </Toolbar>
      }
      testId="bar"
    />
  )
}

const root = () => page.getByTestId('bar').element() as HTMLElement
const layer = (name: 'bar' | 'toolbar') =>
  root().querySelector(`[data-layer="${name}"]`) as HTMLElement
const live = () => root().querySelector('[role="status"]')?.textContent ?? null
const checkbox = (index: number) =>
  document.querySelectorAll<HTMLInputElement>('tbody .ant-checkbox-input')[
    index
  ] as HTMLInputElement
const clearButton = () => page.getByRole('button', { name: 'Clear selection' }).element()
const deleteButton = () => page.getByRole('button', { name: 'Delete' }).element()
const below = () => page.getByTestId('below').element().getBoundingClientRect().top
/** 两层的切换动效结束（离开 140ms，留出余量）。 */
const afterMotion = () => settle(260)

describe('SelectionBar：在原位替换工具栏', () => {
  it('没有选中项时显示工具栏，操作栏透明且 inert；选中后操作栏出现，容器高度不变、下方内容不移动', async () => {
    await render(<Harness />)
    expect(layer('bar').hasAttribute('data-hidden')).toBe(true)
    expect(css(layer('bar')).opacity).toBe('0')
    expect(css(layer('bar')).pointerEvents).toBe('none')
    expect(layer('bar').inert).toBe(true)
    expect(layer('toolbar').inert).toBe(false)
    const height = root().getBoundingClientRect().height
    const top = below()

    await userEvent.click(checkbox(0))
    expect(layer('bar').hasAttribute('data-hidden')).toBe(false)
    expect(layer('bar').inert).toBe(false)
    expect(layer('toolbar').inert).toBe(true)
    expect(root().getBoundingClientRect().height).toBe(height)
    expect(below()).toBe(top)
    const bar = page.getByRole('group', { name: 'Bulk actions' }).element()
    expect(bar.textContent).toContain('1 selected')
    await afterMotion()
    expect(css(layer('toolbar')).opacity).toBe('0')
    expect(css(layer('bar')).opacity).toBe('1')

    await userEvent.click(clearButton())
    expect(layer('bar').hasAttribute('data-hidden')).toBe(true)
    expect(layer('bar').inert).toBe(true)
    expect(root().getBoundingClientRect().height).toBe(height)
    expect(below()).toBe(top)
    // 淡出期间仍显示最后的数量，不变成 0
    expect(layer('bar').textContent).toContain('1 selected')
    await afterMotion()
    expect(css(layer('bar')).opacity).toBe('0')
    expect(css(layer('toolbar')).opacity).toBe('1')
  })

  it('隐藏的一层不能用 Tab 到达（inert，读屏同样跳过）', async () => {
    await render(
      <>
        <input aria-label="Before" />
        <Harness />
      </>,
    )
    const before = page.getByRole('textbox', { name: 'Before' })
    await userEvent.click(before)
    await userEvent.tab()
    expect(focused()).toBe(page.getByRole('searchbox', { name: 'Search projects' }).element())
    await userEvent.tab()
    // 下一个是表格的全选复选框，不是隐藏的「清除选择」
    expect((focused() as HTMLInputElement).type).toBe('checkbox')
    await userEvent.click(checkbox(0))
    await userEvent.click(before)
    await userEvent.tab()
    expect(focused()).toBe(clearButton())
    await userEvent.tab({ shift: true })
    expect(focused()).toBe(before.element())
  })

  it('与工具栏同高（控件高度）；浅底向四周伸出，不占布局位置', async () => {
    await render(<Harness initial={['a']} />)
    // 工具栏的高度由里面的控件决定（搜索框约为控件高度），操作栏与它同高，容器也是这个高度
    const control = Number.parseFloat(token('control-height-md'))
    const height = layer('toolbar').getBoundingClientRect().height
    expect(height).toBeCloseTo(control, 0)
    expect(layer('bar').getBoundingClientRect().height).toBe(height)
    expect(root().getBoundingClientRect().height).toBe(height)
    expect(css(layer('bar')).minHeight).toBe(token('control-height-md'))
    const tint = pseudo(layer('bar'), '::before')
    expect(tint.position).toBe('absolute')
    expect(tint.top).toBe(`-${token('selection-bar-bleed-y')}`)
    expect(tint.left).toBe(`-${token('selection-bar-bleed-x')}`)
    expect(token('selection-bar-bleed-x')).toBe('8px')
    // 内容与工具栏的内容左对齐
    const search = page.getByRole('searchbox', { name: 'Search projects' }).element()
    const frame = search.closest('.ant-input-affix-wrapper') as HTMLElement
    expect(clearButton().getBoundingClientRect().left).toBe(frame.getBoundingClientRect().left)
  })

  it('紧凑密度：同样与工具栏同高（30px），浅底伸出得更少', async () => {
    await render(<Harness initial={['a']} />, { defaultDensity: 'compact' })
    expect(token('control-height-md')).toBe('30px')
    expect(token('selection-bar-bleed-x')).toBe('4px')
    const height = layer('toolbar').getBoundingClientRect().height
    expect(height).toBeCloseTo(30, 0)
    expect(layer('bar').getBoundingClientRect().height).toBe(height)
    expect(root().getBoundingClientRect().height).toBe(height)
  })

  it('动效：出现时淡入并从下方 4px 上移（200ms，标准曲线）；离开淡出并下移，用离开曲线，时长为进入的 0.7', async () => {
    await render(<Harness />)
    const bar = layer('bar')
    expect(css(bar).transform).toBe('matrix(1, 0, 0, 1, 0, 4)')
    expect(transitionOf(bar, 'opacity')).toBe(140)
    expect(css(bar).transitionTimingFunction).toContain(token('motion-ease-exit'))
    expect(css(layer('toolbar')).transform).toBe('none')
    await userEvent.click(checkbox(0))
    expect(transitionOf(bar, 'opacity')).toBe(200)
    expect(transitionOf(bar, 'transform')).toBe(200)
    expect(css(bar).transitionTimingFunction).toContain(token('motion-ease-standard'))
    await afterMotion()
    expect(css(bar).transform).toBe('none')
    expect(css(layer('toolbar')).transform).toBe('matrix(1, 0, 0, 1, 0, -4)')
  })

  it('减少动态效果：不位移，只淡入淡出（时长为 0）', async () => {
    await render(<Harness />, { reducedMotion: true })
    expect(css(layer('bar')).transform).toBe('none')
    await userEvent.click(checkbox(0))
    expect(css(layer('toolbar')).transform).toBe('none')
    expect(transitionOf(layer('bar'), 'opacity')).toBe(0)
    expect(transitionOf(layer('toolbar'), 'opacity')).toBe(0)
  })
})

describe('SelectionBar：播报与数字', () => {
  it('数量变化时礼貌播报，清除后播报「Selection cleared」；挂载时不播报', async () => {
    await render(<Harness initial={['a']} />)
    const status = root().querySelector('[role="status"]') as HTMLElement
    // 状态区在两层之外：隐藏的一层是 inert，里面的播报读屏听不到
    expect(layer('bar').contains(status)).toBe(false)
    expect(live()).toBe('')
    await userEvent.click(checkbox(1))
    await expect.poll(live).toBe('2 selected')
    await userEvent.click(checkbox(2))
    await expect.poll(live).toBe('3 selected')
    await userEvent.click(clearButton())
    await expect.poll(live).toBe('Selection cleared')
  })

  it('数字按语言写出、等宽数字；全部选中时说「All N selected」', async () => {
    const { rerender } = await render(
      <SelectionBar
        count={1234}
        total={5000}
        onClear={() => {}}
        onSelectAll={() => {}}
        testId="bar"
      />,
    )
    const bar = page.getByRole('group', { name: 'Bulk actions' }).element()
    expect(bar.textContent).toContain('1,234 selected')
    expect(page.getByRole('button', { name: 'Select all 5,000' }).query()).not.toBeNull()
    expect(css(bar).fontVariantNumeric).toBe('tabular-nums')
    await rerender(<SelectionBar count={5000} total={5000} onClear={() => {}} testId="bar" />)
    expect(bar.textContent).toContain('All 5,000 selected')
    expect(page.getByRole('button', { name: /Select all/ }).query()).toBeNull()
  })

  it('zh-CN 的文字', async () => {
    await render(
      <SelectionBar
        count={1234}
        total={5000}
        onClear={() => {}}
        onSelectAll={() => {}}
        testId="bar"
      />,
      { locale: 'zh-CN' },
    )
    const bar = page.getByRole('group', { name: '批量操作' }).element()
    expect(bar.textContent).toContain('已选 1,234 项')
    expect(page.getByRole('button', { name: '选择全部 5,000 项' }).query()).not.toBeNull()
    expect(page.getByRole('button', { name: '清除选择' }).query()).not.toBeNull()
  })
})

describe('SelectionBar：键盘与焦点', () => {
  it('Esc（焦点在栏内）清除选择，焦点回到最后一次改变选择的复选框；焦点在栏外时 Esc 不清除', async () => {
    const onClear = vi.fn()
    await render(<Harness onClear={onClear} />)
    await userEvent.click(checkbox(0))
    await userEvent.click(checkbox(2))
    expect(focused()).toBe(checkbox(2))
    await userEvent.keyboard('{Escape}')
    expect(onClear).not.toHaveBeenCalled()
    // 键盘进入栏内（从表格反向 Tab 回来）
    ;(deleteButton() as HTMLElement).focus()
    await userEvent.keyboard('{Escape}')
    expect(onClear).toHaveBeenCalledOnce()
    expect(layer('bar').hasAttribute('data-hidden')).toBe(true)
    expect(focused()).toBe(checkbox(2))
    expect(checkbox(2).checked).toBe(false)
  })

  it('清除按钮：焦点回到复选框，不落到 body', async () => {
    await render(<Harness />)
    await userEvent.click(checkbox(1))
    await userEvent.click(clearButton())
    expect(focused()).toBe(checkbox(1))
  })

  it('原来的元素不在了（删除了选中的行）：焦点去工具栏中第一个可聚焦的元素', async () => {
    await render(<Harness />)
    await userEvent.click(checkbox(0))
    await userEvent.click(deleteButton())
    expect(document.querySelectorAll('tbody tr')).toHaveLength(3)
    expect(focused()).toBe(page.getByRole('searchbox', { name: 'Search projects' }).element())
  })

  it('returnFocus 指定焦点的去处', async () => {
    await render(
      <>
        <Harness returnFocus={() => document.getElementById('target')} />
        <button id="target" type="button">
          Target
        </button>
      </>,
    )
    await userEvent.click(checkbox(0))
    await userEvent.click(clearButton())
    expect(focused()?.id).toBe('target')
  })

  it('焦点不在栏内时清除，不移动焦点', async () => {
    await render(<Harness />)
    await userEvent.click(checkbox(0))
    await userEvent.click(checkbox(0))
    expect(layer('bar').hasAttribute('data-hidden')).toBe(true)
    expect(focused()).toBe(checkbox(0))
  })

  it('选择全部：count < total 时显示「Select all N」；点击后全部选中，按钮消失，焦点移到清除按钮', async () => {
    await render(<Harness selectAll />)
    await userEvent.click(checkbox(0))
    const selectAll = page.getByRole('button', { name: 'Select all 4' })
    await userEvent.click(selectAll)
    expect(page.getByRole('group', { name: 'Bulk actions' }).element().textContent).toContain(
      'All 4 selected',
    )
    expect(page.getByRole('button', { name: /Select all/ }).query()).toBeNull()
    expect(focused()).toBe(clearButton())
    expect([0, 1, 2, 3].every((i) => checkbox(i).checked)).toBe(true)
  })

  it('Tab 依次到达清除按钮、选择全部与各个操作', async () => {
    await render(
      <>
        <input aria-label="Before" />
        <Harness selectAll actions={<Button>Archive</Button>} initial={['a']} />
      </>,
    )
    await userEvent.click(page.getByRole('textbox', { name: 'Before' }))
    await userEvent.tab()
    expect(focused()).toBe(clearButton())
    await userEvent.tab()
    expect(focused()).toBe(page.getByRole('button', { name: 'Select all 4' }).element())
    await userEvent.tab()
    expect(focused()).toBe(page.getByRole('button', { name: 'Archive' }).element())
    await userEvent.tab()
    expect(focused()).toBe(deleteButton())
  })

  /** 带「更多」菜单的操作栏：打开菜单并等它取得焦点（rc-dropdown 打开几帧之后才把焦点移进菜单）。 */
  async function openMenu(onClear: () => void) {
    await render(
      <Harness
        onClear={onClear}
        initial={['a']}
        actions={
          <Dropdown
            trigger={['click']}
            menu={{ items: [{ key: 'move', label: 'Move to folder' }] }}
          >
            <Button>More</Button>
          </Dropdown>
        }
      />,
    )
    const more = page.getByRole('button', { name: 'More' }).element() as HTMLElement
    await userEvent.click(more)
    await expect.poll(() => focused()?.getAttribute('role')).toBe('menuitem')
    return more
  }
  const menuOpen = () => document.querySelector('.ant-dropdown:not(.ant-dropdown-hidden)') !== null

  it('栏里的菜单打开时，Esc 只关闭菜单（焦点回到「More」），不清除选择；再按 Esc 才清除', async () => {
    const onClear = vi.fn()
    const more = await openMenu(onClear)
    await userEvent.keyboard('{Escape}')
    await expect.poll(menuOpen).toBe(false)
    expect(focused()).toBe(more)
    expect(onClear).not.toHaveBeenCalled()
    expect(layer('bar').hasAttribute('data-hidden')).toBe(false)
    await userEvent.keyboard('{Escape}')
    expect(onClear).toHaveBeenCalledOnce()
  })

  it('菜单打开、焦点在触发按钮上时，Esc 同样属于菜单', async () => {
    const onClear = vi.fn()
    const more = await openMenu(onClear)
    more.focus()
    expect(menuOpen()).toBe(true)
    expect(more.classList.contains('ant-dropdown-open')).toBe(true)
    await userEvent.keyboard('{Escape}')
    await expect.poll(menuOpen).toBe(false)
    expect(onClear).not.toHaveBeenCalled()
  })

  it('Esc 清除选择后不再冒泡到外层（对话框不会因为同一次 Esc 关闭）', async () => {
    const outer = vi.fn()
    await render(
      // biome-ignore lint/a11y/noStaticElementInteractions: 测试用的外层监听
      <div onKeyDown={(e) => outer(e.key)}>
        <Harness initial={['a']} />
      </div>,
    )
    ;(clearButton() as HTMLElement).focus()
    await userEvent.keyboard('{Escape}')
    expect(layer('bar').hasAttribute('data-hidden')).toBe(true)
    expect(outer).not.toHaveBeenCalledWith('Escape')
  })

  it('选中时焦点在工具栏里（工具栏被替换）：焦点移到清除按钮', async () => {
    await render(<SelectFromToolbar />)
    await userEvent.click(page.getByRole('button', { name: 'Select visible' }))
    expect(focused()).toBe(clearButton())
    await userEvent.keyboard('{Escape}')
    expect(focused()).toBe(page.getByRole('button', { name: 'Select visible' }).element())
  })
})
