/**
 * Markdown 在真实浏览器中的行为：
 * - 排版：标题、列表、任务列表、引用、表格、行内代码、代码块（CodeBlock：语言 + 复制按钮）；
 * - 安全（XSS）：原始 HTML 一律显示为文字；`javascript:` 等链接（Markdown 链接、自动链接、引用式链接、实体编码）
 *   渲染为纯文字；外部链接带 target 与 rel；远程图片默认不加载，allowImage 决定；
 * - 流式：写到一半的语法按写完显示、结尾光标、aria-busy；流结束后光标消失；打字机与减少动态效果；
 * - 宽表格：需要滚动时才可以聚焦（焦点环），窄表格不多出 Tab 停留点；
 * - 服务端渲染后注水：没有注水不一致的报错，注水后换成 Markdown。
 *
 * 流式渲染的性能预算在 `test/browser/perf/markdown-stream.browser.test.tsx`（单独运行：`pnpm test:perf`）。
 */
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Markdown, ThemeProvider } from '../../src/index.ts'
import {
  expectFocusRing,
  focused,
  inAct,
  luminance,
  nextFrame,
  page,
  render,
  sameColor,
  token,
  userEvent,
} from './render.tsx'

type XssWindow = typeof window & { __xss?: number }

afterEach(() => {
  vi.restoreAllMocks()
  delete (window as XssWindow).__xss
})

const md = (container: HTMLElement) => container.querySelector('.x-markdown') as HTMLElement

/** 流式光标：样式画在最后一段文字之后（::after），返回画着光标的元素。 */
function cursorHost(root: Element): Element | undefined {
  return [...root.querySelectorAll('*')].find((el) => {
    const s = getComputedStyle(el, '::after')
    return (
      s.content !== 'none' &&
      s.content !== 'normal' &&
      s.display === 'inline-block' &&
      sameColor(s.backgroundColor, token('color-text-tertiary'))
    )
  })
}

/** 等待 XMarkdown 渲染出内容（注水后才渲染）。 */
async function rendered(container: HTMLElement) {
  await expect.poll(() => container.querySelector('.x-markdown')).not.toBeNull()
  return md(container)
}

