/**
 * 内置文本的最小 i18n。组件中所有用户可见的默认文本都从这里取，不在组件里写死。
 *
 * 内置两种语言：`en-US`（默认）与 `zh-CN`，文本在 `locales/` 下。应用通过 ThemeProvider 的 `locale` 选择语言
 * （或传入自定义的文本表），用 `messages` 覆盖或补充个别文本。
 */
import { createContext, useCallback, useContext } from 'react'
import { enUS } from './locales/en-US.ts'
import { zhCN } from './locales/zh-CN.ts'

export { enUS, zhCN }

/** 内置文本键。 */
export type MessageKey = keyof typeof enUS

/** 文本表：键 → 文本，可包含 `{name}` 占位符。 */
export type Messages = Readonly<Partial<Record<MessageKey, string>>> &
  Readonly<Record<string, string>>

/** 内置语言。 */
export type LocaleName = 'en-US' | 'zh-CN'

/** 内置语言的文本表。 */
export const builtinMessages: Readonly<Record<LocaleName, Readonly<Record<MessageKey, string>>>> = {
  'en-US': enUS,
  'zh-CN': zhCN,
}

/** 格式化文本，替换 `{name}` 占位符；文本表中缺少的键用 en-US 补齐，en-US 也没有的返回键本身。 */
export function formatMessage(
  messages: Messages,
  key: MessageKey,
  params?: Readonly<Record<string, string | number>>,
): string {
  const template = messages[key] ?? enUS[key] ?? key
  return params
    ? template.replace(/\{(\w+)\}/g, (m, p: string) => String(params[p] ?? m))
    : template
}

/** 当前语言的文本表。ThemeProvider 之外使用组件时为 en-US。 */
export const MessagesContext = createContext<Messages>(enUS)

/** 取当前语言的翻译函数。 */
export function useT() {
  const messages = useContext(MessagesContext)
  return useCallback(
    (key: MessageKey, params?: Readonly<Record<string, string | number>>) =>
      formatMessage(messages, key, params),
    [messages],
  )
}
