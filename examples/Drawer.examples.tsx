import { useState } from 'react'
import { Button, Descriptions, Drawer, Section } from 'vellum-ui'

/**
 * Basic usage
 * Slides in from the right to show details while keeping the context of the list.
 * @zh 基本用法
 * 从右侧滑出查看详情，保留列表的上下文。
 */
export function Basic() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>View member</Button>
      <Drawer title="Alex Morgan" open={open} onClose={() => setOpen(false)} size={480}>
        <Section title="Details">
          <Descriptions
            column={1}
            items={[
              { key: 'team', label: 'Team', children: 'Design' },
              { key: 'role', label: 'Role', children: 'Editor' },
            ]}
          />
        </Section>
      </Drawer>
    </>
  )
}