describe('Markdown：排版', () => {
  it('标题、列表、任务列表、引用、行内代码、表格与代码块', async () => {
    const { container } = await render(
      <Markdown
        testId="md"
        content={[
          '# Title',
          '',
          '## Section',
          '',
          'Some **bold**, *italic*, ~~gone~~ and `inline` code.',
          '',
          '- one',
          '- two',
          '',
          '1. first',
          '2. second',
          '',
          '- [x] done',
          '- [ ] open',
          '',
          '> Quoted text',
          '',
          '| A | B |',
          '| --- | ---: |',
          '| x | 1 |',
          '',
          '```ts title="a.ts"',
          'const a = 1',
          '```',
          '',
          '---',
        ].join('\n')}
      />,
    )
    const root = await rendered(container)
    expect(root.querySelector('h1')?.textContent).toBe('Title')
    expect(root.querySelector('h2')?.textContent).toBe('Section')
    // 标题克制：h1 只比正文大两档（20px），h2 16px
    expect(getComputedStyle(root.querySelector('h1') as Element).fontSize).toBe('20px')
    expect(getComputedStyle(root.querySelector('h2') as Element).fontSize).toBe('16px')
    expect(getComputedStyle(root.querySelector('p') as Element).fontSize).toBe('14px')
    expect(root.querySelector('strong')?.textContent).toBe('bold')
    expect(root.querySelector('del')?.textContent).toBe('gone')
    expect(root.querySelectorAll('ul > li').length).toBeGreaterThanOrEqual(2)
    expect(root.querySelectorAll('ol > li')).toHaveLength(2)
    expect(getComputedStyle(root.querySelector('ul') as Element).listStyleType).toBe('disc')
    const boxes = root.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
    expect(boxes).toHaveLength(2)
    expect(boxes[0]?.checked).toBe(true)
    expect(boxes[0]?.disabled).toBe(true)
    expect(root.querySelector('blockquote')?.textContent?.trim()).toBe('Quoted text')
    // 行内代码：等宽字体、中性填充
    const inline = root.querySelector('p code') as HTMLElement
    expect(inline.textContent).toBe('inline')
    expect(getComputedStyle(inline).fontFamily).toContain('JetBrains Mono')
    expect(getComputedStyle(inline).backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
    // 表格：行间分隔线，没有外框
    const table = root.querySelector('table') as HTMLElement
    expect(table.querySelectorAll('th')).toHaveLength(2)
    expect(getComputedStyle(table.querySelector('th') as Element).borderBottomStyle).toBe('solid')
    expect(getComputedStyle(table.querySelector('th') as Element).borderTopStyle).toBe('none')
    expect(getComputedStyle(table.querySelector('td') as Element).borderLeftStyle).toBe('none')
    // 代码块：CodeBlock，语言来自 info string 的第一个词，可复制；保留换行、不自动换行
    const block = root.querySelector('[data-markdown-code] [data-header]') as HTMLElement
    expect(block.textContent).toContain('ts')
    expect(block.querySelector('pre')?.textContent).toBe('const a = 1')
    expect(getComputedStyle(block.querySelector('pre') as Element).whiteSpace).toBe('pre')
    expect(page.getByRole('button', { name: 'Copy' }).element()).toBeTruthy()
    expect(root.querySelector('hr')).not.toBeNull()
  })

  it('深色模式下文字与填充取深色令牌', async () => {
    const { container } = await render(<Markdown content={'Text and `code`'} />, {
      defaultColorMode: 'dark',
    })
    const root = await rendered(container)
    const p = root.querySelector('p') as HTMLElement
    // 深色模式的正文是浅色文字，取正文色令牌；行内代码是深色的中性填充
    expect(sameColor(getComputedStyle(p).color, token('color-text-primary'))).toBe(true)
    expect(luminance(getComputedStyle(p).color)).toBeGreaterThan(0.6)
    const code = root.querySelector('code') as HTMLElement
    expect(sameColor(getComputedStyle(code).backgroundColor, token('color-fill'))).toBe(true)
    expect(luminance(getComputedStyle(code).backgroundColor)).toBeLessThan(0.1)
  })
})

describe('Markdown：安全', () => {
  const XSS = [
    'Raw: <script>window.__xss = 1</script> <img src=x onerror="window.__xss = 2"> <b>bold?</b>',
    '',
    '<iframe src="javascript:window.__xss = 3"></iframe>',
    '',
    '<style>body { display: none }</style>',
    '',
    '<a href="javascript:window.__xss = 4">html link</a>',
    '',
    '[md link](javascript:window.__xss=5) [upper](JaVaScRiPt:window.__xss=6) [entity](jav&#x61;script:window.__xss=7)',
    '',
    '[data](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==) [vb](vbscript:msgbox) [spaced]( javascript:alert(1))',
    '',
    'Autolink <javascript:window.__xss=8> and [ref][evil].',
    '',
    '[evil]: javascript:window.__xss=9',
  ].join('\n')

  it('原始 HTML 显示为文字；script、img、iframe、style 都不会成为元素', async () => {
    const { container } = await render(<Markdown testId="md" content={XSS} />)
    const root = await rendered(container)
    for (const tag of ['script', 'img', 'iframe', 'style', 'b', 'object', 'embed'])
      expect(root.querySelector(tag), tag).toBeNull()
    expect(root.textContent).toContain('<script>window.__xss = 1</script>')
    expect(root.textContent).toContain('<img src=x onerror="window.__xss = 2">')
    expect(root.textContent).toContain('<iframe src="javascript:window.__xss = 3"></iframe>')
    expect(root.textContent).toContain('<style>body { display: none }</style>')
    // 没有任何事件属性；页面没有被隐藏，脚本没有执行
    for (const el of root.querySelectorAll('*'))
      for (const a of el.attributes)
        expect(a.name.startsWith('on'), `${el.tagName} ${a.name}`).toBe(false)
    expect(getComputedStyle(document.body).display).not.toBe('none')
    await new Promise((r) => setTimeout(r, 50))
    expect((window as XssWindow).__xss).toBeUndefined()
  })

  it('不安全的链接（Markdown 链接、自动链接、引用式链接、大小写、实体编码、data:、vbscript:）渲染为纯文字', async () => {
    const { container } = await render(<Markdown content={XSS} />)
    const root = await rendered(container)
    // 页面上没有任何不安全的 href
    for (const a of root.querySelectorAll('a')) {
      const href = a.getAttribute('href') ?? ''
      expect(href, a.outerHTML).not.toMatch(/^\s*(javascript|data|vbscript):/i)
    }
    const blocked = [...root.querySelectorAll('[data-markdown-link="blocked"]')].map(
      (e) => e.textContent,
    )
    expect(blocked).toEqual(
      expect.arrayContaining(['md link', 'upper', 'entity', 'data', 'vb', 'ref']),
    )
    // 自动链接 <javascript:…>：文字保留，不是链接
    expect(root.textContent).toContain('javascript:window.__xss=8')
    expect([...root.querySelectorAll('a')].some((a) => a.textContent?.includes('__xss=8'))).toBe(
      false,
    )
    // 点击被拦下的「链接」不会执行任何东西
    await userEvent.click(page.getByText('md link'))
    expect((window as XssWindow).__xss).toBeUndefined()
  })

  it('外部链接在新标签页打开（noopener noreferrer），读屏读出提示；相对地址与 mailto 在当前页', async () => {
    const { container } = await render(
      <Markdown
        content={
          '[docs](https://example.com/docs "Docs") https://example.org/x [local](/settings) [mail](mailto:a@example.com)'
        }
      />,
    )
    const root = await rendered(container)
    const links = [...root.querySelectorAll('a')]
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      'https://example.com/docs',
      'https://example.org/x',
      '/settings',
      'mailto:a@example.com',
    ])
    const [docs, auto, local, mail] = links
    for (const a of [docs, auto]) {
      expect(a?.getAttribute('target')).toBe('_blank')
      expect(a?.getAttribute('rel')).toBe('noopener noreferrer')
    }
    expect(docs?.getAttribute('title')).toBe('Docs')
    expect(docs?.textContent).toBe('docs (opens in a new tab)')
    for (const a of [local, mail]) {
      expect(a?.hasAttribute('target')).toBe(false)
      expect(a?.hasAttribute('rel')).toBe(false)
    }
    // 链接有下划线（不只靠颜色区分），键盘焦点环
    expect(getComputedStyle(docs as Element).textDecorationLine).toBe('underline')
    await userEvent.tab()
    expect(focused()).toBe(docs)
    expectFocusRing(docs as Element, 2)
  })

  it('远程图片默认不加载：显示替代文字与指向图片的链接；allowImage 允许的才加载（不发送来源页）；data: 永远不加载', async () => {
    const content = [
      '![Chart](https://images.example.com/chart.png?d=secret)',
      '',
      '![](https://images.example.com/no-alt.png)',
      '',
      '![Inline data](data:image/png;base64,iVBORw0KGgo=)',
      '',
      '![Logo](https://assets.example.com/logo.png)',
    ].join('\n')
    const first = await render(<Markdown content={content} />)
    let root = await rendered(first.container)
    expect(root.querySelector('img')).toBeNull()
    const refs = [...root.querySelectorAll('[data-markdown-image="blocked"]')]
    expect(refs.map((r) => r.textContent)).toEqual([
      'Chart (opens in a new tab)',
      'Image (opens in a new tab)',
      'Inline data',
      'Logo (opens in a new tab)',
    ])
    expect(refs[0]?.querySelector('a')?.getAttribute('href')).toBe(
      'https://images.example.com/chart.png?d=secret',
    )
    expect(refs[2]?.querySelector('a')).toBeNull()
    await first.unmount()

    const allow = vi.fn(
      (src: string) => src.startsWith('https://assets.example.com/') || src.startsWith('data:'),
    )
    const second = await render(<Markdown content={content} allowImage={allow} />)
    root = await rendered(second.container)
    const imgs = [...root.querySelectorAll('img')]
    expect(imgs.map((i) => i.getAttribute('src'))).toEqual(['https://assets.example.com/logo.png'])
    expect(imgs[0]?.getAttribute('alt')).toBe('Logo')
    expect(imgs[0]?.getAttribute('referrerpolicy')).toBe('no-referrer')
    // data: 地址根本不会交给 allowImage
    expect(allow.mock.calls.map(([src]) => src).some((s) => s.startsWith('data:'))).toBe(false)
  })
})

