import { useState } from 'react'
import { DataTable, Descriptions, InlineEdit, Panel, Pill } from 'vellum-ui'

/**
 * Basic usage
 * Click a value, or press `Enter` or `F2`, to edit it; `Enter` or moving focus away saves and `Esc` cancels. The
 * new value is shown right away while the promise returned by `onSave` is pending. `validate` runs before saving.
 * @zh 基本用法
 * 点击值，或按 `Enter`、`F2` 进入编辑；`Enter` 或焦点离开时保存，`Esc` 取消。`onSave` 返回的 Promise 未完成时新值已经显示。
 * 保存前先经过 `validate` 校验。
 */
export function Basic() {
  const [name, setName] = useState('Website redesign')
  const [owner, setOwner] = useState<string | null>(null)
  return (
    <Descriptions
      column={1}
      items={[
        {
          key: 'name',
          label: 'Project name',
          children: (
            <InlineEdit
              label="Project name"
              value={name}
              maxLength={80}
              validate={(next) => (next?.trim() ? undefined : 'Enter a project name')}
              onSave={async (next) => {
                // Stands in for a request to the server
                await new Promise((resolve) => setTimeout(resolve, 600))
                setName(next ?? '')
              }}
            />
          ),
        },
        {
          key: 'owner',
          label: 'Owner',
          children: (
            <InlineEdit
              label="Owner"
              value={owner}
              placeholder="Add an owner"
              onSave={(next) => setOwner(next || null)}
            />
          ),
        },
      ]}
    />
  )
}

interface OrderLine {
  readonly id: string
  readonly item: string
  /** Decimal strings: quantities and prices never go through floating point. */
  readonly quantity: string
  readonly price: string
  readonly status: string
}

/**
 * In a table
 * Edit cells in place: a text, numbers (localized, with `precision` and a range) and a status chosen from
 * `options`. Both states have the same height, so the rows do not move. Numbers are passed as decimal strings.
 * @zh 在表格中
 * 在单元格中直接编辑：文字、数字（本地化，带 `precision` 与范围）、从 `options` 中选择的状态。两种状态同高，行不会跳动。
 * 数字以十进制字符串传递。
 */
export function InTable() {
  const [rows, setRows] = useState<OrderLine[]>([
    { id: '1', item: 'Linen canvas, 60 x 80 cm', quantity: '12', price: '48.5', status: 'ordered' },
    { id: '2', item: 'Oil paint set', quantity: '4', price: '129', status: 'shipped' },
    { id: '3', item: 'Easel', quantity: '1', price: '310.25', status: 'draft' },
  ])
  const update = (id: string, patch: Partial<OrderLine>) =>
    setRows((list) => list.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  const statuses = [
    { value: 'draft', label: 'Draft' },
    { value: 'ordered', label: 'Ordered' },
    { value: 'shipped', label: 'Shipped' },
  ]
  return (
    <Panel flush>
      <DataTable<OrderLine>
        aria-label="Order lines"
        rowKey={(row) => row.id}
        rows={rows}
        columns={[
          {
            key: 'item',
            title: 'Item',
            render: (row) => (
              <InlineEdit
                label="Item"
                value={row.item}
                validate={(next) => (next?.trim() ? undefined : 'Enter a name')}
                onSave={(next) => update(row.id, { item: next ?? '' })}
              />
            ),
          },
          {
            key: 'quantity',
            title: 'Quantity',
            width: 120,
            render: (row) => (
              <InlineEdit
                type="number"
                label="Quantity"
                value={row.quantity}
                precision={0}
                min={1}
                max={999}
                onSave={(next) => update(row.id, { quantity: next ?? '1' })}
              />
            ),
          },
          {
            key: 'price',
            title: 'Unit price',
            width: 140,
            render: (row) => (
              <InlineEdit
                type="number"
                label="Unit price"
                value={row.price}
                precision={2}
                min="0"
                onSave={(next) => update(row.id, { price: next ?? '0' })}
              />
            ),
          },
          {
            key: 'status',
            title: 'Status',
            width: 140,
            render: (row) => (
              <InlineEdit
                type="select"
                label="Status"
                value={row.status}
                options={statuses}
                render={(v) => (
                  <Pill tone={v === 'shipped' ? 'success' : v === 'ordered' ? 'accent' : 'neutral'}>
                    {statuses.find((s) => s.value === v)?.label}
                  </Pill>
                )}
                onSave={(next) => update(row.id, { status: next ?? 'draft' })}
              />
            ),
          },
        ]}
      />
    </Panel>
  )
}

/**
 * Failed saves and disabled fields
 * When saving fails, the value rolls back and the field reopens with what was typed and the text returned by
 * `onError` below it; press `Enter` to try again or `Esc` to cancel. A disabled field stays readable, and
 * `disabledReason` explains why it cannot be edited.
 * @zh 保存失败与禁用
 * 保存失败时值回滚，字段以刚才的输入重新打开，下方显示 `onError` 返回的文字；按 `Enter` 重试或 `Esc` 取消。
 * 禁用的字段照常可读，`disabledReason` 说明为什么不能编辑。
 * @section States
 */
export function States() {
  return (
    <Descriptions
      column={1}
      items={[
        {
          key: 'title',
          label: 'Title',
          children: (
            <InlineEdit
              label="Title"
              value="Quarterly report"
              onSave={() =>
                // Stands in for a request that fails
                new Promise((_, reject) =>
                  setTimeout(() => reject(new Error('Network error')), 600),
                )
              }
              onError={() => 'The server could not be reached. Try again.'}
            />
          ),
        },
        {
          key: 'code',
          label: 'Code',
          children: (
            <InlineEdit
              label="Code"
              value="PRJ-0142"
              disabled
              disabledReason="Codes are assigned automatically"
              onSave={() => {}}
            />
          ),
        },
      ]}
    />
  )
}
