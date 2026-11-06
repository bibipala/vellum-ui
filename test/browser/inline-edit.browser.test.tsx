/**
 * InlineEdit 在真实浏览器中的行为（docs/11 §6.1「行内编辑」「乐观更新」、§6.2「表单」「不跳」「焦点」「键盘」）：
 * - 进入编辑：点击、Enter、F2；输入框获得焦点并全选文字；退出：Enter 保存、Esc 取消、失焦保存，焦点的去处；
 * - 保存：值没变不调用 onSave；乐观显示新值；保存中不能再次编辑；失败时回滚、重新打开并在字段下方显示错误；
 * - 校验：保存时校验，出错后随输入校验；数字（本地化、精度、范围、十进制字符串）与选择（选中即保存）；
 * - 禁用与原因；显示与编辑同高，放在表格中切换时行高不变、文字不移位；减少动态效果；值按文字渲染。
 */
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DataTable,
  InlineEdit,
  type InlineEditOption,
  type InlineEditProps,
  Pill,
} from '../../src/index.ts'
import {
  css,
  expectFocusRing,
  focused,
  page,
  parkPointer,
  pseudo,
  render,
  settle,
  token,
  transitionOf,
  useFakeTimers,
  userEvent,
  visibleTooltips,
} from './render.tsx'

afterEach(() => {
  vi.restoreAllMocks()
})

/** 受控的 InlineEdit：onSave 之后（Promise 完成后）更新值，与使用方的写法一致。 */
function Field<V extends string | number = string>(
  props: Omit<InlineEditProps<V>, 'value' | 'onSave' | 'label'> & {
    readonly initial: V | null
    readonly label?: string
    readonly onSave?: InlineEditProps<V>['onSave']
  },
) {
  const { initial, onSave, label = 'Name', ...rest } = props
  const [value, setValue] = useState<V | null>(initial)
  return (
    <InlineEdit<V>
      {...rest}
      label={label}
      value={value}
      onSave={(next) => {
        const result = onSave?.(next)
        if (result && typeof (result as Promise<unknown>).then === 'function')
          return (result as Promise<unknown>).then(() => setValue(next))
        setValue(next)
      }}
    />
  )
}

