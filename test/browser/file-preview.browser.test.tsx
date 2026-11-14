/**
 * FilePreview 在真实浏览器中的行为：
 * - 按类型显示：图片、JSON（排版）、Markdown（渲染）、日志（换行）、不能预览的文件卡片、内存中的 File、二进制内容；
 *   超过 256 KB 的文本只显示开头并提示；地址加载失败时可以重试。
 * - 图片缩放：`+` / `-` / `0`、双击、缩放按钮的可用状态；放大后拖动平移，松手后图片的边不离开舞台。
 * - 手势：横向拖动换项，上下拖动关闭（未过阈值时回到原处），点击空白处关闭。
 * - 从缩略图飞入、飞回：第一帧在缩略图的位置，缩略图在飞行期间隐藏；关闭时飞回并在卸载后恢复。
 * - 自定义渲染、自定义按钮、下载；工具栏的提示显示在预览之内（看得见）。
 * - 嵌入式：未选择文件、文本、Ctrl + 滚轮缩放、全屏查看。
 */
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FilePreview, type FilePreviewItem } from '../../src/index.ts'
import { css, focused, page, render, settle, userEvent, visibleTooltips } from './render.tsx'

const root = document.documentElement
afterEach(() => {
  root.style.removeProperty('--vl-motion-duration-spring')
  root.style.removeProperty('--vl-motion-duration-fast')
})

const wait = (msValue: number) => new Promise((resolve) => setTimeout(resolve, msValue))
const frame = () => new Promise(requestAnimationFrame)

/** 指定尺寸的纯色 SVG 图片（不访问网络）。 */
const picture = (width: number, height: number, hue: number) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="hsl(${hue} 60% 55%)"/></svg>`,
  )}`

const files: FilePreviewItem[] = [
  { id: 'photo', name: 'photo.png', src: picture(1600, 1000, 200), size: 12_345 },
  { id: 'data', name: 'data.json', content: '{"a":1,"list":[1,2]}' },
  { id: 'notes', name: 'notes.md', content: '# Notes\n\nSome **bold** text.' },
  { id: 'log', name: 'server.log', content: 'line one\nline two' },
  { id: 'report', name: 'report.pdf', type: 'application/pdf', size: 2048 },
]

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]')
const current = () => dialog()?.querySelector<HTMLElement>('[data-current]') ?? null
const stage = () => current()?.parentElement?.parentElement as HTMLElement
const imageFrame = () => current()?.querySelector<HTMLElement>('[data-fp-frame]') ?? null
const percent = () =>
  dialog()?.querySelector('button[aria-label="Actual size"], button[aria-label="Fit to window"]')
    ?.textContent

function Harness(props: {
  readonly items?: readonly FilePreviewItem[]
  readonly start?: number
  readonly onClose?: () => void
  readonly extra?: Partial<React.ComponentProps<typeof FilePreview>>
}) {
  const [index, setIndex] = useState<number | null>(props.start ?? 0)
  return (
    <>
      <button type="button" onClick={() => setIndex(0)}>
        Open
      </button>
      <FilePreview
        open={index !== null}
        items={props.items ?? files}
        index={index ?? 0}
        onIndexChange={setIndex}
        onClose={() => {
          props.onClose?.()
          setIndex(null)
        }}
        {...props.extra}
      />
    </>
  )
}

/** 在舞台上合成一次指针拖动（鼠标），每一步一帧。 */
async function drag(from: { x: number; y: number }, to: { x: number; y: number }, steps = 8) {
  const target = document.elementFromPoint(from.x, from.y) ?? stage()
  const fire = (type: string, x: number, y: number) =>
    target.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 7,
        pointerType: 'mouse',
        button: 0,
        buttons: type === 'pointerup' ? 0 : 1,
        clientX: x,
        clientY: y,
      }),
    )
  fire('pointerdown', from.x, from.y)
  for (let i = 1; i <= steps; i++) {
    fire(
      'pointermove',
      from.x + ((to.x - from.x) * i) / steps,
      from.y + ((to.y - from.y) * i) / steps,
    )
    await frame()
  }
  fire('pointerup', to.x, to.y)
}

