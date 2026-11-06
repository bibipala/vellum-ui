/**
 * 图片与进度条在真实浏览器中的表现（docs/11 §6.2、§7「缩略图出现：先占位再淡入」；ADR 0020「影响」中的安全要求）：
 * Image：加载中显示中性占位、加载完成后淡入；加载失败显示兜底内容且不能预览；可以预览时是按钮（Tab、焦点环、Enter / 空格），
 * 预览在中性看图背景上打开、焦点限制在预览内、Esc 关闭后焦点回到图片；src 原样交给 <img>。
 * Progress：读屏取值、强调色、等宽数字、完成与失败的 Lucide 图标。
 */
import { describe, expect, it } from 'vitest'
import { Image, Progress } from '../../src/index.ts'
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
    const dialog = () => document.querySelector<HTMLElement>('.ant-image-preview[role="dialog"]')
    await expect.poll(() => dialog() !== null && dialog()?.contains(focused())).toBe(true)
    const mask = dialog()?.querySelector('.ant-image-preview-mask') as Element
    expect(sameColor(css(mask).backgroundColor, token('viewer-bg-black'))).toBe(true)
    for (let i = 0; i < 4; i++) {
      await userEvent.tab()
      expect(dialog()?.contains(focused())).toBe(true)
    }

    await userEvent.keyboard('{Escape}')
    await expect.poll(focused).toBe(trigger)
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
    await expect.poll(() => document.querySelector('.ant-image-preview-mask')).not.toBeNull()
    const mask = document.querySelector('.ant-image-preview-mask') as Element
    expect(sameColor(css(mask).backgroundColor, token('viewer-bg-dark'))).toBe(true)
  })

  it('preview={false} 时不是按钮、不可聚焦', async () => {
    await render(<Image src={svg(10)} alt="Logo" preview={false} />)
    await expect.poll(() => root().dataset.status).toBe('loaded')
    expect(document.querySelector('[role="button"]')).toBeNull()
    await userEvent.tab()
    expect(root().contains(focused())).toBe(false)
  })
})

describe('Progress', () => {
  it('读屏取值；进行中为强调色，轨道为中性填充；数字为等宽数字', async () => {
    await render(<Progress percent={45} aria-label="Import" />)
    const bar = page.getByRole('progressbar', { name: 'Import' }).element()
    expect(bar.getAttribute('aria-valuenow')).toBe('45')
    expect(css(bar).fontVariantNumeric).toBe('tabular-nums')
    expect(bar.textContent).toBe('45%')
    const fill = bar.querySelector('.ant-progress-track') as Element
    expect(sameColor(css(fill).backgroundColor, token('color-accent'))).toBe(true)
    const rail = bar.querySelector('.ant-progress-rail') as Element
    expect(sameColor(css(rail).backgroundColor, token('color-fill-strong'))).toBe(true)
  })

  it('环形中间显示数字；100% 时为完成并显示 Lucide 的勾；失败显示叉', async () => {
    await render(
      <>
        <Progress type="circle" percent={72} aria-label="Storage" />
        <Progress type="circle" percent={100} aria-label="Done" />
        <Progress percent={30} status="exception" aria-label="Failed" />
      </>,
    )
    expect(page.getByRole('progressbar', { name: 'Storage' }).element().textContent).toBe('72%')
    const done = page.getByRole('progressbar', { name: 'Done' }).element()
    expect(done.className).toContain('ant-progress-status-success')
    expect(done.querySelector('svg.lucide-check')).not.toBeNull()
    const failed = page.getByRole('progressbar', { name: 'Failed' }).element()
    expect(failed.querySelector('svg.lucide-x')).not.toBeNull()
    expect(failed.querySelector('.anticon')).toBeNull()
  })
})
