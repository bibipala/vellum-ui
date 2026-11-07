/**
 * 命令面板的匹配（从外壳迁入组件库，原有断言保留在 test/command-match.test.ts）。
 *
 * - 查询按空白分词，**每个词都要命中**（不区分大小写）：命中标题或关键词中的连续文字，或者按顺序出现在标题中
 *   （模糊匹配，如 `dvc` 命中 “Dev Center”）；
 * - 排序：标题开头 > 标题中词的开头 > 标题中间 > 关键词 > 只是按顺序出现在标题中；同分时保持原来的顺序。
 */

/**
 * What matchCommands needs from an item: a title and optional keywords.
 * @zh matchCommands 需要的条目字段：标题与可选的关键词。
 */
export interface CommandMatchable {
  /** Title, matched first. @zh 标题，优先匹配。 */
  readonly title: string
  /** Extra words that also match, such as synonyms or an English name. @zh 也能命中的其他词，如同义词、英文名。 */
  readonly keywords?: string | readonly string[]
}

/** 词的分界：词的开头在这些字符之后（或在开头）。 */
const BOUNDARY = /[\s/\\\-_.:,;()[\]·|]/

const atBoundary = (text: string, i: number) => i === 0 || BOUNDARY.test(text.charAt(i - 1))

/** `word` 的字符是否按顺序出现在 `text` 中（不必连续）。 */
function subsequence(word: string, text: string): boolean {
  let at = 0
  for (const ch of word) {
    at = text.indexOf(ch, at)
    if (at < 0) return false
    at += ch.length
  }
  return true
}

/** 一个词的得分；0 表示没有命中。 */
function scoreWord(word: string, title: string, keywords: string): number {
  const inTitle = title.indexOf(word)
  if (inTitle === 0) return 100
  if (inTitle > 0) {
    // 标题中可能多处出现，取最好的一处
    for (let i = inTitle; i >= 0; i = title.indexOf(word, i + 1))
      if (atBoundary(title, i)) return 80
    return 60
  }
  const inKeywords = keywords.indexOf(word)
  if (inKeywords >= 0) return atBoundary(keywords, inKeywords) ? 50 : 40
  // 只有一个字符时「按顺序出现」等于「出现」，上面已经判断过
  if ([...word].length > 1 && subsequence(word, title)) return 20
  return 0
}

/**
 * Filters and ranks items for a query, as the command palette does. The query is split at whitespace and every
 * word must match (case-insensitive): as consecutive text in the title or the keywords, or as letters that appear
 * in order in the title (fuzzy, such as `dvc` for "Dev Center"). Matches at the start of the title rank first,
 * then at the start of a word of the title, inside the title, in the keywords, and fuzzy matches last; with several
 * words, the ranks of the words add up. Items with the same rank keep their order. An empty query returns all items.
 *
 * `items` are any objects with a `title` and optional `keywords` (a string or an array of strings); `query` is the
 * text typed by the user. Returns a new array with the matching items, best first; `items` is not changed. Use it to
 * filter your own list the way CommandPalette does.
 * @zh 按查询筛选并排序条目（与命令面板相同）。查询按空白分词，每个词都要命中（不区分大小写）：标题或关键词中的连续文字，
 * 或者按顺序出现在标题中的字符（模糊匹配，如 `dvc` 命中 “Dev Center”）。标题开头命中的排在最前，其次是标题中词的开头、
 * 标题中间、关键词，模糊匹配排在最后；有多个词时各词的得分相加。得分相同的保持原来的顺序。空查询返回全部条目。
 *
 * `items` 是带 `title` 与可选 `keywords`（字符串或字符串数组）的任意对象；`query` 是用户输入的文字。返回新数组，
 * 包含命中的条目，最匹配的在前；不修改 `items`。用于像 CommandPalette 那样筛选自己的列表。
 * @group Utilities
 */
export function matchCommands<T extends CommandMatchable>(items: readonly T[], query: string): T[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return [...items]
  const scored: { item: T; score: number; index: number }[] = []
  items.forEach((item, index) => {
    const title = item.title.toLowerCase()
    const raw = item.keywords
    const keywords = (typeof raw === 'string' ? raw : (raw ?? []).join(' ')).toLowerCase()
    let score = 0
    for (const word of words) {
      const s = scoreWord(word, title, keywords)
      if (!s) return
      score += s
    }
    scored.push({ item, score, index })
  })
  return scored.sort((a, b) => b.score - a.score || a.index - b.index).map((s) => s.item)
}
