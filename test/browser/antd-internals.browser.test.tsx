/**
 * 依赖 antd 内部实现的样式（base.css 与组件的样式）：每个依赖一个测试，antd 改了名字或结构时在这里失败，
 * 而不是界面悄悄变样。
 * - antd 的运行时样式在级联层 antd 里（ThemeProvider 的 StyleProvider）：不在层里的规则不论优先级都压过它；
 * - 开关：手柄的平移距离由本库的组件令牌 switch-* 算出，与传给 antd 的尺寸同一份取值；
 * - 滑块两端的刻度文字通过 antd 的 marks（每段文字的 style）与轨道两端齐平；
 * - 选择器左右的内边距：antd 生成的 CSS 变量 --ant-select-padding-horizontal、--ant-select-multi-padding-vertical；
 * - 弹层的进出场：rc-motion 的类名（-enter / -appear、-prepare、-active、-leave）；
 * - 折叠动画：antd 令牌的 CSS 变量名（motionDurationMid、motionEaseInOut），在折叠的元素上改写；
 * - 气泡卡片的面板：antd 6 的 ant-popover-container。
 */
import { type ReactNode, useState } from 'react'
import { describe, expect, it } from 'vitest'
import {
  Button,
  Dropdown,
  Input,
  Modal,
  Popover,
  PromptInput,
  Reasoning,
  Select,
  Slider,
  Stack,
  Switch,
  ToolCalls,
  Tree,
} from '../../src/index.ts'
import { css, ms, page, render, sameColor, sameEasing, token, userEvent } from './render.tsx'

/** 文档中所有级联层的名字（只看顶层的 @layer 块）。 */
function layerNames(): Set<string> {
  const names = new Set<string>()
  for (const sheet of document.styleSheets)
    for (const rule of sheet.cssRules) if (rule instanceof CSSLayerBlockRule) names.add(rule.name)
  return names
}

/** 解析后的 CSS 值：在探针元素上设置属性，读计算值（与组件上的计算值可以直接比较）。 */
function computed(property: string, value: string): string {
  const probe = document.createElement('div')
  probe.style.setProperty(property, value)
  document.body.appendChild(probe)
  try {
    return getComputedStyle(probe).getPropertyValue(property)
  } finally {
    probe.remove()
  }
}

const px = (value: string) => Number.parseFloat(value)

describe('级联层', () => {
  it('antd 的运行时样式在 antd 层里；层外的零优先级规则也压过它', async () => {
    await render(<Button>Save</Button>)
    await expect.poll(layerNames).toContain('antd')
    const button = page.getByRole('button', { name: 'Save' }).element()
    const before = css(button).paddingInlineStart
    expect(px(before)).toBeGreaterThan(3)
    const style = document.createElement('style')
    style.textContent = ':where(.ant-btn) { padding-inline: 3px }'
    document.head.appendChild(style)
    try {
      expect(css(button).paddingInlineStart).toBe('3px')
    } finally {
      style.remove()
    }
  })

  it('AI 组件是本库自己的实现：没有 Ant Design X 的元素，也没有它的样式层 antdx', async () => {
    await render(
      <>
        <Reasoning thinking>Thoughts</Reasoning>
        <ToolCalls items={[{ key: 'a', title: 'Search', status: 'running', input: 'q' }]} />
        <PromptInput />
      </>,
    )
    await expect.poll(layerNames).toContain('antd')
    expect(layerNames()).not.toContain('antdx')
    expect(
      document.querySelector(
        '[class*="ant-think"], [class*="ant-thought-chain"], [class*="ant-sender"]',
      ),
    ).toBeNull()
  })
})