const center = (el: Element) => {
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

describe('FilePreview 按类型显示', () => {
  it('图片、JSON（排版）、Markdown（渲染）、日志（换行）、不能预览的文件', async () => {
    await render(<Harness />)
    await expect.poll(() => imageFrame()?.hasAttribute('data-loaded')).toBe(true)
    expect(dialog()?.getAttribute('aria-label')).toBe('File preview')
    await expect.element(page.getByText('1 / 5')).toBeInTheDocument()
    expect(dialog()?.textContent).toContain('12.1 KB')

    await userEvent.keyboard('{ArrowRight}')
    await expect
      .poll(() => current()?.querySelector('pre')?.textContent)
      .toBe('{\n  "a": 1,\n  "list": [\n    1,\n    2\n  ]\n}')
    await userEvent.keyboard('{ArrowRight}')
    await expect.poll(() => current()?.querySelector('h1')?.textContent).toBe('Notes')
    await userEvent.keyboard('{ArrowRight}')
    await expect.poll(() => current()?.querySelector('pre')?.hasAttribute('data-wrap')).toBe(true)
    await userEvent.keyboard('{ArrowRight}')
    await expect.poll(() => current()?.textContent).toContain("This file can't be previewed")
    expect(current()?.textContent).toContain('2.0 KB')
    // 末尾再往后回到第一个
    await userEvent.keyboard('{ArrowRight}')
    await expect
      .poll(() => current()?.querySelector('img[data-full]')?.getAttribute('alt'))
      .toBe('photo.png')
  })

  it('内存中的 File 读成文本；含空字符的「文本」按不能预览处理；超过 256 KB 只显示开头并提示', async () => {
    const big = 'x'.repeat(300 * 1024)
    const items: FilePreviewItem[] = [
      { id: 'f', name: 'todo.txt', file: new File(['buy milk\ncall Alex'], 'todo.txt') },
      { id: 'b', name: 'blob.txt', file: new File(['ab\u0000cd'], 'blob.txt') },
      { id: 'big', name: 'big.log', content: big },
    ]
    await render(<Harness items={items} />)
    await expect
      .poll(() => current()?.querySelector('pre')?.textContent)
      .toBe('buy milk\ncall Alex')
    await userEvent.keyboard('{ArrowRight}')
    await expect.poll(() => current()?.textContent).toContain("This file can't be previewed")
    await userEvent.keyboard('{ArrowRight}')
    await expect.poll(() => current()?.querySelector('pre')?.textContent?.length).toBe(256 * 1024)
    expect(current()?.querySelector('[role="note"]')?.textContent).toBe(
      'Showing the first 256.0 KB of 300.0 KB',
    )
  })

  it('从地址读取文本；读取失败时显示「重试」，重试后重新读取', async () => {
    const original = window.fetch
    let fail = true
    const spy = vi
      .spyOn(window, 'fetch')
      .mockImplementation((input, init) =>
        fail ? Promise.reject(new TypeError('offline')) : original(input, init),
      )
    const items: FilePreviewItem[] = [
      { id: 'r', name: 'readme.txt', src: 'data:text/plain,hello%20there' },
    ]
    await render(<Harness items={items} />)
    await expect.element(page.getByRole('button', { name: 'Retry' })).toBeVisible()
    expect(current()?.textContent).toContain("Couldn't load the file")
    fail = false
    await userEvent.click(page.getByRole('button', { name: 'Retry' }))
    await expect.poll(() => current()?.querySelector('pre')?.textContent).toBe('hello there')
    expect(spy).toHaveBeenCalledTimes(2)
  })
})

describe('FilePreview 的图片缩放', () => {
  it('+ / - / 0 与缩放按钮；双击在适合窗口与实际大小之间切换', async () => {
    await render(<Harness />)
    await expect.poll(() => imageFrame()?.hasAttribute('data-sized')).toBe(true)
    const fitted = Number.parseInt(percent() ?? '', 10)
    expect(fitted).toBeLessThan(100)
    const zoomOut = page.getByRole('button', { name: 'Zoom out' })
    await expect.element(zoomOut).toBeDisabled()
    await userEvent.keyboard('+')
    await expect.poll(() => Number.parseInt(percent() ?? '', 10)).toBeGreaterThan(fitted)
    await expect.element(zoomOut).toBeEnabled()
    expect(imageFrame()?.hasAttribute('data-zoomed')).toBe(true)
    await userEvent.keyboard('0')
    await expect.poll(percent).toBe(`${fitted}%`)
    await userEvent.dblClick(imageFrame() as HTMLElement)
    await expect.poll(percent).toBe('100%')
    await userEvent.dblClick(imageFrame() as HTMLElement)
    await expect.poll(percent).toBe(`${fitted}%`)
    await userEvent.click(page.getByRole('button', { name: 'Zoom in' }))
    await expect.poll(() => Number.parseInt(percent() ?? '', 10)).toBeGreaterThan(fitted)
  })

  it('放大后拖动平移；拖过头时松手回到边界内，图片的边不离开舞台', async () => {
    await render(<Harness />)
    await expect.poll(() => imageFrame()?.hasAttribute('data-sized')).toBe(true)
    await userEvent.keyboard('+')
    await userEvent.keyboard('+')
    await wait(400)
    const from = center(stage())
    await drag(from, { x: from.x + 2000, y: from.y })
    await wait(600)
    const img = (imageFrame() as HTMLElement).getBoundingClientRect()
    const area = stage().getBoundingClientRect()
    expect(img.left).toBeLessThanOrEqual(area.left + 1)
    expect(img.right).toBeGreaterThanOrEqual(area.right - 1)
    expect(img.left, '左边贴住舞台的左边').toBeCloseTo(area.left, 0)
  })
})

describe('FilePreview 的手势', () => {
  it('横向拖动换项；拖得不够远时回到原处', async () => {
    await render(<Harness />)
    await expect.poll(() => imageFrame()?.hasAttribute('data-sized')).toBe(true)
    const c = center(stage())
    await drag(c, { x: c.x - 40, y: c.y })
    await wait(50)
    expect(page.getByText('1 / 5').query()).not.toBeNull()
    await drag(c, { x: c.x - 400, y: c.y })
    await expect.element(page.getByText('2 / 5')).toBeInTheDocument()
    await drag(c, { x: c.x + 400, y: c.y })
    await expect.element(page.getByText('1 / 5')).toBeInTheDocument()
  })

  it('上下拖动关闭，背景随距离变淡；不够远时回到原处', async () => {
    const onClose = vi.fn()
    await render(<Harness onClose={onClose} />)
    await expect.poll(() => imageFrame()?.hasAttribute('data-sized')).toBe(true)
    const c = center(stage())
    const target = document.elementFromPoint(c.x, c.y) as Element
    target.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, pointerId: 3, clientX: c.x, clientY: c.y }),
    )
    target.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        pointerId: 3,
        clientX: c.x,
        clientY: c.y + 60,
      }),
    )
    await frame()
    const backdrop = dialog()?.firstElementChild as HTMLElement
    expect(Number(css(backdrop).opacity), '背景随距离变淡').toBeLessThan(1)
    // 停住一会儿再松手：不算甩动
    await wait(200)
    target.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        pointerId: 3,
        clientX: c.x,
        clientY: c.y + 60,
      }),
    )
    await expect.poll(() => Number(css(backdrop).opacity)).toBe(1)
    expect(onClose).not.toHaveBeenCalled()
    await drag(c, { x: c.x, y: c.y + 200 })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('点击图片以外的空白处关闭；点击图片不关闭', async () => {
    const onClose = vi.fn()
    await render(<Harness onClose={onClose} />)
    await expect.poll(() => imageFrame()?.hasAttribute('data-sized')).toBe(true)
    const c = center(imageFrame() as Element)
    await drag(c, c, 1)
    expect(onClose).not.toHaveBeenCalled()
    const area = stage().getBoundingClientRect()
    const edge = { x: area.left + 4, y: area.top + 4 }
    await drag(edge, edge, 1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

function Gallery() {
  const [index, setIndex] = useState<number | null>(null)
  const items = files.slice(0, 2)
  const photo = items[0] as FilePreviewItem
  return (
    <>
      <button
        type="button"
        data-vl-preview-id={photo.id}
        onClick={() => setIndex(0)}
        style={{
          width: 120,
          height: 120,
          padding: 0,
          border: 0,
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <img src={photo.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </button>
      <FilePreview
        open={index !== null}
        items={items}
        index={index ?? 0}
        onIndexChange={setIndex}
        onClose={() => setIndex(null)}
      />
    </>
  )
}

describe('FilePreview 从缩略图飞入、飞回', () => {
  it('第一帧在缩略图的位置，飞行期间缩略图隐藏；关闭时飞回，卸载后缩略图恢复', async () => {
    root.style.setProperty('--vl-motion-duration-spring', '900ms')
    await render(<Gallery />)
    const thumb = document.querySelector<HTMLElement>('[data-vl-preview-id="photo"]') as HTMLElement
    await expect.poll(() => (thumb.querySelector('img') as HTMLImageElement).complete).toBe(true)
    const t = thumb.getBoundingClientRect()
    thumb.focus()
    thumb.click()
    await frame()
    const first = (imageFrame() as HTMLElement).getBoundingClientRect()
    // 等比放大到盖住缩略图（宽图：高度相同、宽度更大），中心对齐
    expect(first.height).toBeCloseTo(t.height, -1)
    expect(center(imageFrame() as Element).x).toBeCloseTo(t.left + t.width / 2, -1)
    expect(thumb.style.opacity, '飞行期间缩略图隐藏').toBe('0')
    await expect.poll(() => thumb.style.opacity, { timeout: 3000 }).toBe('')
    const opened = (imageFrame() as HTMLElement).getBoundingClientRect()
    expect(opened.width).toBeGreaterThan(t.width * 3)

    await userEvent.keyboard('{Escape}')
    await frame()
    expect(dialog()?.dataset.leaving).toBe('fly')
    expect(thumb.style.opacity).toBe('0')
    await expect.poll(dialog, { timeout: 3000 }).toBeNull()
    expect(thumb.style.opacity).toBe('')
    expect(focused()).toBe(thumb)
  })

  it('当前项不是打开时的那一项、也找不到它的缩略图时淡出', async () => {
    root.style.setProperty('--vl-motion-duration-fast', '900ms')
    await render(<Gallery />)
    ;(document.querySelector('[data-vl-preview-id="photo"]') as HTMLElement).click()
    await expect.poll(dialog).not.toBeNull()
    await userEvent.keyboard('{ArrowRight}')
    await userEvent.keyboard('{Escape}')
    await frame()
    expect(dialog()?.dataset.leaving).toBe('fade')
    await expect.poll(dialog, { timeout: 3000 }).toBeNull()
  })
})

describe('FilePreview 的扩展', () => {
  it('render 自定义显示（返回 undefined 时用内置预览）；actions 与下载按钮；提示显示在预览之内', async () => {
    const onDownload = vi.fn()
    await render(
      <Harness
        start={4}
        extra={{
          onDownload,
          actions: (item) => <button type="button">Share {item.name}</button>,
          render: (item) =>
            item.type === 'application/pdf' ? <p data-testid="pdf">PDF: {item.name}</p> : undefined,
        }}
      />,
    )
    await expect.element(page.getByTestId('pdf')).toHaveTextContent('PDF: report.pdf')
    await expect.element(page.getByRole('button', { name: 'Share report.pdf' })).toBeVisible()
    await userEvent.click(page.getByRole('button', { name: 'Download' }))
    expect(onDownload).toHaveBeenCalledWith(expect.objectContaining({ id: 'report' }))
    await userEvent.keyboard('{ArrowLeft}')
    await expect.poll(() => current()?.querySelector('pre')?.hasAttribute('data-wrap')).toBe(true)
    // 工具栏按钮的提示渲染在预览之内：否则会被预览盖住
    await userEvent.hover(page.getByRole('button', { name: 'Download' }))
    await expect.poll(visibleTooltips, { timeout: 2000 }).toContain('Download')
    const tip = [...document.querySelectorAll('[role="tooltip"]')].find((el) =>
      el.textContent?.includes('Download'),
    )
    expect(dialog()?.contains(tip as Node)).toBe(true)
  })

  it('打开时焦点在「关闭」上，Esc 关闭后焦点回到打开前的元素', async () => {
    await render(<Harness start={-1} />)
    const opener = page.getByRole('button', { name: 'Open' }).element() as HTMLElement
    opener.focus()
    await userEvent.keyboard('{Enter}')
    await expect.poll(dialog).not.toBeNull()
    expect(focused()).toBe(page.getByRole('button', { name: 'Close' }).element())
    await userEvent.keyboard('{Escape}')
    await expect.poll(dialog, { timeout: 3000 }).toBeNull()
    expect(focused()).toBe(opener)
  })

  it('停留不动时工具栏淡出，移动指针后重新出现', async () => {
    // 用鼠标打开：「关闭」上的焦点不显示焦点环（有键盘焦点环时工具栏一直显示）
    await render(<Harness start={-1} />)
    await userEvent.click(page.getByRole('button', { name: 'Open' }))
    await expect.poll(() => imageFrame()?.hasAttribute('data-sized')).toBe(true)
    await expect.poll(() => dialog()?.hasAttribute('data-idle'), { timeout: 4000 }).toBe(true)
    const toolbar = dialog()?.querySelector('[data-fp-chrome]') as HTMLElement
    await expect.poll(() => Number(css(toolbar).opacity), { timeout: 2000 }).toBe(0)
    dialog()?.dispatchEvent(
      new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse' }),
    )
    await expect.poll(() => dialog()?.hasAttribute('data-idle')).toBe(false)
  })
})

function Pane(props: { readonly item: FilePreviewItem | null }) {
  return (
    <div style={{ width: 640, height: 400 }}>
      <FilePreview.Inline item={props.item} />
    </div>
  )
}

describe('FilePreview.Inline', () => {
  it('未选择文件；文本；图片可以 Ctrl + 滚轮缩放，「全屏查看」打开预览并可关闭', async () => {
    const { rerender } = await render(<Pane item={null} />)
    await expect.element(page.getByText('No file selected')).toBeVisible()
    await rerender(<Pane item={files[3] as FilePreviewItem} />)
    await expect.poll(() => document.querySelector('pre')?.textContent).toBe('line one\nline two')
    expect(document.querySelector('section')?.getAttribute('aria-label')).toBe('server.log')

    await rerender(<Pane item={files[0] as FilePreviewItem} />)
    const frameEl = () => document.querySelector<HTMLElement>('section [data-fp-frame]')
    await expect.poll(() => frameEl()?.hasAttribute('data-sized')).toBe(true)
    const before = (frameEl() as HTMLElement).getBoundingClientRect().width
    const c = center(frameEl() as HTMLElement)
    // 不按 Ctrl 的滚轮交给页面（不缩放）
    frameEl()?.dispatchEvent(
      new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        deltaY: -200,
        clientX: c.x,
        clientY: c.y,
      }),
    )
    await settle(300)
    expect((frameEl() as HTMLElement).getBoundingClientRect().width).toBeCloseTo(before, 0)
    frameEl()?.dispatchEvent(
      new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        ctrlKey: true,
        deltaY: -40,
        clientX: c.x,
        clientY: c.y,
      }),
    )
    await expect
      .poll(() => (frameEl() as HTMLElement).getBoundingClientRect().width, { timeout: 2000 })
      .toBeGreaterThan(before * 1.2)

    await userEvent.click(page.getByRole('button', { name: 'Full screen' }))
    await expect.poll(dialog).not.toBeNull()
    expect(dialog()?.textContent).toContain('photo.png')
    await userEvent.keyboard('{Escape}')
    await expect.poll(dialog, { timeout: 3000 }).toBeNull()
  })
})
