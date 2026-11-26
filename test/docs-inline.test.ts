import path from 'node:path'
import { runInNewContext } from 'node:vm'
import ts from '@typescript/typescript6'
import { describe, expect, it } from 'vitest'
import { selfContained } from '../scripts/docs/inline.ts'

/** 虚拟夹具与复制结果都交给真正的 TypeScript 编译器；执行复制结果检查初始化顺序与属性键。 */
function fixture(sources: Record<string, string>) {
  const root = path.resolve('test/.docs-inline-fixture')
  const files = new Map(
    Object.entries(sources).map(([name, code]) => [path.join(root, name), code]),
  )
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    allowImportingTsExtensions: true,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    types: [],
  }
  const host = ts.createCompilerHost(options)
  const read = host.readFile.bind(host)
  const exists = host.fileExists.bind(host)
  host.readFile = (name) => files.get(path.resolve(name)) ?? read(name)
  host.fileExists = (name) => files.has(path.resolve(name)) || exists(name)
  const directoryExists = host.directoryExists?.bind(host)
  host.directoryExists = (name) => name === root || directoryExists?.(name) === true
  const program = () => ts.createProgram({ rootNames: [...files.keys()], options, host })
  const original = program()
  expect(
    ts
      .getPreEmitDiagnostics(original)
      .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n')),
  ).toEqual([])
  const sf = original.getSourceFile(path.join(root, 'example.ts'))
  if (!sf) throw new Error('没有示例文件')
  const fn = sf.statements.find(
    (st): st is ts.FunctionDeclaration => ts.isFunctionDeclaration(st) && st.name?.text === 'Basic',
  )
  if (!fn) throw new Error('没有 Basic 函数')
  const code = selfContained(original.getTypeChecker(), sf, fn)
  files.clear()
  files.set(path.join(root, 'copy.ts'), code)
  const copied = program()
  expect(
    ts
      .getPreEmitDiagnostics(copied)
      .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n')),
  ).toEqual([])
  const js = ts.transpileModule(code.replace(/export\s+function Basic/, 'function Basic'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText
  return { code, result: runInNewContext(`${js}\nBasic()`) }
}

describe('复制示例的辅助模块内联', () => {
  it('保留重命名的具名导入；内部同名局部变量不会捕获导入', () => {
    expect(
      fixture({
        'example.ts':
          "import { value as renamed } from './helper.ts'\nexport function Basic() { const value = 7; return [renamed, value] }",
        'helper.ts': 'export const value = 42',
      }).result,
    ).toEqual([42, 7])
  })
  it('保留重命名的默认函数导入与函数内部递归', () => {
    expect(
      fixture({
        'example.ts':
          "import renamed from './helper.ts'\nexport function Basic() { return renamed(3) }",
        'helper.ts':
          'export default function original(n: number): number { return n ? n * original(n - 1) : 1 }',
      }).result,
    ).toBe(6)
  })
  it('声明名冲突时报告来源，避免生成重复声明', () => {
    expect(() =>
      fixture({
        'example.ts':
          "import { value as first } from './first.ts'\nimport { value as second } from './second.ts'\nexport function Basic() { return first + second }",
        'first.ts': 'export const value = 1',
        'second.ts': 'export const value = 2',
      }),
    ).toThrow(/冲突.*value/)
  })
  it('简写属性保留导入别名作为属性键', () => {
    expect(
      fixture({
        'example.ts':
          "import { value as renamed } from './helper.ts'\nexport function Basic() { return { renamed } }",
        'helper.ts': 'export const value = 42',
      }).result,
    ).toEqual({ renamed: 42 })
  })
  it('递归收集辅助依赖，先初始化依赖与别名，再初始化使用它的声明', () => {
    expect(
      fixture({
        'example.ts':
          "import { answer as renamed } from './helper.ts'\nexport function Basic() { return { renamed } }",
        'helper.ts': "import { value as seed } from './base.ts'\nexport const answer = seed + 2",
        'base.ts': "import { start } from './leaf.ts'\nexport const value = start * 10",
        'leaf.ts': 'export const start = 4',
      }).result,
    ).toEqual({ renamed: 42 })
  })
  it.each([
    'export default 42',
    'export default function () { return 42 }',
    'export default class { value = 42 }',
  ])('默认导入没有声明名：%s', (helper) => {
    const expression = helper.includes('class')
      ? 'new renamed().value'
      : helper.includes('function')
        ? 'renamed()'
        : 'renamed'
    expect(
      fixture({
        'example.ts': `import renamed from './helper.ts'\nexport function Basic() { return ${expression} }`,
        'helper.ts': helper,
      }).result,
    ).toBe(42)
  })
  it('别名与其他声明冲突时报告错误', () => {
    expect(() =>
      fixture({
        'example.ts':
          "import { value as renamed, other } from './helper.ts'\nexport function Basic() { return renamed + other }",
        'helper.ts': 'export const value = 40, renamed = 1, other = renamed + 1',
      }),
    ).toThrow(/冲突.*renamed/)
  })
  it('泛型类型和类的重命名导入保留类型绑定', () => {
    expect(
      fixture({
        'example.ts':
          "import { Box as Renamed, type Shape as RenamedShape } from './helper.ts'\nexport function Basic() { const box: Renamed<number> = new Renamed(42); const item: RenamedShape<number> = { value: box.value }; return item.value }",
        'helper.ts':
          'export class Box<T> { constructor(public value: T) {} }\nexport interface Shape<T> { value: T }',
      }).result,
    ).toBe(42)
  })
  it('函数辅助依赖可以通过别名互相递归', () => {
    expect(
      fixture({
        'example.ts':
          "import { even } from './even.ts'\nexport function Basic() { return [even(4), even(3)] }",
        'even.ts':
          "import { odd as isOdd } from './odd.ts'\nexport function even(n: number): boolean { return n === 0 || isOdd(n - 1) }",
        'odd.ts':
          "import { even as isEven } from './even.ts'\nexport function odd(n: number): boolean { return n !== 0 && isEven(n - 1) }",
      }).result,
    ).toEqual([true, false])
  })
  it('循环中的别名不能在目标初始化之前读取', () => {
    expect(() =>
      fixture({
        'example.ts':
          "import { read } from './helper.ts'\nexport function Basic() { return read() }",
        'helper.ts':
          "import { value as seed } from './base.ts'\nexport const read: () => number = () => seed(0)",
        'base.ts':
          "import { read as get } from './helper.ts'\nexport const value: (n: number) => number = (n) => n === 0 ? 42 : get()",
      }),
    ).toThrow(/无法初始化循环依赖中的别名/)
  })
  it('默认导出引用已有变量时复用声明，与具名导入共用同一个值', () => {
    expect(
      fixture({
        'example.ts':
          "import value, { value as named } from './helper.ts'\nexport function Basic() { return [value, named] }",
        'helper.ts': 'export const value = 42\nexport default value',
      }).result,
    ).toEqual([42, 42])
  })
})
