import { Button, Inline, Spacer, Text } from 'vellum-ui'

/**
 * Basic usage
 * Pushes the following elements to the right inside an Inline.
 * @zh 基本用法
 * 在 Inline 中把后面的元素推到右侧。
 */
export function Basic() {
  return (
    <Inline>
      <Text weight="semibold">Projects</Text>
      <Spacer />
      <Button>Import</Button>
      <Button type="primary">New</Button>
    </Inline>
  )
}
