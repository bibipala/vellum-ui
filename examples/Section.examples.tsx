import { Button, Section, Text } from 'vellum-ui'

/**
 * Basic usage
 * A group of content inside a page or a drawer.
 * @zh 基本用法
 * 页面或抽屉内的一组内容。
 */
export function Basic() {
  return (
    <Section
      title="Grants"
      description="Teams or members that have this role"
      actions={<Button size="small">Add grant</Button>}
    >
      <Text tone="secondary">(list of grants)</Text>
    </Section>
  )
}
