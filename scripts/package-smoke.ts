/**
 * 消费指定的 pnpm tarball，不读取源码入口、不重新构建、不安装依赖。
 * 临时使用方只链接已安装的依赖；vellum-ui 本身始终来自传入的压缩包。
 *
 *   1. 发布产物：清单与文件（release.ts）、相对导入都能解析；三个入口共用一份核心模块（checkSharedContexts）。
 *   2. 只用核心入口的使用方：只链接 dependencies 与必需的 peer 依赖，可选的 echarts、@ant-design/x-markdown 解析不到；
 *      类型检查与打包都通过，打包结果不含图表与 AI 的模块。引用 `vellum-ui/charts` 时打包失败（可选依赖确实缺席）。
 *   3. 用全部入口的使用方：再链接可选的 peer 依赖，三个入口与按入口的样式一起类型检查、打包；图表引擎与 Markdown
 *      渲染器是按需加载的分块，打包结果中每个 React 上下文只创建一次。
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from '@typescript/typescript6'
import { build } from 'vite'
import { checkPacked } from './release.ts'

const pkgRoot = fileURLToPath(new URL('..', import.meta.url))
const tarball = process.argv[2]
assert(tarball && process.argv.length === 3, '用法：pnpm test:package /absolute/path/package.tgz')
const temp = mkdtempSync(path.join(tmpdir(), 'vellum-package-smoke-'))

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const file = path.join(dir, name)
    return statSync(file).isDirectory() ? walk(file) : [file]
  })
}

/**
 * JS 按真实路径检查，声明按 TS 的扩展名替换规则检查（./x.js 应有 ./x.d.ts）。`optional`：没有相对导入也通过
 * （没有按需加载分块的打包结果）。
 */
function checkImports(dist: string, optional = false): void {
  let imports = 0
  const missing: string[] = []
  const files = walk(dist).filter((file) => file.endsWith('.js') || file.endsWith('.d.ts'))
  for (const file of files) {
    // TS 的预处理器同时识别静态导入、再导出、import() 和声明里的 import 类型。
    const { importedFiles } = ts.preProcessFile(readFileSync(file, 'utf8'), true, true)
    for (const { fileName: specifier } of importedFiles) {
      if (!specifier.startsWith('./') && !specifier.startsWith('../')) continue
      imports++
      const target = file.endsWith('.d.ts')
        ? ts.resolveModuleName(
            specifier,
            file,
            { module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext },
            ts.sys,
          ).resolvedModule?.resolvedFileName
        : fileURLToPath(new URL(specifier, pathToFileURL(file)))
      if (
        !target ||
        !ts.sys.fileExists(target) ||
        (file.endsWith('.d.ts') && target.endsWith('.js'))
      )
        missing.push(`${path.relative(dist, file)} -> ${specifier}`)
    }
  }
  assert.equal(missing.length, 0, `发布产物存在无法解析的相对导入：\n${missing.join('\n')}`)
  assert(optional || imports > 0, '没有检查到相对导入')
  console.log(`相对导入通过：${files.length} 个 JS / 声明文件，${imports} 个引用（含懒加载）`)
}

/**
 * 创建 React 上下文的语句：发布产物中是 `var ThemeBaseContext = createContext(null)`；使用方的打包结果中 React 是
 * CommonJS，调用写成 `(0, import_react.createContext)(null)`。
 */