describe('开关', () => {
  const geometry = (suffix: '' | '-sm') => ({
    width: px(token(`switch-track-width${suffix}`)),
    handle: px(token(`switch-handle-size${suffix}`)),
    padding: px(token('switch-track-padding')),
  })

  /** 选中的开关：antd 画出的尺寸与本库的令牌一致，手柄平移「轨道宽度 − 手柄 − 两侧内边距」，落在另一端。 */
  async function expectOnSide(name: string, suffix: '' | '-sm', direction: 1 | -1 = 1) {
    const sw = page.getByRole('switch', { name }).element() as HTMLElement
    const handle = sw.querySelector('.ant-switch-handle') as HTMLElement
    const g = geometry(suffix)
    expect(sw.getBoundingClientRect().width).toBeCloseTo(g.width, 1)
    expect(handle.getBoundingClientRect().width).toBeCloseTo(g.handle, 1)
    const travel = g.width - g.handle - 2 * g.padding
    expect(travel).toBeGreaterThan(0)
    // --vl-switch-travel 是一个长度：变换真的平移了这段距离（变量失效时 transform 为 none）
    await expect
      .poll(() => new DOMMatrix(css(handle).transform).m41)
      .toBeCloseTo(direction * travel, 1)
    const box = sw.getBoundingClientRect()
    const knob = handle.getBoundingClientRect()
    const gap = direction === 1 ? box.right - knob.right : knob.left - box.left
    await expect.poll(() => gap).toBeCloseTo(g.padding, 0)
  }

  it('手柄的平移距离由组件令牌 switch-* 算出：两种尺寸、两种密度都落在另一端', async () => {
    await render(
      <>
        <Switch aria-label="On" defaultChecked />
        <Switch aria-label="Small" size="sm" defaultChecked />
      </>,
    )
    await expectOnSide('On', '')
    await expectOnSide('Small', '-sm')
  })

  it('紧凑密度的小号开关', async () => {
    await render(<Switch aria-label="Small" size="sm" defaultChecked />, { density: 'compact' })
    expect(token('switch-track-width-sm')).toBe('26px')
    await expectOnSide('Small', '-sm')
  })

  it('从右到左的页面中手柄向左平移', async () => {
    await render(
      <div dir="rtl">
        <Switch aria-label="On" defaultChecked />
      </div>,
    )
    await expectOnSide('On', '', -1)
  })
})

describe('滑块的刻度', () => {
  it('两端的刻度文字与轨道两端齐平，中间的以刻度为中心（不依赖行内样式的写法）', async () => {
    await render(
      <div style={{ width: 320 }}>
        <Slider
          min={10}
          max={50}
          defaultValue={20}
          marks={{ 10: 'Ten', 30: 'Thirty', 50: 'Fifty' }}
          aria-label="Range"
        />
      </div>,
    )
    const rail = (document.querySelector('.ant-slider-rail') as Element).getBoundingClientRect()
    const texts = [...document.querySelectorAll('.ant-slider-mark-text')].map((el) => ({
      text: el.textContent,
      box: el.getBoundingClientRect(),
    }))
    expect(texts.map((t) => t.text)).toEqual(['Ten', 'Thirty', 'Fifty'])
    const [start, middle, end] = texts.map((t) => t.box) as [DOMRect, DOMRect, DOMRect]
    expect(start.left).toBeCloseTo(rail.left, 0)
    expect(end.right).toBeCloseTo(rail.right, 0)
    expect((middle.left + middle.right) / 2).toBeCloseTo((rail.left + rail.right) / 2, 0)
  })
})

