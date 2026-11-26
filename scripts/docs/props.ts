/**
 * 属性与类型的提取：属性表（联合类型按用法分组）、静态成员、继承的原生属性，以及属性、成员与签名引用的本库类型。
 */
import ts from '@typescript/typescript6'
import { textProblems } from './bilingual.ts'
import {
  CORE_ENTRY,
  type ComponentMemberDoc,
  type ComponentModeDoc,
  type ComponentPropDoc,
  type ComponentTypeDoc,
  type DocEntry,
  type DocText,
  isHook,
} from './model.ts'
import {
  docOf,
  fromAntd,
  fromImplementation,
  inDependency,
  memberTypeText,
  optionsName,
  rawTagText,
  signatureText,
  tagText,
  text,
  titleAndRest,
  typeParamsText,
  typeText,
} from './tsdoc.ts'

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

export interface PropsResult {
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
export function propsOfType(
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

export function propsOf(
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
export function membersOf(
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
export function typesOf(
  checker: ts.TypeChecker,
  exported: ReadonlyMap<ts.Symbol, DocEntry>,
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
        const { name, ...rest } = doc.type
        types.push({ name, entry: exported.get(sym) ?? CORE_ENTRY, ...rest })
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
): { type: Omit<ComponentTypeDoc, 'entry'>; problems: string[]; declarations: ts.Node[] } {
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
