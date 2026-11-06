import { CountBadge, Inline } from 'vellum-ui'

/**
 * Basic usage
 * Neutral for plain counts, accent for unread and to-do items; hidden when the count is 0.
 * @zh 基本用法
 * 普通计数用中性色，未读与待办用强调色；为 0 时不显示。
 */
export function Basic() {
  return (
    <Inline>
      <CountBadge count={12} />
      <CountBadge count={3} tone="accent" />
      <CountBadge count={128} tone="accent" />
      <CountBadge count={0} />
    </Inline>
  )
}
