/**
 * 组件库内部：AppShell 与放在它里面的组件（Nav、AppShell.Toggle）之间的约定，不从入口导出。
 *
 * - Nav 在 AppShell 的侧栏中时，收起状态跟随侧栏（窄屏的抽屉里总是展开的）；选择一项后关闭窄屏抽屉；
 * - AppShell.Toggle 按当前宽度切换：宽屏收起 / 展开侧栏，窄屏打开 / 关闭抽屉；
 * - 嵌套的 AppShell（文档站中的示例）不再设置 `view-transition-name`，避免同名元素让页面切换失效。
 */
import { createContext, useContext } from 'react'

export interface AppShellState {
  /** 侧栏的 id（切换按钮的 `aria-controls`）。 */
  readonly sidebarId: string
  /** 宽屏下侧栏收起为只有图标的窄栏。 */
  readonly collapsed: boolean
  /** 宽度不足，侧栏变为浮在内容上的抽屉。 */
  readonly narrow: boolean
  /** 窄屏抽屉是否打开。 */
  readonly overlayOpen: boolean
  /** 切换：宽屏收起 / 展开，窄屏打开 / 关闭抽屉。 */
  readonly toggle: () => void
  /** 选择了导航项：关闭窄屏抽屉。 */
  readonly onNavigate: () => void
}

export const AppShellContext = createContext<AppShellState | null>(null)

export const useAppShellState = () => useContext(AppShellContext)

/** 侧栏变为抽屉的宽度（px）：内容区放得下窄页面（`page-width-narrow` 720px）与最窄的侧栏（`split-aside-sm` 240px）。 */
export const APP_SHELL_NARROW_BELOW = 960
