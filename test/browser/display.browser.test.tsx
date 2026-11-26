/**
 * 原生实现的展示组件（Divider、Timeline、Descriptions、内置空状态）：读屏语义、几何尺寸与密度。
 * 尺寸与 1.x 基于 antd 时相同（文档站截图逐像素对比），这里固定关键的数值：紧凑密度时间距收紧，
 * 由 <html> 上的 data-vl-density 决定（与 antd 的紧凑算法一样跟随 ThemeProvider 的密度）。
 */
import { describe, expect, it } from 'vitest'
import { Descriptions, Divider, Select, Timeline } from '../../src/index.ts'
import { css, page, pseudo, render, sameColor, token, userEvent } from './render.tsx'

const rect = (el: Element) => el.getBoundingClientRect()

describe('Divider', () => {
  it('没有文字时是 hr（隐含 separator），上下 24px；紧凑密度 16px', async () => {
    const { unmount } = await render(<Divider />)
    const line = page.getByRole('separator').element()
    expect(line.tagName).toBe('HR')
    expect(css(line).marginTop).toBe('24px')
    expect(css(line).borderTopWidth).toBe('1px')
    expect(rect(line).height).toBe(1)
    await unmount()
    await render(<Divider />, { density: 'compact' })
    expect(css(page.getByRole('separator').element()).marginBottom).toBe('16px')
  })

  it('带文字时是以文字为名称的 separator，两段线在文字的垂直中线上；紧凑密度上下 8px', async () => {
    await render(<Divider plain>November 4</Divider>, { density: 'compact' })
    const divider = page.getByRole('separator', { name: 'November 4' }).element()
    expect(css(divider).marginTop).toBe('8px')
    expect(css(divider).fontWeight).toBe('400')
    const text = divider.querySelector('span') as HTMLElement
    const before = pseudo(divider, '::before')
    expect(before.borderTopWidth).toBe('1px')
    // 两段线等宽，占满文字两侧
    const box = rect(divider)
    const textBox = rect(text)
    expect(Number.parseFloat(before.width) * 2 + textBox.width).toBeCloseTo(box.width, 0)
  })
})

describe('Timeline', () => {
  const items = [
    { content: 'Created' },
    { content: 'Reviewed', tone: 'success' as const },
    { content: 'Released', tone: 'neutral' as const },
  ]

  it('有序列表，每个事件一个列表项；圆点直径为大号控件高度的 1/4，竖线从圆点下沿连到下一个圆点', async () => {
    for (const [density, dot, min] of [
      ['comfortable', 11, 54],
      ['compact', 9, 45],
    ] as const) {
      const { unmount } = await render(<Timeline items={items} />, { density })
      const list = page.getByRole('list').element()
      expect(list.tagName).toBe('OL')
      const events = page.getByRole('listitem').elements()
      expect(events.map((e) => e.textContent)).toEqual(['Created', 'Reviewed', 'Released'])
      const first = events[0] as HTMLElement
      const dotStyle = pseudo(first, '::before')
      expect(dotStyle.width).toBe(`${dot}px`)
      expect(dotStyle.height).toBe(`${dot}px`)
      expect(rect(first).height).toBe(min)
      // 竖线：上端在圆点下沿，下端在下一个圆点上沿（圆点的上边距 = (24 - 直径) / 2）
      const offset = (24 - dot) / 2
      const rail = pseudo(first, '::after')
      expect(Number.parseFloat(rail.top)).toBeCloseTo(offset + dot, 3)
      expect(Number.parseFloat(rail.bottom)).toBeCloseTo(-offset, 3)
      expect(rail.borderLeftWidth).toBe('2px')
      // 最后一个事件没有竖线
      expect(pseudo(events[2] as Element, '::after').content).toBe('none')
      await unmount()
    }
  })

  it('圆点颜色跟随 tone：默认强调色，success、neutral 各用自己的颜色（1.x 中 tone 从未生效）', async () => {
    for (const mode of ['light', 'dark'] as const) {
      const { unmount } = await render(<Timeline items={items} />, { colorMode: mode })
      const [created, reviewed, released] = page.getByRole('listitem').elements()
      const dot = (el: Element | undefined) => pseudo(el as Element, '::before').backgroundColor
      expect(sameColor(dot(created), token('color-accent-fill')), `${mode} 默认`).toBe(true)
      expect(sameColor(dot(reviewed), token('color-success')), `${mode} success`).toBe(true)
      expect(sameColor(dot(released), token('color-text-tertiary')), `${mode} neutral`).toBe(true)
      await unmount()
    }
  })
})

