/**
 * 页面配方：`examples/recipes/<名称>.recipe.tsx` 中唯一导出的函数，TSDoc 的第一行是标题、`@level` 是难度；
 * 配方引入的同目录 CSS Module 列在代码之后。
 */
import path from 'node:path'
import ts from '@typescript/typescript6'
import { CJK, textProblems } from './bilingual.ts'
import { selfContained } from './inline.ts'
import { ENTRIES, RECIPE_LEVELS, type RecipeDoc, type RecipeLevel } from './model.ts'
import { type DocsSource, filesIn, RECIPE_SUFFIX, RECIPES_DIR } from './program.ts'
import { rawTagText, text, titleAndRest } from './tsdoc.ts'

export function recipesOf(
  source: DocsSource,
  prog: ts.Program,
  checker: ts.TypeChecker,
  documented: ReadonlySet<string>,
): { recipes: RecipeDoc[]; problems: string[] } {
  const recipes: RecipeDoc[] = []
  const problems: string[] = []
  for (const abs of filesIn(source, RECIPES_DIR, RECIPE_SUFFIX).sort()) {
    const f = path.basename(abs)
    const sf = prog.getSourceFile(abs)
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
    const level = rawTagText(tags, 'level')
    if (!RECIPE_LEVELS.includes(level as RecipeLevel))
      problems.push(`配方 ${f}: 需要 @level，取值 ${RECIPE_LEVELS.join(' 或 ')}`)
    const code = selfContained(checker, sf, fn)
    const styles: RecipeDoc['styles'] = []
    for (const st of sf.statements) {
      if (!ts.isImportDeclaration(st)) continue
      const spec = (st.moduleSpecifier as ts.StringLiteral).text
      if (!/^\.\/[\w-]+\.module\.css$/.test(spec)) continue
      const file = spec.slice(2)
      const content = source.read(path.join(path.dirname(abs), file))
      if (content === undefined) {
        problems.push(`配方 ${name}: 找不到 ${file}`)
        continue
      }
      const css = content.trim()
      if (CJK.test(css)) problems.push(`配方 ${name}: ${file} 中有 CJK 字符（注释用英文）`)
      styles.push({ file, css })
    }
    const imported = new Set<string>()
    for (const st of sf.statements)
      if (
        ts.isImportDeclaration(st) &&
        ENTRIES.some((e) => e.name === (st.moduleSpecifier as ts.StringLiteral).text) &&
        st.importClause?.namedBindings &&
        ts.isNamedImports(st.importClause.namedBindings)
      )
        for (const e of st.importClause.namedBindings.elements) imported.add(e.name.text)
    const r: RecipeDoc = {
      name,
      title: { en: en.title, zh: zh.title },
      description: { en: en.description, zh: zh.description },
      level: (level as RecipeLevel | null) ?? 'basic',
      code,
      styles,
      components: [...imported].filter((n) => documented.has(n)).sort(),
    }
    problems.push(...textProblems(`配方 ${name} 的标题`, r.title))
    problems.push(...textProblems(`配方 ${name} 的说明`, r.description))
    if (CJK.test(code)) problems.push(`配方 ${name}: 代码中有 CJK 字符（界面数据用英文）`)
    recipes.push(r)
  }
  // 先入门、后进阶；同一难度按名称
  recipes.sort(
    (a, b) =>
      RECIPE_LEVELS.indexOf(a.level) - RECIPE_LEVELS.indexOf(b.level) ||
      a.name.localeCompare(b.name),
  )
  return { recipes, problems }
}
