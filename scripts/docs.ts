/**
 * 组件文档生成：一份来源，两种语言，全部输出在本包内。
 * - 来源：组件函数的 TSDoc（英文正文与 `@zh`、`@category`、`@usage` 与 `@usageZh`）、Props 接口的 TSDoc
 *   （英文正文与 `@zh`、`@default`），以及 `examples/<组件>.examples.tsx` 中导出的示例函数（英文正文与 `@zh`
 *   各自第一行为标题、其余为说明，`@section` 指定章节）。写法见 CONTRIBUTING.md。
 * - 产物：
 *   - `docs/README.md` 选择语言的入口；
 *   - `docs/en-US/`、`docs/zh-CN/` 两套结构相同的文档：`README.md` 总览与 `components/<组件>.md`，页首互相链接；
 *   - `stories/generated/<组件>.stories.tsx`：故事名用英文标题，说明由 .storybook/preview.tsx 按工具栏的语言
 *     从 components.json 读取；
 *   - 机器可读的文档数据 `docs/components.json`（ComponentDocsJson，类型见 src/docs.ts；经包导出
 *     `vellum-ui/docs/components.json`，供使用方在自己的文档站或应用内浏览组件）。
 *
 * TS 7 没有 JS 编译器 API，这里用 `@typescript/typescript6` 只做读取（开发依赖，不进产品代码）。
 */
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import ts from '@typescript/typescript6'
import type {
  ComponentDoc,
  ComponentExampleDoc,
  ComponentPropDoc,
  DocLanguage,
  DocText,
} from '../src/docs.ts'

export type { ComponentDoc, ComponentExampleDoc, ComponentPropDoc, DocLanguage, DocText }

/** 本包根目录；生成文件的键都是相对它的 posix 路径。 */
export const pkgRoot = path.resolve(import.meta.dirname, '..')
const examplesDir = path.join(pkgRoot, 'examples')

/** 文档的语言与输出目录。 */
export const LANGUAGES: readonly { lang: DocLanguage; dir: string; label: string }[] = [
  { lang: 'en', dir: 'en-US', label: 'English' },
  { lang: 'zh', dir: 'zh-CN', label: '简体中文' },
]

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

/** CJK 文字与全角标点：英文正文中不得出现。 */
export const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}　-〿＀-￯]/u
/** 汉字：`@zh` 中必须有。 */
export const HAN = /\p{Script=Han}/u

export interface GenerateResult {
  /** 本包根目录相对路径 → 文件内容。 */
  files: Map<string, string>
  components: ComponentDoc[]
  /** 文档不完整之处（缺说明、缺某种语言、缺示例等），测试据此失败。 */
  problems: string[]
}

/**
 * TSDoc 中的软换行：两侧都是 CJK 字符时直接相连，其余保持原样。中文在两个汉字之间换行时，换行不能变成空格
 * （否则文档里出现「步骤 为已完成」）；英文单词之间、代码与汉字之间的换行仍按空格处理，段落与列表不受影响。
 */
const CJK_SOFT_BREAK = new RegExp(`(?<=${CJK.source})[ \\t]*\\n[ \\t]*(?=${CJK.source})`, 'gu')
export const joinCjkLines = (s: string) => s.replace(CJK_SOFT_BREAK, '')

const text = (parts: ts.SymbolDisplayPart[] | undefined) => ts.displayPartsToString(parts).trim()
/** 标签的原文（保留换行）：示例的 `@zh` 第一行是标题，要先分出标题再连接其余的行。 */
const rawTagText = (tags: ts.JSDocTagInfo[], name: string) => {
  const t = tags.find((x) => x.name === name)
  return t ? text(t.text) : null
}
const tagText = (tags: ts.JSDocTagInfo[], name: string) => {
  const t = rawTagText(tags, name)
  return t === null ? null : joinCjkLines(t)
}
const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n+/g, ' ')
/** 第一行为标题，其余为说明。 */
const titleAndRest = (s: string) => {
  const [title = '', ...rest] = s.split('\n')
  return { title: title.trim(), description: joinCjkLines(rest.join('\n').trim()) }
}

