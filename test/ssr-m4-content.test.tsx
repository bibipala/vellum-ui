/**
 * 服务端渲染（M4 内容类组件）：没有 window、document 时渲染不报错。
 * - Markdown：XMarkdown 的清洗需要 DOM，服务端输出转义后的纯文本（保留原文，由 React 转义），不输出任何
 *   原始 HTML 标签；注水后才换成 Markdown（浏览器测试检查注水没有不一致的警告）。
 * - StreamingText：服务端输出全文（逐字放出只在浏览器中进行），流式时带光标与 aria-busy。
 * - Reasoning、ToolCalls（基于 Ant Design X）：标题按钮带 aria-expanded / aria-controls，状态有文字。
 * - Sources、Citation：列表默认收起，链接走协议白名单；引用的弹层在服务端不输出。
 * - FilePreview：弹出式在服务端不输出；嵌入式输出文件名、大小与预览区。
 */
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  Citation,
  CodeBlock,
  FilePreview,
  Markdown,
  Reasoning,
  Sources,
  StreamingText,
  ThemeProvider,
  ToolCalls,
} from '../src/index.ts'

afterEach(() => {
  vi.restoreAllMocks()
})

const XSS = `# Title

<script>alert(1)</script> <img src=x onerror=alert(1)> <iframe src="https://evil.example"></iframe>
<style>body{display:none}</style>

[a](javascript:alert(1)) <javascript:alert(2)>`

