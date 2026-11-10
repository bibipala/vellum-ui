/**
 * 上传在真实浏览器中的交互（docs/11 §6.1「拖放」、§6.2「键盘」「焦点」；ADR 0020「影响」中的安全要求）：
 * 选择文件后列表显示进度与结果；没有指定上传方式时不发请求；accept / maxSize 拒绝的文件不进列表；
 * 拖放区的拖入样式、拖出、投放；失败重试；移除后焦点移到下一项、列表空了回到触发元素；
 * 触发按钮与拖放区的键盘操作（Enter / 空格打开对话框，焦点留在触发元素上）。
 */
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Button, Upload, type UploadFile, type UploadRequestOptions } from '../../src/index.ts'
import {
  css,
  expectFocusRing,
  focused,
  page,
  render,
  sameColor,
  token,
  userEvent,
} from './render.tsx'

const csv = (name = 'orders.csv', size = 64) =>
  new File(['x'.repeat(size)], name, { type: 'text/csv' })

/** 可控的上传请求：记下每次调用的参数，由测试决定何时汇报进度、成功或失败。 */
function controlled() {
  const calls: UploadRequestOptions[] = []
  const abort = vi.fn()
  const request = (options: UploadRequestOptions) => {
    calls.push(options)
    return { abort }
  }
  return { calls, abort, request }
}

const fileInput = () =>
  document.querySelector<HTMLInputElement>('input[type="file"]') as HTMLInputElement
const rows = () => [...document.querySelectorAll<HTMLElement>('ul[aria-label="Files"] > li')]
const rowTexts = () => rows().map((li) => li.textContent ?? '')

