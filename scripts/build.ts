/**
 * 构建发布产物 dist/（`pnpm build`）。本包在工作区内开发时不需要构建：package.json 的 `exports` 指向源码，
 * 打包发布时由 `publishConfig` 改为指向 dist。
 *
 *   1. Vite 库模式，三个入口（ENTRIES）一次构建：核心 `vellum-ui`（index）、`vellum-ui/charts`（charts）、
 *      `vellum-ui/ai`（ai）。src 的每个模块输出为一个 ESM 文件（保留模块结构，使用方的打包器可以按导出 tree-shaking），
 *      三个入口共用这些文件：图表与 AI 按相对路径导入核心模块，主题上下文等每个模块只有一份。
 *      dependencies 与 peerDependencies（含子路径，如 `antd/locale/…`、`react/jsx-runtime`）不打包；
 *      核心入口的模块图（含按需加载）不得引用可选的 peer 依赖（echarts、@ant-design/x-markdown），否则构建失败。
 *      CSS Modules 与必需的 base.css 编译后按入口合并（JS 中不引用 CSS，由使用方导入）：`core.css`（核心入口可达的
 *      样式）、`charts.css` 与 `ai.css`（各自入口可达、核心之外的样式），以及包含全部样式的 `styles.css`。
 *   2. 可选样式 global.css、fonts.css 原样复制（fonts.css 对字体包的 @import 交给使用方的打包器解析）。
 *   3. tsc 输出声明文件（不带 Node 类型，保证声明只依赖 DOM 与本包的依赖），再把声明中相对导入的扩展名
 *      `.ts` / `.tsx` 改为 `.js`，与 JS 产物的文件名一致（tsc 输出声明时保留源码中的扩展名）；
 *      移除副作用 CSS 导入：样式已按入口合并，声明不应再引用未发布的源样式。
 *
 * 用 Node 编写以便在 Windows 上同样可用。
 */
import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build, type Plugin, type Rolldown } from 'vite'

const pkgRoot = fileURLToPath(new URL('..', import.meta.url))
const srcDir = path.join(pkgRoot, 'src')
const outDir = path.join(pkgRoot, 'dist')

const pkg = JSON.parse(readFileSync(path.join(pkgRoot, 'package.json'), 'utf8')) as {
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  peerDependenciesMeta?: Record<string, { optional?: boolean }>
}
const externals = Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies })
const isExternal = (id: string) => externals.some((d) => id === d || id.startsWith(`${d}/`))
const optionalPeers = Object.entries(pkg.peerDependenciesMeta ?? {})
  .filter(([, meta]) => meta.optional)
  .map(([name]) => name)

/** 入口：输出文件名（不含扩展名）与源文件。 */
const ENTRIES = { index: 'index.ts', charts: 'charts.ts', ai: 'ai.ts' } as const
/** 按入口合并的样式：文件名与入口；核心以外的样式表只含核心之外的样式（使用方先导入 core.css）。 */
const STYLESHEETS = [
  ['core.css', ['index']],
  ['charts.css', ['charts']],
  ['ai.css', ['ai']],
] as const

/**
 * 把各入口可达的 CSS 合并成按入口的样式表。顺序与 Vite 不拆分 CSS 时合并单个文件的顺序相同：从入口按静态导入
 * 深度优先、后序收集，按需加载的分块排在后面。同时检查核心入口可达的分块（含按需加载）没有引用可选的 peer 依赖。
 */
