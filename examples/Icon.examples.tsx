import { Icon, Inline } from 'vellum-ui'

/**
 * Basic usage
 * Referenced by name; the color follows the text color.
 * @zh 基本用法
 * 按名称引用；颜色继承文字颜色。
 */
export function Basic() {
  return (
    <Inline gap={3}>
      <Icon name="folder" />
      <Icon name="messages" />
      <Icon name="users" size={20} />
      <Icon name="alert" label="Warning" />
    </Inline>
  )
}
