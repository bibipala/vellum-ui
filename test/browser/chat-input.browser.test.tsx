/**
 * PromptInput 与 PromptSuggestions 在真实浏览器中的交互（docs/11 §6.2「不跳」「禁用」「焦点」；ADR 0020 §3「输入框：附件、停止生成」、
 * §6 安全）：
 * - Enter 发送（去掉首尾空白，非受控时清空），Shift+Enter 换行，空白不能发送；输入法组字时 Enter 不发送；自动增高到 maxRows；
 * - 生成中发送按钮原位变为停止（宽度不变），点击与 Esc 停止，Enter 不发送；按钮变回禁用的发送按钮时焦点回到文本框；
 * - disabled 与 disabledReason；填充式外观与聚焦光环；占位文字随语言；
 * - 附件：点按钮选择、拖入、粘贴都能添加；accept / maxSize / maxFiles 拒绝并给出原因；卡片显示名称与大小，移除后焦点移到
 *   下一张或文本框；提交时交出附件；组件不读取文件内容、不发请求、不读取剪贴板；
 * - 提示建议：点击、Enter、空格选择；禁用与禁用原因；纵向排列占满宽度。
 */
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PromptInput, type PromptInputSubmit, PromptSuggestions } from '../../src/index.ts'
import {
  css,
  expectFocusRing,
  focused,
  nextFrame,
  page,
  render,
  rgba,
  sameColor,
  token,
  userEvent,
  visibleTooltips,
} from './render.tsx'

afterEach(() => {
  vi.restoreAllMocks()
})

// antd 的自动增高在 body 中保留一个隐藏的测量用 textarea：只取渲染容器中的文本框
const textarea = () => document.querySelector('[data-test-root] textarea') as HTMLTextAreaElement
const button = (name: string) => page.getByRole('button', { name, exact: true })
const cards = () =>
  [...document.querySelectorAll('ul[aria-label="Attachments"] > li')].map((li) => li.textContent)
const fileInput = () => document.querySelector('input[type="file"]') as HTMLInputElement
const pdf = (name = 'report.pdf', size = 2048) =>
  new File(['x'.repeat(size)], name, { type: 'application/pdf' })
const png = (name = 'shot.png') => new File(['png'], name, { type: 'image/png' })

/** 携带文件的拖放事件。 */
function drag(
  target: Element,
  type: 'dragenter' | 'dragover' | 'dragleave' | 'drop',
  files: File[],
) {
  const dataTransfer = new DataTransfer()
  for (const f of files) dataTransfer.items.add(f)
  const event = new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer })
  target.dispatchEvent(event)
  return event
}

/** 粘贴事件：只有文件，或同时有文字。 */
function paste(target: Element, files: File[], text?: string) {
  const clipboardData = new DataTransfer()
  for (const f of files) clipboardData.items.add(f)
  if (text) clipboardData.setData('text/plain', text)
  const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData })
  target.dispatchEvent(event)
  return event
}

/**
 * 像选择文件对话框那样把文件放进 input 并触发 change。userEvent.upload 自己会读取文件内容（转交给 Playwright），
 * 断言「组件不读取文件」时不能用它。
 */