function stylesheets(): Plugin {
  return {
    name: 'vellum-stylesheets',
    enforce: 'post',
    generateBundle(_, bundle) {
      const chunk = (name: string) => {
        const c = bundle[name]
        return c?.type === 'chunk' ? c : undefined
      }
      /** 从入口可达的分块（静态导入后序，按需加载的在后）。 */
      const reachable = (entries: readonly string[]) => {
        const seen = new Set<string>()
        const order: Rolldown.OutputChunk[] = []
        const dynamic = new Set<string>()
        const visit = (name: string) => {
          const c = chunk(name)
          if (!c || seen.has(name)) return
          seen.add(name)
          for (const i of c.imports) visit(i)
          for (const i of c.dynamicImports) dynamic.add(i)
          order.push(c)
        }
        for (const e of entries) visit(`${e}.js`)
        for (const d of dynamic) visit(d)
        return order
      }
      const cssOf = (chunks: readonly Rolldown.OutputChunk[]) => [
        ...new Set(chunks.flatMap((c) => [...(c.viteMetadata?.importedCss ?? [])])),
      ]
      const source = (file: string) => {
        const a = bundle[file]
        if (a?.type !== 'asset') throw new Error(`找不到样式 ${file}`)
        return typeof a.source === 'string' ? a.source : new TextDecoder().decode(a.source)
      }
      // 核心入口不得引用可选的 peer 依赖：只装核心的使用方没有安装它们，打包器无法解析
      const core = reachable(['index'])
      const leaked = core.flatMap((c) =>
        [...c.imports, ...c.dynamicImports]
          .filter((i) => optionalPeers.some((p) => i === p || i.startsWith(`${p}/`)))
          .map((i) => `${c.fileName} -> ${i}`),
      )
      if (leaked.length)
        throw new Error(`核心入口引用了可选的 peer 依赖：\n  ${leaked.join('\n  ')}`)
      const coreCss = cssOf(core)
      const all = cssOf(reachable(Object.keys(ENTRIES)))
      const files = new Map<string, readonly string[]>([['styles.css', all]])
      for (const [file, entries] of STYLESHEETS) {
        const css = cssOf(reachable(entries))
        files.set(file, file === 'core.css' ? css : css.filter((f) => !coreCss.includes(f)))
      }
      const used = new Set(Object.keys(bundle).filter((f) => f.endsWith('.css')))
      for (const [fileName, css] of files)
        this.emitFile({ type: 'asset', fileName, source: css.map(source).join('') })
      // 每个 CSS 模块单独的样式不发布：使用方只导入合并后的样式表
      for (const f of used) delete bundle[f]
    },
  }
}

await build({
  root: pkgRoot,
  configFile: false,
  publicDir: false,
  logLevel: 'warn',
  build: {
    outDir,
    emptyOutDir: true,
    target: 'es2022',
    // 库产物不压缩：压缩会去掉 /* @__PURE__ */ 标注、影响使用方 tree-shaking，最终压缩由使用方的构建完成
    minify: false,
    // 每个 CSS 模块先单独输出，再由 stylesheets() 按入口合并
    cssCodeSplit: true,
    lib: {
      entry: Object.fromEntries(
        Object.entries(ENTRIES).map(([name, file]) => [name, path.join(srcDir, file)]),
      ),
      formats: ['es'],
    },
    rolldownOptions: {
      external: isExternal,
      output: {
        preserveModules: true,
        preserveModulesRoot: srcDir,
        entryFileNames: '[name].js',
      },
    },
  },
  plugins: [stylesheets()],
})

for (const f of ['global.css', 'fonts.css'])
  copyFileSync(path.join(srcDir, f), path.join(outDir, f))

// 优先用本包安装的 tsc：直接运行 `node scripts/build.ts`（不经过 pnpm）时 PATH 中没有 node_modules/.bin
const windows = process.platform === 'win32'
const tscName = windows ? 'tsc.cmd' : 'tsc'
const localTsc = path.join(pkgRoot, 'node_modules', '.bin', tscName)
const tsc = existsSync(localTsc) ? (windows ? `"${localTsc}"` : localTsc) : tscName
const r = spawnSync(tsc, ['-p', path.join(pkgRoot, 'tsconfig.build.json')], {
  cwd: pkgRoot,
  stdio: 'inherit',
  shell: windows,
})
if (r.status !== 0) throw new Error('输出声明文件失败（tsc）')

/** 声明文件中的相对导入：`from './x.tsx'`、`import('../y.ts')`。 */
const RELATIVE_TS_IMPORT = /((?:\bfrom\s*|\bimport\s*\(\s*)(['"])\.{1,2}\/[^'"]*?)\.tsx?(\2)/g
const SIDE_EFFECT_CSS_IMPORT = /^import\s+(['"])\.{1,2}\/[^'"]+\.css\1;?\r?\n/gm

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const f = path.join(dir, name)
    return statSync(f).isDirectory() ? walk(f) : [f]
  })
}

const declarations = walk(outDir).filter((f) => f.endsWith('.d.ts'))
for (const f of declarations) {
  const text = readFileSync(f, 'utf8')
  const next = text.replace(RELATIVE_TS_IMPORT, '$1.js$3').replace(SIDE_EFFECT_CSS_IMPORT, '')
  if (next !== text) writeFileSync(f, next)
}

const files = walk(outDir)
const size = files.reduce((n, f) => n + statSync(f).size, 0)
console.log(
  `vellum-ui 已构建到 dist/：${files.length} 个文件（其中声明 ${declarations.length} 个），共 ${(size / 1024).toFixed(1)} KiB`,
)
