/**
 * 对话框类弹层在真实浏览器中的焦点（docs/11 §6.2「对话框」「键盘」）：
 * 打开后焦点进入、Tab 在内部循环、Esc 关闭、焦点还给触发元素；危险确认的默认焦点在「取消」上，需要输入名称才能确认。
 */
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  App,
  Button,
  ColorPicker,
  Drawer,
  Input,
  Modal,
  Popconfirm,
  Popover,
  Stack,
  useConfirmDanger,
} from '../../src/index.ts'
import { pauseTransition } from './animation.ts'
import { focused, page, render, userEvent } from './render.tsx'

const inside = (selector: string) => () => {
  const root = document.querySelector(selector)
  return Boolean(root && document.activeElement && root.contains(document.activeElement))
}
const inModal = inside('.ant-modal-wrap:not([style*="display: none"]) [role="dialog"]')
const inDrawer = inside('.ant-drawer-open [role="dialog"]')

/** Modal 进场结束后 rc-dialog 还会收焦点；先等它完成，再打开 DOM 树外的子弹层。 */
async function waitForModal(dialog: HTMLElement) {
  await expect
    .poll(
      () =>
        dialog.checkVisibility() &&
        !dialog.classList.contains('ant-zoom') &&
        dialog.contains(focused()),
      { timeout: 3000 },
    )
    .toBe(true)
}

/** 连按 n 次 Tab（或 Shift+Tab），记录每次之后焦点是否仍在对话框内、落在哪个元素上。 */
async function tabCycle(n: number, isInside: () => boolean, shift = false) {
  const seen: string[] = []
  for (let i = 0; i < n; i++) {
    await userEvent.tab({ shift })
    expect(isInside(), `第 ${i + 1} 次 ${shift ? 'Shift+Tab' : 'Tab'} 后焦点仍在对话框内`).toBe(
      true,
    )
    const el = focused()
    seen.push(el?.getAttribute('aria-label') || el?.textContent?.trim() || el?.tagName || '')
  }
  return seen
}

function ModalDemo() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Edit name</Button>
      <Modal
        open={open}
        title="Edit name"
        onCancel={() => setOpen(false)}
        onOk={() => setOpen(false)}
      >
        <Stack>
          <Input aria-label="Name" />
          <Input aria-label="Description" />
        </Stack>
      </Modal>
    </>
  )
}

function DrawerDemo() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Details</Button>
      <Drawer open={open} title="Member details" onClose={() => setOpen(false)}>
        <Stack>
          <Input aria-label="Title" />
          <Button>Save</Button>
        </Stack>
      </Drawer>
    </>
  )
}

