import { Heading, Stack } from 'vellum-ui'

/**
 * Basic usage
 * Use Page for page titles and Section for groups; use Heading directly only in custom areas.
 * @zh 基本用法
 * 页面标题用 Page，分组用 Section；只有自定义区域才直接用 Heading。
 */
export function Basic() {
  return (
    <Stack gap={2}>
      <Heading level={2}>Block title</Heading>
      <Heading level={3}>Subsection title</Heading>
    </Stack>
  )
}
