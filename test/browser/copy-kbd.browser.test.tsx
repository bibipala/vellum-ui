/**
 * CopyButton、CodeBlock 的复制按钮与 Kbd 在真实浏览器中的行为：
 * - 剪贴板用注入的假实现（替换 navigator.clipboard.writeText），既能验证写入的内容，也能模拟浏览器拒绝、
 *   接口不存在（非安全上下文）；同时断言从不读取剪贴板；
 * - 成功后图标变为勾、提示与播报区为「已复制」，2 秒后恢复；失败时显示失败状态并调用 onError；
 * - 键盘焦点环与 Enter / 空格；带文字的按钮宽度不变；文字随语言切换；
 * - Kbd 的 `Mod` 映射：模拟 macOS（navigator.platform 与 userAgentData）与非 macOS。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CodeBlock, CopyButton, Kbd } from '../../src/index.ts'
import {
  clock,
  expectFocusRing,
  page,
  render,
  settle,
  useFakeTimers,
  userEvent,
} from './render.tsx'

/** 替换剪贴板：writeText 按 `result` 成功或失败；readText 用于断言从未读取。 */
function fakeClipboard(result: 'ok' | Error = 'ok') {
  const written: string[] = []
  const writeText = vi.fn(async (text: string) => {
    if (result instanceof Error) throw result
    written.push(text)
  })
  const readText = vi.fn(async () => '')
  const read = vi.fn(async () => [])
  vi.spyOn(navigator, 'clipboard', 'get').mockReturnValue({
    writeText,
    readText,
    read,
  } as unknown as Clipboard)
  return { written, writeText, readText, read }
}

afterEach(() => {
  vi.restoreAllMocks()
})

const iconOf = (button: Element) =>
  [...(button.querySelector('svg')?.classList ?? [])].find((c) => c.startsWith('lucide-'))
const live = (root: ParentNode = document) =>
  root.querySelector('[role="status"]')?.textContent ?? null

