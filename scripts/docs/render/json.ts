/**
 * 机器可读的文档数据 `docs/components.json`：ComponentDocsJson（类型见 src/docs.ts，经包导出
 * `vellum-ui/docs/components.json`），供使用方在自己的文档站或应用内浏览组件。
 */
import type { ComponentDoc } from '../model.ts'

export const componentsJson = (components: readonly ComponentDoc[]) =>
  `${JSON.stringify(components, null, 2)}\n`
