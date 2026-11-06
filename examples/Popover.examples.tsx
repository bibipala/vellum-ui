import { Avatar, Button, Inline, Input, LinkButton, Popover, Stack, Text } from 'vellum-ui'

/**
 * Basic usage
 * Opens on hover, and on keyboard focus with `trigger={['hover', 'focus']}`; focus is not moved. The trigger must
 * accept mouse and focus events, such as Button, LinkButton or IconButton (layout primitives such as Inline do not).
 * @zh 基本用法
 * 悬停时打开，`trigger={['hover', 'focus']}` 时键盘聚焦也打开；不移动焦点。触发元素必须能接收鼠标与焦点事件，
 * 如 Button、LinkButton、IconButton（Inline 等布局原语不行）。
 */
export function Basic() {
  return (
    <Inline gap={2} align="center">
      <Avatar name="Alex Morgan" size={28} />
      <Popover
        trigger={['hover', 'focus']}
        title="Alex Morgan"
        content={
          <Stack gap={1}>
            <Text size="sm" tone="secondary">
              Product designer · Design team
            </Text>
            <Text size="sm">alex.morgan@example.com</Text>
          </Stack>
        }
      >
        <LinkButton>Alex Morgan</LinkButton>
      </Popover>
    </Inline>
  )
}

/**
 * Opened by click
 * With `trigger="click"`, focus moves into the popover; `Esc` closes it and focus returns to the button.
 * @zh 点击打开
 * `trigger="click"` 时焦点移入气泡卡片；`Esc` 关闭，焦点回到按钮。
 * @section Variants
 */
export function Click() {
  return (
    <Inline>
      <Popover
        trigger="click"
        title="Rename"
        content={
          <Stack gap={2}>
            <Input defaultValue="Website redesign" aria-label="Name" />
            <Inline gap={2} justify="end">
              <Button type="primary" size="small">
                Save
              </Button>
            </Inline>
          </Stack>
        }
      >
        <Button>Rename</Button>
      </Popover>
    </Inline>
  )
}
