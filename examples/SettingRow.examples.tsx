import { InputNumber, Panel, SettingRow, Switch } from 'vellum-ui'

/**
 * Basic usage
 * Name and description on the left, the control on the right; dividers are added between rows automatically.
 * @zh 基本用法
 * 名称与说明在左，控件在右；多行之间自动加分隔线。
 */
export function Basic() {
  return (
    <Panel>
      <SettingRow
        title="Recall time limit (minutes)"
        description="How many minutes after sending a message can be recalled; 0 disables recalling"
        control={<InputNumber min={0} max={1440} defaultValue={2} />}
      />
      <SettingRow
        title="New members can see earlier messages"
        control={<Switch defaultChecked />}
      />
    </Panel>
  )
}
