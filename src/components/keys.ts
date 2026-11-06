/**
 * 组件库内部：按键组合的解析、匹配与显示，useHotkeys、Kbd、CommandPalette、ContextMenu 共用。
 *
 * 写法与 useHotkeys 相同：`mod+k`、`shift+enter`、`[`、`?`、`escape`。`mod` 在 macOS（及 iOS）上是 ⌘，其他平台
 * 是 Ctrl。平台只在调用时从 navigator 读取，模块顶层不访问浏览器对象（服务端渲染安全）。
 */
import { useSyncExternalStore } from 'react'
import type { MessageKey } from '../i18n/index.ts'

/**
 * Platform used to show and match `mod`: `mac` for macOS and iOS (⌘), `other` for Windows, Linux and the rest
 * (Ctrl).
 * @zh 显示与匹配 `mod` 时的平台：`mac` 为 macOS 与 iOS（⌘），`other` 为 Windows、Linux 等其他平台（Ctrl）。
 */
export type KeyPlatform = 'mac' | 'other'

/** 当前平台。调用时才读取 navigator；没有 navigator（服务端）时为 `other`。 */
export function detectPlatform(): KeyPlatform {
  if (typeof navigator === 'undefined') return 'other'
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } }
  const name = nav.userAgentData?.platform || nav.platform || ''
  return /mac|iphone|ipad|ipod/i.test(name) ? 'mac' : 'other'
}

const noSubscribe = () => () => {}
const serverPlatform = (): KeyPlatform => 'other'

/**
 * 渲染时使用的平台。服务端与水合时取 `other`，水合后立即换成真实平台：服务端输出与客户端首次渲染一致，不会出现
 * 水合不匹配。
 */
export function usePlatform(): KeyPlatform {
  return useSyncExternalStore(noSubscribe, detectPlatform, serverPlatform)
}

/** 解析后的按键组合。`key` 是规范化的键名（小写，如 `k`、`[`、`escape`、`arrowup`、` `）。 */
export interface KeyCombo {
  readonly key: string
  readonly mod: boolean
  readonly ctrl: boolean
  readonly alt: boolean
  readonly shift: boolean
  readonly meta: boolean
}

/** 键名的别名 → 规范名（规范名与 KeyboardEvent.key 的小写一致）。 */
const ALIASES: Readonly<Record<string, string>> = {
  esc: 'escape',
  up: 'arrowup',
  down: 'arrowdown',
  left: 'arrowleft',
  right: 'arrowright',
  return: 'enter',
  space: ' ',
  spacebar: ' ',
  del: 'delete',
  plus: '+',
  menu: 'contextmenu',
  apps: 'contextmenu',
  pgup: 'pageup',
  pgdn: 'pagedown',
  // 写成符号的按键（文档、Kbd 中常见）
  '↑': 'arrowup',
  '↓': 'arrowdown',
  '←': 'arrowleft',
  '→': 'arrowright',
  '↵': 'enter',
  '⏎': 'enter',
  '⎋': 'escape',
  '⌫': 'backspace',
  '⌦': 'delete',
  '⇥': 'tab',
}

/** 修饰键的写法 → 修饰键。 */
const MODIFIERS: Readonly<Record<string, 'mod' | 'ctrl' | 'alt' | 'shift' | 'meta'>> = {
  mod: 'mod',
  ctrl: 'ctrl',
  control: 'ctrl',
  '⌃': 'ctrl',
  alt: 'alt',
  option: 'alt',
  opt: 'alt',
  '⌥': 'alt',
  shift: 'shift',
  '⇧': 'shift',
  meta: 'meta',
  cmd: 'meta',
  command: 'meta',
  '⌘': 'meta',
  win: 'meta',
  super: 'meta',
}

/** 规范化一个键名：去空白、小写、换成规范名。单个空格保留（空格键）。 */
export function normalizeKey(name: string): string {
  if (name === ' ') return ' '
  const lower = name.trim().toLowerCase()
  return ALIASES[lower] ?? lower
}

/** 把组合写法拆成各个键：`mod+k` → `['mod', 'k']`，`mod++` → `['mod', '+']`，`+` → `['+']`。 */
export function splitCombo(text: string): string[] {
  const trimmed = text.trim()
  if (trimmed === '+') return ['+']
  return trimmed.split(/\+(?!$)/).map((s) => (s === '' ? '+' : s))
}

/** 解析组合写法，如 `mod+shift+k`。最后一个不是修饰键的部分是主键；只有修饰键时，最后一个修饰键本身是主键。 */
export function parseCombo(text: string): KeyCombo {
  const parts = splitCombo(text)
  const flags = { mod: false, ctrl: false, alt: false, shift: false, meta: false }
  let key = ''
  parts.forEach((part, i) => {
    const lower = part.trim().toLowerCase()
    const modifier = MODIFIERS[lower]
    if (modifier && i < parts.length - 1) flags[modifier] = true
    else key = normalizeKey(part)
  })
  return { key, ...flags }
}

/** 单个可打印的符号（不是字母或数字），如 `?`、`[`、`/`：这类键由键盘布局决定是否要按 Shift，匹配时不看 Shift。 */
const isSymbol = (key: string) => [...key].length === 1 && !/[\p{L}\p{N}\s]/u.test(key)

/** 匹配需要的 KeyboardEvent 字段。 */
export type KeyEventLike = Pick<
  KeyboardEvent,
  'key' | 'code' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'
