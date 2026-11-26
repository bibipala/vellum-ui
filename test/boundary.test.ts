/**
 * 库的边界：vellum-ui 是独立的开源项目，不得引用自身目录以外的代码与文件，也不得出现使用方的名字与前缀。
 *
 * 范围是本包的全部源码与生成物：src、examples、stories（含生成的故事）、.storybook、site（文档站）、scripts、test、
 * docs（生成的文档与 components.json）；名字与前缀的检查另含包的说明文件。构建产物（dist）不在范围内。
 * - 裸模块导入只能是 Node 内置模块、本包自身（`vellum-ui/…`），或 package.json 中声明的依赖；
 * - 相对路径导入不跳出本包；
 * - scripts、site、test 中传给路径函数（path.resolve / join、new URL、fs 读写）的向上相对路径必须以文件自身位置
 *   （import.meta）为基准、不跳出本包，也不得出现指向本机的绝对路径。读取 node_modules 中的依赖不受限制
 *   （它在本包目录之内）。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { builtinModules } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from '@typescript/typescript6'
import { beforeAll, describe, expect, it } from 'vitest'

const pkgRoot = fileURLToPath(new URL('..', import.meta.url))
const SCOPES = ['src', 'examples', 'stories', '.storybook', 'site', 'scripts', 'test', 'docs']
/** 只有代码、没有生成物的范围：检查路径字面量。 */
const CODE_SCOPES = ['scripts', 'site', 'test']
const EXTS = ['.ts', '.tsx', '.css', '.md', '.json']

function walk(dir: string): string[] {
  let out: string[] = []
  for (const name of readdirSync(dir)) {
    // 依赖与构建产物（如文档站的 site/dist，其中有复制过去的 docs/）不是本包的源码
    if (name === 'node_modules' || name === 'dist') continue
    const f = path.join(dir, name)
    if (statSync(f).isDirectory()) out = out.concat(walk(f))
    else if (EXTS.some((e) => name.endsWith(e))) out.push(f)
  }
  return out
}

const rel = (f: string) => path.relative(pkgRoot, f).split(path.sep).join('/')
const files = [
  ...SCOPES.flatMap((s) => walk(path.join(pkgRoot, s))),
  path.join(pkgRoot, 'vitest.config.ts'),
]
/** 包的说明文件（随包发布的文件与 CONTRIBUTING.md）：只检查名字与前缀。 */
const META_FILES = [
  'README.md',
  'README.zh-CN.md',
  'CONTRIBUTING.md',
  'CHANGELOG.md',
  'MIGRATION.md',
  'llms.txt',
  'LICENSE',
  'package.json',
  'fonts/README.md',
].map((f) => path.join(pkgRoot, f))

const pkg = JSON.parse(readFileSync(path.join(pkgRoot, 'package.json'), 'utf8')) as {
  name: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}
const declared = new Set([
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.devDependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
])

/** 导入语句中的模块名：静态 import / export … from、副作用 import、动态 import()、CSS @import。 */
const IMPORT_SPECIFIER =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|@import\s+(?:url\(\s*)?)['"]([^'"]+)['"]/g

/**
 * 模块名中含 `${` 的是代码生成脚本中的模板（如生成故事文件的导入语句），不是本文件的导入；
 * 生成出来的文件本身也在扫描范围内，真正的导入在那里检查。
 */
function specifiers(text: string): string[] {
  return [...text.matchAll(IMPORT_SPECIFIER)]
    .map((m) => m[1] as string)
    .filter((s) => !s.includes('${'))
}

/** 裸模块名对应的包名：`antd/locale/x.js` → `antd`，`@scope/pkg/sub` → `@scope/pkg`。 */
function packageOf(specifier: string): string {
  const parts = specifier.split('/')
  return (specifier.startsWith('@') ? parts.slice(0, 2) : parts.slice(0, 1)).join('/')
}

