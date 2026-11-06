import { useState } from 'react'
import { Inline, InputNumber, Slider, Stack } from 'vellum-ui'

/**
 * Basic usage
 * Drag the handle, or focus it with `Tab` and use the arrow keys.
 * @zh 基本用法
 * 拖动手柄，或用 `Tab` 聚焦后按方向键调整。
 */
export function Basic() {
  return <Slider defaultValue={40} aria-label="Opacity" />
}

/**
 * Range, marks and steps
 * `range` picks a start and an end; `marks` labels values and `step={null}` only allows the marked values.
 * @zh 范围、刻度与步长
 * `range` 选择起点与终点；`marks` 标注刻度，`step={null}` 时只能选刻度上的值。
 * @section Variants
 */
export function Variants() {
  return (
    <Stack gap={6}>
      <Slider range defaultValue={[20, 60]} />
      <Slider
        marks={{ 0: '0', 25: '25%', 50: '50%', 75: '75%', 100: '100%' }}
        step={null}
        defaultValue={50}
      />
    </Stack>
  )
}

/**
 * With a number input
 * When the exact value matters, put an InputNumber next to the slider.
 * @zh 配合数字输入
 * 需要精确数值时，在滑块旁边配一个 InputNumber。
 * @section Advanced
 */
export function WithInput() {
  const [value, setValue] = useState(30)
  return (
    <Inline gap={4} align="center">
      <Stack grow>
        <Slider min={0} max={100} value={value} onChange={setValue} aria-label="Quality" />
      </Stack>
      <InputNumber
        min={0}
        max={100}
        value={value}
        onChange={(v) => setValue(Number(v ?? 0))}
        aria-label="Quality"
      />
    </Inline>
  )
}

/**
 * Disabled
 * @zh 禁用
 * @section States
 */
export function Disabled() {
  return <Slider disabled defaultValue={60} />
}
