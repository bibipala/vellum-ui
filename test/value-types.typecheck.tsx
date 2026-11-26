/**
 * 公开类型的约束：只由 `pnpm typecheck` 检查，不运行（文件名不匹配任何测试项目）。
 *
 * - Select、TreeSelect、Cascader 的值只能是字符串或数字（SelectValue）：antd 的选择引擎把对象当作「文字与值」的记录读取，
 *   对象值会丢失。显式写出对象类型，或者传入对象值，都要报错；
 * - 多选时用字面量数组（`defaultValue={['design']}`）也能推断出值的类型（重载：多选的签名不是联合类型）；
 * - InlineEdit 按 `type` 与 `decimal` 声明值的类型：数字、十进制字符串、文字、选项的值。
 */
import { useState } from 'react'
import {
  Cascader,
  type CascaderOption,
  InlineEdit,
  Select,
  type SelectOption,
  type SelectProps,
  TreeSelect,
  type TreeSelectOption,
} from '../src/index.ts'

const record = { id: 'a' }

// @ts-expect-error 选项的值只能是字符串或数字
export type ObjectOption = SelectOption<{ id: string }>
// @ts-expect-error 同上
export type ObjectProps = SelectProps<{ id: string }>
// @ts-expect-error 同上
export type ObjectTreeOption = TreeSelectOption<{ id: string }>
// @ts-expect-error 同上
export type ObjectCascaderOption = CascaderOption<{ id: string }>

export function Rejected() {
  return (
    <>
      {/* @ts-expect-error 显式写出对象类型 */}
      <Select<{ id: string }> value={record} options={[{ value: record, label: 'A' }]} />
      {/* @ts-expect-error 推断不出对象类型：值不是字符串或数字 */}
      <Select value={record} options={[{ value: record, label: 'A' }]} />
      {/* @ts-expect-error 多选同样 */}
      <Select multiple value={[record]} options={[{ value: record, label: 'A' }]} />
      {/* @ts-expect-error TreeSelect 同样 */}
      <TreeSelect<{ id: string }> options={[{ value: record, title: 'A' }]} />
      {/* @ts-expect-error Cascader 同样 */}
      <Cascader<{ id: string }> options={[{ value: record, label: 'A' }]} />
    </>
  )
}

export function Inferred() {
  const [one, setOne] = useState('design')
  const [many, setMany] = useState<string[]>([])
  const [count, setCount] = useState<number | null>(null)
  const kinds = [
    { value: 'design', label: 'Design' },
    { value: 'research', label: 'Research' },
  ]
  return (
    <>
      <Select value={one} onChange={setOne} options={kinds} />
      <Select defaultValue="research" options={kinds} />
      <Select allowClear value={count} onChange={setCount} options={[{ value: 1, label: 'One' }]} />
      <Select multiple value={many} onChange={setMany} options={kinds} />
      <Select
        multiple
        defaultValue={['research']}
        options={[
          { value: 'design', label: 'Design' },
          { value: 'research', label: 'Research' },
        ]}
      />
      <TreeSelect
        multiple
        defaultValue={['b']}
        options={[{ value: 'a', title: 'A', children: [{ value: 'b', title: 'B' }] }]}
      />
      <Cascader
        multiple
        defaultValue={[['a', 'b']]}
        options={[{ value: 'a', label: 'A', children: [{ value: 'b', label: 'B' }] }]}
      />
    </>
  )
}

export function InlineEditModes() {
  const [name, setName] = useState('Atlas')
  const [quantity, setQuantity] = useState<number | null>(12)
  const [price, setPrice] = useState<string | null>('48.50')
  const [status, setStatus] = useState<'draft' | 'done'>('draft')
  return (
    <>
      <InlineEdit label="Name" value={name} onSave={setName} />
      <InlineEdit type="number" label="Quantity" value={quantity} min={1} onSave={setQuantity} />
      <InlineEdit type="number" decimal label="Price" value={price} min="0" onSave={setPrice} />
      <InlineEdit
        type="select"
        label="Status"
        value={status}
        options={[
          { value: 'draft', label: 'Draft' },
          { value: 'done', label: 'Done' },
        ]}
        onSave={setStatus}
      />
      {/* @ts-expect-error 数字模式的值是数字；十进制字符串要加 decimal */}
      <InlineEdit type="number" label="Price" value="48.50" onSave={() => {}} />
      {/* @ts-expect-error 十进制模式的值是字符串 */}
      <InlineEdit type="number" decimal label="Quantity" value={12} onSave={() => {}} />
      {/* @ts-expect-error 文字模式的值是字符串 */}
      <InlineEdit label="Name" value={12} onSave={() => {}} />
      {/* @ts-expect-error 数字模式保存的是数字或 null，不是字符串 */}
      <InlineEdit type="number" label="Quantity" value={1} onSave={(next: string) => next} />
      {/* @ts-expect-error 选择模式要有 options */}
      <InlineEdit type="select" label="Status" value="draft" onSave={() => {}} />
    </>
  )
}
