/**
 * ThemeProvider：把主题编译成 CSS 变量注入文档根，同时为 antd 提供映射后的 ConfigProvider。
 * 明暗模式（浅色 / 深色 / 跟随系统）、密度、看图背景档位、语言都可在运行时切换，无需刷新。
 */
import { ConfigProvider } from 'antd'
import type { Locale } from 'antd/es/locale/index.js'
import * as antdEnUSModule from 'antd/locale/en_US.js'
import * as antdZhCNModule from 'antd/locale/zh_CN.js'
import dayjs from 'dayjs'
// 日期组件按语言格式化时需要 dayjs 的语言数据（en 内置）
import 'dayjs/locale/zh-cn.js'
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useInsertionEffect,
  useMemo,
  useState,
} from 'react'
import '../base.css'
import { BuiltinEmpty } from '../components/basic.tsx'
import {
  builtinMessages,
  enUS,
  type LocaleName,
  type Messages,
  MessagesContext,
} from '../i18n/index.ts'
import { type ColorModePreference, defaultTheme, type ThemeDefinition } from '../themes/index.ts'
import type { Density } from '../tokens/component.ts'
import type { ViewerStage } from '../tokens/viewer-stage.ts'
import { toAntdTheme } from './antd.ts'
import {
  type CssVars,
  compileTheme,
  type ExtendedThemeDefinition,
  resolveTheme,
  type Theme,
  toCssText,
} from './compile.ts'

/**
 * Props of ThemeProvider.
 * @zh ThemeProvider 属性。
 */
export interface ThemeProviderProps {
  /**
   * The theme, with its light and dark colors: `defaultTheme` by default, or your own created with extendTheme.
   * Changing it at runtime recompiles the CSS variables.
   * @zh 主题，含浅色与深色两套颜色：默认为 `defaultTheme`，或用 extendTheme 生成的自定义主题。运行时更换会重新编译
   * CSS 变量。
   * @default defaultTheme
   */
  readonly theme?: ThemeDefinition | ExtendedThemeDefinition
  /**
   * Color mode preference (controlled): `light`, `dark` or `system`. Use it with `onColorModeChange` when the
   * preference is stored elsewhere, such as in the user settings; without it, the preference is kept inside and
   * starts at `defaultColorMode`.
   * @zh 明暗偏好（受控）：`light`、`dark` 或 `system`。偏好保存在别处（如用户设置）时与 `onColorModeChange` 一起使用；
   * 省略时由内部保存，初值为 `defaultColorMode`。
   */
  readonly colorMode?: ColorModePreference
  /**
   * Initial color mode preference (uncontrolled); `system` follows the operating system.
   * @zh 初始的明暗偏好（非受控）；`system` 跟随操作系统。
   * @default 'light'
   */
  readonly defaultColorMode?: ColorModePreference
  /**
   * Density (controlled): `comfortable` or `compact`. Use it with `onDensityChange`, such as when the density is
   * read from a setting of the device.
   * @zh 密度（受控）：`comfortable` 或 `compact`。与 `onDensityChange` 一起使用，如密度来自本机的设置时。
   */
  readonly density?: Density
  /**
   * Initial density (uncontrolled).
   * @zh 初始密度（非受控）。
   * @default 'comfortable'
   */
  readonly defaultDensity?: Density
  /**
   * Initial viewer background of FilePreview and Lightbox: `mid`, `dark` or `black`. Users can switch it in their
   * toolbar, and code with `useTheme().setViewerStage`.
   * @zh FilePreview 与 Lightbox 看图背景的初始档位：`mid`、`dark` 或 `black`。用户可以在它们的工具栏中切换，代码中用
   * `useTheme().setViewerStage` 切换。
   * @default 'dark'
   */
  readonly defaultViewerStage?: ViewerStage
  /**
   * The in-app "reduce motion" switch: `true` turns off transitions and animations (the motion durations become
   * 0 ms). The setting of the operating system always applies as well. Sets `data-vl-reduced-motion` on `<html>`.
   * @zh 应用内的「减少动态效果」开关：`true` 时关闭过渡与动画（动效时长变为 0ms）。操作系统的设置同样始终生效。会设置
   * `<html>` 的 `data-vl-reduced-motion`。
   * @default false
   */
  readonly reducedMotion?: boolean
  /**
   * Language: the built-in `en-US` or `zh-CN`, or the text table of a custom language (missing keys fall back to
   * en-US). Also switches the locale of the wrapped Ant Design components and the global locale of dayjs (both are
   * English for a custom text table).
   * @zh 语言：内置的 `en-US`、`zh-CN`，或自定义语言的文本表（缺少的键用 en-US 补齐）。同时切换内部 antd 组件的语言包
   * 与 dayjs 的全局语言（自定义文本表时两者为英文）。
   * @default 'en-US'
   */
  readonly locale?: LocaleName | Messages
  /**
   * Overrides or adds individual texts on top of `locale`, such as `{ 'empty.description': 'No projects' }`.
   * @zh 在 `locale` 的基础上覆盖或补充个别文本，如 `{ 'empty.description': '还没有项目' }`。
   */
  readonly messages?: Messages
  /**
   * Called with the new preference when `useTheme().setColorMode` is called; with a controlled `colorMode`, update
   * it here.
   * @zh 调用 `useTheme().setColorMode` 时调用，参数是新的偏好；受控的 `colorMode` 要在这里更新。
   */
  readonly onColorModeChange?: (mode: ColorModePreference) => void
  /**
   * Called with the new density when `useTheme().setDensity` is called; with a controlled `density`, update it here.
   * @zh 调用 `useTheme().setDensity` 时调用，参数是新的密度；受控的 `density` 要在这里更新。
   */
  readonly onDensityChange?: (density: Density) => void
  /**
   * The application.
   * @zh 应用的内容。
   */
  readonly children?: ReactNode
}

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