describe('CopyButton', () => {
  it('图标按钮：Tab 聚焦显示焦点环，Enter 复制；图标变为勾、播报「Copied」，2 秒后恢复；从不读取剪贴板', async () => {
    const clip = fakeClipboard()
    const onCopy = vi.fn()
    useFakeTimers()
    await render(
      <>
        <input aria-label="Before" />
        <CopyButton text="proj_01HZX4" label="Copy ID" onCopy={onCopy} testId="copy" />
      </>,
    )
    const button = page.getByRole('button', { name: 'Copy ID' }).element()
    expect(iconOf(button)).toBe('lucide-copy')
    await userEvent.click(page.getByRole('textbox', { name: 'Before' }))
    await userEvent.tab()
    expect(document.activeElement).toBe(button)
    expectFocusRing(button, 2)
    // 计时起点（render.tsx 的 clock）：「还没到」从交互之前算，「已经到了」从交互之后算，与 expect.poll 推进的假时钟无关
    const before = clock()
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => clip.written).toEqual(['proj_01HZX4'])
    const after = clock()
    expect(onCopy).toHaveBeenCalledWith('proj_01HZX4')
    await settle()
    expect(iconOf(button)).toBe('lucide-check')
    const root = page.getByTestId('copy').element()
    expect(live(root)).toBe('Copied')
    expect(root.getAttribute('data-status')).toBe('copied')
    // 读屏名称不变，结果由播报区读出
    expect(button.getAttribute('aria-label')).toBe('Copy ID')
    await before.to(1900)
    expect(iconOf(button)).toBe('lucide-check')
    await after.to(2100)
    expect(iconOf(button)).toBe('lucide-copy')
    expect(live(root)).toBe('')
    expect(clip.readText).not.toHaveBeenCalled()
    expect(clip.read).not.toHaveBeenCalled()
  })

  it('空格同样复制；连续复制时计时重新开始', async () => {
    const clip = fakeClipboard()
    useFakeTimers()
    await render(<CopyButton text="abc" testId="copy" />)
    const button = page.getByRole('button', { name: 'Copy' }).element()
    button.focus()
    const first = clock()
    await userEvent.keyboard(' ')
    await expect.poll(() => clip.written.length).toBe(1)
    await first.to(1500)
    const before = clock()
    await userEvent.keyboard(' ')
    await expect.poll(() => clip.written.length).toBe(2)
    const after = clock()
    await before.to(1500)
    // 第一次复制已过去 3 秒以上、第二次之后不到 1.5 秒：仍是「已复制」（计时从第二次重新开始）
    expect(first.elapsed()).toBeGreaterThanOrEqual(3000)
    expect(iconOf(button)).toBe('lucide-check')
    await after.to(2100)
    expect(iconOf(button)).toBe('lucide-copy')
  })

  it('浏览器拒绝写入：显示失败状态（警示图标、提示与播报「Couldn’t copy」），onError 收到原始错误', async () => {
    const denied = new DOMException('Write permission denied.', 'NotAllowedError')
    fakeClipboard(denied)
    const onError = vi.fn()
    const onCopy = vi.fn()
    useFakeTimers()
    await render(<CopyButton text="abc" onError={onError} onCopy={onCopy} testId="copy" />)
    const before = clock()
    await userEvent.click(page.getByRole('button', { name: 'Copy' }))
    await expect.poll(() => onError.mock.calls.length).toBe(1)
    const after = clock()
    expect(onError).toHaveBeenCalledWith(denied)
    expect(onCopy).not.toHaveBeenCalled()
    await settle()
    const root = page.getByTestId('copy').element()
    const button = page.getByRole('button', { name: 'Copy' }).element()
    expect(root.getAttribute('data-status')).toBe('failed')
    expect(iconOf(button)).toBe('lucide-circle-alert')
    expect(live(root)).toBe("Couldn't copy")
    // 失败状态停留 4 秒
    await before.to(3900)
    expect(root.getAttribute('data-status')).toBe('failed')
    await after.to(4100)
    expect(root.getAttribute('data-status')).toBe('idle')
  })

  it('没有剪贴板接口（非安全上下文）：同样显示失败状态并调用 onError', async () => {
    vi.spyOn(navigator, 'clipboard', 'get').mockReturnValue(undefined as unknown as Clipboard)
    const onError = vi.fn()
    await render(<CopyButton showLabel text="abc" onError={onError} testId="copy" />)
    await userEvent.click(page.getByRole('button', { name: 'Copy' }))
    await expect.poll(() => onError.mock.calls.length).toBe(1)
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(Error)
    expect(page.getByTestId('copy').element().getAttribute('data-status')).toBe('failed')
  })

  it('带文字：图标在文字前，复制后图标变为勾，按钮宽度不变', async () => {
    const clip = fakeClipboard()
    await render(<CopyButton showLabel text="https://example.com/s/1" label="Copy link" />)
    const button = page.getByRole('button', { name: 'Copy link' }).element()
    const before = button.getBoundingClientRect().width
    expect(iconOf(button)).toBe('lucide-copy')
    await userEvent.click(button)
    await expect.poll(() => clip.written).toEqual(['https://example.com/s/1'])
    await expect.poll(() => iconOf(button)).toBe('lucide-check')
    expect(button.getBoundingClientRect().width).toBe(before)
    expect(button.textContent).toBe('Copy link')
  })

  it('默认文字随语言：中文为「复制」，复制后播报「已复制」', async () => {
    fakeClipboard()
    await render(<CopyButton text="abc" testId="copy" />, { locale: 'zh-CN' })
    await userEvent.click(page.getByRole('button', { name: '复制' }))
    await expect.poll(() => live(page.getByTestId('copy').element())).toBe('已复制')
  })

  it('禁用时不复制', async () => {
    const clip = fakeClipboard()
    await render(<CopyButton text="abc" disabled />)
    const button = page.getByRole('button', { name: 'Copy' }).element() as HTMLButtonElement
    expect(button.disabled).toBe(true)
    await userEvent.click(button, { force: true })
    await settle(50)
    expect(clip.writeText).not.toHaveBeenCalled()
  })
})

