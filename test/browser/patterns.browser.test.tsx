/**
 * 页面级模式与布局在真实浏览器中的行为：
 * - Page / PageHeader：返回操作（链接或按钮、读屏名称、键盘可达、与标题第一行对齐），标题可用代码聚焦且不在 Tab 顺序中；
 */
import { useRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Button, Page, PageHeader } from '../../src/index.ts'
import { css, expectFocusRing, focused, page, render, userEvent } from './render.tsx'

describe('Page 的返回操作', () => {
  it('href：输出为链接，读屏名称是 label，在标题之前、操作之前到达', async () => {
    await render(
      <Page
        title="Website redesign"
        back={{ label: 'Back to projects', href: '#projects' }}
        actions={<Button>Edit</Button>}
      />,
    )
    const back = page.getByRole('link', { name: 'Back to projects' })
    await expect.element(back).toHaveAttribute('href', '#projects')
    await userEvent.tab()
    expect(focused()).toBe(back.element())
    expectFocusRing(back.element(), 2)
    await userEvent.tab()
    expect(focused()).toBe(page.getByRole('button', { name: 'Edit' }).element())
    // 图标与标题的第一行垂直居中
    const title = page.getByRole('heading', { level: 1 }).element()
    const b = back.element().getBoundingClientRect()
    const lineHeight = Number.parseFloat(css(title).lineHeight)
    const t = title.getBoundingClientRect()
    expect(Math.abs(b.top + b.height / 2 - (t.top + lineHeight / 2))).toBeLessThan(1)
    // 返回操作在标题之前
    expect(b.right).toBeLessThanOrEqual(t.left)
  })

  it('onClick：输出为按钮，点击与 Enter 都调用', async () => {
    const onClick = vi.fn()
    await render(<PageHeader title="Members" back={{ label: 'Back to teams', onClick }} />)
    const back = page.getByRole('button', { name: 'Back to teams' })
    await userEvent.click(back)
    expect(onClick).toHaveBeenCalledOnce()
    back.element().focus()
    await userEvent.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalledTimes(2)
  })

  it('没有 back 时没有返回操作', async () => {
    await render(<Page title="Projects" />)
    expect(document.querySelector('header a, header button')).toBeNull()
  })
})

/** 模拟路由切换：点 Navigate 后聚焦新页面的标题。 */
function Routed() {
  const titleRef = useRef<HTMLHeadingElement>(null)
  return (
    <>
      <Button onClick={() => titleRef.current?.focus()}>Navigate</Button>
      <Page title="Project details" titleRef={titleRef} actions={<Button>Edit</Button>} />
    </>
  )
}

describe('Page 的标题', () => {
  it('titleRef 指向 h1，可以用代码聚焦（不显示焦点环），但不在 Tab 顺序中', async () => {
    await render(<Routed />)
    const title = page.getByRole('heading', { level: 1, name: 'Project details' }).element()
    await userEvent.tab()
    await userEvent.tab()
    // Tab 从 Navigate 直接到 Edit，跳过标题
    expect(focused()).toBe(page.getByRole('button', { name: 'Edit' }).element())
    await userEvent.click(page.getByRole('button', { name: 'Navigate' }))
    expect(focused()).toBe(title)
    expect(css(title).outlineStyle).toBe('none')
    // 聚焦标题后，下一次 Tab 从标题之后开始
    await userEvent.tab()
    expect(focused()).toBe(page.getByRole('button', { name: 'Edit' }).element())
  })
})
