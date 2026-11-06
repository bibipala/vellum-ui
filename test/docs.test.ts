import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CATEGORIES,
  CJK,
  COMPONENTS_JSON,
  type ComponentDoc,
  type DocText,
  GENERATED_DIRS,
  generate,
  HAN,
  joinCjkLines,
  LANGUAGES,
  pkgRoot,
  SECTIONS,
} from '../scripts/docs.ts'

// 组件文档从代码生成，必须完整、两种语言齐全且与代码同步；生成物只在本包内
describe('组件文档', () => {
  const { files, components, problems } = generate()

  /** 一段文档文字的英文、中文：都不能为空，英文中不得有 CJK 文字与全角标点，中文中必须有汉字。 */
  function bilingual(where: string, t: DocText): string[] {
    const out: string[] = []
    if (!t.en.trim()) out.push(`${where}: 英文为空`)
    if (CJK.test(t.en)) out.push(`${where}: 英文中有 CJK 字符「${t.en.match(CJK)?.[0]}」`)
    if (!t.zh.trim()) out.push(`${where}: 中文为空`)
    else if (!HAN.test(t.zh)) out.push(`${where}: 中文中没有汉字`)
    return out
  }

  it('每个组件都有说明、常见用途、属性说明与「基本用法」示例', () => {
    expect(problems).toEqual([])
  })

  it('能识别 CJK 字符与汉字', () => {
    expect(CJK.test('Basic usage')).toBe(false)
    expect(CJK.test('Wait 200 ms — then fade in (“reduce motion”)')).toBe(false)
    for (const s of ['基本', '，', '（', '「', '。', 'ア', '한']) expect(CJK.test(s), s).toBe(true)
    expect(HAN.test('按钮 Button')).toBe(true)
    expect(HAN.test('Button，')).toBe(false)
  })

  it('每个组件、属性、示例的英文与中文都齐全：英文中没有 CJK 字符，中文中有汉字', () => {
    expect(components.length).toBeGreaterThan(0)
    const issues = components.flatMap((c) => [
      ...bilingual(`${c.name} 分类`, c.category),
      ...bilingual(`${c.name} 说明`, c.summary),
      ...bilingual(`${c.name} 常见用途`, c.usage),
      ...c.props.flatMap((p) => bilingual(`${c.name}.${p.name} 属性说明`, p.description)),
      ...c.examples.flatMap((e) => [
        ...bilingual(`${c.name} 示例 ${e.name} 的标题`, e.title),
        ...bilingual(`${c.name} 示例 ${e.name} 的章节`, e.section),
        // 说明可以省略，但两种语言要么都有、要么都没有
        ...(e.description.en || e.description.zh
          ? bilingual(`${c.name} 示例 ${e.name} 的说明`, e.description)
          : []),
      ]),
    ])
    expect(issues).toEqual([])
  })

  it('分类与章节是约定的取值（英文为标识，另有中文显示名）', () => {
    for (const c of components) {
      expect(CATEGORIES, c.name).toContainEqual(c.category)
      for (const e of c.examples) expect(SECTIONS, `${c.name}.${e.name}`).toContainEqual(e.section)
    }
  })

  it('示例代码中的界面数据是英文：代码中没有 CJK 字符', () => {
    const offenders = components.flatMap((c) =>
      c.examples.filter((e) => CJK.test(e.code)).map((e) => `${c.name}.${e.name}`),
    )
    expect(offenders).toEqual([])
  })

  it('生成物都在本包内：docs/、stories/generated/', () => {
    for (const rel of files.keys()) {
      expect(rel, rel).toMatch(/^(docs|stories\/generated)\//)
      const r = path.relative(pkgRoot, path.resolve(pkgRoot, rel))
      expect(r.startsWith('..') || path.isAbsolute(r), rel).toBe(false)
    }
    for (const dir of GENERATED_DIRS) expect(dir).toMatch(/^(docs|stories)\//)
  })

  it('en-US 与 zh-CN 两套文档结构相同，页首链接到另一种语言的同一页', () => {
    const pagesOf = (dir: string) =>
      [...files.keys()]
        .filter((rel) => rel.startsWith(`docs/${dir}/`))
        .map((rel) => rel.slice(`docs/${dir}/`.length))
        .sort()
    const [en, zh] = LANGUAGES.map((l) => pagesOf(l.dir))
    expect(en).toEqual(zh)
    expect(en).toEqual(['README.md', ...components.map((c) => `components/${c.name}.md`)].sort())
    for (const { dir } of LANGUAGES) {
      const other = LANGUAGES.find((l) => l.dir !== dir)?.dir
      for (const page of en ?? []) {
        const content = files.get(`docs/${dir}/${page}`) ?? ''
        const up = page.includes('/') ? '../../' : '../'
        expect(content, `${dir}/${page}`).toContain(`](${up}${other}/${page})`)
      }
    }
    const entry = files.get('docs/README.md') ?? ''
    for (const { dir } of LANGUAGES) expect(entry).toContain(`](${dir}/README.md)`)
  })

  it('README 有英文与简体中文两版，页首互相链接', () => {
    const read = (f: string) => readFileSync(path.join(pkgRoot, f), 'utf8')
    expect(read('README.md')).toContain('[简体中文](README.zh-CN.md)')
    expect(read('README.zh-CN.md')).toContain('[English](README.md)')
    expect(CJK.test(read('README.zh-CN.md'))).toBe(true)
  })

  it('docs/components.json 是 ComponentDocsJson（文字字段为 { en, zh }），与文档页同源，并由包导出', () => {
    const json = files.get(COMPONENTS_JSON)
    expect(json).toBeDefined()
    const data = JSON.parse(json ?? '[]') as ComponentDoc[]
    expect(data).toEqual(components)
    const isText = (t: unknown) =>
      typeof t === 'object' &&
      t !== null &&
      Object.keys(t).sort().join() === 'en,zh' &&
      Object.values(t).every((v) => typeof v === 'string')
    for (const c of data) {
      for (const { dir } of LANGUAGES)
        expect(files.has(`docs/${dir}/components/${c.name}.md`), c.name).toBe(true)
      for (const t of [c.category, c.summary, c.usage]) expect(isText(t), c.name).toBe(true)
      for (const p of c.props) expect(isText(p.description), `${c.name}.${p.name}`).toBe(true)
      for (const e of c.examples)
        for (const t of [e.title, e.description, e.section])
          expect(isText(t), `${c.name}.${e.name}`).toBe(true)
    }
    const pkg = JSON.parse(readFileSync(path.join(pkgRoot, 'package.json'), 'utf8')) as {
      exports: Record<string, string>
    }
    expect(pkg.exports[`./${COMPONENTS_JSON}`]).toBe(`./${COMPONENTS_JSON}`)
  })

  it('生成结果与仓库中的文件一致（修改组件后运行 pnpm --filter vellum-ui docs:gen）', () => {
    const outdated = [...files]
      .filter(([rel, content]) => {
        const abs = path.join(pkgRoot, rel)
        return !existsSync(abs) || readFileSync(abs, 'utf8') !== content
      })
      .map(([rel]) => rel)
    const stale = GENERATED_DIRS.flatMap((dir) => {
      const abs = path.join(pkgRoot, dir)
      return existsSync(abs)
        ? readdirSync(abs)
            .map((f) => `${dir}/${f}`)
            .filter((rel) => !files.has(rel))
        : []
    })
    expect({ outdated, stale }).toEqual({ outdated: [], stale: [] })
  }, 60_000)
})

describe('TSDoc 软换行', () => {
  it('两个 CJK 字符之间的换行直接相连，其余换行保留', () => {
    expect(joinCjkLines('之前的步骤\n为已完成')).toBe('之前的步骤为已完成')
    expect(joinCjkLines('部分，\n  其余')).toBe('部分，其余')
    // 代码与汉字之间、英文单词之间保留换行（渲染时为空格），段落与列表不变
    expect(joinCjkLines('`current`\n为进行中')).toBe('`current`\n为进行中')
    expect(joinCjkLines('two\nwords')).toBe('two\nwords')
    expect(joinCjkLines('第一段。\n\n第二段')).toBe('第一段。\n\n第二段')
    expect(joinCjkLines('说明：\n- 第一项')).toBe('说明：\n- 第一项')
  })
})