describe('Modal', () => {
  it.each([
    {
      name: 'visibility:hidden',
      excluded: (
        <button type="button" style={{ visibility: 'hidden' }}>
          Hidden
        </button>
      ),
    },
    {
      name: 'visibility:collapse',
      excluded: (
        <button type="button" style={{ visibility: 'collapse' }}>
          Collapsed
        </button>
      ),
    },
    {
      name: 'disabled + tabindex',
      excluded: (
        <button type="button" disabled tabIndex={0}>
          Disabled
        </button>
      ),
    },
    {
      name: 'disabled fieldset + tabindex',
      excluded: (
        <fieldset disabled>
          <input tabIndex={0} aria-label="Disabled field" />
        </fieldset>
      ),
    },
    {
      name: 'hidden input + tabindex',
      // biome-ignore lint/a11y/noNoninteractiveTabindex: 故意给隐藏输入设置 tabindex，验证它仍被排除
      excluded: <input type="hidden" tabIndex={0} />,
    },
  ])('焦点循环排除 $name 控件，Tab 和 Shift+Tab 都能绕回', async ({ excluded }) => {
    await render(
      <Modal open title="Focus order" footer={null} closable={false}>
        {excluded}
        <button type="button">First visible</button>
        <button type="button">Last visible</button>
      </Modal>,
    )
    await waitForModal(page.getByRole('dialog', { name: 'Focus order' }).element() as HTMLElement)
    const first = page.getByRole('button', { name: 'First visible' }).element()
    const last = page.getByRole('button', { name: 'Last visible' }).element()
    last.focus()
    await userEvent.tab()
    expect(focused()).toBe(first)
    await userEvent.tab({ shift: true })
    expect(focused()).toBe(last)
  })

  it('第一次打开：焦点进入对话框，Tab / Shift+Tab 在内部循环，Esc 关闭后焦点回到触发按钮', async () => {
    await render(<ModalDemo />)
    await userEvent.tab()
    const trigger = page.getByRole('button', { name: 'Edit name' }).element()
    expect(focused()).toBe(trigger)
    await userEvent.keyboard('{Enter}')
    await expect.poll(inModal).toBe(true)
    // 关闭按钮、两个输入框、取消、确定：Tab 6 次一定绕回开头
    const forward = await tabCycle(6, inModal)
    expect(forward).toContain('Name')
    expect(forward).toContain('OK')
    expect(forward.filter((x) => x === 'Name').length).toBeGreaterThanOrEqual(1)
    await tabCycle(6, inModal, true)
    await userEvent.keyboard('{Escape}')
    await expect.poll(focused).toBe(trigger)
    await expect
      .poll(() => document.querySelector('.ant-modal-wrap')?.checkVisibility() ?? false)
      .toBe(false)
  })

  it('再次打开时行为相同', async () => {
    await render(<ModalDemo />)
    const trigger = page.getByRole('button', { name: 'Edit name' }).element()
    for (let round = 0; round < 2; round++) {
      trigger.focus()
      await userEvent.keyboard('{Enter}')
      await expect.poll(inModal).toBe(true)
      await tabCycle(6, inModal)
      await userEvent.keyboard('{Escape}')
      await expect.poll(focused).toBe(trigger)
      await expect
        .poll(() => document.querySelector('.ant-modal-wrap')?.checkVisibility() ?? false)
        .toBe(false)
    }
  })

  it('关闭后内容卸载：再次打开时其中的输入重新开始', async () => {
    await render(<ModalDemo />)
    const trigger = page.getByRole('button', { name: 'Edit name' })
    await userEvent.click(trigger)
    await expect.poll(inModal).toBe(true)
    await userEvent.fill(page.getByRole('textbox', { name: 'Name' }), 'Atlas')
    await userEvent.click(page.getByRole('button', { name: 'Cancel' }))
    await expect.poll(() => document.querySelector('.ant-modal-wrap')).toBeNull()
    await userEvent.click(trigger)
    await expect.poll(inModal).toBe(true)
    await expect.element(page.getByRole('textbox', { name: 'Name' })).toHaveValue('')
  })

  it('点击「取消」关闭后焦点回到触发按钮', async () => {
    await render(<ModalDemo />)
    const trigger = page.getByRole('button', { name: 'Edit name' })
    await userEvent.click(trigger)
    await expect.poll(inModal).toBe(true)
    await userEvent.click(page.getByRole('button', { name: 'Cancel' }))
    await expect.poll(focused).toBe(trigger.element())
  })
})

describe('Drawer', () => {
  it('打开后焦点进入抽屉，Tab 在内部循环，Esc 关闭后焦点回到触发按钮', async () => {
    await render(<DrawerDemo />)
    await userEvent.tab()
    const trigger = page.getByRole('button', { name: 'Details' }).element()
    await userEvent.keyboard('{Enter}')
    await expect.poll(inDrawer).toBe(true)
    const forward = await tabCycle(5, inDrawer)
    expect(forward).toContain('Title')
    expect(forward).toContain('Save')
    await tabCycle(5, inDrawer, true)
    await userEvent.keyboard('{Escape}')
    await expect.poll(focused).toBe(trigger)
  })

  it('抽屉面板获得焦点时不显示焦点环（焦点环只给可操作的元素）', async () => {
    await render(<DrawerDemo />)
    await userEvent.tab()
    await userEvent.keyboard('{Enter}')
    await expect.poll(inDrawer).toBe(true)
    const panel = document.querySelector('.ant-drawer-open [role="dialog"]') as HTMLElement
    expect(focused()).toBe(panel)
    expect(getComputedStyle(panel).outlineStyle).toBe('none')
  })

  it('关闭后内容卸载：收起的动画中内容仍在，动画结束后卸载，再次打开时输入重新开始', async () => {
    await render(<DrawerDemo />)
    const trigger = page.getByRole('button', { name: 'Details' })
    const title = () => document.querySelector<HTMLInputElement>('input[aria-label="Title"]')
    await userEvent.click(trigger)
    await expect.poll(inDrawer).toBe(true)
    await userEvent.fill(page.getByRole('textbox', { name: 'Title' }), 'Atlas')
    await userEvent.keyboard('{Escape}')
    // 收起的动画中面板不是空的：内容在动画结束后才卸载
    expect(title()?.value).toBe('Atlas')
    await expect.poll(title, { timeout: 3000 }).toBeNull()
    await userEvent.click(trigger)
    await expect.poll(inDrawer).toBe(true)
    await expect.element(page.getByRole('textbox', { name: 'Title' })).toHaveValue('')
  })
})

