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
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import ts from '@typescript/typescript6'
import type {
  ComponentDoc,
  ComponentExampleDoc,
  ComponentMemberDoc,
  ComponentModeDoc,
  ComponentPropDoc,
  ComponentTypeDoc,
  DocLanguage,
  DocText,
} from '../src/docs.ts'
import { tokenRows } from './tokens.ts'

export type {
  ComponentDoc,
  ComponentExampleDoc,
  ComponentMemberDoc,
  ComponentModeDoc,
  ComponentPropDoc,
  ComponentTypeDoc,
  DocLanguage,
  DocText,
}

/** 本包根目录；生成文件的键都是相对它的 posix 路径。 */
export const pkgRoot = path.resolve(import.meta.dirname, '..')
const examplesDir = path.join(pkgRoot, 'examples')
const recipesDir = path.join(examplesDir, 'recipes')
const RECIPE_SUFFIX = '.recipe.tsx'

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
  const recipes = existsSync(recipesDir)
    ? readdirSync(recipesDir)
        .filter((f) => f.endsWith(RECIPE_SUFFIX))
        .map((f) => path.join(recipesDir, f))
    : []
  return ts.createProgram({
    rootNames: [
      path.join(pkgRoot, 'src/index.ts'),
      path.join(pkgRoot, 'src/css.d.ts'),
      ...examples,
      ...recipes,
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

/** 类型的源码文字：合并空白；去掉分行书写的联合类型开头的 `|`（格式化工具把较长的联合类型写成每行一项）。 */
const typeText = (node: ts.TypeNode) => node.getText().replace(/\s+/g, ' ').replace(/^\| /, '')

/** 本包内由字面量组成的类型别名（如 SpaceStep、Align）展开为取值，读者不必再去查定义。 */
function expandAlias(checker: ts.TypeChecker, node: ts.TypeNode): string {
  const raw = typeText(node)
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
  if (ts.isUnionTypeNode(t) && t.types.every(literal)) return typeText(t)
  return raw
}

const fromAntd = (node: ts.Node) =>
  node.getSourceFile().fileName.replace(/\\/g, '/').includes('/antd/')

/** 实现库（antd、Ant Design X、rc-*、dayjs）中的声明：公共属性不得引用它们（ADR 0021）。 */
const fromImplementation = (node: ts.Node) =>
  /\/node_modules\/(\.pnpm\/[^/]+\/node_modules\/)?(antd|@ant-design\/[^/]+|rc-[^/]+|@rc-component\/[^/]+|dayjs)\//.test(
    node.getSourceFile().fileName.replace(/\\/g, '/'),
  )

/**
 * 属性接口继承的 antd 接口名：`interface InputProps extends Omit<AntInputProps, …>` → `InputProps`。
 * 只看继承子句中直接引用的类型（含 Omit / Pick 的第一个类型参数）。公共属性不得继承 antd 的接口（ADR 0021），
 * 找到时作为问题报告。
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

const inDependency = (node: ts.Node) => node.getSourceFile().fileName.includes('node_modules')

/** 一个符号的双语说明：英文是 TSDoc 正文，中文是 `@zh`。 */
function docOf(checker: ts.TypeChecker, sym: ts.Symbol): DocText {
  return {
    en: text(sym.getDocumentationComment(checker)),
    zh: tagText(sym.getJsDocTags(checker), 'zh') ?? '',
  }
}

/** 参数的文字，去掉默认值（`opts: X = {}` → `opts?: X`）：签名只说明怎么调用。 */
function paramText(checker: ts.TypeChecker, p: ts.ParameterDeclaration): string {
  const optional = p.questionToken || p.initializer ? '?' : ''
  const type = p.type ? typeText(p.type) : checker.typeToString(checker.getTypeAtLocation(p))
  return `${p.dotDotDotToken ? '...' : ''}${p.name.getText()}${optional}: ${type}`
}

const typeParamsText = (tps: ts.NodeArray<ts.TypeParameterDeclaration> | undefined) =>
  tps?.length ? `<${tps.map((t) => t.getText()).join(', ')}>` : ''

/** 函数的签名：`名称<类型参数>(参数): 返回类型`。 */
function signatureText(checker: ts.TypeChecker, name: string, fn: ts.SignatureDeclaration): string {
  const params = fn.parameters.map((p) => paramText(checker, p)).join(', ')
  let ret = fn.type ? typeText(fn.type) : ''
  if (!ret) {
    const sig = checker.getSignatureFromDeclaration(fn)
    ret = sig ? checker.typeToString(sig.getReturnType()) : 'void'
  }
  return `${name}${typeParamsText(fn.typeParameters)}(${params}): ${ret}`
}

/** 属性或字段的类型文字：属性签名用源码（本包的字面量别名展开），方法签名写成函数类型。 */
function memberTypeText(checker: ts.TypeChecker, p: ts.Symbol, d: ts.Declaration | undefined) {
  if (d && ts.isPropertySignature(d) && d.type) return expandAlias(checker, d.type)
  if (d && ts.isMethodSignature(d)) {
    const params = d.parameters.map((x) => paramText(checker, x)).join(', ')
    return `${typeParamsText(d.typeParameters)}(${params}) => ${d.type ? typeText(d.type) : 'void'}`
  }
  return checker.typeToString(checker.getTypeOfSymbol(p))
}

function propDoc(checker: ts.TypeChecker, p: ts.Symbol, d: ts.Declaration | undefined) {
  const tags = p.getJsDocTags(checker)
  return {
    name: p.name,
    type: memberTypeText(checker, p, d),
    description: docOf(checker, p),
    default: tagText(tags, 'default'),
    required: (p.flags & ts.SymbolFlags.Optional) === 0,
  } satisfies ComponentPropDoc
}

/** 一个对象类型中由本包声明的成员；来自依赖的成员（原生属性、antd 的属性）只记下所在的接口。 */
interface OwnMembers {
  entries: { p: ts.Symbol; d: ts.Declaration | undefined }[]
  base: boolean
  nativeOwners: ts.InterfaceDeclaration[]
  antdOwners: ts.InterfaceDeclaration[]
}

function ownMembers(checker: ts.TypeChecker, type: ts.Type): OwnMembers {
  const out: OwnMembers = { entries: [], base: false, nativeOwners: [], antdOwners: [] }
  for (const p of checker.getPropertiesOfType(type)) {
    const d = p.valueDeclaration ?? p.declarations?.[0]
    const owner = d?.parent
    if (owner && ts.isInterfaceDeclaration(owner) && owner.name.text === 'BaseProps') {
      out.base = true
      continue
    }
    // 来自依赖的属性（原生 HTML 属性、封装的 antd 组件的属性）不逐个列出
    if (d && inDependency(d)) {
      if (owner && ts.isInterfaceDeclaration(owner)) {
        if (!out.nativeOwners.includes(owner)) out.nativeOwners.push(owner)
        if (fromAntd(owner) && !out.antdOwners.includes(owner)) out.antdOwners.push(owner)
      }
      continue
    }
    // 组件的公开属性不含 className / style，个别组件内部保留的这两个属性不写进文档
    if (p.name === 'className' || p.name === 'style') continue
    out.entries.push({ p, d })
  }
  return out
}

/**
 * 联合类型中一种用法的标题与说明：取这一员（交叉类型中由本包声明的接口）的 TSDoc，第一行为标题。
 */
function modeText(
  checker: ts.TypeChecker,
  member: ts.Type,
): { title: DocText; description: DocText } {
  const parts = member.isIntersection() ? member.types : [member]
  const sym = parts
    .map((t) => t.aliasSymbol ?? t.getSymbol())
    .find((s) => {
      const d = s?.declarations?.[0]
      return d !== undefined && ts.isInterfaceDeclaration(d) && !inDependency(d)
    })
  const en = titleAndRest(sym ? text(sym.getDocumentationComment(checker)) : '')
  const zh = titleAndRest(sym ? (rawTagText(sym.getJsDocTags(checker), 'zh') ?? '') : '')
  return {
    title: { en: en.title, zh: zh.title },
    description: { en: en.description, zh: zh.description },
  }
}

interface PropsResult {
  props: ComponentPropDoc[]
  modes: ComponentModeDoc[]
  base: boolean
  native: string | null
  problems: string[]
  /** 属性的声明节点：从中查找引用的本库类型。 */
  declarations: ts.Node[]
}

/**
 * 属性表。属性类型是对象类型的联合（如 Select 的单选、可清除的单选、多选）时，按「用法」分组：各员共有、且是
 * 同一处声明的属性进主表，其余的写在各用法下。TypeScript 把 `(A | B) & C` 规范为 `(A & C) | (B & C)`，同样适用。
 */
function propsOfType(
  checker: ts.TypeChecker,
  type: ts.Type,
  where: string,
  propsSym: ts.Symbol | undefined,
): PropsResult {
  const members =
    type.isUnion() && type.types.every((t) => t.flags & ts.TypeFlags.Object || t.isIntersection())
      ? type.types
      : [type]
  const collected = members.map((m) => ownMembers(checker, m))
  const problems: string[] = []
  const declarations: ts.Node[] = []
  const implementationTypes: string[] = []
  const toDoc = ({ p, d }: { p: ts.Symbol; d: ts.Declaration | undefined }) => {
    // 属性的类型（或联合类型中的一员）直接是实现库中声明的类型（如 dayjs 的 Dayjs、antd 的 MenuProps）
    const propType = checker.getTypeOfSymbol(p)
    for (const member of propType.isUnion() ? propType.types : [propType]) {
      const typeSym = member.aliasSymbol ?? member.getSymbol()
      const typeDecl = typeSym?.declarations?.[0]
      if (typeSym && typeDecl && fromImplementation(typeDecl))
        implementationTypes.push(`${p.name}: ${typeSym.name}`)
    }
    if (d) declarations.push(d)
    return propDoc(checker, p, d)
  }
  const first = collected[0] ?? { entries: [], base: false, nativeOwners: [], antdOwners: [] }
  const shared = (name: string, d: ts.Declaration | undefined) =>
    collected.every((c) => c.entries.some((e) => e.p.name === name && e.d === d))
  const props = first.entries.filter((e) => shared(e.p.name, e.d)).map(toDoc)
  const modes: ComponentModeDoc[] = []
  if (members.length > 1)
    members.forEach((m, i) => {
      const { title, description } = modeText(checker, m)
      const own = (collected[i]?.entries ?? []).filter((e) => !shared(e.p.name, e.d)).map(toDoc)
      const label = `${where} 的用法 ${i + 1}`
      problems.push(...textProblems(`${label}（属性联合中一员的 TSDoc 第一行）`, title))
      problems.push(...textProblems(`${label} 的说明`, description, true))
      modes.push({ title, description, props: own })
    })
  const nativeOwners = collected.flatMap((c) => c.nativeOwners)
  const antdOwners = collected.flatMap((c) => c.antdOwners)
  // 继承来的属性所在的接口（按遇到的顺序）。属性的顺序取决于 TypeScript 内部创建类型的先后（程序中多引用一个
  // 依赖的类型就可能改变），所以不取第一个，而取其中最具体的接口（不是其他接口的基接口），结果才稳定
  const native = mostSpecific(checker, [...new Set(nativeOwners)])
  const antd =
    (propsSym ? antdBaseOf(checker, propsSym) : null) ?? mostSpecific(checker, antdOwners)
  if (antd) problems.push(`${where}: 属性继承了 antd 的 ${antd}，公共属性要由本库声明（ADR 0021）`)
  if (implementationTypes.length)
    problems.push(
      `${where}: 属性的类型来自实现库（${[...new Set(implementationTypes)].join('、')}），公共接口要用本库的类型（ADR 0021）`,
    )
  for (const p of [...props, ...modes.flatMap((m) => m.props)])
    problems.push(...textProblems(`${where}.${p.name} 属性说明`, p.description))
  return { props, modes, base: collected.some((c) => c.base), native, problems, declarations }
}

function propsOf(
  checker: ts.TypeChecker,
  exports: Map<string, ts.Symbol>,
  name: string,
  decl: ts.Declaration,
): PropsResult {
  // 优先使用导出的 `<组件>Props` 接口；hook 用 `Use<名称>Options`（如 useHotkeys → UseHotkeysOptions）；
  // 都没有时取函数第一个参数的类型
  const propsSym =
    exports.get(`${name}Props`) ?? (isHook(name) ? exports.get(optionsName(name)) : undefined)
  let type: ts.Type | undefined
  if (propsSym) type = checker.getDeclaredTypeOfSymbol(propsSym)
  else if (ts.isFunctionDeclaration(decl) && decl.parameters[0] && !isHook(name))
    type = checker.getTypeAtLocation(decl.parameters[0])
  if (!type)
    return { props: [], modes: [], base: false, native: null, problems: [], declarations: [] }
  return propsOfType(checker, type, name, propsSym)
}

/** 静态成员：子组件（首字母大写、第一个参数是属性）与函数（如 `Form.useForm`）。 */
function membersOf(
  checker: ts.TypeChecker,
  name: string,
  sym: ts.Symbol,
): { members: ComponentMemberDoc[]; problems: string[]; declarations: ts.Node[] } {
  const members: ComponentMemberDoc[] = []
  const problems: string[] = []
  const declarations: ts.Node[] = []
  for (const p of checker.getPropertiesOfType(checker.getTypeOfSymbol(sym))) {
    const d = p.valueDeclaration ?? p.declarations?.[0]
    if (!d || inDependency(d) || !ts.isPropertySignature(d)) continue
    const full = `${name}.${p.name}`
    const summary = docOf(checker, p)
    problems.push(...textProblems(`${full} 的说明`, summary))
    const sig = checker.getTypeOfSymbol(p).getCallSignatures()[0]
    const param = sig?.parameters[0]
    if (/^[A-Z]/.test(p.name) && param) {
      const r = propsOfType(checker, checker.getTypeOfSymbol(param), full, undefined)
      problems.push(...r.problems)
      declarations.push(...r.declarations)
      members.push({
        name: full,
        summary,
        signature: null,
        props: r.props,
        modes: r.modes,
        base: r.base,
        native: r.native,
      })
      continue
    }
    declarations.push(d)
    const signature =
      d.type && ts.isFunctionTypeNode(d.type)
        ? signatureText(checker, full, d.type)
        : `${full}: ${d.type ? typeText(d.type) : checker.typeToString(checker.getTypeOfSymbol(p))}`
    members.push({
      name: full,
      summary,
      signature,
      props: [],
      modes: [],
      base: false,
      native: null,
    })
  }
  return { members, problems, declarations }
}

/** 由字面量组成的类型别名（属性表中已展开为取值）。 */
function isLiteralUnionAlias(decl: ts.Declaration): boolean {
  if (!ts.isTypeAliasDeclaration(decl)) return false
  const t = decl.type
  return ts.isUnionTypeNode(t) && t.types.every((n) => ts.isLiteralTypeNode(n))
}

/**
 * 从声明节点出发，找出引用的本库导出类型（接口与类型别名），并递归查找这些类型的字段引用的类型。
 * 属性的类型本身就是字面量别名时（属性表已展开取值）不再单列。
 */
function typesOf(
  checker: ts.TypeChecker,
  exported: ReadonlySet<ts.Symbol>,
  roots: readonly ts.Node[],
  where: string,
  skip: ReadonlySet<ts.Symbol> = new Set(),
): { types: ComponentTypeDoc[]; problems: string[] } {
  const seen = new Set<ts.Symbol>(skip)
  const types: ComponentTypeDoc[] = []
  const problems: string[] = []
  const queue: ts.Node[] = [...roots]
  const visit = (node: ts.Node) => {
    if (ts.isTypeReferenceNode(node) || ts.isExpressionWithTypeArguments(node)) {
      let sym = checker.getSymbolAtLocation(
        ts.isTypeReferenceNode(node) ? node.typeName : node.expression,
      )
      if (sym && sym.flags & ts.SymbolFlags.Alias) sym = checker.getAliasedSymbol(sym)
      const decl = sym?.declarations?.[0]
      const expanded =
        decl !== undefined &&
        isLiteralUnionAlias(decl) &&
        ts.isPropertySignature(node.parent) &&
        node.parent.type === node
      if (
        sym &&
        decl &&
        exported.has(sym) &&
        !seen.has(sym) &&
        !expanded &&
        !inDependency(decl) &&
        (ts.isInterfaceDeclaration(decl) || ts.isTypeAliasDeclaration(decl))
      ) {
        seen.add(sym)
        const doc = typeDoc(checker, sym, decl)
        types.push(doc.type)
        problems.push(...doc.problems.map((p) => `${where} 引用的类型 ${p}`))
        queue.push(...doc.declarations)
      }
    }
    ts.forEachChild(node, visit)
  }
  for (let node = queue.shift(); node; node = queue.shift()) visit(node)
  return { types, problems }
}

function typeDoc(
  checker: ts.TypeChecker,
  sym: ts.Symbol,
  decl: ts.InterfaceDeclaration | ts.TypeAliasDeclaration,
): { type: ComponentTypeDoc; problems: string[]; declarations: ts.Node[] } {
  // 类型的标题只写类型参数的名字（`InlineEditOption<V>`），约束与默认值见定义或字段
  const params = decl.typeParameters?.map((t) => t.name.text).join(', ')
  const name = `${sym.name}${params ? `<${params}>` : ''}`
  const summary = docOf(checker, sym)
  const problems = textProblems(`${name} 的说明`, summary)
  if (ts.isTypeAliasDeclaration(decl)) {
    const resolved = checker.getDeclaredTypeOfSymbol(sym)
    const values =
      !isLiteralUnionAlias(decl) && resolved.isUnion() && resolved.types.every((t) => t.isLiteral())
        ? resolved.types.map((t) => checker.typeToString(t))
        : []
    return {
      type: {
        name,
        summary,
        // 取值已逐个列出时不再写定义：定义引用的往往是未导出的对象（`keyof typeof registry`）
        definition: values.length
          ? null
          : `type ${sym.name}${typeParamsText(decl.typeParameters)} = ${decl.type.getText()}`,
        fields: [],
        values,
      },
      problems,
      declarations: [decl.type],
    }
  }
  const { entries } = ownMembers(checker, checker.getDeclaredTypeOfSymbol(sym))
  const fields = entries.map(({ p, d }) => propDoc(checker, p, d))
  for (const f of fields)
    problems.push(...textProblems(`${name}.${f.name} 字段说明`, f.description))
  return {
    type: { name, summary, definition: null, fields, values: [] },
    problems,
    declarations: [...(decl.heritageClauses ?? []), ...entries.flatMap(({ d }) => (d ? [d] : []))],
  }
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

/** 文件顶层的声明语句（变量、函数、类型、类、枚举）：键是声明节点。 */
function topLevelDeclarations(sf: ts.SourceFile): Map<ts.Node, ts.Statement> {
  const out = new Map<ts.Node, ts.Statement>()
  for (const st of sf.statements) {
    if (ts.isVariableStatement(st)) {
      // 解构声明（`const [first, second] = …`）中的名字，声明节点是各个 BindingElement
      const bind = (n: ts.VariableDeclaration | ts.BindingElement) => {
        out.set(n, st)
        if (ts.isObjectBindingPattern(n.name) || ts.isArrayBindingPattern(n.name))
          for (const e of n.name.elements) if (ts.isBindingElement(e)) bind(e)
      }
      for (const d of st.declarationList.declarations) bind(d)
    } else if (
      ts.isFunctionDeclaration(st) ||
      ts.isInterfaceDeclaration(st) ||
      ts.isTypeAliasDeclaration(st) ||
      ts.isClassDeclaration(st) ||
      ts.isEnumDeclaration(st)
    )
      out.set(st, st)
  }
  return out
}

/** 只保留用到的名字的导入语句；过长时按格式化工具的习惯每行一个。 */
function importText(decl: ts.ImportDeclaration, used: ReadonlySet<string>): string | null {
  const clause = decl.importClause
  const from = decl.moduleSpecifier.getText()
  if (!clause) return null
  const parts: string[] = []
  if (clause.name && used.has(clause.name.text)) parts.push(clause.name.text)
  const bindings = clause.namedBindings
  if (bindings && ts.isNamespaceImport(bindings) && used.has(bindings.name.text))
    parts.push(`* as ${bindings.name.text}`)
  if (bindings && ts.isNamedImports(bindings)) {
    const names = bindings.elements.filter((e) => used.has(e.name.text)).map((e) => e.getText())
    if (names.length) {
      const one = `{ ${names.join(', ')} }`
      const prefix = `import ${clause.isTypeOnly ? 'type ' : ''}`
      const line = `${prefix}${[...parts, one].join(', ')} from ${from}`
      if (line.length <= 100) return line
      return `${prefix}${[...parts, `{\n${names.map((n) => `  ${n},`).join('\n')}\n}`].join(', ')} from ${from}`
    }
  }
  if (!parts.length) return null
  return `import ${clause.isTypeOnly ? 'type ' : ''}${parts.join(', ')} from ${from}`
}

/** 导入声明中的名字（ImportSpecifier、默认导入、命名空间导入）所在的导入语句。 */
function importOf(d: ts.Declaration): ts.ImportDeclaration | undefined {
  const clause = ts.isImportSpecifier(d)
    ? d.parent.parent
    : ts.isNamespaceImport(d)
      ? d.parent
      : ts.isImportClause(d)
        ? d
        : undefined
  // JSDoc 中的 @import 不是导入语句
  return clause && ts.isImportDeclaration(clause.parent) ? clause.parent : undefined
}

/**
 * 示例的完整源码，可以直接复制：用到的导入、示例文件中用到的顶层声明（如示例数据，递归查找），最后是示例函数。
 * 从相对路径的 `.ts` 辅助模块（示例图片、模拟的流式响应）导入的声明也内联进来，因为使用方的项目里没有这些文件；
 * `.tsx` 辅助组件（DemoFrame，依赖 CSS Module）保留导入，页面上另有说明。导入与声明保持文件中的顺序。
 */
function selfContained(checker: ts.TypeChecker, sf: ts.SourceFile, fn: ts.Statement): string {
  const tops = new Map<ts.SourceFile, Map<ts.Node, ts.Statement>>()
  const topOf = (f: ts.SourceFile) => {
    let m = tops.get(f)
    if (!m) {
      m = topLevelDeclarations(f)
      tops.set(f, m)
    }
    return m
  }
  const needed = new Map<ts.SourceFile, Set<ts.Statement>>([[sf, new Set()]])
  const keep = (file: ts.SourceFile, st: ts.Statement) => {
    const set = needed.get(file) ?? new Set<ts.Statement>()
    needed.set(file, set)
    if (st === fn || set.has(st)) return false
    set.add(st)
    return true
  }
  const usedImports = new Map<ts.ImportDeclaration, Set<string>>()
  const visit = (node: ts.Node, file: ts.SourceFile): void => {
    if (ts.isIdentifier(node)) {
      const sym =
        node.parent && ts.isShorthandPropertyAssignment(node.parent) && node.parent.name === node
          ? checker.getShorthandAssignmentValueSymbol(node.parent)
          : checker.getSymbolAtLocation(node)
      for (const d of sym?.declarations ?? []) {
        if (d.getSourceFile() !== file) continue
        const imp = importOf(d)
        if (imp && sym) {
          const target = sym.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(sym) : sym
          const td = target.declarations?.[0]
          const tf = td?.getSourceFile()
          const helper =
            (imp.moduleSpecifier as ts.StringLiteral).text.startsWith('.') &&
            td !== undefined &&
            tf !== undefined &&
            !inDependency(td) &&
            /(?<!\.d)\.ts$/.test(tf.fileName)
          const st = helper ? topOf(tf).get(td) : undefined
          if (st && tf) {
            if (keep(tf, st)) visit(st, tf)
            continue
          }
          const set = usedImports.get(imp) ?? new Set<string>()
          set.add(node.text)
          usedImports.set(imp, set)
          continue
        }
        const st = topOf(file).get(d)
        if (st && keep(file, st)) visit(st, file)
      }
    }
    ts.forEachChild(node, (n) => visit(n, file))
  }
  visit(fn, sf)
  const files = [sf, ...[...needed.keys()].filter((f) => f !== sf)]
  const imports: string[] = []
  for (const f of files)
    for (const d of f.statements.filter(ts.isImportDeclaration)) {
      const used = usedImports.get(d)
      const t = used ? importText(d, used) : null
      if (t && !imports.includes(t)) imports.push(t)
    }
  const declarationsOf = (f: ts.SourceFile) =>
    f.statements
      .filter((st) => needed.get(f)?.has(st))
      .map((st) => (f === sf ? st.getText(f) : st.getText(f).replace(/^export\s+/, '')))
  return [
    ...(imports.length ? [imports.join('\n')] : []),
    ...files.slice(1).flatMap(declarationsOf),
    ...declarationsOf(sf),
    fn.getText(sf),
  ].join('\n\n')
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
      code: selfContained(checker, sf, st),
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

/**
 * API 参考的分组（组件以外的导出：主题、颜色、本地化、快捷键、流式、工具）：`en` 是 `@group` 的取值，
 * `slug` 是页面文件名。
 */
export const API_GROUPS: readonly { slug: string; title: DocText; intro: DocText }[] = [
  {
    slug: 'theme',
    title: { en: 'Theme', zh: '主题' },
    intro: {
      en: 'The root component, the built-in theme, and the functions that build and compile themes into CSS variables.',
      zh: '根组件、内置主题，以及创建主题、把主题编译为 CSS 变量的函数。',
    },
  },
  {
    slug: 'colors',
    title: { en: 'Colors', zh: '颜色' },
    intro: {
      en: 'OKLCH colors: creating, converting and checking contrast, as used by themes.',
      zh: 'OKLCH 颜色：创建、转换与检查对比度，主题中使用。',
    },
  },
  {
    slug: 'i18n',
    title: { en: 'Localization', zh: '本地化' },
    intro: {
      en: 'The texts of the library itself (button labels, empty states, screen reader texts) in English and Simplified Chinese, and how to replace them.',
      zh: '组件库自身的文字（按钮文字、空状态、读屏文字），英文与简体中文，以及如何替换。',
    },
  },
  {
    slug: 'hotkeys',
    title: { en: 'Keyboard shortcuts', zh: '快捷键' },
    intro: {
      en: 'Registering keyboard shortcuts is done with useHotkeys; these exports list the registered shortcuts, such as for a shortcut help.',
      zh: '注册快捷键用 useHotkeys；这里的导出用来列出已注册的快捷键，如快捷键帮助。',
    },
  },
  {
    slug: 'streaming',
    title: { en: 'Streaming', zh: '流式' },
    intro: {
      en: 'Reading streamed responses (Server-Sent Events and plain text) for AI replies; useStream builds on them.',
      zh: '读取流式响应（Server-Sent Events 与纯文本），用于 AI 回复；useStream 基于它们。',
    },
  },
  {
    slug: 'utilities',
    title: { en: 'Utilities', zh: '工具' },
    intro: {
      en: 'Hooks and functions used together with the components: delayed loading states, icon names, command matching.',
      zh: '与组件配合使用的 hook 与函数：延迟显示的加载态、图标名称、命令匹配。',
    },
  },
]

/** API 参考中的一项：组件以外的导出。 */
export interface ApiEntryDoc {
  name: string
  group: string
  /** 类：属性表是字段表。 */
  isClass: boolean
  summary: DocText
  /** 函数、常量的签名；类的声明头。 */
  signature: string
  /** 组件（如 ThemeProvider）的属性、类的字段。 */
  props: ComponentPropDoc[]
  modes: ComponentModeDoc[]
}

/** API 参考的一页：一个分组的导出与它们引用的类型。 */
export interface ApiGroupDoc {
  slug: string
  title: DocText
  intro: DocText
  entries: ApiEntryDoc[]
  types: ComponentTypeDoc[]
}

/** 签名中的节点（参数、返回类型、变量的类型）：从中查找引用的本库类型，不进入函数体。 */
function signatureNodes(decl: ts.Declaration): ts.Node[] {
  const ofFn = (fn: ts.SignatureDeclarationBase) => [
    ...fn.parameters,
    ...(fn.type ? [fn.type] : []),
  ]
  if (ts.isFunctionDeclaration(decl)) return ofFn(decl)
  if (ts.isVariableDeclaration(decl)) {
    const init = decl.initializer
    if (decl.type) return [decl.type]
    return init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) ? ofFn(init) : []
  }
  if (ts.isClassDeclaration(decl)) {
    const ctor = decl.members.find(ts.isConstructorDeclaration)
    return [...(decl.heritageClauses ?? []), ...(ctor ? ctor.parameters : [])]
  }
  return []
}

/**
 * 命名空间导出（`export * as primitives from './tokens/primitive.ts'`）的说明：模块文件开头的 TSDoc。它挂在文件的
 * 第一条语句上，带 `@group` 时才算模块的说明（否则是第一条语句自己的说明）。
 */
function moduleDoc(sf: ts.SourceFile): { doc: DocText; group: string | null } | null {
  const first = sf.statements[0]
  const jsdoc = first ? ts.getJSDocCommentsAndTags(first).find(ts.isJSDoc) : undefined
  const tag = (name: string) => jsdoc?.tags?.find((t) => t.tagName.text === name)
  const group = tag('group')
  if (!jsdoc || !group) return null
  const textOf = (c: ts.JSDoc['comment']) => (ts.getTextOfJSDocComment(c) ?? '').trim()
  return {
    doc: { en: textOf(jsdoc.comment), zh: joinCjkLines(textOf(tag('zh')?.comment)) },
    group: textOf(group.comment),
  }
}

/** 变量的类型文字：有类型注解时用注解；`… as T` 时用 T；否则由检查器推断。 */
function variableType(checker: ts.TypeChecker, decl: ts.VariableDeclaration): string {
  if (decl.type) return typeText(decl.type)
  const init = decl.initializer
  if (init && ts.isAsExpression(init) && init.type.getText() !== 'const') return typeText(init.type)
  return checker.typeToString(
    checker.getTypeAtLocation(decl.name),
    undefined,
    ts.TypeFormatFlags.NoTruncation,
  )
}

/** 导出的值（函数、常量、类）的签名；组件的签名不列出（用属性表）。 */
function valueSignature(checker: ts.TypeChecker, name: string, decl: ts.Declaration): string {
  if (ts.isSourceFile(decl)) {
    // 命名空间导出：逐个列出模块的导出
    const mod = checker.getSymbolAtLocation(decl)
    return (mod ? checker.getExportsOfModule(mod) : [])
      .flatMap((m) => {
        const d = m.valueDeclaration
        return d ? [valueSignature(checker, `${name}.${m.name}`, d)] : []
      })
      .join('\n')
  }
  if (ts.isFunctionDeclaration(decl)) return signatureText(checker, name, decl)
  if (ts.isClassDeclaration(decl)) {
    const heritage = decl.heritageClauses?.map((h) => h.getText()).join(' ')
    const ctor = decl.members.find(ts.isConstructorDeclaration)
    const head = `class ${name}${typeParamsText(decl.typeParameters)}${heritage ? ` ${heritage}` : ''}`
    return ctor
      ? `${head}\nnew ${signatureText(checker, name, ctor).replace(/: [^:]*$/, '')}`
      : head
  }
  if (ts.isVariableDeclaration(decl)) {
    const init = decl.initializer
    if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init)))
      return signatureText(checker, name, init)
    return `const ${name}: ${variableType(checker, decl)}`
  }
  return name
}

