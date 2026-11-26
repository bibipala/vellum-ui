/**
 * Public API reports: one API Extractor report per entry point, committed as `etc/vellum-ui.api.md` (`vellum-ui`),
 * `etc/vellum-ui-charts.api.md` (`vellum-ui/charts`) and `etc/vellum-ui-ai.api.md` (`vellum-ui/ai`), so that
 * changes of the public API show up in reviews and follow semantic versioning.
 *
 *   pnpm api:update   regenerate the report (after an intended change of the public API)
 *   pnpm api:check    fail when the report is out of date (part of `pnpm check`)
 *
 * The declarations are emitted once with the project's own tsc into `.api-tmp/`, then analyzed by API Extractor
 * from each entry. A report must not contain types of the implementation libraries (antd, @ant-design/*, rc-*, dayjs): the public
 * API is declared by the library itself.
 *
 * The report also contains the unexported declarations that the public API refers to (shown without `export`):
 * the `<Name>OwnProps` interfaces, `NativeProps`, the mode interfaces behind union props, the icon names behind
 * `IconName`. They are part of the public contract although the entry point does not export them, so a change to
 * them must change the report too. The reports of `vellum-ui/charts` and `vellum-ui/ai` therefore also show the
 * declarations of the core entry that their API uses (such as `BaseProps` or `ValueFormat`), without `export`.
 * test/api-report.test.ts checks that each report declares every name it uses.
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

/** Entry points: the declaration file emitted from src/, the package subpath and the report file. */
const API_ENTRIES = [
  { dts: 'index.d.ts', name: 'vellum-ui', report: 'vellum-ui.api.md' },
  { dts: 'charts.d.ts', name: 'vellum-ui/charts', report: 'vellum-ui-charts.api.md' },
  { dts: 'ai.d.ts', name: 'vellum-ui/ai', report: 'vellum-ui-ai.api.md' },
] as const

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

// 2. API Extractor, once per entry
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
    files: API_ENTRIES.map((e) => path.join(tmp, 'dts', e.dts)),
  }),
)
mkdirSync(reportFolder, { recursive: true })
// API Extractor writes each report into the temporary folders; this script compares it with the committed one and
// updates etc/ itself, so that the header can name the entry
const generatedFolder = path.join(tmp, 'reports')
const reportTempFolder = path.join(tmp, 'report')
mkdirSync(generatedFolder, { recursive: true })

let failed = false
for (const { dts, name, report } of API_ENTRIES) {
  const config = ExtractorConfig.prepare({
    configObjectFullPath: path.join(tmp, 'api-extractor.json'),
    packageJsonFullPath: path.join(root, 'package.json'),
    configObject: {
      projectFolder: root,
      mainEntryPointFilePath: path.join(tmp, 'dts', dts),
      compiler: { tsconfigFilePath: extractTsconfig },
      apiReport: {
        enabled: true,
        reportFileName: report,
        reportFolder: generatedFolder,
        reportTempFolder,
        // Unexported declarations reachable from the entry point are part of the contract: report them as well
        includeForgottenExports: true,
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
          // Unexported own props are the convention (CONTRIBUTING.md); includeForgottenExports reports them anyway
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
    localBuild: true,
    showVerboseMessages: false,
    messageCallback: (m) => {
      // The reports are compared and copied below; the temporary folder starts empty on every run
      if (m.messageId.startsWith('console-api-report-')) m.handled = true
    },
  })

  // The header names the entry: API Extractor knows only the package name
  const generated = readFileSync(path.join(reportTempFolder, report), 'utf8').replace(
    /^## API Report File for "vellum-ui"$/m,
    `## API Report File for "${name}"`,
  )
  const committedPath = path.join(reportFolder, report)
  const changed = !existsSync(committedPath) || readFileSync(committedPath, 'utf8') !== generated
  if (!result.succeeded) {
    failed = true
    console.error(`API Extractor reported errors for ${name}`)
  } else if (check && changed) {
    failed = true
    console.error(
      `The public API of ${name} changed: etc/${report}. If the change is intended, run pnpm api:update and describe it in the commit message`,
    )
  } else if (changed) {
    writeFileSync(committedPath, generated)
    console.log(`Updated etc/${report}`)
  }

  // 3. No types of the implementation libraries in the public API
  const isImplementation = (specifier: string) =>
    /^(antd|dayjs)(\/|$)|^(@ant-design|@rc-component)\/|^rc-/.test(specifier)
  const leaked = [...generated.matchAll(/^import .* from (['"])([^'"]+)\1;$/gm)].filter((m) =>
    isImplementation(m[2] ?? ''),
  )
  if (leaked.length) {
    failed = true
    console.error(
      `The public API of ${name} contains types of the implementation libraries (declare the library's own types instead):\n  ${leaked.map((m) => m[0]).join('\n  ')}`,
    )
  }
}
rmSync(tmp, { recursive: true, force: true })
if (!failed) console.log(check ? 'The API reports are up to date' : 'The API reports are generated')
process.exit(failed ? 1 : 0)
