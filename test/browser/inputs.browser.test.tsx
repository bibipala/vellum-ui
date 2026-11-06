/**
 * 输入类组件在真实浏览器中的交互（docs/11 §6.2）：聚焦时强调色细边与光环、Input.Search 的回车与输入法组字、
 * 清空、等宽数字、数字输入的方向键步进。
 */
import { describe, expect, it, vi } from 'vitest'
import { DatePicker, Input, InputNumber, Select, TreeSelect } from '../../src/index.ts'
import { css, page, render, rgba, sameColor, token, userEvent } from './render.tsx'

/** 填充式输入的外框：有前后缀（Search、Password、InputNumber）时是外层包裹，否则是 input 自身。 */
const frameOf = (el: Element) =>
  el.closest('.ant-input-affix-wrapper, .ant-input-number') ?? (el as HTMLElement)

/**
 * 聚焦前：中性底、无描边、无光环；聚焦后：强调色细边 + 3px 光环（halo 令牌）。
 * 默认用鼠标点击聚焦；选择器、日期等内部输入框不可点击的，传入 `focus` 改用键盘聚焦。
 */
async function expectFocusHalo(
  field: HTMLElement,
  frame: Element = frameOf(field),
  focus: () => Promise<void> = () => userEvent.click(field),
) {
  const before = css(frame)
  expect(rgba(before.borderTopColor)[3], '静止时不描边').toBe(0)
  expect(before.boxShadow).toBe('none')
  await focus()
  expect(document.activeElement).toBe(field)
  await expect.poll(() => sameColor(css(frame).borderTopColor, token('color-accent'))).toBe(true)
  await expect.poll(() => css(frame).boxShadow).toMatch(/0px 0px 0px 3px$/)
  const halo = css(frame).boxShadow.replace(/\s*0px 0px 0px 3px$/, '')
  expect(sameColor(halo, token('color-focus-halo'))).toBe(true)
  // 光环替代焦点轮廓，不再叠加 outline
  expect(css(field).outlineStyle).toBe('none')
}

describe('Input', () => {
  it('聚焦时出现强调色细边与光环', async () => {
    await render(<Input aria-label="Name" />)
    await expectFocusHalo(page.getByRole('textbox', { name: 'Name' }).element() as HTMLElement)
  })

  it('numeric 时使用等宽数字，默认不用', async () => {
    await render(
      <>
        <Input aria-label="Amount" numeric defaultValue="1,280.50" />
        <Input aria-label="Amount with suffix" numeric suffix="CNY" defaultValue="99.00" />
        <Input aria-label="Plain" defaultValue="1,280.50" />
      </>,
    )
    const numeric = (name: string) =>
      css(page.getByRole('textbox', { name, exact: true }).element()).fontVariantNumeric
    expect(numeric('Amount')).toBe('tabular-nums')
    expect(numeric('Amount with suffix')).toBe('tabular-nums')
    expect(numeric('Plain')).toBe('normal')
  })
})

describe('Input.Search', () => {
  it('聚焦时外框出现强调色细边与光环', async () => {
    await render(<Input.Search aria-label="Search" />)
    await expectFocusHalo(page.getByRole('searchbox', { name: 'Search' }).element() as HTMLElement)
  })

  it('回车以当前文字触发 onSearch（source: input）', async () => {
    const onSearch = vi.fn()
    await render(<Input.Search aria-label="Search" onSearch={onSearch} />)
    await userEvent.click(page.getByRole('searchbox', { name: 'Search' }))
    await userEvent.keyboard('quarterly report')
    await userEvent.keyboard('{Enter}')
    expect(onSearch).toHaveBeenCalledOnce()
    expect(onSearch.mock.calls[0]?.[0]).toBe('quarterly report')
    expect(onSearch.mock.calls[0]?.[2]).toEqual({ source: 'input' })
  })

  it('输入法组字时的回车不触发；组字结束后的回车触发', async () => {
    const onSearch = vi.fn()
    await render(<Input.Search aria-label="Search" onSearch={onSearch} />)
    const box = page.getByRole('searchbox', { name: 'Search' }).element() as HTMLInputElement
    await userEvent.click(box)
    box.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }))
    await userEvent.keyboard('lin')
    await userEvent.keyboard('{Enter}')
    expect(onSearch).not.toHaveBeenCalled()
    box.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'lin' }))
    await userEvent.keyboard('{Enter}')
    expect(onSearch).toHaveBeenCalledOnce()
    expect(onSearch.mock.calls[0]?.[0]).toBe('lin')
  })

  it('点清除按钮：以空字符串触发 onSearch（source: clear），输入框清空并保持焦点', async () => {
    const onSearch = vi.fn()
    await render(
      <Input.Search aria-label="Search" allowClear defaultValue="atlas" onSearch={onSearch} />,
    )
    const box = page.getByRole('searchbox', { name: 'Search' }).element() as HTMLInputElement
    const clear = box.closest('.ant-input-affix-wrapper')?.querySelector('.ant-input-clear-icon')
    expect(clear).toBeTruthy()
    await userEvent.click(clear as Element)
    expect(onSearch).toHaveBeenCalledOnce()
    expect(onSearch.mock.calls[0]?.[0]).toBe('')
    expect(onSearch.mock.calls[0]?.[2]).toEqual({ source: 'clear' })
    expect(box.value).toBe('')
    expect(document.activeElement).toBe(box)
  })

  it('loading 时回车不重复触发，搜索图标换成转动的加载指示', async () => {
    const onSearch = vi.fn()
    await render(<Input.Search aria-label="Search" loading onSearch={onSearch} />)
    const box = page.getByRole('searchbox', { name: 'Search' }).element()
    await userEvent.click(box)
    await userEvent.keyboard('x{Enter}')
    expect(onSearch).not.toHaveBeenCalled()
    const spinner = box.closest('.ant-input-affix-wrapper')?.querySelector('.lucide-loader-circle')
    expect(spinner).toBeTruthy()
    expect(css(spinner?.parentElement as Element).animationIterationCount).toBe('infinite')
  })
})

