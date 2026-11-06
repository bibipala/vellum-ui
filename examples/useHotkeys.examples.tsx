import { useState } from 'react'
import {
  HotkeysProvider,
  Inline,
  Input,
  Kbd,
  ListItem,
  Pill,
  Stack,
  Text,
  useHotkeys,
  useRegisteredHotkeys,
} from 'vellum-ui'

function Counter() {
  const [count, setCount] = useState(0)
  useHotkeys('mod+j', () => setCount((c) => c + 1), { description: 'Add one' })
  return (
    <Inline gap={2} align="center">
      <Text>Press</Text>
      <Kbd keys="mod+j" />
      <Text>to add one:</Text>
      <Text numeric weight="semibold">
        {count}
      </Text>
    </Inline>
  )
}

/**
 * Basic usage
 * Register the shortcut and show the same combination with Kbd. `mod` is ⌘ on macOS and Ctrl elsewhere.
 * @zh 基本用法
 * 注册快捷键，并用 Kbd 显示同一个组合。`mod` 在 macOS 上是 ⌘，其他平台是 Ctrl。
 */
export function Basic() {
  return <Counter />
}

function Toggle() {
  const [on, setOn] = useState(false)
  const [allowed, setAllowed] = useState(false)
  useHotkeys('t', () => setOn((v) => !v), { description: 'Toggle the first badge' })
  useHotkeys('mod+enter', () => setAllowed((v) => !v), {
    description: 'Toggle from inside a field',
    allowInInputs: true,
  })
  return (
    <Stack gap={3}>
      <Inline gap={2} align="center">
        <Kbd keys="t" />
        <Pill tone={on ? 'success' : 'neutral'}>{on ? 'On' : 'Off'}</Pill>
        <Kbd keys="mod+enter" />
        <Pill tone={allowed ? 'success' : 'neutral'}>{allowed ? 'On' : 'Off'}</Pill>
      </Inline>
      <Input placeholder="Typing t here does not toggle the first badge" />
    </Stack>
  )
}

/**
 * Inside text fields
 * By default hotkeys do not fire while typing in a field; `allowInInputs` lets a combination with a modifier
 * work there too.
 * @zh 输入框中
 * 默认在输入框中键入时不触发；`allowInInputs` 让带修饰键的组合在输入框中也能使用。
 * @section Variants
 */
export function InInputs() {
  return <Toggle />
}

function Help() {
  const hotkeys = useRegisteredHotkeys()
  return (
    <Stack gap={1}>
      {hotkeys.map((h) => (
        <ListItem
          key={h.id}
          title={h.description}
          meta={
            <Inline gap={1}>
              {h.keys.map((k) => (
                <Kbd key={k} keys={k} />
              ))}
            </Inline>
          }
        />
      ))}
    </Stack>
  )
}

function Shortcuts() {
  useHotkeys('mod+shift+s', () => {}, { description: 'Save a copy' })
  useHotkeys(['alt+arrowup', 'alt+arrowdown'], () => {}, { description: 'Move', repeat: true })
  useHotkeys('shift+b', () => {}, { description: 'Toggle the sidebar' })
  return <Help />
}

/**
 * Shortcut help
 * useRegisteredHotkeys lists the hotkeys that have a `description`, for a "Keyboard shortcuts" dialog.
 * HotkeysProvider keeps the list of this example separate from the hotkeys of the rest of the page.
 * @zh 快捷键帮助
 * useRegisteredHotkeys 列出带 `description` 的快捷键，用于「键盘快捷键」对话框。
 * HotkeysProvider 让这个示例的列表与页面其他部分的快捷键分开。
 * @section Advanced
 */
export function ShortcutHelp() {
  return (
    <HotkeysProvider>
      <Shortcuts />
    </HotkeysProvider>
  )
}