const ThemeContext = createContext<ThemeContextValue | null>(null)

// antd 的 locale 是 CJS 模块：TS(nodenext) 与打包器对默认导出的互操作不同，两种形态都兼容
const interop = (m: unknown): Locale => {
  const x = m as { readonly default?: Locale } & Locale
  return x.default ?? x
}

/** 内置语言 → antd 语言包与 dayjs 语言名。 */
const PLATFORM_LOCALES: Readonly<Record<LocaleName, { antd: Locale; dayjs: string }>> = {
  'en-US': { antd: interop(antdEnUSModule), dayjs: 'en' },
  'zh-CN': { antd: interop(antdZhCNModule), dayjs: 'zh-cn' },
}

const STYLE_ELEMENT_ID = 'vl-theme-vars'

function usePrefersDark(): boolean {
  const query = '(prefers-color-scheme: dark)'
  const [dark, setDark] = useState(() =>
    typeof matchMedia === 'function' ? matchMedia(query).matches : false,
  )
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const mql = matchMedia(query)
    const onChange = () => setDark(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])
  return dark
}

/** 语言 → 合并后的文本表（en-US 补齐缺少的键，再叠加 `messages`）与对应的 antd、dayjs 语言。 */
function useLocaleMessages(
  locale: LocaleName | Messages = 'en-US',
  overrides: Messages | undefined,
): { messages: Messages; platform: (typeof PLATFORM_LOCALES)[LocaleName] } {
  const platform = PLATFORM_LOCALES[typeof locale === 'string' ? locale : 'en-US']
  const messages = useMemo<Messages>(
    () => ({
      ...enUS,
      ...(typeof locale === 'string' ? builtinMessages[locale] : locale),
      ...overrides,
    }),
    [locale, overrides],
  )
  return { messages, platform }
}

/**
 * Root component of the design system: wrap the application once, outside App. It compiles the theme into CSS
 * variables (`--vl-*`) in a `<style id="vl-theme-vars">` element in the document head, sets `data-vl-theme`,
 * `data-vl-mode`, `data-vl-density` and `data-vl-reduced-motion` on `<html>`, configures the wrapped Ant Design
 * components from the same theme, and provides the language of the built-in texts. Color mode, density, viewer
 * background and language can be switched at runtime without reloading; useTheme reads and changes them. The styles
 * of the components still have to be imported once (`vellum-ui/styles.css`).
 * @zh 设计系统的根组件：在应用最外层、App 之外包一次。它把主题编译为 CSS 变量（`--vl-*`），写入文档头部的
 * `<style id="vl-theme-vars">` 元素；在 `<html>` 上设置 `data-vl-theme`、`data-vl-mode`、`data-vl-density`、
 * `data-vl-reduced-motion`；用同一个主题配置封装的 Ant Design 组件；并提供内置文本的语言。明暗模式、密度、看图背景与
 * 语言都可以在运行时切换，无需刷新；用 useTheme 读取与切换。组件的样式仍需导入一次（`vellum-ui/styles.css`）。
 * @group Theme
 */