function deferred() {
  let resolve: () => void = () => {}
  let reject: (error: unknown) => void = () => {}
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const display = (name = 'Name') => page.getByRole('button', { name: `Edit ${name}` })
const input = (name = 'Name') =>
  page.getByRole('textbox', { name, exact: true }).element() as HTMLInputElement
const shownText = (testId = 'edit') =>
  page.getByTestId(testId).element().querySelector('[id]')?.textContent ?? null
const stateOf = (testId = 'edit') => page.getByTestId(testId).element().getAttribute('data-state')

/** 文字是否全部选中。 */
const allSelected = (el: HTMLInputElement) =>
  el.selectionStart === 0 && el.selectionEnd === el.value.length && el.value.length > 0

describe('InlineEdit：进入与退出编辑', () => {
  it('显示状态是按钮：读屏名称「Edit Name」、值是说明；悬停出现状态层与编辑图标；Tab 聚焦显示焦点环', async () => {
    await render(
      <>
        <input aria-label="Before" />
        <Field initial="Atlas" testId="edit" />
      </>,
    )
    const button = display().element() as HTMLButtonElement
    expect(button.tagName).toBe('BUTTON')
    const describedBy = button.getAttribute('aria-describedby') ?? ''
    expect(document.getElementById(describedBy)?.textContent).toBe('Atlas')
    const hint = button.querySelector('[aria-hidden="true"]') as HTMLElement
    expect(css(hint).opacity).toBe('0')
    await userEvent.hover(button)
    await expect.poll(() => css(hint).opacity).toBe('1')
    await expect
      .poll(() => Number(pseudo(button, '::before').opacity))
      .toBeCloseTo(Number(token('state-hover-opacity')), 2)
    await parkPointer()
    await userEvent.click(page.getByRole('textbox', { name: 'Before' }))
    await userEvent.tab()
    expect(focused()).toBe(button)
    expectFocusRing(button, 2)
    await expect.poll(() => css(hint).opacity).toBe('1')
  })

  it('点击进入编辑：输入框获得焦点并全选文字；Enter 保存并把焦点还给显示按钮', async () => {
    const onSave = vi.fn()
    await render(<Field initial="Atlas" onSave={onSave} testId="edit" />)
    await userEvent.click(display())
    expect(stateOf()).toBe('edit')
    const box = input()
    expect(focused()).toBe(box)
    expect(box.value).toBe('Atlas')
    expect(allSelected(box)).toBe(true)
    await userEvent.keyboard('Atlas Studio')
    await userEvent.keyboard('{Enter}')
    expect(onSave).toHaveBeenCalledExactlyOnceWith('Atlas Studio')
    expect(stateOf()).toBe('view')
    expect(shownText()).toBe('Atlas Studio')
    expect(focused()).toBe(display().element())
  })

  it('Enter 与 F2 在显示按钮上进入编辑；Esc 取消（不保存）并把焦点还给显示按钮', async () => {
    const onSave = vi.fn()
    await render(<Field initial="Atlas" onSave={onSave} testId="edit" />)
    const button = display().element() as HTMLButtonElement
    button.focus()
    await userEvent.keyboard('{Enter}')
    expect(focused()).toBe(input())
    await userEvent.keyboard('Changed')
    await userEvent.keyboard('{Escape}')
    expect(stateOf()).toBe('view')
    expect(shownText()).toBe('Atlas')
    expect(focused()).toBe(display().element())
    await userEvent.keyboard('{F2}')
    expect(stateOf()).toBe('edit')
    expect(allSelected(input())).toBe(true)
    await userEvent.keyboard('{Escape}')
    expect(focused()).toBe(display().element())
    expect(onSave).not.toHaveBeenCalled()
  })

  it('失焦时保存，焦点留在用户去的地方；值没有变化时不调用 onSave', async () => {
    const onSave = vi.fn()
    await render(
      <>
        <Field initial="Atlas" onSave={onSave} testId="edit" />
        <input aria-label="After" />
      </>,
    )
    await userEvent.click(display())
    await userEvent.tab()
    // 没有改动：不保存，回到显示状态
    expect(stateOf()).toBe('view')
    expect(onSave).not.toHaveBeenCalled()
    expect(focused()).toBe(page.getByRole('textbox', { name: 'After' }).element())
    await userEvent.click(display())
    await userEvent.keyboard('Borealis')
    await userEvent.click(page.getByRole('textbox', { name: 'After' }))
    expect(onSave).toHaveBeenCalledExactlyOnceWith('Borealis')
    expect(shownText()).toBe('Borealis')
    expect(focused()).toBe(page.getByRole('textbox', { name: 'After' }).element())
    // Enter 时同样：值没变就不调用
    await userEvent.click(display())
    await userEvent.keyboard('{Enter}')
    expect(onSave).toHaveBeenCalledOnce()
  })

  it('Esc 只取消编辑，不冒泡到外层（对话框、批量操作栏不会因为同一次 Esc 关闭）；Enter 不提交外层表单', async () => {
    const outerKey = vi.fn()
    const submit = vi.fn((e: Event) => e.preventDefault())
    await render(
      // biome-ignore lint/a11y/noStaticElementInteractions: 测试用的外层监听
      <div onKeyDown={(e) => outerKey(e.key)}>
        <form onSubmit={(e) => submit(e.nativeEvent)}>
          <Field initial="Atlas" testId="edit" />
        </form>
      </div>,
    )
    await userEvent.click(display())
    await userEvent.keyboard('{Escape}')
    expect(outerKey).not.toHaveBeenCalledWith('Escape')
    await userEvent.click(display())
    await userEvent.keyboard('X{Enter}')
    expect(submit).not.toHaveBeenCalled()
    expect(shownText()).toBe('X')
  })

  it('输入法组字时的 Enter 不保存', async () => {
    const onSave = vi.fn()
    await render(<Field initial="Atlas" onSave={onSave} testId="edit" />)
    await userEvent.click(display())
    const box = input()
    box.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }))
    box.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, isComposing: true }),
    )
    await settle()
    expect(stateOf()).toBe('edit')
    expect(onSave).not.toHaveBeenCalled()
  })
})

