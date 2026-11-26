/**
 * 手写的指南：`docs/<语言>/guides/<slug>.md`，两种语言文件名相同。第一个 `# ` 是标题，它后面的第一段是简介，
 * 出现在总览、llms.txt 与文档站中。
 */
import path from 'node:path'
import { joinCjkLines, textProblems } from './bilingual.ts'
import { type GuideDoc, LANGUAGES } from './model.ts'
import type { DocsSource } from './program.ts'

/** 指南在总览与 llms.txt 中的顺序；其余的按文件名排在后面。 */
const GUIDE_ORDER = ['building-pages', 'conventions', 'custom-styles', 'motion']

/** 指南所在的目录（相对根目录）。 */
export const guidesDir = (dir: string) => path.join('docs', dir, 'guides')

export function readGuides(source: DocsSource): { guides: GuideDoc[]; problems: string[] } {
  const problems: string[] = []
  const pick = (dir: string) =>
    source.list(path.join(source.root, guidesDir(dir))).filter((f) => f.endsWith('.md'))
  const [en = [], zh = []] = LANGUAGES.map((l) => pick(l.dir))
  for (const f of en) if (!zh.includes(f)) problems.push(`指南 ${f}: 缺少 zh-CN 版`)
  for (const f of zh) if (!en.includes(f)) problems.push(`指南 ${f}: 缺少 en-US 版`)
  const head = (dir: string, file: string) => {
    const body = source.read(path.join(source.root, guidesDir(dir), file)) ?? ''
    const lines = body.split('\n')
    const h = lines.findIndex((l) => l.startsWith('# '))
    const title = h >= 0 ? (lines[h] ?? '').slice(2).trim() : ''
    const rest = lines.slice(h + 1)
    const startAt = rest.findIndex((l) => l.trim() !== '')
    const para: string[] = []
    for (const l of rest.slice(startAt)) {
      if (!l.trim()) break
      para.push(l.trim())
    }
    return { title, summary: joinCjkLines(para.join('\n')).replace(/\n/g, ' '), body }
  }
  const order = (f: string) => {
    const i = GUIDE_ORDER.indexOf(f.replace(/\.md$/, ''))
    return i < 0 ? GUIDE_ORDER.length : i
  }
  const guides = en
    .filter((f) => zh.includes(f))
    .sort((a, b) => order(a) - order(b) || a.localeCompare(b))
    .map((f) => {
      const e = head('en-US', f)
      const z = head('zh-CN', f)
      const g = {
        slug: f.replace(/\.md$/, ''),
        title: { en: e.title, zh: z.title },
        summary: { en: e.summary, zh: z.summary },
        markdown: { en: e.body, zh: z.body },
      }
      problems.push(...textProblems(`指南 ${f} 的标题`, g.title))
      problems.push(...textProblems(`指南 ${f} 的简介（标题后的第一段）`, g.summary))
      return g
    })
  return { guides, problems }
}