describe('选择器的内边距', () => {
  const options = [{ value: 'design', label: 'Design' }]

  it('左右的内边距 14 / 12 / 16px（antd 的 CSS 变量 --ant-select-padding-horizontal）', async () => {
    await render(
      <Stack gap={2}>
        <Select size="sm" placeholder="Small" options={options} />
        <Select placeholder="Medium" options={options} />
        <Select size="lg" placeholder="Large" options={options} />
      </Stack>,
    )
    const selects = [...document.querySelectorAll('.ant-select')]
    expect(selects.map((s) => css(s).paddingInlineStart)).toEqual(['12px', '14px', '16px'])
    expect(selects.map((s) => css(s).paddingInlineEnd)).toEqual(['12px', '14px', '16px'])
  })

  it('多选的占位文字与单选、输入框的文字起点对齐（--ant-select-multi-padding-vertical）', async () => {
    await render(
      <Stack gap={2}>
        <Input placeholder="Name" />
        <Select placeholder="Single" options={options} />
        <Select multiple placeholder="Multiple" options={options} />
      </Stack>,
    )
    const [single, multiple] = [...document.querySelectorAll('.ant-select')] as [Element, Element]
    const textStart = (select: Element) =>
      (select.querySelector('.ant-select-placeholder') as Element).getBoundingClientRect().left -
      select.getBoundingClientRect().left
    const input = document.querySelector('input') as HTMLInputElement
    const inputStart =
      input.getBoundingClientRect().left +
      px(css(input).borderLeftWidth) +
      px(css(input).paddingLeft) -
      (input.closest('.ant-input-affix-wrapper') ?? input).getBoundingClientRect().left
    expect(textStart(single)).toBeCloseTo(px(css(single).borderLeftWidth) + 14, 0)
    expect(textStart(multiple)).toBeCloseTo(textStart(single), 0)
    expect(inputStart).toBeCloseTo(textStart(single), 0)
  })
})

/** 受控的开关：测试通过 api.set 打开、关闭弹层。 */
function Controlled(props: {
  readonly children: (open: boolean) => ReactNode
  readonly api: { set?: (open: boolean) => void }
}) {
  const [open, setOpen] = useState(false)
  props.api.set = setOpen
  return <>{props.children(open)}</>
}

describe('弹层的进出场（rc-motion 的类名）', () => {
  /**
   * 打开、关闭一次，记录弹层上出现过的类名；进场的 active 步骤时读一次计算样式（base.css 用过渡代替 antd 的关键帧）。
   */
  async function cycle(selector: string, setOpen: (open: boolean) => Promise<void>) {
    const seen = new Set<string>()
    const active: { animation: string; transition: string }[] = []
    const record = () => {
      for (const el of document.querySelectorAll(selector)) {
        for (const c of el.classList) seen.add(c)
        if ([...el.classList].some((c) => /-(enter|appear)-active$/.test(c)))
          active.push({ animation: css(el).animationName, transition: css(el).transitionProperty })
      }
    }
    const observer = new MutationObserver(record)
    observer.observe(document.body, { subtree: true, childList: true, attributes: true })
    try {
      await setOpen(true)
      await expect.poll(() => [...seen].some((c) => /-(enter|appear)-active$/.test(c))).toBe(true)
      await setOpen(false)
      await expect.poll(() => [...seen].some((c) => /-leave-active$/.test(c))).toBe(true)
    } finally {
      observer.disconnect()
    }
    return { seen: [...seen], active }
  }

  async function check(
    selector: string,
    name: RegExp,
    ui: (open: boolean) => ReactNode,
  ): Promise<void> {
    const api: { set?: (open: boolean) => void } = {}
    await render(<Controlled api={api}>{ui}</Controlled>)
    const { seen, active } = await cycle(selector, async (open) => {
      api.set?.(open)
    })
    const motion = seen.filter((c) => name.test(c))
    expect(
      motion.some((c) => /-(enter|appear)$/.test(c)),
      seen.join(' '),
    ).toBe(true)
    expect(
      motion.some((c) => /-(enter|appear)-prepare$/.test(c)),
      seen.join(' '),
    ).toBe(true)
    expect(
      motion.some((c) => /-(enter|appear)-active$/.test(c)),
      seen.join(' '),
    ).toBe(true)
    expect(
      motion.some((c) => /-leave$/.test(c)),
      seen.join(' '),
    ).toBe(true)
    expect(
      motion.some((c) => /-leave-active$/.test(c)),
      seen.join(' '),
    ).toBe(true)
    // 进场是过渡，不是 antd 的关键帧
    expect(active.length).toBeGreaterThan(0)
    for (const step of active) {
      expect(step.animation).toBe('none')
      expect(step.transition).toContain('transform')
    }
  }

  it('下拉菜单：ant-slide-up / ant-slide-down', async () => {
    await check('.ant-dropdown', /^ant-slide-(up|down)-/, (open) => (
      <Dropdown open={open} menu={{ items: [{ key: 'edit', label: 'Edit' }] }}>
        <Button>More</Button>
      </Dropdown>
    ))
  })

  it('气泡卡片：ant-zoom-big', async () => {
    await check('.ant-popover', /^ant-zoom-big-/, (open) => (
      <Popover open={open} content="Details">
        <Button>Info</Button>
      </Popover>
    ))
  })

  it('对话框：ant-zoom，遮罩：ant-fade', async () => {
    await check('.ant-modal', /^ant-zoom-/, (open) => (
      <Modal open={open} title="Rename">
        Body
      </Modal>
    ))
    // 遮罩只淡入淡出：起始状态是透明
    const api: { set?: (open: boolean) => void } = {}
    await render(<Controlled api={api}>{(open) => <Modal open={open} title="Again" />}</Controlled>)
    const { seen } = await cycle('.ant-modal-mask', async (open) => {
      api.set?.(open)
    })
    expect(seen).toEqual(expect.arrayContaining(['ant-fade-leave', 'ant-fade-leave-active']))
    expect(
      seen.some((c) => /^ant-fade-(enter|appear)-active$/.test(c)),
      seen.join(' '),
    ).toBe(true)
  })
})