describe('Markdown：流式', () => {
  it('写到一半的语法按写完显示；流式时有光标与 aria-busy，结束后光标消失', async () => {
    const view = await render(<Markdown testId="md" content="Hello **wor" streaming />)
    const root = await rendered(view.container)
    const el = page.getByTestId('md').element()
    expect(el.getAttribute('aria-busy')).toBe('true')
    await expect.poll(() => root.querySelector('strong')?.textContent).toBe('wor')
    expect(cursorHost(root)?.tagName).toBe('P')
    // 链接的文字先于地址出现
    await view.rerender(
      <Markdown testId="md" content="Hello **world** see [the docs](https://exa" streaming />,
    )
    await expect.poll(() => md(view.container).textContent).toContain('the docs')
    await view.rerender(
      <Markdown testId="md" content="Hello **world** see [the docs](https://example.com)." />,
    )
    await expect.poll(() => cursorHost(md(view.container))).toBeUndefined()
    expect(el.hasAttribute('aria-busy')).toBe(false)
    expect(md(view.container).querySelector('a')?.getAttribute('href')).toBe('https://example.com')
  })

  it('光标在最后一段文字之后：段落、标题、列表（含嵌套）的最后一项、引用；代码块之后没有光标', async () => {
    const cases: [string, string | undefined][] = [
      ['Para one\n\nPara two', 'Para two'],
      ['# Heading', 'Heading'],
      ['- a\n- b', 'b'],
      ['- a\n  - nested', 'nested'],
      ['> quoted', 'quoted'],
      ['Text\n\n```\ncode', undefined],
    ]
    for (const [content, expected] of cases) {
      const view = await render(<Markdown content={content} streaming />)
      const root = await rendered(view.container)
      await expect.poll(() => root.textContent?.length ?? 0).toBeGreaterThan(0)
      expect(cursorHost(root)?.textContent?.trim(), content).toBe(expected)
      await view.unmount()
    }
  })

  it('还没有内容时只显示光标', async () => {
    const view = await render(<Markdown testId="md" content="" streaming />)
    expect(view.container.querySelector('[data-stream-cursor]')).not.toBeNull()
    await view.rerender(<Markdown testId="md" content="" />)
    expect(view.container.querySelector('[data-stream-cursor]')).toBeNull()
  })

  it('typewriter：新内容逐字放出，流结束立即放完；减少动态效果时直接显示', async () => {
    const long = `Start. ${'The quick brown fox jumps over the lazy dog. '.repeat(8)}`
    const view = await render(<Markdown content="Start." streaming typewriter />)
    await rendered(view.container)
    await view.rerender(<Markdown content={long} streaming typewriter />)
    await nextFrame()
    const partial = md(view.container).textContent?.length ?? 0
    expect(partial).toBeLessThan(long.trim().length)
    await expect.poll(() => md(view.container).textContent?.length ?? 0).toBeGreaterThan(partial)
    await view.rerender(<Markdown content={`${long}End.`} />)
    await expect.poll(() => md(view.container).textContent?.trim()).toBe(`${long}End.`.trim())
    await view.unmount()

    const reduced = await render(<Markdown content="Start." streaming typewriter />, {
      reducedMotion: true,
    })
    await rendered(reduced.container)
    await reduced.rerender(<Markdown content={long} streaming typewriter />)
    await nextFrame()
    expect(md(reduced.container).textContent?.trim()).toBe(long.trim())
  })
})