function program(): ts.Program {
  const examples = existsSync(examplesDir)
    ? readdirSync(examplesDir)
        .filter((f) => f.endsWith('.examples.tsx'))
        .map((f) => path.join(examplesDir, f))
    : []
  return ts.createProgram({
    rootNames: [
      path.join(pkgRoot, 'src/index.ts'),
      path.join(pkgRoot, 'src/css.d.ts'),
      ...examples,
    ],
    options: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.ReactJSX,
      allowImportingTsExtensions: true,
      noEmit: true,
      strict: true,
      skipLibCheck: true,
      lib: ['lib.es2023.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
    },
  })
}

/** 本包内由字面量组成的类型别名（如 SpaceStep、Align）展开为取值，读者不必再去查定义。 */
function expandAlias(checker: ts.TypeChecker, node: ts.TypeNode): string {
  const raw = node.getText().replace(/\s+/g, ' ')
  if (!ts.isTypeReferenceNode(node)) return raw
  let sym = checker.getSymbolAtLocation(node.typeName)
  if (sym && sym.flags & ts.SymbolFlags.Alias) sym = checker.getAliasedSymbol(sym)
  const decl = sym?.declarations?.[0]
  if (
    !decl ||
    !ts.isTypeAliasDeclaration(decl) ||
    decl.getSourceFile().fileName.includes('node_modules')
  )
    return raw
  const t = decl.type
  const literal = (n: ts.TypeNode) => ts.isLiteralTypeNode(n)
  if (ts.isUnionTypeNode(t) && t.types.every(literal)) return t.getText().replace(/\s+/g, ' ')
  return raw
}

const fromAntd = (node: ts.Node) =>
  node.getSourceFile().fileName.replace(/\\/g, '/').includes('/antd/')

/**
 * 封装组件的属性接口继承的 antd 接口名：`interface InputProps extends Omit<AntInputProps, …>` → `InputProps`。
 * 只看继承子句中直接引用的类型（含 Omit / Pick 的第一个类型参数）。
 */
function antdBaseOf(checker: ts.TypeChecker, propsSym: ts.Symbol): string | null {
  for (const d of propsSym.declarations ?? []) {
    if (!ts.isInterfaceDeclaration(d)) continue
    for (const clause of d.heritageClauses ?? []) {
      for (const h of clause.types) {
        const candidates: ts.Node[] = [h.expression, ...(h.typeArguments ?? [])]
        for (const c of candidates) {
          const target = ts.isTypeReferenceNode(c) ? c.typeName : c
          let sym = checker.getSymbolAtLocation(target)
          if (sym && sym.flags & ts.SymbolFlags.Alias) sym = checker.getAliasedSymbol(sym)
          const sd = sym?.declarations?.[0]
          if (sym && sd && fromAntd(sd)) return sym.name
        }
      }
    }
  }
  return null
}

/** hook：名字以 use 开头（useMessage、useHotkeys）。它的属性表是选项表，标题为「选项」。 */
const isHook = (name: string) => /^use[A-Z]/.test(name)
const optionsName = (name: string) => `U${name.slice(1)}Options`

