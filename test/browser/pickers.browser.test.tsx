/**
 * 选择类输入与气泡卡片在真实浏览器中的键盘、焦点与弹层进出（docs/11 §6.2「键盘」「弹层」「焦点」）：
 * Popover：点击打开时焦点进入卡片，Esc 关闭后回到触发元素，悬停打开不移动焦点，在别处点击关闭时焦点留在被点击处；
 * Slider：Tab 聚焦手柄与焦点环、方向键 / Home / End / Page Up 调整，轨道为中性填充、选中段为强调色；
 * ColorPicker：色块是按钮（Tab、Enter / 空格打开），焦点进入面板，Esc 关闭后回到色块；
 * TimePicker：Enter 打开、键入时间 Enter 确认、Esc 关闭，焦点留在输入框；
 * Cascader：方向键展开与逐层移动、Enter 选中、Esc 关闭；AutoComplete：输入出建议、方向键高亮、Enter 填入、Esc 收起。
 */
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import {
  AutoComplete,
  Button,
  Cascader,
  ColorPicker,
  Input,
  LinkButton,
  Popover,
  Slider,
  TimePicker,
} from '../../src/index.ts'
import {
  css,
  expectFocusRing,
  focused,
  isOpen,
  page,
  render,
  sameColor,
  settle,
  token,
  userEvent,
} from './render.tsx'

describe('Popover', () => {
  it('点击打开：Enter 打开后焦点进入第一个可聚焦元素，Esc 关闭后焦点回到触发按钮', async () => {
    await render(
      <Popover
        trigger="click"
        title="Rename"
        content={<Input aria-label="Name" defaultValue="Website" />}
      >
        <Button>Rename</Button>
      </Popover>,
    )
    await userEvent.tab()
    const trigger = page.getByRole('button', { name: 'Rename' }).element()
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => isOpen('.ant-popover')).toBe(true)
    await expect.poll(focused).toBe(page.getByRole('textbox', { name: 'Name' }).element())
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => isOpen('.ant-popover')).toBe(false)
    await expect.poll(focused).toBe(trigger)
  })

  it('没有可聚焦的内容时焦点移到卡片本身（不显示焦点环），Esc 关闭后回到触发按钮', async () => {
    await render(
      <Popover trigger="click" title="Owner" content="Alex Morgan">
        <Button>Owner</Button>
      </Popover>,
    )
    await userEvent.tab()
    const trigger = page.getByRole('button', { name: 'Owner' }).element()
    await userEvent.keyboard(' ')
    await expect.poll(() => focused()?.closest('.ant-popover')).not.toBeNull()
    expect(css(focused() as Element).outlineStyle).toBe('none')
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => isOpen('.ant-popover')).toBe(false)
    await expect.poll(focused).toBe(trigger)
  })

  it('悬停与聚焦触发（trigger={[hover, focus]}）：键盘聚焦时打开，焦点留在触发元素上；移走焦点后关闭', async () => {
    await render(
      <>
        <Popover trigger={['hover', 'focus']} title="Alex Morgan" content="Product designer">
          <LinkButton>Alex Morgan</LinkButton>
        </Popover>
        <input aria-label="After" />
      </>,
    )
    await userEvent.tab()
    const trigger = page.getByRole('button', { name: 'Alex Morgan' }).element()
    expect(focused()).toBe(trigger)
    await expect.poll(() => isOpen('.ant-popover')).toBe(true)
    await settle(50)
    expect(focused()).toBe(trigger)
    await userEvent.tab()
    await expect.poll(() => isOpen('.ant-popover')).toBe(false)
    expect(focused()).toBe(page.getByRole('textbox', { name: 'After' }).element())
  })

  it('悬停打开不移动焦点；点击打开后在页面别处点击关闭时，焦点留在被点击的元素上', async () => {
    await render(
      <>
        <input aria-label="Elsewhere" />
        <Popover title="Details" content="Hover card">
          <Button>Hover me</Button>
        </Popover>
        <Popover trigger="click" title="Click" content={<Button>Inside</Button>}>
          <Button>Click me</Button>
        </Popover>
      </>,
    )
    const elsewhere = page.getByRole('textbox', { name: 'Elsewhere' }).element()
    await userEvent.click(elsewhere)
    await userEvent.hover(page.getByRole('button', { name: 'Hover me' }))
    await expect
      .poll(() => document.querySelector('.ant-popover')?.textContent)
      .toContain('Hover card')
    expect(focused()).toBe(elsewhere)

    await userEvent.click(page.getByRole('button', { name: 'Click me' }))
    await expect.poll(focused).toBe(page.getByRole('button', { name: 'Inside' }).element())
    await userEvent.click(elsewhere)
    await settle(50)
    await expect.poll(focused).toBe(elsewhere)
  })
})

