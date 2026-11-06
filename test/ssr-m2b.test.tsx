/**
 * 服务端渲染：M2b 的组件与 hook 在没有 window、document、navigator 的环境中渲染（Node，navigator 也去掉），
 * 模块顶层不访问浏览器对象（导入本身就在 Node 中进行）；与平台、本机存储、注册表有关的部分在服务端取默认值。
 */
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CodeBlock,
  CommandPalette,
  ContextMenu,
  CopyButton,
  Kbd,
  Splitter,
  ThemeProvider,
  useHotkeys,
  useRegisteredHotkeys,
} from '../src/index.ts'

afterEach(() => {
  vi.unstubAllGlobals()
})

function Hotkeys() {
  useHotkeys('mod+k', () => {}, { description: 'Search' })
  const list = useRegisteredHotkeys()
  return <output>{list.length}</output>
}

describe('服务端渲染（M2b）', () => {
  it('没有浏览器对象时渲染：Kbd 按非 macOS，Splitter 用默认尺寸，注册表为空，弹层不输出', () => {
    vi.stubGlobal('navigator', undefined)
    expect(typeof window).toBe('undefined')
    expect(typeof document).toBe('undefined')
    const html = renderToString(
      <ThemeProvider locale="en-US">
        <Kbd keys="mod+k" />
        <CopyButton text="abc" />
        <CodeBlock copyable code="pnpm add vellum-ui" />
        <Splitter storageKey="ssr.splitter" defaultSize={240}>
          <div>Aside</div>
          <div>Main</div>
        </Splitter>
        <ContextMenu items={[{ key: 'open', label: 'Open' }]}>
          <button type="button">Row</button>
        </ContextMenu>
        <CommandPalette open={false} onOpenChange={() => {}} items={[]} />
        <CommandPalette
          open
          onOpenChange={() => {}}
          items={[{ id: 'home', title: 'Home' }]}
          onSearch={async () => []}
        />
        <Hotkeys />
      </ThemeProvider>,
    )
    expect(html).toMatch(/<kbd[^>]*>Ctrl<\/kbd><kbd[^>]*>K<\/kbd>/)
    expect(html).toContain('aria-label="Copy"')
    expect(html).toContain('pnpm add vellum-ui')
    expect(html).toMatch(
      /role="separator"[^>]*aria-valuenow="240"|aria-valuenow="240"[^>]*role="separator"/,
    )
    expect(html).toContain('style="width:240px"')
    expect(html).toContain('>Row</button>')
    expect(html).toContain('<output>0</output>')
  })
})
