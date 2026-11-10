/**
 * DataTable 在真实浏览器中的交互（二）：列。
 * - 固定列：横向滚动时固定列（与选择列、表头）位置不变；内容滚到下面时交界处才出现分隔，滚回去消失；
 * - 列宽：拖动表头边缘（指针捕获，移出表头也跟随，受最小 / 最大宽度限制），其他列的宽度不变；键盘 ← / →（Shift 更大），
 *   Enter 或双击恢复默认；手柄的读屏语义（separator、aria-valuenow / min / max）与焦点环；弹性列从实际宽度开始调整；
 * - 列设置：显示 / 隐藏（不可隐藏的列与最后一列禁用并说明原因）、上移 / 下移（键盘可用，焦点不丢失）、
 *   固定到开头 / 结尾、恢复默认；
 * - 保存在本机：调整后保存，重新挂载时恢复；忽略已经不存在的列，新增的列按默认显示；保存的数据无效时用默认值。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { DataTable, type DataTableColumn, type DataTableProps } from '../../src/index.ts'
import {
  css,
  expectFocusRing,
  focused,
  isOpen,
  nextFrame,
  page,
  parkPointer,
  pseudo,
  render,
  settle,
  token,
  userEvent,
} from './render.tsx'

interface Row {
  readonly id: string
  readonly name: string
  readonly owner: string
  readonly status: string
  readonly size: number
}

const rows: Row[] = Array.from({ length: 4 }, (_, i) => ({
  id: `r${i}`,
  name: `Project ${i}`,
  owner: ['Sam Lee', 'Alex Kim', 'Riley Chen', 'Jordan Park'][i] as string,
  status: i % 2 ? 'Paused' : 'Active',
  size: i * 10,
}))

const columns: DataTableColumn<Row>[] = [
  { key: 'name', title: 'Name', width: 160, hideable: false },
  { key: 'owner', title: 'Owner', width: 200, minWidth: 120, maxWidth: 320 },
  { key: 'status', title: 'Status', width: 200 },
  { key: 'size', title: 'Size', width: 120, align: 'end' },
]

const STORAGE = 'test.data-table'

afterEach(() => {
  localStorage.removeItem(STORAGE)
})

function Table(props: Partial<DataTableProps<Row>> & { readonly width?: number }) {
  const { width = 900, ...rest } = props
  return (
    <div style={{ width }} data-testid="frame">
      <DataTable
        aria-label="Projects"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        {...rest}
      />
    </div>
  )
}

const table = () => page.getByRole('table', { name: 'Projects' }).element() as HTMLTableElement
const scroller = () => table().parentElement as HTMLElement
const headers = () =>
  [...(table().tHead?.rows[0]?.cells ?? [])]
    .map((th) => th.getAttribute('aria-label'))
    .filter((n): n is string => n !== null)
const header = (name: string) =>
  page.getByRole('columnheader', { name, exact: true }).element() as HTMLTableCellElement
const width = (name: string) => Math.round(header(name).getBoundingClientRect().width)
const handle = (name: string) =>
  page.getByRole('separator', { name: `Resize ${name}` }).element() as HTMLElement
const now = (name: string) => Number(handle(name).getAttribute('aria-valuenow'))
const cellOf = (rowIndex: number, name: string) => {
  const i = [...(table().tHead?.rows[0]?.cells ?? [])].findIndex(
    (th) => th.getAttribute('aria-label') === name,
  )
  return table().tBodies[0]?.rows[rowIndex]?.cells[i] as HTMLTableCellElement
}
const left = (el: Element) => Math.round(el.getBoundingClientRect().left)
const frames = async (n = 3) => {
  for (let i = 0; i < n; i++) await nextFrame()
}

describe('DataTable：固定列', () => {
  const pinned: DataTableColumn<Row>[] = [
    { key: 'name', title: 'Name', width: 160, pin: 'start' },
    { key: 'owner', title: 'Owner', width: 300 },
    { key: 'status', title: 'Status', width: 300 },
    { key: 'size', title: 'Size', width: 120, align: 'end', pin: 'end' },
  ]

  it('横向滚动时固定列、选择列与表头不动，其他列随内容滚动；内容滚到下面时交界处才出现分隔', async () => {
    await render(<Table width={560} columns={pinned} selectable />)
    const name = cellOf(0, 'Name')
    const size = cellOf(0, 'Size')
    const owner = cellOf(0, 'Owner')
    const select = table().tBodies[0]?.rows[0]?.cells[0] as HTMLElement
    const before = {
      name: left(name),
      size: left(size),
      owner: left(owner),
      select: left(select),
      head: left(header('Name')),
    }
    // 开始时：右边还有内容在结尾固定列的下面，左边没有
    const shadow = (el: Element) => css(el).boxShadow
    expect(shadow(name)).toBe('none')
    expect(shadow(size)).not.toBe('none')
    expect(table().closest('[data-scrolled-end]')).not.toBeNull()
    expect(table().closest('[data-scrolled-start]')).toBeNull()
    scroller().scrollLeft = 150
    await frames()
    expect(left(name)).toBe(before.name)
    expect(left(size)).toBe(before.size)
    expect(left(select)).toBe(before.select)
    expect(left(header('Name'))).toBe(before.head)
    expect(left(owner)).toBe(before.owner - 150)
    expect(table().closest('[data-scrolled-start]')).not.toBeNull()
    await expect.poll(() => shadow(name)).not.toBe('none')
    // 固定列是实色表面：滚动的内容从它下面经过时不透出来
    expect(css(name).backgroundColor).toBe(css(header('Name')).backgroundColor)
    expect(css(name).backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
    // 结尾保留内缩：补宽的空列粘在结尾、宽度等于内缩，结尾的固定列让出这段
    const inset = Number.parseFloat(token('data-table-inset'))
    const edge = scroller().getBoundingClientRect().right
    const filler = table().tBodies[0]?.rows[0]?.lastElementChild as HTMLElement
    expect(filler.getAttribute('aria-hidden')).toBe('true')
    expect(Math.round(filler.getBoundingClientRect().width)).toBe(inset)
    expect(Math.round(filler.getBoundingClientRect().right)).toBe(Math.round(edge))
    expect(Math.round(size.getBoundingClientRect().right)).toBe(Math.round(edge - inset))
    // 滚到最右：结尾的固定列下面不再有内容
    scroller().scrollLeft = scroller().scrollWidth
    await frames()
    expect(left(size)).toBe(before.size)
    expect(table().closest('[data-scrolled-end]')).toBeNull()
    await expect.poll(() => shadow(size)).toBe('none')
    scroller().scrollLeft = 0
    await frames()
    expect(table().closest('[data-scrolled-start]')).toBeNull()
  })
})

describe('DataTable：列宽', () => {
  it.each(['constructor', 'toString', '__proto__'])(
    '原型同名列 %s 可以用键盘和指针调宽，重新挂载后恢复',
    async (key) => {
      const ui = (
        <Table
          storageKey={STORAGE}
          columns={[
            { key, title: 'Special', width: 100, render: () => 'Special value' },
            { key: 'owner', title: 'Owner', width: 200 },
          ]}
        />
      )
      let view = await render(ui)
      expect(width('Special')).toBe(100)
      handle('Special').focus()
      await userEvent.keyboard('{ArrowRight}')
      await expect.poll(() => width('Special')).toBe(116)
      expect(now('Special')).toBe(116)
      await view.unmount()
      view = await render(ui)
      expect(width('Special')).toBe(116)
      handle('Special').focus()
      await userEvent.keyboard('{Enter}')
      expect(width('Special')).toBe(100)

      const h = handle('Special')
      const frame = page.getByTestId('frame')
      const x =
        h.getBoundingClientRect().left +
        h.getBoundingClientRect().width / 2 -
        frame.element().getBoundingClientRect().left
      await userEvent.hover(h)
      await userEvent.pointer({ keys: '[MouseLeft>]' })
      await userEvent.hover(frame, { position: { x: x + 24, y: 20 } })
      await userEvent.pointer({ keys: '[/MouseLeft]' })
      await expect.poll(() => width('Special')).toBe(124)
      expect(now('Special')).toBe(124)
      await view.unmount()
      await render(ui)
      expect(width('Special')).toBe(124)
      const stored = JSON.parse(localStorage.getItem(STORAGE) ?? '{}')
      expect(Object.hasOwn(stored.width, key)).toBe(true)
    },
  )

  it('原型同名的弹性列从实际测量的宽度开始调整', async () => {
    await render(
      <Table
        columns={[
          { key: '__proto__', title: 'Special', render: () => 'Special value' },
          { key: 'owner', title: 'Owner', width: 200 },
        ]}
      />,
    )
    await expect.poll(() => now('Special')).toBe(700)
    handle('Special').focus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(width('Special')).toBe(684)
    expect(now('Special')).toBe(684)
  })

  it('手柄的读屏语义；拖动跟随指针（移出表头也跟随），受最小、最大宽度限制，其他列的宽度不变', async () => {
    await render(<Table />)
    const h = handle('Owner')
    expect(h.getAttribute('aria-orientation')).toBe('vertical')
    expect(now('Owner')).toBe(200)
    expect(h.getAttribute('aria-valuemin')).toBe('120')
    expect(h.getAttribute('aria-valuemax')).toBe('320')
    expect(width('Owner')).toBe(200)
    const others = { name: width('Name'), status: width('Status'), size: width('Size') }
    const statusLeft = left(header('Status'))
    const frame = page.getByTestId('frame')
    const frameLeft = (page.getByTestId('frame').element() as HTMLElement).getBoundingClientRect()
      .left
    const x = h.getBoundingClientRect().left + h.getBoundingClientRect().width / 2 - frameLeft
    await userEvent.hover(h)
    await expect
      .poll(() => Number(pseudo(h, '::before').opacity))
      .toBeCloseTo(Number(token('state-hover-opacity')), 2)
    await userEvent.pointer({ keys: '[MouseLeft>]' })
    await expect.poll(() => h.hasAttribute('data-dragging')).toBe(true)
    // 向右 60px，指针移到表格下方（表头以外）
    await userEvent.hover(frame, { position: { x: x + 60, y: 120 } })
    await expect.poll(() => now('Owner')).toBe(260)
    expect(width('Owner')).toBe(260)
    expect(left(header('Status'))).toBe(statusLeft + 60)
    expect({ name: width('Name'), status: width('Status'), size: width('Size') }).toEqual(others)
    // 超过最大、最小宽度时停在边界
    await userEvent.hover(frame, { position: { x: x + 400, y: 20 } })
    await expect.poll(() => now('Owner')).toBe(320)
    await userEvent.hover(frame, { position: { x: x - 300, y: 20 } })
    await expect.poll(() => now('Owner')).toBe(120)
    await userEvent.hover(frame, { position: { x: x + 20, y: 20 } })
    await expect.poll(() => now('Owner')).toBe(220)
    await userEvent.pointer({ keys: '[/MouseLeft]' })
    await expect.poll(() => h.hasAttribute('data-dragging')).toBe(false)
    expect(width('Owner')).toBe(220)
    // 拖动后焦点在手柄上，但鼠标操作不显示焦点环
    expect(focused()).toBe(h)
    expect(h.matches(':focus-visible')).toBe(false)
  })

  it('键盘：Tab 聚焦手柄显示焦点环（画在手柄内侧）；← / → 调整 16px，Shift 为 64px；Enter 恢复默认，双击也恢复', async () => {
    await render(<Table />)
    while (focused() !== handle('Owner')) await userEvent.tab()
    expectFocusRing(handle('Owner'), -2)
    await userEvent.keyboard('{ArrowRight}')
    expect(now('Owner')).toBe(216)
    await userEvent.keyboard('{Shift>}{ArrowRight}{/Shift}')
    expect(now('Owner')).toBe(280)
    await userEvent.keyboard('{ArrowLeft}')
    expect(now('Owner')).toBe(264)
    expect(width('Owner')).toBe(264)
    await userEvent.keyboard('{Shift>}{ArrowRight}{ArrowRight}{/Shift}')
    expect(now('Owner')).toBe(320)
    await userEvent.keyboard('{Enter}')
    expect(now('Owner')).toBe(200)
    expect(width('Owner')).toBe(200)
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(now('Owner')).toBe(168)
    await userEvent.dblClick(handle('Owner'))
    expect(now('Owner')).toBe(200)
  })

  it('弹性列（没有 width）：手柄读出实际宽度，从实际宽度开始调整；所有列都定宽时补一个空列占满剩余宽度', async () => {
    await render(
      <Table
        columns={[
          { key: 'name', title: 'Name' },
          { key: 'owner', title: 'Owner', width: 200 },
        ]}
      />,
    )
    // 900 宽：Name 占满 Owner 以外的宽度
    await expect.poll(() => now('Name')).toBe(700)
    expect(width('Name')).toBe(700)
    handle('Name').focus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(now('Name')).toBe(684)
    expect(width('Name')).toBe(684)
    expect(width('Owner')).toBe(200)
    // 现在都定宽了：最后补一个空列（对读屏隐藏），行仍占满整个宽度
    const filler = table().tHead?.rows[0]?.cells[2] as HTMLElement
    expect(filler.getAttribute('aria-hidden')).toBe('true')
    expect(Math.round(filler.getBoundingClientRect().width)).toBe(16)
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => width('Name')).toBe(700)
  })
})

const openSettings = async () => {
  await userEvent.click(page.getByRole('button', { name: 'Columns' }))
  await expect.poll(() => isOpen('.ant-popover')).toBe(true)
}
const setting = (name: string) =>
  page.getByRole('checkbox', { name, exact: true }).element() as HTMLInputElement
const tool = (name: string) =>
  page.getByRole('button', { name, exact: true }).element() as HTMLButtonElement
/**
 * 点击列设置中的按钮。先把指针移开：移动、固定之后列表在静止的指针下面换了位置，500ms 后指针下面那个按钮的提示出现，
 * 可能正好盖住下一个要点的按钮（真实的指针会移动，提示随之关闭；Playwright 则一直等它让开）。
 */