function choose(input: HTMLInputElement, files: File[]) {
  const dataTransfer = new DataTransfer()
  for (const f of files) dataTransfer.items.add(f)
  input.files = dataTransfer.files
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

/** 组件读取文件内容或发出请求的任何途径。 */
function spyOnReads() {
  return [
    vi.spyOn(FileReader.prototype, 'readAsArrayBuffer'),
    vi.spyOn(FileReader.prototype, 'readAsDataURL'),
    vi.spyOn(FileReader.prototype, 'readAsText'),
    vi.spyOn(Blob.prototype, 'arrayBuffer'),
    vi.spyOn(Blob.prototype, 'text'),
    vi.spyOn(Blob.prototype, 'stream'),
    vi.spyOn(URL, 'createObjectURL'),
    vi.spyOn(window, 'fetch'),
    vi.spyOn(XMLHttpRequest.prototype, 'open'),
  ]
}

/** 受控的输入框：提交后由使用方清空。 */
function Controlled(props: { readonly onSubmit: (m: PromptInputSubmit) => void }) {
  const [value, setValue] = useState('Draft')
  return (
    <PromptInput
      value={value}
      onChange={setValue}
      onSubmit={(m) => {
        props.onSubmit(m)
        setValue('')
      }}
    />
  )
}

describe('PromptInput', () => {
  it('Enter 发送（去掉首尾空白）并清空，焦点留在文本框；Shift+Enter 换行；空白不能发送', async () => {
    const onSubmit = vi.fn()
    await render(<PromptInput onSubmit={onSubmit} />)
    const send = button('Send')
    expect(send.element()).toBeDisabled()
    await userEvent.click(textarea())
    await userEvent.keyboard('   {Enter}')
    expect(onSubmit).not.toHaveBeenCalled()
    await userEvent.fill(textarea(), '')
    await userEvent.keyboard('Hello{Shift>}{Enter}{/Shift}world  ')
    expect(textarea().value).toBe('Hello\nworld  ')
    expect(send.element()).toBeEnabled()
    await userEvent.keyboard('{Enter}')
    expect(onSubmit).toHaveBeenCalledWith({ text: 'Hello\nworld', files: [] })
    await expect.poll(() => textarea().value).toBe('')
    expect(focused()).toBe(textarea())
    // 发送按钮同样发送
    await userEvent.keyboard('Again')
    await userEvent.click(send)
    expect(onSubmit).toHaveBeenLastCalledWith({ text: 'Again', files: [] })
    await expect.poll(() => focused()).toBe(textarea())
  })

  it('输入法组字时 Enter 只确认文字，不发送（isComposing 与 Safari 的 keyCode 229）', async () => {
    const onSubmit = vi.fn()
    await render(<PromptInput onSubmit={onSubmit} defaultValue="ni" />)
    const el = textarea()
    el.focus()
    el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }))
    el.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
        isComposing: true,
      }),
    )
    el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '你' }))
    // Safari：确认组字的 Enter 在 compositionend 之后到达，isComposing 为 false、keyCode 为 229
    const safari = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    Object.defineProperty(safari, 'keyCode', { value: 229 })
    el.dispatchEvent(safari)
    await nextFrame()
    expect(onSubmit).not.toHaveBeenCalled()
    await userEvent.keyboard('{Enter}')
    expect(onSubmit).toHaveBeenCalledWith({ text: 'ni', files: [] })
  })

  it('自动增高到 maxRows 行，之后在框内滚动', async () => {
    await render(
      <div style={{ width: 480 }}>
        <PromptInput maxRows={4} />
      </div>,
    )
    await userEvent.click(textarea())
    const one = textarea().getBoundingClientRect().height
    await userEvent.keyboard('a{Shift>}{Enter}{/Shift}b{Shift>}{Enter}{/Shift}c')
    await expect.poll(() => textarea().getBoundingClientRect().height).toBeGreaterThan(one * 2.5)
    const three = textarea().getBoundingClientRect().height
    await userEvent.keyboard(
      '{Shift>}{Enter}{/Shift}d{Shift>}{Enter}{/Shift}e{Shift>}{Enter}{/Shift}f{Shift>}{Enter}{/Shift}g',
    )
    await expect.poll(() => textarea().scrollHeight > textarea().clientHeight).toBe(true)
    const capped = textarea().getBoundingClientRect().height
    expect(capped).toBeGreaterThan(three)
    expect(capped).toBeLessThan(one * 4.5)
  })

  it('生成中：发送按钮原位变为「停止生成」（宽度不变），点击与 Esc 停止，Enter 不发送', async () => {
    const onStop = vi.fn()
    const onSubmit = vi.fn()
    const { rerender } = await render(<PromptInput onSubmit={onSubmit} onStop={onStop} />)
    const sendBox = button('Send').element().getBoundingClientRect()
    await rerender(<PromptInput onSubmit={onSubmit} onStop={onStop} generating />)
    const stop = button('Stop generating').element()
    expect(stop.getBoundingClientRect().width).toBe(sendBox.width)
    expect(stop.getBoundingClientRect().left).toBe(sendBox.left)
    await userEvent.click(stop)
    expect(onStop).toHaveBeenCalledTimes(1)
    await userEvent.click(textarea())
    await userEvent.keyboard('Next question{Enter}')
    expect(onSubmit).not.toHaveBeenCalled()
    expect(textarea().value).toBe('Next question')
    // Esc 停止，并且不再交给外层
    const outer = vi.fn()
    document.addEventListener('keydown', outer)
    await userEvent.keyboard('{Escape}')
    document.removeEventListener('keydown', outer)
    expect(onStop).toHaveBeenCalledTimes(2)
    expect(outer).not.toHaveBeenCalled()
  })

  it('停止后按钮变回禁用的发送按钮：焦点回到文本框，不落到 body 上', async () => {
    const { rerender } = await render(<PromptInput onStop={() => {}} generating />)
    button('Stop generating').element().focus()
    await rerender(<PromptInput onStop={() => {}} />)
    expect(button('Send').element()).toBeDisabled()
    await expect.poll(() => focused()).toBe(textarea())
  })

  it('不生成时 Esc 不拦截（交给外层，如关闭对话框）', async () => {
    await render(<PromptInput onStop={() => {}} />)
    const outer = vi.fn()
    document.addEventListener('keydown', outer)
    await userEvent.click(textarea())
    await userEvent.keyboard('{Escape}')
    document.removeEventListener('keydown', outer)
    expect(outer).toHaveBeenCalled()
  })

  it('受控的值：显示 value，输入通过 onChange 交给使用方', async () => {
    const submitted: PromptInputSubmit[] = []
    await render(<Controlled onSubmit={(m) => submitted.push(m)} />)
    expect(textarea().value).toBe('Draft')
    await userEvent.click(textarea())
    await userEvent.keyboard('{End} reply{Enter}')
    expect(submitted).toEqual([{ text: 'Draft reply', files: [] }])
    await expect.poll(() => textarea().value).toBe('')
  })

  it('浮起的表面色卡片、不描边；文本框聚焦时强调色细边与光环', async () => {
    await render(<PromptInput testId="prompt" />)
    const box = document.querySelector('[data-testid="prompt"] .ant-sender') as HTMLElement
    expect(sameColor(css(box).backgroundColor, token('color-bg-surface'))).toBe(true)
    expect(rgba(css(box).borderTopColor)[3]).toBe(0)
    expect(css(box).boxShadow).not.toBe('none')
    await userEvent.click(textarea())
    // 描边与光环都有 fast 过渡：等它们结束
    await expect
      .poll(() => [
        sameColor(css(box).borderTopColor, token('color-accent')),
        css(box).boxShadow.endsWith('0px 0px 0px 3px'),
      ])
      .toEqual([true, true])
    expect(
      sameColor(css(box).boxShadow.replace(/ 0px 0px 0px 3px$/, ''), token('color-focus-halo')),
    ).toBe(true)
    expect(textarea().getAttribute('aria-label')).toBe('Message')
    expect(textarea().placeholder).toBe('Type a message')
  })

  it('占位文字与按钮名称随语言切换', async () => {
    await render(<PromptInput allowFiles />, { locale: 'zh-CN' })
    expect(textarea().placeholder).toBe('输入消息')
    expect(textarea().getAttribute('aria-label')).toBe('消息')
    expect(button('发送').element()).toBeDisabled()
    expect(button('添加附件').element()).toBeEnabled()
  })

  it('disabled：不能输入、添加附件与发送', async () => {
    await render(<PromptInput disabled allowFiles defaultValue="Hi" />)
    expect(textarea()).toBeDisabled()
    expect(button('Send').element()).toBeDisabled()
    expect(button('Attach files').element()).toBeDisabled()
  })

  it('disabledReason：文本框仍可聚焦（只读、aria-disabled），悬停或聚焦显示原因，Enter 不发送', async () => {
    const onSubmit = vi.fn()
    await render(
      <>
        <button type="button">Before</button>
        <PromptInput
          disabled
          disabledReason="You can't reply in an archived conversation"
          defaultValue="Hi"
          onSubmit={onSubmit}
        />
      </>,
    )
    const el = textarea()
    // 不是原生禁用（仍可聚焦），而是只读 + aria-disabled
    expect(el.disabled).toBe(false)
    expect(el.readOnly).toBe(true)
    expect(el.getAttribute('aria-disabled')).toBe('true')
    await expect
      .element(page.getByRole('textbox', { name: 'Message' }))
      .toHaveAccessibleDescription("You can't reply in an archived conversation")
    page.getByRole('button', { name: 'Before' }).element().focus()
    await userEvent.tab()
    expect(focused()).toBe(el)
    await expect.poll(visibleTooltips).toContain("You can't reply in an archived conversation")
    await userEvent.keyboard('more{Enter}')
    expect(el.value).toBe('Hi')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('附件按钮打开选择文件；选中的文件显示为卡片（名称、大小）；提交时交出附件并清空', async () => {
    const onSubmit = vi.fn()
    await render(<PromptInput allowFiles onSubmit={onSubmit} />)
    const opened = vi.fn()
    fileInput().addEventListener('click', (e) => {
      e.preventDefault()
      opened()
    })
    await userEvent.click(button('Attach files'))
    expect(opened).toHaveBeenCalledTimes(1)
    const reads = spyOnReads()
    const file = pdf('plan.pdf', 2048)
    choose(fileInput(), [file])
    await expect.poll(cards).toEqual(['plan.pdf2.0 KB'])
    // 只有附件也可以发送
    expect(button('Send').element()).toBeEnabled()
    await userEvent.click(button('Send'))
    expect(onSubmit).toHaveBeenCalledWith({ text: '', files: [file] })
    await expect.poll(cards).toEqual([])
    for (const spy of reads) expect(spy).not.toHaveBeenCalled()
  })

  it('accept、maxSize、maxFiles：不符合的文件不加入，onReject 给出原因', async () => {
    const onReject = vi.fn()
    await render(
      <PromptInput
        allowFiles
        accept=".pdf,image/*"
        maxSize={4096}
        maxFiles={2}
        onReject={onReject}
      />,
    )
    const big = pdf('big.pdf', 10_000)
    const csv = new File(['a,b'], 'table.csv', { type: 'text/csv' })
    await userEvent.upload(fileInput(), [pdf('a.pdf'), csv, big, png('b.png'), png('c.png')])
    await expect.poll(cards).toEqual(['a.pdf2.0 KB', 'b.png3 B'])
    expect(onReject.mock.calls.map(([f, r]) => [(f as File).name, r])).toEqual([
      ['table.csv', 'type'],
      ['big.pdf', 'size'],
      ['c.png', 'count'],
    ])
  })

  it('拖入文件：显示投放区，投放后加入；拖出后恢复；不读取文件内容', async () => {
    const reads = spyOnReads()
    await render(<PromptInput allowFiles testId="prompt" />)
    const root = page.getByTestId('prompt').element()
    const box = root.querySelector('.ant-sender') as HTMLElement
    const files = [pdf('notes.pdf'), png('photo.png')]
    drag(box, 'dragenter', files)
    const over = drag(box, 'dragover', files)
    expect(over.defaultPrevented).toBe(true)
    await expect.poll(() => root.hasAttribute('data-drag-over')).toBe(true)
    await expect.element(page.getByText('Drop files to attach')).toBeVisible()
    // 颜色有 fast 过渡：等它结束
    await expect.poll(() => sameColor(css(box).borderTopColor, token('color-accent'))).toBe(true)
    expect(css(box).borderTopStyle).toBe('dashed')
    drag(box, 'dragleave', files)
    await expect.poll(() => root.hasAttribute('data-drag-over')).toBe(false)
    drag(box, 'dragenter', files)
    const drop = drag(box, 'drop', files)
    expect(drop.defaultPrevented).toBe(true)
    await expect.poll(cards).toEqual(['notes.pdf2.0 KB', 'photo.png3 B'])
    expect(root.hasAttribute('data-drag-over')).toBe(false)
    for (const spy of reads) expect(spy).not.toHaveBeenCalled()
  })

  it('没有 allowFiles 时拖入与粘贴文件都不处理', async () => {
    await render(<PromptInput testId="prompt" />)
    const box = page.getByTestId('prompt').element().querySelector('.ant-sender') as HTMLElement
    expect(drag(box, 'dragover', [pdf()]).defaultPrevented).toBe(false)
    expect(paste(textarea(), [png()]).defaultPrevented).toBe(false)
    expect(document.querySelector('ul[aria-label="Attachments"]')).toBeNull()
  })

  it('粘贴：只在粘贴事件里取文件（不读取剪贴板）；粘贴的内容有文字时按文字处理', async () => {
    const read = vi.fn()
    const readText = vi.fn()
    vi.spyOn(navigator, 'clipboard', 'get').mockReturnValue({
      read,
      readText,
      writeText: vi.fn(),
    } as unknown as Clipboard)
    await render(<PromptInput allowFiles />)
    textarea().focus()
    const event = paste(textarea(), [png('screenshot.png')])
    expect(event.defaultPrevented).toBe(true)
    await expect.poll(cards).toEqual(['screenshot.png3 B'])
    // 同时有文字（如从表格复制的内容带有图片）：交给文本框粘贴文字，不加入附件
    paste(textarea(), [png('cells.png')], 'a\tb')
    await nextFrame()
    expect(cards()).toEqual(['screenshot.png3 B'])
    expect(read).not.toHaveBeenCalled()
    expect(readText).not.toHaveBeenCalled()
  })

  it('移除附件：焦点移到同一位置的下一张卡片，最后一张移除后回到文本框', async () => {
    const onFilesChange = vi.fn()
    await render(
      <PromptInput
        allowFiles
        defaultFiles={[pdf('a.pdf'), pdf('b.pdf')]}
        onFilesChange={onFilesChange}
      />,
    )
    const remove = page.getByRole('button', { name: 'Remove a.pdf' })
    // 键盘：从文本框向前 Tab 到卡片的移除按钮（卡片在文本框之前）
    await userEvent.click(textarea())
    await userEvent.tab({ shift: true })
    await userEvent.tab({ shift: true })
    expect(focused()).toBe(remove.element())
    expectFocusRing(remove.element(), 2)
    await userEvent.keyboard('{Enter}')
    await expect.poll(cards).toEqual(['b.pdf2.0 KB'])
    expect(focused()?.getAttribute('aria-label')).toBe('Remove b.pdf')
    const changed = (onFilesChange.mock.lastCall?.[0] ?? []) as File[]
    expect(changed.map((f) => f.name)).toEqual(['b.pdf'])
    await userEvent.keyboard('{Enter}')
    await expect.poll(cards).toEqual([])
    expect(focused()).toBe(textarea())
  })
})

