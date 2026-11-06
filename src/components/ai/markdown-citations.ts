/**
 * Markdown 中的引用标记：`[1]`、`[^1]` 渲染为 Citation（Markdown 设置了 `sources` 时才启用）。
 *
 * 用 marked 的行内扩展在解析阶段识别，输出组件库自己的标签 `<vl-citation data-index="1">`，再由 XMarkdown 的
 * `components` 换成 Citation。原文中直接写的 `<vl-citation>` 属于原始 HTML，已被转义为文字，不会变成引用。
 * 后面紧跟 `(` 的不算（那是链接）；引用定义 `[1]: 地址` 在块级解析时已经处理，不会到这里。对象引用固定，XMarkdown 的解析器不会因此重建。
 * 组件库内部使用，不从入口导出。
 */
import type { XMarkdownProps } from '@ant-design/x-markdown/es/index.js'

type MarkedConfig = NonNullable<XMarkdownProps['config']>

/** 引用标记的写法：`[1]` 或 `[^1]`，编号 1–999。 */
const CITATION = /^\[\^?([1-9]\d{0,2})\](?!\()/

/** 自定义标签名（也是 XMarkdown `components` 中的键）。 */
export const CITATION_TAG = 'vl-citation'

export const CITATION_CONFIG: MarkedConfig = {
  extensions: [
    {
      name: 'vlCitation',
      level: 'inline',
      start(src: string) {
        const i = src.search(/\[\^?[1-9]/)
        return i === -1 ? undefined : i
      },
      tokenizer(src: string) {
        const m = CITATION.exec(src)
        if (!m) return undefined
        return { type: 'vlCitation', raw: m[0], index: Number(m[1]) }
      },
      renderer(token) {
        return `<${CITATION_TAG} data-index="${Number(token.index)}"></${CITATION_TAG}>`
      },
    },
  ],
}
