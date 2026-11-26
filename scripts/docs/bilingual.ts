/**
 * 双语文字：两种语言的检查（缺语言、英文中有中文、中文中没有汉字）、TSDoc 中文软换行的连接，以及取值固定的标签
 * （`@category`、`@section`、`@group`）的双语清单。
 */
import type { DocText } from './model.ts'

/** CJK 文字与全角标点：英文正文中不得出现。 */
export const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}　-〿＀-￯]/u
/** 汉字：`@zh` 中必须有。 */
export const HAN = /\p{Script=Han}/u

/**
 * TSDoc 中的软换行：两侧都是 CJK 字符时直接相连，其余保持原样。中文在两个汉字之间换行时，换行不能变成空格
 * （否则文档里出现「步骤 为已完成」）；英文单词之间、代码与汉字之间的换行仍按空格处理，段落与列表不受影响。
 */
const CJK_SOFT_BREAK = new RegExp(`(?<=${CJK.source})[ \\t]*\\n[ \\t]*(?=${CJK.source})`, 'gu')
export const joinCjkLines = (s: string) => s.replace(CJK_SOFT_BREAK, '')

/**
 * 一段双语文字的问题：英文与中文都不能为空（`optional` 时可以同时为空），英文中不得有 CJK 文字与全角标点，
 * 中文中必须有汉字。
 */
export function textProblems(where: string, t: DocText, optional = false): string[] {
  const out: string[] = []
  if (optional && !t.en && !t.zh) return out
  if (!t.en) out.push(`${where}: 缺少英文`)
  else if (CJK.test(t.en)) out.push(`${where}: 英文正文中有中文或全角标点`)
  if (!t.zh) out.push(`${where}: 缺少 @zh 中文`)
  else if (!HAN.test(t.zh)) out.push(`${where}: @zh 中没有中文`)
  return out
}

/** 分类（总览中的顺序）：`en` 是 `@category` 的取值，`zh` 是中文显示名。 */
export const CATEGORIES: readonly DocText[] = [
  { en: 'Primitives', zh: '原语' },
  { en: 'Basic', zh: '基础' },
  { en: 'Data', zh: '数据' },
  { en: 'Charts', zh: '图表' },
  { en: 'AI', zh: 'AI 与流式' },
  { en: 'Feedback', zh: '反馈' },
  { en: 'Patterns', zh: '模式' },
  { en: 'Media', zh: '看图' },
]

/** 示例的章节（文档页中的顺序）：`en` 是 `@section` 的取值（省略时为第一项），`zh` 是中文显示名。 */
export const SECTIONS: readonly DocText[] = [
  { en: 'Basic usage', zh: '基本用法' },
  { en: 'Variants', zh: '变体' },
  { en: 'States', zh: '状态' },
  { en: 'Advanced', zh: '进阶用法' },
]

/**
 * API 参考的分组（组件以外的导出：主题、颜色、本地化、快捷键、流式、工具）：`en` 是 `@group` 的取值，
 * `slug` 是页面文件名。
 */
export const API_GROUPS: readonly { slug: string; title: DocText; intro: DocText }[] = [
  {
    slug: 'theme',
    title: { en: 'Theme', zh: '主题' },
    intro: {
      en: 'The root component, the built-in theme, and the functions that build and compile themes into CSS variables.',
      zh: '根组件、内置主题，以及创建主题、把主题编译为 CSS 变量的函数。',
    },
  },
  {
    slug: 'colors',
    title: { en: 'Colors', zh: '颜色' },
    intro: {
      en: 'OKLCH colors: creating, converting and checking contrast, as used by themes.',
      zh: 'OKLCH 颜色：创建、转换与检查对比度，主题中使用。',
    },
  },
  {
    slug: 'i18n',
    title: { en: 'Localization', zh: '本地化' },
    intro: {
      en: 'The texts of the library itself (button labels, empty states, screen reader texts) in English and Simplified Chinese, and how to replace them.',
      zh: '组件库自身的文字（按钮文字、空状态、读屏文字），英文与简体中文，以及如何替换。',
    },
  },
  {
    slug: 'hotkeys',
    title: { en: 'Keyboard shortcuts', zh: '快捷键' },
    intro: {
      en: 'Registering keyboard shortcuts is done with useHotkeys; these exports list the registered shortcuts, such as for a shortcut help.',
      zh: '注册快捷键用 useHotkeys；这里的导出用来列出已注册的快捷键，如快捷键帮助。',
    },
  },
  {
    slug: 'streaming',
    title: { en: 'Streaming', zh: '流式' },
    intro: {
      en: 'Reading streamed responses (Server-Sent Events and plain text) for AI replies; useStream builds on them.',
      zh: '读取流式响应（Server-Sent Events 与纯文本），用于 AI 回复；useStream 基于它们。',
    },
  },
  {
    slug: 'utilities',
    title: { en: 'Utilities', zh: '工具' },
    intro: {
      en: 'Hooks and functions used together with the components: delayed loading states, icon names, command matching.',
      zh: '与组件配合使用的 hook 与函数：延迟显示的加载态、图标名称、命令匹配。',
    },
  },
]