describe('InlineEdit：保存', () => {
  it('乐观更新：立即显示新值；保存中按钮 aria-busy、点击不能再次编辑；200ms 后才出现加载指示', async () => {
    const save = deferred()
    const onSave = vi.fn(() => save.promise)
    useFakeTimers()
    await render(<Field initial="Atlas" onSave={onSave} testId="edit" />)
    await userEvent.click(display())
    await userEvent.keyboard('Borealis{Enter}')
    expect(onSave).toHaveBeenCalledOnce()
    const button = display().element() as HTMLButtonElement
    expect(stateOf()).toBe('view')
    expect(shownText()).toBe('Borealis')
    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(focused()).toBe(button)
    // 很快完成的保存不闪加载指示：刚开始时仍是编辑图标
    expect(button.querySelector('.lucide-pencil')).not.toBeNull()
    await settle(250)
    expect(button.querySelector('.lucide-loader-circle')).not.toBeNull()
    // 保存中：点击、Enter、F2 都不进入编辑（不重复提交）
    await userEvent.click(button)
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard('{F2}')
    expect(stateOf()).toBe('view')
    expect(onSave).toHaveBeenCalledOnce()
    save.resolve()
    await settle(500)
    expect(button.hasAttribute('aria-busy')).toBe(false)
    expect(shownText()).toBe('Borealis')
    expect(button.querySelector('.lucide-pencil')).not.toBeNull()
    await userEvent.click(button)
    expect(stateOf()).toBe('edit')
  })

  it('保存失败：回滚为原值，以刚才的输入重新打开编辑，字段下方显示错误（立即播报），焦点回到输入框', async () => {
    const report = vi.spyOn(globalThis, 'reportError').mockImplementation(() => {})
    const failure = new Error('HTTP 500')
    await render(<Field initial="Atlas" onSave={() => Promise.reject(failure)} testId="edit" />)
    await userEvent.click(display())
    await userEvent.keyboard('Borealis{Enter}')
    await expect.poll(() => stateOf()).toBe('edit')
    const box = input()
    expect(box.value).toBe('Borealis')
    expect(focused()).toBe(box)
    const alert = page.getByRole('alert').element()
    expect(alert.textContent).toBe("Couldn't save. Try again.")
    expect(box.getAttribute('aria-invalid')).toBe('true')
    expect(box.getAttribute('aria-describedby')).toBe(alert.id)
    // 错误显示在输入框下方，不显示原始异常
    expect(alert.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      box.getBoundingClientRect().bottom,
    )
    expect(alert.textContent).not.toContain('HTTP 500')
    // 没有 onError：交给 reportError，不吞掉异常
    expect(report).toHaveBeenCalledWith(failure)
    // 取消：显示的是原值（已回滚）
    await userEvent.keyboard('{Escape}')
    expect(shownText()).toBe('Atlas')
    expect(focused()).toBe(display().element())
  })

  it('onError 返回的文字代替默认的失败提示；改动输入后失败提示消失；再次 Enter 重试成功', async () => {
    let attempt = 0
    const onSave = vi.fn(() => {
      attempt += 1
      return attempt === 1 ? Promise.reject(new Error('conflict')) : Promise.resolve()
    })
    const onError = vi.fn(() => 'The name is already taken')
    await render(<Field initial="Atlas" onSave={onSave} onError={onError} testId="edit" />)
    await userEvent.click(display())
    await userEvent.keyboard('Borealis{Enter}')
    await expect
      .poll(() => document.querySelector('[role="alert"]')?.textContent)
      .toBe('The name is already taken')
    expect(onError).toHaveBeenCalledOnce()
    await userEvent.keyboard('{End} 2')
    expect(document.querySelector('[role="alert"]')).toBeNull()
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => shownText()).toBe('Borealis 2')
    expect(onSave).toHaveBeenCalledTimes(2)
  })

  it('失焦保存失败、而用户已经去了别处：重新打开编辑显示错误，但不抢焦点', async () => {
    vi.spyOn(globalThis, 'reportError').mockImplementation(() => {})
    await render(
      <>
        <Field initial="Atlas" onSave={() => Promise.reject(new Error('x'))} testId="edit" />
        <input aria-label="After" />
      </>,
    )
    await userEvent.click(display())
    await userEvent.keyboard('Borealis')
    await userEvent.click(page.getByRole('textbox', { name: 'After' }))
    await expect.poll(() => stateOf()).toBe('edit')
    expect(focused()).toBe(page.getByRole('textbox', { name: 'After' }).element())
    expect(input().value).toBe('Borealis')
    expect(page.getByRole('alert').element().textContent).toBe("Couldn't save. Try again.")
  })

  it('onSave 同步抛出异常时同样回滚并显示错误', async () => {
    const onError = vi.fn(() => undefined)
    await render(
      <Field
        initial="Atlas"
        onSave={() => {
          throw new Error('boom')
        }}
        onError={onError}
        testId="edit"
      />,
    )
    await userEvent.click(display())
    await userEvent.keyboard('Borealis{Enter}')
    expect(stateOf()).toBe('edit')
    expect(page.getByRole('alert').element().textContent).toBe("Couldn't save. Try again.")
    expect(onError).toHaveBeenCalledOnce()
  })
})

