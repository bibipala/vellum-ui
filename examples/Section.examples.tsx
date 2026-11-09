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
      actions={<Button size="sm">Add grant</Button>}
    >
      <Text tone="secondary">(list of grants)</Text>
    </Section>
  )
}

/**
 * Levels
 * Nested Sections with `level` 2, 3 and 4 form the outline of a page below the title of Page; the sizes are those
 * of Heading. In drawers, dialogs and panels, use `level={4}`.
 * @zh 级别
 * 嵌套的 Section 用 `level` 2、3、4，在 Page 的标题之下组成页面的大纲；字号与 Heading 相同。在抽屉、弹窗与面板中用
 * `level={4}`。
 * @section Variants
 */
export function Levels() {
  return (
    <Section title="Installation" description="Add the package and its styles">
      <Section level={3} title="With pnpm">
        <Section level={4} title="Peer dependencies">
          <Text tone="secondary">(React 19 and React DOM)</Text>
        </Section>
      </Section>
    </Section>
  )
}
