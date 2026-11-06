/**
 * 数据组件在真实浏览器中的键盘可达性与当前态样式（docs/11 §6.2「焦点」「键盘」「选中」）：
 * Pagination 逐个聚焦页码、Enter 翻页、当前页为强调色浅底配强调色文字、不描边；
 * Tree 方向键移动、展开收起、Enter 选择。表格的键盘操作见 DataTable 的测试（旧 Table 已删除）。
 */
import { describe, expect, it, vi } from 'vitest'
import { Pagination, Tree } from '../../src/index.ts'
import {
  css,
  expectFocusRing,
  focused,
  page,
  render,
  rgba,
  sameColor,
  token,
  userEvent,
} from './render.tsx'

const currentPage = () => document.querySelector<HTMLElement>('.ant-pagination-item-active')

describe('Pagination', () => {
  it('Tab 逐个聚焦页码并显示焦点环，Enter 翻页；上一页、下一页按钮同样可用', async () => {
    const onChange = vi.fn()
    await render(<Pagination total={50} onChange={(p) => onChange(p)} />)
    await userEvent.tab()
    // 第一页时「上一页」禁用，第一个可聚焦的是页码 1
    const one = focused() as HTMLElement
    expect(one.textContent).toBe('1')
    expectFocusRing(one, 2)
    await userEvent.tab()
    await userEvent.tab()
    expect((focused() as HTMLElement).textContent).toBe('3')
    await userEvent.keyboard('{Enter}')
    expect(onChange).toHaveBeenLastCalledWith(3)
    expect(currentPage()?.textContent).toBe('3')
    // 跳到「下一页」
    while (!(focused() as HTMLElement).classList.contains('ant-pagination-next'))
      await userEvent.tab()
    await userEvent.keyboard('{Enter}')
    expect(onChange).toHaveBeenLastCalledWith(4)
  })

  it('当前页：强调色浅底配强调色文字，不描边；其他页无底色', async () => {
    await render(<Pagination total={50} defaultCurrent={2} />)
    const current = currentPage() as HTMLElement
    expect(current.textContent).toBe('2')
    expect(current.getAttribute('aria-current') ?? current.className).toBeTruthy()
    expect(sameColor(css(current).backgroundColor, token('color-fill-selected'))).toBe(true)
    const link = current.querySelector('a') as HTMLElement
    expect(sameColor(css(link).color, token('color-accent-text'))).toBe(true)
    expect(rgba(css(current).borderTopColor)[3]).toBe(0)
    const other = document.querySelector('.ant-pagination-item:not(.ant-pagination-item-active)')
    expect(rgba(css(other as Element).backgroundColor)[3]).toBe(0)
  })
})

describe('Tree', () => {
  const treeData = [
    {
      key: 'eng',
      title: 'Engineering',
      children: [
        { key: 'fe', title: 'Frontend' },
        { key: 'be', title: 'Backend' },
      ],
    },
    { key: 'ops', title: 'Operations' },
  ]
  const activeNode = () => document.querySelector('.ant-tree-treenode-active')?.textContent

  it('Tab 聚焦树，↑ / ↓ 在节点间移动，→ 展开、← 收起，Enter 选择', async () => {
    const onSelect = vi.fn()
    const onExpand = vi.fn()
    await render(<Tree treeData={treeData} onSelect={(k) => onSelect(k)} onExpand={onExpand} />)
    await userEvent.tab()
    expect(focused()?.getAttribute('role')).toBe('tree')
    await userEvent.keyboard('{ArrowDown}')
    const first = activeNode()
    expect(['Engineering', 'Operations']).toContain(first)
    if (first !== 'Engineering') await userEvent.keyboard('{ArrowUp}')
    await expect.poll(activeNode).toBe('Engineering')
    await userEvent.keyboard('{ArrowRight}')
    expect(onExpand).toHaveBeenLastCalledWith(['eng'])
    await userEvent.keyboard('{ArrowDown}')
    await expect.poll(activeNode).toBe('Frontend')
    await userEvent.keyboard('{Enter}')
    expect(onSelect).toHaveBeenLastCalledWith(['fe'])
    await userEvent.keyboard('{ArrowUp}{ArrowLeft}')
    expect(onExpand).toHaveBeenLastCalledWith([])
    await expect.element(page.getByText('Frontend')).not.toBeInTheDocument()
  })
})
