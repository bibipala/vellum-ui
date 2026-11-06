/**
 * Sources 与 Citation 在真实浏览器中的行为：
 * - Sources：默认收起为「N 个来源」；按钮的焦点环、Enter / 空格切换、aria-expanded / aria-controls；
 *   列表的编号、标题链接（协议白名单、target 与 rel）、域名、说明；不加载远程网站图标；
 * - Citation：悬停与键盘聚焦弹出卡片（标题、域名、说明），离开、失焦、Esc 关闭，不移动焦点；
 *   有安全地址时编号是链接，否则是按钮；
 * - Markdown 的 `sources`：`[1]` 渲染为 Citation，没有来源的编号保持文字；流式到达时同样渲染。
 */
import { describe, expect, it } from 'vitest'
import { Citation, Markdown, type SourceItem, Sources } from '../../src/index.ts'
import {
  css,
  expectFocusRing,
  focused,
  page,
  parkPointer,
  render,
  sameColor,
  token,
  userEvent,
} from './render.tsx'

const SOURCES: readonly SourceItem[] = [
  {
    title: 'Shipping small releases',
    url: 'https://www.example.com/blog/shipping',
    description: 'Why weekly releases find problems earlier.',
  },
  { title: 'Checklist', url: '/docs/checklist' },
  { title: 'Unsafe source', url: 'javascript:alert(1)', description: 'Should not be a link.' },
]

const card = () => document.querySelector('[data-citation-card]')
const cardOpen = () => {
  const c = card()
  const popover = c?.closest('.ant-popover')
  return Boolean(popover && !popover.classList.contains('ant-popover-hidden'))
}

describe('Sources', () => {
  it('默认收起为「3 sources」；键盘展开后显示编号、标题链接、域名与说明', async () => {
    await render(<Sources testId="s" items={SOURCES} />)
    const b = page.getByRole('button', { name: '3 sources' }).element() as HTMLButtonElement
    const list = () => document.getElementById(b.getAttribute('aria-controls') ?? '') as HTMLElement
    expect(b.getAttribute('aria-expanded')).toBe('false')
    expect(list().hidden).toBe(true)
    await userEvent.tab()
    expect(focused()).toBe(b)
    expectFocusRing(b, 2)
    await userEvent.keyboard('{Enter}')
    expect(b.getAttribute('aria-expanded')).toBe('true')
    expect(list().hidden).toBe(false)
    expect(list().tagName).toBe('OL')
    const items = [...list().querySelectorAll('li')]
    expect(items.map((li) => li.firstElementChild?.textContent)).toEqual(['1', '2', '3'])
    const links = [...list().querySelectorAll('a')]
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      'https://www.example.com/blog/shipping',
      '/docs/checklist',
    ])
    expect(links[0]?.getAttribute('target')).toBe('_blank')
    expect(links[0]?.getAttribute('rel')).toBe('noopener noreferrer')
    expect(links[1]?.hasAttribute('target')).toBe(false)
    // 不安全的地址：标题是文字，没有域名
    expect(items[2]?.querySelector('a')).toBeNull()
    expect(items[2]?.textContent).toContain('Unsafe source')
    expect(items[0]?.textContent).toContain('example.com')
    expect(items[0]?.textContent).toContain('Why weekly releases find problems earlier.')
    // 没有任何远程图片
    expect(document.querySelector('[data-testid="s"] img')).toBeNull()
    await userEvent.keyboard(' ')
    expect(b.getAttribute('aria-expanded')).toBe('false')
    expect(list().hidden).toBe(true)
  })

  it('一个来源时是「1 source」；悬停有状态层；没有来源时不渲染', async () => {
    const view = await render(<Sources testId="s" items={SOURCES.slice(0, 1)} />)
    const b = page.getByRole('button', { name: '1 source' }).element() as HTMLElement
    await userEvent.hover(b)
    await expect.poll(() => sameColor(css(b).backgroundColor, token('color-fill-hover'))).toBe(true)
    await view.rerender(<Sources testId="s" items={[]} />)
    expect(document.querySelector('[data-testid="s"]')).toBeNull()
  })

  it('中文：「3 个来源」', async () => {
    await render(<Sources items={SOURCES} />, { locale: 'zh-CN' })
    expect(page.getByRole('button', { name: '3 个来源' }).element()).toBeTruthy()
  })
})

