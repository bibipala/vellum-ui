/**
 * 全局样式可选：base.css（随 ThemeProvider 自动加载）只作用于组件库自己的元素与变量，不改写宿主页面；
 * 改写 body、标题、选区、滚动条、页面切换、color-scheme 的规则在可选的 global.css（`vellum-ui/global.css`）。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (name: string) => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8')
const base = read('base.css')
const global = read('global.css')

/** 按顶层逗号拆分选择器列表（`:is(a, b)` 括号内的逗号不拆）。 */
function splitTop(list: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of list) {
    if (ch === '(') depth++
    else if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out.map((x) => x.trim()).filter(Boolean)
}

/** 去掉注释与 @keyframes 块，取出所有「选择器 { 声明 }」。 */
function rules(css: string): { selectors: string[]; body: string }[] {
  const text = css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '')
  return [...text.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map((m) => ({
      selectors: splitTop((m[1] as string).replace(/^[\s\S]*@media[^{]*$/, '')),
      body: m[2] as string,
    }))
    .filter((r) => r.selectors.length > 0)
}

/** 选择器只指向文档根本身（`:root`、`:root:root[data-vl-…]`）。 */
const onlyRoot = (selector: string) => /^(?::root)+(?:\[data-vl-[^\]]+\])*$/.test(selector)
/** 声明全部是组件库自己的 CSS 变量。 */
const onlyVlVars = (body: string) =>
  body
    .split(';')
    .map((d) => d.trim())
    .filter(Boolean)
    .every((d) => d.startsWith('--vl-'))

describe('base.css 不改写宿主页面', () => {
  it('能解析出规则（含 @media 内的规则），括号内的逗号不拆分', () => {
    expect(splitTop(':is(a, b) .x, .y')).toEqual([':is(a, b) .x', '.y'])
    const all = rules(base)
    expect(all.length).toBeGreaterThan(10)
    expect(all.some((r) => r.selectors.some((s) => s.includes('[data-vl-reduced-motion')))).toBe(
      true,
    )
  })

  it('每条规则只指向组件库的元素：data-vl-* 属性或内部 antd 组件的类名；指向文档根的只设 --vl-* 变量', () => {
    const offenders = rules(base).flatMap((r) =>
      r.selectors
        .filter((s) =>
          onlyRoot(s) ? !onlyVlVars(r.body) : !s.includes('[data-vl-') && !s.includes('.ant-'),
        )
        .map((s) => `${s} { ${r.body.trim()} }`),
    )
    expect(offenders).toEqual([])
  })

  it('不含页面级规则：body、html、标题、选区、滚动条、页面切换、color-scheme', () => {
    expect(base).not.toMatch(/(^|[\s,}])(?:html|body|h[1-6])\s*[{,]/)
    expect(base).not.toMatch(/::selection|scrollbar|view-transition|color-scheme/)
  })
})

describe('不引入 global.css 时，自研的可聚焦组件仍有键盘焦点环', () => {
  it('带状态层的元素（IconButton、消息条的撤销等）由 base.css 提供', () => {
    expect(base).toMatch(
      /:where\(\[data-vl-state\]\):focus-visible\s*\{\s*outline:\s*2px solid var\(--vl-color-focus-ring\);\s*outline-offset:\s*2px;/,
    )
  })

  it('没有状态层的自研可聚焦元素在各自的 CSS Module 中定义焦点环', () => {
    for (const [file, selector] of [
      ['components/extras.module.css', '.linkButton:focus-visible'],
      ['components/ImageGrid.module.css', '.tile:focus-visible'],
      ['components/items.module.css', '.hit:focus-visible'],
      ['components/Lightbox.module.css', '.control:focus-visible'],
    ] as const) {
      const css = read(file)
      const i = css.indexOf(`${selector} {`)
      expect(i, `${file} ${selector}`).toBeGreaterThanOrEqual(0)
      expect(css.slice(i, css.indexOf('}', i)), `${file} ${selector}`).toMatch(/outline:/)
    }
  })
})

describe('global.css：可选的宿主页面样式', () => {
  it('包含 body、标题、选区、滚动条、页面切换与 color-scheme', () => {
    expect(global).toMatch(/(^|\n)body\s*\{/)
    expect(global).toMatch(/h1,\s*h2,\s*h3,\s*h4\s*\{/)
    expect(global).toMatch(/::selection/)
    expect(global).toMatch(/::-webkit-scrollbar/)
    expect(global).toMatch(/::view-transition-new\(vl-main\)/)
    expect(global).toMatch(/:root\[data-vl-mode="dark"\]\s*\{\s*color-scheme:\s*dark/)
  })

  it('由包导出 vellum-ui/global.css；ThemeProvider 自动加载 base.css，但不加载 global.css', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      exports: Record<string, string>
    }
    expect(pkg.exports['./global.css']).toBe('./src/global.css')
    const provider = read('theme/ThemeProvider.tsx')
    expect(provider).toContain("import '../base.css'")
    expect(provider).not.toMatch(/global\.css/)
  })
})