/** 原生文件选择（允许在同一个 input 上连续选择）。 */
function choose(...files: File[]) {
  const transfer = new DataTransfer()
  for (const file of files) transfer.items.add(file)
  const input = fileInput()
  input.files = transfer.files
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

function ControlledUpload(props: {
  request: (options: UploadRequestOptions) => { abort(): void }
}) {
  const [list, setList] = useState<readonly UploadFile[]>([])
  const [accept, setAccept] = useState(true)
  return (
    <>
      <Button onClick={() => setAccept(false)}>Reject next</Button>
      <Upload
        maxCount={1}
        fileList={list}
        onChange={({ fileList }) => {
          if (accept) setList(fileList)
        }}
        customRequest={props.request}
      >
        <Button>Choose files</Button>
      </Upload>
    </>
  )
}

/** 拦截打开文件对话框（无头浏览器中也不真的打开），返回调用次数的计数器。 */
function interceptDialog() {
  const opened = vi.fn()
  fileInput().addEventListener('click', (e) => {
    e.preventDefault()
    opened()
  })
  return opened
}

/** 携带文件的拖放事件。 */
function drag(
  target: Element,
  type: 'dragenter' | 'dragover' | 'dragleave' | 'drop',
  files: File[] = [csv()],
) {
  const dataTransfer = new DataTransfer()
  for (const f of files) dataTransfer.items.add(f)
  target.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer }))
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Upload', () => {
  it('maxCount=1 替换文件时取消旧请求，迟到的旧回调不改变新文件', async () => {
    const calls: { options: UploadRequestOptions; abort: ReturnType<typeof vi.fn> }[] = []
    await render(
      <Upload
        maxCount={1}
        customRequest={(options) => {
          const abort = vi.fn()
          calls.push({ options, abort })
          return { abort }
        }}
      >
        <Button>Choose files</Button>
      </Upload>,
    )
    choose(csv('first.csv'))
    await expect.poll(() => calls.length).toBe(1)
    choose(csv('second.csv'))
    await expect.poll(() => calls.length).toBe(2)
    await expect.poll(rowTexts).toEqual([expect.stringContaining('second.csv')])
    expect(calls[0]?.abort).toHaveBeenCalledOnce()
    expect(calls[1]?.abort).not.toHaveBeenCalled()
    calls[0]?.options.onSuccess({ stale: true })
    expect(rowTexts()).toEqual([expect.stringContaining('second.csv')])
  })

  it('maxCount=1 批量选择只上传最后保留的文件，并取消被替换的旧请求', async () => {
    const calls: { options: UploadRequestOptions; abort: ReturnType<typeof vi.fn> }[] = []
    await render(
      <Upload
        maxCount={1}
        multiple
        customRequest={(options) => {
          const abort = vi.fn()
          calls.push({ options, abort })
          return { abort }
        }}
      >
        <Button>Choose files</Button>
      </Upload>,
    )
    choose(csv('old.csv'))
    await expect.poll(() => calls.length).toBe(1)
    choose(csv('discarded.csv'), csv('kept.csv'))
    await expect.poll(rowTexts).toEqual([expect.stringContaining('kept.csv')])
    await expect.poll(() => calls.length).toBe(2)
    expect(calls.map(({ options }) => options.file.name)).toEqual(['old.csv', 'kept.csv'])
    expect(calls[0]?.abort).toHaveBeenCalledOnce()
    expect(calls[1]?.abort).not.toHaveBeenCalled()
  })

  it('受控列表接受替换时取消旧请求；拒绝替换时保留旧请求', async () => {
    const calls: { options: UploadRequestOptions; abort: ReturnType<typeof vi.fn> }[] = []
    await render(
      <ControlledUpload
        request={(options) => {
          const abort = vi.fn()
          calls.push({ options, abort })
          return { abort }
        }}
      />,
    )
    choose(csv('first.csv'))
    await expect.poll(() => calls.length).toBe(1)
    choose(csv('second.csv'))
    await expect.poll(rowTexts).toEqual([expect.stringContaining('second.csv')])
    await expect.poll(() => calls.length).toBe(2)
    expect(calls[0]?.abort).toHaveBeenCalledOnce()
    await userEvent.click(page.getByRole('button', { name: 'Reject next' }))
    choose(csv('rejected.csv'))
    await expect.poll(rowTexts).toEqual([expect.stringContaining('second.csv')])
    expect(calls).toHaveLength(2)
    expect(calls[1]?.abort).not.toHaveBeenCalled()
  })

  it('已经完成的请求被 maxCount 替换时不会再取消', async () => {
    const calls: { options: UploadRequestOptions; abort: ReturnType<typeof vi.fn> }[] = []
    await render(
      <Upload
        maxCount={1}
        customRequest={(options) => {
          const abort = vi.fn()
          calls.push({ options, abort })
          return { abort }
        }}
      >
        <Button>Choose files</Button>
      </Upload>,
    )
    choose(csv('finished.csv'))
    await expect.poll(() => calls.length).toBe(1)
    calls[0]?.options.onSuccess({})
    await expect.poll(() => rows()[0]?.dataset.status).toBe('done')
    choose(csv('new.csv'))
    await expect.poll(rowTexts).toEqual([expect.stringContaining('new.csv')])
    expect(calls[0]?.abort).not.toHaveBeenCalled()
  })

  it('maxCount 替换正在重试的文件时只取消当前重试', async () => {
    const calls: { options: UploadRequestOptions; abort: ReturnType<typeof vi.fn> }[] = []
    await render(
      <Upload
        maxCount={1}
        customRequest={(options) => {
          const abort = vi.fn()
          calls.push({ options, abort })
          return { abort }
        }}
      >
        <Button>Choose files</Button>
      </Upload>,
    )
    choose(csv('first.csv'))
    await expect.poll(() => calls.length).toBe(1)
    calls[0]?.options.onError(new Error('Try again'))
    await userEvent.click(page.getByRole('button', { name: 'Retry' }))
    await expect.poll(() => calls.length).toBe(2)
    choose(csv('replacement.csv'))
    await expect.poll(rowTexts).toEqual([expect.stringContaining('replacement.csv')])
    await expect.poll(() => calls.length).toBe(3)
    expect(calls[0]?.abort).not.toHaveBeenCalled()
    expect(calls[1]?.abort).toHaveBeenCalledOnce()
    expect(calls[2]?.abort).not.toHaveBeenCalled()
  })

  it('选择文件：列表显示上传中与百分比，成功后显示大小；请求由 customRequest 发出', async () => {
    const { calls, request } = controlled()
    const onChange = vi.fn()
    await render(
      <Upload customRequest={request} onChange={onChange}>
        <Button>Choose files</Button>
      </Upload>,
    )
    await userEvent.upload(fileInput(), csv('orders.csv', 2048))
    await expect.poll(() => calls.length).toBe(1)
    expect((calls[0]?.file as File | undefined)?.name).toBe('orders.csv')
    await expect.poll(rowTexts).toEqual([expect.stringContaining('orders.csv')])
    expect(rows()[0]?.dataset.status).toBe('uploading')
    calls[0]?.onProgress(40)
    await expect.poll(() => rowTexts()[0]).toContain('40%')
    expect(rows()[0]?.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe(
      '40',
    )
    calls[0]?.onSuccess?.({ ok: true })
    await expect.poll(() => rows()[0]?.dataset.status).toBe('done')
    expect(rowTexts()[0]).toContain('2.0 KB')
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ fileList: [expect.objectContaining({ status: 'done' })] }),
    )
  })

  it('没有 action 与 customRequest 时不发任何请求：文件只加入列表', async () => {
    const open = vi.spyOn(XMLHttpRequest.prototype, 'open')
    const fetchSpy = vi.spyOn(window, 'fetch')
    const onChange = vi.fn()
    await render(
      <Upload onChange={onChange} multiple>
        <Button>Choose files</Button>
      </Upload>,
    )
    await userEvent.upload(fileInput(), [csv('a.csv'), csv('b.csv')])
    await expect
      .poll(rowTexts)
      .toEqual([expect.stringContaining('a.csv'), expect.stringContaining('b.csv')])
    expect(rows().map((li) => li.dataset.status)).toEqual(['selected', 'selected'])
    expect(open).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
    const last = onChange.mock.lastCall?.[0] as { fileList: UploadFile[] }
    expect(last.fileList.map((f) => f.name)).toEqual(['a.csv', 'b.csv'])
  })

  it('accept 与 maxSize：不符合的文件不进列表，onReject 给出原因；点选也校验（antd 只在拖入时过滤）', async () => {
    const { calls, request } = controlled()
    const onReject = vi.fn()
    await render(
      <Upload
        accept=".csv,image/*"
        maxSize={1024}
        customRequest={request}
        onReject={onReject}
        multiple
      >
        <Button>Choose files</Button>
      </Upload>,
    )
    expect(fileInput().accept).toBe('.csv,image/*')
    await userEvent.upload(fileInput(), [
      new File(['x'], 'setup.exe', { type: 'application/octet-stream' }),
      csv('huge.csv', 4096),
      new File(['x'], 'photo.PNG', { type: 'image/png' }),
      csv('ok.CSV', 10),
    ])
    await expect
      .poll(rowTexts)
      .toEqual([expect.stringContaining('photo.PNG'), expect.stringContaining('ok.CSV')])
    expect(onReject.mock.calls.map(([f, reason]) => [(f as File).name, reason])).toEqual([
      ['setup.exe', 'type'],
      ['huge.csv', 'size'],
    ])
    expect(calls.map((c) => (c.file as File).name)).toEqual(['photo.PNG', 'ok.CSV'])
  })

  it('上传失败：显示「上传失败」与「重试」，重试用同样的参数重新请求并回到上传中，成功后变为完成', async () => {
    const { calls, request } = controlled()
    await render(
      <Upload customRequest={request}>
        <Button>Choose files</Button>
      </Upload>,
    )
    await userEvent.upload(fileInput(), csv('orders.csv'))
    await expect.poll(() => calls.length).toBe(1)
    calls[0]?.onError?.(new Error('Server unavailable'))
    await expect.poll(() => rows()[0]?.dataset.status).toBe('error')
    expect(rowTexts()[0]).toContain('Upload failed')
    const retry = page.getByRole('button', { name: 'Retry' })
    await userEvent.click(retry)
    await expect.poll(() => calls.length).toBe(2)
    expect(calls[1]).toBe(calls[0])
    await expect.poll(() => rows()[0]?.dataset.status).toBe('uploading')
    expect(document.querySelector('button[aria-label="Retry"]')).toBeNull()
    calls[1]?.onSuccess?.({})
    await expect.poll(() => rows()[0]?.dataset.status).toBe('done')
    expect(rows()).toHaveLength(1)
  })

  it.each([false, true])('卸载时取消仍在进行的请求（重试：%s）', async (retry) => {
    const { calls, abort, request } = controlled()
    const { unmount } = await render(
      <Upload customRequest={request}>
        <Button>Choose files</Button>
      </Upload>,
    )
    await userEvent.upload(fileInput(), csv())
    await expect.poll(() => calls.length).toBe(1)
    if (retry) {
      calls[0]?.onError(new Error('Try again'))
      await userEvent.click(page.getByRole('button', { name: 'Retry' }))
      await expect.poll(() => calls.length).toBe(2)
    }
    await unmount()
    expect(abort).toHaveBeenCalledOnce()
  })

  it.each(['success', 'error', 'remove'] as const)(
    '重试结束后卸载不再取消已经结束的请求（%s）',
    async (finish) => {
      const { calls, abort, request } = controlled()
      const { unmount } = await render(
        <Upload customRequest={request}>
          <Button>Choose files</Button>
        </Upload>,
      )
      await userEvent.upload(fileInput(), csv())
      await expect.poll(() => calls.length).toBe(1)
      calls[0]?.onError(new Error('Try again'))
      await userEvent.click(page.getByRole('button', { name: 'Retry' }))
      await expect.poll(() => calls.length).toBe(2)
      if (finish === 'remove') {
        await userEvent.click(page.getByRole('button', { name: 'Remove' }))
        await expect.poll(rows).toEqual([])
        expect(abort).toHaveBeenCalledOnce()
      } else {
        if (finish === 'success') calls[1]?.onSuccess({})
        else calls[1]?.onError(new Error('Still unavailable'))
        await expect
          .poll(() => rows()[0]?.dataset.status)
          .toBe(finish === 'success' ? 'done' : 'error')
        expect(abort).not.toHaveBeenCalled()
      }
      const cancelled = abort.mock.calls.length
      await unmount()
      expect(abort).toHaveBeenCalledTimes(cancelled)
    },
  )

  it('重试同步完成时也不保留取消句柄', async () => {
    const first: UploadRequestOptions[] = []
    const abort = vi.fn()
    let attempt = 0
    const { unmount } = await render(
      <Upload
        customRequest={(options) => {
          attempt++
          if (attempt === 1) first.push(options)
          else options.onSuccess({})
          return { abort }
        }}
      >
        <Button>Choose files</Button>
      </Upload>,
    )
    await userEvent.upload(fileInput(), csv())
    await expect.poll(() => first.length).toBe(1)
    first[0]?.onError(new Error('Try again'))
    await userEvent.click(page.getByRole('button', { name: 'Retry' }))
    await expect.poll(() => rows()[0]?.dataset.status).toBe('done')
    await unmount()
    expect(abort).not.toHaveBeenCalled()
  })

  it('重试可以用键盘操作：Tab 到「重试」，Enter 重新请求', async () => {
    const { calls, request } = controlled()
    await render(
      <Upload customRequest={request}>
        <Button>Choose files</Button>
      </Upload>,
    )
    await userEvent.upload(fileInput(), csv())
    await expect.poll(() => calls.length).toBe(1)
    calls[0]?.onError?.(new Error('Timeout'))
    await expect.poll(() => document.querySelector('button[aria-label="Retry"]')).not.toBeNull()
    await userEvent.tab()
    expect(focused()?.textContent).toBe('Choose files')
    await userEvent.tab()
    const retry = page.getByRole('button', { name: 'Retry' }).element()
    expect(focused()).toBe(retry)
    expectFocusRing(retry, 2)
    await userEvent.keyboard('{Enter}')
    await expect.poll(() => calls.length).toBe(2)
  })

  it('移除：焦点移到下一项的「移除」，最后一项移除后回到触发按钮；上传中的文件移除时取消请求', async () => {
    const { calls, abort, request } = controlled()
    const onRemove = vi.fn()
    await render(
      <Upload customRequest={request} onRemove={onRemove} multiple>
        <Button>Choose files</Button>
      </Upload>,
    )
    await userEvent.upload(fileInput(), [csv('a.csv'), csv('b.csv')])
    await expect.poll(() => calls.length).toBe(2)
    calls[1]?.onSuccess?.({})
    await expect.poll(() => rows()[1]?.dataset.status).toBe('done')
    // a.csv 仍在上传中
    const removeButtons = () => page.getByRole('button', { name: 'Remove' }).elements()
    await userEvent.tab()
    await userEvent.tab()
    expect(focused()).toBe(removeButtons()[0])
    await userEvent.keyboard('{Enter}')
    await expect.poll(rowTexts).toEqual([expect.stringContaining('b.csv')])
    expect(abort).toHaveBeenCalledOnce()
    expect(onRemove).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'a.csv' }))
    await expect.poll(focused).toBe(removeButtons()[0])
    // 已取消的请求之后再汇报结果，不会让文件回到列表
    calls[0]?.onSuccess?.({})
    await userEvent.keyboard('{Enter}')
    await expect.poll(rows).toEqual([])
    await expect.poll(focused).toBe(page.getByRole('button', { name: 'Choose files' }).element())
  })

  it('onRemove 返回 false 时不移除', async () => {
    await render(
      <Upload
        onRemove={() => false}
        defaultFileList={[{ uid: '1', name: 'keep.csv', status: 'done' }]}
      >
        <Button>Choose files</Button>
      </Upload>,
    )
    await userEvent.click(page.getByRole('button', { name: 'Remove' }))
    await new Promise((r) => setTimeout(r, 50))
    expect(rowTexts()).toEqual([expect.stringContaining('keep.csv')])
  })

  it('触发按钮：Enter / 空格打开选择文件的对话框，焦点留在按钮上（rc-upload 会让按钮失焦）', async () => {
    await render(
      <>
        <input aria-label="Before" />
        <Upload>
          <Button>Choose files</Button>
        </Upload>
      </>,
    )
    const opened = interceptDialog()
    await userEvent.click(page.getByRole('textbox', { name: 'Before' }))
    await userEvent.tab()
    const trigger = page.getByRole('button', { name: 'Choose files' }).element()
    expect(focused()).toBe(trigger)
    await userEvent.keyboard('{Enter}')
    expect(opened).toHaveBeenCalledTimes(1)
    expect(focused()).toBe(trigger)
    await userEvent.keyboard(' ')
    expect(opened).toHaveBeenCalledTimes(2)
    expect(focused()).toBe(trigger)
  })
})

