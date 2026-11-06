import { useState } from 'react'
import { Button, Form, Input, Modal, Stack, Text } from 'vellum-ui'

/**
 * Basic usage
 * Put forms for creating and editing in a dialog; set `okLoading` while submitting.
 * @zh 基本用法
 * 新建与编辑的表单放在对话框中；提交中给确认按钮 `okLoading`。
 */
export function Basic() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        New project
      </Button>
      <Modal
        title="New project"
        open={open}
        okText="Create"
        onOk={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      >
        <Form layout="vertical">
          <Form.Item label="Project name" name="title" rules={[{ required: true }]}>
            <Input autoFocus />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

/**
 * Flush content
 * `flush` removes the padding of the dialog so that the content lays itself out and fits the rounded corners, like
 * the search box and result list of a command palette.
 * @zh 内容贴边
 * `flush` 去掉对话框的内边距，内容自己排版并贴合圆角，如命令面板的搜索框与结果列表。
 * @section Variants
 */
export function Flush() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open command palette</Button>
      <Modal
        open={open}
        flush
        title={null}
        footer={null}
        closable={false}
        onCancel={() => setOpen(false)}
      >
        <Input size="lg" variant="borderless" placeholder="Search pages and commands" autoFocus />
        <Stack padding={4}>
          <Text tone="secondary">The result list is shown flush</Text>
        </Stack>
      </Modal>
    </>
  )
}
