/**
 * 消费指定的 pnpm tarball，不读取源码入口、不重新构建、不安装依赖。
 * 临时使用方只链接已安装的依赖；vellum-ui 本身始终来自传入的压缩包。
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
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

/** JS 按真实路径检查，声明按 TS 的扩展名替换规则检查（./x.js 应有 ./x.d.ts）。 */
function checkImports(dist: string): void {
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
  assert(imports > 0, '没有检查到相对导入')
  console.log(`相对导入通过：${files.length} 个 JS / 声明文件，${imports} 个引用（含懒加载）`)
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

  // 不用 pnpm install，也不链接整个 node_modules（避免把源码包当成使用方依赖）。
  for (const name of new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
    '@types',
  ])) {
    const target = path.join(modules, name)
    mkdirSync(path.dirname(target), { recursive: true })
    symlinkSync(path.join(pkgRoot, 'node_modules', name), target, 'junction')
  }
  writeFileSync(path.join(temp, 'package.json'), JSON.stringify({ private: true, type: 'module' }))
  // CSS 类型通常由使用方的 vite/client 提供；实际路径和内容由后面的打包检查验证。
  writeFileSync(path.join(temp, 'styles.d.ts'), "declare module 'vellum-ui/styles.css' {}\n")
  writeFileSync(
    path.join(temp, 'consumer.tsx'),
    `import { createRoot } from 'react-dom/client'
import { Button, Drawer, Markdown, ThemeProvider, type ButtonProps } from 'vellum-ui'
import 'vellum-ui/styles.css'

const action: ButtonProps = { children: 'Open preview' }
const container = document.createElement('div')
document.body.appendChild(container)
createRoot(container).render(
  <ThemeProvider defaultColorMode="light">
    <Button {...action} />
    <Drawer open title="Details" onClose={() => {}}>
      <Markdown content="**Package preview**" />
    </Drawer>
  </ThemeProvider>,
)
`,
  )

  for (const resolution of ['NodeNext', 'Bundler']) {
    const config = path.join(temp, `tsconfig.${resolution}.json`)
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
        files: ['consumer.tsx', 'styles.d.ts'],
      }),
    )
    const windows = process.platform === 'win32'
    const tsc = path.join(pkgRoot, 'node_modules', '.bin', windows ? 'tsc.cmd' : 'tsc')
    const result = spawnSync(windows ? `"${tsc}"` : tsc, ['-p', config], {
      cwd: temp,
      stdio: 'inherit',
      shell: windows,
    })
    assert.equal(result.status, 0, result.error ?? `${resolution} 使用方类型检查失败`)
    console.log(`使用方类型检查通过：${resolution}`)
  }

  const result = await build({
    root: temp,
    configFile: false,
    publicDir: false,
    logLevel: 'warn',
    build: {
      outDir: path.join(temp, 'bundle'),
      target: 'es2022',
      minify: false,
      rolldownOptions: {
        input: path.join(temp, 'consumer.tsx'),
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
  assert(
    outputs.some(
      (item) => item.type === 'asset' && item.fileName.endsWith('.css') && item.source.length > 0,
    ),
    '使用方样式没有输出',
  )
  const chunks = outputs.filter((item) => item.type === 'chunk')
  assert(
    chunks.some((chunk) => chunk.dynamicImports.length > 0),
    '没有输出懒加载引用',
  )
  assert(
    chunks.some(
      (chunk) =>
        !chunk.isEntry &&
        chunk.moduleIds.some(
          (id) =>
            id ===
            path
              .join(packedRoot, 'dist/components/ai/markdown-renderer.js')
              .split(path.sep)
              .join('/'),
        ),
    ),
    '没有从 tarball 打包 Markdown 的懒加载渲染器',
  )
  checkImports(path.join(temp, 'bundle'))
  console.log(`tarball 使用方冒烟测试通过：${path.resolve(tarball)}`)
} finally {
  rmSync(temp, { recursive: true, force: true })
}
