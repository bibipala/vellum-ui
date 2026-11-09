/**
 * 读屏名称：SettingRow 以标题与说明为其中表单控件的名称与说明（不覆盖控件自己的名称、不改按钮的文字），
 * Segmented 只有图标的选项以 `title` 为名称，Slider 的名称落在手柄上。
 */
import { describe, expect, it } from 'vitest'
import {
  Button,
  Checkbox,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Segmented,
  Select,
  SettingRow,
  Slider,
  Switch,
  TimePicker,
} from '../../src/index.ts'
import { page, render } from './render.tsx'

/** 元素的读屏说明：aria-describedby 指向的元素的文字。 */
function description(el: Element): string {
  const ids = el.getAttribute('aria-describedby')?.split(/\s+/) ?? []
  return ids
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .filter(Boolean)
    .join(' ')
}

describe('SettingRow 为控件命名', () => {
  it('Switch 以标题为名称、以说明为说明', async () => {
    await render(
      <SettingRow
        title="Weekly digest"
        description="A summary every Monday"
        control={<Switch />}
      />,
    )
    const sw = page.getByRole('switch', { name: 'Weekly digest' })
    await expect.element(sw).toBeInTheDocument()
    expect(description(sw.element())).toBe('A summary every Monday')
  })

  it('各类表单控件都取标题为名称', async () => {
    await render(
      <>
        <SettingRow title="Retention" control={<InputNumber suffix="days" />} />
        <SettingRow
          title="Language"
          control={<Select options={[{ value: 'en', label: 'English' }]} />}
        />
        <SettingRow title="Workspace name" control={<Input />} />
        <SettingRow title="Notes" control={<Input.TextArea />} />
        <SettingRow title="Auto archive" control={<Checkbox />} />
        <SettingRow title="Volume" control={<Slider />} />
        <SettingRow title="Start date" control={<DatePicker />} />
        <SettingRow title="Quiet hours" control={<TimePicker />} />
        <SettingRow title="Layout" control={<Segmented options={['List', 'Grid']} />} />
      </>,
    )
    await expect.element(page.getByRole('spinbutton', { name: 'Retention' })).toBeInTheDocument()
    await expect.element(page.getByRole('combobox', { name: 'Language' })).toBeInTheDocument()
    await expect.element(page.getByRole('textbox', { name: 'Workspace name' })).toBeInTheDocument()
    await expect.element(page.getByRole('textbox', { name: 'Notes' })).toBeInTheDocument()
    await expect.element(page.getByRole('checkbox', { name: 'Auto archive' })).toBeInTheDocument()
    await expect.element(page.getByRole('slider', { name: 'Volume' })).toBeInTheDocument()
    await expect.element(page.getByRole('textbox', { name: 'Start date' })).toBeInTheDocument()
    await expect.element(page.getByRole('textbox', { name: 'Quiet hours' })).toBeInTheDocument()
    await expect.element(page.getByRole('radiogroup', { name: 'Layout' })).toBeInTheDocument()
  })

  it('不覆盖控件自己的 aria-label，不改按钮与带文字的复选框的名称', async () => {
    await render(
      <>
        <SettingRow title="Weekly digest" control={<Switch aria-label="Digest on Mondays" />} />
        <SettingRow title="Danger zone" control={<Button>Delete workspace</Button>} />
        <SettingRow title="Sharing" control={<Checkbox>Allow guests</Checkbox>} />
      </>,
    )
    await expect
      .element(page.getByRole('switch', { name: 'Digest on Mondays' }))
      .toBeInTheDocument()
    await expect.element(page.getByRole('button', { name: 'Delete workspace' })).toBeInTheDocument()
    await expect.element(page.getByRole('checkbox', { name: 'Allow guests' })).toBeInTheDocument()
  })

  it('控件在带标签的 Form.Item 中时，以表单项的标签为名称', async () => {
    await render(
      <SettingRow
        title="Notifications"
        control={
          <Form>
            <Form.Item label="Email address" name="email">
              <Input />
            </Form.Item>
          </Form>
        }
      />,
    )
    // 测试引擎把 antd 标签隐藏的冒号（`::after`，竖排时 visibility: hidden）也算进名称，得到「Email address :」，
    // 所以按开头匹配；没有清空上下文时名称是设置行的标题「Notifications」
    await expect
      .element(page.getByRole('textbox', { name: /^Email address\b/ }))
      .toBeInTheDocument()
    expect(page.getByRole('textbox', { name: /Notifications/ }).elements()).toHaveLength(0)
  })

  it('Form.Item 没有标签、或没有 name（标签不关联控件）时，控件仍以设置行的标题为名称', async () => {
    await render(
      <Form>
        <SettingRow
          title="Weekly digest"
          control={
            <Form.Item name="digest" valuePropName="checked">
              <Switch />
            </Form.Item>
          }
        />
        <SettingRow
          title="Reply-to"
          control={
            <Form.Item label="Address">
              <Input />
            </Form.Item>
          }
        />
      </Form>,
    )
    await expect.element(page.getByRole('switch', { name: 'Weekly digest' })).toBeInTheDocument()
    await expect.element(page.getByRole('textbox', { name: 'Reply-to' })).toBeInTheDocument()
  })

  it('说明追加在控件自己的 aria-describedby 之后；行外的控件不受影响', async () => {
    await render(
      <>
        <p id="own-hint">Takes effect tomorrow</p>
        <SettingRow
          title="Weekly digest"
          description="A summary every Monday"
          control={<Switch aria-describedby="own-hint" />}
        >
          <Switch aria-label="Nested" />
        </SettingRow>
      </>,
    )
    const sw = page.getByRole('switch', { name: 'Weekly digest' }).element()
    expect(description(sw)).toBe('Takes effect tomorrow A summary every Monday')
    // children 中的子设置不在 control 中，不取标题
    const nested = page.getByRole('switch', { name: 'Nested' }).element()
    expect(nested.getAttribute('aria-labelledby')).toBeNull()
  })
})

describe('Segmented 只有图标的选项', () => {
  it('以 title 为单选框的名称；有文字的选项以文字为名称', async () => {
    await render(
      <Segmented
        aria-label="View"
        options={[
          { value: 'list', icon: 'list', title: 'List view' },
          { value: 'grid', icon: 'grid', title: 'Grid view' },
          { value: 'table', label: 'Table' },
        ]}
      />,
    )
    await expect.element(page.getByRole('radio', { name: 'List view' })).toBeInTheDocument()
    await expect.element(page.getByRole('radio', { name: 'Grid view' })).toBeInTheDocument()
    await expect.element(page.getByRole('radio', { name: 'Table' })).toBeInTheDocument()
    // 读屏文字不占位置：只有图标的选项宽度与没有这段文字时一样（方形）
    const option = page.getByRole('radio', { name: 'List view' }).element().closest('label')
    const r = option?.getBoundingClientRect()
    expect(r?.width).toBeLessThan(60)
  })
})

describe('Slider', () => {
  it('aria-label 是手柄的名称', async () => {
    await render(<Slider aria-label="Opacity" />)
    await expect.element(page.getByRole('slider', { name: 'Opacity' })).toBeInTheDocument()
  })
})
