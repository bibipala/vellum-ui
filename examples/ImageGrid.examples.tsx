import { useMemo, useState } from 'react'
import { ImageGrid, Lightbox } from 'vellum-ui'
import { sampleImages } from '../stories/sample.ts'
import { DemoFrame } from './_frame.tsx'

/**
 * Basic usage
 * Click an image to view it larger in a Lightbox; the height of the container comes from its parent.
 * @zh 基本用法
 * 点击图片用 Lightbox 放大查看；容器高度由父元素决定。
 */
export function Basic() {
  const items = useMemo(() => sampleImages(60), [])
  const [index, setIndex] = useState<number | null>(null)
  return (
    <DemoFrame>
      <ImageGrid items={items} onOpen={(i) => setIndex(i)} />
      <Lightbox
        open={index !== null}
        items={items}
        index={index ?? 0}
        onIndexChange={setIndex}
        onClose={() => setIndex(null)}
      />
    </DemoFrame>
  )
}

/**
 * Empty state
 * @zh 空状态
 * @section States
 */
export function Empty() {
  return (
    <DemoFrame>
      <ImageGrid items={[]} />
    </DemoFrame>
  )
}
