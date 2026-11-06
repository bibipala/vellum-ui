import { Inline, Progress, Stack } from 'vellum-ui'

/**
 * Basic usage
 * A line in the accent color with the percentage after it.
 * @zh 基本用法
 * 强调色的线形进度，后面显示百分比。
 */
export function Basic() {
  return <Progress percent={45} aria-label="Import progress" />
}

/**
 * Ring
 * `type="circle"` shows a ring with the percentage in the middle; `size` sets its diameter.
 * @zh 环形
 * `type="circle"` 显示进度环，百分比在中间；`size` 设置直径。
 * @section Variants
 */
export function Circle() {
  return (
    <Inline gap={5} align="center">
      <Progress type="circle" percent={72} aria-label="Storage used" />
      <Progress type="circle" percent={30} size={64} aria-label="Profile completed" />
      <Progress type="dashboard" percent={88} size={96} aria-label="Quota" />
    </Inline>
  )
}

/**
 * Completed and failed
 * At 100% it becomes `success` with a check mark; `status="exception"` shows a failure.
 * @zh 完成与失败
 * 到 100% 自动为 `success` 并显示勾；`status="exception"` 表示失败。
 * @section States
 */
export function States() {
  return (
    <Stack gap={3}>
      <Progress percent={100} />
      <Progress percent={60} status="exception" />
      <Inline gap={5}>
        <Progress type="circle" percent={100} size={72} />
        <Progress type="circle" percent={40} size={72} status="exception" />
      </Inline>
    </Stack>
  )
}

/**
 * Small and without text
 * `size="small"` for lists; `showInfo={false}` hides the number.
 * @zh 小尺寸与不显示数字
 * 列表中用 `size="small"`；`showInfo={false}` 不显示数字。
 * @section Variants
 */
export function Small() {
  return (
    <Stack gap={3}>
      <Progress percent={30} size="small" />
      <Progress percent={70} showInfo={false} />
    </Stack>
  )
}
