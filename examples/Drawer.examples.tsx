import { useState } from 'react'
import { Button, Descriptions, Drawer, Form, Inline, Input, Section, Select } from 'vellum-ui'

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
      <Drawer title="Alex Morgan" open={open} onClose={() => setOpen(false)} width={480}>
        <Section level={4} title="Details">
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

/**
 * Footer actions
 * Put Cancel and Save in `footer`: they stay at the bottom while the content scrolls. Submit the form from the
 * footer with the instance from `Form.useForm()`.
 * @zh 底部操作
 * 「取消」「保存」放在 `footer` 中，内容滚动时保持在底部。用 `Form.useForm()` 的实例从底部提交表单。
 */
export function WithFooter() {
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm<{ name: string; role: string }>()
  const close = () => setOpen(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Edit member</Button>
      <Drawer
        title="Edit member"
        open={open}
        onClose={close}
        width={480}
        footer={
          <Inline justify="end">
            <Button onClick={close}>Cancel</Button>
            <Button variant="primary" onClick={() => form.submit()}>
              Save
            </Button>
          </Inline>
        }
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ name: 'Alex Morgan', role: 'editor' }}
          onFinish={close}
        >
          <Form.Item label="Name" name="name" rules={[{ required: true, message: 'Enter a name' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Role" name="role">
            <Select
              options={[
                { value: 'viewer', label: 'Viewer' },
                { value: 'editor', label: 'Editor' },
                { value: 'admin', label: 'Admin' },
              ]}
            />
          </Form.Item>
        </Form>
      </Drawer>
    </>
  )
}
