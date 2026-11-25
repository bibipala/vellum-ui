/**
 * 生成组件文档（只写本包内的 docs/ 与 stories/generated/；docs/en-US、docs/zh-CN 两种语言）：
 *   node scripts/docs-gen.ts   写入（pnpm docs:gen）
 *
 * 检查文档是否完整、最新由 test/docs.test.ts 负责（vitest 的 docs 项目，`pnpm docs:check`，也包含在 `pnpm test` 中）：
 * 一次检查只生成一次完整的文档模型，这里不再重复生成与比较。
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { compareGenerated, generate, pkgRoot } from './docs.ts'

if (process.argv.includes('--check')) {
  // 以前的检查方式：不要在这里悄悄改成写入
  console.error('检查文档请运行 pnpm docs:check（test/docs.test.ts）；这个脚本只负责生成。')
  process.exit(2)
}
const { files, problems } = generate()
const { changed, stale } = compareGenerated(files)
for (const rel of changed) {
  const abs = path.join(pkgRoot, rel)
  mkdirSync(path.dirname(abs), { recursive: true })
  writeFileSync(abs, files.get(rel) ?? '')
}
for (const rel of stale) rmSync(path.join(pkgRoot, rel))
console.log(`已生成 ${changed.length} 个文件，删除 ${stale.length} 个过时文件`)
for (const p of problems) console.warn(`文档不完整：${p}`)