function propsOf(
  checker: ts.TypeChecker,
  exports: Map<string, ts.Symbol>,
  name: string,
  decl: ts.Declaration,
): { props: ComponentPropDoc[]; base: boolean; native: string | null; antd: string | null } {
  // 优先使用导出的 `<组件>Props` 接口；hook 用 `Use<名称>Options`（如 useHotkeys → UseHotkeysOptions）；
  // 都没有时取函数第一个参数的类型
  const propsSym =
    exports.get(`${name}Props`) ?? (isHook(name) ? exports.get(optionsName(name)) : undefined)
  let type: ts.Type | undefined
  if (propsSym) type = checker.getDeclaredTypeOfSymbol(propsSym)
  else if (ts.isFunctionDeclaration(decl) && decl.parameters[0])
    type = checker.getTypeAtLocation(decl.parameters[0])
  if (!type) return { props: [], base: false, native: null, antd: null }
  let base = false
  // 继承来的属性所在的接口（按遇到的顺序）。属性的顺序取决于 TypeScript 内部创建类型的先后（程序中多引用一个
  // 依赖的类型就可能改变），所以不取第一个，而取其中最具体的接口（不是其他接口的基接口），结果才稳定
  const nativeOwners: ts.InterfaceDeclaration[] = []
  const antdOwners: ts.InterfaceDeclaration[] = []
  const antdBase = propsSym ? antdBaseOf(checker, propsSym) : null
  const props: ComponentPropDoc[] = []
  for (const p of checker.getPropertiesOfType(type)) {
    const d = p.valueDeclaration ?? p.declarations?.[0]
    const owner = d?.parent
    if (owner && ts.isInterfaceDeclaration(owner) && owner.name.text === 'BaseProps') {
      base = true
      continue
    }
    // 来自依赖的属性（原生 HTML 属性、封装的 antd 组件的属性）不逐个列出
    if (d?.getSourceFile().fileName.includes('node_modules')) {
      if (owner && ts.isInterfaceDeclaration(owner)) {
        if (!nativeOwners.includes(owner)) nativeOwners.push(owner)
        if (fromAntd(owner) && !antdOwners.includes(owner)) antdOwners.push(owner)
      }
      continue
    }
    // 组件的公开属性不含 className / style，个别组件内部保留的这两个属性不写进文档
    if (p.name === 'className' || p.name === 'style') continue
    const typeNode = d && ts.isPropertySignature(d) ? d.type : undefined
    const tags = p.getJsDocTags(checker)
    props.push({
      name: p.name,
      type: typeNode
        ? expandAlias(checker, typeNode)
        : checker.typeToString(checker.getTypeOfSymbol(p)),
      description: { en: text(p.getDocumentationComment(checker)), zh: tagText(tags, 'zh') ?? '' },
      default: tagText(tags, 'default'),
      required: (p.flags & ts.SymbolFlags.Optional) === 0,
    })
  }
  const native = mostSpecific(checker, nativeOwners)
  const antd = antdBase ?? mostSpecific(checker, antdOwners)
  return { props, base, native, antd }
}

/** 一组接口中最具体的一个：不是组中其他接口（直接或间接）的基接口；有几个时取先遇到的。 */
function mostSpecific(checker: ts.TypeChecker, owners: readonly ts.InterfaceDeclaration[]) {
  const basesOf = (owner: ts.InterfaceDeclaration): Set<string> => {
    const out = new Set<string>()
    const visit = (t: ts.Type) => {
      if (!t.isClassOrInterface()) return
      for (const b of checker.getBaseTypes(t)) {
        const n = b.getSymbol()?.getName()
        if (n && !out.has(n)) {
          out.add(n)
          visit(b)
        }
      }
    }
    const sym = checker.getSymbolAtLocation(owner.name)
    if (sym) visit(checker.getDeclaredTypeOfSymbol(sym))
    return out
  }
  const bases = owners.map(basesOf)
  const found = owners.find((o) => !bases.some((b) => b.has(o.name.text)))
  return (found ?? owners[0])?.name.text ?? null
}