describe('折叠动画', () => {
  it('树展开时高度与透明度沿弹簧（改写 antd 令牌的 CSS 变量）；树的其他过渡不受影响', async () => {
    await render(
      <Tree
        options={[
          { key: 'product', title: 'Product', children: [{ key: 'design', title: 'Design' }] },
        ]}
      />,
    )
    let found: CSSStyleDeclaration | undefined
    const observer = new MutationObserver(() => {
      const el = document.querySelector('.ant-tree .ant-motion-collapse')
      if (el && !found) found = css(el)
    })
    observer.observe(document.body, { subtree: true, childList: true, attributes: true })
    try {
      await userEvent.click(document.querySelector('.ant-tree-switcher') as HTMLElement)
      await expect.poll(() => found).not.toBeUndefined()
    } finally {
      observer.disconnect()
    }
    const motion = found as CSSStyleDeclaration
    const properties = motion.transitionProperty.split(',').map((p) => p.trim())
    const durations = motion.transitionDuration.split(',').map((d) => ms(d.trim()))
    const easings = motion.transitionTimingFunction.split(/,(?![^(]*\))/).map((e) => e.trim())
    expect(properties).toEqual(['height', 'opacity'])
    for (const d of durations) expect(d).toBe(ms(token('motion-duration-spring')))
    for (const e of easings) expect(sameEasing(e, token('motion-ease-spring'))).toBe(true)
    // 节点本身的过渡仍取 antd 的 motionDurationMid（本库映射为 motion-duration-base）
    const node = document.querySelector('.ant-tree-node-content-wrapper') as Element
    expect(ms(css(node).transitionDuration.split(',')[0] ?? '')).toBe(
      ms(token('motion-duration-base')),
    )
  })
})

describe('气泡卡片的面板', () => {
  it('ant-popover-container 是浮层表面色与浮起阴影', async () => {
    await render(
      <Popover open content="Details">
        <Button>Info</Button>
      </Popover>,
    )
    await expect
      .poll(() => document.querySelector('.ant-popover .ant-popover-container'))
      .not.toBeNull()
    const panel = document.querySelector('.ant-popover .ant-popover-container') as Element
    expect(sameColor(css(panel).backgroundColor, token('color-bg-elevated'))).toBe(true)
    expect(css(panel).boxShadow).toBe(computed('box-shadow', 'var(--vl-shadow-float)'))
  })
})