describe('InlineEdit：校验', () => {
  const required = (v: string | null) => (v?.trim() ? undefined : 'Enter a name')

  it('Enter 时校验，不通过不保存、错误显示在字段下方；出错后随输入校验，改正后错误立即消失', async () => {
    const onSave = vi.fn()
    await render(<Field initial="Atlas" onSave={onSave} validate={required} testId="edit" />)
    await userEvent.click(display())
    await userEvent.keyboard('{Backspace}')
    // 出错之前不打断输入
    expect(document.querySelector('[role="alert"]')).toBeNull()
    await userEvent.keyboard('{Enter}')
    expect(onSave).not.toHaveBeenCalled()
    const box = input()
    expect(focused()).toBe(box)
    const alert = page.getByRole('alert').element()
    expect(alert.textContent).toBe('Enter a name')
    expect(alert.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      box.getBoundingClientRect().bottom,
    )
    expect(box.closest('.ant-input-status-error, .ant-input')?.className).toContain('status-error')
    // 随输入校验
    await userEvent.keyboard('B')
    expect(document.querySelector('[role="alert"]')).toBeNull()
    await userEvent.keyboard('{Backspace}')
    expect(page.getByRole('alert').element().textContent).toBe('Enter a name')
    await userEvent.keyboard('Borealis{Enter}')
    expect(onSave).toHaveBeenCalledExactlyOnceWith('Borealis')
  })

  it('失焦时校验不通过：留在编辑中显示错误，不保存', async () => {
    const onSave = vi.fn()
    await render(
      <>
        <Field initial="Atlas" onSave={onSave} validate={required} testId="edit" />
        <input aria-label="After" />
      </>,
    )
    await userEvent.click(display())
    await userEvent.keyboard('{Backspace}')
    await userEvent.tab()
    expect(stateOf()).toBe('edit')
    expect(page.getByRole('alert').element().textContent).toBe('Enter a name')
    expect(onSave).not.toHaveBeenCalled()
  })
})