describe('Markdown：宽表格', () => {
  it('需要横向滚动时外框可以用 Tab 聚焦（焦点环、读屏名称），窄表格不可聚焦', async () => {
    const wide = `| ${Array.from({ length: 14 }, (_, i) => `Column ${i + 1}`).join(' | ')} |\n|${' --- |'.repeat(14)}\n| ${Array.from({ length: 14 }, () => 'value_without_breaks').join(' | ')} |`
    const narrow = '| A | B |\n| --- | --- |\n| 1 | 2 |'
    await render(
      <div style={{ width: 480 }}>
        <Markdown content={`${narrow}\n\n${wide}`} />
      </div>,
    )
    await expect.poll(() => document.querySelectorAll('[data-scrollable]').length).toBe(1)
    const scroller = document.querySelector('[data-scrollable]') as HTMLElement
    expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth)
    expect(scroller.getAttribute('role')).toBe('region')
    expect(scroller.getAttribute('aria-label')).toBe('Table')
    await userEvent.tab()
    expect(focused()).toBe(scroller)
    expectFocusRing(scroller, 2)
    await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}')
    await expect.poll(() => scroller.scrollLeft).toBeGreaterThan(0)
  })
})

describe('Markdown：服务端渲染后注水', () => {
  it('注水没有不一致的报错；注水后换成 Markdown', async () => {
    const ui = (
      <ThemeProvider defaultColorMode="light" locale="en-US">
        <Markdown testId="hydrated" content={'**Bold** and <script>window.__xss = 10</script>'} />
      </ThemeProvider>
    )
    const container = document.createElement('div')
    container.innerHTML = renderToString(ui)
    document.body.appendChild(container)
    expect(container.querySelector('[data-markdown-fallback]')?.textContent).toBe(
      '**Bold** and <script>window.__xss = 10</script>',
    )
    const error = vi.spyOn(console, 'error')
    const recoverable = vi.fn()
    let root: ReturnType<typeof hydrateRoot> | undefined
    await inAct(() => {
      root = hydrateRoot(container, ui, { onRecoverableError: recoverable })
    })
    await expect.poll(() => container.querySelector('strong')?.textContent).toBe('Bold')
    expect(container.querySelector('[data-markdown-fallback]')).toBeNull()
    expect(container.querySelector('script')).toBeNull()
    expect(recoverable).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
    expect((window as XssWindow).__xss).toBeUndefined()
    await inAct(() => root?.unmount())
    container.remove()
  })
})
