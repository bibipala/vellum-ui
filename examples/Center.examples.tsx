import { Center, Text } from 'vellum-ui'

/**
 * Basic usage
 * Shows a hint centered in an area.
 * @zh 基本用法
 * 在区域中居中显示提示。
 */
export function Basic() {
  return (
    <Center padding={6}>
      <Text tone="secondary">Select a conversation to start chatting</Text>
    </Center>
  )
}
