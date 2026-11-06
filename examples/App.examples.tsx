import { App, Button, useMessage } from 'vellum-ui'

function SaveButton() {
  const message = useMessage()
  return (
    <Button variant="primary" onClick={() => message.success('Saved')}>
      Save
    </Button>
  )
}

/**
 * Basic usage
 * Place it inside ThemeProvider at the root of the application; only components inside it can use useMessage
 * and useConfirmDanger. Messages appear at the bottom center of the screen.
 * @zh 基本用法
 * 放在 ThemeProvider 之内、应用最外层；其中的组件才能使用 useMessage 与 useConfirmDanger。消息条显示在屏幕底部居中。
 */
export function Basic() {
  return (
    <App>
      <SaveButton />
    </App>
  )
}
