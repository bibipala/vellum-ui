/**
 * 包清单：工作区内用源码、发布时用构建产物（ADR 0019 V3）。
 *
 * `exports` 指向源码，本仓库的外壳、预设层、测试、类型检查、Storybook 都不需要先构建；`pnpm pack` / 发布时
 * pnpm 用 `publishConfig` 中的 `exports`、`main`、`types` 替换，指向 dist。两份 `exports` 必须一一对应，
 * 否则会出现「在仓库里能用、装上发布包就找不到」的子路径。
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const pkgRoot = fileURLToPath(new URL('..', import.meta.url))
const pkg = JSON.parse(readFileSync(path.join(pkgRoot, 'package.json'), 'utf8')) as {
  exports: Record<string, string>
  files: string[]
  sideEffects: string[]
  scripts: Record<string, string>
  publishConfig: {
    main: string
    types: string
    exports: Record<string, string | { types: string; default: string }>
  }
}

/** 构建产物（dist）以外、随包发布的源码目录与文件：两种模式下指向同一处。 */
const SHARED = ['./examples/*', './docs/components.json', './package.json']

/** dist 产物与源码的对应：JS 入口由 Vite 输出，样式文件同名。 */
const SOURCE_OF: Record<string, string> = {
  './dist/index.js': './src/index.ts',
  './dist/styles.css': './src/styles.css',
  './dist/fonts.css': './src/fonts.css',
  './dist/global.css': './src/global.css',
}

const targetOf = (v: string | { types: string; default: string }) =>
  typeof v === 'string' ? v : v.default

describe('包清单', () => {
  const publish = pkg.publishConfig.exports

  it('发布时的 exports 与源码模式的 exports 子路径一致', () => {
    expect(Object.keys(publish).sort()).toEqual(Object.keys(pkg.exports).sort())
  })

  it('发布时的入口指向 dist，并与源码一一对应', () => {
    for (const [key, value] of Object.entries(publish)) {
      const target = targetOf(value)
      if (SHARED.includes(key)) {
        expect(target, key).toBe(pkg.exports[key])
        continue
      }
      expect(target.startsWith('./dist/'), key).toBe(true)
      expect(SOURCE_OF[target], key).toBe(pkg.exports[key])
    }
    const main = publish['.']
    expect(typeof main === 'object' && main.types).toBe('./dist/index.d.ts')
    expect(pkg.publishConfig.main).toBe('./dist/index.js')
    expect(pkg.publishConfig.types).toBe('./dist/index.d.ts')
  })

  it('files 覆盖发布时引用的全部路径，且不包含源码', () => {
    const covered = (p: string) => pkg.files.some((f) => p === f || p.startsWith(`${f}/`))
    for (const value of Object.values(publish)) {
      const target = targetOf(value).replace(/^\.\//, '').replace(/\/\*$/, '')
      if (target === 'package.json') continue
      expect(covered(target), target).toBe(true)
    }
    expect(pkg.files).not.toContain('src')
  })

  it('CSS 声明为有副作用（使用方只为副作用导入样式，打包器不得丢弃）', () => {
    expect(pkg.sideEffects).toEqual(['**/*.css'])
  })

  it('有 build 脚本', () => {
    expect(pkg.scripts.build).toBe('node scripts/build.ts')
  })
})
