import { Avatar, Inline } from 'vellum-ui'

/**
 * Basic usage
 * Shows the first character of the name and picks one of five tones from the name, so the same name has the same
 * color everywhere. Common sizes are 20, 28 and 32.
 * @zh 基本用法
 * 取名称首字，按名称稳定地取五种色调之一（同一名称在各处颜色相同）；尺寸常用 20、28、32。
 */
export function Basic() {
  return (
    <Inline gap={3}>
      <Avatar name="Design" size={20} />
      <Avatar name="Alex Morgan" size={28} />
      <Avatar name="Sam Lee" />
      <Avatar name="Jordan Kim" />
      <Avatar name="Taylor Reed" />
      <Avatar name="Riley Chen" />
    </Inline>
  )
}

/**
 * Ring and icon
 * `ring` adds an accent ring for avatars that should stand out, such as teams or the current user; `icon` shows an
 * icon instead of text (for example, system notifications) on a neutral fill.
 * @zh 外环与图标
 * `ring` 加强调色外环，用于团队、当前用户等需要突出的头像；`icon` 以图标代替文字（如系统通知），底色为中性填充。
 * @section Variants
 */
export function RingAndIcon() {
  return (
    <Inline gap={3}>
      <Avatar name="All members" ring />
      <Avatar name="System notifications" icon="bell" />
      <Avatar name="System notifications" icon="bell" ring />
    </Inline>
  )
}

/**
 * Status badge
 * `status` takes a tone of StatusDot and appears at the bottom right; `statusLabel` is its accessible name.
 * @zh 状态角标
 * `status` 取 StatusDot 的色调，显示在右下角；`statusLabel` 是读屏名称。
 * @section Variants
 */
export function WithStatus() {
  return (
    <Inline gap={3}>
      <Avatar name="Alex Morgan" size={32} status="success" statusLabel="Online" />
      <Avatar name="Sam Lee" size={32} status="warning" statusLabel="Away" />
      <Avatar name="Casey Brooks" size={20} status="neutral" statusLabel="Offline" />
    </Inline>
  )
}
