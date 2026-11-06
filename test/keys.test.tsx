/**
 * 按键组合的解析、匹配与显示（keys.ts）：useHotkeys、Kbd、CommandPalette、ContextMenu 共用。
 * 在 Node 中运行，同时证明模块顶层不访问浏览器对象。
 */
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import {
  comboId,
  detectPlatform,
  type KeyEventLike,
  keyLabel,
  matchesCombo,
  parseCombo,
  splitCombo,
} from '../src/components/keys.ts'
import { Kbd, ThemeProvider } from '../src/index.ts'

const ev = (key: string, init: Partial<KeyEventLike> = {}): KeyEventLike => ({
  key,
  code: init.code ?? '',
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  ...init,
})

describe('组合写法', () => {
  it('拆分与解析：修饰键、别名、加号本身', () => {
    expect(splitCombo('mod+k')).toEqual(['mod', 'k'])
    expect(splitCombo('mod++')).toEqual(['mod', '+'])
    expect(splitCombo('+')).toEqual(['+'])
    expect(parseCombo('Mod+Shift+K')).toEqual({
      key: 'k',
      mod: true,
      ctrl: false,
      alt: false,
      shift: true,
      meta: false,
    })
    expect(parseCombo('esc').key).toBe('escape')
    expect(parseCombo('up').key).toBe('arrowup')
    expect(parseCombo('space').key).toBe(' ')
    expect(parseCombo('shift+f10')).toMatchObject({ key: 'f10', shift: true })
    expect(parseCombo('cmd+option+p')).toMatchObject({ key: 'p', meta: true, alt: true })
  })

  it('mod：macOS 上是 ⌘（不按 Ctrl），其他平台是 Ctrl（不按 ⌘）', () => {
    const c = parseCombo('mod+k')
    expect(matchesCombo(ev('k', { metaKey: true }), c, 'mac')).toBe(true)
    expect(matchesCombo(ev('k', { ctrlKey: true }), c, 'mac')).toBe(false)
    expect(matchesCombo(ev('k', { ctrlKey: true }), c, 'other')).toBe(true)
    expect(matchesCombo(ev('k', { metaKey: true }), c, 'other')).toBe(false)
    expect(matchesCombo(ev('k', { ctrlKey: true, metaKey: true }), c, 'other')).toBe(false)
    expect(comboId(c, 'mac')).toBe('meta+k')
    expect(comboId(c, 'other')).toBe('ctrl+k')
    expect(comboId(parseCombo('ctrl+k'), 'other')).toBe(comboId(c, 'other'))
  })

  it('修饰键必须完全一致；大写字母（按着 Shift）不匹配没有 Shift 的组合', () => {
    const k = parseCombo('mod+k')
    expect(matchesCombo(ev('K', { ctrlKey: true, shiftKey: true }), k, 'other')).toBe(false)
    expect(
      matchesCombo(ev('K', { ctrlKey: true, shiftKey: true }), parseCombo('mod+shift+k'), 'other'),
    ).toBe(true)
    expect(matchesCombo(ev('k', { ctrlKey: true, altKey: true }), k, 'other')).toBe(false)
    expect(matchesCombo(ev('['), parseCombo('['), 'other')).toBe(true)
    expect(matchesCombo(ev('[', { ctrlKey: true }), parseCombo('['), 'other')).toBe(false)
  })

  it('符号键不看 Shift：美式键盘上 ? 需要 Shift，其他布局可能不需要', () => {
    const q = parseCombo('?')
    expect(matchesCombo(ev('?', { shiftKey: true }), q, 'other')).toBe(true)
    expect(matchesCombo(ev('?'), q, 'other')).toBe(true)
    expect(matchesCombo(ev('/', { shiftKey: false }), q, 'other')).toBe(false)
  })

  it('非拉丁布局：字母按物理键位匹配；AltGr 输入的字符不算 Ctrl+Alt', () => {
    expect(
      matchesCombo(ev('л', { ctrlKey: true, code: 'KeyK' }), parseCombo('mod+k'), 'other'),
    ).toBe(true)
    expect(matchesCombo(ev('å', { altKey: true, code: 'KeyA' }), parseCombo('alt+a'), 'mac')).toBe(
      true,
    )
    const altGr = ev('[', {
      ctrlKey: true,
      altKey: true,
      getModifierState: (k) => k === 'AltGraph',
    })
    expect(matchesCombo(altGr, parseCombo('['), 'other')).toBe(true)
  })

  it('名字与 KeyboardEvent.key 的写法都能匹配：Escape / esc、ArrowUp / up、空格', () => {
    expect(matchesCombo(ev('Escape'), parseCombo('esc'), 'other')).toBe(true)
    expect(matchesCombo(ev('ArrowUp'), parseCombo('up'), 'other')).toBe(true)
    expect(matchesCombo(ev(' '), parseCombo('space'), 'other')).toBe(true)
    expect(matchesCombo(ev('F10', { shiftKey: true }), parseCombo('shift+f10'), 'other')).toBe(true)
    expect(matchesCombo(ev('F10'), parseCombo('shift+f10'), 'other')).toBe(false)
  })
})

