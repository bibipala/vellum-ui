import type { Meta, StoryObj } from '@storybook/react-vite'
import { type ReactNode, useState } from 'react'
import {
  Button,
  DataTable,
  EmptyState,
  Form,
  Input,
  LinkButton,
  Loading,
  Modal,
  Pill,
  Select,
  Skeleton,
  Text,
  Tree,
} from '../src/index.ts'
import styles from './stories.module.css'

const meta: Meta = { title: 'Overview/Basics' }
export default meta

type Story = StoryObj

const Page = ({ children }: { children: ReactNode }) => (
  <div className={styles.page}>
    <div className={styles.row}>{children}</div>
  </div>
)

export const ButtonStory: Story = {
  name: 'Button',
  render: () => (
    <Page>
      <Button type="primary">Save</Button>
      <Button>Cancel</Button>
      <Button type="dashed">Add</Button>
      <LinkButton>Text link</LinkButton>
      <Button danger>Delete</Button>
      <Button loading type="primary">
        Submitting
      </Button>
    </Page>
  ),
}

export const InputStory: Story = {
  name: 'Input',
  render: () => (
    <Page>
      <Input placeholder="Project name" />
      <Input.Password placeholder="Password" />
      <Input.Search placeholder="Search" />
    </Page>
  ),
}

export const SelectStory: Story = {
  name: 'Select',
  render: () => (
    <Page>
      <Select
        placeholder="Choose a category"
        options={[
          { value: 'design', label: 'Design' },
          { value: 'dev', label: 'Engineering' },
          { value: 'ops', label: 'Operations' },
        ]}
      />
      <Select
        mode="multiple"
        defaultValue={['design']}
        options={[
          { value: 'design', label: 'Design' },
          { value: 'dev', label: 'Engineering' },
        ]}
      />
    </Page>
  ),
}

export const TableStory: Story = {
  name: 'DataTable (tabular numbers)',
  render: () => (
    <div className={styles.page}>
      <DataTable
        aria-label="Projects"
        rowKey={(r) => r.id}
        rows={Array.from({ length: 8 }, (_, i) => ({
          id: String(i),
          name: `Sample project ${i + 1}`,
          qty: String((i + 1) * 11),
          amount: `${(i + 1) * 1111}.00`,
        }))}
        columns={[
          { key: 'name', title: 'Name' },
          { key: 'qty', title: 'Quantity', align: 'end' },
          {
            key: 'amount',
            title: 'Amount',
            align: 'end',
            render: (r) => <Text numeric>{r.amount}</Text>,
          },
        ]}
      />
      <DataTable
        aria-label="Projects"
        rowKey={(r: { id: string; name: string }) => r.id}
        rows={[]}
        columns={[{ key: 'name', title: 'Name' }]}
      />
    </div>
  ),
}

export const FormStory: Story = {
  name: 'Form',
  render: () => (
    <div className={styles.page}>
      <Form layout="vertical">
        <Form.Item label="Project name" name="name" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item label="Category" name="kind">
          <Select options={[{ value: 'design', label: 'Design' }]} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit">
            Save
          </Button>
        </Form.Item>
      </Form>
    </div>
  ),
}

function ModalDemo() {
  const [open, setOpen] = useState(false)
  return (
    <Page>
      <Button type="primary" onClick={() => setOpen(true)}>
        Open dialog
      </Button>
      <Modal
        title="Archive project"
        open={open}
        onOk={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      >
        Archived projects can be restored from the trash.
      </Modal>
    </Page>
  )
}

export const ModalStory: Story = { name: 'Modal', render: () => <ModalDemo /> }

export const TreeStory: Story = {
  name: 'Tree',
  render: () => (
    <Page>
      <Tree
        defaultExpandAll
        treeData={[
          {
            key: 'a',
            title: 'Design',
            children: [
              { key: 'a1', title: 'Website redesign' },
              { key: 'a2', title: 'Brand guidelines' },
            ],
          },
          { key: 'b', title: 'Shared' },
        ]}
      />
    </Page>
  ),
}

export const PillStory: Story = {
  name: 'Pill',
  render: () => (
    <Page>
      <Pill>Default</Pill>
      <Pill tone="success">Delivered</Pill>
      <Pill tone="warning">In review</Pill>
      <Pill tone="danger">Returned</Pill>
    </Page>
  ),
}

export const EmptyStory: Story = {
  name: 'EmptyState',
  render: () => (
    <Page>
      <EmptyState />
    </Page>
  ),
}

export const LoadingStory: Story = {
  name: 'Loading / Skeleton',
  render: () => (
    <div className={styles.page}>
      <Loading />
      <Skeleton active />
    </div>
  ),
}