describe('PromptSuggestions', () => {
  const items = [
    {
      key: 'plan',
      label: 'Plan the launch',
      description: 'A checklist for next week',
      icon: 'sparkles',
    },
    { key: 'sum', label: 'Summarize the notes' },
    { key: 'off', label: 'Translate', disabled: true },
    {
      key: 'why',
      label: 'Export as PDF',
      disabled: true,
      disabledReason: 'Exports are turned off',
    },
  ] as const

  it('点击、Enter、空格选择；禁用的不响应；带原因的仍可聚焦并显示原因', async () => {
    const onSelect = vi.fn()
    await render(<PromptSuggestions items={items} onSelect={onSelect} />)
    const list = page.getByRole('list', { name: 'Suggestions' }).element()
    expect(list.querySelectorAll('li').length).toBe(4)
    await userEvent.click(page.getByRole('button', { name: /Plan the launch/ }))
    expect(onSelect).toHaveBeenLastCalledWith(items[0])
    await userEvent.tab()
    expect(focused()?.textContent).toBe('Summarize the notes')
    expectFocusRing(focused() as Element, 2)
    await userEvent.keyboard('{Enter}')
    expect(onSelect).toHaveBeenLastCalledWith(items[1])
    await userEvent.keyboard(' ')
    expect(onSelect).toHaveBeenCalledTimes(3)
    // 原生禁用的跳过；带原因的可以聚焦，读屏读出原因，按下无效
    const why = page.getByRole('button', { name: 'Export as PDF' })
    expect(why.element().getAttribute('aria-disabled')).toBe('true')
    await expect.element(why).toHaveAccessibleDescription('Exports are turned off')
    await userEvent.tab()
    expect(focused()).toBe(why.element())
    await expect.poll(visibleTooltips).toContain('Exports are turned off')
    await userEvent.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledTimes(3)
    expect(page.getByRole('button', { name: 'Translate' }).element()).toBeDisabled()
  })

  it('中性填充，悬停叠加状态层；纵向排列时占满宽度', async () => {
    await render(
      <div style={{ width: 480 }}>
        <PromptSuggestions items={items.slice(0, 2)} layout="vertical" />
      </div>,
    )
    const first = page.getByRole('button', { name: /Plan the launch/ }).element()
    expect(sameColor(css(first).backgroundColor, token('color-fill'))).toBe(true)
    expect(Math.round(first.getBoundingClientRect().width)).toBe(480)
    await userEvent.hover(first)
    await expect
      .poll(() => Number(getComputedStyle(first, '::before').opacity))
      .toBeCloseTo(Number(token('state-hover-opacity')), 2)
  })
})
