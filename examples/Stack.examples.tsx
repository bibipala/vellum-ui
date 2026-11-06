import { Box, Button, Stack, Text } from 'vellum-ui'

/**
 * Basic usage
 * Vertical arrangement with a default gap of step 3 (12 px).
 * @zh 基本用法
 * 纵向排列，默认间距档位 3（12px）。
 */
export function Basic() {
  return (
    <Stack>
      <Box surface="sunken" radius="md" padding={3}>
        First block
      </Box>
      <Box surface="sunken" radius="md" padding={3}>
        Second block
      </Box>
      <Box surface="sunken" radius="md" padding={3}>
        Third block
      </Box>
    </Stack>
  )
}

/**
 * Tight and loose gaps
 * Gaps only take steps 0–8, consistent across the application.
 * @zh 紧凑与宽松的间距
 * 间距只能取 0–8 档位，与整个应用一致。
 * @section Variants
 */
export function Gaps() {
  return (
    <Stack gap={5}>
      <Stack gap={1}>
        <Text weight="semibold">Title</Text>
        <Text tone="secondary" size="sm">
          A description right below its title uses step 1
        </Text>
      </Stack>
      <Stack gap={1}>
        <Text weight="semibold">Another group</Text>
        <Text tone="secondary" size="sm">
          The two groups are separated by step 5
        </Text>
      </Stack>
    </Stack>
  )
}

/**
 * Form group
 * Step 4 between form fields, the button at the bottom aligned to the right.
 * @zh 表单分组
 * 表单项之间档位 4，底部按钮右对齐。
 * @section Advanced
 */
export function FormGroup() {
  return (
    <Stack gap={4} padding={4}>
      <Text overline>Details</Text>
      <Text>Name</Text>
      <Text>Description</Text>
      <Stack align="end">
        <Button type="primary">Save</Button>
      </Stack>
    </Stack>
  )
}
