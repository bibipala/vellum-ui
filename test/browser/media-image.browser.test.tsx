/**
 * 图片在真实浏览器中的表现（docs/11 §6.2、§7「缩略图出现：先占位再淡入」；ADR 0020「影响」中的安全要求）：
 * Image：加载中显示中性占位、加载完成后淡入；加载失败显示兜底内容且不能预览；可以预览时是按钮（Tab、焦点环、Enter / 空格），
 * 预览（FilePreview）从图片中长出、在中性看图背景上打开、焦点限制在预览内、Esc 关闭后焦点回到图片；src 原样交给 <img>。
 * Progress 的测试在 progress.browser.test.tsx。
 */
import { describe, expect, it, vi } from 'vitest'
import { Image } from '../../src/index.ts'
import {
  css,
  expectFocusRing,
  focused,
  ms,
  page,
  render,
  sameColor,
  token,
  userEvent,
} from './render.tsx'

/** 纯色的 SVG 图片（不访问网络）。 */
const svg = (hue: number) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><rect width="40" height="30" fill="hsl(${hue} 60% 55%)"/></svg>`,
  )}`

/** 无法解码的图片：不发网络请求就失败。 */
const BROKEN = 'data:image/png;base64,AAAA'

const root = () => document.querySelector<HTMLElement>('[data-status]') as HTMLElement
const img = () => root().querySelector('img') as HTMLImageElement

