/**
 * 主题在真实浏览器中的运行时切换（ThemeProvider）：明暗、密度、「减少动态效果」切换后无需刷新即生效，
 * 组件的实际样式随之变化。另含 CodeBlock：内容超出时可以用键盘聚焦并滚动。
 */
import { describe, expect, it } from 'vitest'
import { Button, CodeBlock, type MessageApi, useMessage, useTheme } from '../../src/index.ts'
import { css, ms, page, render, settle, token, userEvent } from './render.tsx'

let theme: ReturnType<typeof useTheme>
let api: MessageApi
function Probe() {
  theme = useTheme()
  api = useMessage()
  return <Button>Save</Button>
}

describe('ThemeProvider 运行时切换', () => {
  it('明暗：切换后根元素标记、令牌与 antd 组件的颜色立即变化', async () => {
    await render(<Probe />)
    const btn = page.getByRole('button', { name: 'Save' }).element()
    const lightCanvas = token('color-bg-canvas')
    const lightText = css(btn).color
    expect(document.documentElement.dataset.vlMode).toBe('light')
    theme.setColorMode('dark')
    await expect.poll(() => document.documentElement.dataset.vlMode).toBe('dark')
    expect(token('color-bg-canvas')).not.toBe(lightCanvas)
    await expect.poll(() => css(btn).color).not.toBe(lightText)
  })

  it('密度：紧凑时控件高度 30px，舒适时 36px', async () => {
    await render(<Probe />)
    const btn = page.getByRole('button', { name: 'Save' }).element()
    expect(btn.getBoundingClientRect().height).toBe(36)
    theme.setDensity('compact')
    await expect.poll(() => btn.getBoundingClientRect().height).toBe(30)
    expect(document.documentElement.dataset.vlDensity).toBe('compact')
  })

  it('减少动态效果：动效时长令牌为 0，消息条只淡入淡出（不位移）', async () => {
    await render(<Probe />, { reducedMotion: true })
    expect(document.documentElement.dataset.vlReducedMotion).toBe('true')
    expect(ms(token('motion-duration-fast'))).toBe(0)
    api.info('Synced')
    await settle()
    const msg = document.querySelector('[data-kind]') as HTMLElement
    expect(css(msg).animationName).toMatch(/message-fade-in/)
  })
})

describe('CodeBlock', () => {
  it('内容超出时在块内滚动，可以用 Tab 聚焦并用方向键滚动', async () => {
    const code = Array.from({ length: 80 }, (_, i) => `line ${i + 1}: {"id": ${i}}`).join('\n')
    await render(<CodeBlock code={code} maxHeight="sm" testId="code" />)
    const pre = page.getByTestId('code').element() as HTMLElement
    expect(pre.scrollHeight).toBeGreaterThan(pre.clientHeight)
    expect(css(pre).overflowY).toMatch(/auto|scroll/)
    await userEvent.tab()
    expect(document.activeElement).toBe(pre)
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}')
    await expect.poll(() => pre.scrollTop).toBeGreaterThan(0)
  })
})