describe('Upload.Dropzone', () => {
  const zone = () => document.querySelector<HTMLElement>('[data-vl-state]') as HTMLElement
  const target = () => zone().querySelector('.ant-upload-btn') as HTMLElement

  it('填充底与虚线；文件拖到上面时变为强调色浅底与强调色虚线，经过内部元素不闪烁，拖出后恢复', async () => {
    await render(<Upload.Dropzone hint="CSV, up to 1 MB" />)
    expect(css(zone()).borderStyle).toBe('dashed')
    expect(sameColor(css(zone()).backgroundColor, token('color-fill'))).toBe(true)
    expect(zone().textContent).toContain('Drag files here, or click to choose')
    expect(zone().textContent).toContain('CSV, up to 1 MB')

    const icon = zone().querySelector('svg') as Element
    drag(target(), 'dragenter')
    // 移到内部元素：先进入子元素，再离开外层元素（浏览器的事件顺序）
    drag(icon, 'dragenter')
    drag(target(), 'dragleave')
    await expect.poll(() => zone().dataset.dragOver).toBe('true')
    await expect
      .poll(() => sameColor(css(zone()).backgroundColor, token('color-accent-subtle')))
      .toBe(true)
    await expect.poll(() => sameColor(css(zone()).borderTopColor, token('color-accent'))).toBe(true)
    expect(zone().textContent).toContain('Drop to add the files')

    drag(icon, 'dragleave')
    await expect.poll(() => zone().dataset.dragOver).toBeUndefined()
    await expect.poll(() => sameColor(css(zone()).backgroundColor, token('color-fill'))).toBe(true)
    expect(zone().textContent).toContain('Drag files here, or click to choose')
  })

  it('拖动的不是文件（页面上的文字）时不提示投放', async () => {
    await render(<Upload.Dropzone />)
    target().dispatchEvent(
      new DragEvent('dragenter', { bubbles: true, dataTransfer: new DataTransfer() }),
    )
    await new Promise((r) => setTimeout(r, 50))
    expect(zone().dataset.dragOver).toBeUndefined()
  })

  it('投放：文件加入列表，拖入样式结束；不符合 accept 的文件被拒绝', async () => {
    const { calls, request } = controlled()
    const onReject = vi.fn()
    await render(
      <Upload.Dropzone accept=".csv" customRequest={request} onReject={onReject} multiple />,
    )
    drag(target(), 'dragenter')
    await expect.poll(() => zone().dataset.dragOver).toBe('true')
    drag(target(), 'drop', [
      csv('dropped.csv'),
      new File(['x'], 'notes.txt', { type: 'text/plain' }),
    ])
    await expect.poll(rowTexts).toEqual([expect.stringContaining('dropped.csv')])
    expect(zone().dataset.dragOver).toBeUndefined()
    expect(calls).toHaveLength(1)
    expect(onReject).toHaveBeenCalledWith(expect.objectContaining({ name: 'notes.txt' }), 'type')
  })

  it('Tab 聚焦时整个拖放区显示焦点环；Enter 与空格打开对话框；禁用时不可聚焦、拖入无效果', async () => {
    const before = <input aria-label="Before" />
    const { rerender } = await render(
      <>
        {before}
        <Upload.Dropzone />
      </>,
    )
    const opened = interceptDialog()
    await userEvent.click(page.getByRole('textbox', { name: 'Before' }))
    await userEvent.tab()
    expect(focused()).toBe(target())
    expect(target().getAttribute('role')).toBe('button')
    expectFocusRing(zone(), 2)
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard(' ')
    expect(opened).toHaveBeenCalledTimes(2)
    expect(focused()).toBe(target())

    await rerender(
      <>
        {before}
        <Upload.Dropzone disabled />
      </>,
    )
    await userEvent.click(page.getByRole('textbox', { name: 'Before' }))
    await userEvent.tab()
    expect(zone().contains(focused())).toBe(false)
    drag(target(), 'dragenter')
    await new Promise((r) => setTimeout(r, 50))
    expect(zone().dataset.dragOver).toBeUndefined()
  })
})
