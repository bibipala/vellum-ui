/**
 * 手写的使用指南（docs/<语言>/guides/<名称>.md）：英文与简体中文两套，结构相同。
 * - 两种语言的文件名相同；第一行是语言切换（与生成的组件页相同的写法），然后是 `# 标题`，再是一段概述
 *   （将作为索引中的说明）；
 * - 二级、三级标题的数量相同；英文中除语言切换外没有 CJK 字符，中文中有汉字；
 * - 相对链接指向存在的文件与标题（包括生成的页面配方页与令牌清单，docs.test.ts 保证它们是最新的）。
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CJK, HAN } from '../scripts/docs.ts'

const docsDir = fileURLToPath(new URL('../docs/', import.meta.url))
const LANGS = [
  {
    dir: 'en-US',
    other: 'zh-CN',
    switcher: (f: string) => `**English** | [简体中文](../../zh-CN/guides/${f})`,
  },
  {
    dir: 'zh-CN',
    other: 'en-US',
    switcher: (f: string) => `[English](../../en-US/guides/${f}) | **简体中文**`,
  },
] as const

const guidesOf = (lang: string) =>
  readdirSync(path.join(docsDir, lang, 'guides'))
    .filter((f) => f.endsWith('.md'))
    .sort()
const read = (lang: string, file: string) =>
  readFileSync(path.join(docsDir, lang, 'guides', file), 'utf8')

/** 指南中必须有的页面（新增指南时加在这里）。 */
const GUIDES = ['building-pages.md', 'conventions.md', 'custom-styles.md']

/** 去掉代码块：其中的 `#`、`[…](…)` 不是标题与链接。 */
const prose = (md: string) => md.replace(/```[\s\S]*?```/g, '')

/** GitHub 为标题生成的锚点：小写，去掉标点（保留字母、数字、汉字、空格与连字符），空格换成连字符。 */
const slug = (heading: string) =>
  heading
    .trim()
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s/g, '-')

const headings = (md: string) =>
  [...prose(md).matchAll(/^(#{1,6})\s+(.+)$/gm)].map((m) => ({
    level: (m[1] as string).length,
    text: m[2] as string,
  }))

describe('使用指南', () => {
  it('两种语言的指南相同，且齐全', () => {
    const [en, zh] = LANGS.map((l) => guidesOf(l.dir))
    expect(en).toEqual(zh)
    expect(en).toEqual(expect.arrayContaining(GUIDES))
  })

  it('第一行是语言切换，然后是标题与一段概述', () => {
    for (const lang of LANGS)
      for (const f of guidesOf(lang.dir)) {
        const lines = read(lang.dir, f).split('\n')
        const where = `${lang.dir}/${f}`
        expect(lines[0], where).toBe(lang.switcher(f))
        expect(lines[1], where).toBe('')
        expect(lines[2], where).toMatch(/^# \S/)
        expect(lines[3], where).toBe('')
        // 概述：一段文字（不是标题、列表、表格或代码）
        expect(lines[4], where).toMatch(/^[^#|`\-\s]/)
        expect((lines[4] ?? '').length, where).toBeGreaterThan(80)
      }
  })

  it('两种语言的结构相同：各级标题的数量一致', () => {
    for (const f of guidesOf('en-US')) {
      const count = (lang: string) =>
        headings(read(lang, f))
          .map((h) => h.level)
          .join(',')
      expect(count('zh-CN'), f).toBe(count('en-US'))
    }
  })

  it('英文中除语言切换外没有 CJK 字符；中文中有汉字', () => {
    for (const f of guidesOf('en-US')) {
      const offenders = read('en-US', f)
        .split('\n')
        .slice(1)
        .flatMap((line, i) => (CJK.test(line) ? [`${f}:${i + 2}`] : []))
      expect(offenders).toEqual([])
      expect(HAN.test(read('zh-CN', f).split('\n').slice(1).join('\n')), f).toBe(true)
    }
  })

  it('相对链接指向存在的文件与标题', () => {
    const problems: string[] = []
    for (const lang of LANGS)
      for (const f of guidesOf(lang.dir)) {
        const from = path.join(docsDir, lang.dir, 'guides')
        for (const m of prose(read(lang.dir, f)).matchAll(/\]\(([^)\s]+)\)/g)) {
          const href = m[1] as string
          if (/^[a-z]+:/i.test(href)) continue
          const [file = '', anchor] = href.split('#')
          const target = file ? path.resolve(from, file) : path.join(from, f)
          if (!existsSync(target)) {
            problems.push(`${lang.dir}/${f}: ${href}`)
            continue
          }
          if (anchor && target.endsWith('.md')) {
            const slugs = headings(readFileSync(target, 'utf8')).map((h) => slug(h.text))
            if (!slugs.includes(decodeURIComponent(anchor)))
              problems.push(`${lang.dir}/${f}: ${href}（没有这个标题）`)
          }
        }
      }
    expect(problems).toEqual([])
  })

  it('能为标题生成 GitHub 的锚点', () => {
    expect(slug('If you know Ant Design')).toBe('if-you-know-ant-design')
    expect(slug('如果你熟悉 Ant Design')).toBe('如果你熟悉-ant-design')
    expect(slug('Clickable custom elements: `data-vl-state`')).toBe(
      'clickable-custom-elements-data-vl-state',
    )
  })
})