function examplesOf(
  prog: ts.Program,
  checker: ts.TypeChecker,
  name: string,
  problems: string[],
): ComponentExampleDoc[] {
  const sf = prog.getSourceFile(path.join(examplesDir, `${name}.examples.tsx`))
  if (!sf) return []
  const out: ComponentExampleDoc[] = []
  for (const st of sf.statements) {
    if (!ts.isFunctionDeclaration(st) || !st.name) continue
    if (!st.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue
    const sym = checker.getSymbolAtLocation(st.name)
    const tags = sym?.getJsDocTags(checker) ?? []
    const en = titleAndRest(sym ? text(sym.getDocumentationComment(checker)) : '')
    const zh = titleAndRest(rawTagText(tags, 'zh') ?? '')
    const sectionTag = tagText(tags, 'section')
    const section = SECTIONS.find((s) => s.en === (sectionTag ?? SECTIONS[0]?.en))
    if (!section)
      problems.push(
        `${name}.${st.name.text}: @section「${sectionTag}」不在 ${SECTIONS.map((s) => s.en).join(', ')} 中`,
      )
    out.push({
      name: st.name.text,
      title: { en: en.title, zh: zh.title },
      description: { en: en.description, zh: zh.description },
      section: section ?? (SECTIONS[0] as DocText),
      code: st.getText(sf),
    })
  }
  // 按章节排序（稳定排序，同一章节内保持文件中的顺序），文档页与 JSON 的顺序一致
  const order = (e: ComponentExampleDoc) => SECTIONS.findIndex((s) => s.en === e.section.en)
  return out.sort((a, b) => order(a) - order(b))
}

/**
 * 一段双语文字的问题：英文与中文都不能为空（`optional` 时可以同时为空），英文中不得有 CJK 文字与全角标点，
 * 中文中必须有汉字。
 */
function textProblems(where: string, t: DocText, optional = false): string[] {
  const out: string[] = []
  if (optional && !t.en && !t.zh) return out
  if (!t.en) out.push(`${where}: 缺少英文`)
  else if (CJK.test(t.en)) out.push(`${where}: 英文正文中有中文或全角标点`)
  if (!t.zh) out.push(`${where}: 缺少 @zh 中文`)
  else if (!HAN.test(t.zh)) out.push(`${where}: @zh 中没有中文`)
  return out
}

/** 不推荐使用的导出：替代说明在 `@deprecated`（英文）与 `@deprecatedZh`（中文）中。 */
export interface DeprecatedDoc {
  name: string
  note: DocText
}

/** 读取全部带 @category 的导出组件。 */
export function collect(): {
  components: ComponentDoc[]
  deprecated: DeprecatedDoc[]
  problems: string[]
} {
  const prog = program()
  const checker = prog.getTypeChecker()
  const index = prog.getSourceFile(path.join(pkgRoot, 'src/index.ts'))
  if (!index) throw new Error('找不到 src/index.ts')
  const moduleSym = checker.getSymbolAtLocation(index)
  if (!moduleSym) throw new Error('无法解析 src/index.ts 的导出')
  const exports = new Map<string, ts.Symbol>()
  for (const s of checker.getExportsOfModule(moduleSym)) {
    exports.set(s.name, s.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(s) : s)
  }
  const components: ComponentDoc[] = []
  const deprecated: DeprecatedDoc[] = []
  const problems: string[] = []
  for (const [name, sym] of exports) {
    const decl = sym.valueDeclaration ?? sym.declarations?.[0]
    if (!decl) continue
    // antd 只作为内部实现：入口不得原样转出 antd 的组件或类型
    if (fromAntd(decl)) {
      problems.push(`${name}: 原样转出了 antd 的导出，请封装为自有组件或声明自有类型`)
      continue
    }
    const tags = sym.getJsDocTags(checker)
    const dep = tagText(tags, 'deprecated')
    if (dep !== null) {
      const note = { en: dep, zh: tagText(tags, 'deprecatedZh') ?? '' }
      problems.push(...textProblems(`${name} @deprecated`, note))
      deprecated.push({ name, note })
      continue
    }
    const categoryTag = tagText(tags, 'category')
    if (!categoryTag) continue
    const category = CATEGORIES.find((c) => c.en === categoryTag)
    if (!category)
      problems.push(
        `${name}: @category「${categoryTag}」不在 ${CATEGORIES.map((c) => c.en).join(', ')} 中`,
      )
    const { props, base, native, antd } = propsOf(checker, exports, name, decl)
    const c: ComponentDoc = {
      name,
      category: category ?? { en: categoryTag, zh: categoryTag },
      summary: { en: text(sym.getDocumentationComment(checker)), zh: tagText(tags, 'zh') ?? '' },
      usage: { en: tagText(tags, 'usage') ?? '', zh: tagText(tags, 'usageZh') ?? '' },
      props,
      base,
      native,
      antd,
      examples: examplesOf(prog, checker, name, problems),
    }
    problems.push(...textProblems(`${name} 组件说明`, c.summary))
    problems.push(...textProblems(`${name} @usage / @usageZh（常见用途）`, c.usage))
    for (const p of props)
      problems.push(...textProblems(`${name}.${p.name} 属性说明`, p.description))
    for (const e of c.examples) {
      problems.push(...textProblems(`${name} 示例 ${e.name} 的标题`, e.title))
      problems.push(...textProblems(`${name} 示例 ${e.name} 的说明`, e.description, true))
    }
    if (!c.examples.length) problems.push(`${name}: 缺少示例文件 examples/${name}.examples.tsx`)
    else if (!c.examples.some((e) => e.section.en === SECTIONS[0]?.en))
      problems.push(`${name}: 示例中没有「${SECTIONS[0]?.en}」`)
    components.push(c)
  }
  const categoryOrder = (c: ComponentDoc) => CATEGORIES.findIndex((x) => x.en === c.category.en)
  components.sort((a, b) => categoryOrder(a) - categoryOrder(b) || a.name.localeCompare(b.name))
  return { components, deprecated, problems }
}

const HEADER =
  '<!-- Generated by scripts/docs.ts, do not edit. Change the TSDoc or the examples, then run pnpm docs:gen. -->'

/** 页面中的固定文字。 */
const UI = {
  en: {
    overviewTitle: 'Components',
    overviewIntro:
      'Find a component in the tables below, then open its page for examples and props. Installation, `ThemeProvider` and theming are described in the [README](../../README.md).',
    component: 'Component',
    description: 'Description',
    usage: 'Common uses',
    category: 'Category',
    meta: (c: ComponentDoc) => `**Category**: ${c.category.en} · **Common uses**: ${c.usage.en}`,
    import: 'Import',
    props: 'Props',
    propsHead: '| Prop | Type | Description | Default | Required |',
    options: 'Options',
    optionsHead: '| Option | Type | Description | Default | Required |',
    yes: 'Yes',
    no: 'No',
    noOwnProps: 'No props of its own.',
    noProps: 'No props.',
    base: 'Also accepts `testId` (rendered as `data-testid`), `aria-label`, `role` and `id`, like all primitives.',
    antd: (n: string) =>
      `Also accepts the props of the corresponding Ant Design component (\`${n}\`), except \`style\` and \`className\`.`,
    native: (n: string) =>
      `Also accepts the attributes of the native element (\`${n}\`), such as \`disabled\` and \`onClick\`.`,
    noStyle:
      'Does not accept `style` or `className`: appearance is adjusted only through the semantic props above and the theme.',
    antdTitle: 'Relationship with Ant Design',
    antdText: [
      'Ant Design is only used internally: forms, inputs, overlays and similar components are wrapped by vellum-ui and exported with the names and props of antd (without `style` and `className`), and their appearance comes from the theme. Applications do not need to, and should not, import antd directly.',
      "Concepts of antd that duplicate the components of this library are merged under one name: `Tag` → Pill, `Badge` → CountBadge / StatusDot, `Card` → Panel, `Space` → Stack / Inline, `Empty` → EmptyState, `Spin` → Loading; `Avatar` is the library's own letter avatar. `Layout`, `Menu` and `Result` are not exported.",
      'The library only provides general-purpose components: business terms do not appear in their names or props. Build components for business data in your application from these components.',
      'Machine-readable documentation data in both languages (generated from the same source): [`components.json`](../components.json), imported as `vellum-ui/docs/components.json`.',
    ],
    deprecatedTitle: 'Deprecated',
    deprecatedText: 'Still importable, but use the replacement in new code.',
    deprecatedHead: '| Component | Replacement |',
  },
  zh: {
    overviewTitle: '组件总览',
    overviewIntro:
      '先按需求在下表找组件，再看对应页面的示例与属性表。安装、`ThemeProvider` 与主题定制见 [README](../../README.zh-CN.md)。',
    component: '组件',
    description: '描述',
    usage: '常见用途',
    category: '分类',
    meta: (c: ComponentDoc) => `**分类**：${c.category.zh}　**常见用途**：${c.usage.zh}`,
    import: '引入',
    props: '属性',
    propsHead: '| 属性 | 类型 | 说明 | 默认值 | 必填 |',
    options: '选项',
    optionsHead: '| 选项 | 类型 | 说明 | 默认值 | 必填 |',
    yes: '是',
    no: '否',
    noOwnProps: '没有自有属性。',
    noProps: '没有属性。',
    base: '另外支持所有原语共有的 `testId`（输出为 `data-testid`）、`aria-label`、`role`、`id`。',
    antd: (n: string) => `另外支持 Ant Design 对应组件（\`${n}\`）的属性，不含 style、className。`,
    native: (n: string) => `另外支持原生元素的属性（\`${n}\`），如 \`disabled\`、\`onClick\`。`,
    noStyle: '不接受 `style` 与 `className`：外观只能通过上面的语义参数与主题调整。',
    antdTitle: '与 Ant Design 的关系',
    antdText: [
      'Ant Design 只作为内部实现：表单、输入、弹层等组件由 vellum-ui 封装后导出，沿用 antd 的名称与属性（不含 `style`、`className`），外观由主题统一。使用方不需要、也不应该直接导入 antd。',
      'antd 中与自研组件重复的概念已合并，只保留一个名字：`Tag` → Pill，`Badge` → CountBadge / StatusDot，`Card` → Panel，`Space` → Stack / Inline，`Empty` → EmptyState，`Spin` → Loading；`Avatar` 是自研的字母头像。`Layout`、`Menu`、`Result` 不导出。',
      '本库只提供通用组件，名字和属性中不出现业务名词；需要业务数据的场景组件请在应用中用这些组件拼装。',
      '机器可读的文档数据（两种语言，与本目录同源）：[`components.json`](../components.json)，经包导出 `vellum-ui/docs/components.json` 引入。',
    ],
    deprecatedTitle: '不推荐使用',
    deprecatedText: '仍可导入，但新代码请改用替代组件。',
    deprecatedHead: '| 组件 | 替代 |',
  },
} as const

/** 页首的语言切换：当前语言加粗，另一种语言链接到同一页。`up` 是本页到 docs/ 的相对路径前缀。 */
function switcher(lang: DocLanguage, up: string, page: string): string {
  return LANGUAGES.map((l) =>
    l.lang === lang ? `**${l.label}**` : `[${l.label}](${up}${l.dir}/${page})`,
  ).join(' | ')
}

function componentPage(c: ComponentDoc, lang: DocLanguage): string {
  const ui = UI[lang]
  const lines = [
    HEADER,
    '',
    switcher(lang, '../../', `components/${c.name}.md`),
    '',
    `# ${c.name}`,
    '',
    c.summary[lang],
    '',
    ui.meta(c),
    '',
  ]
  lines.push(`## ${ui.import}`, '', '```ts', `import { ${c.name} } from 'vellum-ui'`, '```', '')
  for (const section of SECTIONS) {
    const list = c.examples.filter((e) => e.section.en === section.en)
    if (!list.length) continue
    lines.push(`## ${section[lang]}`, '')
    for (const e of list) {
      if (list.length > 1 || e.title[lang] !== section[lang]) lines.push(`### ${e.title[lang]}`, '')
      if (e.description[lang]) lines.push(e.description[lang], '')
      lines.push('```tsx', e.code, '```', '')
    }
  }
  // hook 的属性表来自它的选项接口
  const options = isHook(c.name) && c.props.length > 0
  lines.push(`## ${options ? ui.options : ui.props}`, '')
  if (c.props.length) {
    lines.push(options ? ui.optionsHead : ui.propsHead, '| --- | --- | --- | --- | --- |')
    for (const p of c.props)
      lines.push(
        `| \`${p.name}\` | \`${cell(p.type)}\` | ${cell(p.description[lang])} | ${p.default ? `\`${cell(p.default)}\`` : '—'} | ${p.required ? ui.yes : ui.no} |`,
      )
    lines.push('')
  } else lines.push(c.antd || c.native ? ui.noOwnProps : ui.noProps, '')
  if (c.base) lines.push(ui.base, '')
  if (c.antd) lines.push(ui.antd(c.antd), '')
  else if (c.native) lines.push(ui.native(c.native), '')
  // hook 没有外观，「不接受 style / className」对它没有意义
  if (!isHook(c.name)) lines.push(ui.noStyle, '')
  return lines.join('\n')
}

/** 总览表格中的描述只取第一句。 */
function firstSentence(s: string, lang: DocLanguage): string {
  const re = lang === 'zh' ? /(?<=。)/ : /(?<=[.!?])\s+(?=[A-Z`*])/
  return (s.split(re)[0] ?? s).replace(/\n/g, ' ').trim()
}

