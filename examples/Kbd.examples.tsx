import { Inline, Kbd, Stack, Text } from 'vellum-ui'

/**
 * Basic usage
 * `Mod` is ⌘ on macOS and Ctrl on other platforms; each key is a key cap of its own.
 * @zh 基本用法
 * `Mod` 在 macOS 上是 ⌘，其他平台是 Ctrl；每个键是一个按键帽。
 */
export function Basic() {
  return (
    <Inline gap={4}>
      <Kbd keys={['Mod', 'K']} />
      <Kbd keys={['Shift', 'Enter']} />
      <Kbd keys={['Esc']} />
      <Kbd keys={['↑', '↓']} />
    </Inline>
  )
}

/**
 * Written like a hotkey
 * The same syntax as useHotkeys, so a shortcut and its hint can share one string.
 * @zh 与快捷键相同的写法
 * 与 useHotkeys 写法相同，快捷键与它的提示可以共用一个字符串。
 * @section Variants
 */
export function ComboString() {
  return (
    <Inline gap={4}>
      <Kbd keys="mod+shift+p" />
      <Kbd keys="alt+arrowleft" />
      <Kbd keys="?" />
      <Kbd keys="space" />
    </Inline>
  )
}

/**
 * A fixed platform
 * `platform` shows the keys of one platform regardless of the current one, as in documentation.
 * @zh 固定平台
 * `platform` 固定显示某个平台的按键，与当前平台无关，用于文档等场景。
 * @section Variants
 */
export function Platforms() {
  return (
    <Stack gap={2}>
      <Inline gap={3} align="center">
        <Text size="sm" tone="secondary">
          macOS
        </Text>
        <Kbd keys="mod+alt+shift+k" platform="mac" />
      </Inline>
      <Inline gap={3} align="center">
        <Text size="sm" tone="secondary">
          Windows / Linux
        </Text>
        <Kbd keys="mod+alt+shift+k" platform="other" />
      </Inline>
    </Stack>
  )
}