function NestedDialogs() {
  const [child, setChild] = useState(false)
  return (
    <Modal open title="Parent" footer={null}>
      <Button onClick={() => setChild(true)}>Open child</Button>
      <Modal open={child} title="Child" footer={null} onCancel={() => setChild(false)}>
        <Popconfirm title="Remove child item?" okText="Remove child item">
          <Button>Child delete</Button>
        </Popconfirm>
      </Modal>
    </Modal>
  )
}

describe('对话框内的 portal 子弹层', () => {
  it.each([
    { name: 'Modal', Container: Modal },
    { name: 'Drawer', Container: Drawer },
  ])('$name：Tab 可以从取消到确认，来回循环不会逃到页面或无关气泡', async ({ Container }) => {
    await render(
      <>
        <Button>Background</Button>
        <Popover open content={<Button>Unrelated popup</Button>}>
          <Button>Unrelated trigger</Button>
        </Popover>
        <Container open title="Parent" footer={null}>
          <Popconfirm title="Remove item?" okText="Remove item">
            <Button>Delete item</Button>
          </Popconfirm>
        </Container>
      </>,
    )
    const trigger = page.getByRole('button', { name: 'Delete item' }).element()
    const dialog = trigger.closest<HTMLElement>('[role="dialog"]') as HTMLElement
    if (Container === Modal) await waitForModal(dialog)
    await userEvent.click(trigger)
    await expect.poll(() => focused()?.textContent, { timeout: 3000 }).toBe('Cancel')
    const confirm = page.getByRole('button', { name: 'Remove item' }).element()
    const popup = confirm.closest('[role="tooltip"]')
    const inScope = () => Boolean(dialog?.contains(focused()) || popup?.contains(focused()))
    await userEvent.tab()
    expect(focused()).toBe(confirm)
    await userEvent.tab({ shift: true })
    expect(focused()?.textContent).toBe('Cancel')
    await tabCycle(8, inScope)
    await tabCycle(8, inScope, true)
    // 无关气泡中的元素即使意外获得焦点，也不能成为该对话框的一部分。
    page.getByRole('button', { name: 'Unrelated popup' }).element().focus()
    await userEvent.tab()
    expect(inScope()).toBe(true)
  })

  it('Popover 表单的输入框可以连续 Tab，越过最后一项后回到父对话框', async () => {
    await render(
      <Modal open title="Parent" footer={null}>
        <Popover
          trigger="click"
          content={
            <>
              <Input aria-label="Popup name" />
              <Input aria-label="Popup description" />
              <Button>Popup save</Button>
            </>
          }
        >
          <Button>Edit in popup</Button>
        </Popover>
        <Button>After popup</Button>
      </Modal>,
    )
    await waitForModal(page.getByRole('dialog', { name: 'Parent' }).element() as HTMLElement)
    await userEvent.click(page.getByRole('button', { name: 'Edit in popup' }))
    await expect
      .poll(focused, { timeout: 3000 })
      .toBe(page.getByRole('textbox', { name: 'Popup name' }).element())
    await userEvent.tab()
    expect(focused()).toBe(page.getByRole('textbox', { name: 'Popup description' }).element())
    await userEvent.tab()
    expect(focused()?.textContent).toBe('Popup save')
    await userEvent.tab()
    expect(focused()?.textContent).toBe('After popup')
  })

  it('ColorPicker 的面板有明确 ARIA 归属，Tab 保持在面板或父对话框中', async () => {
    await render(
      <Modal open title="Parent" footer={null}>
        <ColorPicker defaultValue="#2d6bf3" />
      </Modal>,
    )
    const trigger = page.getByRole('button', { name: 'Color' }).element()
    const dialog = trigger.closest<HTMLElement>('[role="dialog"]') as HTMLElement
    await waitForModal(dialog)
    await userEvent.click(trigger)
    // aria-expanded、可见面板与面板内焦点一起就绪，才开始验证 Tab 顺序。
    await expect
      .poll(
        () => {
          const popup = document.getElementById(trigger.getAttribute('aria-describedby') ?? '')
          return Boolean(
            trigger.getAttribute('aria-expanded') === 'true' &&
              popup?.checkVisibility() &&
              popup.contains(focused()),
          )
        },
        { timeout: 3000 },
      )
      .toBe(true)
    const popup = document.getElementById(trigger.getAttribute('aria-describedby') ?? '')
    expect(popup?.getAttribute('role')).toBe('tooltip')
    await userEvent.tab()
    expect(popup?.contains(focused())).toBe(true)
    await tabCycle(12, () => Boolean(dialog?.contains(focused()) || popup?.contains(focused())))
    await tabCycle(
      12,
      () => Boolean(dialog?.contains(focused()) || popup?.contains(focused())),
      true,
    )
  })

  it('嵌套气泡递归归属于当前对话框，Tab 顺序在触发元素后继续', async () => {
    await render(
      <Modal open title="Parent" footer={null}>
        <Popover
          trigger="click"
          content={
            <>
              <Popconfirm title="Remove nested item?" okText="Remove nested item">
                <Button>Nested delete</Button>
              </Popconfirm>
              <Button>After nested popup</Button>
            </>
          }
        >
          <Button>Open actions</Button>
        </Popover>
      </Modal>,
    )
    await waitForModal(page.getByRole('dialog', { name: 'Parent' }).element() as HTMLElement)
    await userEvent.click(page.getByRole('button', { name: 'Open actions' }))
    await expect.poll(() => focused()?.textContent, { timeout: 3000 }).toBe('Nested delete')
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => focused()?.textContent, { timeout: 3000 }).toBe('Cancel')
    await userEvent.tab()
    expect(focused()?.textContent).toBe('Remove nested item')
    await userEvent.tab()
    expect(focused()?.textContent).toBe('After nested popup')
    await userEvent.tab({ shift: true })
    expect(focused()?.textContent).toBe('Remove nested item')
  })

  it('子对话框打开时只循环它和它的气泡，关闭后恢复父对话框的约束', async () => {
    await render(<NestedDialogs />)
    const parent = page
      .getByRole('dialog', { name: 'Parent', exact: true })
      .element() as HTMLElement
    await waitForModal(parent)
    await userEvent.click(page.getByRole('button', { name: 'Open child' }))
    const child = page.getByRole('dialog', { name: 'Child', exact: true })
    await expect.element(child).toBeVisible()
    const dialog = child.element() as HTMLElement
    await waitForModal(dialog)
    const trigger = child.getByRole('button', { name: 'Child delete' }).element()
    await userEvent.click(trigger)
    const cancel = page.getByRole('button', { name: 'Cancel', exact: true })
    await expect.element(cancel, { timeout: 3000 }).toBeVisible()
    await expect.poll(focused, { timeout: 3000 }).toBe(cancel.element())
    const confirm = page.getByRole('button', { name: 'Remove child item' }).element()
    const popup = confirm.closest('[role="tooltip"]')
    await userEvent.tab()
    expect(focused()).toBe(confirm)
    await tabCycle(8, () => Boolean(dialog?.contains(focused()) || popup?.contains(focused())))
    await userEvent.click(dialog?.querySelector('button[aria-label="Close"]') as HTMLElement)
    await expect.poll(() => dialog.isConnected, { timeout: 3000 }).toBe(false)
    await expect
      .poll(focused, { timeout: 3000 })
      .toBe(page.getByRole('button', { name: 'Open child' }).element())
    await tabCycle(4, () => parent.contains(focused()))
  })
})

