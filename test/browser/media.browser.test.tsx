/**
 * 看图与长列表组件在真实浏览器中的交互（docs/11 §6.2、§7「长列表全部虚拟化」）：
 * ImageGrid 的键盘焦点（向内的焦点环）、回车 / 空格打开、悬停上浮、选中环、虚拟化；
 * Lightbox 的初始焦点、← / → 切换、Esc 关闭、Tab 在内部循环、关闭后焦点回到打开前的元素；
 * VirtualList 的 DOM 节点数不随数据量增长、滚动到底部。
 */
import { useRef, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import {
  ImageGrid,
  type ImageGridItem,
  Lightbox,
  VirtualList,
  type VirtualListHandle,
} from '../../src/index.ts'
import {
  css,
  expectFocusRing,
  expectNoFocusRing,
  focused,
  frames,
  page,
  pseudo,
  render,
  settle,
  token,
  userEvent,
} from './render.tsx'

/** 纯色的 SVG 缩略图（不访问网络）。 */
const swatch = (hue: number) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="hsl(${hue} 60% 55%)"/></svg>`,
  )}`

const images = (n: number): ImageGridItem[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `img-${i}`,
    src: swatch((i * 37) % 360),
    alt: `Photo ${i + 1}`,
    caption: `photo-${i + 1}.jpg`,
  }))

/** 给 ImageGrid / VirtualList 一个确定的高度（它们占满父元素）。 */
function Frame(props: {
  readonly children: React.ReactNode
  readonly height?: number
  readonly width?: number
}) {
  return (
    <div style={{ height: props.height ?? 480, width: props.width ?? 900 }}>{props.children}</div>
  )
}