describe('Citation', () => {
  it('悬停弹出卡片（标题、域名、说明），离开后关闭；编号是指向来源的链接', async () => {
    await render(
      <p>
        Claim
        <Citation index={1} source={SOURCES[0] as SourceItem} />
      </p>,
    )
    const marker = page.getByRole('link', { name: 'Source 1: Shipping small releases' }).element()
    expect(marker.textContent).toBe('1')
    expect(marker.getAttribute('href')).toBe('https://www.example.com/blog/shipping')
    expect(marker.getAttribute('target')).toBe('_blank')
    expect(marker.getAttribute('rel')).toBe('noopener noreferrer')
    expect(marker.closest('sup')).not.toBeNull()
    await userEvent.hover(marker)
    await expect.poll(cardOpen).toBe(true)
    expect(card()?.textContent).toContain('Shipping small releases')
    expect(card()?.textContent).toContain('example.com')
    expect(card()?.textContent).toContain('Why weekly releases find problems earlier.')
    await parkPointer()
    await expect.poll(cardOpen).toBe(false)
  })

  it('键盘聚焦弹出卡片，焦点留在编号上；Esc 关闭；Tab 离开后关闭', async () => {
    await render(
      <p>
        <input aria-label="Before" />
        Claim
        <Citation index={2} source={SOURCES[1] as SourceItem} />
        <input aria-label="After" />
      </p>,
    )
    await userEvent.click(page.getByRole('textbox', { name: 'Before' }))
    await userEvent.tab()
    const marker = page.getByRole('link', { name: 'Source 2: Checklist' }).element()
    expect(focused()).toBe(marker)
    expectFocusRing(marker, 2)
    await expect.poll(cardOpen).toBe(true)
    expect(focused()).toBe(marker)
    // 相对地址：当前页打开
    expect(marker.hasAttribute('target')).toBe(false)
    await userEvent.keyboard('{Escape}')
    await expect.poll(cardOpen).toBe(false)
    expect(focused()).toBe(marker)
    await userEvent.tab()
    expect(focused()).toBe(page.getByRole('textbox', { name: 'After' }).element())
    await expect.poll(cardOpen).toBe(false)
  })

  it('地址不安全时编号是按钮（不是链接），卡片照常显示', async () => {
    await render(<Citation index={3} source={SOURCES[2] as SourceItem} />)
    expect(document.querySelector('a')).toBeNull()
    const marker = page.getByRole('button', { name: 'Source 3: Unsafe source' }).element()
    await userEvent.hover(marker)
    await expect.poll(cardOpen).toBe(true)
    expect(card()?.textContent).toContain('Should not be a link.')
    // 没有域名（不是 http、https）
    expect(card()?.textContent).not.toContain('javascript')
  })
})

describe('Markdown 的 sources', () => {
  it('[1] 与 [^2] 渲染为 Citation，没有来源的 [9] 与链接 [1](…) 不受影响', async () => {
    const { container } = await render(
      <Markdown
        sources={SOURCES}
        content={
          'First [1], second [^2]: missing [9], link [1](https://example.com/x), raw <vl-citation data-index="1"></vl-citation>.'
        }
      />,
    )
    await expect.poll(() => container.querySelectorAll('[data-citation]').length).toBe(2)
    const markers = [...container.querySelectorAll('[data-citation]')]
    expect(markers.map((m) => m.getAttribute('aria-label'))).toEqual([
      'Source 1: Shipping small releases',
      'Source 2: Checklist',
    ])
    const text = container.textContent ?? ''
    expect(text).toContain(': missing [9]')
    // 普通链接不变；原文中的 <vl-citation> 是原始 HTML，显示为文字
    expect(container.querySelector('a[href="https://example.com/x"]')?.textContent).toBe(
      '1 (opens in a new tab)',
    )
    expect(text).toContain('<vl-citation data-index="1"></vl-citation>')
    await userEvent.hover(markers[0] as Element)
    await expect.poll(cardOpen).toBe(true)
  })

  it('没有 sources 时 [1] 保持为文字', async () => {
    const { container } = await render(<Markdown content="Plain [1] text" />)
    await expect
      .poll(() => container.querySelector('.x-markdown')?.textContent?.trim())
      .toBe('Plain [1] text')
    expect(container.querySelector('[data-citation]')).toBeNull()
  })

  it('流式到达时引用同样渲染为 Citation', async () => {
    const view = await render(<Markdown sources={SOURCES} content="Weekly releases [" streaming />)
    await view.rerender(<Markdown sources={SOURCES} content="Weekly releases [1] help" streaming />)
    await view.rerender(
      <Markdown sources={SOURCES} content={'Weekly releases [1] help.\n\nMore text'} streaming />,
    )
    await expect.poll(() => view.container.querySelectorAll('[data-citation]').length).toBe(1)
    await view.rerender(
      <Markdown sources={SOURCES} content={'Weekly releases [1] help.\n\nMore text.'} />,
    )
    await expect.poll(() => view.container.querySelectorAll('[data-citation]').length).toBe(1)
  })
})