/** 抽屉面板当前的水平位移（px）：完全打开为 0，越往窗口外越大。 */
const panelX = () => {
  const wrapper = document.querySelector('.ant-drawer-content-wrapper')
  return wrapper ? new DOMMatrix(getComputedStyle(wrapper).transform).m41 : Number.NaN
}
const panelHidden = () =>
  document
    .querySelector('.ant-drawer-content-wrapper')
    ?.classList.contains('ant-drawer-content-wrapper-hidden') ?? true
const drawerPanel = () => document.querySelector<HTMLElement>('.ant-drawer-content-wrapper')

const drawer = (open: boolean) => (
  <Drawer open={open} title="Member details" onClose={() => {}} width={400}>
    <Input aria-label="Title" />
  </Drawer>
)

describe('Drawer 的进出场', () => {
  // 放慢动效（进场 1200ms、离场 900ms），在较慢的机器上也能在动画中途打断
  const slow = () => {
    document.documentElement.style.setProperty('--vl-motion-duration-slow', '1200ms')
    document.documentElement.style.setProperty('--vl-motion-duration-base', '900ms')
  }
  afterEach(() => {
    document.documentElement.style.removeProperty('--vl-motion-duration-slow')
    document.documentElement.style.removeProperty('--vl-motion-duration-base')
  })

  it('关闭时滑出窗口（不是立即消失），离场中的遮罩不再挡住页面；结束后面板隐藏', async () => {
    slow()
    const { rerender } = await render(drawer(true))
    await expect.poll(panelX, { timeout: 3000 }).toBe(0)
    const exiting = await pauseTransition(drawerPanel, 'transform', () => rerender(drawer(false)))
    exiting.at(0.25)
    const x = panelX()
    expect(x, '离场中途在原位与窗口外之间').toBeGreaterThan(0)
    expect(x).toBeLessThan(400)
    const mask = document.querySelector('.ant-drawer-mask') as HTMLElement
    expect(getComputedStyle(mask).pointerEvents).toBe('none')
    exiting.play()
    await expect.poll(panelHidden, { timeout: 3000 }).toBe(true)
  })

  it('关闭到一半又打开：从当前位置折返，不先跳到窗口外或直接跳到原位', async () => {
    slow()
    const { rerender } = await render(drawer(true))
    await expect.poll(panelX, { timeout: 3000 }).toBe(0)
    const exiting = await pauseTransition(drawerPanel, 'transform', () => rerender(drawer(false)))
    exiting.at(0.4)
    const before = panelX()
    expect(before).toBeGreaterThan(20)
    const width = (document.querySelector('.ant-drawer-content-wrapper') as HTMLElement).offsetWidth
    expect(before, '离场进行到一半，离完全滑出还远').toBeLessThan(width / 2)
    const entering = await pauseTransition(drawerPanel, 'transform', () => rerender(drawer(true)))
    entering.at(0)
    expect(panelX(), '从当前位移折返，没有跳到窗口外或原位').toBeCloseTo(before, 1)
    let previous = before
    for (const progress of [0.1, 0.25, 0.5, 0.75]) {
      entering.at(progress)
      expect(panelX(), '逐步向原位移动').toBeLessThanOrEqual(previous + 1)
      expect(panelX()).toBeGreaterThan(0)
      previous = panelX()
    }
    expect(panelX()).toBeLessThan(before)
    entering.play()
    await expect.poll(panelX, { timeout: 3000 }).toBe(0)
  })

  it('打开到一半就关闭：从当前位置滑出，不先跳到完全展开', async () => {
    slow()
    const { rerender } = await render(drawer(false))
    await rerender(drawer(true))
    const wrapper = document.querySelector('.ant-drawer-content-wrapper') as HTMLElement
    const transition = () =>
      wrapper
        .getAnimations()
        .find(
          (animation): animation is CSSTransition =>
            animation instanceof CSSTransition && animation.transitionProperty === 'transform',
        )
    await expect.poll(transition, { timeout: 3000 }).toBeDefined()
    const entering = transition() as CSSTransition
    // 暂停真实的 CSS 过渡并定位到进场中途：重渲染再慢，也不会把关闭前的位移读旧。
    entering.pause()
    await entering.ready
    entering.currentTime = Number(entering.effect?.getComputedTiming().duration) / 4
    const before = panelX()
    expect(before).toBeGreaterThan(20)
    expect(before).toBeLessThan(wrapper.offsetWidth)
    await rerender(drawer(false))
    await expect
      .poll(
        () => {
          const exiting = transition()
          return Boolean(exiting && exiting !== entering)
        },
        { timeout: 3000 },
      )
      .toBe(true)
    // 定位真实离场过渡的起点、中途与接近终点，让浏览器解析含百分比的 transform。
    const exiting = transition() as CSSTransition
    exiting.pause()
    await exiting.ready
    const duration = Number(exiting.effect?.getComputedTiming().duration)
    exiting.currentTime = 0
    expect(panelX(), '从被打断的位置开始，没有先跳到完全展开').toBeCloseTo(before, 0)
    exiting.currentTime = duration / 2
    expect(panelX(), '已经向窗口外滑出').toBeGreaterThan(before)
    exiting.currentTime = duration * 0.999
    expect(panelX(), '终点在窗口外').toBeGreaterThan(wrapper.offsetWidth)
    exiting.currentTime = 0
    exiting.play()
    await expect.poll(panelHidden, { timeout: 3000 }).toBe(true)
  })

  it('「减少动态效果」时立即打开、立即关闭，没有残留的遮罩', async () => {
    const { rerender } = await render(drawer(true), { reducedMotion: true })
    expect(panelX()).toBe(0)
    await rerender(drawer(false))
    await expect.poll(panelHidden, { timeout: 200 }).toBe(true)
    expect(document.querySelector('.ant-drawer-mask')).toBeNull()
  })
})

