/**
 * AI 内容组件的纯函数：
 * - 链接与图片地址的协议白名单（safe-url.ts）：大小写、空白与控制字符、HTML 实体编码的变体都不能绕过；
 * - 打字机的节奏模型与字素对齐（typewriter.ts）。
 */
import { describe, expect, it } from 'vitest'
import { hostOf, safeImageSrc, safeLink } from '../src/components/ai/safe-url.ts'
import { alignToGrapheme, createPacer } from '../src/components/ai/typewriter.ts'

/** 用码位写出不可见字符与 emoji，源码中不出现这些字符。 */
const cp = (...codes: number[]) => String.fromCodePoint(...codes)

describe('safeLink：协议白名单', () => {
  it('http、https、mailto 与相对地址可以；外部链接是 http、https 与 // 开头的地址', () => {
    expect(safeLink('https://example.com/a?b=1#c')).toEqual({
      href: 'https://example.com/a?b=1#c',
      external: true,
    })
    expect(safeLink('HTTP://EXAMPLE.COM')).toEqual({ href: 'HTTP://EXAMPLE.COM', external: true })
    expect(safeLink('//cdn.example.com/x')).toEqual({ href: '//cdn.example.com/x', external: true })
    expect(safeLink('mailto:team@example.com')).toEqual({
      href: 'mailto:team@example.com',
      external: false,
    })
    for (const rel of ['/docs/a', './a', '../a', 'a/b', '#top', '?q=1', 'page.html'])
      expect(safeLink(rel), rel).toEqual({ href: rel, external: false })
    // 首尾空白去掉
    expect(safeLink('  https://example.com  ')?.href).toBe('https://example.com')
  })

  it('其他协议一律不行：javascript、data、vbscript、file、ftp、tel 等', () => {
    for (const href of [
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'data:image/png;base64,AAAA',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
      'ftp://example.com',
      'tel:+100',
      'blob:https://example.com/1',
      'chrome://settings',
    ])
      expect(safeLink(href), href).toBeNull()
  })

  it('大小写、空白、控制字符与零宽字符的变体', () => {
    for (const href of [
      'JavaScript:alert(1)',
      'JAVASCRIPT:alert(1)',
      ' javascript:alert(1)',
      '\tjavascript:alert(1)',
      'java\tscript:alert(1)',
      'java\nscript:alert(1)',
      'java\rscript:alert(1)',
      'java\u0000script:alert(1)',
      `java${cp(0x200b)}script:alert(1)`,
      `java${cp(0xfeff)}script:alert(1)`,
      `javascript${cp(0xa0)}:alert(1)`,
      '\u0001javascript:alert(1)',
      'java script:alert(1)',
    ])
      expect(safeLink(href), JSON.stringify(href)).toBeNull()
  })

  it('HTML 实体编码的变体（含没有分号、双重编码）', () => {
    for (const href of [
      'jav&#x61;script:alert(1)',
      'jav&#97;script:alert(1)',
      'jav&#0000097;script:alert(1)',
      'jav&#x0061script:alert(1)',
      'javascript&colon;alert(1)',
      'javascript&#58;alert(1)',
      'javascript&#x3A;alert(1)',
      'java&Tab;script:alert(1)',
      'java&NewLine;script:alert(1)',
      'jav&amp;#x61;script:alert(1)',
      '&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;alert(1)',
    ])
      expect(safeLink(href), href).toBeNull()
  })

  it('不是字符串、空字符串、只有空白时不是链接', () => {
    for (const href of [undefined, null, 1, {}, '', '   ', `${cp(0x200b)}`])
      expect(safeLink(href)).toBeNull()
  })

  it('冒号在第一个 / ? # 之前就按协议处理（a:b 也不放行）', () => {
    expect(safeLink('a:b')).toBeNull()
    expect(safeLink('a/b:c')).toEqual({ href: 'a/b:c', external: false })
    expect(safeLink('?next=javascript:alert(1)')).toEqual({
      href: '?next=javascript:alert(1)',
      external: false,
    })
  })
})

