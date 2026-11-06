/**
 * 对话框类弹层在真实浏览器中的焦点（docs/11 §6.2「对话框」「键盘」）：
 * 打开后焦点进入、Tab 在内部循环、Esc 关闭、焦点还给触发元素；危险确认的默认焦点在「取消」上，需要输入名称才能确认。
 */
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { Button, Drawer, Input, Modal, Stack, useConfirmDanger } from '../../src/index.ts'
import { focused, page, render, userEvent } from './render.tsx'

const inside = (selector: string) => () => {
  const root = document.querySelector(selector)
  return Boolean(root && document.activeElement && root.contains(document.activeElement))
}
const inModal = inside('.ant-modal-wrap:not([style*="display: none"]) [role="dialog"]')
const inDrawer = inside('.ant-drawer-open [role="dialog"]')

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

describe('useConfirmDanger', () => {
  const inConfirm = inside('.ant-modal-confirm')

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
})