describe('Input.TextArea 与 Input.Password', () => {
  it('TextArea 聚焦时出现强调色细边与光环', async () => {
    await render(<Input.TextArea aria-label="Notes" />)
    await expectFocusHalo(page.getByRole('textbox', { name: 'Notes' }).element() as HTMLElement)
  })

  it('Password 聚焦时外框出现光环；点眼睛图标切换明文', async () => {
    await render(<Input.Password aria-label="Password" defaultValue="s3cret" />)
    const box = page.getByLabelText('Password').element() as HTMLInputElement
    await expectFocusHalo(box)
    expect(box.type).toBe('password')
    const eye = box.closest('.ant-input-affix-wrapper')?.querySelector('.ant-input-password-icon')
    await userEvent.click(eye as Element)
    expect(box.type).toBe('text')
  })
})

describe('InputNumber', () => {
  it('等宽数字；聚焦时外框出现光环；↑ / ↓ 按步长增减', async () => {
    const onChange = vi.fn()
    await render(<InputNumber aria-label="Days" defaultValue={7} step={1} onChange={onChange} />)
    const box = page.getByRole('spinbutton', { name: 'Days' }).element() as HTMLInputElement
    expect(css(box).fontVariantNumeric).toBe('tabular-nums')
    await expectFocusHalo(box)
    await userEvent.keyboard('{ArrowUp}')
    expect(box.value).toBe('8')
    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    expect(box.value).toBe('6')
    expect(onChange).toHaveBeenLastCalledWith(6)
  })

  it('stringMode：以字符串传递精确值（不经过浮点）', async () => {
    const onChange = vi.fn()
    await render(
      <InputNumber<string>
        aria-label="Amount"
        stringMode
        step="0.01"
        defaultValue="0.10"
        onChange={onChange}
      />,
    )
    const box = page.getByRole('spinbutton', { name: 'Amount' }).element() as HTMLInputElement
    await userEvent.click(box)
    await userEvent.keyboard('{ArrowUp}{ArrowUp}')
    expect(onChange).toHaveBeenLastCalledWith('0.12')
  })
})

describe('Select / TreeSelect / DatePicker 的焦点外观', () => {
  it('键盘聚焦时外框出现强调色细边与光环；错误状态不叠加强调色光环', async () => {
    await render(
      <>
        <Select aria-label="Fruit" options={[{ value: 'a', label: 'Apple' }]} />
        <TreeSelect aria-label="Team" treeData={[{ value: 'eng', title: 'Engineering' }]} />
        <DatePicker aria-label="Due date" />
        <Input aria-label="Invalid" status="error" />
      </>,
    )
    const tab = () => userEvent.tab()
    const select = page.getByRole('combobox', { name: 'Fruit' }).element() as HTMLElement
    await expectFocusHalo(select, select.closest('.ant-select') as Element, tab)
    const tree = page.getByRole('combobox', { name: 'Team' }).element() as HTMLElement
    await expectFocusHalo(tree, tree.closest('.ant-select') as Element, tab)
    const date = page.getByRole('textbox', { name: 'Due date' }).element() as HTMLElement
    await expectFocusHalo(date, date.closest('.ant-picker') as Element, tab)
    await userEvent.keyboard('{Escape}')
    const invalid = page.getByRole('textbox', { name: 'Invalid' }).element() as HTMLElement
    await userEvent.click(invalid)
    expect(css(invalid).boxShadow).toBe('none')
  })
})
