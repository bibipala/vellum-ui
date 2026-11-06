import type { Meta, StoryObj } from '@storybook/react-vite'
import { useMemo, useState } from 'react'
import { ImageGrid, Lightbox } from '../src/index.ts'
import { sampleImages } from './sample.ts'
import styles from './stories.module.css'

const meta: Meta = { title: 'Overview/Media' }
export default meta

function GridDemo({ count }: { count: number }) {
  const items = useMemo(() => sampleImages(count), [count])
  const [index, setIndex] = useState<number | null>(null)
  return (
    <div className={styles.page}>
      <div className={styles.gridBox}>
        <ImageGrid items={items} onOpen={(i) => setIndex(i)} />
      </div>
      <Lightbox
        open={index !== null}
        items={items}
        index={index ?? 0}
        onIndexChange={setIndex}
        onClose={() => setIndex(null)}
      />
    </div>
  )
}

export const ImageGrid10k: StoryObj = {
  name: 'ImageGrid with 10,000 images (virtualized)',
  render: () => <GridDemo count={10000} />,
}

export const ImageGridEmpty: StoryObj = {
  name: 'ImageGrid, empty',
  render: () => <GridDemo count={0} />,
}

function LightboxDemo() {
  const items = useMemo(() => sampleImages(5), [])
  const [index, setIndex] = useState(0)
  return (
    <Lightbox open items={items} index={index} onIndexChange={setIndex} onClose={() => undefined} />
  )
}

export const LightboxStory: StoryObj = {
  name: 'Lightbox (neutral background)',
  render: () => <LightboxDemo />,
}