describe('CodeBlock copyable', () => {
  it('右上角的复制按钮复制代码；pre 的文字只有代码；代码滚动时按钮不动', async () => {
    const clip = fakeClipboard()
    const code = Array.from({ length: 40 }, (_, i) => `line ${i + 1}`).join('\n')
    await render(<CodeBlock copyable maxHeight="sm" code={code} testId="code" />)
    const pre = page.getByTestId('code').element() as HTMLElement
    expect(pre.textContent).toBe(code)
    const button = page.getByRole('button', { name: 'Copy' }).element()
    const top = button.getBoundingClientRect().top
    const preBox = pre.getBoundingClientRect()
    expect(button.getBoundingClientRect().right).toBeLessThanOrEqual(preBox.right)
    expect(top).toBeGreaterThanOrEqual(preBox.top)
    pre.scrollTop = 200
    await settle()
    expect(button.getBoundingClientRect().top).toBe(top)
    await userEvent.click(button)
    await expect.poll(() => clip.written).toEqual([code])
  })
})

describe('Kbd 的 Mod 映射', () => {
  /** 模拟平台：Chromium 优先读 userAgentData.platform，其他浏览器读 navigator.platform，两者一起替换。 */
  function stubPlatform(name: 'macOS' | 'Windows') {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue(name === 'macOS' ? 'MacIntel' : 'Win32')
    const data = (navigator as Navigator & { userAgentData?: object }).userAgentData
    if (data)
      vi.spyOn(navigator, 'userAgentData' as never, 'get').mockReturnValue({
        platform: name,
      } as never)
  }
  const caps = (el: Element) =>
    [...el.querySelectorAll(':scope > kbd')].map(
      (k) => k.querySelector('[aria-hidden="true"]')?.textContent ?? k.textContent,
    )

  it('macOS：Mod 显示 ⌘，修饰键为符号，读屏名称为 Command', async () => {
    stubPlatform('macOS')
    await render(<Kbd keys={['Mod', 'Shift', 'K']} testId="kbd" />)
    const kbd = page.getByTestId('kbd').element()
    await expect.poll(() => caps(kbd)).toEqual(['⌘', '⇧', 'K'])
    expect(kbd.textContent).toContain('Command')
  })

  it('非 macOS：Mod 显示 Ctrl；platform 属性可以固定平台', async () => {
    stubPlatform('Windows')
    await render(
      <>
        <Kbd keys="mod+shift+k" testId="kbd" />
        <Kbd keys="mod+k" platform="mac" testId="fixed" />
      </>,
    )
    expect(caps(page.getByTestId('kbd').element())).toEqual(['Ctrl', 'Shift', 'K'])
    expect(caps(page.getByTestId('fixed').element())).toEqual(['⌘', 'K'])
  })

  it('外观：中性填充、无描边、等宽字体，高度取令牌；紧凑密度更矮', async () => {
    const first = await render(<Kbd keys={['Esc']} testId="kbd" />)
    const cap = page.getByTestId('kbd').element().querySelector('kbd') as HTMLElement
    const s = getComputedStyle(cap)
    expect(s.borderStyle === 'none' || s.borderWidth === '0px').toBe(true)
    expect(s.fontFamily).toMatch(/JetBrains Mono|mono/i)
    expect(s.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
    expect(cap.getBoundingClientRect().height).toBe(20)
    await first.unmount()
    await render(<Kbd keys={['Esc']} testId="kbd-compact" />, { defaultDensity: 'compact' })
    const small = page.getByTestId('kbd-compact').element().querySelector('kbd') as HTMLElement
    await expect.poll(() => small.getBoundingClientRect().height).toBe(18)
  })
})