const tiles = () => [...document.querySelectorAll<HTMLButtonElement>('section button[aria-label]')]
/** 格子的序号（「Photo 12」为 12）。 */
const photoNumber = (tile: Element) => Number(tile.getAttribute('aria-label')?.split(' ')[1])
/** 网格当前的列数（每一行的 grid-template-columns 相同）。 */
const gridColumns = () => {
  const row = document.querySelector<HTMLElement>('section [data-index]')
  return Number(/repeat\((\d+)/.exec(row?.style.gridTemplateColumns ?? '')?.[1])
}

describe('ImageGrid', () => {
  it('格子是按钮：Tab 聚焦时焦点环向内收 2px，鼠标点击不显示；Enter / 空格打开', async () => {
    const onOpen = vi.fn()
    await render(
      <Frame>
        <ImageGrid items={images(12)} onOpen={(i) => onOpen(i)} />
      </Frame>,
    )
    await expect.poll(() => tiles().length).toBeGreaterThan(0)
    await userEvent.tab()
    const first = page.getByRole('button', { name: 'Photo 1', exact: true }).element()
    expect(focused()).toBe(first)
    expectFocusRing(first, -2)
    await userEvent.keyboard('{Enter}')
    expect(onOpen).toHaveBeenLastCalledWith(0)
    await userEvent.tab()
    expect(focused()).toBe(page.getByRole('button', { name: 'Photo 2', exact: true }).element())
    await userEvent.keyboard(' ')
    expect(onOpen).toHaveBeenLastCalledWith(1)
    const third = page.getByRole('button', { name: 'Photo 3', exact: true })
    await userEvent.click(third)
    expect(onOpen).toHaveBeenLastCalledWith(2)
    expectNoFocusRing(third.element())
  })

  it('悬停时图片格子轻微上浮（不叠加状态层），按下不缩放；选中的格子有强调色选中环', async () => {
    await render(
      <Frame>
        <ImageGrid items={images(6)} selectedIds={new Set(['img-1'])} onOpen={() => {}} />
      </Frame>,
    )
    await expect.poll(() => tiles().length).toBe(6)
    const tile = page.getByRole('button', { name: 'Photo 1', exact: true }).element()
    expect(tile.hasAttribute('data-vl-state')).toBe(false)
    await userEvent.hover(tile)
    await expect.poll(() => new DOMMatrix(css(tile).transform).m42).toBe(-2)
    const selected = page.getByRole('button', { name: 'Photo 2', exact: true, pressed: true })
    await expect.element(selected).toBeInTheDocument()
    // 选中环画在格子内侧，贴边的格子不会被滚动容器裁掉
    expect(getComputedStyle(selected.element(), '::after').boxShadow).toMatch(
      /0px 0px 0px 2px inset/,
    )
    // 有选择时，未选中的格子也是开关按钮（aria-pressed="false"）
    await expect
      .element(page.getByRole('button', { name: 'Photo 1', exact: true, pressed: false }))
      .toBeInTheDocument()
  })

  it('没有缩略图的格子显示 fallback，悬停叠加统一状态层、不上浮', async () => {
    await render(
      <Frame>
        <ImageGrid
          items={[{ id: 'doc', src: '', alt: 'Report.pdf', fallback: 'PDF' }]}
          onOpen={() => {}}
        />
      </Frame>,
    )
    const tile = await vi.waitUntil(() =>
      document.querySelector<HTMLElement>('button[aria-label="Report.pdf"]'),
    )
    expect(tile.dataset.vlState).toBe('')
    await userEvent.hover(tile)
    await expect
      .poll(() => Number(pseudo(tile, '::before').opacity))
      .toBeCloseTo(Number(token('state-hover-opacity')), 3)
    expect(css(tile).transform).toBe('none')
  })

  it('同一图片加载失败后换成有效地址，重新加载图片并保留格子的键盘焦点', async () => {
    const view = (src: string) => (
      <Frame>
        <ImageGrid items={[{ id: 'photo', src, alt: 'Photo', fallback: 'Failed image' }]} />
      </Frame>
    )
    const { rerender } = await render(view('data:image/invalid,broken'))
    await expect.element(page.getByText('Failed image')).toBeVisible()
    const tile = page.getByRole('button', { name: 'Photo', exact: true }).element()
    tile.focus()
    await rerender(view(swatch(120)))
    await expect
      .poll(() => {
        const img = tile.querySelector('img')
        return Boolean(img?.complete && img.naturalWidth > 0)
      })
      .toBe(true)
    expect(tile.textContent).not.toContain('Failed image')
    expect(focused()).toBe(tile)
  })

  it('虚拟化：一万张图片与一百张图片渲染的格子数相同量级，滚动后渲染的是新的一段', async () => {
    const { rerender } = await render(
      <Frame>
        <ImageGrid items={images(100)} />
      </Frame>,
    )
    await expect.poll(() => tiles().length).toBeGreaterThan(0)
    const small = tiles().length
    await rerender(
      <Frame>
        <ImageGrid items={images(10_000)} />
      </Frame>,
    )
    await settle()
    const large = tiles().length
    expect(large).toBeLessThan(200)
    expect(large).toBeLessThanOrEqual(small + 20)
    const scroller = document.querySelector('section') as HTMLElement
    scroller.scrollTop = scroller.scrollHeight / 2
    await expect
      .poll(() => tiles().some((t) => Number(t.getAttribute('aria-label')?.split(' ')[1]) > 4000))
      .toBe(true)
    expect(tiles().length).toBeLessThan(200)
    expect(tiles().some((t) => t.getAttribute('aria-label') === 'Photo 1')).toBe(false)
  })

  it('滚动引起的渲染不遍历全部条目（查找有没有说明文字只在数据变化时做一次）', async () => {
    let reads = 0
    // 没有说明文字的一万张图片：读取 caption 时计数
    const items: ImageGridItem[] = Array.from({ length: 10_000 }, (_, i) => ({
      id: `img-${i}`,
      src: swatch((i * 37) % 360),
      alt: `Photo ${i + 1}`,
      get caption(): string | undefined {
        reads++
        return undefined
      },
    }))
    await render(
      <Frame>
        <ImageGrid items={items} />
      </Frame>,
    )
    await expect.poll(() => tiles().length).toBeGreaterThan(0)
    await frames(4)
    reads = 0
    const scroller = document.querySelector('section') as HTMLElement
    scroller.scrollTop = 3000
    await expect.poll(() => tiles().some((t) => photoNumber(t) > 60)).toBe(true)
    await frames(4)
    // 只有渲染出来的格子读取自己的说明文字（改动之前，每次渲染都要把一万项各读一遍）
    expect(reads).toBeLessThan(2000)
  })

  it('焦点所在的格子滚出可见区域后仍然挂载，焦点不丢；焦点离开网格后不再保留', async () => {
    await render(
      <Frame>
        <ImageGrid items={images(10_000)} onOpen={() => {}} />
      </Frame>,
    )
    await expect.poll(() => tiles().length).toBeGreaterThan(0)
    const tile = page.getByRole('button', { name: 'Photo 2', exact: true }).element() as HTMLElement
    tile.focus()
    // 滚到很远的地方：第一行早已离开可见区域与预渲染范围
    const scroller = document.querySelector('section') as HTMLElement
    scroller.scrollTop = scroller.scrollHeight / 2
    await expect.poll(() => tiles().some((t) => photoNumber(t) > 4000)).toBe(true)
    await frames(4)
    expect(tile.isConnected).toBe(true)
    expect(focused()).toBe(tile)
    tile.blur()
    await expect.poll(() => tile.isConnected).toBe(false)
  })

  it('列数变化时焦点留在同一项上：它换到新的一行，滚出可见区域时也按新的一行保留', async () => {
    const view = (width: number) => (
      <Frame width={width}>
        <ImageGrid items={images(10_000)} onOpen={() => {}} />
      </Frame>
    )
    const { rerender } = await render(view(900))
    await expect.poll(() => tiles().length).toBeGreaterThan(0)
    const before = gridColumns()
    expect(before).toBeGreaterThan(2)
    // 第 6 项（下标 5）：列数变少后换到下面的一行，格子在另一行中重新挂载
    page.getByRole('button', { name: 'Photo 6', exact: true }).element().focus()
    const scroller = document.querySelector('section') as HTMLElement
    scroller.scrollTop = scroller.scrollHeight / 2
    await expect.poll(() => tiles().some((t) => photoNumber(t) > 4000)).toBe(true)
    await rerender(view(500))
    await expect.poll(gridColumns).toBeLessThan(before)
    await frames(4)
    const now = focused() as HTMLElement
    expect(now.getAttribute('aria-label')).toBe('Photo 6')
    expect(now.isConnected).toBe(true)
    const row = now.closest('[data-index]')
    expect(Number(row?.getAttribute('data-index'))).toBe(Math.floor(5 / gridColumns()))
    // 回到顶部：这一格在它的新位置上，焦点仍然在它上面
    scroller.scrollTop = 0
    await expect.poll(() => tiles().some((t) => photoNumber(t) === 1)).toBe(true)
    await frames(4)
    expect(focused()).toBe(now)
    const visible = tiles().filter((t) => photoNumber(t) <= gridColumns() * 3)
    expect(visible.map(photoNumber)).toContain(6)
  })
})

const shots = [
  { id: 'a', src: swatch(10), alt: 'Harbour at dawn' },
  { id: 'b', src: swatch(120), alt: 'Forest trail' },
  { id: 'c', src: swatch(220), alt: 'City at night' },
]

function Viewer() {
  const [index, setIndex] = useState<number | null>(null)
  return (
    <>
      <button type="button" onClick={() => setIndex(1)}>
        Open photo
      </button>
      <Lightbox
        open={index !== null}
        items={shots}
        index={index ?? 0}
        onIndexChange={setIndex}
        onClose={() => setIndex(null)}
      />
    </>
  )
}

const dialog = () => document.querySelector('[role="dialog"][aria-modal="true"]')
// 轨道上并排放着前后各一项：看的是当前项的大图
const shown = () =>
  (dialog()?.querySelector('[data-current] img[data-full]') as HTMLImageElement | null)?.alt

describe('Lightbox', () => {
  it('打开时焦点在「关闭」上；← / → 切换（首尾循环）；Esc 关闭，焦点回到打开前的元素', async () => {
    await render(<Viewer />)
    await userEvent.tab()
    const opener = page.getByRole('button', { name: 'Open photo' }).element()
    await userEvent.keyboard('{Enter}')
    await expect.poll(dialog).not.toBeNull()
    expect(focused()).toBe(page.getByRole('button', { name: 'Close' }).element())
    expect(shown()).toBe('Forest trail')
    await userEvent.keyboard('{ArrowRight}')
    expect(shown()).toBe('City at night')
    await userEvent.keyboard('{ArrowRight}')
    expect(shown()).toBe('Harbour at dawn')
    await userEvent.keyboard('{ArrowLeft}')
    expect(shown()).toBe('City at night')
    await expect.element(page.getByText('3 / 3')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await expect.poll(dialog).toBeNull()
    expect(focused()).toBe(opener)
  })

  it('Tab / Shift+Tab 只在看图界面内循环；Enter 连续换图时焦点留在上一张、下一张按钮上', async () => {
    await render(<Viewer />)
    await userEvent.click(page.getByRole('button', { name: 'Open photo' }))
    await expect.poll(dialog).not.toBeNull()
    for (let i = 0; i < 8; i++) {
      await userEvent.tab()
      expect(dialog()?.contains(focused()), `第 ${i + 1} 次 Tab`).toBe(true)
    }
    for (let i = 0; i < 8; i++) {
      await userEvent.tab({ shift: true })
      expect(dialog()?.contains(focused()), `第 ${i + 1} 次 Shift+Tab`).toBe(true)
    }
    const next = page.getByRole('button', { name: 'Next' }).element()
    next.focus()
    await userEvent.keyboard('{Enter}')
    expect(shown()).toBe('City at night')
    expect(focused()).toBe(next)
    await userEvent.keyboard('{Enter}')
    expect(shown()).toBe('Harbour at dawn')
    expect(focused()).toBe(next)
    const previous = page.getByRole('button', { name: 'Previous' }).element()
    previous.focus()
    await userEvent.keyboard('{Enter}')
    expect(shown()).toBe('City at night')
    expect(focused()).toBe(previous)
    await userEvent.keyboard('{Enter}')
    expect(shown()).toBe('Forest trail')
    expect(focused()).toBe(previous)
  })

  it('背景档位按钮以 aria-pressed 表示当前档位，可用键盘切换', async () => {
    await render(<Viewer />)
    await userEvent.click(page.getByRole('button', { name: 'Open photo' }))
    await expect.poll(dialog).not.toBeNull()
    await expect
      .element(page.getByRole('button', { name: 'Dark gray', pressed: true }))
      .toBeVisible()
    page.getByRole('button', { name: 'Black' }).element().focus()
    await userEvent.keyboard('{Enter}')
    await expect.element(page.getByRole('button', { name: 'Black', pressed: true })).toBeVisible()
    expect(dialog()?.getAttribute('data-vl-viewer-stage')).toBe('black')
  })

  it('固定背景不显示切换按钮；移除固定背景后仍使用原来的全局档位', async () => {
    const view = (stage?: 'dark') => (
      <Lightbox open items={shots} index={0} onClose={() => {}} stage={stage} />
    )
    const { rerender } = await render(view('dark'), { defaultViewerStage: 'black' })
    expect(dialog()?.getAttribute('data-vl-viewer-stage')).toBe('dark')
    expect(dialog()?.querySelector('fieldset')).toBeNull()
    await rerender(view())
    expect(dialog()?.getAttribute('data-vl-viewer-stage')).toBe('black')
    await expect.element(page.getByRole('button', { name: 'Black', pressed: true })).toBeVisible()
  })
})

interface ListRow {
  readonly id: string
  readonly text: string
}
const rows = (n: number): ListRow[] =>
  Array.from({ length: n }, (_, i) => ({ id: `m-${i}`, text: `Row ${i}` }))
const rendered = () => document.querySelectorAll('[data-row]').length
const rowElement = (text: string) =>
  [...document.querySelectorAll('[data-row]')].find((r) => r.textContent === text) ?? null

function List(props: { readonly count: number; readonly onReachEnd?: () => void }) {
  const ref = useRef<VirtualListHandle>(null)
  const [items] = useState(() => rows(props.count))
  return (
    <>
      <button type="button" onClick={() => ref.current?.scrollToEnd()}>
        Jump to end
      </button>
      {/* VirtualList 的高度由父元素决定：父元素必须有确定的高度 */}
      <Frame height={400}>
        <VirtualList
          ref={ref}
          aria-label="Messages"
          items={items}
          getKey={(r) => r.id}
          estimateSize={40}
          onReachEnd={props.onReachEnd}
          renderItem={(r) => (
            <div data-row style={{ height: 40 }}>
              {r.text}
            </div>
          )}
        />
      </Frame>
    </>
  )
}

/** 数取键次数的列表：getKey 是内联函数（使用方的常见写法），使用方每次渲染都是新的函数。 */
function CountedList(props: { readonly items: readonly ListRow[]; readonly calls: { n: number } }) {
  return (
    <Frame height={400}>
      <VirtualList
        aria-label="Messages"
        items={props.items}
        getKey={(r) => {
          props.calls.n++
          return r.id
        }}
        estimateSize={40}
        renderItem={(r) => (
          <div data-row style={{ height: 40 }}>
            {r.text}
          </div>
        )}
      />
    </Frame>
  )
}

describe('VirtualList', () => {
  it('DOM 节点数不随数据量增长：一百行与十万行渲染的行数相同', async () => {
    const small = await render(<List count={100} />)
    await expect.poll(rendered).toBeGreaterThan(0)
    const few = rendered()
    await small.unmount()
    await render(<List count={100_000} />)
    await expect.poll(rendered).toBeGreaterThan(0)
    expect(rendered()).toBe(few)
    // 400px 高、每行 40px：可见 10 行，加上两端各 6 行预渲染
    expect(rendered()).toBeLessThanOrEqual(10 + 2 * 6 + 1)
  })

  it('scrollToEnd 滚动到最后一行，到底部时调用 onReachEnd', async () => {
    const onReachEnd = vi.fn()
    await render(<List count={5000} onReachEnd={onReachEnd} />)
    await userEvent.click(page.getByRole('button', { name: 'Jump to end' }))
    await expect.element(page.getByText('Row 4999', { exact: true })).toBeInTheDocument()
    await expect.poll(() => onReachEnd.mock.calls.length).toBeGreaterThan(0)
    expect(rendered()).toBeLessThan(40)
  })

  it('滚动与使用方重新渲染时不为全部行重新取键；在前面插入、重新排序时按新的键渲染', async () => {
    const calls = { n: 0 }
    const items = rows(1000)
    const { rerender } = await render(<CountedList items={items} calls={calls} />)
    await expect.poll(rendered).toBeGreaterThan(0)
    await frames(4)
    const scroller = document.querySelector('section[aria-label="Messages"]') as HTMLElement
    calls.n = 0
    scroller.scrollTop = 500
    await expect.poll(() => rowElement('Row 25')).not.toBeNull()
    await frames(4)
    // 只为新进入的行取键（改动之前，一次 500px 的滚动要为全部行取键，约 1,020 次）
    expect(calls.n).toBeLessThan(100)
    calls.n = 0
    await rerender(<CountedList items={items} calls={calls} />)
    await frames(4)
    expect(calls.n).toBeLessThan(100)
    // 在前面插入：已有的行按键保留，同一个元素仍然显示同一行
    const kept = rowElement('Row 12') as HTMLElement
    const earlier = Array.from({ length: 5 }, (_, i) => ({ id: `p-${i}`, text: `Earlier ${i}` }))
    const prepended = [...earlier, ...items]
    await rerender(<CountedList items={prepended} calls={calls} />)
    await frames(4)
    expect(kept.isConnected).toBe(true)
    expect(kept.textContent).toBe('Row 12')
    // 重新排序：第 12 行移到了远处，它的元素卸载，原位置显示新的行
    await rerender(<CountedList items={[...prepended].reverse()} calls={calls} />)
    await frames(4)
    expect(kept.isConnected).toBe(false)
    expect(rowElement('Row 987')).not.toBeNull()
  })
})
