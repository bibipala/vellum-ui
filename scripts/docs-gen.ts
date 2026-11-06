/**
 * 生成或检查组件文档（只写本包内的 docs/ 与 stories/generated/；docs/en-US、docs/zh-CN 两种语言）：
 *   node scripts/docs-gen.ts          写入
 *   node scripts/docs-gen.ts --check  只检查是否最新（测试中也会检查）
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { GENERATED_DIRS, generate, pkgRoot } from './docs.ts'

const check = process.argv.includes('--check')
const { files, problems } = generate()
const stale: string[] = []
for (const dir of GENERATED_DIRS) {
  const abs = path.join(pkgRoot, dir)
  if (!existsSync(abs)) continue
  for (const f of readdirSync(abs)) {
    const rel = `${dir}/${f}`
    if (!files.has(rel)) stale.push(rel)
  }
}
const changed = [...files].filter(([rel, content]) => {
  const abs = path.join(pkgRoot, rel)
  return !existsSync(abs) || readFileSync(abs, 'utf8') !== content
})

if (check) {
  for (const p of problems) console.error(`文档不完整：${p}`)
  for (const [rel] of changed) console.error(`需要重新生成：${rel}`)
  for (const rel of stale) console.error(`过时文件：${rel}`)
  process.exit(problems.length || changed.length || stale.length ? 1 : 0)
}
for (const [rel, content] of changed) {
  const abs = path.join(pkgRoot, rel)
  mkdirSync(path.dirname(abs), { recursive: true })
  writeFileSync(abs, content)
}
for (const rel of stale) rmSync(path.join(pkgRoot, rel))
console.log(`已生成 ${changed.length} 个文件，删除 ${stale.length} 个过时文件`)
for (const p of problems) console.warn(`文档不完整：${p}`)
