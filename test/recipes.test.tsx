/**
 * 页面配方（examples/recipes/<名称>.recipe.tsx）：给使用方（以及替使用方写代码的智能体）照着搭页面的完整页面。
 * - 每个文件只导出一个与文件同名的函数，TSDoc 是中英双语：英文正文与 `@zh` 各自第一行是标题，其余是说明
 *   （说明可以省略，但两种语言要么都有、要么都没有）；
 * - 只从 `vellum-ui` 与 `react` 导入，不传 `style` / `className`，代码与注释中没有 CJK 字符（中文只在 `@zh` 中）；
 * - 在 ThemeProvider 与 App 之内能在服务端渲染（Node，没有 window、document），输出不为空，没有 React 的报错。
 */
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from '@typescript/typescript6'
import type { ComponentType } from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CJK, HAN } from '../scripts/docs.ts'
import { App, ThemeProvider } from '../src/index.ts'

const recipesDir = fileURLToPath(new URL('../examples/recipes/', import.meta.url))
const SUFFIX = '.recipe.tsx'
const files = readdirSync(recipesDir)
  .filter((f) => f.endsWith(SUFFIX))
  .sort()
const nameOf = (file: string) => file.slice(0, -SUFFIX.length)

/** 配方的清单：增删配方时同时修改这里与 docs 中的链接。 */
const RECIPES = [
  'ChatPage',
  'Dashboard',
  'DetailPage',
  'FormDialog',
  'ListPage',
  'MasterDetail',
  'SettingsPage',
]

/** 配方只能从这两个模块导入：使用方照抄时不会带进别的依赖。 */
const ALLOWED_IMPORTS = new Set(['react', 'vellum-ui'])

interface RecipeSource {
  readonly name: string
  readonly sf: ts.SourceFile
  readonly text: string
}

const sources: RecipeSource[] = files.map((f) => {
  const text = readFileSync(path.join(recipesDir, f), 'utf8')
  return {
    name: nameOf(f),
    text,
    sf: ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX),
  }
})

const isExported = (st: ts.Statement) =>
  ts.isExportDeclaration(st) ||
  ts.isExportAssignment(st) ||
  (ts.canHaveModifiers(st) &&
    (ts.getModifiers(st) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword))

/** 第一行为标题，其余为说明。 */
function titleAndRest(s: string) {
  const [title = '', ...rest] = s.trim().split('\n')
  return { title: title.trim(), description: rest.join('\n').trim() }
}

/** 函数的 TSDoc：英文正文与 `@zh`。 */
function tsdocOf(fn: ts.FunctionDeclaration) {
  const docs = ts.getJSDocCommentsAndTags(fn).filter(ts.isJSDoc)
  const doc = docs[docs.length - 1]
  if (!doc) return null
  const zh = doc.tags?.find((t) => t.tagName.text === 'zh')
  return {
    node: doc,
    en: titleAndRest(ts.getTextOfJSDocComment(doc.comment) ?? ''),
    zh: titleAndRest(ts.getTextOfJSDocComment(zh?.comment) ?? ''),
  }
}

function walk(node: ts.Node, visit: (n: ts.Node) => void) {
  visit(node)
  node.forEachChild((child) => walk(child, visit))
}

describe('页面配方', () => {
  it('配方齐全：每个配方一个文件', () => {
    expect(files.map(nameOf)).toEqual([...RECIPES].sort())
  })

  it('每个文件只导出一个与文件同名的函数', () => {
    const problems = sources.flatMap(({ name, sf }) => {
      const exported = sf.statements.filter(isExported)
      const [only] = exported
      if (exported.length !== 1) return [`${name}: 导出了 ${exported.length} 项`]
      if (!only || !ts.isFunctionDeclaration(only) || only.name?.text !== name)
        return [`${name}: 唯一的导出不是函数 ${name}`]
      return []
    })
    expect(problems).toEqual([])
  })

  it('TSDoc 是中英双语：标题齐全，英文中没有 CJK 字符，中文中有汉字，说明要么都有、要么都没有', () => {
    const problems = sources.flatMap(({ name, sf }) => {
      const fn = sf.statements.find(
        (st): st is ts.FunctionDeclaration =>
          ts.isFunctionDeclaration(st) && st.name?.text === name,
      )
      const doc = fn && tsdocOf(fn)
      if (!doc) return [`${name}: 没有 TSDoc`]
      const out: string[] = []
      if (!doc.en.title) out.push(`${name}: 缺少英文标题`)
      if (CJK.test(doc.en.title) || CJK.test(doc.en.description))
        out.push(`${name}: 英文中有 CJK 字符`)
      if (!HAN.test(doc.zh.title)) out.push(`${name}: @zh 的标题中没有汉字`)
      if (Boolean(doc.en.description) !== Boolean(doc.zh.description))
        out.push(`${name}: 说明只有一种语言`)
      if (doc.zh.description && !HAN.test(doc.zh.description))
        out.push(`${name}: @zh 的说明中没有汉字`)
      return out
    })
    expect(problems).toEqual([])
  })

  it('只从 vellum-ui 与 react 导入', () => {
    const offenders = sources.flatMap(({ name, sf }) =>
      sf.statements
        .filter(ts.isImportDeclaration)
        .map((st) => (st.moduleSpecifier as ts.StringLiteral).text)
        .filter((m) => !ALLOWED_IMPORTS.has(m))
        .map((m) => `${name}: ${m}`),
    )
    expect(offenders).toEqual([])
  })

  it('不给组件传 style、className', () => {
    const offenders: string[] = []
    for (const { name, sf } of sources)
      walk(sf, (n) => {
        if (ts.isJsxAttribute(n) && ['style', 'className'].includes(n.name.getText(sf)))
          offenders.push(`${name}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`)
      })
    expect(offenders).toEqual([])
  })

  it('代码与注释中没有 CJK 字符：界面数据是英文，中文只在导出函数的 @zh 中', () => {
    const offenders = sources.flatMap(({ name, sf, text }) => {
      const fn = sf.statements.find(
        (st): st is ts.FunctionDeclaration =>
          ts.isFunctionDeclaration(st) && st.name?.text === name,
      )
      const doc = fn && tsdocOf(fn)
      const rest = doc ? text.slice(0, doc.node.getStart(sf)) + text.slice(doc.node.end) : text
      return rest
        .split('\n')
        .flatMap((line, i) => (CJK.test(line) ? [`${name}: ${i + 1}: ${line.trim()}`] : []))
    })
    expect(offenders).toEqual([])
  })
})

describe('页面配方的服务端渲染', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  for (const file of files) {
    const name = nameOf(file)
    it(`${name}：在 ThemeProvider 与 App 之内渲染，输出不为空，没有报错`, async () => {
      expect(typeof window).toBe('undefined')
      expect(typeof document).toBe('undefined')
      const mod = (await import(pathToFileURL(path.join(recipesDir, file)).href)) as Record<
        string,
        unknown
      >
      const Recipe = mod[name] as ComponentType
      expect(typeof Recipe).toBe('function')
      const error = vi.spyOn(console, 'error')
      const html = renderToString(
        <ThemeProvider locale="en-US">
          <App>
            <Recipe />
          </App>
        </ThemeProvider>,
      )
      expect(html.trim().length).toBeGreaterThan(0)
      expect(error).not.toHaveBeenCalled()
    })
  }
})
