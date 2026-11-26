/**
 * 主题的上下文与读取用的 hook。只依赖 React 与类型：读取主题的组件（表格、图表、看图）经由这里不会带上 antd、dayjs
 * 与语言包的初始化代码，那些设置留在 ThemeProvider 中。
 *
 * 按内容分成几个上下文，组件只订阅自己用到的部分：
 * - 密度：DataTable 按它估计行高；
 * - 编译出的 CSS 变量：图表在主题、明暗、密度变化后重新读取配色；
 * - 看图背景：FilePreview 与 Lightbox 的背景档位及切换函数；
 * - 其余部分：解析后的主题、明暗偏好，以及设置函数。
 * 设置函数在 ThemeProvider 挂载期间身份不变，各上下文的值只在自己的内容变化时换新：只切换看图背景时，读取密度或
 * CSS 变量的组件不重新渲染。公开的 useTheme 把它们合成 ThemeContextValue。
 */
import { createContext, useContext, useMemo } from 'react'
import type { ColorModePreference } from '../themes/index.ts'
import type { Density } from '../tokens/component.ts'
import type { ViewerStage } from '../tokens/viewer-stage.ts'
import type { CssVars, Theme } from './compile.ts'

/**
 * The current theme and its setters, returned by useTheme.
 * @zh useTheme 返回的当前主题及其设置函数。
 */
export interface ThemeContextValue {
  /**
   * The current theme, resolved for the current color mode.
   * @zh 当前的主题，已按当前的明暗模式解析。
   */
  readonly theme: Theme
  /**
   * The color mode in effect, `light` or `dark` (`system` resolved from the setting of the operating system).
   * @zh 实际生效的明暗模式，`light` 或 `dark`（`system` 已按操作系统的设置解析）。
   */
  readonly mode: Theme['mode']
  /**
   * The color mode preference of the user: `light`, `dark` or `system`.
   * @zh 用户的明暗偏好：`light`、`dark` 或 `system`。
   */
  readonly colorMode: ColorModePreference
  /**
   * The current density.
   * @zh 当前的密度。
   */
  readonly density: Density
  /**
   * The current viewer background of FilePreview and Lightbox.
   * @zh FilePreview 与 Lightbox 当前的看图背景。
   */
  readonly viewerStage: ViewerStage
  /**
   * The CSS variables compiled for the current theme and density.
   * @zh 按当前主题与密度编译出的 CSS 变量。
   */
  readonly cssVars: CssVars
  /**
   * Changes the color mode preference and calls `onColorModeChange`. With a controlled `colorMode`, the change
   * takes effect when the new value is passed back.
   * @zh 修改明暗偏好并调用 `onColorModeChange`。`colorMode` 受控时，新的值传回后才生效。
   */
  readonly setColorMode: (mode: ColorModePreference) => void
  /**
   * Changes the density and calls `onDensityChange`. With a controlled `density`, the change takes effect when the
   * new value is passed back.
   * @zh 修改密度并调用 `onDensityChange`。`density` 受控时，新的值传回后才生效。
   */
  readonly setDensity: (density: Density) => void
  /**
   * Changes the viewer background of FilePreview and Lightbox. The choice is not stored: it lasts while
   * ThemeProvider is mounted.
   * @zh 修改 FilePreview 与 Lightbox 的看图背景。不会保存：只在 ThemeProvider 挂载期间有效。
   */
  readonly setViewerStage: (stage: ViewerStage) => void
}

/** 主题中密度、CSS 变量、看图背景以外的部分。不从入口导出。 */
export interface ThemeBase {
  readonly theme: Theme
  readonly colorMode: ColorModePreference
  readonly setColorMode: (mode: ColorModePreference) => void
  readonly setDensity: (density: Density) => void
}

/** 看图背景的档位与切换函数。不从入口导出。 */
export interface ViewerStageState {
  readonly stage: ViewerStage
  readonly setStage: (stage: ViewerStage) => void
}

// 只由 ThemeProvider 提供；ThemeProvider 之外都是 null
export const ThemeBaseContext = createContext<ThemeBase | null>(null)
export const DensityContext = createContext<Density | null>(null)
export const CssVarsContext = createContext<CssVars | null>(null)
export const ViewerStageContext = createContext<ViewerStageState | null>(null)

/**
 * antd 的 CSS 变量（`--vl-ant-*`）所在的类名，即 ThemeProvider 交给 antd 的 `cssVar.key`（theme/antd.ts）。antd 组件的
 * 根元素都带着它；App 的根元素也带上它，应用中不属于 antd 组件的元素（如 antd 全局样式中的链接）同样取到这些变量，
 * 与原来的 antd App 相同。组件库内部使用，不从入口导出。
 */
export function antdCssVarClass(theme: Pick<Theme, 'id' | 'mode'>): string {
  return `vl-${theme.id}-${theme.mode}`
}

/** 组件库内部：当前密度，ThemeProvider 之外为 null（不抛错，组件在服务端渲染与单元测试中也能使用）。不从入口导出。 */
export function useDensity(): Density | null {
  return useContext(DensityContext)
}

/** 组件库内部：编译出的 CSS 变量，ThemeProvider 之外为 null。不从入口导出。 */
export function useCssVars(): CssVars | null {
  return useContext(CssVarsContext)
}

/** 组件库内部：看图背景的档位与切换函数，ThemeProvider 之外为 null。不从入口导出。 */
export function useViewerStage(): ViewerStageState | null {
  return useContext(ViewerStageContext)
}

/**
 * Hook that reads and changes the current theme. Returns a ThemeContextValue: the resolved `theme`, the color mode
 * in effect (`mode`) and the preference (`colorMode`), `density`, `viewerStage`, the compiled `cssVars`, and the
 * setters `setColorMode`, `setDensity` and `setViewerStage`. Must be used inside ThemeProvider; throws otherwise.
 * Use it for theme, color mode and density switchers.
 * @zh 读取与切换当前主题的 hook。返回 ThemeContextValue：解析后的 `theme`、实际生效的明暗模式 `mode` 与偏好
 * `colorMode`、`density`、`viewerStage`、编译出的 `cssVars`，以及设置函数 `setColorMode`、`setDensity`、
 * `setViewerStage`。必须在 ThemeProvider 之内使用，否则抛出错误。用于主题、明暗模式与密度的切换控件。
 * @group Theme
 */
export function useTheme(): ThemeContextValue {
  const base = useContext(ThemeBaseContext)
  const density = useContext(DensityContext)
  const cssVars = useContext(CssVarsContext)
  const viewer = useContext(ViewerStageContext)
  // 合成的对象只在其中某个上下文变化时换新
  const value = useMemo<ThemeContextValue | null>(
    () =>
      base === null || density === null || cssVars === null || viewer === null
        ? null
        : {
            theme: base.theme,
            mode: base.theme.mode,
            colorMode: base.colorMode,
            density,
            viewerStage: viewer.stage,
            cssVars,
            setColorMode: base.setColorMode,
            setDensity: base.setDensity,
            setViewerStage: viewer.setStage,
          },
    [base, density, cssVars, viewer],
  )
  if (!value) throw new Error('useTheme must be used inside <ThemeProvider>')
  return value
}
