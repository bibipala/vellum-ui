/**
 * Markdown 渲染器按需加载（第一次渲染时才 `import()` XMarkdown）：加载完成之前显示转义后的纯文本（流式时带光标），
 * 内容立即可见；加载完成后换成 Markdown，之后的 Markdown 直接渲染，不再经过纯文本。
 *
 * 本文件的第一个用例必须在渲染器还没有加载时运行（每个测试文件在自己的页面中运行，模块状态互不影响）。
 */
import { describe, expect, it } from 'vitest'
import { Markdown } from '../../src/index.ts'
import { render } from './render.tsx'

type XssWindow = typeof window & { __xss?: number }

describe('Markdown：渲染器按需加载', () => {
  it('加载完成之前：转义后的纯文本立即可见（保留换行，流式时带光标），之后换成 Markdown', async () => {
    const content = '**Bold** line\n<img src=x onerror="window.__xss=1">'
    const { container } = await render(<Markdown content={content} streaming />)
    // 渲染后立即断言（不等待）：渲染器还在加载，显示纯文本
    const fallback = container.querySelector('[data-markdown-fallback]') as HTMLElement
    expect(fallback).not.toBeNull()
    expect(fallback.textContent).toBe(content)
    expect(fallback.getAttribute('aria-busy')).toBe('true')
    expect(fallback.querySelector('img')).toBeNull()
    expect(fallback.querySelector('[data-stream-cursor]')).not.toBeNull()
    expect(getComputedStyle(fallback.firstElementChild as Element).whiteSpace).toBe('pre-wrap')
    await expect.poll(() => container.querySelector('strong')?.textContent).toBe('Bold')
    expect(container.querySelector('[data-markdown-fallback]')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect((window as XssWindow).__xss).toBeUndefined()
  })

  it('已经加载过：直接渲染 Markdown，不经过纯文本', async () => {
    const { container } = await render(<Markdown content="**Again**" />)
    expect(container.querySelector('[data-markdown-fallback]')).toBeNull()
    await expect.poll(() => container.querySelector('strong')?.textContent).toBe('Again')
  })
})