function ConfirmDemo(props: { confirmText?: string; onResult: (ok: boolean) => void }) {
  const confirm = useConfirmDanger()
  return (
    <Button
      tone="danger"
      onClick={() =>
        void confirm({
          title: 'Delete project',
          description: 'This cannot be undone.',
          confirmText: props.confirmText,
          okText: 'Delete',
        }).then(props.onResult)
      }
    >
      Delete project
    </Button>
  )
}

/** 不在 App 之内取得 useConfirmDanger 返回的函数。 */
let bareConfirm: ReturnType<typeof useConfirmDanger> | undefined
function BareConfirm() {
  bareConfirm = useConfirmDanger()
  return null
}

describe('useConfirmDanger', () => {
  const inConfirm = inside('.ant-modal-confirm')

  it.each([
    { locale: 'en-US', instruction: 'Type "Atlas" to confirm' },
    { locale: 'zh-CN', instruction: '请输入「Atlas」以确认' },
  ] as const)(
    '$locale：名称确认输入框由现有本地化提示命名，点击提示可聚焦',
    async ({ locale, instruction }) => {
      await render(<ConfirmDemo confirmText="Atlas" onResult={() => {}} />, { locale })
      await userEvent.click(page.getByRole('button', { name: 'Delete project' }))
      const input = page.getByRole('textbox')
      await expect.poll(focused).toBe(input.element())
      await expect.element(input).toHaveAccessibleName(instruction)
      ;(input.element() as HTMLElement).blur()
      await userEvent.click(page.getByText(instruction, { exact: true }))
      expect(focused()).toBe(input.element())
      await userEvent.keyboard('{Escape}')
      await expect.poll(() => document.querySelector('.ant-modal-confirm')).toBeNull()
    },
  )

  it('默认焦点在「取消」上：直接回车是取消；Tab 在对话框内循环', async () => {
    const results: boolean[] = []
    await render(<ConfirmDemo onResult={(r) => results.push(r)} />)
    await userEvent.tab()
    const trigger = page.getByRole('button', { name: 'Delete project' }).element()
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => focused()?.textContent).toBe('Cancel')
    await tabCycle(4, inConfirm)
    // 回到「取消」上再回车
    while (focused()?.textContent !== 'Cancel') await userEvent.tab()
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => results).toEqual([false])
    await expect.poll(focused).toBe(trigger)
  })

  it('要求输入名称：焦点在输入框中，名称一致前「确认」不可用，输入一致后可以确认', async () => {
    const results: boolean[] = []
    await render(<ConfirmDemo confirmText="atlas" onResult={(r) => results.push(r)} />)
    await userEvent.tab()
    await userEvent.keyboard('{Enter}')
    const input = page.getByTestId('confirm-danger-input')
    await expect.poll(() => focused()).toBe(input.element())
    const ok = page.getByRole('button', { name: 'Delete' })
    await expect.element(ok).toBeDisabled()
    await userEvent.keyboard('atla')
    await expect.element(ok).toBeDisabled()
    await userEvent.keyboard('s')
    await expect.element(ok).toBeEnabled()
    // 键盘确认：Tab 到「确认」上回车
    while (focused()?.textContent !== 'Delete') await userEvent.tab()
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => results).toEqual([true])
  })

  it('Esc 取消', async () => {
    const results: boolean[] = []
    await render(<ConfirmDemo onResult={(r) => results.push(r)} />)
    await userEvent.tab()
    await userEvent.keyboard('{Enter}')
    await expect.poll(inConfirm).toBe(true)
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => results).toEqual([false])
  })

  it('嵌套的 App 沿用最外层的对话框容器：内层 App 卸载后对话框仍在，结果照常返回', async () => {
    const results: boolean[] = []
    // render 已经包了一层 App，这里的 App 是嵌套的
    const nested = (show: boolean) =>
      show ? (
        <App>
          <ConfirmDemo onResult={(r) => results.push(r)} />
        </App>
      ) : null
    const { rerender } = await render(nested(true))
    await userEvent.click(page.getByRole('button', { name: 'Delete project' }))
    await expect.poll(() => focused()?.textContent).toBe('Cancel')
    await rerender(nested(false))
    expect(document.querySelector('.ant-modal-confirm')).not.toBeNull()
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => results).toEqual([false])
    await expect.poll(() => document.querySelector('.ant-modal-confirm')).toBeNull()
  })

  it('在门户中（抽屉里）调用：确认对话框显示在抽屉之上，取消后抽屉仍然打开', async () => {
    const results: boolean[] = []
    await render(
      <Drawer open title="Project">
        <ConfirmDemo onResult={(r) => results.push(r)} />
      </Drawer>,
    )
    const drawer = document.querySelector('.ant-drawer') as HTMLElement
    await userEvent.click(page.getByRole('button', { name: 'Delete project' }))
    await expect.poll(inConfirm).toBe(true)
    const confirm = document.querySelector('.ant-modal-confirm')?.closest('.ant-modal-wrap')
    expect(Number(getComputedStyle(confirm as Element).zIndex)).toBeGreaterThan(
      Number(getComputedStyle(drawer).zIndex),
    )
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => results).toEqual([false])
    expect(document.querySelector('.ant-drawer-open')).not.toBeNull()
  })

  it('不在 App 之内调用时，返回的 Promise 以明确的错误拒绝', async () => {
    const { createRoot } = await import('react-dom/client')
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    bareConfirm = undefined
    try {
      root.render(<BareConfirm />)
      // 通过函数读取：渲染时才赋值，类型检查看不到
      const confirm = () => bareConfirm
      await expect.poll(confirm).toBeDefined()
      await expect(
        confirm()?.({ title: 'Delete', description: 'x' }) ?? Promise.resolve(false),
      ).rejects.toThrow(/useConfirmDanger\(\) must be used inside the <App>/)
    } finally {
      root.unmount()
      container.remove()
    }
  })
})