describe('InlineEdit：数字', () => {
  it('按语言写出（千分位、固定小数位、等宽数字）；编辑时是原始数字；保存十进制字符串并按精度取舍', async () => {
    const onSave = vi.fn()
    await render(
      <Field<string>
        type="number"
        label="Price"
        initial="1250.5"
        precision={2}
        onSave={onSave}
        testId="edit"
      />,
    )
    expect(shownText()).toBe('1,250.50')
    expect(
      css(page.getByTestId('edit').element().querySelector('[id]') as Element).fontVariantNumeric,
    ).toBe('tabular-nums')
    await userEvent.click(display('Price'))
    const box = page.getByRole('spinbutton', { name: 'Price' }).element() as HTMLInputElement
    expect(focused()).toBe(box)
    expect(box.value).toBe('1250.50')
    expect(allSelected(box)).toBe(true)
    expect(css(box).fontVariantNumeric).toBe('tabular-nums')
    await userEvent.keyboard('2000.456{Enter}')
    expect(onSave).toHaveBeenCalledExactlyOnceWith('2000.46')
    expect(shownText()).toBe('2,000.46')
  })

  it('zh-CN 的写法；超出范围时显示错误（范围也按语言写出），不保存', async () => {
    const onSave = vi.fn()
    await render(
      <Field<string>
        type="number"
        label="Quantity"
        initial="12"
        min={1}
        max="10000"
        onSave={onSave}
        testId="edit"
      />,
      { locale: 'zh-CN' },
    )
    await userEvent.click(page.getByRole('button', { name: '编辑 Quantity' }))
    await userEvent.keyboard('20000{Enter}')
    expect(onSave).not.toHaveBeenCalled()
    expect(page.getByRole('alert').element().textContent).toBe('请输入 1 到 10,000 之间的数字')
    await userEvent.keyboard('{Backspace}')
    expect(document.querySelector('[role="alert"]')).toBeNull()
    await userEvent.keyboard('{Enter}')
    expect(onSave).toHaveBeenCalledExactlyOnceWith('2000')
    expect(shownText()).toBe('2,000')
  })

  it('只有下限或上限时的提示；值只是写法不同（1250.5 与 1250.50）时不算变化；清空时保存 null', async () => {
    const onSave = vi.fn()
    await render(
      <Field<string>
        type="number"
        label="Price"
        initial="1250.50"
        min="0"
        onSave={onSave}
        testId="edit"
      />,
    )
    await userEvent.click(display('Price'))
    await userEvent.keyboard('-1{Enter}')
    expect(page.getByRole('alert').element().textContent).toBe('Enter a number of at least 0')
    await userEvent.keyboard('{Control>}a{/Control}1250.5{Enter}')
    expect(onSave).not.toHaveBeenCalled()
    expect(stateOf()).toBe('view')
    await userEvent.click(display('Price'))
    await userEvent.keyboard('{Backspace}{Enter}')
    expect(onSave).toHaveBeenCalledExactlyOnceWith(null)
    expect(shownText()).toBe('Not set')
  })

  it('值是数字时 onSave 也收到数字；上限的提示', async () => {
    const onSave = vi.fn()
    await render(
      <Field<number>
        type="number"
        label="Count"
        initial={3}
        max={5}
        onSave={onSave}
        testId="edit"
      />,
    )
    await userEvent.click(display('Count'))
    await userEvent.keyboard('9{Enter}')
    expect(page.getByRole('alert').element().textContent).toBe('Enter a number of at most 5')
    await userEvent.keyboard('{Backspace}4{Enter}')
    expect(onSave).toHaveBeenCalledExactlyOnceWith(4)
  })
})

describe('InlineEdit：选择', () => {
  const options: InlineEditOption[] = [
    { value: 'active', label: 'Active' },
    { value: 'paused', label: 'Paused' },
    { value: 'archived', label: 'Archived' },
  ]

  it('进入编辑时打开选项；选中即保存，显示选项文字，焦点回到显示按钮', async () => {
    const onSave = vi.fn()
    await render(
      <Field
        type="select"
        label="Status"
        options={options}
        initial="active"
        onSave={onSave}
        testId="edit"
      />,
    )
    expect(shownText()).toBe('Active')
    await userEvent.click(display('Status'))
    const combo = page.getByRole('combobox', { name: 'Status' }).element()
    expect(focused()).toBe(combo)
    await expect
      .poll(() => document.querySelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)'))
      .not.toBeNull()
    await userEvent.click(page.getByRole('option', { name: 'Paused' }))
    expect(onSave).toHaveBeenCalledExactlyOnceWith('paused')
    expect(shownText()).toBe('Paused')
    expect(focused()).toBe(display('Status').element())
  })

  it('键盘：↓ 与 Enter 选择并保存；Esc 取消；失焦取消；选中原来的值不保存', async () => {
    const onSave = vi.fn()
    await render(
      // 打开的选项列表在字段下方，失焦用上方的输入框
      <>
        <input aria-label="Before" />
        <Field
          type="select"
          label="Status"
          options={options}
          initial="active"
          onSave={onSave}
          testId="edit"
        />
      </>,
    )
    const button = display('Status').element() as HTMLButtonElement
    button.focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard('{Escape}')
    expect(stateOf()).toBe('view')
    expect(focused()).toBe(display('Status').element())
    await userEvent.keyboard('{F2}')
    await userEvent.keyboard('{ArrowDown}{Enter}')
    expect(onSave).toHaveBeenCalledExactlyOnceWith('paused')
    expect(focused()).toBe(display('Status').element())
    await userEvent.keyboard('{Enter}')
    expect(stateOf()).toBe('edit')
    await userEvent.click(page.getByRole('textbox', { name: 'Before' }))
    expect(stateOf()).toBe('view')
    expect(onSave).toHaveBeenCalledOnce()
    await userEvent.click(display('Status'))
    await userEvent.click(page.getByRole('option', { name: 'Paused' }))
    expect(onSave).toHaveBeenCalledOnce()
    expect(stateOf()).toBe('view')
  })

  it('render 自定义显示（如 Pill）', async () => {
    await render(
      <Field
        type="select"
        label="Status"
        options={options}
        initial="active"
        render={(v) => <Pill tone={v === 'active' ? 'success' : 'neutral'}>{v.toUpperCase()}</Pill>}
        testId="edit"
      />,
    )
    expect(shownText()).toBe('ACTIVE')
    expect(page.getByTestId('edit').element().querySelector('[data-tone="success"]')).not.toBeNull()
  })
})