> & { getModifierState?: (key: string) => boolean }

/**
 * 按键事件是否匹配组合。
 * - `mod` 在 macOS 上要求 ⌘、不按 Ctrl，其他平台要求 Ctrl、不按 ⌘；其余修饰键必须完全一致；
 * - 符号键（`?`、`[`）不看 Shift；字母、数字、功能键的 Shift 必须一致；
 * - 非拉丁键盘布局（或 macOS 上按住 Option）改变了字符时，字母和数字按物理键位（`code`）匹配；
 * - AltGr（Windows 上报告为 Ctrl+Alt）输入的字符不算按了 Ctrl / Alt。
 */
export function matchesCombo(e: KeyEventLike, combo: KeyCombo, platform: KeyPlatform): boolean {
  const altGraph = e.getModifierState?.('AltGraph') === true
  const ctrl = e.ctrlKey && !altGraph
  const alt = e.altKey && !altGraph
  const mac = platform === 'mac'
  if (ctrl !== (combo.ctrl || (combo.mod && !mac))) return false
  if (e.metaKey !== (combo.meta || (combo.mod && mac))) return false
  if (alt !== combo.alt) return false
  if (!isSymbol(combo.key) && e.shiftKey !== combo.shift) return false
  const key = normalizeKey(e.key)
  if (key === combo.key) return true
  if (/^[a-z]$/.test(combo.key)) return e.code === `Key${combo.key.toUpperCase()}`
  if (/^[0-9]$/.test(combo.key)) return e.code === `Digit${combo.key}`
  return false
}

/** 组合的规范写法（修饰键按固定顺序），用于判断两个注册是否是同一个组合。 */
export function comboId(combo: KeyCombo, platform: KeyPlatform): string {
  const mac = platform === 'mac'
  const parts = [
    (combo.ctrl || (combo.mod && !mac)) && 'ctrl',
    combo.alt && 'alt',
    combo.shift && !isSymbol(combo.key) && 'shift',
    (combo.meta || (combo.mod && mac)) && 'meta',
    combo.key,
  ]
  return parts.filter(Boolean).join('+')
}

/** 正在输入文字的元素：可编辑区域、文本域、下拉框，以及文字类的输入框（复选框、单选、按钮等不算）。 */
const NON_TEXT_INPUTS = new Set([
  'checkbox',
  'radio',
  'button',
  'submit',
  'reset',
  'range',
  'color',
  'file',
  'image',
])

/** 事件目标是否是正在输入文字的元素（这时快捷键默认不触发）。 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true
  if (target instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(target.type)
  return false
}

/** 输入法正在组字（中文、日文输入时的候选阶段）：这时的按键属于输入法，不能当作快捷键或命令。 */
export function isComposing(e: Pick<KeyboardEvent, 'isComposing' | 'keyCode'>): boolean {
  return e.isComposing || e.keyCode === 229
}

/** 一个键的显示：`text` 是按键帽上的文字；`spoken` 是符号的读屏名称（内置文本键），文字本身可读时为 null。 */
export interface KeyLabel {
  readonly text: string
  readonly textKey: MessageKey | null
  readonly spoken: MessageKey | null
}

const label = (
  text: string,
  spoken: MessageKey | null = null,
  textKey: MessageKey | null = null,
): KeyLabel => ({ text, spoken, textKey })

/** 键名 → 按键帽上的显示。macOS 上修饰键用符号（⌘ ⌥ ⇧ ⌃），其他平台用文字。 */
export function keyLabel(name: string, platform: KeyPlatform): KeyLabel {
  const mac = platform === 'mac'
  const lower = name.trim().toLowerCase()
  const modifier = MODIFIERS[lower]
  if (modifier === 'mod') return mac ? label('⌘', 'kbd.command') : label('Ctrl')
  if (modifier === 'meta') return mac ? label('⌘', 'kbd.command') : label('Meta')
  if (modifier === 'ctrl') return mac ? label('⌃', 'kbd.control') : label('Ctrl')
  if (modifier === 'alt') return mac ? label('⌥', 'kbd.option') : label('Alt')
  if (modifier === 'shift') return mac ? label('⇧', 'kbd.shift') : label('Shift')
  const key = normalizeKey(name)
  switch (key) {
    case 'enter':
      return label('↵', 'kbd.enter')
    case 'escape':
      return label('Esc')
    case 'arrowup':
      return label('↑', 'kbd.up')
    case 'arrowdown':
      return label('↓', 'kbd.down')
    case 'arrowleft':
      return label('←', 'kbd.left')
    case 'arrowright':
      return label('→', 'kbd.right')
    case 'backspace':
      return mac ? label('⌫', 'kbd.backspace') : label('Backspace')
    case 'delete':
      return mac ? label('⌦', 'kbd.delete') : label('Del')
    case 'tab':
      return mac ? label('⇥', 'kbd.tab') : label('Tab')
    case ' ':
      return label('Space', null, 'kbd.space')
    case 'pageup':
      return label('PgUp')
    case 'pagedown':
      return label('PgDn')
    case 'contextmenu':
      return label('Menu')
  }
  if ([...key].length === 1) return label(key.toUpperCase())
  if (/^f\d{1,2}$/.test(key)) return label(key.toUpperCase())
  return label(key.charAt(0).toUpperCase() + key.slice(1))
}
