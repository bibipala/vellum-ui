/**
 * 组件库自身的守卫：自研组件的 CSS Modules 没有写死颜色与时长，统一状态层与焦点环的写法，
 * 以及 antd 只作为内部实现（入口不转出 antd）。库的引用边界见 boundary.test.ts。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const pkgRoot = fileURLToPath(new URL('../', import.meta.url))
const uiSrc = fileURLToPath(new URL('../src/', import.meta.url))

function walk(dir: string, exts: readonly string[], out: string[] = []): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return out // 目录不存在（如 plugins/ 尚未创建）
  }
  for (const name of entries) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, exts, out)
    else if (exts.some((e) => name.endsWith(e))) out.push(full)
  }
  return out
}

describe('自研组件样式只引用令牌', () => {
  it('CSS Modules 中没有写死颜色值', () => {
    const files = walk(uiSrc, ['.module.css'])
    expect(files.length).toBeGreaterThan(0)
    const color = /#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\(/i
    const offenders = files.filter((f) => color.test(readFileSync(f, 'utf8')))
    expect(offenders.map((f) => relative(pkgRoot, f))).toEqual([])
  })

  it('CSS Modules 中的时长都来自动效令牌', () => {
    const files = walk(uiSrc, ['.module.css'])
    const duration = /(?<![\w-])\d+(?:\.\d+)?m?s\b/
    const offenders = files.filter((f) => duration.test(readFileSync(f, 'utf8')))
    expect(offenders.map((f) => relative(pkgRoot, f))).toEqual([])
  })

  // 按下立即变深，不缩放、不位移；悬停与按下统一用状态层（base.css 的 data-vl-state）
  it('按下状态（:active）不改变 transform', () => {
    const files = [
      ...walk(uiSrc, ['.css']),
      ...walk(join(pkgRoot, 'examples'), ['.css']),
      ...walk(join(pkgRoot, 'stories'), ['.css']),
    ]
    const offenders = files.flatMap((f) =>
      [...readFileSync(f, 'utf8').matchAll(/([^{}]*:active[^{}]*)\{([^}]*)\}/g)]
        .filter((m) => /\btransform\s*:/.test(m[2] as string))
        .map((m) => `${relative(pkgRoot, f)}: ${(m[1] as string).trim()}`),
    )
    expect(offenders).toEqual([])
  })

  it('统一状态层叠加内容色，透明度与时长取令牌', () => {
    const css = readFileSync(join(uiSrc, 'base.css'), 'utf8')
    expect(css).toMatch(/\[data-vl-state\]\)::before\s*\{[^}]*background:\s*currentColor/)
    expect(css).toMatch(/:hover::before\s*\{\s*opacity:\s*var\(--vl-state-hover-opacity\)/)
    expect(css).toMatch(
      /:active::before\s*\{\s*opacity:\s*var\(--vl-state-press-opacity\);\s*transition-duration:\s*var\(--vl-motion-duration-instant\)/,
    )
    expect(css).toMatch(/:is\(:disabled, \[aria-disabled="true"\]\)::before\s*\{\s*opacity:\s*0/)
  })

  // 键盘焦点环统一为 2px 强调色、外扩 2px；antd 组件的线宽与颜色来自主题映射，外扩由 base.css 补齐
  it('antd 组件的键盘焦点环：主题映射 2px 强调色，base.css 外扩 2px', async () => {
    const { toAntdTheme } = await import('../src/theme/antd.ts')
    const { resolveTheme } = await import('../src/theme/compile.ts')
    const { defaultTheme } = await import('../src/themes/index.ts')
    const { toHex } = await import('../src/tokens/oklch.ts')
    for (const mode of ['light', 'dark'] as const) {
      const theme = resolveTheme(defaultTheme, mode)
      const token = toAntdTheme(theme).token ?? {}
      expect(token.lineWidthFocus).toBe(2)
      expect(token.colorPrimaryBorder).toBe(toHex(theme.colors.accent))
    }
    const css = readFileSync(join(uiSrc, 'base.css'), 'utf8')
    const rule = /:root:root:root\s*:is\(([^{]*)\)\s*\{([^}]*)\}/.exec(css)
    expect(rule, '缺少 antd 组件焦点环的覆盖规则').not.toBeNull()
    const [, selectors = '', body = ''] = rule ?? []
    for (const s of [
      '.ant-checkbox:has(.ant-checkbox-input:focus-visible)',
      '.ant-radio:has(.ant-radio-input:focus-visible)',
      '.ant-switch:focus-visible',
      '.ant-segmented-item-focused',
      '.ant-pagination-item:focus-visible',
      '.ant-tabs-tab-btn:focus-visible',
    ])
      expect(selectors).toContain(s)
    expect(body).toMatch(/outline:\s*2px solid var\(--vl-color-focus-ring\)/)
    expect(body).toMatch(/outline-offset:\s*2px/)
  })
})

// antd 只作为内部实现，每个导出都是自有封装（不依赖使用方代码的约束见 boundary.test.ts）
const ANTD_REEXPORT =
  /\bexport\s+(?:type\s+)?(?:\*(?:\s+as\s+\w+)?|\{[^}]*\})\s*from\s*['"](?:antd|@ant-design\/[^'"]+)(?:\/[^'"]*)?['"]/

describe('antd 只作为内部实现', () => {
  it('正则能识别转出写法', () => {
    expect(ANTD_REEXPORT.test("export { Select } from 'antd'")).toBe(true)
    expect(ANTD_REEXPORT.test("export type { InputRef } from 'antd'")).toBe(true)
    expect(ANTD_REEXPORT.test("export {\n  Form,\n  Input,\n} from 'antd'")).toBe(true)
    expect(ANTD_REEXPORT.test("export * from 'antd'")).toBe(true)
    expect(ANTD_REEXPORT.test("export * as antd from 'antd/es/button'")).toBe(true)
    expect(ANTD_REEXPORT.test("import { Select } from 'antd'")).toBe(false)
    expect(ANTD_REEXPORT.test("export { Select } from './inputs.tsx'")).toBe(false)
  })

  const sources = walk(uiSrc, ['.ts', '.tsx'])

  it("源码中没有 `export … from 'antd'`（类型也不例外）", () => {
    expect(sources.length).toBeGreaterThan(0)
    const offenders = sources
      .filter((f) => ANTD_REEXPORT.test(readFileSync(f, 'utf8')))
      .map((f) => relative(pkgRoot, f))
    expect(offenders).toEqual([])
  })

  it('入口没有原样导出 antd 的组件（包括赋值后再导出）', async () => {
    const ui: Record<string, unknown> = await import('../src/index.ts')
    const antd: Record<string, unknown> = await import('antd')
    const antdValues = new Set(
      Object.values(antd).filter((v) => typeof v === 'function' || (typeof v === 'object' && v)),
    )
    const same = Object.entries(ui)
      .filter(([, v]) => antdValues.has(v))
      .map(([k]) => k)
    expect(same).toEqual([])
    // 这个用例在测试体内加载整个入口与 antd（单独运行约 1.5 秒）。M4 起入口包含 Ant Design X 与 x-markdown，
    // 并行跑全部测试时加载可能超过默认的 5 秒；限时只针对加载时间，断言不变
  }, 30_000)
})

// 红线 14：生产环境是 Windows，文件系统不区分大小写。构建按模块输出（`X.tsx` → `X.js`、`X.d.ts`），
// `Heatmap.tsx` 与 `heatmap.ts` 在源码中不冲突，输出的 `Heatmap.d.ts` / `heatmap.d.ts` 却会互相覆盖
describe('文件名不区分大小写时不冲突', () => {
  /** 构建产物的文件名（不含扩展名的部分），小写。 */
  const outputName = (f: string) =>
    relative(uiSrc, f)
      .split('\\')
      .join('/')
      .replace(/\.(tsx|ts)$/, '')
      .replace(/\.module\.css$/, '.module')
      .toLowerCase()

  it('能识别只有大小写不同的模块', () => {
    expect(outputName(join(uiSrc, 'a/Heatmap.tsx'))).toBe(outputName(join(uiSrc, 'a/heatmap.ts')))
    expect(outputName(join(uiSrc, 'a/heatmap.module.css'))).not.toBe(
      outputName(join(uiSrc, 'a/Heatmap.tsx')),
    )
  })

  it('src 中没有输出名只有大小写不同的文件', () => {
    const files = walk(uiSrc, ['.ts', '.tsx', '.css'])
    const seen = new Map<string, string>()
    const clashes: string[] = []
    for (const f of files) {
      const key = outputName(f)
      const prev = seen.get(key)
      if (prev) clashes.push(`${relative(pkgRoot, prev)} ↔ ${relative(pkgRoot, f)}`)
      else seen.set(key, f)
    }
    expect(clashes).toEqual([])
  })
})
