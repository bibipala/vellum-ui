import { Button, Form, Inline, Input, Select, Switch } from 'vellum-ui'

/**
 * Basic usage
 * Put fields in `Form.Item` and declare validation with `rules`; on submit, `onFinish` receives the values of all
 * fields.
 * @zh 基本用法
 * 字段放在 Form.Item 中，`rules` 声明校验；提交时 `onFinish` 收到全部字段值。
 */
export function Basic() {
  return (
    <Form layout="vertical" onFinish={() => {}}>
      <Form.Item
        label="Project name"
        name="name"
        rules={[{ required: true, message: 'Enter a name' }]}
      >
        <Input placeholder="For example: Website redesign" />
      </Form.Item>
      <Form.Item label="Visibility" name="visibility" initialValue="team">
        <Select
          options={[
            { value: 'team', label: 'Team only' },
            { value: 'public', label: 'Public' },
          ]}
        />
      </Form.Item>
      <Form.Item label="Notifications" name="notify" valuePropName="checked" initialValue>
        <Switch />
      </Form.Item>
      <Button variant="primary" type="submit">
        Save
      </Button>
    </Form>
  )
}

/**
 * Form instance
 * `Form.useForm()` returns an instance that validates and submits the form from outside, such as the confirm
 * button of a dialog.
 * @zh 表单实例
 * `Form.useForm()` 取得实例，在弹窗的确认按钮等表单外部触发校验与提交。
 * @section Advanced
 */
export function WithInstance() {
  const [form] = Form.useForm<{ title: string }>()
  return (
    <Form form={form} layout="vertical">
      <Form.Item
        label="Task name"
        name="title"
        rules={[{ required: true, message: 'Enter a task name' }]}
      >
        <Input />
      </Form.Item>
      <Inline>
        <Button variant="primary" onClick={() => form.submit()}>
          Submit
        </Button>
        <Button onClick={() => form.resetFields()}>Reset</Button>
      </Inline>
    </Form>
  )
}
