/**
 * 公共 API 报告（scripts/api-report.ts 生成、提交为 etc/vellum-ui.api.md）要覆盖完整的公共契约：导出的类型继承或引用的
 * 不导出声明（`<名称>OwnProps`、`NativeProps`、联合属性的各个模式、`IconName` 背后的图标表）也要写进报告，否则改动
 * 它们时报告不变，`pnpm api:check` 发现不了。
 */
import { spawnSync } from 'node:child_process'
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from '@typescript/typescript6'
import { afterEach, describe, expect, it } from 'vitest'

const pkgRoot = fileURLToPath(new URL('..', import.meta.url))
const REPORT = 'etc/vellum-ui.api.md'
const committed = readFileSync(path.join(pkgRoot, REPORT), 'utf8')

/** 名称无法解析的诊断：报告用到了一个它既没有声明、也没有导入的名称。 */
const UNRESOLVED = new Set([
  2304, // Cannot find name
  2305, // Module has no exported member
  2307, // Cannot find module
  2503, // Cannot find namespace
  2552, // Cannot find name. Did you mean
  2614, // Module has no exported member. Did you mean to use `import x from`
  2694, // Namespace has no exported member
  2724, // Module has no exported member named. Did you mean
])

/** 报告的 ts 代码块中无法解析的名称（按 .d.ts 检查，依赖从本仓库的 node_modules 解析）。 */
function unresolvedNames(code: string): string[] {
  // 虚拟文件，不写入磁盘；放在仓库下，导入的 react、lucide-react 从这里开始解析
  const file = path.join(pkgRoot, 'etc', 'api-report.check.d.ts').replaceAll(path.sep, '/')
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    lib: ['lib.es2023.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
    types: [],
    strict: true,
    noEmit: true,
  }
  const host = ts.createCompilerHost(options)
  const { fileExists, readFile, getSourceFile } = host
  host.fileExists = (name) => name === file || fileExists(name)
  host.readFile = (name) => (name === file ? code : readFile(name))
  host.getSourceFile = (name, language, ...rest) =>
    name === file
      ? ts.createSourceFile(name, code, language)
      : getSourceFile(name, language, ...rest)
  const program = ts.createProgram([file], options, host)
  return ts
    .getPreEmitDiagnostics(program, program.getSourceFile(file))
    .filter((d) => UNRESOLVED.has(d.code))
    .map((d) => ts.flattenDiagnosticMessageText(d.messageText, ' '))
}

function codeOf(report: string): string {
  const code = /^```ts\n([\s\S]*?)^```$/m.exec(report)?.[1]
  if (!code) throw new Error(`${REPORT} has no ts code block`)
  return code
}

/** 报告中以 `header` 开头的那条声明，到它的右花括号为止。 */
function declaration(report: string, header: string): string {
  const start = report.indexOf(`\n${header}\n`)
  if (start < 0) throw new Error(`${header} is not in the report`)
  return report.slice(start + 1, report.indexOf('\n}', start) + 2)
}

const copies: string[] = []

/** 生成报告所需的最小副本：源码、脚本、已提交的报告，node_modules 链接到本仓库。 */
function copyProject(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'vellum-api-report-'))
  copies.push(dir)
  for (const entry of ['src', 'scripts/api-report.ts', REPORT, 'package.json', 'tsconfig.json'])
    cpSync(path.join(pkgRoot, entry), path.join(dir, entry), { recursive: true })
  symlinkSync(path.join(pkgRoot, 'node_modules'), path.join(dir, 'node_modules'), 'junction')
  return dir
}

/** 把副本中 `file` 里唯一的一处 `from` 换成 `to`。 */
function edit(dir: string, file: string, from: string, to: string) {
  const full = path.join(dir, file)
  const text = readFileSync(full, 'utf8')
  expect(text.split(from).length - 1, `${file} contains the edited text once`).toBe(1)
  writeFileSync(
    full,
    text.replace(from, () => to),
  )
}