describe('按键显示', () => {
  it('macOS 用修饰键符号，其他平台用文字；符号键带读屏名称', () => {
    expect(keyLabel('Mod', 'mac')).toMatchObject({ text: '⌘', spoken: 'kbd.command' })
    expect(keyLabel('Mod', 'other')).toMatchObject({ text: 'Ctrl', spoken: null })
    expect(keyLabel('alt', 'mac').text).toBe('⌥')
    expect(keyLabel('alt', 'other').text).toBe('Alt')
    expect(keyLabel('shift', 'mac').text).toBe('⇧')
    expect(keyLabel('shift', 'other').text).toBe('Shift')
    expect(keyLabel('enter', 'other')).toMatchObject({ text: '↵', spoken: 'kbd.enter' })
    expect(keyLabel('↑', 'other')).toMatchObject({ text: '↑', spoken: 'kbd.up' })
    expect(keyLabel('k', 'other').text).toBe('K')
    expect(keyLabel('f10', 'other').text).toBe('F10')
    expect(keyLabel('esc', 'mac').text).toBe('Esc')
    expect(keyLabel('space', 'other').textKey).toBe('kbd.space')
  })

  it('平台判断：调用时读取 navigator；没有 navigator（服务端）时按非 macOS 处理', () => {
    expect(typeof globalThis.window).toBe('undefined')
    try {
      vi.stubGlobal('navigator', undefined)
      expect(detectPlatform()).toBe('other')
      vi.stubGlobal('navigator', { platform: 'MacIntel' })
      expect(detectPlatform()).toBe('mac')
      vi.stubGlobal('navigator', { platform: 'iPhone' })
      expect(detectPlatform()).toBe('mac')
      vi.stubGlobal('navigator', { platform: 'Win32', userAgentData: { platform: 'Windows' } })
      expect(detectPlatform()).toBe('other')
      // 优先使用 userAgentData（Chromium），没有时用 platform
      vi.stubGlobal('navigator', { platform: 'Linux x86_64', userAgentData: { platform: 'macOS' } })
      expect(detectPlatform()).toBe('mac')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('Kbd 在服务端按非 macOS 输出：Ctrl 与 K 各是一个按键帽；符号有读屏名称', () => {
    const html = renderToString(
      <ThemeProvider locale="en-US">
        <Kbd keys={['Mod', 'K']} />
        <Kbd keys="shift+enter" platform="mac" />
      </ThemeProvider>,
    )
    expect(html).toMatch(/<kbd[^>]*><kbd[^>]*>Ctrl<\/kbd><kbd[^>]*>K<\/kbd><\/kbd>/)
    expect(html).toContain('<span aria-hidden="true">⇧</span>')
    expect(html).toMatch(/<span class="[^"]*hidden[^"]*">Shift<\/span>/)
    expect(html).toMatch(/<span class="[^"]*hidden[^"]*">Enter<\/span>/)
  })
})
