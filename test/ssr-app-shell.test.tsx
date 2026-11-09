/**
 * 服务端渲染：AppShell 与 Nav 在没有 window、document 的环境中渲染（Node），模块顶层不访问浏览器对象；
 * 宽窄在服务端未知，布局由容器查询决定，所以输出与宽度无关。另外核对断点：960px = page-width-narrow +
 * split-aside-sm，JS 与 CSS 中写的是同一个值。
 */
import { readFileSync } from 'node:fs'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { APP_SHELL_NARROW_BELOW } from '../src/components/appShellContext.ts'
import { AppShell, componentTokens, Nav, ThemeProvider } from '../src/index.ts'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('服务端渲染（AppShell、Nav）', () => {
  it('没有浏览器对象时输出跳转链接、header、nav、main 与当前项', () => {
    expect(typeof window).toBe('undefined')
    expect(typeof document).toBe('undefined')
    const error = vi.spyOn(console, 'error')
    const html = renderToString(
      <ThemeProvider locale="en-US">
        <AppShell
          mainId="content"
          header={
            <>
              <AppShell.Toggle />
              <span>Acme</span>
            </>
          }
          sidebar={
            <Nav
              value="inbox"
              items={[
                { key: 'home', label: 'Home', icon: 'home', href: '/' },
                {
                  type: 'group',
                  label: 'Workspace',
                  items: [{ key: 'inbox', label: 'Inbox', icon: 'inbox', count: 3 }],
                },
              ]}
            />
          }
        >
          <h1>Inbox</h1>
        </AppShell>
        <Nav collapsed items={[{ key: 'files', label: 'Files' }]} aria-label="Files" />
      </ThemeProvider>,
    )
    expect(html).toMatch(/^.*?<a[^>]*href="#content"[^>]*>Skip to content<\/a>/)
    expect(html).toContain('<header')
    expect(html).toMatch(/<nav[^>]*aria-label="Main"/)
    expect(html).toMatch(/<main[^>]*id="content"/)
    expect(html).toMatch(/<a[^>]*href="\/"[^>]*>/)
    expect(html).toMatch(/<button[^>]*aria-current="page"[^>]*>/)
    expect(html).toContain('aria-label="Collapse sidebar"')
    expect(html).toContain('<h1>Inbox</h1>')
    expect(html).toMatch(/<nav[^>]*aria-label="Files"/)
    expect(error).not.toHaveBeenCalled()
  })

  it('中文', () => {
    const html = renderToString(
      <ThemeProvider locale="zh-CN">
        <AppShell sidebar={<Nav items={[]} />}>
          <p>正文</p>
        </AppShell>
      </ThemeProvider>,
    )
    expect(html).toContain('跳到正文')
    expect(html).toContain('aria-label="主导航"')
  })

  it('窄布局的断点：窄页面加最窄的侧栏，JS 与 CSS 一致', () => {
    const tokens = componentTokens('comfortable')
    const px = (name: string) => Number.parseFloat(tokens[name] ?? '')
    expect(APP_SHELL_NARROW_BELOW).toBe(px('page-width-narrow') + px('split-aside-sm'))
    const css = readFileSync(
      new URL('../src/components/app-shell.module.css', import.meta.url),
      'utf8',
    )
    expect(css).toContain(`(min-width: ${APP_SHELL_NARROW_BELOW}px)`)
    expect(css).toContain(`(max-width: ${APP_SHELL_NARROW_BELOW - 0.02}px)`)
  })
})
