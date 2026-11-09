/**
 * Button / IconButton / LinkButton 在真实浏览器中的交互（docs/11 §6.2）：
 * 焦点环只在键盘操作时出现、状态层的悬停与按下、按下不缩放、加载时宽度不变、disabledReason。
 */
import { describe, expect, it, vi } from 'vitest'
import { Button, Icon, IconButton, LinkButton } from '../../src/index.ts'
import {
  clock,
  css,
  expectFocusRing,
  expectNoFocusRing,
  luminance,
  ms,
  page,
  press,
  pseudo,
  render,
  sameColor,
  settle,
  token,
  useFakeTimers,
  userEvent,
  visibleTooltips,
} from './render.tsx'

const opacity = (el: Element) => Number(pseudo(el, '::before').opacity)

/** 键盘焦点的起点：先点击前面的输入框，再按 Tab 移到被测元素上。 */
const Before = () => <input aria-label="Before" />

/** 鼠标点击不显示焦点环；从前面的输入框按 Tab 过来时显示。 */
async function expectRingOnlyForKeyboard(el: Element, offset: number) {
  await userEvent.click(el)
  expect(document.activeElement).toBe(el)
  expectNoFocusRing(el)
  await userEvent.click(page.getByRole('textbox', { name: 'Before' }))
  await userEvent.tab()
  expect(document.activeElement).toBe(el)
  expectFocusRing(el, offset)
}

/**
 * Playwright 的点击会等待元素「可用」，而 aria-disabled 的元素被视为不可用。用户仍然可以点到它，
 * 用 force 跳过这项检查，验证点击确实被拦截。
 */
const force = { force: true } as const
const box = (el: Element) => {
  const r = el.getBoundingClientRect()
  return { width: r.width, height: r.height, left: r.left, top: r.top }
}

