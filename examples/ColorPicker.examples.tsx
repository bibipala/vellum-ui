import { useState } from 'react'
import { ColorPicker, Inline, Text } from 'vellum-ui'

/**
 * Basic usage
 * Click the swatch, or focus it with `Tab` and press `Enter`; `showText` shows the value next to it.
 * @zh 基本用法
 * 点击色块，或用 `Tab` 聚焦后按 `Enter`；`showText` 在旁边显示取值。
 */
export function Basic() {
  const [value, setValue] = useState('#2D6BF3')
  return (
    <Inline gap={3} align="center">
      <ColorPicker
        value={value}
        onChange={(color) => setValue(color.toHexString())}
        showText
        aria-label="Label color"
      />
      <Text tone="secondary" size="sm" mono>
        {value}
      </Text>
    </Inline>
  )
}

/**
 * Presets
 * `presets` offers a set of colors to pick from; `disabledAlpha` hides the alpha slider.
 * @zh 预设颜色
 * `presets` 提供一组可选的颜色；`disabledAlpha` 隐藏透明度滑条。
 * @section Variants
 */
export function Presets() {
  return (
    <ColorPicker
      defaultValue="#1F9D55"
      disabledAlpha
      presets={[
        {
          label: 'Labels',
          colors: ['#2D6BF3', '#1F9D55', '#E5A000', '#D64545', '#7C4DDB', '#1C9AAA'],
        },
      ]}
      aria-label="Tag color"
    />
  )
}

/**
 * Disabled
 * @zh 禁用
 * @section States
 */
export function Disabled() {
  return <ColorPicker defaultValue="#7C4DDB" disabled showText />
}
