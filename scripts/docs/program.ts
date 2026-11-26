/**
 * 文档的来源与编译器程序：从哪个根目录读取入口、示例、配方与指南，用什么编译选项。
 *
 * 生成器默认读取本包（diskSource）；测试用 memorySource 在内存中给出几个小文件，验证提取的边界情况，不依赖仓库里
 * 的源码。TS 7 没有 JS 编译器 API，这里用 `@typescript/typescript6` 只做读取（开发依赖，不进产品代码）。
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import ts from '@typescript/typescript6'
import { ENTRIES } from './model.ts'

/** 示例目录、配方目录（相对根目录）与文件后缀。 */
export const EXAMPLES_DIR = 'examples'
export const RECIPES_DIR = 'examples/recipes'
export const EXAMPLE_SUFFIX = '.examples.tsx'
export const RECIPE_SUFFIX = '.recipe.tsx'

/** 读取源码用的编译选项（与 tsconfig 的模块解析一致）。 */
export const COMPILER_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  jsx: ts.JsxEmit.ReactJSX,
  allowImportingTsExtensions: true,
  noEmit: true,
  strict: true,
  skipLibCheck: true,
  lib: ['lib.es2023.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
}

/** 文档的来源：根目录与读取文件的方式。路径都是绝对路径。 */
export interface DocsSource {
  /** 包的根目录：入口（src/index.ts 等）、examples/、docs/<语言>/guides/ 都相对它。 */
  readonly root: string
  /** 目录中的文件名，按名称排序；目录不存在时为空。 */
  list(dir: string): string[]
  /** 文件的内容；文件不存在时为 undefined。 */
  read(file: string): string | undefined
  /** 编译器主机；省略时用 TypeScript 读取磁盘的默认主机。 */
  readonly host?: ts.CompilerHost
}

/** 磁盘上的包（默认）。 */
export function diskSource(root: string): DocsSource {
  return {
    root,
    list: (dir) => (existsSync(dir) ? readdirSync(dir) : []),
    read: (file) => (existsSync(file) ? readFileSync(file, 'utf8') : undefined),
  }
}

/** 内存主机共用的 lib 文件（lib.dom.d.ts 等很大，每个夹具都重新解析太慢）。 */
const libFiles = new Map<string, ts.SourceFile | undefined>()

/**
 * 内存中的包：`files` 是相对 `root` 的路径 → 内容（如 `src/index.ts`、`node_modules/dep/index.d.ts`）。
 * 编译器的 lib 文件仍从 TypeScript 安装目录读取；当前目录是 `root`，不会自动加入仓库的 `@types`。
 */
export function memorySource(root: string, files: Readonly<Record<string, string>>): DocsSource {
  const byPath = new Map(Object.entries(files).map(([rel, text]) => [path.join(root, rel), text]))
  const isDir = (dir: string) => {
    const prefix = dir.endsWith(path.sep) ? dir : `${dir}${path.sep}`
    return [...byPath.keys()].some((f) => f.startsWith(prefix))
  }
  const base = ts.createCompilerHost(COMPILER_OPTIONS, true)
  const host: ts.CompilerHost = {
    ...base,
    getCurrentDirectory: () => root,
    fileExists: (f) => byPath.has(path.resolve(f)) || (!f.startsWith(root) && base.fileExists(f)),
    readFile: (f) =>
      byPath.get(path.resolve(f)) ?? (f.startsWith(root) ? undefined : base.readFile(f)),
    directoryExists: (d) =>
      isDir(path.resolve(d)) || (!d.startsWith(root) && ts.sys.directoryExists(d)),
    getDirectories: (d) => (d.startsWith(root) ? [] : ts.sys.getDirectories(d)),
    getSourceFile: (f, version, onError, create) => {
      const text = byPath.get(path.resolve(f))
      if (text !== undefined) return ts.createSourceFile(f, text, version, true)
      if (f.startsWith(root)) return undefined
      if (!libFiles.has(f)) libFiles.set(f, base.getSourceFile(f, version, onError, create))
      return libFiles.get(f)
    },
  }
  return {
    root,
    host,
    list: (dir) =>
      [...byPath.keys()]
        .filter((f) => path.dirname(f) === path.resolve(dir))
        .map((f) => path.basename(f))
        .sort(),
    read: (file) => byPath.get(path.resolve(file)),
  }
}

/** 源文件在根目录中的绝对路径。 */
export const sourcePath = (source: DocsSource, rel: string) => path.join(source.root, rel)

/** 一个目录下带某个后缀的文件（绝对路径，按来源给出的顺序）。 */
export function filesIn(source: DocsSource, dir: string, suffix: string): string[] {
  const abs = sourcePath(source, dir)
  return source
    .list(abs)
    .filter((f) => f.endsWith(suffix))
    .map((f) => path.join(abs, f))
}

/** 包含三个入口、示例与配方的程序：组件、API 参考、示例与配方都从这一个程序中读取。 */
export function docsProgram(source: DocsSource): ts.Program {
  return ts.createProgram({
    rootNames: [
      ...ENTRIES.map((e) => sourcePath(source, e.file)),
      sourcePath(source, 'src/css.d.ts'),
      ...filesIn(source, EXAMPLES_DIR, EXAMPLE_SUFFIX),
      ...filesIn(source, RECIPES_DIR, RECIPE_SUFFIX),
    ],
    options: COMPILER_OPTIONS,
    host: source.host,
  })
}
