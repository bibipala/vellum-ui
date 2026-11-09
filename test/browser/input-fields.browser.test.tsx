/**
 * 输入框的宽度与字数统计：InputNumber 有后缀时数字不被裁掉、`block` 占满容器；
 * Input / Input.TextArea 的 `showCount` 显示「已输入 / 上限」，颜色取令牌，读屏在接近上限时才播报。
 */
import { describe, expect, it } from 'vitest'
import { Input, InputNumber } from '../../src/index.ts'
import { css, page, render, sameColor, token, userEvent } from './render.tsx'

/** 输入框里的文字是否完整可见：内容宽度不超过可见宽度。 */
function fullyVisible(input: HTMLInputElement): boolean {
  return input.scrollWidth <= input.clientWidth
}

describe('InputNumber 的宽度', () => {
  it('有后缀时数字完整可见（"85.0" 与 "USD"），后缀不压在数字上', async () => {
    const { container } = await render(
      <div>
        <InputNumber defaultValue={85} precision={1} suffix="USD" />
        <InputNumber size="sm" defaultValue={12345678} suffix="minutes" />
      </div>,
    )
    const roots = [...container.querySelectorAll<HTMLElement>('.ant-input-number')]
    expect(roots).toHaveLength(2)
    for (const root of roots) {
      const input = root.querySelector('input') as HTMLInputElement
      const suffix = root.querySelector('.ant-input-number-suffix') as HTMLElement
      expect(fullyVisible(input), input.value).toBe(true)
      expect(input.getBoundingClientRect().right).toBeLessThanOrEqual(
        suffix.getBoundingClientRect().left,
      )
      // 后缀整个在外框内
      expect(suffix.getBoundingClientRect().right).toBeLessThanOrEqual(
        root.getBoundingClientRect().right,
      )
    }
    expect(roots[0]?.querySelector('input')?.value).toBe('85.0')
  })

  it('没有后缀时保持默认宽度；block 占满容器（有无后缀都一样）', async () => {
    const { container } = await render(
      <div>
        <div data-box="">
          <InputNumber defaultValue={85} />
        </div>
        <div data-box="" style={{ width: 400 }}>
          <InputNumber block defaultValue={85} />
        </div>
        <div data-box="" style={{ width: 400 }}>
          <InputNumber block defaultValue={85} suffix="USD" />
        </div>
      </div>,
    )
    const [plain, block, blockSuffix] = [...container.querySelectorAll('[data-box]')].map(
      (box) =>
        (box.querySelector('.ant-input-number') as HTMLElement).getBoundingClientRect().width,
    )
    expect(plain).toBe(90)
    expect(block).toBe(400)
    expect(blockSuffix).toBe(400)
  })
})

/** 字数统计的元素（单行框与多行框中 antd 的类名不同）。 */
const COUNT = '.ant-input-show-count-suffix, .ant-input-data-count'

/** 元素的读屏说明：aria-describedby 指向的元素的文字。 */
function description(el: Element): string {
  const ids = el.getAttribute('aria-describedby')?.split(/\s+/) ?? []
  return ids.map((id) => document.getElementById(id)?.textContent ?? '').join(' ')
}

describe('showCount', () => {
  it('Input：显示「已输入 / 上限」，maxLength 阻止继续输入；读屏说明是完整的一句话', async () => {
    const { container } = await render(<Input aria-label="Name" showCount maxLength={5} />)
    const input = page.getByRole('textbox', { name: 'Name' })
    await userEvent.type(input, 'abc')
    const count = container.querySelector(COUNT) as HTMLElement
    await expect.poll(() => count.querySelector('[aria-hidden="true"]')?.textContent).toBe('3 / 5')
    expect(description(input.element())).toBe('3 of 5 characters')
    // 原生 maxLength：到上限后不能继续输入
    await userEvent.type(input, 'defg')
    expect((input.element() as HTMLInputElement).value).toBe('abcde')
    await expect.poll(() => description(input.element())).toBe('5 of 5 characters')
    // 弱化色、小一档字号、等宽数字
    expect(sameColor(css(count).color, token('color-text-tertiary'))).toBe(true)
    expect(css(count).fontSize).toBe(token('font-size-xs'))
    expect(css(count).fontVariantNumeric).toBe('tabular-nums')
  })

  it('Input.TextArea：没有 maxLength 时只显示字数；保留自己的 aria-describedby', async () => {
    const { container } = await render(
      <>
        <p id="hint">Shown to the team</p>
        <Input.TextArea aria-label="Notes" aria-describedby="hint" showCount defaultValue="Hi" />
      </>,
      { locale: 'zh-CN' },
    )
    const area = page.getByRole('textbox', { name: 'Notes' })
    const count = container.querySelector(COUNT) as HTMLElement
    expect(count.querySelector('[aria-hidden="true"]')?.textContent).toBe('2')
    expect(description(area.element())).toBe('Shown to the team 已输入 2 个字符')
    expect(sameColor(css(count).color, token('color-text-tertiary'))).toBe(true)
  })

  it('不传 showCount 时没有计数，也不加说明', async () => {
    const { container } = await render(<Input aria-label="Plain" maxLength={5} />)
    expect(container.querySelector(COUNT)).toBeNull()
    expect(
      page.getByRole('textbox', { name: 'Plain' }).element().getAttribute('aria-describedby'),
    ).toBeNull()
  })
})
