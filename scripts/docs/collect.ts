/**
 * 从三个入口读取全部文档：带 `@category` 的组件与 hook（含示例），带 `@group` 的其他导出（API 参考），以及不推荐
 * 使用的导出。来源（根目录或内存中的文件）由调用方给出。
 */
import path from 'node:path'
import ts from '@typescript/typescript6'
import { API_GROUPS, CATEGORIES, SECTIONS, textProblems } from './bilingual.ts'
import { selfContained } from './inline.ts'
import {
  type ApiEntryDoc,
  type ApiGroupDoc,
  CORE_ENTRY,
  type ComponentDoc,
  type ComponentExampleDoc,
  type DeprecatedDoc,
  type DocEntry,
  type DocText,
  ENTRIES,
  isHook,
} from './model.ts'
import {
  type DocsSource,
  docsProgram,
  EXAMPLE_SUFFIX,
  EXAMPLES_DIR,
  sourcePath,
} from './program.ts'
import { membersOf, propsOf, propsOfType, typesOf } from './props.ts'
import {
  docOf,
  fromAntd,
  moduleDoc,
  optionsName,
  rawTagText,
  signatureNodes,
  signatureText,
  tagText,
  text,
  titleAndRest,
  valueSignature,
} from './tsdoc.ts'

function examplesOf(
  source: DocsSource,
  prog: ts.Program,
  checker: ts.TypeChecker,
  name: string,
  problems: string[],
): ComponentExampleDoc[] {
  const sf = prog.getSourceFile(
    path.join(sourcePath(source, EXAMPLES_DIR), `${name}${EXAMPLE_SUFFIX}`),
  )
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
      code: selfContained(checker, sf, st),
    })
  }
  // 按章节排序（稳定排序，同一章节内保持文件中的顺序），文档页与 JSON 的顺序一致
  const order = (e: ComponentExampleDoc) => SECTIONS.findIndex((s) => s.en === e.section.en)
  return out.sort((a, b) => order(a) - order(b))
}

/**
 * 模块路径的顺序，与 Biome 排列导入、导出语句的顺序相同：逐个字符比较，先不分大小写，同一个字母大写在前
 * （`AppShell.tsx` < `ai/` < `basic.tsx` < `CodeBlock.tsx` < `charts/`）。
 */
function compareModulePaths(a: string, b: string): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const x = a[i] as string
    const y = b[i] as string
    if (x === y) continue
    const lx = x.toLowerCase()
    const ly = y.toLowerCase()
    if (lx !== ly) return lx < ly ? -1 : 1
    return x === lx ? 1 : -1
  }
  return a.length - b.length
}

/** collect 的结果：文档与读取它们的程序（配方也从同一个程序中读取，只解析一次）。 */
export interface Collected {
  components: ComponentDoc[]
  api: ApiGroupDoc[]
  deprecated: DeprecatedDoc[]
  problems: string[]
  program: ts.Program
  checker: ts.TypeChecker
}

