/**
 * 语言包：内置 en-US（默认）与 zh-CN，覆盖全部文本键；ThemeProvider 的 `locale` 同时切换组件文本、
 * 内部 antd 组件的语言包与 dayjs 的语言。组件内的默认文本都走语言包：除语言包文件外，src 中不出现
 * CJK 字符的字符串字面量或 JSX 文本（注释与 TSDoc 不算）。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from '@typescript/typescript6'
import dayjs from 'dayjs'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import {
  builtinMessages,
  DatePicker,
  ErrorState,
  enUS,
  formatMessage,
  Loading,
  type MessageKey,
  ThemeProvider,
  zhCN,
} from '../src/index.ts'

const srcDir = fileURLToPath(new URL('../src/', import.meta.url))
const localesDir = path.join(srcDir, 'i18n', 'locales')

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe('内置语言包', () => {
  it('en-US 与 zh-CN 的键完全一致，文本非空，占位符一致', () => {
    const keys = Object.keys(enUS).sort()
    expect(keys.length).toBeGreaterThan(20)
    for (const [name, messages] of Object.entries(builtinMessages)) {
      expect(Object.keys(messages).sort(), name).toEqual(keys)
      for (const k of keys as MessageKey[]) {
        expect(messages[k].trim(), `${name} ${k}`).not.toBe('')
        expect(placeholders(messages[k]), `${name} ${k}`).toEqual(placeholders(enUS[k]))
      }
    }
    expect(builtinMessages['zh-CN']).toBe(zhCN)
  })

  it('formatMessage：替换占位符；文本表缺少的键用 en-US 补齐', () => {
    expect(formatMessage(zhCN, 'confirm.typeToConfirm', { name: '甲' })).toBe('请输入「甲」以确认')
    expect(formatMessage({}, 'error.retry')).toBe('Retry')
    // 自定义主题的 nameKey 等不在内置文本中的键：有文本用文本，没有就返回键本身，不抛错
    expect(formatMessage({ 'theme.brand': 'Brand' }, 'theme.brand' as MessageKey)).toBe('Brand')
    expect(formatMessage({}, 'theme.brand' as MessageKey, { x: 1 })).toBe('theme.brand')
  })
})

/** 渲染一段内容，返回 HTML。 */
const html = (node: React.ReactNode) => renderToStaticMarkup(node)

describe('ThemeProvider 的 locale', () => {
  afterEach(() => {
    dayjs.locale('en')
  })

  it('默认 en-US：组件文本、antd 语言包与 dayjs 都是英文', () => {
    expect(html(<Loading />)).toContain('aria-label="Loading"')
    const out = html(
      <ThemeProvider>
        <Loading />
        <ErrorState onRetry={() => {}} />
        <DatePicker />
      </ThemeProvider>,
    )
    expect(out).toContain('aria-label="Loading"')
    expect(out).toContain('Failed to load')
    expect(out).toContain('placeholder="Select date"')
    expect(dayjs.locale()).toBe('en')
  })

  it('zh-CN：组件文本、antd 语言包与 dayjs 一起切换', () => {
    const out = html(
      <ThemeProvider locale="zh-CN">
        <Loading />
        <ErrorState onRetry={() => {}} />
        <DatePicker />
      </ThemeProvider>,
    )
    expect(out).toContain('aria-label="加载中"')
    expect(out).toContain('加载失败')
    expect(out).toContain('重试')
    expect(out).toContain('placeholder="请选择日期"')
    expect(dayjs.locale()).toBe('zh-cn')
    // 切回 en-US
    html(
      <ThemeProvider locale="en-US">
        <Loading />
      </ThemeProvider>,
    )
    expect(dayjs.locale()).toBe('en')
  })

  it('自定义文本表：缺少的键用 en-US 补齐，antd 与 dayjs 为 en-US', () => {
    const out = html(
      <ThemeProvider locale={{ 'spin.loading': 'Chargement' }}>
        <Loading />
        <ErrorState onRetry={() => {}} />
        <DatePicker />
      </ThemeProvider>,
    )
    expect(out).toContain('aria-label="Chargement"')
    expect(out).toContain('Retry')
    expect(out).toContain('placeholder="Select date"')
    expect(dayjs.locale()).toBe('en')
  })

  it('messages 在 locale 之上覆盖个别文本', () => {
    const out = html(
      <ThemeProvider locale="zh-CN" messages={{ 'error.retry': '再试一次' }}>
        <ErrorState onRetry={() => {}} />
      </ThemeProvider>,
    )
    expect(out).toContain('再试一次')
    expect(out).toContain('加载失败')
  })
})

// —— 组件内不写死文本 ——

const CJK = /[　-〿㐀-䶿一-鿿豈-﫿＀-￯]/

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const f = path.join(dir, name)
    if (statSync(f).isDirectory()) walk(f, out)
    else if (/\.(tsx?|css)$/.test(name)) out.push(f)
  }
  return out
}

/** 文件中含 CJK 字符的字符串字面量、模板字符串片段与 JSX 文本（注释不算）。 */
function cjkLiterals(file: string): string[] {
  const text = readFileSync(file, 'utf8')
  const rel = path.relative(srcDir, file).split(path.sep).join('/')
  if (file.endsWith('.css'))
    return text
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .flatMap((line, i) => (CJK.test(line) ? [`${rel}:${i + 1} ${line.trim()}`] : []))
  const sf = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  const out: string[] = []
  const visit = (n: ts.Node) => {
    if (
      ts.isStringLiteralLike(n) ||
      ts.isTemplateHead(n) ||
      ts.isTemplateMiddle(n) ||
      ts.isTemplateTail(n) ||
      ts.isJsxText(n)
    ) {
      if (CJK.test(n.text)) {
        const line = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
        out.push(`${rel}:${line} ${n.text.trim()}`)
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return out
}

describe('组件内的默认文本都走语言包', () => {
  const files = walk(srcDir)

  it('扫描器能找出字符串字面量与 JSX 文本，忽略注释', () => {
    // 语言包文件本身满是中文字面量，用它确认扫描器有效
    expect(cjkLiterals(path.join(localesDir, 'zh-CN.ts')).length).toBeGreaterThan(20)
    expect(cjkLiterals(path.join(localesDir, 'en-US.ts'))).toEqual([])
    expect(files.some((f) => f.endsWith('.tsx'))).toBe(true)
  })

  it('除语言包文件外，src 中没有 CJK 字符的字符串字面量或 JSX 文本', () => {
    const offenders = files.filter((f) => !f.startsWith(localesDir + path.sep)).flatMap(cjkLiterals)
    expect(offenders).toEqual([])
  })
})
