import { Box, Text } from 'vellum-ui'

/**
 * Basic usage
 * A block with a background, rounded corners and padding.
 * @zh 基本用法
 * 有底色、圆角和内边距的区块。
 */
export function Basic() {
  return (
    <Box surface="sunken" radius="md" padding={4}>
      <Text tone="secondary">A sunken background suits notes and secondary information</Text>
    </Box>
  )
}

/**
 * Surfaces and borders
 * @zh 表面与描边
 * @section Variants
 */
export function Surfaces() {
  return (
    <Box surface="canvas" padding={4}>
      <Box surface="surface" border radius="lg" padding={4}>
        <Text>Panel surface with a hairline border</Text>
      </Box>
    </Box>
  )
}