const CONTEXT =
  /\b(?:var|let|const)\s+([\w$]+)\s*=\s*(?:\/\*[^*]*\*\/\s*)?(?:\(0,\s*)?(?:[\w$]+\.)?createContext\)?\s*\(/g

/** 从入口出发按相对路径（静态导入、再导出、import()）可达的 JS 文件。 */
function reachable(dist: string, entry: string): Set<string> {
  const seen = new Set<string>()
  const visit = (file: string) => {
    if (seen.has(file)) return
    seen.add(file)
    for (const { fileName } of ts.preProcessFile(readFileSync(file, 'utf8'), true, true)
      .importedFiles)
      if (fileName.startsWith('./') || fileName.startsWith('../'))
        visit(fileURLToPath(new URL(fileName, pathToFileURL(file))))
  }
  visit(path.join(dist, entry))
  return seen
}

/**
 * 三个入口共用一份核心：每个 React 上下文只在一个模块中创建（没有被打包进入口的副本），入口文件只转出；
 * `vellum-ui/charts` 与 `vellum-ui/ai` 按相对路径导入核心的主题与文本上下文（与核心入口是同一个文件）；
 * 两个功能入口可达的上下文要么是核心入口也可达的同一个模块，要么是它们自己目录中的内部上下文。
 */
function checkSharedContexts(dist: string): void {
  const defined = new Map<string, string[]>()
  for (const file of walk(dist).filter((f) => f.endsWith('.js')))
    for (const [, name] of readFileSync(file, 'utf8').matchAll(CONTEXT))
      defined.set(name as string, [
        ...(defined.get(name as string) ?? []),
        path.relative(dist, file),
      ])
  const duplicated = [...defined].filter(([, files]) => files.length > 1)
  assert.deepEqual(duplicated, [], '同一个上下文在多个文件中创建')
  const at = (name: string) => defined.get(name)?.[0]
  assert.equal(at('ThemeBaseContext'), 'theme/context.js', '主题上下文不在 theme/context.js')
  assert.equal(at('MessagesContext'), 'i18n/index.js', '文本上下文不在 i18n/index.js')
  const contextFiles = new Set([...defined.values()].flat())
  for (const entry of ['index.js', 'charts.js', 'ai.js'])
    assert(!contextFiles.has(entry), `入口 ${entry} 自己创建了上下文`)
  const rel = (files: Set<string>) => new Set([...files].map((f) => path.relative(dist, f)))
  const core = rel(reachable(dist, 'index.js'))
  for (const [entry, own] of [
    ['charts.js', 'components/charts/'],
    ['ai.js', 'components/ai/'],
  ] as const) {
    const feature = rel(reachable(dist, entry))
    for (const shared of ['theme/context.js', 'i18n/index.js'])
      assert(feature.has(shared), `${entry} 没有按相对路径导入 ${shared}`)
    const foreign = [...feature].filter(
      (f) => contextFiles.has(f) && !core.has(f) && !f.startsWith(own),
    )
    assert.deepEqual(foreign, [], `${entry} 可达的上下文不是核心的同一个模块`)
    assert(
      [...feature].every(
        (f) => !readFileSync(path.join(dist, f), 'utf8').includes("from 'vellum-ui"),
      ),
      `${entry} 的模块按包名导入了自身`,
    )
  }
  console.log(
    `共用一份核心：${defined.size} 个上下文各在一个模块中创建，charts 与 ai 按相对路径导入 theme/context.js 与 i18n/index.js`,
  )
}

/** 按 NodeNext 与 Bundler 两种模块解析检查使用方的类型。 */
function typecheck(dir: string, file: string): void {
  for (const resolution of ['NodeNext', 'Bundler']) {
    const config = path.join(dir, `tsconfig.${resolution}.json`)
    writeFileSync(
      config,
      JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          lib: ['ES2022', 'DOM', 'DOM.Iterable'],
          module: resolution === 'NodeNext' ? 'NodeNext' : 'ESNext',
          moduleResolution: resolution,
          jsx: 'react-jsx',
          strict: true,
          skipLibCheck: true,
          noEmit: true,
          types: ['react', 'react-dom'],
        },
        files: [file, 'styles.d.ts'],
      }),
    )
    const windows = process.platform === 'win32'
    const tsc = path.join(pkgRoot, 'node_modules', '.bin', windows ? 'tsc.cmd' : 'tsc')
    const result = spawnSync(windows ? `"${tsc}"` : tsc, ['-p', config], {
      cwd: dir,
      stdio: 'inherit',
      shell: windows,
    })
    assert.equal(result.status, 0, result.error ?? `${file}：${resolution} 使用方类型检查失败`)
    console.log(`使用方类型检查通过：${file}，${resolution}`)
  }
}

/**
 * 像使用方的应用一样打包（Vite），返回 JS 分块与样式的大小；输出中的相对导入都能解析。`quiet`：预期失败的打包
 * 不输出日志。
 */
