/**
 * 主题的读取接口（src/theme/context.ts）是不带依赖的小模块：只从 react 导入值，其余都是只导入类型。
 * 读取主题的组件（表格、图表、看图）因此不会经由它带上 antd、dayjs 与语言包的初始化代码。
 */
import { readFileSync } from 'node:fs'
import ts from '@typescript/typescript6'
import { describe, expect, it } from 'vitest'

const file = new URL('../src/theme/context.ts', import.meta.url)

/** 模块中引入其他模块的语句：模块名，以及是否只引入类型。 */
function dependencies(source: ts.SourceFile): { module: string; typeOnly: boolean }[] {
  const out: { module: string; typeOnly: boolean }[] = []
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause
      const named = clause?.namedBindings
      const typeOnly =
        clause !== undefined &&
        (clause.isTypeOnly ||
          (clause.name === undefined &&
            named !== undefined &&
            ts.isNamedImports(named) &&
            named.elements.length > 0 &&
            named.elements.every((e) => e.isTypeOnly)))
      out.push({ module: node.moduleSpecifier.text, typeOnly })
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const clause = node.exportClause
      const typeOnly =
        node.isTypeOnly ||
        (clause !== undefined &&
          ts.isNamedExports(clause) &&
          clause.elements.every((e) => e.isTypeOnly))
      out.push({ module: node.moduleSpecifier.text, typeOnly })
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    ) {
      const arg = node.arguments[0]
      out.push({ module: arg && ts.isStringLiteral(arg) ? arg.text : '<dynamic>', typeOnly: false })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return out
}

describe('src/theme/context.ts', () => {
  it('只从 react 导入值，其余都是只导入类型', () => {
    const text = readFileSync(file, 'utf8')
    const source = ts.createSourceFile('context.ts', text, ts.ScriptTarget.ES2022, true)
    const deps = dependencies(source)
    expect(deps.some((d) => d.module === 'react')).toBe(true)
    expect(deps.filter((d) => d.module !== 'react' && !d.typeOnly)).toEqual([])
  })
})
