import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import ts from '@typescript/typescript6'
import { describe, expect, it } from 'vitest'
import {
  API_GROUPS,
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
  LLMS_TXT,
  pkgRoot,
  SECTIONS,
} from '../scripts/docs.ts'
import { tokenRows } from '../scripts/tokens.ts'

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

  it('生成物都在本包内：docs/、stories/generated/ 与根目录的 llms.txt', () => {
    for (const rel of files.keys()) {
      expect(rel, rel).toMatch(/^((docs|stories\/generated)\/|llms\.txt$)/)
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
    const apiPages = [...files.keys()].filter((f) => f.startsWith('docs/en-US/api/'))
    const recipePages = [...files.keys()].filter((f) => f.startsWith('docs/en-US/recipes/'))
    expect(en).toEqual(
      [
        'README.md',
        'tokens.md',
        ...components.map((c) => `components/${c.name}.md`),
        ...apiPages.map((f) => f.slice('docs/en-US/'.length)),
        ...recipePages.map((f) => f.slice('docs/en-US/'.length)),
      ].sort(),
    )
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

  const byName = (name: string) => {
    const c = components.find((x) => x.name === name)
    if (!c) throw new Error(`没有 ${name} 的文档`)
    return c
  }

  it('属性是联合类型的组件按用法分组：共有的属性在主表，各用法只列不同的属性', () => {
    const select = byName('Select')
    expect(select.modes.map((m) => m.props.map((p) => p.name).sort())).toEqual([
      ['allowClear', 'defaultValue', 'multiple', 'onChange', 'value'],
      ['allowClear', 'defaultValue', 'multiple', 'onChange', 'value'],
      ['allowClear', 'defaultValue', 'multiple', 'onChange', 'value'],
    ])
    const multiple = select.modes.find((m) =>
      m.props.some((p) => p.name === 'multiple' && p.type === 'true'),
    )
    expect(multiple?.props.find((p) => p.name === 'onChange')?.type).toBe('(value: V[]) => void')
    expect(select.props.map((p) => p.name)).not.toContain('multiple')
    expect(select.props.map((p) => p.name)).toContain('options')
    // 这几个组件的属性都是联合类型；任何组件的各个用法都要有标题与不同的属性
    for (const name of ['Select', 'TreeSelect', 'Cascader', 'InputNumber', 'Slider'])
      expect(byName(name).modes.length, name).toBeGreaterThan(1)
    for (const c of components)
      for (const m of [c, ...c.members].flatMap((x) => x.modes)) {
        expect(m.title.en, c.name).not.toBe('')
        expect(m.props.length, `${c.name}: ${m.title.en}`).toBeGreaterThan(0)
      }
  })

  it('静态成员（子组件与函数）有说明，子组件有属性表', () => {
    const form = byName('Form')
    const item = form.members.find((m) => m.name === 'Form.Item')
    expect(item?.signature).toBeNull()
    expect(item?.props.map((p) => p.name)).toEqual(
      expect.arrayContaining(['name', 'label', 'rules']),
    )
    expect(form.members.find((m) => m.name === 'Form.useForm')?.signature).toMatch(
      /^Form\.useForm<.*>\(\): \[FormInstance<V>\]$/,
    )
    expect(byName('Input').members.map((m) => m.name)).toEqual([
      'Input.Password',
      'Input.Search',
      'Input.TextArea',
    ])
    expect(byName('Button').members).toEqual([])
  })

  it('属性、成员与 hook 签名引用的本库类型写在组件页中，并递归包含字段引用的类型', () => {
    expect(byName('Select').types.map((t) => t.name)).toEqual(
      expect.arrayContaining(['SelectOption<V>', 'SelectOptionGroup<V>', 'SelectRef']),
    )
    expect(byName('Form').types.map((t) => t.name)).toEqual(
      expect.arrayContaining(['FormInstance<V>', 'FormRule']),
    )
    const message = byName('useMessage')
    expect(message.signature).toBe('useMessage(): MessageApi')
    expect(message.types.map((t) => t.name)).toContain('MessageApi')
    // 类型名不重复，属性表本身的接口不单列
    for (const c of components) {
      const names = c.types.map((t) => t.name.replace(/<.*/, ''))
      expect(new Set(names).size, c.name).toBe(names.length)
      expect(names, c.name).not.toContain(`${c.name}Props`)
    }
    const icon = byName('Icon').types.find((t) => t.name === 'IconName')
    expect(icon?.values.length).toBeGreaterThan(10)
  })

  it('组件以外的导出都在 API 参考中，组件（如 ThemeProvider）有属性表', () => {
    const pages = [...files.keys()].filter((f) => f.startsWith('docs/en-US/api/'))
    expect(pages.length).toBeGreaterThan(0)
    for (const f of pages)
      expect(
        API_GROUPS.map((g) => `docs/en-US/api/${g.slug}.md`),
        f,
      ).toContain(f)
    const theme = files.get('docs/en-US/api/theme.md') ?? ''
    expect(theme).toContain('## ThemeProvider')
    expect(theme).toMatch(/\| `colorMode` \|/)
  })

  it('每个示例与页面配方的代码都能单独通过类型检查（可以直接复制）', () => {
    const snippets = new Map<string, string>()
    for (const c of components)
      for (const e of c.examples)
        snippets.set(path.join(pkgRoot, 'examples', `.copy.${c.name}.${e.name}.tsx`), e.code)
    for (const [rel, content] of files) {
      if (!rel.startsWith('docs/en-US/recipes/')) continue
      const code = content.match(/```tsx\n([\s\S]*?)\n```/)?.[1]
      expect(code, rel).toBeDefined()
      snippets.set(
        path.join(pkgRoot, 'examples', 'recipes', `.copy.${path.basename(rel, '.md')}.tsx`),
        code ?? '',
      )
    }
    const options: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.ReactJSX,
      allowImportingTsExtensions: true,
      noEmit: true,
      strict: true,
      skipLibCheck: true,
      lib: ['lib.es2023.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
    }
    const host = ts.createCompilerHost(options)
    const readFile = host.readFile.bind(host)
    const fileExists = host.fileExists.bind(host)
    const getSourceFile = host.getSourceFile.bind(host)
    host.readFile = (f) => snippets.get(path.resolve(f)) ?? readFile(f)
    host.fileExists = (f) => snippets.has(path.resolve(f)) || fileExists(f)
    host.getSourceFile = (f, lang, onError, create) => {
      const text = snippets.get(path.resolve(f))
      return text === undefined
        ? getSourceFile(f, lang, onError, create)
        : ts.createSourceFile(f, text, lang, true, ts.ScriptKind.TSX)
    }
    const prog = ts.createProgram({
      rootNames: [...snippets.keys(), path.join(pkgRoot, 'src/css.d.ts')],
      options,
      host,
    })
    const errors = [...snippets.keys()].flatMap((f) =>
      prog
        .getSemanticDiagnostics(prog.getSourceFile(f))
        .concat(prog.getSyntacticDiagnostics(prog.getSourceFile(f)))
        .map((d) => `${path.basename(f)}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`),
    )
    expect(errors).toEqual([])
  }, 120_000)

  it('文档中的相对链接都指向存在的文件（生成的页面、手写的指南、包内文件）', () => {
    const exists = (abs: string) => {
      const r = path.relative(pkgRoot, abs).split(path.sep).join('/')
      return files.has(r) || existsSync(abs)
    }
    const guideFiles = LANGUAGES.flatMap(({ dir }) => {
      const abs = path.join(pkgRoot, 'docs', dir, 'guides')
      return existsSync(abs)
        ? readdirSync(abs).map(
            (f) => [`docs/${dir}/guides/${f}`, readFileSync(path.join(abs, f), 'utf8')] as const,
          )
        : []
    })
    const meta = ['README.md', 'README.zh-CN.md', 'MIGRATION.md', 'CONTRIBUTING.md'].map(
      (f) => [f, readFileSync(path.join(pkgRoot, f), 'utf8')] as const,
    )
    const broken: string[] = []
    for (const [rel, content] of [...files, ...guideFiles, ...meta]) {
      if (!rel.endsWith('.md') && rel !== LLMS_TXT) continue
      // 代码块中的内容不是链接
      const prose = content.replace(/```[\s\S]*?```/g, '')
      for (const m of prose.matchAll(/\]\(([^)\s]+)\)/g)) {
        const target = (m[1] ?? '').split('#')[0] ?? ''
        if (!target || /^[a-z]+:/.test(target)) continue
        if (!exists(path.resolve(pkgRoot, path.dirname(rel), target)))
          broken.push(`${rel} → ${m[1]}`)
      }
    }
    expect(broken).toEqual([])
  })

  it('llms.txt 是给智能体的入口：列出全部组件、API 参考与令牌清单，链接是相对包根目录的路径', () => {
    const llms = files.get(LLMS_TXT) ?? ''
    expect(llms.startsWith('# vellum-ui\n\n> ')).toBe(true)
    for (const c of components)
      expect(llms, c.name).toContain(`](docs/en-US/components/${c.name}.md)`)
    expect(llms).toContain('](docs/en-US/tokens.md)')
    expect(llms).toContain('](docs/en-US/guides/conventions.md)')
  })

  it('令牌清单列出主题编译出的全部令牌', () => {
    const { sections, unmatched } = tokenRows()
    expect(unmatched).toEqual([])
    const page = files.get('docs/en-US/tokens.md') ?? ''
    for (const { rows } of sections)
      for (const r of rows) expect(page, r.name).toContain(`| \`${r.name}\` |`)
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
