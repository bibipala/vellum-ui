/**
 * Form 在真实浏览器中的校验时机（docs/11 §6.2「表单」）：失焦时校验；出错后该字段改为随输入校验；
 * 错误显示在字段下方；提交时聚焦到第一个错误字段。
 */
import { describe, expect, it, vi } from 'vitest'
import { Button, Form, Input } from '../../src/index.ts'
import { focused, page, render, userEvent } from './render.tsx'

const errorsOf = (name: string) =>
  [
    ...(page
      .getByLabelText(name)
      .element()
      .closest('.ant-form-item')
      ?.querySelectorAll('.ant-form-item-explain-error') ?? []),
  ].map((e) => e.textContent)

function Demo(props: { onFinish?: (v: unknown) => void }) {
  return (
    <Form layout="vertical" onFinish={props.onFinish}>
      <Form.Item label="Name" name="name" rules={[{ required: true, message: 'Enter a name' }]}>
        <Input />
      </Form.Item>
      <Form.Item
        label="Code"
        name="code"
        rules={[{ pattern: /^[a-z]+$/, message: 'Lowercase letters only' }]}
      >
        <Input />
      </Form.Item>
      <Form.Item label="Owner" name="owner" rules={[{ required: true, message: 'Enter an owner' }]}>
        <Input />
      </Form.Item>
      <Button type="submit" variant="primary">
        Create
      </Button>
    </Form>
  )
}

describe('Form', () => {
  it('输入过程中不校验，失焦时才校验，错误显示在字段下方', async () => {
    await render(<Demo />)
    const code = page.getByLabelText('Code')
    await userEvent.click(code)
    await userEvent.keyboard('AB')
    // 还在输入：不打断
    await new Promise((r) => setTimeout(r, 150))
    expect(errorsOf('Code')).toEqual([])
    await userEvent.tab()
    await expect.poll(() => errorsOf('Code')).toEqual(['Lowercase letters only'])
    const item = code.element().closest('.ant-form-item') as HTMLElement
    const explain = item.querySelector('.ant-form-item-explain') as HTMLElement
    expect(explain.getBoundingClientRect().top).toBeGreaterThan(
      code.element().getBoundingClientRect().bottom - 1,
    )
  })

  it('出错后该字段改为随输入校验：改正时错误立即消失，再改错又立即出现', async () => {
    await render(<Demo />)
    const code = page.getByLabelText('Code')
    await userEvent.click(code)
    await userEvent.keyboard('AB')
    await userEvent.tab()
    await expect.poll(() => errorsOf('Code')).toEqual(['Lowercase letters only'])
    await userEvent.click(code)
    await userEvent.clear(code)
    await userEvent.keyboard('ab')
    await expect.poll(() => errorsOf('Code')).toEqual([])
    expect(focused()).toBe(code.element())
    await userEvent.keyboard('1')
    await expect.poll(() => errorsOf('Code')).toEqual(['Lowercase letters only'])
  })

  it('提交时校验全部字段，并把焦点移到第一个错误字段', async () => {
    const onFinish = vi.fn()
    await render(<Demo onFinish={onFinish} />)
    await userEvent.click(page.getByLabelText('Code'))
    await userEvent.keyboard('ok')
    await userEvent.click(page.getByRole('button', { name: 'Create' }))
    await expect.poll(() => errorsOf('Name')).toEqual(['Enter a name'])
    expect(errorsOf('Owner')).toEqual(['Enter an owner'])
    await expect.poll(focused).toBe(page.getByLabelText('Name').element())
    expect(onFinish).not.toHaveBeenCalled()
  })

  it('全部通过时提交（键盘回车提交）', async () => {
    const onFinish = vi.fn()
    await render(<Demo onFinish={onFinish} />)
    await userEvent.click(page.getByLabelText('Name'))
    await userEvent.keyboard('Atlas')
    await userEvent.click(page.getByLabelText('Owner'))
    await userEvent.keyboard('Lin{Enter}')
    await expect.poll(() => onFinish.mock.calls.length).toBe(1)
    expect(onFinish.mock.calls[0]?.[0]).toMatchObject({ name: 'Atlas', owner: 'Lin' })
  })
})

describe('Form 的布局', () => {
  it('默认竖排：标签在字段上方', async () => {
    await render(
      <Form>
        <Form.Item label="Name" name="name">
          <Input />
        </Form.Item>
      </Form>,
    )
    const label = document.querySelector('.ant-form-item-label') as HTMLElement
    const input = document.querySelector('.ant-form-item-control-input') as HTMLElement
    expect(document.querySelector('.ant-form-item-vertical')).not.toBeNull()
    expect(label.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      input.getBoundingClientRect().top,
    )
  })

  it('提示文字下面留出间距，下一个标签不贴着它', async () => {
    await render(
      <Form>
        <Form.Item label="Name" name="name" help="Shown to other members">
          <Input />
        </Form.Item>
        <Form.Item label="Email" name="email">
          <Input />
        </Form.Item>
      </Form>,
    )
    const help = document.querySelector('.ant-form-item-explain') as HTMLElement
    // 提示文字有展开动画：等它的高度稳定
    await expect.poll(() => help.getBoundingClientRect().height).toBeGreaterThan(16)
    await new Promise((r) => setTimeout(r, 400))
    const next = document.querySelectorAll('.ant-form-item')[1] as HTMLElement
    const gap = next.getBoundingClientRect().top - help.getBoundingClientRect().bottom
    const space2 = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--vl-space-2'),
    )
    expect(gap).toBeGreaterThanOrEqual(space2 - 1)
  })
})
