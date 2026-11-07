/**
 * 页面配方（examples/recipes）在真实浏览器中运行：从首次加载的骨架到加载完成，每个配方演示的状态（错误与重试、
 * 回滚、校验、流式回复）都能操作出来，过程中没有 React 或组件库的报错与警告。用真实定时器：配方模拟的服务端延迟
 * 是几百毫秒。
 */
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest'
import { ChatPage } from '../../examples/recipes/ChatPage.recipe.tsx'
import { Dashboard } from '../../examples/recipes/Dashboard.recipe.tsx'
import { DetailPage } from '../../examples/recipes/DetailPage.recipe.tsx'
import { FormDialog } from '../../examples/recipes/FormDialog.recipe.tsx'
import { ListPage } from '../../examples/recipes/ListPage.recipe.tsx'
import { MasterDetail } from '../../examples/recipes/MasterDetail.recipe.tsx'
import { SettingsPage } from '../../examples/recipes/SettingsPage.recipe.tsx'
import { page, render, userEvent } from './render.tsx'

/**
 * 占满高度的页面（`Page fill`、SplitView）的高度来自应用外壳：测试中给它们一个固定高度的父元素。
 * 测试代码可以写内联样式；配方本身不写。
 */
function Shell(props: { readonly children: ReactNode }) {
  return (
    <div style={{ height: 640, display: 'flex', flexDirection: 'column' }}>{props.children}</div>
  )
}

/** 模拟的请求要几百毫秒，图表与 Markdown 还要先加载引擎。 */
const WAIT = { timeout: 8000 }

let error: MockInstance
let warn: MockInstance
beforeEach(() => {
  error = vi.spyOn(console, 'error')
  warn = vi.spyOn(console, 'warn')
})
afterEach(() => {
  expect(error).not.toHaveBeenCalled()
  expect(warn).not.toHaveBeenCalled()
  vi.restoreAllMocks()
})