function overview(
  components: ComponentDoc[],
  deprecated: DeprecatedDoc[],
  lang: DocLanguage,
): string {
  const ui = UI[lang]
  const lines = [
    HEADER,
    '',
    switcher(lang, '../', 'README.md'),
    '',
    `# ${ui.overviewTitle}`,
    '',
    ui.overviewIntro,
    '',
  ]
  for (const cat of CATEGORIES) {
    const list = components.filter((c) => c.category.en === cat.en)
    if (!list.length) continue
    lines.push(
      `## ${cat[lang]}`,
      '',
      `| ${ui.component} | ${ui.description} | ${ui.usage} |`,
      '| --- | --- | --- |',
    )
    for (const c of list)
      lines.push(
        `| [${c.name}](components/${c.name}.md) | ${cell(firstSentence(c.summary[lang], lang))} | ${cell(c.usage[lang])} |`,
      )
    lines.push('')
  }
  lines.push(`## ${ui.antdTitle}`, '')
  for (const p of ui.antdText) lines.push(p, '')
  if (deprecated.length) {
    lines.push(
      `## ${ui.deprecatedTitle}`,
      '',
      ui.deprecatedText,
      '',
      ui.deprecatedHead,
      '| --- | --- |',
    )
    for (const d of deprecated) lines.push(`| \`${d.name}\` | ${cell(d.note[lang])} |`)
    lines.push('')
  }
  return lines.join('\n')
}