describe('InlineEdit：禁用、空值与安全', () => {
  it('disabled：原生禁用，值照常显示，没有编辑图标，点击不进入编辑', async () => {
    await render(<Field initial="Atlas" disabled testId="edit" />)
    const button = display().element() as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(shownText()).toBe('Atlas')
    expect(button.querySelector('svg')).toBeNull()
    await userEvent.click(button, { force: true })
    expect(stateOf()).toBe('view')
  })

  it('disabledReason：可用 Tab 聚焦（aria-disabled），悬停与聚焦显示原因，读屏读出原因；不能进入编辑', async () => {
    useFakeTimers()
    await render(
      <>
        <input aria-label="Before" />
        <Field
          initial="Atlas"
          disabled
          disabledReason="Only the owner can rename it"
          testId="edit"
        />
      </>,
    )
    const button = display().element() as HTMLButtonElement
    expect(button.disabled).toBe(false)
    expect(button.getAttribute('aria-disabled')).toBe('true')
    const ids = (button.getAttribute('aria-describedby') ?? '').split(' ')
    expect(ids.map((id) => document.getElementById(id)?.textContent)).toEqual([
      'Atlas',
      'Only the owner can rename it',
    ])
    await userEvent.click(page.getByRole('textbox', { name: 'Before' }))
    await userEvent.tab()
    expect(focused()).toBe(button)
    await settle(600)
    expect(visibleTooltips()).toContain('Only the owner can rename it')
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard('{F2}')
    await userEvent.click(button, { force: true })
    expect(stateOf()).toBe('view')
  })

  it('空值显示语言包中的占位文字（可以覆盖），输入框的占位相同', async () => {
    await render(
      <>
        <Field initial={null} label="Owner" testId="a" />
        <Field initial="" label="Note" placeholder="Add a note" testId="b" />
      </>,
      { locale: 'zh-CN' },
    )
    expect(shownText('a')).toBe('未填写')
    expect(shownText('b')).toBe('Add a note')
    const empty = page.getByTestId('a').element().querySelector('[data-empty]') as Element
    expect(empty).not.toBeNull()
    await userEvent.click(page.getByRole('button', { name: '编辑 Note' }))
    expect(input('Note').placeholder).toBe('Add a note')
  })

  it('值按文字渲染，不当作 HTML', async () => {
    await render(
      <Field initial={'<img src=x onerror="window.__xss=1"><b>bold</b>'} testId="edit" />,
    )
    const root = page.getByTestId('edit').element()
    expect(root.querySelector('img, b')).toBeNull()
    expect(shownText()).toBe('<img src=x onerror="window.__xss=1"><b>bold</b>')
  })
})