describe('Button', () => {
  it('键盘焦点环（2px 强调色、外扩 2px）只在键盘操作时出现，鼠标点击不出现', async () => {
    await render(
      <>
        <Before />
        <Button>Save</Button>
      </>,
    )
    await expectRingOnlyForKeyboard(page.getByRole('button', { name: 'Save' }).element(), 2)
  })

  it('悬停、按下时填充色逐级加深；按下立即生效（0ms），松开后 120ms 恢复；不缩放、不位移', async () => {
    await render(<Button>Save</Button>)
    const btn = page.getByRole('button', { name: 'Save' }).element()
    const rest = css(btn).backgroundColor
    const restBox = box(btn)
    expect(ms(css(btn).transitionDuration)).toBe(ms(token('motion-duration-fast')))

    await userEvent.hover(btn)
    await expect.poll(() => css(btn).backgroundColor).not.toBe(rest)
    await expect.poll(() => luminance(css(btn).backgroundColor)).toBeLessThan(luminance(rest))
    const hover = css(btn).backgroundColor

    const release = await press(btn)
    expect(ms(css(btn).transitionDuration)).toBe(0)
    await expect.poll(() => luminance(css(btn).backgroundColor)).toBeLessThan(luminance(hover))
    expect(css(btn).transform).toBe('none')
    expect(box(btn)).toEqual(restBox)
    await release()
    expect(ms(css(btn).transitionDuration)).toBe(ms(token('motion-duration-fast')))
  })

  it('loading：没有图标的按钮宽度不变、文字透明占位；有图标的按钮把图标换成加载指示，宽度不变', async () => {
    const { rerender } = await render(
      <>
        <Button>Save changes</Button>
        <Button icon="download">Export</Button>
      </>,
    )
    const text = page.getByRole('button', { name: 'Save changes' }).element()
    const withIcon = page.getByRole('button', { name: 'Export' }).element()
    const textWidth = text.getBoundingClientRect().width
    const iconWidth = withIcon.getBoundingClientRect().width
    await rerender(
      <>
        <Button loading>Save changes</Button>
        <Button loading icon="download">
          Export
        </Button>
      </>,
    )
    expect(text.querySelector('.ant-btn-loading-icon')).not.toBeNull()
    expect(withIcon.querySelector('.ant-btn-loading-icon')).not.toBeNull()
    // antd 的加载指示有展开动画：等动画结束后再量
    await expect
      .poll(() => Math.abs(text.getBoundingClientRect().width - textWidth))
      .toBeLessThan(0.5)
    await expect
      .poll(() => Math.abs(withIcon.getBoundingClientRect().width - iconWidth))
      .toBeLessThan(0.5)
    const label = [...text.children].find((c) => !c.classList.contains('ant-btn-loading-icon'))
    expect(label && css(label).opacity).toBe('0')
  })

  it('loading 时忽略点击', async () => {
    const onClick = vi.fn()
    await render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    )
    await userEvent.click(page.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  describe('disabledReason', () => {
    it('悬停约 500ms 后出现原因提示（不足 500ms 不出现）', async () => {
      useFakeTimers()
      await render(
        <Button disabled disabledReason="No permission to delete">
          Delete
        </Button>,
      )
      const before = clock()
      await userEvent.hover(page.getByRole('button', { name: 'Delete' }))
      const after = clock()
      await before.to(450)
      expect(visibleTooltips()).toEqual([])
      await after.to(550)
      expect(visibleTooltips()).toEqual(['No permission to delete'])
    })

    it('Tab 聚焦时立即出现（不等待悬停延迟），且仍可聚焦', async () => {
      useFakeTimers()
      await render(
        <Button disabled disabledReason="No permission to delete">
          Delete
        </Button>,
      )
      await userEvent.tab()
      const btn = page.getByRole('button', { name: 'Delete' }).element()
      expect(document.activeElement).toBe(btn)
      await settle()
      expect(visibleTooltips()).toEqual(['No permission to delete'])
    })

    it('有 aria-describedby 指向原因；外观为禁用', async () => {
      await render(
        <Button disabled disabledReason="No permission to delete">
          Delete
        </Button>,
      )
      const btn = page.getByRole('button', { name: 'Delete' }).element()
      expect(btn.getAttribute('aria-disabled')).toBe('true')
      const id = btn.getAttribute('aria-describedby') ?? ''
      expect(id).not.toBe('')
      expect(document.getElementById(id)?.textContent).toBe('No permission to delete')
      await expect
        .element(page.getByRole('button', { name: 'Delete' }))
        .toHaveAccessibleDescription('No permission to delete')
    })

    it('点击被拦截：不调用 onClick、不提交外层表单', async () => {
      const onClick = vi.fn()
      const onSubmit = vi.fn((e: SubmitEvent) => e.preventDefault())
      await render(
        <form onSubmit={(e) => onSubmit(e.nativeEvent as SubmitEvent)}>
          <Button type="submit" disabled disabledReason="Fill in the name" onClick={onClick}>
            Create
          </Button>
        </form>,
      )
      await userEvent.click(page.getByRole('button', { name: 'Create' }), force)
      expect(onClick).not.toHaveBeenCalled()
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('Enter / 空格不会提交外层表单；输入框中回车的隐式提交也被拦截', async () => {
      const onClick = vi.fn()
      const onSubmit = vi.fn((e: SubmitEvent) => e.preventDefault())
      await render(
        <form onSubmit={(e) => onSubmit(e.nativeEvent as SubmitEvent)}>
          <input aria-label="Name" />
          <Button type="submit" disabled disabledReason="Fill in the name" onClick={onClick}>
            Create
          </Button>
        </form>,
      )
      await userEvent.click(page.getByRole('textbox', { name: 'Name' }))
      await userEvent.keyboard('{Enter}')
      await userEvent.tab()
      expect(document.activeElement).toBe(page.getByRole('button', { name: 'Create' }).element())
      await userEvent.keyboard('{Enter}')
      await userEvent.keyboard(' ')
      expect(onClick).not.toHaveBeenCalled()
      expect(onSubmit).not.toHaveBeenCalled()
    })
  })
})

describe('IconButton', () => {
  it('悬停、按下时状态层透明度取令牌；按下立即生效，松开 120ms 恢复；不缩放', async () => {
    await render(<IconButton icon="refresh" label="Refresh" tooltip={false} />)
    const btn = page.getByRole('button', { name: 'Refresh' }).element()
    const restBox = box(btn)
    expect(opacity(btn)).toBe(0)
    await userEvent.hover(btn)
    await expect.poll(() => opacity(btn)).toBeCloseTo(Number(token('state-hover-opacity')), 3)
    const release = await press(btn)
    expect(ms(pseudo(btn, '::before').transitionDuration)).toBe(0)
    await expect.poll(() => opacity(btn)).toBeCloseTo(Number(token('state-press-opacity')), 3)
    expect(css(btn).transform).toBe('none')
    expect(box(btn)).toEqual(restBox)
    await release()
    expect(ms(pseudo(btn, '::before').transitionDuration)).toBe(ms(token('motion-duration-fast')))
    await expect.poll(() => opacity(btn)).toBeCloseTo(Number(token('state-hover-opacity')), 3)
  })

  it('深色模式的状态层透明度（8% / 12%）', async () => {
    await render(<IconButton icon="refresh" label="Refresh" tooltip={false} />, {
      defaultColorMode: 'dark',
    })
    const btn = page.getByRole('button', { name: 'Refresh' }).element()
    expect(token('state-hover-opacity')).toBe('0.08')
    expect(token('state-press-opacity')).toBe('0.12')
    await userEvent.hover(btn)
    await expect.poll(() => opacity(btn)).toBeCloseTo(0.08, 3)
    const release = await press(btn)
    await expect.poll(() => opacity(btn)).toBeCloseTo(0.12, 3)
    await release()
  })

  it('焦点环只在键盘操作时出现', async () => {
    await render(
      <>
        <Before />
        <IconButton icon="refresh" label="Refresh" tooltip={false} />
      </>,
    )
    await expectRingOnlyForKeyboard(page.getByRole('button', { name: 'Refresh' }).element(), 2)
  })

  it('悬停 500ms 后显示文字说明；键盘聚焦时也显示', async () => {
    useFakeTimers()
    await render(<IconButton icon="refresh" label="Refresh" />)
    const btn = page.getByRole('button', { name: 'Refresh' })
    const before = clock()
    await userEvent.hover(btn)
    const after = clock()
    await before.to(450)
    expect(visibleTooltips()).toEqual([])
    await after.to(550)
    expect(visibleTooltips()).toEqual(['Refresh'])
  })

  it('键盘聚焦时立即显示文字说明（图标按钮的名称对键盘用户可见）', async () => {
    useFakeTimers()
    await render(<IconButton icon="refresh" label="Refresh" />)
    await userEvent.tab()
    await settle()
    expect(visibleTooltips()).toEqual(['Refresh'])
  })

  it('active：切换按钮的按下态，强调色浅底与 aria-pressed', async () => {
    await render(<IconButton icon="star" label="Star" tooltip={false} active />)
    const btn = page.getByRole('button', { name: 'Star', pressed: true }).element()
    expect(sameColor(css(btn).backgroundColor, token('color-fill-selected'))).toBe(true)
  })

  it('禁用：没有状态层；disabledReason 在 tooltip={false} 时也显示「说明：原因」，点击与回车不生效', async () => {
    useFakeTimers()
    const onClick = vi.fn()
    await render(
      <IconButton
        icon="download"
        label="Download"
        tooltip={false}
        disabled
        disabledReason="No access"
        onClick={onClick}
      />,
    )
    const btn = page.getByRole('button', { name: 'Download' }).element()
    await userEvent.hover(btn)
    expect(opacity(btn)).toBe(0)
    await clock().to(550)
    expect(visibleTooltips()).toEqual(['Download: No access'])
    await userEvent.click(btn, force)
    btn.focus()
    await userEvent.keyboard('{Enter}')
    expect(onClick).not.toHaveBeenCalled()
    await expect
      .element(page.getByRole('button', { name: 'Download' }))
      .toHaveAccessibleDescription('No access')
  })
})

describe('LinkButton', () => {
  it('焦点环只在键盘操作时出现（2px、外扩 2px）', async () => {
    await render(
      <>
        <Before />
        <LinkButton>View</LinkButton>
      </>,
    )
    await expectRingOnlyForKeyboard(page.getByRole('button', { name: 'View' }).element(), 2)
  })

  it('悬停文字加深、按下立即再加深（0ms），没有底色、不缩放', async () => {
    await render(<LinkButton>View</LinkButton>)
    const btn = page.getByRole('button', { name: 'View' }).element()
    expect(sameColor(css(btn).color, token('color-accent-text'))).toBe(true)
    await userEvent.hover(btn)
    await expect.poll(() => sameColor(css(btn).color, token('color-accent-text-hover'))).toBe(true)
    const release = await press(btn)
    expect(ms(css(btn).transitionDuration)).toBe(0)
    await expect.poll(() => sameColor(css(btn).color, token('color-accent-text-active'))).toBe(true)
    expect(css(btn).backgroundColor).toBe('rgba(0, 0, 0, 0)')
    expect(css(btn).transform).toBe('none')
    await release()
  })

  it('disabledReason：仍可聚焦并显示原因，点击不生效', async () => {
    useFakeTimers()
    const onClick = vi.fn()
    await render(
      <LinkButton disabled disabledReason="Archived" onClick={onClick}>
        Edit
      </LinkButton>,
    )
    await userEvent.tab()
    const btn = page.getByRole('button', { name: 'Edit' }).element()
    expect(document.activeElement).toBe(btn)
    await settle()
    expect(visibleTooltips()).toEqual(['Archived'])
    await userEvent.click(btn, force)
    await userEvent.keyboard('{Enter}')
    expect(onClick).not.toHaveBeenCalled()
  })
})