/** 文档入口：选择语言。 */
function entry(count: number): string {
  return [
    HEADER,
    '',
    '# vellum-ui',
    '',
    'Component documentation · 组件文档',
    '',
    ...LANGUAGES.map((l) => `- [${l.label}](${l.dir}/README.md)`),
    '',
    `${count} components, generated from the TSDoc and the examples of the library. Machine-readable data in both languages: [\`components.json\`](components.json) (\`vellum-ui/docs/components.json\`).`,
    '',
    `共 ${count} 个组件，由组件库的 TSDoc 与示例生成。两种语言的机器可读数据：[\`components.json\`](components.json)（\`vellum-ui/docs/components.json\`）。`,
    '',
  ].join('\n')
}

/**
 * 生成文件中的字符串字面量，与 Biome 的格式化结果一致：默认单引号，内容中的单引号多于双引号时用双引号。
 */
function literal(s: string): string {
  const singles = (s.match(/'/g) ?? []).length
  const doubles = (s.match(/"/g) ?? []).length
  const q = singles > doubles ? '"' : "'"
  const body = s.replace(/\\/g, '\\\\').replace(new RegExp(q, 'g'), `\\${q}`)
  return `${q}${body}${q}`
}

function story(c: ComponentDoc): string {
  const lines = [
    '// Generated by scripts/docs.ts, do not edit',
    "import type { Meta, StoryObj } from '@storybook/react-vite'",
    `import * as ex from '../../examples/${c.name}.examples.tsx'`,
    '',
    // 示例的标题与说明由 .storybook/preview.tsx 按工具栏的语言从 components.json 读取，这里只记组件名与示例名
    // （Storybook 深合并 meta 与故事的 parameters）
    'const meta = {',
    `  title: '${c.category.en}/${c.name}',`,
    `  parameters: { example: { component: '${c.name}' } },`,
    '} satisfies Meta',
    'export default meta',
    '',
  ]
  for (const e of c.examples)
    lines.push(
      `export const ${e.name}: StoryObj = {`,
      `  name: ${literal(e.title.en)},`,
      `  parameters: { example: { name: '${e.name}' } },`,
      `  render: () => <ex.${e.name} />,`,
      '}',
    )
  return `${lines.join('\n')}\n`
}

/** 机器可读的文档数据：ComponentDocsJson（包导出 `vellum-ui/docs/components.json`）。 */
export const COMPONENTS_JSON = 'docs/components.json'

/** 生成全部产物（不写盘）。 */
export function generate(): GenerateResult {
  const { components, deprecated, problems } = collect()
  const files = new Map<string, string>()
  files.set('docs/README.md', entry(components.length))
  for (const { lang, dir } of LANGUAGES) {
    files.set(`docs/${dir}/README.md`, overview(components, deprecated, lang))
    for (const c of components)
      files.set(`docs/${dir}/components/${c.name}.md`, componentPage(c, lang))
  }
  for (const c of components)
    if (c.examples.length) files.set(`stories/generated/${c.name}.stories.tsx`, story(c))
  files.set(COMPONENTS_JSON, `${JSON.stringify(components, null, 2)}\n`)
  return { files, components, problems }
}

/** 生成目录：这些目录下不在产物清单中的文件视为过时。 */
export const GENERATED_DIRS = [
  ...LANGUAGES.map((l) => `docs/${l.dir}/components`),
  'stories/generated',
]