/** 裸模块是否允许：Node 内置模块、本包自身，或声明过的依赖。 */
function allowedBare(specifier: string): boolean {
  if (specifier.startsWith('node:') || builtinModules.includes(specifier)) return true
  const name = packageOf(specifier)
  return name === pkg.name || declared.has(name)
}

/** 上一级目录。写成表达式：本文件自身也在扫描范围内。 */
const UP = '.'.repeat(2)

/** 字符串字面量中的相对路径（`.`、`..`、`./…`、`../…`），以及它所在的行。 */
const RELATIVE_LITERAL = /(['"`])(\.\.?(?:\/[^'"`\n]*)?)\1/g
/** 指向本机的绝对路径：盘符、或类 Unix 的常见根目录。 */
const ABSOLUTE_LITERAL =
  /(['"`])(?:[A-Za-z]:[\\/]|\/(?:home|Users|root|tmp|mnt|opt|srv|var|etc)\/)[^'"`\n]*\1/

/** 产生或使用路径的调用：只检查这些行里的相对路径字面量（`r.startsWith(…)` 这类比较不算）。 */
const PATH_CALL =
  /\b(?:resolve|join|normalize|URL|readFileSync|writeFileSync|readdirSync|existsSync|mkdirSync|rmSync|statSync)\s*\(/

/** 去掉导入语句中的模块名（由导入检查负责），只留下作为数据使用的字面量。 */
const withoutImports = (text: string) => text.replace(IMPORT_SPECIFIER, '')

function pathLiteralProblems(file: string, text: string): string[] {
  const out: string[] = []
  withoutImports(text)
    .split('\n')
    .forEach((line, i) => {
      const where = `${rel(file)}:${i + 1}`
      if (ABSOLUTE_LITERAL.test(line)) out.push(`${where} 绝对路径`)
      if (!PATH_CALL.test(line)) return
      for (const m of line.matchAll(RELATIVE_LITERAL)) {
        const lit = m[2] as string
        if (!lit.startsWith(UP)) continue
        // 向上的相对路径必须以文件自身位置为基准（new URL(…, import.meta.url)、import.meta.dirname），
        // 否则基准不确定（如以包根目录为基准再向上两级），无法证明它不跳出本包
        if (!line.includes('import.meta')) {
          out.push(`${where} ${lit}：向上的相对路径没有以 import.meta 为基准`)
          continue
        }
        const r = path.relative(pkgRoot, path.resolve(path.dirname(file), lit))
        if (r.startsWith(UP) || path.isAbsolute(r)) out.push(`${where} ${lit}：跳出了本包`)
      }
    })
  return out
}

/** 不得出现的使用方名字与前缀（库的前缀是 `--vl-`、`data-vl-*`）。名字由片段拼成：本文件自身也在扫描范围内。 */
const HOST = ['syn', 'works'].join('')
const HOST_PREFIX = 'sw'
const FORBIDDEN_TEXT: [string, RegExp][] = [
  ['使用方名称', new RegExp(HOST, 'i')],
  ['使用方的 CSS 变量前缀', new RegExp(`--${HOST_PREFIX}-`)],
  ['使用方的属性前缀', new RegExp(`data-${HOST_PREFIX}-`)],
]

interface SourceFile {
  file: string
  text: string
  imports: string[]
}

let sourceFiles: SourceFile[] = []
let codeFiles: SourceFile[] = []
let metaFiles: { file: string; text: string }[] = []

// 全库只读取、解析一次：磁盘与换页耗时属于准备阶段，不占用每条边界断言的 5 秒预算。
beforeAll(() => {
  sourceFiles = files.map((file) => {
    const text = readFileSync(file, 'utf8')
    return { file, text, imports: specifiers(text) }
  })
  codeFiles = sourceFiles.filter(({ file }) =>
    CODE_SCOPES.some((s) => rel(file).startsWith(`${s}/`)),
  )
  metaFiles = META_FILES.map((file) => ({ file, text: readFileSync(file, 'utf8') }))
}, 30_000)

describe('vellum-ui 的边界', () => {
  it('能识别各种导入写法', () => {
    expect(specifiers("import { Button } from 'antd'")).toEqual(['antd'])
    // 样例只用本包声明过的依赖：本文件自身也在扫描范围内
    expect(specifiers("import type { Virtualizer } from '@tanstack/react-virtual'")).toEqual([
      '@tanstack/react-virtual',
    ])
    expect(specifiers("export { x } from 'lucide-react'")).toEqual(['lucide-react'])
    expect(specifiers("const m = await import('antd/es/button')")).toEqual(['antd/es/button'])
    expect(specifiers("`import * as ex from '${dir}/${name}.tsx'`")).toEqual([])
    expect(specifiers("import '../base.css'")).toEqual(['../base.css'])
    expect(specifiers('@import "@fontsource-variable/inter/opsz.css";')).toEqual([
      '@fontsource-variable/inter/opsz.css',
    ])
    expect(specifiers('// 见 @acme/ui-sdk 的 errorText')).toEqual([])
  })

  it('能判断裸模块是否允许', () => {
    expect(allowedBare('node:fs')).toBe(true)
    expect(allowedBare('vellum-ui/examples/Button.examples.tsx')).toBe(true)
    expect(allowedBare('antd/locale/zh_CN.js')).toBe(true)
    expect(allowedBare('@tanstack/react-virtual')).toBe(true)
    expect(allowedBare('@acme/ui')).toBe(false)
    expect(allowedBare('@tanstack/react-query')).toBe(false)
    expect(allowedBare('left-pad')).toBe(false)
  })

  it('能识别跳出本包的路径字面量', () => {
    // 探测用的样例由片段拼成，避免本文件自身被判为违规
    const probe = (line: string) => {
      const out: string[] = []
      for (const m of line.matchAll(RELATIVE_LITERAL)) out.push(m[2] as string)
      return { relatives: out, absolute: ABSOLUTE_LITERAL.test(line), call: PATH_CALL.test(line) }
    }
    const twoUp = `${UP}/${UP}`
    const outward = probe(`path.resolve(pkgRoot, '${twoUp}')`)
    expect(outward.relatives).toEqual([twoUp])
    expect(outward.call).toBe(true)
    expect(probe("new URL('./src/', import.meta.url)").relatives).toEqual(['./src/'])
    expect(probe(`expect(r.startsWith('${UP}'))`).call).toBe(false)
    const home = ['', 'home', 'someone', 'x.txt'].join('/')
    const drive = ['C:', 'data', 'x.txt'].join('\\')
    expect(probe(`readFileSync('${home}')`).absolute).toBe(true)
    expect(probe(`readFileSync('${drive}')`).absolute).toBe(true)
    expect(probe("const url = '/api/items'").absolute).toBe(false)
    expect(withoutImports("import x from './src/index.ts'")).toBe('import x ')
  })

  it('扫描范围内有文件', () => {
    for (const s of SCOPES)
      expect(
        files.some((f) => rel(f).startsWith(`${s}/`)),
        s,
      ).toBe(true)
  })

  it('裸模块导入只有 Node 内置模块、本包自身与声明的依赖', () => {
    const offenders = sourceFiles.flatMap(({ file, imports }) =>
      imports.filter((s) => !s.startsWith('.') && !allowedBare(s)).map((s) => `${rel(file)}: ${s}`),
    )
    expect(offenders).toEqual([])
  })

  it('相对路径导入不跳出 libs/vellum-ui', () => {
    const offenders = sourceFiles.flatMap(({ file, imports }) =>
      imports
        .filter((s) => s.startsWith('.'))
        .filter((s) => {
          const target = path.resolve(path.dirname(file), s)
          const r = path.relative(pkgRoot, target)
          return r.startsWith('..') || path.isAbsolute(r)
        })
        .map((s) => `${rel(file)}: ${s}`),
    )
    expect(offenders).toEqual([])
  })

  it('scripts、site、test 中的路径字面量不指向本包以外', () => {
    expect(codeFiles.length).toBeGreaterThan(0)
    expect(codeFiles.flatMap(({ file, text }) => pathLiteralProblems(file, text))).toEqual([])
  })

  it('不出现使用方的名字与前缀', () => {
    const offenders = [...sourceFiles, ...metaFiles].flatMap(({ file, text }) =>
      text
        .split('\n')
        .flatMap((line, i) =>
          FORBIDDEN_TEXT.filter(([, re]) => re.test(line)).map(
            ([what]) => `${rel(file)}:${i + 1} ${what}`,
          ),
        ),
    )
    expect(offenders).toEqual([])
  })
})

/**
 * 入口的依赖边界：核心入口 `vellum-ui`（src/index.ts）的模块图，含按需加载的 `import()`，不得引用图表与 AI 的模块
 * （src/components/charts、src/components/ai）和可选的 peer 依赖（echarts、@ant-design/x-markdown）：只装核心的使用方
 * 没有安装它们，打包器解析不了（按需加载的分块也要在构建时解析）。`vellum-ui/charts` 与 `vellum-ui/ai` 只引用各自需要
 * 的那一个可选依赖。发布产物的同一边界由 scripts/build.ts（构建时）与 scripts/package-smoke.ts（使用方打包）检查。
 */
describe('入口的依赖边界', () => {
  const srcDir = path.join(pkgRoot, 'src')
  /** 从入口出发可达的源码模块（.ts / .tsx，经相对路径的静态导入、再导出与动态导入）及它们的裸模块导入。 */
  function graph(entry: string): { modules: string[]; bare: string[] } {
    const seen = new Set<string>()
    const bare = new Set<string>()
    const visit = (file: string) => {
      if (seen.has(file)) return
      seen.add(file)
      // TS 的预处理器识别静态导入、再导出与 import()，不读注释中的示例
      const { importedFiles } = ts.preProcessFile(readFileSync(file, 'utf8'), true, true)
      for (const { fileName: s } of importedFiles) {
        if (!s.startsWith('.')) {
          bare.add(packageOf(s))
          continue
        }
        const target = path.resolve(path.dirname(file), s)
        if (/\.tsx?$/.test(target)) visit(target)
      }
    }
    visit(path.join(srcDir, entry))
    return { modules: [...seen].map(rel), bare: [...bare] }
  }
  const optional = Object.entries(
    (pkg as { peerDependenciesMeta?: Record<string, { optional?: boolean }> })
      .peerDependenciesMeta ?? {},
  )
    .filter(([, m]) => m.optional)
    .map(([name]) => name)

  it('有两个可选的 peer 依赖：echarts 与 @ant-design/x-markdown', () => {
    expect(optional.sort()).toEqual(['@ant-design/x-markdown', 'echarts'])
  })

  it('核心入口不引用图表与 AI 的模块，也不引用可选的 peer 依赖', () => {
    const core = graph('index.ts')
    expect(core.modules.length).toBeGreaterThan(50)
    expect(core.modules.filter((m) => /^src\/components\/(charts|ai)\//.test(m))).toEqual([])
    expect(core.bare.filter((b) => optional.includes(b))).toEqual([])
  })

  it('图表入口只引用 echarts，AI 入口只引用 @ant-design/x-markdown', () => {
    const charts = graph('charts.ts')
    const ai = graph('ai.ts')
    expect(charts.bare.filter((b) => optional.includes(b))).toEqual(['echarts'])
    expect(ai.bare.filter((b) => optional.includes(b))).toEqual(['@ant-design/x-markdown'])
    expect(charts.modules.filter((m) => m.startsWith('src/components/ai/'))).toEqual([])
    expect(ai.modules.filter((m) => m.startsWith('src/components/charts/'))).toEqual([])
  })
})