const clickTool = async (name: string) => {
  await parkPointer()
  await userEvent.click(tool(name))
}

describe('DataTable：列设置', () => {
  it('显示 / 隐藏：取消勾选即隐藏；不可隐藏的列与最后一个显示的列禁用并说明原因', async () => {
    await render(<Table columnSettings />)
    await openSettings()
    const list = page.getByRole('list', { name: 'Shown columns' }).element()
    expect(
      [...list.querySelectorAll('li')].map((li) => li.textContent?.split('Always')[0]),
    ).toEqual(['Name', 'Owner', 'Status', 'Size'])
    const name = setting('Name')
    expect(name.disabled).toBe(true)
    expect(document.getElementById(name.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
      'Always shown',
    )
    await userEvent.click(setting('Owner'))
    expect(headers()).toEqual(['Name', 'Status', 'Size'])
    await userEvent.click(setting('Status'))
    await userEvent.click(setting('Size'))
    expect(headers()).toEqual(['Name'])
    await userEvent.click(setting('Owner'))
    expect(headers()).toEqual(['Name', 'Owner'])
  })

  it('最后一个显示的列不能隐藏', async () => {
    await render(
      <Table
        columnSettings
        columns={[
          { key: 'name', title: 'Name' },
          { key: 'owner', title: 'Owner' },
        ]}
      />,
    )
    await openSettings()
    await userEvent.click(setting('Name'))
    expect(headers()).toEqual(['Owner'])
    const owner = setting('Owner')
    expect(owner.disabled).toBe(true)
    expect(document.getElementById(owner.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
      'At least one column is shown',
    )
  })

  it('上移 / 下移：键盘可用，移到分组边上后焦点移到另一个方向的按钮', async () => {
    await render(<Table columnSettings />)
    await openSettings()
    expect(tool('Move Name up').disabled).toBe(true)
    tool('Move Status up').focus()
    await userEvent.keyboard('{Enter}')
    expect(headers()).toEqual(['Name', 'Status', 'Owner', 'Size'])
    expect(focused()).toBe(tool('Move Status up'))
    await userEvent.keyboard('{Enter}')
    expect(headers()).toEqual(['Status', 'Name', 'Owner', 'Size'])
    // 已经在最上面：「上移」禁用，焦点移到「下移」
    expect(tool('Move Status up').disabled).toBe(true)
    await expect.poll(focused).toBe(tool('Move Status down'))
    await userEvent.keyboard(' ')
    expect(headers()).toEqual(['Name', 'Status', 'Owner', 'Size'])
  })

  it('固定到开头 / 结尾（切换按钮，aria-pressed）；固定的列移到对应的分组，只能在分组内移动', async () => {
    await render(<Table columnSettings />)
    await openSettings()
    const pinStart = () => tool('Pin Size to the start')
    expect(pinStart().getAttribute('aria-pressed')).toBe('false')
    await clickTool('Pin Size to the start')
    expect(pinStart().getAttribute('aria-pressed')).toBe('true')
    expect(headers()).toEqual(['Size', 'Name', 'Owner', 'Status'])
    expect(header('Size').getAttribute('data-pin')).toBe('start')
    // Size 是开头分组中唯一的列：不能上下移动；Name 不能越过分组上移
    expect(tool('Move Size down').disabled).toBe(true)
    expect(tool('Move Name up').disabled).toBe(true)
    await clickTool('Pin Name to the end')
    expect(headers()).toEqual(['Size', 'Owner', 'Status', 'Name'])
    expect(header('Name').getAttribute('data-pin')).toBe('end')
    // 再按一次取消固定
    await clickTool('Pin Size to the start')
    expect(pinStart().getAttribute('aria-pressed')).toBe('false')
    expect(header('Size').hasAttribute('data-pin')).toBe(false)
    expect(headers()).toEqual(['Owner', 'Status', 'Size', 'Name'])
  })

  it('恢复默认：顺序、显示、固定与列宽都回到列定义', async () => {
    await render(<Table columnSettings />)
    handle('Owner').focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(width('Owner')).toBe(216)
    await openSettings()
    await userEvent.click(setting('Status'))
    await clickTool('Move Size up')
    await clickTool('Pin Owner to the end')
    expect(headers()).toEqual(['Name', 'Size', 'Owner'])
    await parkPointer()
    await userEvent.click(page.getByRole('button', { name: 'Restore defaults' }))
    expect(headers()).toEqual(['Name', 'Owner', 'Status', 'Size'])
    expect(width('Owner')).toBe(200)
    expect(header('Owner').hasAttribute('data-pin')).toBe(false)
  })

  it('Esc 关闭列设置，焦点回到按钮', async () => {
    await render(<Table columnSettings />)
    await openSettings()
    await expect.poll(() => document.querySelector('.ant-popover')?.contains(focused())).toBe(true)
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => isOpen('.ant-popover')).toBe(false)
    await expect.poll(focused).toBe(page.getByRole('button', { name: 'Columns' }).element())
  })
})

describe('DataTable：保存在本机', () => {
  it('调整后保存，重新挂载时恢复（列宽、顺序、显示、固定）', async () => {
    const view = await render(<Table columnSettings storageKey={STORAGE} />)
    expect(localStorage.getItem(STORAGE)).toBeNull()
    handle('Owner').focus()
    await userEvent.keyboard('{Shift>}{ArrowRight}{/Shift}')
    await openSettings()
    await userEvent.click(setting('Status'))
    await clickTool('Move Size up')
    await clickTool('Pin Size to the start')
    expect(headers()).toEqual(['Size', 'Name', 'Owner'])
    const saved = JSON.parse(localStorage.getItem(STORAGE) ?? 'null')
    expect(saved).toMatchObject({
      v: 1,
      hidden: { status: true },
      pin: { size: 'start' },
      width: { owner: 264 },
    })
    await view.unmount()
    await render(<Table columnSettings storageKey={STORAGE} />)
    expect(headers()).toEqual(['Size', 'Name', 'Owner'])
    expect(width('Owner')).toBe(264)
    // 恢复默认：删除保存的数据
    await openSettings()
    await parkPointer()
    await userEvent.click(page.getByRole('button', { name: 'Restore defaults' }))
    expect(localStorage.getItem(STORAGE)).toBeNull()
  })

  it('拖动结束时才保存', async () => {
    await render(<Table storageKey={STORAGE} />)
    const h = handle('Size')
    const frameLeft = (page.getByTestId('frame').element() as HTMLElement).getBoundingClientRect()
      .left
    const x = h.getBoundingClientRect().left + h.getBoundingClientRect().width / 2 - frameLeft
    await userEvent.hover(h)
    await userEvent.pointer({ keys: '[MouseLeft>]' })
    await userEvent.hover(page.getByTestId('frame'), { position: { x: x + 40, y: 20 } })
    await expect.poll(() => now('Size')).toBe(160)
    expect(localStorage.getItem(STORAGE)).toBeNull()
    await userEvent.pointer({ keys: '[/MouseLeft]' })
    await settle()
    expect(JSON.parse(localStorage.getItem(STORAGE) ?? 'null')).toMatchObject({
      width: { size: 160 },
    })
  })

  it('忽略已经不存在的列；新增的列按默认显示（放在默认的位置附近）；数据无效时用默认值', async () => {
    localStorage.setItem(
      STORAGE,
      JSON.stringify({
        v: 1,
        order: ['size', 'removed', 'name', 'owner'],
        hidden: { removed: false, owner: true },
        pin: { removed: 'start' },
        width: { removed: 500, name: 180 },
      }),
    )
    const view = await render(<Table columnSettings storageKey={STORAGE} />)
    // status 是新增的列：跟在列定义中它前面的 owner 之后（owner 被隐藏），默认显示
    expect(headers()).toEqual(['Size', 'Name', 'Status'])
    expect(width('Name')).toBe(180)
    await view.unmount()
    localStorage.setItem(STORAGE, '{not json')
    await render(<Table columnSettings storageKey={STORAGE} />)
    expect(headers()).toEqual(['Name', 'Owner', 'Status', 'Size'])
  })
})
