/**
 * 生成物与磁盘上的文件比较：`pnpm docs:gen`（scripts/docs-gen.ts）据此写入与删除，test/docs.test.ts 据此检查
 * 文档是最新的。
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { LANGUAGES } from './model.ts'

/** 生成目录：这些目录下不在产物清单中的文件视为过时。 */
export const GENERATED_DIRS = [
  ...LANGUAGES.flatMap((l) => [
    `docs/${l.dir}/components`,
    `docs/${l.dir}/api`,
    `docs/${l.dir}/recipes`,
  ]),
  'stories/generated',
]

/**
 * 生成物（相对 `root` 的路径 → 内容）与 `root` 中的文件比较：`changed` 是内容不同或还不存在的文件，`stale` 是
 * 生成目录 `dirs` 中已经不再生成的文件。
 */
export function compareFiles(
  files: ReadonlyMap<string, string>,
  root: string,
  dirs: readonly string[] = GENERATED_DIRS,
): { changed: string[]; stale: string[] } {
  const changed = [...files]
    .filter(([rel, content]) => {
      const abs = path.join(root, rel)
      return !existsSync(abs) || readFileSync(abs, 'utf8') !== content
    })
    .map(([rel]) => rel)
  const stale = dirs.flatMap((dir) => {
    const abs = path.join(root, dir)
    return existsSync(abs)
      ? readdirSync(abs)
          .map((f) => `${dir}/${f}`)
          .filter((rel) => !files.has(rel))
      : []
  })
  return { changed, stale }
}