export function ThemeProvider(props: ThemeProviderProps) {
  const [innerMode, setInnerMode] = useState<ColorModePreference>(props.defaultColorMode ?? 'light')
  const [innerDensity, setInnerDensity] = useState<Density>(props.defaultDensity ?? 'comfortable')
  const [viewerStage, setViewerStage] = useState<ViewerStage>(props.defaultViewerStage ?? 'dark')
  const prefersDark = usePrefersDark()
  const colorMode = props.colorMode ?? innerMode
  const density = props.density ?? innerDensity
  const definition = props.theme ?? defaultTheme
  const { onColorModeChange, onDensityChange } = props
  const mode = colorMode === 'system' ? (prefersDark ? 'dark' : 'light') : colorMode

  const theme = useMemo(() => resolveTheme(definition, mode), [definition, mode])
  const cssVars = useMemo(() => compileTheme(theme, { density }), [theme, density])
  const antdConfig = useMemo(() => toAntdTheme(theme, { density }), [theme, density])

  useInsertionEffect(() => {
    let el = document.getElementById(STYLE_ELEMENT_ID)
    if (!el) {
      el = document.createElement('style')
      el.id = STYLE_ELEMENT_ID
      document.head.appendChild(el)
    }
    el.textContent = toCssText(cssVars)
    const root = document.documentElement
    root.dataset.vlTheme = theme.id
    root.dataset.vlMode = theme.mode
    root.dataset.vlDensity = density
    root.dataset.vlReducedMotion = String(props.reducedMotion ?? false)
  }, [cssVars, theme.id, theme.mode, density, props.reducedMotion])

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      mode: theme.mode,
      colorMode,
      density,
      viewerStage,
      cssVars,
      setColorMode: (m) => {
        setInnerMode(m)
        onColorModeChange?.(m)
      },
      setDensity: (d) => {
        setInnerDensity(d)
        onDensityChange?.(d)
      },
      setViewerStage,
    }),
    [theme, colorMode, density, viewerStage, cssVars, onColorModeChange, onDensityChange],
  )

  const { messages, platform } = useLocaleMessages(props.locale, props.messages)
  // dayjs 的语言是全局设置（应用自己格式化日期时也随之切换）。在渲染时同步设置而不是放在副作用中：
  // 子组件在同一次渲染中就会用到；重复设置同一个值没有副作用
  if (dayjs.locale() !== platform.dayjs) dayjs.locale(platform.dayjs)

  return (
    <ThemeContext.Provider value={value}>
      <MessagesContext.Provider value={messages}>
        <ConfigProvider
          theme={antdConfig}
          locale={platform.antd}
          // 全局的 variant 为 filled：输入类组件是不描边的「凹槽」（底色与内阴影见 theme/antd.ts 的 field 与 base.css），
          // antd 的 Steps、Tag、Timeline、Alert、Pagination 等也读取它，同样是填充式外观
          variant="filled"
          // 中文按钮不在两字之间自动插入空格（「删除」而不是「删 除」）
          button={{ autoInsertSpace: false }}
          // 不用 antd 的点击波纹（按钮外扩散的光圈）：按下的反馈只体现在填充色的深浅上，与统一状态层一致
          wave={{ disabled: true }}
          renderEmpty={() => <BuiltinEmpty />}
        >
          {props.children}
        </ConfigProvider>
      </MessagesContext.Provider>
    </ThemeContext.Provider>
  )
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
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}

/** 组件库内部：读取当前主题，ThemeProvider 之外为 null（不抛错，组件在服务端渲染与单元测试中也能使用）。不从入口导出。 */
export function useOptionalTheme(): ThemeContextValue | null {
  return useContext(ThemeContext)
}

/**
 * Props of LocaleProvider.
 * @zh LocaleProvider 属性。
 */
export interface LocaleProviderProps {
  /**
   * Language: the built-in `en-US` or `zh-CN`, or the text table of a custom language (missing keys fall back
   * to en-US).
   * @zh 语言：内置的 `en-US`、`zh-CN`，或自定义语言的文本表（缺少的键用 en-US 补齐）。
   * @default 'en-US'
   */
  readonly locale?: LocaleName | Messages
  /**
   * Overrides or adds individual texts on top of `locale`.
   * @zh 在 `locale` 的基础上覆盖或补充个别文本。
   */
  readonly messages?: Messages
  /**
   * Content shown in this language.
   * @zh 以该语言显示的内容。
   */
  readonly children?: ReactNode
}

/**
 * Switches the language of part of the page: the built-in texts of the components inside it and the locale of
 * the wrapped Ant Design components. Theme, color mode and density stay those of the surrounding
 * ThemeProvider, and the global locale of dayjs is not changed (the date pickers inside still follow `locale`).
 * Use it to preview components in a language other than the application's, for example in documentation;
 * the language of the application itself is set on ThemeProvider.
 * @zh 切换页面中一部分的语言：其中组件的内置文本与内部 antd 组件的语言包。主题、明暗与密度沿用外层的
 * ThemeProvider，也不改变 dayjs 的全局语言（其中的日期选择器仍按 `locale` 显示）。用于以不同于应用的语言
 * 预览组件，如组件文档；应用本身的语言在 ThemeProvider 上设置。
 * @group Localization
 */
export function LocaleProvider(props: LocaleProviderProps) {
  const { messages, platform } = useLocaleMessages(props.locale, props.messages)
  // 嵌套的 ConfigProvider 只覆盖语言包，主题、variant、renderEmpty 等沿用外层 ThemeProvider 中的设置
  return (
    <MessagesContext.Provider value={messages}>
      <ConfigProvider locale={platform.antd}>{props.children}</ConfigProvider>
    </MessagesContext.Provider>
  )
}
