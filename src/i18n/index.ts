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

/**
 * Key of a built-in text, such as `empty.description` or `confirm.ok`: the keys of `enUS`. The keys are part of the
 * public API; the texts are not.
 * @zh 内置文本的键，如 `empty.description`、`confirm.ok`，即 `enUS` 的键。键属于公共接口，文字不属于。
 */
export type MessageKey = keyof typeof enUS

/**
 * A text table: key → text. Texts may contain `{name}` placeholders, which formatMessage fills in. Used for the
 * `locale` and `messages` of ThemeProvider and LocaleProvider; the keys are the built-in `MessageKey`s, and other keys
 * (such as the `nameKey` of a custom theme) are allowed too.
 * @zh 文本表：键 → 文字。文字中可以有 `{name}` 占位符，由 formatMessage 填入。用于 ThemeProvider 与 LocaleProvider 的
 * `locale` 与 `messages`；键是内置的 `MessageKey`，也可以有其他键（如自定义主题的 `nameKey`）。
 */
export type Messages = Readonly<Partial<Record<MessageKey, string>>> &
  Readonly<Record<string, string>>

/**
 * A built-in language: `en-US` (English, the default) or `zh-CN` (Simplified Chinese).
 * @zh 内置语言：`en-US`（英文，默认）或 `zh-CN`（简体中文）。
 */
export type LocaleName = 'en-US' | 'zh-CN'

/**
 * The complete text tables of the built-in languages, by language name: `builtinMessages['zh-CN']` is `zhCN`. To
 * translate the library into another language, start from one of them and pass your table to ThemeProvider's
 * `locale`.
 * @zh 内置语言的完整文本表，按语言名排列：`builtinMessages['zh-CN']` 即 `zhCN`。要把组件库翻译成其他语言，以其中一份
 * 为基础，把自己的文本表传给 ThemeProvider 的 `locale`。
 * @group Localization
 */
export const builtinMessages: Readonly<Record<LocaleName, Readonly<Record<MessageKey, string>>>> = {
  'en-US': enUS,
  'zh-CN': zhCN,
}

/**
 * Looks up a built-in text and fills in its placeholders. `messages` is the text table to look in: a key missing
 * from it falls back to the English text, and a key missing from both returns the key itself. `params` fills the
 * `{name}` placeholders, such as `{ name: 'Report' }` for `Type "{name}" to confirm`; a placeholder without a value
 * stays as it is. Returns the text. Components use it through useT; call it directly outside React.
 * @zh 查找内置文本并填入占位符。`messages` 是要查找的文本表：其中缺少的键用英文文本补齐，英文也没有时返回键本身。
 * `params` 填入 `{name}` 占位符，如 `Type "{name}" to confirm` 配 `{ name: 'Report' }`；没有对应值的占位符保持原样。
 * 返回文字。组件中通过 useT 使用；在 React 之外直接调用。
 * @group Localization
 */
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

/**
 * Hook that returns the translation function of the current language, `t(key, params)`: it looks up a built-in
 * text in the text table of the nearest ThemeProvider or LocaleProvider (English outside them) and fills in
 * `{name}` placeholders like formatMessage. The function changes only when the language changes. Use it in your
 * own components to show texts of the library, such as `t('error.retry')`.
 * @zh 返回当前语言的翻译函数 `t(key, params)` 的 hook：在最近的 ThemeProvider 或 LocaleProvider 的文本表中查找内置
 * 文本（在它们之外为英文），并像 formatMessage 一样填入 `{name}` 占位符。只有语言变化时函数才会变化。在自己的组件中
 * 显示组件库的文字时使用，如 `t('error.retry')`。
 * @group Localization
 */
export function useT() {
  const messages = useContext(MessagesContext)
  return useCallback(
    (key: MessageKey, params?: Readonly<Record<string, string | number>>) =>
      formatMessage(messages, key, params),
    [messages],
  )
}
