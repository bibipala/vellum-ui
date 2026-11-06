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

/** ThemeProvider 属性。 */
export interface ThemeProviderProps {
  /** 主题定义（含浅色与深色两套颜色），默认内置的 `default`。 */
  readonly theme?: ThemeDefinition | ExtendedThemeDefinition
  /** 受控的明暗偏好。省略时为非受控，初值取 `defaultColorMode`。 */
  readonly colorMode?: ColorModePreference
  /** 非受控初始明暗偏好，默认 `light`。 */
  readonly defaultColorMode?: ColorModePreference
  /** 受控密度：使用方从本机设置读取后传入，切换时通过 `onDensityChange` 写回。 */
  readonly density?: Density
  /** 非受控初始密度，默认 `comfortable`。 */
  readonly defaultDensity?: Density
  /** 看图背景（Lightbox）的默认档位，默认 `dark`。 */
  readonly defaultViewerStage?: ViewerStage
  /** 应用内「减少动态效果」开关（系统设置始终生效）。 */
  readonly reducedMotion?: boolean
  /**
   * 语言：内置的 `en-US`、`zh-CN`，或自定义语言的文本表（缺少的键用 en-US 补齐）。
   * 同时切换内部 antd 组件的语言包与 dayjs 的全局语言（自定义文本表时两者为 en-US）。
   * @default 'en-US'
   */
  readonly locale?: LocaleName | Messages
  /** 在 `locale` 的基础上覆盖或补充个别文本。 */
  readonly messages?: Messages
  /** 明暗偏好变化回调（受控模式下由此更新外部状态）。 */
  readonly onColorModeChange?: (mode: ColorModePreference) => void
  /** 密度变化回调（`useTheme().setDensity` 调用时触发；受控模式下由此更新外部状态）。 */
  readonly onDensityChange?: (density: Density) => void
  readonly children?: ReactNode
}

/** useTheme 返回值。 */
export interface ThemeContextValue {
  /** 当前生效的主题（明暗已解析）。 */
  readonly theme: Theme
  /** 实际生效的明暗模式（`system` 已按系统设置解析）。 */
  readonly mode: Theme['mode']
  /** 用户的明暗偏好。 */
  readonly colorMode: ColorModePreference
  readonly density: Density
  readonly viewerStage: ViewerStage
  /** 当前编译出的 CSS 变量。 */
  readonly cssVars: CssVars
  readonly setColorMode: (mode: ColorModePreference) => void
  readonly setDensity: (density: Density) => void
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

/** 设计系统根组件。应用（或 Storybook）最外层包一次即可。 */
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
          // 输入类组件统一为填充式：中性底、不描边，聚焦时显示强调色细边与光环
          variant="filled"
          // 中文按钮不在两字之间自动插入空格（「删除」而不是「删 除」）
          button={{ autoInsertSpace: false }}
          renderEmpty={() => <BuiltinEmpty />}
        >
          {props.children}
        </ConfigProvider>
      </MessagesContext.Provider>
    </ThemeContext.Provider>
  )
}

/** 读取与切换当前主题。必须在 ThemeProvider 内使用。 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}

/** 组件库内部：读取当前主题，ThemeProvider 之外为 null（不抛错，组件在服务端渲染与单元测试中也能使用）。不从入口导出。 */
export function useOptionalTheme(): ThemeContextValue | null {
  return useContext(ThemeContext)
}

/** LocaleProvider 属性。 */
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