describe('InlineEdit：尺寸与动效', () => {
  /** 显示与编辑两种状态的外框、文字的起点。 */
  async function measure(testId: string) {
    const root = page.getByTestId(testId).element()
    const button = root.querySelector('button') as HTMLElement
    const shown = button.getBoundingClientRect()
    const textStart = (root.querySelector('[id]') as HTMLElement).getBoundingClientRect().left
    await userEvent.click(button)
    const field = root.querySelector('input') as HTMLInputElement
    const outer = field.closest('.ant-input-number, .ant-select') ?? field
    const frame = outer.getBoundingClientRect()
    // 选择器的文字在 .ant-select-content 中；输入框的文字从内边距与描边之后开始
    const content = root.querySelector('.ant-select-content')
    const s = css(field)
    const inputTextStart = content
      ? content.getBoundingClientRect().left
      : field.getBoundingClientRect().left +
        Number.parseFloat(s.paddingLeft) +
        Number.parseFloat(s.borderLeftWidth)
    return { shown, frame, textStart, inputTextStart }
  }

  const statuses: InlineEditOption[] = [
    { value: 'active', label: 'Active' },
    { value: 'paused', label: 'Paused' },
  ]

  for (const density of ['comfortable', 'compact'] as const)
    it(`显示与编辑同高、文字不移位；放在表格行中切换时行高与列宽不变（${density}）`, async () => {
      const rows = [{ id: '1', name: 'Atlas', price: '1250.50', status: 'active' }]
      await render(
        <DataTable
          aria-label="Orders"
          rowKey={(r) => r.id}
          rows={rows}
          columns={[
            { key: 'id', title: 'Plain' },
            {
              key: 'name',
              title: 'Name',
              render: (r) => <Field initial={r.name} testId="name" />,
            },
            {
              key: 'price',
              title: 'Price',
              render: (r) => (
                <Field<string>
                  type="number"
                  label="Price"
                  precision={2}
                  initial={r.price}
                  testId="price"
                />
              ),
            },
            {
              key: 'status',
              title: 'Status',
              render: (r) => (
                <Field
                  type="select"
                  label="Status"
                  options={statuses}
                  initial={r.status}
                  testId="status"
                />
              ),
            },
          ]}
        />,
        { defaultDensity: density },
      )
      const row = () => document.querySelector('tbody tr') as HTMLElement
      const widths = () =>
        [...row().querySelectorAll('td')].map((td) => td.getBoundingClientRect().width)
      const height = token('inline-edit-height')
      expect(height).toBe(density === 'compact' ? '28px' : '32px')
      const before = row().getBoundingClientRect().height
      const columns = widths()
      for (const id of ['name', 'price', 'status']) {
        const m = await measure(id)
        expect(m.shown.height, id).toBe(Number.parseFloat(height))
        expect(m.frame.height, id).toBe(m.shown.height)
        expect(m.frame.top, id).toBeCloseTo(m.shown.top, 1)
        expect(m.frame.width, id).toBeCloseTo(m.shown.width, 1)
        expect(m.inputTextStart, id).toBeCloseTo(m.textStart, 0)
        expect(row().getBoundingClientRect().height, id).toBe(before)
        expect(widths(), id).toEqual(columns)
        await userEvent.keyboard('{Escape}')
        expect(row().getBoundingClientRect().height, id).toBe(before)
      }
      // 与只有文字的单元格一样高：控件伸出行高的部分用负外边距抵消
      const plainCell = row().querySelector('td') as HTMLElement
      const textLine = Number.parseFloat(css(plainCell).lineHeight)
      const padding =
        Number.parseFloat(css(plainCell).paddingTop) +
        Number.parseFloat(css(plainCell).paddingBottom)
      // DataTable 的行分隔不占单元格的盒子（边框宽度为 0）；照实际的边框宽度计算，不写死
      const border =
        Number.parseFloat(css(plainCell).borderTopWidth) +
        Number.parseFloat(css(plainCell).borderBottomWidth)
      expect(before).toBeCloseTo(textLine + padding + border, 0)
    })

  it('出错时错误显示在字段下方，表格的列宽不变', async () => {
    await render(
      <DataTable
        aria-label="Projects"
        rowKey={(r) => r.id}
        rows={[{ id: '1', name: 'Atlas' }]}
        columns={[
          { key: 'id', title: 'Plain' },
          {
            key: 'name',
            title: 'Name',
            render: (r) => (
              <Field
                initial={r.name}
                validate={() => 'This name is too long for the project list'}
                testId="name"
              />
            ),
          },
        ]}
      />,
    )
    const row = () => document.querySelector('tbody tr') as HTMLElement
    const widths = () =>
      [...row().querySelectorAll('td')].map((td) => td.getBoundingClientRect().width)
    const columns = widths()
    await userEvent.click(display())
    await userEvent.keyboard('X{Enter}')
    expect(page.getByRole('alert').element().textContent).toBe(
      'This name is too long for the project list',
    )
    expect(widths()).toEqual(columns)
  })

  it('减少动态效果：编辑图标的出现没有过渡', async () => {
    await render(<Field initial="Atlas" testId="edit" />, { reducedMotion: true })
    const hint = display().element().querySelector('[aria-hidden="true"]') as HTMLElement
    expect(transitionOf(hint, 'opacity')).toBe(0)
  })

  it('默认的编辑图标过渡取 motion-duration-fast', async () => {
    await render(<Field initial="Atlas" testId="edit" />)
    const hint = display().element().querySelector('[aria-hidden="true"]') as HTMLElement
    expect(transitionOf(hint, 'opacity')).toBe(120)
  })
})