/** 读取全部带 @category 的导出组件，以及带 @group 的其他导出（API 参考）。 */
export function collect(): {
  components: ComponentDoc[]
  api: ApiGroupDoc[]
  deprecated: DeprecatedDoc[]
  problems: string[]
  program: ts.Program
  checker: ts.TypeChecker
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
  const exported = new Set(exports.values())
  const components: ComponentDoc[] = []
  const entries: (ApiEntryDoc & { declarations: ts.Node[] })[] = []
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
      examples: examplesOf(prog, checker, name, problems),
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
    native: (n: string) =>
      `Also accepts the attributes of the native element (\`${n}\`), such as \`disabled\` and \`onClick\`.`,
    noStyle:
      'Does not accept `style` or `className`: appearance is adjusted only through the semantic props above and the theme.',
    antdTitle: 'Relationship with Ant Design',
    antdText: [
      'Ant Design is only used internally: forms, inputs, overlays and similar components are implemented with it, but their props, values and callbacks are declared by vellum-ui, and no antd type is part of the public API. Their appearance comes from the theme. antd can therefore be upgraded, or a component reimplemented, without breaking applications. Applications do not need to, and should not, import antd directly.',
      "Concepts of antd that duplicate the components of this library are merged under one name: `Tag` → Pill, `Badge` → CountBadge / StatusDot, `Card` → Panel, `Space` → Stack / Inline, `Empty` → EmptyState, `Spin` → Loading; `Avatar` is the library's own letter avatar. `Layout`, `Menu` and `Result` are not exported.",
      'The library only provides general-purpose components: business terms do not appear in their names or props. Build components for business data in your application from these components.',
      'Machine-readable documentation data in both languages (generated from the same source): [`components.json`](../components.json), imported as `vellum-ui/docs/components.json`.',
    ],
    deprecatedTitle: 'Deprecated',
    deprecatedText: 'Still importable, but use the replacement in new code.',
    deprecatedHead: '| Component | Replacement |',
    signature: 'Signature',
    modes: 'Modes',
    modesIntro: (name: string) =>
      `The props of ${name} depend on how it is used. The props in the table above apply to every mode; the props below differ between the modes, and TypeScript checks the combination you pass.`,
    memberProps: 'Props',
    types: 'Types',
    typesIntro:
      "Types of this library used above. Import them with `import type { … } from 'vellum-ui'`.",
    fieldsHead: '| Field | Type | Description | Default | Required |',
    values: 'Values',
    valuesOn: (n: number, link: string) => `${n} values, listed on the ${link} page.`,
    demoFrame:
      '`DemoFrame` is only a fixed-height container of the examples; in a page, put the component in `Page fill` or `Panel fill`.',
    guidesTitle: 'Guides',
    guidesIntro:
      'Read these before writing a page: they explain how the components are meant to be combined.',
    recipesTitle: 'Recipes',
    recipesIntro: 'Complete pages built only from the components, ready to copy and adapt.',
    apiTitle: 'API reference',
    apiIntro:
      'Exports other than components: theme, colors, localization, shortcuts, streaming and utilities.',
    tokensTitle: 'Design tokens',
    tokensText:
      'The CSS variables of the theme, for the few places where an application writes its own CSS: [tokens](tokens.md).',
    componentsUsed: 'Components used',
    recipeOf: 'Recipe',
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
    native: (n: string) => `另外支持原生元素的属性（\`${n}\`），如 \`disabled\`、\`onClick\`。`,
    noStyle: '不接受 `style` 与 `className`：外观只能通过上面的语义参数与主题调整。',
    antdTitle: '与 Ant Design 的关系',
    antdText: [
      'Ant Design 只作为内部实现：表单、输入、弹层等组件用它实现，但属性、值与回调由 vellum-ui 声明，公共接口中没有 antd 的类型，外观由主题统一。因此升级 antd 或改为自己实现某个组件，都不影响使用方。使用方不需要、也不应该直接导入 antd。',
      'antd 中与自研组件重复的概念已合并，只保留一个名字：`Tag` → Pill，`Badge` → CountBadge / StatusDot，`Card` → Panel，`Space` → Stack / Inline，`Empty` → EmptyState，`Spin` → Loading；`Avatar` 是自研的字母头像。`Layout`、`Menu`、`Result` 不导出。',
      '本库只提供通用组件，名字和属性中不出现业务名词；需要业务数据的场景组件请在应用中用这些组件拼装。',
      '机器可读的文档数据（两种语言，与本目录同源）：[`components.json`](../components.json)，经包导出 `vellum-ui/docs/components.json` 引入。',
    ],
    deprecatedTitle: '不推荐使用',
    deprecatedText: '仍可导入，但新代码请改用替代组件。',
    deprecatedHead: '| 组件 | 替代 |',
    signature: '签名',
    modes: '用法',
    modesIntro: (name: string) =>
      `${name} 的属性随用法不同。上表中的属性适用于所有用法；下面的属性因用法而异，TypeScript 会检查传入的组合。`,
    memberProps: '属性',
    types: '类型',
    typesIntro: "上文用到的本库类型，用 `import type { … } from 'vellum-ui'` 引入。",
    fieldsHead: '| 字段 | 类型 | 说明 | 默认值 | 必填 |',
    values: '取值',
    valuesOn: (n: number, link: string) => `共 ${n} 个取值，列在 ${link} 页中。`,
    demoFrame:
      '`DemoFrame` 只是示例中的固定高度容器；在页面中，把组件放进 `Page fill` 或 `Panel fill`。',
    guidesTitle: '指南',
    guidesIntro: '写页面之前先读这些指南：它们说明组件应该怎样组合使用。',
    recipesTitle: '页面配方',
    recipesIntro: '只用组件搭成的完整页面，可以直接复制后修改。',
    apiTitle: 'API 参考',
    apiIntro: '组件以外的导出：主题、颜色、本地化、快捷键、流式与工具。',
    tokensTitle: '设计令牌',
    tokensText: '主题的 CSS 变量，用于应用确实需要自己写 CSS 的少数地方：[令牌](tokens.md)。',
    componentsUsed: '用到的组件',
    recipeOf: '页面配方',
  },
} as const

