import { useMemo, useState } from 'react'
import { Button, Lightbox } from 'vellum-ui'
import { sampleImages } from '../stories/sample.ts'

/**
 * Basic usage
 * Opened and switched as a controlled component; the viewer background is a neutral gray by default and does not
 * change with the theme.
 * @zh 基本用法
 * 受控打开与切换；看图背景默认为中性灰，不随主题变化。
 */
export function Basic() {
  const items = useMemo(() => sampleImages(5), [])
  const [index, setIndex] = useState<number | null>(null)
  return (
    <>
      <Button onClick={() => setIndex(0)}>View images</Button>
      <Lightbox
        open={index !== null}
        items={items}
        index={index ?? 0}
        onIndexChange={setIndex}
        onClose={() => setIndex(null)}
      />
    </>
  )
}
