/**
 * 命令面板的匹配（matchCommands）。前两个用例的数据与断言来自外壳 apps/web/test/shell.test.ts
 * 「命令：……分词匹配」（外壳的匹配逻辑迁入组件库时一并迁来，断言不变）；其余是模糊匹配与排序。
 */
import { describe, expect, it } from 'vitest'
import { matchCommands } from '../src/index.ts'

/** 与外壳测试中 buildCommands 生成的条目相同（超级管理员、一个笔记插件）。 */
const shellCommands = [
  { title: '首页', keywords: '首页' },
  { title: '笔记 / 全部笔记', keywords: '笔记 全部笔记' },
  { title: '笔记 / 置顶看板', keywords: '笔记 置顶看板' },
  { title: '系统 / 插件管理', keywords: '系统 插件管理' },
  { title: '系统 / 插件设置', keywords: '系统 插件设置' },
  { title: '开发者中心', keywords: '开发者中心' },
  { title: '新建笔记', keywords: '笔记 Note new' },
  { title: '打开置顶看板', keywords: '打开置顶看板 pin' },
]

describe('matchCommands：外壳迁来的断言', () => {
  it('空格分词，每个词都要出现在标题或关键词中', () => {
    expect(matchCommands(shellCommands, '笔记 全部').map((c) => c.title)).toEqual([
      '笔记 / 全部笔记',
    ])
  })

  it('不区分大小写，关键词也能命中', () => {
    expect(matchCommands(shellCommands, 'PIN').map((c) => c.title)).toEqual(['打开置顶看板'])
  })
})

describe('matchCommands：模糊匹配与排序', () => {
  const items = [
    { title: 'Settings' },
    { title: 'Team settings' },
    { title: 'Reset password' },
    { title: 'Dev Center', keywords: ['developer', 'api'] },
    { title: 'Assets', keywords: 'files' },
  ]
  const titles = (q: string) => matchCommands(items, q).map((c) => c.title)

  it('空查询返回全部，顺序不变（返回新数组）', () => {
    const all = matchCommands(items, '   ')
    expect(all).toEqual(items)
    expect(all).not.toBe(items)
  })

  it('排序：标题开头 > 词的开头 > 标题中间；同一档保持原顺序', () => {
    expect(titles('set')).toEqual(['Settings', 'Team settings', 'Reset password', 'Assets'])
  })

  it('关键词（数组或字符串）排在标题之后；按顺序出现的字符（模糊）排在最后', () => {
    expect(titles('api')).toEqual(['Dev Center'])
    expect(titles('files')).toEqual(['Assets'])
    expect(titles('dvc')).toEqual(['Dev Center'])
    expect(titles('stg')).toEqual(['Settings', 'Team settings'])
  })

  it('每个词都要命中：有一个词不命中就排除', () => {
    expect(titles('team set')).toEqual(['Team settings'])
    expect(titles('team zzz')).toEqual([])
  })

  it('中文同样按顺序模糊匹配', () => {
    expect(matchCommands(shellCommands, '全笔记').map((c) => c.title)).toEqual(['笔记 / 全部笔记'])
  })
})