/** 页首的语言切换：当前语言加粗，另一种语言链接到同一页。`up` 是本页到 docs/ 的相对路径前缀。 */
function switcher(lang: DocLanguage, up: string, page: string): string {
  return LANGUAGES.map((l) =>
    l.lang === lang ? `**${l.label}**` : `[${l.label}](${up}${l.dir}/${page})`,
  ).join(' | ')
}

type Ui = (typeof UI)[DocLanguage]

/** 属性表（或类型的字段表）。 */
function propsTable(props: readonly ComponentPropDoc[], lang: DocLanguage, head: string): string[] {
  const ui = UI[lang]
  return [
    head,
    '| --- | --- | --- | --- | --- |',
    ...props.map(
      (p) =>
        `| \`${p.name}\` | \`${cell(p.type)}\` | ${cell(p.description[lang])} | ${p.default ? `\`${cell(p.default)}\`` : '—'} | ${p.required ? ui.yes : ui.no} |`,
    ),
    '',
  ]
}

/** 各用法的属性表。`level` 是用法标题的级别。 */
function modesBlock(
  name: string,
  modes: readonly ComponentModeDoc[],
  lang: DocLanguage,
  level: string,
): string[] {
  if (!modes.length) return []
  const ui = UI[lang]
  const out = [`${level.slice(1)} ${ui.modes}`, '', ui.modesIntro(name), '']
  for (const m of modes) {
    out.push(`${level} ${m.title[lang]}`, '')
    if (m.description[lang]) out.push(m.description[lang], '')
    if (m.props.length) out.push(...propsTable(m.props, lang, ui.propsHead))
  }
  return out
}

/** 属性表后面的说明：共有属性、原生属性、不接受样式。 */
function propsNotes(ui: Ui, base: boolean, native: string | null, styled: boolean): string[] {
  const out: string[] = []
  if (base) out.push(ui.base, '')
  if (native) out.push(ui.native(native), '')
  if (styled) out.push(ui.noStyle, '')
  return out
}

/** 取值多于这个数时，只在类型所属组件的页面上逐个列出（如 IconName 只列在 Icon 页上），其他页面链接过去。 */
const LONG_VALUES = 20

/**
 * 类型所属的组件：名称是类型名前缀的组件中最长的一个（`IconName` → Icon）。`page` 是当前页的组件名（API 页为
 * `null`），`to` 返回从当前页到组件页的相对路径。
 */
interface TypeContext {
  page: string | null
  owner: (typeName: string) => string | null
  to: (component: string) => string
}

function typesBlock(
  types: readonly ComponentTypeDoc[],
  lang: DocLanguage,
  ctx: TypeContext,
): string[] {
  if (!types.length) return []
  const ui = UI[lang]
  const out = [`## ${ui.types}`, '', ui.typesIntro, '']
  for (const t of types) {
    out.push(`### ${t.name}`, '')
    if (t.summary[lang]) out.push(t.summary[lang], '')
    if (t.definition !== null) out.push('```ts', t.definition, '```', '')
    const owner = ctx.owner(t.name)
    if (t.values.length > LONG_VALUES && owner && owner !== ctx.page)
      out.push(ui.valuesOn(t.values.length, `[${owner}](${ctx.to(owner)}#types)`), '')
    else if (t.values.length)
      out.push(`${ui.values}: ${t.values.map((v) => `\`${v}\``).join(', ')}`, '')
    if (t.fields.length) out.push(...propsTable(t.fields, lang, ui.fieldsHead))
  }
  return out
}

function componentPage(
  c: ComponentDoc,
  lang: DocLanguage,
  owner: TypeContext['owner'] = () => null,
): string {
  const ui = UI[lang]
  const hook = isHook(c.name)
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
  if (c.signature) lines.push(`## ${ui.signature}`, '', '```ts', c.signature, '```', '')
  for (const section of SECTIONS) {
    const list = c.examples.filter((e) => e.section.en === section.en)
    if (!list.length) continue
    lines.push(`## ${section[lang]}`, '')
    for (const e of list) {
      if (list.length > 1 || e.title[lang] !== section[lang]) lines.push(`### ${e.title[lang]}`, '')
      if (e.description[lang]) lines.push(e.description[lang], '')
      lines.push('```tsx', e.code, '```', '')
      if (/\bDemoFrame\b/.test(e.code)) lines.push(ui.demoFrame, '')
    }
  }
  // hook 的属性表来自它的选项接口；没有选项的 hook 只有签名
  if (hook && c.props.length)
    lines.push(`## ${ui.options}`, '', ...propsTable(c.props, lang, ui.optionsHead))
  else if (!hook) {
    lines.push(`## ${ui.props}`, '')
    if (c.props.length) lines.push(...propsTable(c.props, lang, ui.propsHead))
    else lines.push(c.native ? ui.noOwnProps : ui.noProps, '')
  }
  // hook 没有外观，「不接受 style / className」对它没有意义
  lines.push(...propsNotes(ui, c.base, c.native, !hook))
  lines.push(...modesBlock(c.name, c.modes, lang, '###'))
  for (const m of c.members) {
    lines.push(`## ${m.name}`, '', m.summary[lang], '')
    if (m.signature) {
      lines.push('```ts', m.signature, '```', '')
      continue
    }
    lines.push(`### ${ui.memberProps}`, '')
    if (m.props.length) lines.push(...propsTable(m.props, lang, ui.propsHead))
    else lines.push(m.native ? ui.noOwnProps : ui.noProps, '')
    lines.push(...propsNotes(ui, m.base, m.native, true))
    lines.push(...modesBlock(m.name, m.modes, lang, '####'))
  }
  lines.push(...typesBlock(c.types, lang, { page: c.name, owner, to: (x) => `${x}.md` }))
  return lines.join('\n')
}

/** API 参考的一页：一个分组的导出，后面是它们引用的类型。 */
function apiPage(
  g: ApiGroupDoc,
  lang: DocLanguage,
  owner: TypeContext['owner'] = () => null,
): string {
  const ui = UI[lang]
  const lines = [
    HEADER,
    '',
    switcher(lang, '../../', `api/${g.slug}.md`),
    '',
    `# ${g.title[lang]}`,
    '',
    g.intro[lang],
    '',
  ]
  for (const e of g.entries) {
    lines.push(`## ${e.name}`, '', e.summary[lang], '')
    lines.push('```ts', e.signature, '```', '')
    if (e.props.length)
      lines.push(...propsTable(e.props, lang, e.isClass ? ui.fieldsHead : ui.propsHead))
    lines.push(...modesBlock(e.name, e.modes, lang, '###'))
  }
  lines.push(
    ...typesBlock(g.types, lang, { page: null, owner, to: (x) => `../components/${x}.md` }),
  )
  return lines.join('\n')
}

/** 总览表格中的描述只取第一句。 */
function firstSentence(s: string, lang: DocLanguage): string {
  const re = lang === 'zh' ? /(?<=。)/ : /(?<=[.!?])\s+(?=[A-Z`*])/
  return (s.split(re)[0] ?? s).replace(/\n/g, ' ').trim()
}

/** 一篇手写的指南：`docs/<语言>/guides/<slug>.md`，标题是第一个 `# `，简介是标题后的第一段。 */
export interface GuideDoc {
  slug: string
  title: DocText
  summary: DocText
}

/** 指南在总览与 llms.txt 中的顺序；其余的按文件名排在后面。 */
const GUIDE_ORDER = ['building-pages', 'conventions', 'custom-styles']

function readGuides(): { guides: GuideDoc[]; problems: string[] } {
  const problems: string[] = []
  const pick = (dir: string) => {
    const abs = path.join(pkgRoot, 'docs', dir, 'guides')
    return existsSync(abs) ? readdirSync(abs).filter((f) => f.endsWith('.md')) : []
  }
  const [en = [], zh = []] = LANGUAGES.map((l) => pick(l.dir))
  for (const f of en) if (!zh.includes(f)) problems.push(`指南 ${f}: 缺少 zh-CN 版`)
  for (const f of zh) if (!en.includes(f)) problems.push(`指南 ${f}: 缺少 en-US 版`)
  const head = (dir: string, file: string) => {
    const body = readFileSync(path.join(pkgRoot, 'docs', dir, 'guides', file), 'utf8')
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
    return { title, summary: joinCjkLines(para.join('\n')).replace(/\n/g, ' ') }
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
      }
      problems.push(...textProblems(`指南 ${f} 的标题`, g.title))
      problems.push(...textProblems(`指南 ${f} 的简介（标题后的第一段）`, g.summary))
      return g
    })
  return { guides, problems }
}

/** 一个页面配方：`examples/recipes/<名称>.recipe.tsx` 中唯一导出的函数。 */
export interface RecipeDoc {
  name: string
  title: DocText
  description: DocText
  code: string
  /** 用到的有文档的组件。 */
  components: string[]
}

function recipesOf(
  prog: ts.Program,
  checker: ts.TypeChecker,
  documented: ReadonlySet<string>,
): { recipes: RecipeDoc[]; problems: string[] } {
  const recipes: RecipeDoc[] = []
  const problems: string[] = []
  const files = existsSync(recipesDir)
    ? readdirSync(recipesDir)
        .filter((f) => f.endsWith(RECIPE_SUFFIX))
        .sort()
    : []
  for (const f of files) {
    const sf = prog.getSourceFile(path.join(recipesDir, f))
    if (!sf) continue
    const name = f.slice(0, -RECIPE_SUFFIX.length)
    const fns = sf.statements.filter(
      (st): st is ts.FunctionDeclaration =>
        ts.isFunctionDeclaration(st) &&
        st.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) === true,
    )
    const fn = fns[0]
    if (fns.length !== 1 || fn?.name?.text !== name) {
      problems.push(`配方 ${f}: 必须只导出一个函数，名为 ${name}`)
      continue
    }
    const sym = fn.name ? checker.getSymbolAtLocation(fn.name) : undefined
    const tags = sym?.getJsDocTags(checker) ?? []
    const en = titleAndRest(sym ? text(sym.getDocumentationComment(checker)) : '')
    const zh = titleAndRest(rawTagText(tags, 'zh') ?? '')
    const code = selfContained(checker, sf, fn)
    const imported = new Set<string>()
    for (const st of sf.statements)
      if (
        ts.isImportDeclaration(st) &&
        st.moduleSpecifier.getText().slice(1, -1) === 'vellum-ui' &&
        st.importClause?.namedBindings &&
        ts.isNamedImports(st.importClause.namedBindings)
      )
        for (const e of st.importClause.namedBindings.elements) imported.add(e.name.text)
    const r: RecipeDoc = {
      name,
      title: { en: en.title, zh: zh.title },
      description: { en: en.description, zh: zh.description },
      code,
      components: [...imported].filter((n) => documented.has(n)).sort(),
    }
    problems.push(...textProblems(`配方 ${name} 的标题`, r.title))
    problems.push(...textProblems(`配方 ${name} 的说明`, r.description))
    if (CJK.test(code)) problems.push(`配方 ${name}: 代码中有 CJK 字符（界面数据用英文）`)
    recipes.push(r)
  }
  return { recipes, problems }
}

function recipePage(r: RecipeDoc, lang: DocLanguage): string {
  const ui = UI[lang]
  return [
    HEADER,
    '',
    switcher(lang, '../../', `recipes/${r.name}.md`),
    '',
    `# ${r.title[lang]}`,
    '',
    r.description[lang],
    '',
    `**${ui.componentsUsed}**: ${r.components.map((c) => `[${c}](../components/${c}.md)`).join(', ')}`,
    '',
    '```tsx',
    r.code,
    '```',
    '',
  ].join('\n')
}

interface OverviewInput {
  components: ComponentDoc[]
  api: ApiGroupDoc[]
  guides: GuideDoc[]
  recipes: RecipeDoc[]
  deprecated: DeprecatedDoc[]
}

function overview(d: OverviewInput, lang: DocLanguage): string {
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
  if (d.guides.length) {
    lines.push(`## ${ui.guidesTitle}`, '', ui.guidesIntro, '')
    for (const g of d.guides)
      lines.push(`- [${g.title[lang]}](guides/${g.slug}.md): ${g.summary[lang]}`)
    lines.push('')
  }
  if (d.recipes.length) {
    lines.push(`## ${ui.recipesTitle}`, '', ui.recipesIntro, '')
    for (const r of d.recipes)
      lines.push(
        `- [${r.title[lang]}](recipes/${r.name}.md): ${firstSentence(r.description[lang], lang)}`,
      )
    lines.push('')
  }
  for (const cat of CATEGORIES) {
    const list = d.components.filter((c) => c.category.en === cat.en)
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
  const groups = d.api.filter((g) => g.entries.length)
  if (groups.length) {
    lines.push(`## ${ui.apiTitle}`, '', ui.apiIntro, '')
    for (const g of groups)
      lines.push(
        `- [${g.title[lang]}](api/${g.slug}.md): ${g.entries.map((e) => `\`${e.name}\``).join(', ')}`,
      )
    lines.push('')
  }
  lines.push(`## ${ui.tokensTitle}`, '', ui.tokensText, '')
  lines.push(`## ${ui.antdTitle}`, '')
  for (const p of ui.antdText) lines.push(p, '')
  if (d.deprecated.length) {
    lines.push(
      `## ${ui.deprecatedTitle}`,
      '',
      ui.deprecatedText,
      '',
      ui.deprecatedHead,
      '| --- | --- |',
    )
    for (const x of d.deprecated) lines.push(`| \`${x.name}\` | ${cell(x.note[lang])} |`)
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
    `${count} components, generated from the TSDoc and the examples of the library, with guides, page recipes and an API reference. Machine-readable data in both languages: [\`components.json\`](components.json) (\`vellum-ui/docs/components.json\`). For AI coding agents: [\`llms.txt\`](../llms.txt).`,
    '',
    `共 ${count} 个组件，由组件库的 TSDoc 与示例生成，另有指南、页面配方与 API 参考。两种语言的机器可读数据：[\`components.json\`](components.json)（\`vellum-ui/docs/components.json\`）。给 AI 编程智能体的入口：[\`llms.txt\`](../llms.txt)。`,
    '',
  ].join('\n')
}

/**
 * 给 AI 编程智能体的入口（llms.txt 约定：标题、引用块中的简介、说明、链接列表）。放在包的根目录，链接是相对它
 * 的路径：装在项目里时是 `node_modules/vellum-ui/llms.txt`，智能体可以直接读本地文件，与安装的版本一致。
 */
function llmsTxt(d: OverviewInput): string {
  const lines = [
    '# vellum-ui',
    '',
    '> A React component library: pages are composed from its components, and their appearance comes from the theme (design tokens, light and dark modes, accent color, density). Applications do not write styles for the components.',
    '',
    'Rules for code that uses vellum-ui:',
    '',
    '- Import components, hooks and types from `vellum-ui` only. Do not import `antd`, `@ant-design/*` or `lucide-react` directly, even though the library uses them inside.',
    '- Components accept no `style` or `className`; use their semantic props (`size` is `sm` / `md` / `lg`, semantic colors are `tone`, appearances are `variant`, spacing uses the steps `0`–`8`).',
    '- The props are the library\'s own, not Ant Design\'s: for example `<Button variant="primary">`, `<Select multiple>`, Form.Item `status`. Read [conventions](docs/en-US/guides/conventions.md) before writing code.',
    '- Value inputs call `onChange` with the value itself; "no value" is `null`; dates and times are ISO strings; decimal amounts are strings.',
    '- Wrap the application once in `ThemeProvider` (and `App` for `useMessage` / `useConfirmDanger`), and import `vellum-ui/styles.css` once; see the [README](README.md#usage).',
    '- Every component page has the import, complete examples, the props (by mode when they differ, such as single and multiple selection), static members such as `Form.Item`, and the types used. The TypeScript declarations of the package carry the same descriptions.',
    '',
    'All links are relative to this file; in an installed package it is `node_modules/vellum-ui/llms.txt`.',
    '',
  ]
  if (d.guides.length) {
    lines.push('## Guides', '')
    for (const g of d.guides)
      lines.push(`- [${g.title.en}](docs/en-US/guides/${g.slug}.md): ${g.summary.en}`)
    lines.push('')
  }
  if (d.recipes.length) {
    lines.push('## Recipes', '')
    for (const r of d.recipes)
      lines.push(
        `- [${r.title.en}](docs/en-US/recipes/${r.name}.md): ${firstSentence(r.description.en, 'en')}`,
      )
    lines.push('')
  }
  lines.push('## Components', '')
  for (const cat of CATEGORIES) {
    const list = d.components.filter((c) => c.category.en === cat.en)
    if (!list.length) continue
    lines.push(`### ${cat.en}`, '')
    for (const c of list)
      lines.push(
        `- [${c.name}](docs/en-US/components/${c.name}.md): ${firstSentence(c.summary.en, 'en')}`,
      )
    lines.push('')
  }
  const groups = d.api.filter((g) => g.entries.length)
  if (groups.length) {
    lines.push('## API reference', '')
    for (const g of groups)
      lines.push(
        `- [${g.title.en}](docs/en-US/api/${g.slug}.md): ${g.entries.map((e) => `\`${e.name}\``).join(', ')}`,
      )
    lines.push('')
  }
  lines.push(
    '## Optional',
    '',
    '- [Design tokens](docs/en-US/tokens.md): the CSS variables of the theme, for custom CSS in an application',
    '- [Migrating to 1.0](MIGRATION.md): old props (Ant Design style) and their replacements',
    '- [Component overview](docs/en-US/README.md): the same index as tables, with common uses',
    '- [Simplified Chinese documentation](docs/zh-CN/README.md): the same documentation in Chinese',
    '- [components.json](docs/components.json): the component documentation as data, in both languages',
    '',
  )
  return lines.join('\n')
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

const TOKENS_UI = {
  en: {
    title: 'Design tokens',
    intro:
      "Every token is a CSS custom property `--vl-<name>`, set on the document root by ThemeProvider; the values below are those of the default theme. In CSS write `var(--vl-color-text-secondary)`; in TypeScript, `cssVar('color-text-secondary')` returns the same expression. The components already use these tokens. Write CSS of your own only for visuals specific to your application ([custom styles](guides/custom-styles.md)), and only with the semantic tokens, never with fixed values.",
    token: 'Token',
    light: 'Light',
    dark: 'Dark',
    value: 'Value',
    comfortable: 'Comfortable',
    compact: 'Compact',
  },
  zh: {
    title: '设计令牌',
    intro:
      "每个令牌都是一个 CSS 自定义属性 `--vl-<名称>`，由 ThemeProvider 设置在文档根元素上；下表是默认主题的取值。CSS 中写 `var(--vl-color-text-secondary)`；TypeScript 中 `cssVar('color-text-secondary')` 返回同样的表达式。组件已经使用这些令牌。只有应用特有的视觉才自己写 CSS（[自定义样式](guides/custom-styles.md)），并且只用语义令牌，不写固定值。",
    token: '令牌',
    light: '浅色',
    dark: '深色',
    value: '取值',
    comfortable: '舒适',
    compact: '紧凑',
  },
} as const

/** 设计令牌清单：`docs/<语言>/tokens.md`。 */
function tokensPage(lang: DocLanguage): string {
  const ui = TOKENS_UI[lang]
  const lines = [
    HEADER,
    '',
    switcher(lang, '../', 'tokens.md'),
    '',
    `# ${ui.title}`,
    '',
    ui.intro,
    '',
  ]
  for (const { section, rows } of tokenRows().sections) {
    lines.push(`## ${section.title[lang]}`, '', section.intro[lang], '')
    const head =
      section.columns === 'mode'
        ? [ui.light, ui.dark]
        : section.columns === 'density'
          ? [ui.comfortable, ui.compact]
          : [ui.value]
    lines.push(
      `| ${ui.token} | ${head.join(' | ')} |`,
      `| --- |${head.map(() => ' --- |').join('')}`,
    )
    for (const r of rows) {
      const values =
        section.columns === 'mode'
          ? [r.light, r.dark]
          : section.columns === 'density'
            ? [r.light, r.compact]
            : [r.light]
      lines.push(`| \`${r.name}\` | ${values.map((v) => `\`${cell(v)}\``).join(' | ')} |`)
    }
    lines.push('')
  }
  return lines.join('\n')
}

/** 给 AI 编程智能体的入口文件（包的根目录）。 */
export const LLMS_TXT = 'llms.txt'

/** 生成全部产物（不写盘）。 */
export function generate(): GenerateResult {
  const { components, api, deprecated, problems, recipes } = collectAll()
  const { guides, problems: guideProblems } = readGuides()
  problems.push(...guideProblems)
  for (const t of tokenRows().unmatched)
    problems.push(`令牌 ${t}: 不属于令牌清单的任何一节（scripts/tokens.ts 的 TOKEN_SECTIONS）`)
  const files = new Map<string, string>()
  const input: OverviewInput = { components, api, guides, recipes, deprecated }
  files.set('docs/README.md', entry(components.length))
  const owner = (typeName: string) =>
    components
      .filter((c) => typeName.startsWith(c.name) && c.types.some((t) => t.name === typeName))
      .sort((a, b) => b.name.length - a.name.length)[0]?.name ?? null
  for (const { lang, dir } of LANGUAGES) {
    files.set(`docs/${dir}/README.md`, overview(input, lang))
    files.set(`docs/${dir}/tokens.md`, tokensPage(lang))
    for (const c of components)
      files.set(`docs/${dir}/components/${c.name}.md`, componentPage(c, lang, owner))
    for (const g of api)
      if (g.entries.length) files.set(`docs/${dir}/api/${g.slug}.md`, apiPage(g, lang, owner))
    for (const r of recipes) files.set(`docs/${dir}/recipes/${r.name}.md`, recipePage(r, lang))
  }
  for (const c of components)
    if (c.examples.length) files.set(`stories/generated/${c.name}.stories.tsx`, story(c))
  if (recipes.length) files.set('stories/generated/Recipes.stories.tsx', recipeStories(recipes))
  files.set(COMPONENTS_JSON, `${JSON.stringify(components, null, 2)}\n`)
  files.set(LLMS_TXT, llmsTxt(input))
  return { files, components, problems }
}

/** 组件、API 参考与页面配方（同一个程序，只解析一次）。 */
function collectAll() {
  const c = collect()
  const { recipes, problems } = recipesOf(
    c.program,
    c.checker,
    new Set(c.components.map((x) => x.name)),
  )
  return { ...c, recipes, problems: [...c.problems, ...problems] }
}

/** 页面配方的故事：一个文件，每个配方一个故事，放在 App 中。 */
function recipeStories(recipes: readonly RecipeDoc[]): string {
  const lines = [
    '// Generated by scripts/docs.ts, do not edit',
    "import type { Meta, StoryObj } from '@storybook/react-vite'",
    "import { App } from 'vellum-ui'",
    ...recipes.map(
      (r) => `import { ${r.name} } from '../../examples/recipes/${r.name}${RECIPE_SUFFIX}'`,
    ),
    '',
    "const meta = { title: 'Recipes', parameters: { layout: 'fullscreen' } } satisfies Meta",
    'export default meta',
    '',
  ]
  for (const r of recipes)
    lines.push(
      `export const ${r.name}Recipe: StoryObj = {`,
      `  name: ${literal(r.title.en)},`,
      // 配方是完整的页面，与真实页面一样放在 App 中（useMessage、useConfirmDanger 需要它）
      `  render: () => (`,
      '    <App>',
      `      <${r.name} />`,
      '    </App>',
      '  ),',
      '}',
    )
  return `${lines.join('\n')}\n`
}

/** 生成目录：这些目录下不在产物清单中的文件视为过时。 */
export const GENERATED_DIRS = [
  ...LANGUAGES.flatMap((l) => [
    `docs/${l.dir}/components`,
    `docs/${l.dir}/api`,
    `docs/${l.dir}/recipes`,
  ]),
  'stories/generated',
]
