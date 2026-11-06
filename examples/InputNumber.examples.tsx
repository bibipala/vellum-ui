import { InputNumber, Panel, SettingRow } from 'vellum-ui'

/**
 * Basic usage
 * Set lower and upper limits; digits use tabular figures.
 * @zh 基本用法
 * 设置数值上下限；数字使用等宽字形。
 */
export function Basic() {
  return <InputNumber min={0} max={1440} defaultValue={2} />
}

/**
 * In a setting
 * Place it in the `control` of a SettingRow.
 * @zh 设置项
 * 放在 SettingRow 的 control 中。
 * @section Advanced
 */
export function InSetting() {
  return (
    <Panel>
      <SettingRow
        title="Recall time limit (minutes)"
        description="How many minutes after sending a message can be recalled; 0 means it cannot be recalled"
        control={<InputNumber min={0} max={1440} defaultValue={2} />}
      />
    </Panel>
  )
}

/**
 * Exact values
 * Use `stringMode` for amounts and quantities: the value is passed as a string and never goes through
 * floating-point numbers.
 * @zh 精确数值
 * 金额、数量用 `stringMode`，值以字符串传递，不经过浮点。
 * @section Variants
 */
export function StringMode() {
  return <InputNumber decimal step="0.01" min="0" defaultValue="1280.50" />
}
