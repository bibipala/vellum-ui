/**
 * 构建发布产物 dist/（`pnpm build`）。本包在工作区内开发时不需要构建：package.json 的 `exports` 指向源码，
 * 打包发布时由 `publishConfig` 改为指向 dist。
 *
 *   1. Vite 库模式：src 的每个模块输出为一个 ESM 文件（保留模块结构，使用方的打包器可以按导出 tree-shaking）；
 *      dependencies 与 peerDependencies（含子路径，如 `antd/locale/…`、`react/jsx-runtime`）不打包；
 *      CSS Modules 与必需的 base.css 编译后合并为 `dist/styles.css`，JS 中不再引用 CSS（由使用方导入一次）。
 *   2. 可选样式 global.css、fonts.css 原样复制（fonts.css 对字体包的 @import 交给使用方的打包器解析）。
 *   3. tsc 输出声明文件（不带 Node 类型，保证声明只依赖 DOM 与本包的依赖），再把声明中相对导入的扩展名
 *      `.ts` / `.tsx` 改为 `.js`，与 JS 产物的文件名一致（tsc 输出声明时保留源码中的扩展名）。
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
import { build } from 'vite'

const pkgRoot = fileURLToPath(new URL('..', import.meta.url))
const srcDir = path.join(pkgRoot, 'src')
const outDir = path.join(pkgRoot, 'dist')

const pkg = JSON.parse(readFileSync(path.join(pkgRoot, 'package.json'), 'utf8')) as {
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}
const externals = Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies })
const isExternal = (id: string) => externals.some((d) => id === d || id.startsWith(`${d}/`))

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
    lib: {
      entry: path.join(srcDir, 'index.ts'),
      formats: ['es'],
      cssFileName: 'styles',
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

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const f = path.join(dir, name)
    return statSync(f).isDirectory() ? walk(f) : [f]
  })
}

const declarations = walk(outDir).filter((f) => f.endsWith('.d.ts'))
for (const f of declarations) {
  const text = readFileSync(f, 'utf8')
  const next = text.replace(RELATIVE_TS_IMPORT, '$1.js$3')
  if (next !== text) writeFileSync(f, next)
}

const files = walk(outDir)
const size = files.reduce((n, f) => n + statSync(f).size, 0)
console.log(
  `vellum-ui 已构建到 dist/：${files.length} 个文件（其中声明 ${declarations.length} 个），共 ${(size / 1024).toFixed(1)} KiB`,
)