describe('Image', () => {
  it('加载中：中性占位覆盖图片区域、图片透明；加载完成后占位移除，图片按动效令牌淡入', async () => {
    // 远在视口之外的懒加载图片保持「加载中」，滚动到它才开始加载：加载的时机由测试控制
    await render(
      <div style={{ paddingTop: 6000 }}>
        <Image src={svg(200)} alt="Lazy photo" width={120} height={90} loading="lazy" />
      </div>,
    )
    expect(root().dataset.status).toBe('loading')
    const placeholder = root().querySelector(':scope > [aria-hidden="true"]') as HTMLElement
    expect(placeholder).not.toBeNull()
    expect(sameColor(css(placeholder).backgroundColor, token('color-fill'))).toBe(true)
    expect(placeholder.getBoundingClientRect().width).toBe(120)
    expect(css(img()).opacity).toBe('0')
    expect(ms(css(img()).transitionDuration)).toBe(ms(token('motion-duration-base')))

    img().scrollIntoView()
    await expect.poll(() => root().dataset.status).toBe('loaded')
    expect(root().querySelector(':scope > [aria-hidden="true"]')).toBeNull()
    await expect.poll(() => css(img()).opacity).toBe('1')
  })

  it('加载失败：显示图标与「加载失败」，读屏名称为替代文字，不能预览；换成可用的地址后恢复', async () => {
    const { rerender } = await render(<Image src={BROKEN} alt="Cover" width={160} height={120} />)
    await expect.poll(() => root().dataset.status).toBe('error')
    const fallback = page.getByRole('img', { name: 'Cover' }).element()
    expect(fallback.textContent).toBe('Failed to load')
    expect(fallback.querySelector('svg.lucide-image')).not.toBeNull()
    expect(fallback.getBoundingClientRect().width).toBe(160)
    expect(document.querySelector('[role="button"]')).toBeNull()

    await rerender(<Image src={svg(120)} alt="Cover" width={160} height={120} />)
    await expect.poll(() => root().dataset.status).toBe('loaded')
    expect(page.getByRole('button', { name: 'Cover' }).element()).toBeDefined()
  })

  it('失败兜底的文字跟随语言', async () => {
    await render(<Image src={BROKEN} alt="Cover" />, { locale: 'zh-CN' })
    await expect.poll(() => root().dataset.status).toBe('error')
    expect(page.getByRole('img', { name: 'Cover' }).element().textContent).toBe('加载失败')
  })

  it('src 原样交给 <img>，不拼接、不改写', async () => {
    const src = `${svg(30)}#frame=2`
    await render(<Image src={src} alt="Photo" />)
    expect(img().getAttribute('src')).toBe(src)
  })

  it('预览：图片是按钮，Tab 聚焦显示焦点环；Enter 在中性看图背景上打开，焦点限制在预览内；Esc 关闭后焦点回到图片', async () => {
    await render(<Image src={svg(40)} alt="Poster" width={120} height={90} />, {
      defaultViewerStage: 'black',
    })
    await expect.poll(() => root().dataset.status).toBe('loaded')
    await userEvent.tab()
    const trigger = page.getByRole('button', { name: 'Poster' }).element()
    expect(focused()).toBe(trigger)
    expectFocusRing(trigger, 2)

    await userEvent.keyboard('{Enter}')
    const dialog = () => document.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]')
    await expect.poll(() => dialog() !== null && dialog()?.contains(focused())).toBe(true)
    expect(dialog()?.getAttribute('aria-label')).toBe('Image viewer')
    // 预览中的大图就是这张图片，替代文字相同
    expect(dialog()?.querySelector('[data-current] img[data-full]')?.getAttribute('alt')).toBe(
      'Poster',
    )
    const backdrop = dialog()?.firstElementChild as Element
    expect(sameColor(css(backdrop).backgroundColor, token('viewer-bg-black'))).toBe(true)
    for (let i = 0; i < 4; i++) {
      await userEvent.tab()
      expect(dialog()?.contains(focused())).toBe(true)
    }

    await userEvent.keyboard('{Escape}')
    await expect.poll(focused).toBe(trigger)
    await expect.poll(dialog, { timeout: 3000 }).toBeNull()
    await userEvent.keyboard(' ')
    await expect.poll(() => dialog()?.contains(focused())).toBe(true)
    await userEvent.keyboard('{Escape}')
    await expect.poll(focused).toBe(trigger)
  })

  it('预览背景默认是看图背景的深灰档位（不随主题变化）', async () => {
    await render(<Image src={svg(80)} alt="Poster" width={80} height={60} />, {
      defaultColorMode: 'dark',
    })
    await expect.poll(() => root().dataset.status).toBe('loaded')
    await userEvent.click(page.getByRole('button', { name: 'Poster' }))
    const dialog = () => document.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]')
    await expect.poll(dialog).not.toBeNull()
    const backdrop = dialog()?.firstElementChild as Element
    expect(sameColor(css(backdrop).backgroundColor, token('viewer-bg-dark'))).toBe(true)
  })

  it('预览从图片中长出：第一帧在图片的位置，图片在飞行期间隐藏；preview.src 指定预览中的大图；受控打开', async () => {
    document.documentElement.style.setProperty('--vl-motion-duration-spring', '900ms')
    try {
      const big = svg(300)
      const onOpenChange = vi.fn()
      const { rerender } = await render(
        <Image
          src={svg(40)}
          alt="Poster"
          width={120}
          height={90}
          preview={{ src: big, onOpenChange }}
        />,
      )
      await expect.poll(() => root().dataset.status).toBe('loaded')
      const trigger = page.getByRole('button', { name: 'Poster' }).element() as HTMLElement
      const box = trigger.getBoundingClientRect()
      trigger.focus()
      trigger.click()
      await new Promise(requestAnimationFrame)
      const frame = document.querySelector('[data-current] [data-fp-frame]') as HTMLElement
      const first = frame.getBoundingClientRect()
      expect(Math.abs(first.left + first.width / 2 - (box.left + box.width / 2))).toBeLessThan(8)
      expect(first.width).toBeLessThan(box.width * 1.6)
      expect(trigger.style.opacity).toBe('0')
      expect(frame.querySelector('img[data-full]')?.getAttribute('src')).toBe(big)
      expect(onOpenChange).toHaveBeenLastCalledWith(true)

      // 受控：open={false} 时关闭
      await rerender(
        <Image
          src={svg(40)}
          alt="Poster"
          width={120}
          height={90}
          preview={{ src: big, open: false, onOpenChange }}
        />,
      )
      await expect
        .poll(() => document.querySelector('[role="dialog"]'), { timeout: 3000 })
        .toBeNull()
      expect(trigger.style.opacity).toBe('')
    } finally {
      document.documentElement.style.removeProperty('--vl-motion-duration-spring')
    }
  })

  it('preview={false} 时不是按钮、不可聚焦', async () => {
    await render(<Image src={svg(10)} alt="Logo" preview={false} />)
    await expect.poll(() => root().dataset.status).toBe('loaded')
    expect(document.querySelector('[role="button"]')).toBeNull()
    await userEvent.tab()
    expect(root().contains(focused())).toBe(false)
  })
})
