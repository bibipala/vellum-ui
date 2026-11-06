/**
 * 按键帽：显示快捷键。`Mod` 在 macOS 上显示 ⌘，其他平台显示 Ctrl。
 * 平台在渲染时读取（usePlatform）：服务端与水合时按非 macOS 输出，水合后换成真实平台，不会出现水合不匹配。
 */
import { Fragment } from 'react'
import { useT } from '../i18n/index.ts'
import styles from './kbd.module.css'
import { type KeyPlatform, keyLabel, splitCombo, usePlatform } from './keys.ts'
import type { BaseProps } from './layout.tsx'
import hidden from './visually-hidden.module.css'

/**
 * Props of Kbd.
 * @zh Kbd 属性。
 */
export interface KbdProps extends Pick<BaseProps, 'testId'> {
  /**
   * The keys: a list of key names such as `['Mod', 'K']`, or a combination written like in useHotkeys, such as
   * `'mod+k'` or `'shift+enter'`. Each key is shown as its own key cap. `Mod` is ⌘ on macOS and Ctrl elsewhere;
   * on macOS the other modifiers are shown as symbols (⌥ ⇧ ⌃). Arrow keys, `Enter`, `Backspace` and the like
   * are shown as symbols, with a name for screen readers.
   * @zh 按键：键名列表（如 `['Mod', 'K']`），或与 useHotkeys 相同的组合写法（如 `'mod+k'`、`'shift+enter'`）。
   * 每个键显示为一个按键帽。`Mod` 在 macOS 上是 ⌘，其他平台是 Ctrl；macOS 上其他修饰键显示为符号（⌥ ⇧ ⌃）。
   * 方向键、`Enter`、`Backspace` 等显示为符号，并带有读屏名称。
   */
  readonly keys: string | readonly string[]
  /**
   * Platform used for `Mod` and the modifier symbols. Detected from the browser by default; set it to show the
   * keys of one platform regardless of the current one (such as in documentation).
   * @zh 显示 `Mod` 与修饰键符号时的平台。默认从浏览器判断；需要固定显示某个平台的按键时设置（如文档中）。
   */
  readonly platform?: KeyPlatform
}

/**
 * Key caps that show a keyboard shortcut, such as `<Kbd keys={['Mod', 'K']} />`: ⌘ K on macOS, Ctrl K on other
 * platforms.
 *
 * **Interaction**: not interactive. The key caps have a neutral fill and no outline, and use the monospace font;
 * symbols (⌘, ↵, ↑) are read by their names, such as "Command", by screen readers.
 * @zh 按键帽：显示快捷键，如 `<Kbd keys={['Mod', 'K']} />` 在 macOS 上是 ⌘ K，其他平台是 Ctrl K。
 *
 * **交互**：不可交互。按键帽为中性填充、无描边，使用等宽字体；符号（⌘、↵、↑）对读屏读作名称，如「Command 键」。
 * @category Basic
 * @usage Shortcut hints in menus, tooltips, command palettes and shortcut help; key hints at the bottom of overlays
 * @usageZh 菜单、提示、命令面板与快捷键帮助中的快捷键提示；弹层底部的按键提示
 */
export function Kbd(props: KbdProps) {
  const t = useT()
  const detected = usePlatform()
  const platform = props.platform ?? detected
  const names = typeof props.keys === 'string' ? splitCombo(props.keys) : props.keys
  return (
    <kbd className={styles.combo} data-testid={props.testId}>
      {names.map((name, i) => {
        const key = keyLabel(name, platform)
        const text = key.textKey ? t(key.textKey) : key.text
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: 同一组合中的键按位置排列，可能重复（如 ↑ ↑）
          <kbd key={i} className={styles.key}>
            {key.spoken ? (
              <Fragment>
                <span aria-hidden="true">{text}</span>
                <span className={hidden.hidden}>{t(key.spoken)}</span>
              </Fragment>
            ) : (
              text
            )}
          </kbd>
        )
      })}
    </kbd>
  )
}