describe('服务端渲染（M4 内容类组件）', () => {
  it('没有浏览器对象时渲染：Markdown 输出转义后的纯文本，没有任何原始 HTML 标签', () => {
    expect(typeof window).toBe('undefined')
    expect(typeof document).toBe('undefined')
    const error = vi.spyOn(console, 'error')
    const html = renderToString(
      <ThemeProvider locale="en-US">
        <Markdown content={XSS} testId="md" />
      </ThemeProvider>,
    )
    expect(html).toContain('data-markdown-fallback=""')
    expect(html).toContain('# Title')
    // 原文中的标签全部转义为文字
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(html).toContain('&lt;iframe')
    expect(html).toContain('&lt;style&gt;')
    expect(html).not.toMatch(/<(script|img|iframe|style)\b/i)
    expect(html).not.toMatch(/<a\b/i)
    expect(html).not.toContain('href=')
    expect(error).not.toHaveBeenCalled()
  })

  it('流式时：Markdown 与 StreamingText 都带光标与 aria-busy；StreamingText 输出全文', () => {
    const error = vi.spyOn(console, 'error')
    const html = renderToString(
      <ThemeProvider locale="en-US">
        <Markdown content="Writing **now" streaming testId="md" />
        <StreamingText text={'Line one\nLine two'} streaming testId="st" />
        <StreamingText text="Done" testId="done" />
      </ThemeProvider>,
    )
    expect(html).toMatch(/data-testid="md"[^>]*aria-busy="true"/)
    expect(html).toMatch(/data-testid="st"[^>]*aria-busy="true"/)
    expect(html).toContain('Line one\nLine two')
    expect(html.match(/data-stream-cursor/g)).toHaveLength(2)
    expect(html).toMatch(/data-testid="done"[^>]*>Done<\/span>/)
    expect(error).not.toHaveBeenCalled()
  })

  it('CodeBlock 的语言标题行', () => {
    const html = renderToString(<CodeBlock code="const a = 1" language="ts" copyable testId="cb" />)
    expect(html).toMatch(/data-header=""[^>]*data-testid="cb"/)
    expect(html).toContain('>ts</span>')
    expect(html).toContain('<code>const a = 1</code>')
    // 有标题行时复制按钮在标题行中，代码不再为它留出位置
    expect(html).not.toContain('data-copyable')
  })

  it('Reasoning：思考中展开、标题为「Thinking」；已完成收起，用时本地化', () => {
    const error = vi.spyOn(console, 'error')
    const html = renderToString(
      <ThemeProvider locale="en-US">
        <Reasoning thinking testId="r1">
          Working it out
        </Reasoning>
        <Reasoning duration={12_400} testId="r2">
          Hidden thoughts
        </Reasoning>
        <Reasoning testId="r3">Old thoughts</Reasoning>
      </ThemeProvider>,
    )
    expect(html).toMatch(/aria-expanded="true"[^>]*>.*?Thinking/)
    expect(html).toContain('Working it out')
    expect(html).toMatch(/aria-expanded="false"[^>]*aria-controls="[^"]+"/)
    expect(html).toContain('Thought for 12s')
    expect(html).toContain('Thought process')
    // 一开始就收起的内容在第一次展开前不输出
    expect(html).not.toContain('Hidden thoughts')
    const zh = renderToString(
      <ThemeProvider locale="zh-CN">
        <Reasoning duration={95_000}>x</Reasoning>
      </ThemeProvider>,
    )
    expect(zh).toContain('已思考 1 分 35 秒')
    expect(error).not.toHaveBeenCalled()
  })

  it('ToolCalls：每步的状态有图标与文字；有详情的步骤标题是按钮；失败原因直接显示', () => {
    const error = vi.spyOn(console, 'error')
    const html = renderToString(
      <ThemeProvider locale="en-US">
        <ToolCalls
          testId="tc"
          items={[
            { key: 'a', title: 'Search', status: 'running', input: { q: 'x' } },
            { key: 'b', title: 'Read', status: 'error', error: 'Not found' },
            { key: 'c', title: 'Write', status: 'pending' },
            { key: 'd', title: 'Send', status: 'success' },
            { key: 'e', title: 'Stop', status: 'cancelled' },
          ]}
        />
      </ThemeProvider>,
    )
    for (const text of ['Running', 'Failed', 'Waiting', 'Done', 'Cancelled'])
      expect(html).toContain(`>${text}</span>`)
    expect(html.match(/<button/g)).toHaveLength(1)
    expect(html).toMatch(/<button[^>]*aria-expanded="false"[^>]*aria-controls="[^"]+"/)
    expect(html).toContain('Not found')
    expect(error).not.toHaveBeenCalled()
  })

  it('Sources 与 Citation：收起的列表、编号与链接；不安全的地址不是链接', () => {
    const error = vi.spyOn(console, 'error')
    const items = [
      { title: 'Guide', url: 'https://www.example.com/guide', description: 'How to start' },
      { title: 'Bad', url: 'javascript:alert(1)' },
    ]
    const html = renderToString(
      <ThemeProvider locale="en-US">
        <Sources testId="s" items={items} />
        <Citation index={1} source={items[0] as (typeof items)[number]} />
        <Citation index={2} source={items[1] as (typeof items)[number]} />
        <Markdown content="See [1]" sources={items} />
      </ThemeProvider>,
    )
    expect(html).toMatch(/<button[^>]*aria-expanded="false"[^>]*aria-controls="[^"]+"/)
    expect(html).toContain('2 sources')
    // 收起：列表在收起的容器里（没有 data-expanded，样式上 visibility: hidden、高度为 0）
    expect(html).toMatch(/<div class="[^"]*collapse[^"]*"><div[^>]*><ol/)
    expect(html).not.toContain('data-expanded')
    expect(html).toContain('example.com')
    expect(html).not.toContain('javascript:')
    expect(html).toMatch(
      /<a[^>]*href="https:\/\/www.example.com\/guide"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/,
    )
    expect(html).toContain('aria-label="Source 1: Guide"')
    expect(html).toMatch(/<button[^>]*aria-label="Source 2: Bad"/)
    // Markdown 服务端输出纯文本，引用在注水后才渲染
    expect(html).toContain('See [1]')
    expect(error).not.toHaveBeenCalled()
  })
  it('FilePreview：弹出式在服务端不输出；嵌入式输出文件名与预览区（文本在注水后读取）', () => {
    const error = vi.spyOn(console, 'error')
    const html = renderToString(
      <ThemeProvider locale="en-US">
        <FilePreview
          open
          items={[{ id: 'a', name: 'a.txt', content: 'hello' }]}
          index={0}
          onClose={() => {}}
        />
        <FilePreview.Inline item={{ id: 'p', name: 'photo.png', src: '/photo.png', size: 2048 }} />
        <FilePreview.Inline item={null} />
      </ThemeProvider>,
    )
    expect(html).not.toContain('role="dialog"')
    expect(html).toContain('aria-label="photo.png"')
    expect(html).toContain('2.0 KB')
    expect(html).toContain('src="/photo.png"')
    expect(html).toContain('No file selected')
    expect(error).not.toHaveBeenCalled()
  })
})
