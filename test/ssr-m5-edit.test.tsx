/**
 * 服务端渲染：数据表格增强（M5b）的 InlineEdit、SelectionBar 在没有 window、document 的环境中渲染（Node），
 * 模块顶层不访问浏览器对象。焦点、inert 与播报只在浏览器的 effect 中处理。
 */
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Button, InlineEdit, SelectionBar, ThemeProvider, Toolbar } from '../src/index.ts'

afterEach(() => {
  vi.restoreAllMocks()
})

const ssr = (ui: React.ReactNode, locale: 'en-US' | 'zh-CN' = 'en-US') =>
  renderToString(<ThemeProvider locale={locale}>{ui}</ThemeProvider>)

describe('服务端渲染（M5b InlineEdit）', () => {
  it('没有浏览器对象时渲染文字、数字、选择、空值与禁用', () => {
    expect(typeof window).toBe('undefined')
    expect(typeof document).toBe('undefined')
    const error = vi.spyOn(console, 'error')
    const html = ssr(
      <>
        <InlineEdit label="Name" value="Atlas" onSave={() => {}} />
        <InlineEdit type="number" label="Price" value="1250.5" precision={2} onSave={() => {}} />
        <InlineEdit
          type="select"
          label="Status"
          value="paused"
          options={[
            { value: 'active', label: 'Active' },
            { value: 'paused', label: 'Paused' },
          ]}
          onSave={() => {}}
        />
        <InlineEdit label="Owner" value={null} onSave={() => {}} />
        <InlineEdit
          label="Code"
          value="AT-01"
          disabled
          disabledReason="Codes cannot be changed"
          onSave={() => {}}
        />
      </>,
    )
    // 显示状态是带读屏名称的按钮，值是它的说明
    expect(html).toMatch(
      /<button type="button"[^>]*aria-label="Edit Name"[^>]*aria-describedby="([^"]+)"/,
    )
    expect(html).toContain('Atlas')
    expect(html).toContain('1,250.50')
    expect(html).toContain('Paused')
    expect(html).toMatch(/data-empty="true"[^>]*>Not set</)
    // 禁用并给出原因：仍可聚焦（aria-disabled），原因在隐藏的说明中
    expect(html).toMatch(/aria-label="Edit Code"[^>]*aria-disabled="true"/)
    expect(html).toContain('Codes cannot be changed')
    expect(error).not.toHaveBeenCalled()
  })

  it('zh-CN 的读屏名称、空值与数字写法', () => {
    const html = ssr(
      <>
        <InlineEdit label="名称" value={null} onSave={() => {}} />
        <InlineEdit type="number" label="数量" value="12000" onSave={() => {}} />
      </>,
      'zh-CN',
    )
    expect(html).toContain('aria-label="编辑 名称"')
    expect(html).toContain('未填写')
    expect(html).toContain('12,000')
  })

  it('值按文字输出，不当作 HTML', () => {
    const html = ssr(<InlineEdit label="Name" value={'<b>bold</b>'} onSave={() => {}} />)
    expect(html).not.toContain('<b>')
    expect(html).toContain('&lt;b&gt;bold&lt;/b&gt;')
  })
})

describe('服务端渲染（M5b SelectionBar）', () => {
  const toolbar = (
    <Toolbar>
      <span>Filters</span>
    </Toolbar>
  )

  it('没有选中项：工具栏可见，操作栏透明且 inert（注水之前也不能用 Tab 到达）；状态区为空', () => {
    const error = vi.spyOn(console, 'error')
    const html = ssr(
      <SelectionBar count={0} total={10} onClear={() => {}} toolbar={toolbar}>
        <Button>Archive</Button>
      </SelectionBar>,
    )
    expect(html).toMatch(/data-layer="toolbar"(?![^>]*inert)[^>]*>/)
    expect(html).toMatch(/data-layer="bar" data-hidden="true" inert=""/)
    expect(html).toContain('Filters')
    expect(html).toMatch(/<span[^>]*role="status"[^>]*><\/span>/)
    expect(error).not.toHaveBeenCalled()
  })

  it('有选中项：操作栏可见，显示本地化的数量与「选择全部」，工具栏 inert', () => {
    const html = ssr(
      <SelectionBar
        count={1234}
        total={5000}
        onClear={() => {}}
        onSelectAll={() => {}}
        toolbar={toolbar}
      >
        <Button>Archive</Button>
      </SelectionBar>,
    )
    expect(html).toMatch(/data-layer="toolbar" data-hidden="true" inert=""/)
    expect(html).toMatch(/data-layer="bar"(?! data-hidden)/)
    expect(html).toMatch(/<div[^>]*aria-label="Bulk actions"[^>]*role="toolbar"/)
    expect(html).toContain('1,234 selected')
    expect(html).toContain('Select all 5,000')
    expect(html).toContain('aria-label="Clear selection"')
  })

  it('zh-CN', () => {
    const html = ssr(<SelectionBar count={5000} total={5000} onClear={() => {}} />, 'zh-CN')
    expect(html).toContain('已选全部 5,000 项')
    expect(html).toContain('aria-label="批量操作"')
  })
})
