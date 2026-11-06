import { Avatar, ListItem, VirtualList } from 'vellum-ui'
import { DemoFrame } from './_frame.tsx'

const people = Array.from({ length: 2000 }, (_, i) => ({ id: String(i), name: `Member ${i + 1}` }))

/**
 * Basic usage
 * Of two thousand rows, only the visible part is rendered; the height comes from the parent element (in a real
 * page, put it in `Page fill` / `Panel fill`).
 * @zh 基本用法
 * 两千行只渲染可见部分；容器高度由父元素决定（实际页面放在 Page fill / Panel fill 里）。
 */
export function Basic() {
  return (
    <DemoFrame>
      <VirtualList
        items={people}
        getKey={(p) => p.id}
        renderItem={(p) => <ListItem leading={<Avatar name={p.name} size={28} />} title={p.name} />}
      />
    </DemoFrame>
  )
}