describe('Slider', () => {
  it('Tab 聚焦手柄并显示圆形焦点环；方向键、Page Up、Home / End 调整取值', async () => {
    const onChange = vi.fn()
    await render(<Slider defaultValue={40} onChange={onChange} aria-label="Opacity" />)
    await userEvent.tab()
    const handle = page.getByRole('slider').element()
    expect(focused()).toBe(handle)
    expectFocusRing(handle, 2)
    expect(css(handle).borderTopLeftRadius).not.toBe('0px')
    await userEvent.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenLastCalledWith(41)
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(onChange).toHaveBeenLastCalledWith(39)
    await userEvent.keyboard('{PageUp}')
    expect(handle.getAttribute('aria-valuenow')).not.toBe('39')
    await userEvent.keyboard('{Home}')
    expect(onChange).toHaveBeenLastCalledWith(0)
    await userEvent.keyboard('{End}')
    expect(onChange).toHaveBeenLastCalledWith(100)
    expect(handle.getAttribute('aria-valuenow')).toBe('100')
  })

  it('轨道为中性填充、选中段为强调色；范围滑块的两个手柄分别可聚焦', async () => {
    await render(<Slider range defaultValue={[20, 60]} />)
    const rail = document.querySelector('.ant-slider-rail') as Element
    const track = document.querySelector('.ant-slider-track') as Element
    expect(sameColor(css(rail).backgroundColor, token('color-fill-strong'))).toBe(true)
    expect(sameColor(css(track).backgroundColor, token('color-accent'))).toBe(true)
    await userEvent.tab()
    await userEvent.keyboard('{ArrowRight}')
    await userEvent.tab()
    await userEvent.keyboard('{ArrowLeft}')
    const values = page
      .getByRole('slider')
      .elements()
      .map((h) => h.getAttribute('aria-valuenow'))
    expect(values).toEqual(['21', '59'])
  })
})

describe('ColorPicker', () => {
  it('色块是按钮：Tab 聚焦显示焦点环，Enter 打开面板并把焦点移入，Esc 关闭后焦点回到色块', async () => {
    const onOpenChange = vi.fn()
    await render(<ColorPicker defaultValue="#2D6BF3" onOpenChange={onOpenChange} />)
    await userEvent.tab()
    const swatch = page.getByRole('button', { name: 'Color' }).element()
    expect(focused()).toBe(swatch)
    expect(swatch.getAttribute('aria-expanded')).toBe('false')
    expectFocusRing(swatch, 2)
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => isOpen('.ant-color-picker')).toBe(true)
    expect(swatch.getAttribute('aria-expanded')).toBe('true')
    await expect.poll(() => focused()?.closest('.ant-popover')).not.toBeNull()
    expect(onOpenChange).toHaveBeenLastCalledWith(true)
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => isOpen('.ant-color-picker')).toBe(false)
    await expect.poll(focused).toBe(swatch)
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
    await userEvent.keyboard(' ')
    await expect.poll(() => isOpen('.ant-color-picker')).toBe(true)
  })

  it('在面板中输入 HEX 改变颜色；禁用时色块不可聚焦、按键不打开', async () => {
    const onChange = vi.fn()
    const { rerender } = await render(
      <ColorPicker defaultValue="#2D6BF3" onChange={(hex) => onChange(hex)} />,
    )
    await userEvent.tab()
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => focused()?.closest('.ant-popover')).not.toBeNull()
    const hex = document.querySelector<HTMLInputElement>('.ant-color-picker-hex-input input')
    expect(hex).not.toBeNull()
    await userEvent.fill(hex as HTMLInputElement, '1F9D55')
    await expect.poll(() => onChange.mock.lastCall?.[0]).toBe('#1f9d55')

    await rerender(<ColorPicker defaultValue="#2D6BF3" disabled />)
    const swatch = page.getByRole('button', { name: 'Color' }).element()
    expect(swatch.getAttribute('tabindex')).toBe('-1')
    expect(swatch.getAttribute('aria-disabled')).toBe('true')
  })
})

describe('TimePicker', () => {
  it('Tab 聚焦后 Enter 打开面板；键入时间按 Enter 确认并关闭；Esc 关闭；焦点留在输入框上', async () => {
    const picked: string[] = []
    await render(
      <TimePicker aria-label="Start time" format="HH:mm" onChange={(t) => picked.push(t ?? '')} />,
    )
    await userEvent.tab()
    const input = page.getByRole('textbox', { name: 'Start time' }).element()
    expect(focused()).toBe(input)
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => isOpen('.ant-picker-dropdown')).toBe(true)
    await userEvent.keyboard('09:30')
    await userEvent.keyboard('{Enter}')
    expect(picked).toEqual(['09:30'])
    await expect.poll(() => isOpen('.ant-picker-dropdown')).toBe(false)
    expect(focused()).toBe(input)
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => isOpen('.ant-picker-dropdown')).toBe(true)
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => isOpen('.ant-picker-dropdown')).toBe(false)
    expect(focused()).toBe(input)
    expect(picked).toEqual(['09:30'])
  })

  it('RangePicker：两个输入框，Tab 依次聚焦', async () => {
    await render(<TimePicker.RangePicker format="HH:mm" />)
    await userEvent.tab()
    const inputs = document.querySelectorAll('.ant-picker-range input')
    expect(focused()).toBe(inputs[0])
    await userEvent.keyboard('{Escape}')
    expect(inputs).toHaveLength(2)
  })
})

