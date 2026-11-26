/**
 * TSDoc 与类型的文字：标签、标题与说明、类型与签名的源码文字，以及声明来自哪里（本包、依赖、antd 等实现库）。
 */
import ts from '@typescript/typescript6'
import { joinCjkLines } from './bilingual.ts'
import type { DocText } from './model.ts'

export const text = (parts: ts.SymbolDisplayPart[] | undefined) =>
  ts.displayPartsToString(parts).trim()
/** 标签的原文（保留换行）：示例的 `@zh` 第一行是标题，要先分出标题再连接其余的行。 */
export const rawTagText = (tags: ts.JSDocTagInfo[], name: string) => {
  const t = tags.find((x) => x.name === name)
  return t ? text(t.text) : null
}
export const tagText = (tags: ts.JSDocTagInfo[], name: string) => {
  const t = rawTagText(tags, name)
  return t === null ? null : joinCjkLines(t)
}
/** 第一行为标题，其余为说明。 */
export const titleAndRest = (s: string) => {
  const [title = '', ...rest] = s.split('\n')
  return { title: title.trim(), description: joinCjkLines(rest.join('\n').trim()) }
}

/** 一个符号的双语说明：英文是 TSDoc 正文，中文是 `@zh`。 */
export function docOf(checker: ts.TypeChecker, sym: ts.Symbol): DocText {
  return {
    en: text(sym.getDocumentationComment(checker)),
    zh: tagText(sym.getJsDocTags(checker), 'zh') ?? '',
  }
}

/** hook 的选项接口名：useHotkeys → UseHotkeysOptions。 */
export const optionsName = (name: string) => `U${name.slice(1)}Options`

export const fromAntd = (node: ts.Node) =>
  node.getSourceFile().fileName.replace(/\\/g, '/').includes('/antd/')

/** 实现库（antd、@ant-design/*、rc-*、@rc-component/*、dayjs）中的声明：公共属性不得引用它们（ADR 0021）。 */
export const fromImplementation = (node: ts.Node) =>
  /\/node_modules\/(\.pnpm\/[^/]+\/node_modules\/)?(antd|@ant-design\/[^/]+|rc-[^/]+|@rc-component\/[^/]+|dayjs)\//.test(
    node.getSourceFile().fileName.replace(/\\/g, '/'),
  )

export const inDependency = (node: ts.Node) =>
  node.getSourceFile().fileName.includes('node_modules')

/** 类型的源码文字：合并空白；去掉分行书写的联合类型开头的 `|`（格式化工具把较长的联合类型写成每行一项）。 */
export const typeText = (node: ts.TypeNode) =>
  node.getText().replace(/\s+/g, ' ').replace(/^\| /, '')

/** 本包内由字面量组成的类型别名（如 SpaceStep、Align）展开为取值，读者不必再去查定义。 */
export function expandAlias(checker: ts.TypeChecker, node: ts.TypeNode): string {
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

/** 参数的文字，去掉默认值（`opts: X = {}` → `opts?: X`）：签名只说明怎么调用。 */
export function paramText(checker: ts.TypeChecker, p: ts.ParameterDeclaration): string {
  const optional = p.questionToken || p.initializer ? '?' : ''
  const type = p.type ? typeText(p.type) : checker.typeToString(checker.getTypeAtLocation(p))
  return `${p.dotDotDotToken ? '...' : ''}${p.name.getText()}${optional}: ${type}`
}

export const typeParamsText = (tps: ts.NodeArray<ts.TypeParameterDeclaration> | undefined) =>
  tps?.length ? `<${tps.map((t) => t.getText()).join(', ')}>` : ''

/** 函数的签名：`名称<类型参数>(参数): 返回类型`。 */
export function signatureText(
  checker: ts.TypeChecker,
  name: string,
  fn: ts.SignatureDeclaration,
): string {
  const params = fn.parameters.map((p) => paramText(checker, p)).join(', ')
  let ret = fn.type ? typeText(fn.type) : ''
  if (!ret) {
    const sig = checker.getSignatureFromDeclaration(fn)
    ret = sig ? checker.typeToString(sig.getReturnType()) : 'void'
  }
  return `${name}${typeParamsText(fn.typeParameters)}(${params}): ${ret}`
}

/** 属性或字段的类型文字：属性签名用源码（本包的字面量别名展开），方法签名写成函数类型。 */
export function memberTypeText(
  checker: ts.TypeChecker,
  p: ts.Symbol,
  d: ts.Declaration | undefined,
) {
  if (d && ts.isPropertySignature(d) && d.type) return expandAlias(checker, d.type)
  if (d && ts.isMethodSignature(d)) {
    const params = d.parameters.map((x) => paramText(checker, x)).join(', ')
    return `${typeParamsText(d.typeParameters)}(${params}) => ${d.type ? typeText(d.type) : 'void'}`
  }
  return checker.typeToString(checker.getTypeOfSymbol(p))
}

/** 签名中的节点（参数、返回类型、变量的类型）：从中查找引用的本库类型，不进入函数体。 */
export function signatureNodes(decl: ts.Declaration): ts.Node[] {
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
export function moduleDoc(sf: ts.SourceFile): { doc: DocText; group: string | null } | null {
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
export function valueSignature(
  checker: ts.TypeChecker,
  name: string,
  decl: ts.Declaration,
): string {
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
