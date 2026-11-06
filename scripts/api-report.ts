/**
 * Public API report: an API Extractor report of the entry point, committed as `etc/vellum-ui.api.md`, so that
 * changes of the public API show up in reviews and follow semantic versioning.
 *
 *   pnpm api:update   regenerate the report (after an intended change of the public API)
 *   pnpm api:check    fail when the report is out of date (part of `pnpm check`)
 *
 * The declarations are emitted with the project's own tsc into `.api-tmp/`, then analyzed by API Extractor.
 * The report must not contain types of the implementation libraries (antd, Ant Design X, rc-*, dayjs): the public
 * API is declared by the library itself.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const require = createRequire(path.join(root, 'package.json'))
const { Extractor, ExtractorConfig, ExtractorLogLevel } =
  require('@microsoft/api-extractor') as typeof import('@microsoft/api-extractor')
const check = process.argv.includes('--check')
const tmp = path.join(root, '.api-tmp')
const reportFolder = path.join(root, 'etc')
const reportFileName = 'vellum-ui.api.md'

// 1. Declarations of src/ with the project's tsc
rmSync(tmp, { recursive: true, force: true })
mkdirSync(tmp, { recursive: true })
const emitConfig = path.join(tmp, 'tsconfig.emit.json')
writeFileSync(
  emitConfig,
  JSON.stringify({
    extends: '../tsconfig.json',
    compilerOptions: {
      noEmit: false,
      declaration: true,
      emitDeclarationOnly: true,
      rootDir: '../src',
      outDir: './dts',
    },
    include: ['../src'],
  }),
)
const bin = path.join(
  root,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'tsc.cmd' : 'tsc',
)
const tsc = spawnSync(existsSync(bin) ? bin : 'tsc', ['-p', emitConfig], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})
if (tsc.status !== 0) throw new Error('Emitting the declarations failed')

// 2. API Extractor
const entry = path.join(tmp, 'dts', 'index.d.ts')
const extractTsconfig = path.join(tmp, 'tsconfig.extract.json')
writeFileSync(
  extractTsconfig,
  JSON.stringify({
    compilerOptions: {
      target: 'es2022',
      module: 'esnext',
      moduleResolution: 'bundler',
      allowImportingTsExtensions: true,
      noEmit: true,
      strict: true,
      skipLibCheck: true,
      jsx: 'react-jsx',
      lib: ['es2023', 'dom', 'dom.iterable'],
      types: ['node'],
    },
    files: [entry],
  }),
)
mkdirSync(reportFolder, { recursive: true })
const config = ExtractorConfig.prepare({
  configObjectFullPath: path.join(tmp, 'api-extractor.json'),
  packageJsonFullPath: path.join(root, 'package.json'),
  configObject: {
    projectFolder: root,
    mainEntryPointFilePath: entry,
    compiler: { tsconfigFilePath: extractTsconfig },
    apiReport: {
      enabled: true,
      reportFileName,
      reportFolder,
      reportTempFolder: path.join(tmp, 'report'),
    },
    docModel: { enabled: false },
    dtsRollup: { enabled: false },
    tsdocMetadata: { enabled: false },
    newlineKind: 'lf',
    messages: {
      compilerMessageReporting: { default: { logLevel: ExtractorLogLevel.Warning } },
      // The report is for signature changes; TSDoc completeness is checked by docs:check
      extractorMessageReporting: {
        default: { logLevel: ExtractorLogLevel.Warning, addToApiReportFile: false },
        'ae-missing-release-tag': { logLevel: ExtractorLogLevel.None },
        'ae-forgotten-export': { logLevel: ExtractorLogLevel.None },
        'ae-internal-missing-underscore': { logLevel: ExtractorLogLevel.None },
        'ae-unresolved-link': { logLevel: ExtractorLogLevel.None },
        'ae-undocumented': { logLevel: ExtractorLogLevel.None },
      },
      tsdocMessageReporting: { default: { logLevel: ExtractorLogLevel.None } },
    },
  },
})
const result = Extractor.invoke(config, {
  localBuild: !check,
  showVerboseMessages: false,
  messageCallback: (m) => {
    if (m.messageId === 'console-api-report-changed' || m.messageId === 'console-api-report-copied')
      m.handled = true
  },
})
rmSync(tmp, { recursive: true, force: true })

let failed = false
if (check && result.apiReportChanged) {
  failed = true
  console.error(
    `The public API changed: etc/${reportFileName}. If the change is intended, run pnpm api:update and describe it in the commit message`,
  )
} else if (!result.succeeded) {
  failed = true
  console.error('API Extractor reported errors')
} else if (result.apiReportChanged) console.log(`Updated etc/${reportFileName}`)

// 3. No types of the implementation libraries in the public API
const isImplementation = (specifier: string) =>
  /^(antd|dayjs)(\/|$)|^(@ant-design|@rc-component)\/|^rc-/.test(specifier)
const leaked = [
  ...readFileSync(path.join(reportFolder, reportFileName), 'utf8').matchAll(
    /^import .* from (['"])([^'"]+)\1;$/gm,
  ),
].filter((m) => isImplementation(m[2] ?? ''))
if (leaked.length) {
  failed = true
  console.error(
    `The public API contains types of the implementation libraries (declare the library's own types instead):\n  ${leaked.map((m) => m[0]).join('\n  ')}`,
  )
}
if (!failed) console.log(check ? 'The API report is up to date' : 'The API report is generated')
process.exit(failed ? 1 : 0)