async function bundle(dir: string, file: string, out: string, quiet = false) {
  const result = await build({
    root: dir,
    configFile: false,
    publicDir: false,
    logLevel: quiet ? 'silent' : 'warn',
    build: {
      outDir: path.join(dir, out),
      target: 'es2022',
      minify: false,
      rolldownOptions: {
        input: path.join(dir, file),
        // 使用方是浏览器应用，不保留依赖的 RSC 指令；其他打包警告照常报告。
        onwarn(warning, warn) {
          if (warning.code !== 'MODULE_LEVEL_DIRECTIVE') warn(warning)
        },
      },
    },
  })
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((item) =>
    'output' in item ? item.output : [],
  )
  checkImports(path.join(dir, out), true)
  return {
    chunks: outputs.filter((item) => item.type === 'chunk'),
    css: outputs
      .filter((item) => item.type === 'asset' && item.fileName.endsWith('.css'))
      .reduce((n, item) => n + (item.type === 'asset' ? item.source.length : 0), 0),
  }
}

try {
  const extracted = spawnSync('tar', ['-xzf', path.resolve(tarball), '-C', temp], {
    stdio: 'inherit',
  })
  assert.equal(extracted.status, 0, extracted.error ?? '解压 tarball 失败')
  const modules = path.join(temp, 'node_modules')
  mkdirSync(modules)
  const packedRoot = path.join(modules, 'vellum-ui')
  renameSync(path.join(temp, 'package'), packedRoot)
  const manifest = JSON.parse(readFileSync(path.join(packedRoot, 'package.json'), 'utf8'))
  checkPacked(
    manifest,
    (file) =>
      ts.sys.fileExists(path.join(packedRoot, file)) ||
      ts.sys.directoryExists(path.join(packedRoot, file)),
  )
  checkImports(path.join(packedRoot, 'dist'))

  checkSharedContexts(path.join(packedRoot, 'dist'))

  // 不用 pnpm install，也不链接整个 node_modules（避免把源码包当成使用方依赖）。
  const optional = Object.entries(
    (manifest.peerDependenciesMeta ?? {}) as Record<string, { optional?: boolean }>,
  )
    .filter(([, meta]) => meta.optional)
    .map(([name]) => name)
  assert.deepEqual(optional.sort(), ['@ant-design/x-markdown', 'echarts'], '可选的 peer 依赖')
  const link = (name: string) => {
    const target = path.join(modules, name)
    mkdirSync(path.dirname(target), { recursive: true })
    symlinkSync(path.join(pkgRoot, 'node_modules', name), target, 'junction')
  }
  for (const name of new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}).filter((name) => !optional.includes(name)),
    '@types',
  ]))
    link(name)
  writeFileSync(path.join(temp, 'package.json'), JSON.stringify({ private: true, type: 'module' }))
  // CSS 类型通常由使用方的 vite/client 提供；实际路径和内容由后面的打包检查验证。
  writeFileSync(
    path.join(temp, 'styles.d.ts'),
    ['styles', 'core', 'charts', 'ai']
      .map((name) => `declare module 'vellum-ui/${name}.css' {}\n`)
      .join(''),
  )
  const distFile = (file: string) => path.join(packedRoot, 'dist', file).split(path.sep).join('/')
  const css = (name: string) => readFileSync(path.join(packedRoot, 'dist', `${name}.css`), 'utf8')
  assert.equal(
    css('styles'),
    css('core') + css('charts') + css('ai'),
    'styles.css 不等于 core.css、charts.css、ai.css 依次合并',
  )

  // —— 只用核心入口：可选依赖不安装 ——
  const consumerRequire = createRequire(path.join(temp, 'package.json'))
  for (const name of optional) {
    assert(!existsSync(path.join(modules, name)), `只用核心的使用方不应安装 ${name}`)
    assert.throws(() => consumerRequire.resolve(name), `只用核心的使用方不应能解析 ${name}`)
  }
  writeFileSync(
    path.join(temp, 'core.tsx'),
    `import { Plus } from 'lucide-react'
import { createRoot } from 'react-dom/client'
import {
  Button,
  Drawer,
  FilePreview,
  IconButton,
  Statistic,
  ThemeProvider,
  type ButtonProps,
  type ValueFormat,
} from 'vellum-ui'
import 'vellum-ui/core.css'

const action: ButtonProps = { children: 'Open preview' }
const format: ValueFormat = 'compact'
const container = document.createElement('div')
document.body.appendChild(container)
createRoot(container).render(
  <ThemeProvider defaultColorMode="light">
    <Button {...action} icon={Plus} />
    <IconButton icon="close" label="Close" />
    <Statistic label="Projects" value={1284} format={format} />
    <Drawer open title="Details" onClose={() => {}}>
      <FilePreview.Inline item={{ id: 'notes', name: 'notes.md', content: '# Notes' }} />
    </Drawer>
  </ThemeProvider>,
)
`,
  )
  typecheck(temp, 'core.tsx')
  const core = await bundle(temp, 'core.tsx', 'bundle-core')
  const coreIds = core.chunks.flatMap((chunk) => chunk.moduleIds)
  assert.deepEqual(
    coreIds.filter((id) =>
      /\/(echarts|zrender|@ant-design\/x-markdown)\/|\/dist\/components\/(charts|ai)\//.test(id),
    ),
    [],
    '只用核心入口的打包结果含有图表或 AI 的模块',
  )
  assert(core.css > 0, '只用核心入口时没有输出样式')
  // 对照：没有安装 echarts 时引用图表入口，打包器报错（可选依赖确实缺席）
  writeFileSync(
    path.join(temp, 'charts-only.ts'),
    "import { LineChart } from 'vellum-ui/charts'\nconsole.log(LineChart)\n",
  )
  await assert.rejects(
    bundle(temp, 'charts-only.ts', 'bundle-charts-only', true),
    /echarts/,
    '没有 echarts 时图表入口也打包成功了',
  )
  console.log(
    '只用核心入口的使用方通过：没有 echarts 与 @ant-design/x-markdown，类型检查与打包通过',
  )

  // —— 全部入口：安装可选依赖 ——
  for (const name of optional) link(name)
  writeFileSync(
    path.join(temp, 'full.tsx'),
    `import { createRoot } from 'react-dom/client'
import { ThemeProvider, type ValueFormat } from 'vellum-ui'
import { Markdown, MessageList, type SourceItem } from 'vellum-ui/ai'
import { LineChart, type ChartSeries } from 'vellum-ui/charts'
import 'vellum-ui/core.css'
import 'vellum-ui/charts.css'
import 'vellum-ui/ai.css'

const series: ChartSeries<'visits'>[] = [{ key: 'visits', name: 'Visits' }]
const format: ValueFormat = 'auto'
const sources: SourceItem[] = [{ title: 'Guide', url: 'https://example.com/guide' }]
const container = document.createElement('div')
document.body.appendChild(container)
createRoot(container).render(
  <ThemeProvider defaultColorMode="light">
    <LineChart
      title="Visits"
      data={[{ month: 'Jan', visits: 4200 }]}
      x="month"
      series={series}
      format={format}
    />
    <MessageList
      items={['**Package preview** [1]']}
      getKey={(item) => item}
      renderItem={(item) => <Markdown content={item} sources={sources} />}
    />
  </ThemeProvider>,
)
`,
  )
  typecheck(temp, 'full.tsx')
  const full = await bundle(temp, 'full.tsx', 'bundle-full')
  assert(full.css > 0, '全部入口时没有输出样式')
  assert(
    full.chunks.some((chunk) => chunk.dynamicImports.length > 0),
    '没有输出懒加载引用',
  )
  const lazyFrom = (file: string) =>
    full.chunks.some((chunk) => !chunk.isEntry && chunk.moduleIds.includes(distFile(file)))
  assert(
    lazyFrom('components/ai/markdown-renderer.js'),
    '没有从 tarball 打包 Markdown 的懒加载渲染器',
  )
  assert(lazyFrom('components/charts/engine-line.js'), '没有从 tarball 打包图表引擎的懒加载分块')
  // 每个上下文在使用方的打包结果中只创建一次（核心与两个功能入口共用）
  const created = full.chunks.flatMap((chunk) =>
    [...chunk.code.matchAll(CONTEXT)].map((m) => (m[1] as string).replace(/\$\d+$/, '')),
  )
  for (const name of ['ThemeBaseContext', 'DensityContext', 'CssVarsContext', 'MessagesContext'])
    assert.equal(created.filter((c) => c === name).length, 1, `打包结果中 ${name} 不止一个`)
  console.log('全部入口的使用方通过：类型检查与打包通过，每个上下文只创建一次')
  console.log(`tarball 使用方冒烟测试通过：${path.resolve(tarball)}`)
} finally {
  rmSync(temp, { recursive: true, force: true })
}
