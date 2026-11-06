import { Citation, Markdown, type SourceItem, Sources, Stack, Text } from 'vellum-ui'

const SOURCES: readonly SourceItem[] = [
  {
    title: 'Shipping small releases',
    url: 'https://www.example.com/blog/shipping-small',
    description: 'Why teams that release weekly find problems earlier, and how to start.',
  },
  {
    title: 'Release checklist template',
    url: 'https://docs.example.org/templates/release',
    description: 'A one-page checklist covering scope, tests, notes and rollback.',
  },
]

/**
 * Basic usage
 * Place a Citation after the sentence it supports. Hover it or focus it with `Tab` to see the source; the number
 * links to it.
 * @zh 基本用法
 * 把 Citation 放在它所支撑的句子后面。悬停或用 `Tab` 聚焦即可看到来源；编号本身链接到来源。
 */
export function Basic() {
  return (
    <Text as="p">
      Smaller releases make problems easier to find
      <Citation index={1} source={SOURCES[0] as SourceItem} />, and a short checklist keeps them
      consistent
      <Citation index={2} source={SOURCES[1] as SourceItem} />.
    </Text>
  )
}

/**
 * In Markdown
 * Give Markdown the `sources` and it renders `[1]`, `[2]` in the reply as citations; put the list under the reply
 * with Sources.
 * @zh 在 Markdown 中
 * 给 Markdown 传入 `sources`，回复中的 `[1]`、`[2]` 就显示为引用；回复下方用 Sources 放来源列表。
 * @section Advanced
 */
export function InMarkdown() {
  return (
    <Stack gap={3}>
      <Markdown
        sources={SOURCES}
        content={
          'Release **weekly** if you can [1]. Use one checklist for every release [2], and keep it short. [3] has no source, so it stays as text.'
        }
      />
      <Sources items={SOURCES} />
    </Stack>
  )
}