function apiReport(dir: string, ...args: string[]) {
  const run = spawnSync(process.execPath, ['scripts/api-report.ts', ...args], {
    cwd: dir,
    encoding: 'utf8',
  })
  return { status: run.status, output: `${run.stdout}${run.stderr}` }
}

afterEach(() => {
  for (const dir of copies.splice(0)) {
    unlinkSync(path.join(dir, 'node_modules')) // 只删链接，不进入本仓库的 node_modules
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('公共 API 报告', () => {
  it('声明了它用到的每个名称', () => {
    expect(unresolvedNames(codeOf(committed))).toEqual([])
  })

  it('能发现报告用到却没有声明的名称', () => {
    // 修复前的报告就是这样：ButtonProps 继承的 ButtonOwnProps 不在报告里
    const names = unresolvedNames(
      'export interface ButtonProps extends ButtonOwnProps {}\nexport type IconName = keyof typeof registry;\n',
    )
    expect(names.join('\n')).toMatch(/'ButtonOwnProps'/)
    expect(names.join('\n')).toMatch(/'registry'/)
  })

  it('不导出的声明改动时 api:check 失败，更新后的报告只多出这些改动', () => {
    const dir = copyProject()
    // 继承的属性：Button 不导出的 ButtonOwnProps 多一个属性
    edit(
      dir,
      'src/components/basic.tsx',
      '  readonly loading?: boolean\n',
      '  readonly loading?: boolean\n  /** Probe. */\n  readonly probe?: boolean\n',
    )
    // 联合属性的模式：Select 多选模式的 onChange 改为只读数组
    edit(
      dir,
      'src/components/select.tsx',
      '  readonly onChange?: (value: V[]) => void\n}\n\n/**\n * Props of Select:',
      '  readonly onChange?: (value: readonly V[]) => void\n}\n\n/**\n * Props of Select:',
    )
    // 图标名：IconName 背后的图标表多一个名称
    edit(
      dir,
      'src/components/Icon.tsx',
      '  archive: Archive,\n',
      "  archive: Archive,\n  'archive-probe': Archive,\n",
    )

    const check = apiReport(dir, '--check')
    expect(check.output).toContain('The public API changed')
    expect(check.status).toBe(1)

    const update = apiReport(dir)
    expect(update.status, update.output).toBe(0)
    const changes: [header: string, from: string, to: string][] = [
      [
        'interface ButtonOwnProps {',
        '    readonly loading?: boolean;\n',
        '    readonly loading?: boolean;\n    readonly probe?: boolean;\n',
      ],
      [
        'interface SelectMultipleProps<V extends SelectValue> extends SelectCommonProps<V> {',
        '    readonly onChange?: (value: V[]) => void;',
        '    readonly onChange?: (value: readonly V[]) => void;',
      ],
      [
        'const registry: {',
        '    archive: LucideIcon;\n',
        "    archive: LucideIcon;\n    'archive-probe': LucideIcon;\n",
      ],
    ]
    let expected = committed
    for (const [header, from, to] of changes) {
      const before = declaration(committed, header)
      expect(before, header).toContain(from)
      expected = expected.replace(before, () => before.replace(from, () => to))
    }
    expect(readFileSync(path.join(dir, REPORT), 'utf8')).toBe(expected)
  }, 120_000)

  it('不导出的声明引用 antd、rc-*、dayjs 的类型时报告生成失败', () => {
    const dir = copyProject()
    edit(
      dir,
      'src/components/basic.tsx',
      "import { useId } from 'react'\n",
      "import { useId } from 'react'\nimport type { Dayjs } from 'dayjs'\n",
    )
    edit(
      dir,
      'src/components/basic.tsx',
      '  readonly loading?: boolean\n',
      '  readonly loading?: boolean\n  readonly probe?: Dayjs\n',
    )
    const update = apiReport(dir)
    expect(update.output).toContain('types of the implementation libraries')
    expect(update.output).toContain("from 'dayjs'")
    expect(update.status).toBe(1)
  }, 120_000)
})