describe('Descriptions', () => {
  const fields = [
    { key: 'name', label: 'Name', children: 'Alex Morgan' },
    { key: 'username', label: 'Username', children: 'alex.morgan' },
    { key: 'team', label: 'Team', children: 'Design' },
  ]

  it('原生描述列表：名称是 term，值是 definition', async () => {
    await render(<Descriptions items={fields} />)
    expect(
      page
        .getByRole('term')
        .elements()
        .map((e) => e.textContent),
    ).toEqual(['Name', 'Username', 'Team'])
    expect(
      page
        .getByRole('definition')
        .elements()
        .map((e) => e.textContent),
    ).toEqual(['Alex Morgan', 'alex.morgan', 'Design'])
    const label = page.getByRole('term').first().element()
    expect(sameColor(css(label).color, token('color-text-secondary'))).toBe(true)
    // 名称与值之间 12px
    const value = page.getByRole('definition').first().element()
    expect(rect(value).left - rect(label).right).toBeCloseTo(12, 3)
  })

  it('指定列数时各列等宽、列距 16px；最后一行排不满时最后一个字段占满余下的列', async () => {
    await render(
      <div style={{ width: 600 }}>
        <Descriptions items={fields} column={2} />
      </div>,
    )
    const rows = page
      .getByRole('term')
      .elements()
      .map((e) => e.parentElement as HTMLElement)
    const [a, b, c] = rows.map(rect) as [DOMRect, DOMRect, DOMRect]
    expect(a.width).toBeCloseTo(b.width, 3)
    expect(b.left - a.right).toBeCloseTo(16, 3)
    expect(c.width).toBeCloseTo(600, 3)
    // 行距：没有指定尺寸时 16px
    expect(c.top - a.bottom).toBeCloseTo(16, 3)
  })

  it('默认的列数随窗口宽度：1280px 宽时 3 列；行距随尺寸，紧凑密度收紧', async () => {
    const { unmount } = await render(<Descriptions items={[...fields, ...fields]} size="sm" />)
    const tops = page
      .getByRole('term')
      .elements()
      .map((e) => Math.round(rect(e).top))
    expect(new Set(tops).size).toBe(2)
    const rows = page
      .getByRole('term')
      .elements()
      .map((e) => e.parentElement as HTMLElement)
    expect(rect(rows[3] as Element).top - rect(rows[0] as Element).bottom).toBeCloseTo(8, 3)
    await unmount()
    await render(<Descriptions items={fields} column={1} size="sm" />, { density: 'compact' })
    const compact = page
      .getByRole('term')
      .elements()
      .map((e) => e.parentElement as HTMLElement)
    expect(rect(compact[1] as Element).top - rect(compact[0] as Element).bottom).toBeCloseTo(4, 3)
  })
})

describe('内置空状态（renderEmpty）', () => {
  it('选择器没有选项时显示插画与「No data」，居中；两侧边距随密度收紧', async () => {
    for (const [density, margin] of [
      ['comfortable', '8px'],
      ['compact', '4px'],
    ] as const) {
      const { unmount } = await render(<Select aria-label="Empty" options={[]} />, { density })
      await userEvent.tab()
      await userEvent.keyboard('{ArrowDown}')
      const open = '.ant-select-dropdown:not(.ant-select-dropdown-hidden)'
      await expect.poll(() => document.querySelector(open)?.textContent ?? '').toContain('No data')
      const dropdown = document.querySelector(open) as HTMLElement
      const art = dropdown.querySelector('svg[aria-hidden="true"]') as SVGElement
      const empty = art.parentElement?.parentElement as HTMLElement
      expect(css(empty).textAlign).toBe('center')
      expect(css(empty).marginLeft).toBe(margin)
      expect(css(empty).paddingTop).toBe('32px')
      expect(empty.querySelector('.ant-empty')).toBeNull()
      expect(empty.classList.contains('ant-empty')).toBe(false)
      await userEvent.keyboard('{Escape}')
      await unmount()
    }
  })
})