describe('页面配方', () => {
  it('ListPage：加载完成后显示表格；搜索「error」显示错误状态，清空后恢复', async () => {
    await render(<ListPage />)
    await expect.element(page.getByRole('heading', { name: 'Projects' }), WAIT).toBeVisible()
    await expect.element(page.getByRole('table', { name: 'Projects' })).toBeVisible()
    const search = page.getByRole('searchbox', { name: 'Search projects' })
    await userEvent.fill(search, 'error')
    await userEvent.keyboard('{Enter}')
    await expect
      .element(page.getByText('The server is not responding', { exact: false }), WAIT)
      .toBeVisible()
    await userEvent.fill(search, '')
    await userEvent.keyboard('{Enter}')
    await expect.element(page.getByText('Beacon website launch'), WAIT).toBeVisible()
  })

  it('DetailPage：活动记录第一次失败，重试后显示时间线', async () => {
    await render(<DetailPage />)
    await expect
      .element(page.getByRole('heading', { name: 'Website redesign' }), WAIT)
      .toBeVisible()
    await expect
      .element(page.getByText('The activity service is not responding', { exact: false }), WAIT)
      .toBeVisible()
    await userEvent.click(page.getByRole('button', { name: 'Retry' }))
    await expect.element(page.getByText('Project created by Alex Morgan'), WAIT).toBeVisible()
  })

  it('MasterDetail：选择左侧的团队后右侧显示成员；Research 第一次失败，重试后显示', async () => {
    await render(
      <Shell>
        <MasterDetail />
      </Shell>,
    )
    await expect.element(page.getByRole('heading', { name: 'Teams' }), WAIT).toBeVisible()
    await expect.element(page.getByText('Select a team')).toBeVisible()
    await userEvent.click(page.getByRole('button', { name: /^Design/ }))
    await expect.element(page.getByRole('heading', { name: 'Design' }), WAIT).toBeVisible()
    await userEvent.click(page.getByRole('button', { name: /^Research/ }))
    await expect
      .element(page.getByText('The member directory is not responding', { exact: false }), WAIT)
      .toBeVisible()
    await userEvent.click(page.getByRole('button', { name: 'Retry' }))
    await expect.element(page.getByRole('heading', { name: 'Research' }), WAIT).toBeVisible()
  })

  it('SettingsPage：第一次切换「Weekly digest」失败后回滚并提示；修改后保存成功', async () => {
    await render(<SettingsPage />)
    await expect.element(page.getByRole('heading', { name: 'Settings' }), WAIT).toBeVisible()
    const digest = page.getByRole('switch', { name: 'Weekly digest' })
    await expect.element(digest).not.toBeChecked()
    await userEvent.click(digest)
    await expect.element(digest).toBeChecked()
    await expect
      .element(page.getByText(`Couldn't save "Weekly digest"`, { exact: false }), WAIT)
      .toBeVisible()
    await expect.element(digest).not.toBeChecked()
    await userEvent.click(page.getByRole('combobox', { name: 'First day of the week' }))
    await userEvent.keyboard('{ArrowDown}{Enter}')
    await userEvent.click(page.getByRole('button', { name: 'Save changes' }))
    await expect.element(page.getByText('Workspace settings saved'), WAIT).toBeVisible()
  })

  it('FormDialog：空表单提交显示错误；填写后发送，消息条确认，列表中出现新成员', async () => {
    await render(<FormDialog />)
    await userEvent.click(page.getByRole('button', { name: 'Invite member' }))
    const dialog = page.getByRole('dialog', { name: 'Invite member' })
    await expect.element(dialog, WAIT).toBeVisible()
    await userEvent.click(dialog.getByRole('button', { name: 'Send invitation' }))
    await expect.element(page.getByText('Enter the name of the person'), WAIT).toBeVisible()
    await userEvent.fill(dialog.getByRole('textbox', { name: /Name/ }), 'Taylor Brooks')
    await userEvent.fill(dialog.getByRole('textbox', { name: /Email/ }), 'alex.morgan@example.com')
    await userEvent.click(dialog.getByRole('button', { name: 'Send invitation' }))
    await expect.element(page.getByText('Alex Morgan is already a member'), WAIT).toBeVisible()
    await userEvent.fill(
      dialog.getByRole('textbox', { name: /Email/ }),
      'taylor.brooks@example.com',
    )
    await userEvent.click(dialog.getByRole('button', { name: 'Send invitation' }))
    await expect
      .element(page.getByText('Invitation sent to taylor.brooks@example.com'), WAIT)
      .toBeVisible()
    await expect.element(page.getByText('Taylor Brooks')).toBeVisible()
  })

  it('Dashboard：指标卡加载完成；柱状图第一次失败，重试后显示', async () => {
    await render(<Dashboard />)
    await expect.element(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
    await expect
      .element(page.getByText('The order service is not responding', { exact: false }), WAIT)
      .toBeVisible()
    await userEvent.click(page.getByRole('button', { name: 'Retry' }))
    await expect
      .poll(() => document.body.textContent?.includes('The order service is not responding'), WAIT)
      .toBe(false)
    await userEvent.click(page.getByText('7 days', { exact: true }))
    await expect.element(page.getByRole('link', { name: 'Export' }), WAIT).toBeVisible()
  })

  it('ChatPage：选择建议后回复以 Markdown 流式出现，完成后可以复制', async () => {
    await render(
      <Shell>
        <ChatPage />
      </Shell>,
    )
    await expect.element(page.getByRole('heading', { name: 'How can I help?' })).toBeVisible()
    await userEvent.click(page.getByRole('button', { name: 'Draft a status update' }))
    await expect.element(page.getByRole('button', { name: 'Stop generating' }), WAIT).toBeVisible()
    // Exact texts: the finished reply is also announced once in a hidden status element
    await expect
      .element(page.getByText('Let me know if you want it shorter for the newsletter.'), WAIT)
      .toBeVisible()
    await expect.element(page.getByRole('button', { name: 'Copy' }), WAIT).toBeVisible()
    // Rendered as Markdown: the bold text is its own element
    await expect.element(page.getByText('Status update, week 45', { exact: true })).toBeVisible()
  })
})