/** 读取全部带 @category 的导出组件，以及带 @group 的其他导出（API 参考）。 */
export function collect(source: DocsSource): Collected {
  const prog = docsProgram(source)
  const checker = prog.getTypeChecker()
  const problems: string[] = []
  // 三个入口的导出：名称 → 符号，以及每个符号所在的入口（一个导出只属于一个入口）
  const all: { name: string; sym: ts.Symbol; entry: DocEntry; from: string; order: number }[] = []
  for (const e of ENTRIES) {
    const file = prog.getSourceFile(sourcePath(source, e.file))
    if (!file) throw new Error(`找不到 ${e.file}`)
    const moduleSym = checker.getSymbolAtLocation(file)
    if (!moduleSym) throw new Error(`无法解析 ${e.file} 的导出`)
    for (const s of checker.getExportsOfModule(moduleSym)) {
      const sym = s.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(s) : s
      const spec = s.declarations?.[0]
      // `export { X } from …` 的声明是 ExportSpecifier，`export * as X from …` 的是 NamespaceExport
      const decl =
        spec && ts.isExportSpecifier(spec)
          ? spec.parent.parent
          : spec && ts.isNamespaceExport(spec)
            ? spec.parent
            : spec
      const from =
        decl && ts.isExportDeclaration(decl) && decl.moduleSpecifier
          ? (decl.moduleSpecifier as ts.StringLiteral).text
          : ''
      all.push({ name: s.name, sym, entry: e.name, from, order: all.length })
    }
  }
  // 按导出语句的模块路径合并三个入口（与格式化工具给入口文件的排序相同）：检查器第一次遇到字面量类型的先后决定联合
  // 类型成员与映射类型属性的顺序（如 IconName 的取值、Omit 后的属性），按同一顺序处理，生成的文档不随入口的拆分而变
  all.sort((a, b) => compareModulePaths(a.from, b.from) || a.order - b.order)
  const exports = new Map<string, ts.Symbol>()
  const entryOf = new Map<string, DocEntry>()
  const exported = new Map<ts.Symbol, DocEntry>()
  for (const { name, sym, entry } of all) {
    const other = entryOf.get(name)
    if (other) {
      problems.push(`${name}: 同时从 ${other} 与 ${entry} 导出，一个导出只属于一个入口`)
      continue
    }
    exports.set(name, sym)
    entryOf.set(name, entry)
    exported.set(sym, entry)
  }
  const components: ComponentDoc[] = []
  const entries: (ApiEntryDoc & { declarations: ts.Node[] })[] = []
  const deprecated: DeprecatedDoc[] = []
  for (const [name, sym] of exports) {
    const entry = entryOf.get(name) ?? CORE_ENTRY
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
    const isValue = (sym.flags & (ts.SymbolFlags.Value | ts.SymbolFlags.Class)) !== 0
    const categoryTag = tagText(tags, 'category')
    // 命名空间导出的说明在模块文件开头
    const mod = ts.isSourceFile(decl) ? moduleDoc(decl) : null
    const groupTag = mod?.group ?? tagText(tags, 'group')
    if (!categoryTag && groupTag && isValue) {
      const group = API_GROUPS.find((g) => g.title.en === groupTag)
      if (!group)
        problems.push(
          `${name}: @group「${groupTag}」不在 ${API_GROUPS.map((g) => g.title.en).join(', ')} 中`,
        )
      const summary = mod?.doc ?? docOf(checker, sym)
      problems.push(...textProblems(`${name} 的说明`, summary))
      // 组件（首字母大写的函数，第一个参数是属性）列属性表；类列字段
      const component =
        /^[A-Z]/.test(name) && ts.isFunctionDeclaration(decl) && decl.parameters.length === 1
      const r = component
        ? propsOf(checker, exports, name, decl)
        : ts.isClassDeclaration(decl)
          ? propsOfType(checker, checker.getDeclaredTypeOfSymbol(sym), name, undefined)
          : undefined
      if (r) problems.push(...r.problems)
      entries.push({
        name,
        entry,
        group: group?.slug ?? groupTag,
        isClass: ts.isClassDeclaration(decl),
        summary,
        signature: component ? `<${name} {...props} />` : valueSignature(checker, name, decl),
        props: r?.props ?? [],
        modes: r?.modes ?? [],
        declarations: [...(component ? [] : signatureNodes(decl)), ...(r?.declarations ?? [])],
      })
      continue
    }
    if (!categoryTag) {
      // 公开的值都要有文档：组件、hook 用 @category，其余用 @group（API 参考）
      if (isValue)
        problems.push(
          `${name}: 导出的值没有文档：组件与 hook 加 @category，其余加 @group（${API_GROUPS.map((g) => g.title.en).join(', ')}）`,
        )
      continue
    }
    const category = CATEGORIES.find((c) => c.en === categoryTag)
    if (!category)
      problems.push(
        `${name}: @category「${categoryTag}」不在 ${CATEGORIES.map((c) => c.en).join(', ')} 中`,
      )
    const r = propsOf(checker, exports, name, decl)
    problems.push(...r.problems)
    const m = membersOf(checker, name, sym)
    problems.push(...m.problems)
    const hook = isHook(name) && ts.isFunctionDeclaration(decl)
    const signature = hook ? signatureText(checker, name, decl) : null
    const propsSyms = [exports.get(`${name}Props`), exports.get(optionsName(name))].filter(
      (s): s is ts.Symbol => s !== undefined,
    )
    const t = typesOf(
      checker,
      exported,
      [...r.declarations, ...m.declarations, ...(hook ? signatureNodes(decl) : [])],
      name,
      new Set(propsSyms),
    )
    problems.push(...t.problems)
    const c: ComponentDoc = {
      name,
      entry,
      category: category ?? { en: categoryTag, zh: categoryTag },
      summary: docOf(checker, sym),
      usage: { en: tagText(tags, 'usage') ?? '', zh: tagText(tags, 'usageZh') ?? '' },
      signature,
      props: r.props,
      modes: r.modes,
      base: r.base,
      native: r.native,
      members: m.members,
      types: t.types,
      examples: examplesOf(source, prog, checker, name, problems),
    }
    problems.push(...textProblems(`${name} 组件说明`, c.summary))
    problems.push(...textProblems(`${name} @usage / @usageZh（常见用途）`, c.usage))
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
  const api = API_GROUPS.map((g) => {
    const list = entries.filter((e) => e.group === g.slug)
    const t = typesOf(
      checker,
      exported,
      list.flatMap((e) => e.declarations),
      `API ${g.title.en}`,
    )
    problems.push(...t.problems)
    return {
      ...g,
      entries: list.map(({ declarations: _, ...e }) => e),
      types: t.types,
    }
  })
  return { components, api, deprecated, problems, program: prog, checker }
}