describe('safeImageSrc 与 hostOf', () => {
  it('图片只要 http、https 与相对地址（data: 与 mailto: 不行）', () => {
    expect(safeImageSrc('https://img.example.com/a.png')).toBe('https://img.example.com/a.png')
    expect(safeImageSrc('/assets/a.png')).toBe('/assets/a.png')
    expect(safeImageSrc('data:image/png;base64,AAAA')).toBeNull()
    expect(safeImageSrc('mailto:a@example.com')).toBeNull()
    expect(safeImageSrc('javascript:alert(1)')).toBeNull()
  })

  it('站点域名去掉 www.，不是 http、https 的地址为空', () => {
    expect(hostOf('https://www.example.com/a')).toBe('example.com')
    expect(hostOf('http://docs.example.org:8080/x')).toBe('docs.example.org')
    expect(hostOf('//cdn.example.net/x')).toBe('cdn.example.net')
    expect(hostOf('/relative')).toBe('')
    expect(hostOf('mailto:a@example.com')).toBe('')
    expect(hostOf('javascript:alert(1)')).toBe('')
    expect(hostOf(undefined)).toBe('')
  })
})

describe('打字机的节奏模型', () => {
  it('一开始就有的文字立即显示；片段之间匀速放出，不超过总长度', () => {
    const p = createPacer(10)
    expect(p.shown).toBe(10)
    // 第一个片段：按默认间隔（100ms）放完 20 个字
    p.arrive(30, 1000)
    expect(p.advance(1000)).toBe(10)
    expect(p.advance(1050)).toBe(20)
    expect(p.advance(1100)).toBe(30)
    expect(p.advance(1200)).toBe(30)
  })

  it('速度跟随片段到达的节奏：片段越密，放出越快；两个片段之间速度不变', () => {
    const fast = createPacer(0)
    const slow = createPacer(0)
    // 每 25ms 一段（每秒 40 段）与每 300ms 一段，每段 10 个字
    for (let i = 1; i <= 10; i++) {
      fast.arrive(i * 10, i * 25)
      fast.advance(i * 25)
      slow.arrive(i * 10, i * 300)
      slow.advance(i * 300)
    }
    expect(fast.rate).toBeGreaterThan(slow.rate * 3)
    // 两个片段之间：相同时间间隔放出的字数相同（匀速）
    const p = createPacer(0)
    p.arrive(100, 0)
    const a = p.advance(20)
    const b = p.advance(40) - a
    expect(Math.abs(a - b)).toBeLessThanOrEqual(1)
  })

  it('落后很多时追得更快：速度与积压的字数成正比；最低每秒 30 个字', () => {
    const p = createPacer(0)
    p.arrive(2000, 0)
    expect(p.rate).toBeGreaterThan(10)
    const q = createPacer(0)
    q.arrive(1, 0)
    expect(q.rate).toBeGreaterThanOrEqual(30 / 1000)
  })

  it('空闲之后的片段从到达时起计时（不把空闲的时间算进去）', () => {
    const p = createPacer(0)
    p.arrive(10, 0)
    expect(p.advance(1000)).toBe(10)
    p.arrive(20, 5000)
    // 到达后立即推进：没有一下子放完
    expect(p.advance(5001)).toBeLessThan(20)
  })

  it('reset 立即全部放出；文字变短时显示的长度随之变短', () => {
    const p = createPacer(0)
    p.arrive(50, 0)
    p.advance(10)
    p.reset(80)
    expect(p.shown).toBe(80)
    p.arrive(40, 100)
    expect(p.shown).toBe(40)
  })
})

describe('按字素对齐', () => {
  it('不切开 emoji、国旗、ZWJ 序列与带附加符号的字母', () => {
    const family = `a${cp(0x1f468)}${cp(0x200d)}${cp(0x1f469)}${cp(0x200d)}${cp(0x1f467)}b`
    for (let i = 2; i < family.length - 1; i++)
      expect(alignToGrapheme(family, i)).toBe(family.length - 1)
    const flag = `x${cp(0x1f1e8)}${cp(0x1f1f3)}y`
    expect(alignToGrapheme(flag, 2)).toBe(5)
    const accent = `e${cp(0x301)}!`
    expect(alignToGrapheme(accent, 1)).toBe(2)
    expect(alignToGrapheme('abc', 0)).toBe(0)
    expect(alignToGrapheme('abc', 2)).toBe(2)
    expect(alignToGrapheme('abc', 9)).toBe(3)
  })
})
