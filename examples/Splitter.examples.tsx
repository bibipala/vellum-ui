import { useState } from 'react'
import { Box, ListItem, Splitter, Stack, Text } from 'vellum-ui'
import { DemoFrame } from './_frame.tsx'

/**
 * Basic usage
 * A resizable list next to the details: drag the handle, or focus it with `Tab` and use `←` / `→`, `Home` and
 * `End`. The Splitter fills its parent, so the parent needs a height.
 * @zh 基本用法
 * 可调宽度的列表加详情：拖动手柄，或用 `Tab` 聚焦后按 `←` / `→`、`Home`、`End`。Splitter 占满父元素，父元素需要有高度。
 */
export function Basic() {
  return (
    <DemoFrame>
      <Splitter defaultSize={220} min={160} max={360} aria-label="Resize the file list">
        <Box surface="canvas" padding={2} grow>
          <Stack gap={1}>
            <ListItem title="Brief.pdf" selected onClick={() => {}} />
            <ListItem title="Moodboard.png" onClick={() => {}} />
            <ListItem title="Budget.xlsx" onClick={() => {}} />
          </Stack>
        </Box>
        <Stack padding={4}>
          <Text weight="semibold">Brief.pdf</Text>
          <Text tone="secondary">Updated 2 hours ago by Alex Kim</Text>
        </Stack>
      </Splitter>
    </DemoFrame>
  )
}

/**
 * Vertical
 * `direction="vertical"` stacks the panes; with `primary="end"` the size belongs to the bottom panel, and the
 * top pane takes the rest.
 * @zh 上下分栏
 * `direction="vertical"` 上下排列；`primary="end"` 时尺寸属于底部面板，上面的窗格占满剩余空间。
 * @section Variants
 */
export function Vertical() {
  return (
    <DemoFrame>
      <Splitter direction="vertical" primary="end" defaultSize={120} min={64}>
        <Stack padding={4}>
          <Text>Editor</Text>
        </Stack>
        <Box surface="sunken" padding={3} grow>
          <Text mono size="xs">
            Build finished in 1.2 s
          </Text>
        </Box>
      </Splitter>
    </DemoFrame>
  )
}

/**
 * Remembered size
 * With `storageKey`, the size is saved on this device and restored on the next visit. `onSizeChange` reports
 * every change.
 * @zh 记住尺寸
 * 设置 `storageKey` 后，尺寸保存在本机，下次打开时恢复。`onSizeChange` 报告每次变化。
 * @section Advanced
 */
export function Remembered() {
  const [size, setSize] = useState<number | null>(null)
  return (
    <DemoFrame>
      <Splitter storageKey="examples.splitter" defaultSize={240} min={120} onSizeChange={setSize}>
        <Box surface="canvas" padding={4} grow>
          <Text tone="secondary">Sidebar</Text>
        </Box>
        <Stack padding={4}>
          <Text numeric>{size === null ? 'Drag the handle' : `${size} px`}</Text>
        </Stack>
      </Splitter>
    </DemoFrame>
  )
}
