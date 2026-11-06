import { Inline, Progress, Stack } from 'vellum-ui'

/**
 * Basic usage
 * A line in the accent color with the percentage after it; the track is a lighter step of the same color.
 * @zh 基本用法
 * 强调色的线形进度，后面显示百分比；轨道是同一颜色更浅的一级。
 */
export function Basic() {
  return <Progress percent={45} aria-label="Import progress" />
}

/**
 * Ring
 * `variant="circle"` shows a ring with the percentage in the middle; `size` sets its diameter.
 * @zh 环形
 * `variant="circle"` 显示进度环，百分比在中间；`size` 设置直径。
 * @section Variants
 */
export function Circle() {
  return (
    <Inline gap={5} align="center">
      <Progress variant="circle" size="sm" percent={30} aria-label="Profile completed" />
      <Progress variant="circle" percent={72} aria-label="Storage used" />
      <Progress variant="circle" size="lg" percent={88} aria-label="Quota used" />
    </Inline>
  )
}

/**
 * Levels
 * For a level against a limit, such as storage, `tone` shows how serious it is: the fill and its track both
 * change color, so the level reads across the whole bar.
 * @zh 程度
 * 相对上限的用量（如存储空间）用 `tone` 表示程度：填充与轨道一起变色，整条都读得出程度。
 * @section Variants
 */
export function Levels() {
  return (
    <Stack gap={3}>
      <Progress percent={48} aria-label="Storage used, team A" />
      <Progress percent={84} tone="warning" aria-label="Storage used, team B" />
      <Progress percent={97} tone="danger" aria-label="Storage used, team C" />
    </Stack>
  )
}

/**
 * Completed and failed
 * At 100% it becomes `success` with a check mark; `status="error"` shows a failure with a cross.
 * @zh 完成与失败
 * 到 100% 自动为 `success` 并显示勾；`status="error"` 表示失败，显示叉。
 * @section States
 */
export function States() {
  return (
    <Stack gap={3}>
      <Progress percent={100} aria-label="Upload of report.pdf" />
      <Progress percent={60} status="error" aria-label="Upload of photos.zip" />
      <Inline gap={5}>
        <Progress variant="circle" percent={100} aria-label="Sync" />
        <Progress variant="circle" percent={40} status="error" aria-label="Backup" />
      </Inline>
    </Stack>
  )
}

/**
 * Small and without text
 * `size="sm"` for lists; `showValue={false}` hides the number.
 * @zh 小尺寸与不显示数字
 * 列表中用 `size="sm"`；`showValue={false}` 不显示数字。
 * @section Variants
 */
export function Small() {
  return (
    <Stack gap={3}>
      <Progress percent={30} size="sm" aria-label="Indexing" />
      <Progress percent={70} showValue={false} aria-label="Indexing" />
    </Stack>
  )
}