describe('Cascader', () => {
  const regions = [
    {
      value: 'europe',
      label: 'Europe',
      children: [
        { value: 'germany', label: 'Germany', children: [{ value: 'berlin', label: 'Berlin' }] },
      ],
    },
    {
      value: 'asia',
      label: 'Asia',
      children: [
        {
          value: 'japan',
          label: 'Japan',
          children: [
            { value: 'tokyo', label: 'Tokyo' },
            { value: 'osaka', label: 'Osaka' },
          ],
        },
      ],
    },
  ]

  it('↓ 展开，↓ / → 逐层移动，Enter 选中叶子并关闭；Esc 关闭；焦点始终在输入框中', async () => {
    const onChange = vi.fn()
    await render(<Cascader aria-label="Office" options={regions} onChange={onChange} />)
    await userEvent.tab()
    const input = page.getByRole('combobox', { name: 'Office' }).element()
    expect(focused()).toBe(input)
    await userEvent.keyboard('{ArrowDown}')
    await expect.poll(() => isOpen('.ant-cascader-dropdown')).toBe(true)
    const active = () =>
      [...document.querySelectorAll('.ant-cascader-menu-item-active')].map((el) => el.textContent)
    await userEvent.keyboard('{ArrowDown}')
    await expect.poll(active).toEqual(['Europe'])
    await userEvent.keyboard('{ArrowDown}')
    await expect.poll(active).toEqual(['Asia'])
    await userEvent.keyboard('{ArrowRight}')
    await expect.poll(active).toEqual(['Asia', 'Japan'])
    await userEvent.keyboard('{ArrowRight}{ArrowDown}')
    await expect.poll(active).toEqual(['Asia', 'Japan', 'Osaka'])
    await userEvent.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith(['asia', 'japan', 'osaka'], expect.anything())
    await expect.poll(() => isOpen('.ant-cascader-dropdown')).toBe(false)
    expect(focused()).toBe(input)

    await userEvent.keyboard('{ArrowDown}')
    await expect.poll(() => isOpen('.ant-cascader-dropdown')).toBe(true)
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => isOpen('.ant-cascader-dropdown')).toBe(false)
    expect(focused()).toBe(input)
    expect(onChange).toHaveBeenCalledOnce()
  })

  it('填充式：聚焦时显示光环；block 占满宽度', async () => {
    await render(
      <div style={{ width: 400 }}>
        <Cascader aria-label="Office" options={regions} block />
      </div>,
    )
    const root = document.querySelector('.ant-cascader') as HTMLElement
    expect(root.getBoundingClientRect().width).toBe(400)
    await userEvent.tab()
    await expect.poll(() => css(root).boxShadow).toContain('3px')
  })
})

/** 输入用户名时建议完整的邮箱地址。 */
function Email(props: { readonly onSelect: (v: string) => void }) {
  const [options, setOptions] = useState<{ value: string }[]>([])
  return (
    <AutoComplete
      aria-label="Email"
      options={options}
      onSelect={(v: string) => props.onSelect(v)}
      onSearch={(text: string) =>
        setOptions(
          text ? ['example.com', 'example.org'].map((d) => ({ value: `${text}@${d}` })) : [],
        )
      }
    />
  )
}

describe('AutoComplete', () => {
  it('输入时出现建议，↓ 移动高亮，Enter 填入；Esc 收起而不改变文字；焦点始终在输入框中', async () => {
    const onSelect = vi.fn()
    await render(<Email onSelect={onSelect} />)
    await userEvent.tab()
    const input = page.getByRole('combobox', { name: 'Email' }).element() as HTMLInputElement
    expect(focused()).toBe(input)
    await userEvent.keyboard('alex')
    await expect.poll(() => isOpen('.ant-select-dropdown')).toBe(true)
    const active = () => document.querySelector('.ant-select-item-option-active')?.textContent
    await expect.poll(active).toBe('alex@example.com')
    await userEvent.keyboard('{ArrowDown}')
    await expect.poll(active).toBe('alex@example.org')
    await userEvent.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledWith('alex@example.org')
    await expect.poll(() => input.value).toBe('alex@example.org')
    await expect.poll(() => isOpen('.ant-select-dropdown')).toBe(false)
    expect(focused()).toBe(input)

    await userEvent.keyboard('{Backspace}')
    await expect.poll(() => isOpen('.ant-select-dropdown')).toBe(true)
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => isOpen('.ant-select-dropdown')).toBe(false)
    expect(input.value).toBe('alex@example.or')
    expect(focused()).toBe(input)
  })
})
