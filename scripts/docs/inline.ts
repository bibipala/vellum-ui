/** 可复制示例的依赖收集与辅助模块内联，独立于文档目录，方便用小型夹具验证。 */
import ts from '@typescript/typescript6'

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
      ts.isEnumDeclaration(st) ||
      ts.isExportAssignment(st)
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
 * `.tsx` 辅助组件（DemoFrame，依赖 CSS Module）保留导入，页面上另有说明。同一文件内的声明保持原顺序，跨文件先输出依赖；重命名的导入用别名声明保留绑定。
 */
export function selfContained(
  checker: ts.TypeChecker,
  sf: ts.SourceFile,
  fn: ts.Statement,
): string {
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
  const dependencies = new Map<ts.SourceFile, Set<ts.SourceFile>>()
  const aliases = new Map<ts.SourceFile, Map<string, { target: ts.Symbol; name: string }>>()
  const defaults = new Map<ts.Statement, { name: string; target: ts.Symbol }>()
  const aliasFor = (
    file: ts.SourceFile,
    targetFile: ts.SourceFile,
    st: ts.Statement,
    target: ts.Symbol,
    local: string,
    declaration: ts.Declaration,
  ) => {
    const deps = dependencies.get(file) ?? new Set<ts.SourceFile>()
    deps.add(targetFile)
    dependencies.set(file, deps)
    const declared = ts.getNameOfDeclaration(declaration)
    const name =
      declared && ts.isIdentifier(declared) ? declared.text : (defaults.get(st)?.name ?? local)
    if (!declared) defaults.set(st, { name, target })
    if (name === local) return
    const bindings = aliases.get(file) ?? new Map<string, { target: ts.Symbol; name: string }>()
    bindings.set(local, { target, name })
    aliases.set(file, bindings)
  }
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
            !td.getSourceFile().fileName.includes('node_modules') &&
            /(?<!\.d)\.ts$/.test(tf.fileName)
          const st = helper ? topOf(tf).get(td) : undefined
          if (st && tf && td) {
            aliasFor(file, tf, st, target, node.text, td)
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
  // 展平后所有顶层绑定共享作用域：不同符号同名时明确报错，不能靠拼接顺序悄悄改变含义。
  const names = new Map<string, { symbol: ts.Symbol; file: ts.SourceFile }>()
  const register = (name: string, symbol: ts.Symbol, file: ts.SourceFile) => {
    const previous = names.get(name)
    if (previous && previous.symbol !== symbol)
      throw new Error(`示例内联名称冲突：${name}（${previous.file.fileName} 与 ${file.fileName}）`)
    names.set(name, { symbol, file })
  }
  for (const file of files) {
    for (const [declaration, st] of topOf(file)) {
      if (st !== fn && !needed.get(file)?.has(st)) continue
      const name = ts.getNameOfDeclaration(declaration as ts.Declaration)
      if (name && ts.isIdentifier(name)) {
        const symbol = checker.getSymbolAtLocation(name)
        if (symbol) register(name.text, symbol, file)
      } else {
        const fallback = defaults.get(st)
        if (fallback) register(fallback.name, fallback.target, file)
      }
    }
    for (const [local, binding] of aliases.get(file) ?? []) register(local, binding.target, file)
    for (const imp of file.statements.filter(ts.isImportDeclaration)) {
      const used = usedImports.get(imp)
      if (!used) continue
      const clause = imp.importClause
      const binding = clause?.namedBindings
      const identifiers = [
        ...(clause?.name ? [clause.name] : []),
        ...(binding && ts.isNamespaceImport(binding) ? [binding.name] : []),
        ...(binding && ts.isNamedImports(binding) ? binding.elements.map((e) => e.name) : []),
      ]
      for (const name of identifiers) {
        const symbol = checker.getSymbolAtLocation(name)
        if (used.has(name.text) && symbol)
          register(name.text, checker.getAliasedSymbol(symbol), file)
      }
    }
  }
  const declarationsOf = (f: ts.SourceFile) =>
    f.statements
      .filter((st) => needed.get(f)?.has(st))
      .map((st) => {
        if (f === sf) return st.getText(f)
        const name = defaults.get(st)?.name
        if (name && ts.isExportAssignment(st)) return `const ${name} = ${st.expression.getText(f)}`
        if (name && ts.isFunctionDeclaration(st) && !st.name) {
          const named = ts.factory.updateFunctionDeclaration(
            st,
            st.modifiers?.filter(
              (m) =>
                m.kind !== ts.SyntaxKind.ExportKeyword && m.kind !== ts.SyntaxKind.DefaultKeyword,
            ),
            st.asteriskToken,
            ts.factory.createIdentifier(name),
            st.typeParameters,
            st.parameters,
            st.type,
            st.body,
          )
          return ts.createPrinter().printNode(ts.EmitHint.Unspecified, named, f)
        }
        if (name && ts.isClassDeclaration(st) && !st.name) {
          const named = ts.factory.updateClassDeclaration(
            st,
            st.modifiers?.filter(
              (m) =>
                m.kind !== ts.SyntaxKind.ExportKeyword && m.kind !== ts.SyntaxKind.DefaultKeyword,
            ),
            ts.factory.createIdentifier(name),
            st.typeParameters,
            st.heritageClauses,
            st.members,
          )
          return ts.createPrinter().printNode(ts.EmitHint.Unspecified, named, f)
        }
        return st.getText(f).replace(/^export\s+(?:default\s+)?/, '')
      })
  const emitted = new Set<ts.SourceFile>()
  const visiting = new Set<ts.SourceFile>()
  const emittedAliases = new Set<string>()
  const output: string[] = imports.length ? [imports.join('\n')] : []
  const emit = (file: ts.SourceFile) => {
    if (emitted.has(file)) return
    // 函数之间可以递归引用；函数声明会提升，不必拒绝这类模块环。
    if (visiting.has(file)) return
    visiting.add(file)
    for (const dependency of dependencies.get(file) ?? []) emit(dependency)
    for (const [local, { target, name }] of aliases.get(file) ?? []) {
      if (emittedAliases.has(local)) continue
      emittedAliases.add(local)
      if (target.flags & ts.SymbolFlags.Value) {
        const declarations = target.declarations ?? []
        const hoisted = declarations.some(ts.isFunctionDeclaration)
        const targetFile = declarations[0]?.getSourceFile()
        if (!hoisted && targetFile && !emitted.has(targetFile))
          throw new Error(`示例内联无法初始化循环依赖中的别名：${local}（${file.fileName}）`)
        output.push(`const ${local} = ${name}`)
      }
      if (target.flags & ts.SymbolFlags.Type) {
        const declaration = target.declarations?.find(
          (d) =>
            ts.isTypeAliasDeclaration(d) ||
            ts.isInterfaceDeclaration(d) ||
            ts.isClassDeclaration(d),
        )
        const params =
          declaration && 'typeParameters' in declaration ? declaration.typeParameters : undefined
        const generic = params?.length ? `<${params.map((p) => p.getText()).join(', ')}>` : ''
        const args = params?.length ? `<${params.map((p) => p.name.text).join(', ')}>` : ''
        output.push(`type ${local}${generic} = ${name}${args}`)
      }
    }
    output.push(...declarationsOf(file))
    visiting.delete(file)
    emitted.add(file)
  }
  // 没有跨模块依赖时保持原来的文件顺序，当前仓库的文档输出不变。
  for (const file of files.slice(1)) emit(file)
  emit(sf)
  output.push(fn.getText(sf))
  return output.join('\n\n')
}
