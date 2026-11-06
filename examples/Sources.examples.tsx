import { type SourceItem, Sources } from 'vellum-ui'

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
  {
    title: 'Internal retro notes',
    url: '/notes/retro-12',
    description: 'Notes from the last retrospective of the platform team.',
  },
]

/**
 * Basic usage
 * The list is collapsed to "3 sources" at first; expand it to see the numbered sources with their site and a short
 * description.
 * @zh 基本用法
 * 列表一开始收起为「3 个来源」；展开后是有编号的来源，带站点与简短说明。
 */
export function Basic() {
  return <Sources items={SOURCES} />
}

/**
 * Expanded, with icons
 * `defaultExpanded` shows the list at once. Site icons are never loaded automatically: pass your own in `icon`.
 * @zh 展开并带图标
 * `defaultExpanded` 一开始就展开列表。不会自动加载网站图标：在 `icon` 中传入自己的图标。
 * @section Variants
 */
export function Expanded() {
  return (
    <Sources
      defaultExpanded
      items={SOURCES.map((s, i) => ({
        ...s,
        icon: (
          <svg viewBox="0 0 16 16" aria-hidden>
            <title>Site</title>
            <rect width="16" height="16" rx="4" fill="currentColor" opacity={0.2 + i * 0.2} />
          </svg>
        ),
      }))}
    />
  )
}
