/**
 * StreamingText 在真实浏览器中的行为：
 * - 挂载时已有的文字立即显示；之后到达的文字逐字放出（不是整块出现），保留换行；
 * - 流结束（streaming 变为 false）时剩下的文字立即全部显示，光标消失，aria-busy 去掉；
 * - 文字被整段替换时立即显示新的全文；
 * - 减少动态效果（ThemeProvider 的 reducedMotion）时不逐字放出。
 */
import { describe, expect, it } from 'vitest'
import { StreamingText } from '../../src/index.ts'
import { nextFrame, page, render } from './render.tsx'

const text = () => page.getByTestId('st').element().firstChild?.textContent ?? ''
const cursor = () => page.getByTestId('st').element().querySelector('[data-stream-cursor]')

describe('StreamingText', () => {
  it('新到的文字逐字放出，文字不断变长；保留换行；流结束立即放完、光标消失', async () => {
    const first = 'Hello.'
    const more = `${first}\nThe quick brown fox jumps over the lazy dog, again and again and again.`
    const view = await render(<StreamingText testId="st" text={first} streaming />)
    // 挂载时已有的文字立即显示
    expect(text()).toBe(first)
    expect(cursor()).not.toBeNull()
    const el = page.getByTestId('st').element()
    expect(el.getAttribute('aria-busy')).toBe('true')
    expect(getComputedStyle(el).whiteSpace).toBe('pre-wrap')

    await view.rerender(<StreamingText testId="st" text={more} streaming />)
    await nextFrame()
    const lengths: number[] = [text().length]
    // 多看几帧：长度单调增加，并且不是一下子出现
    for (let i = 0; i < 6; i++) {
      await nextFrame()
      lengths.push(text().length)
    }
    expect(lengths[0]).toBeLessThan(more.length)
    expect(lengths.every((n, i) => i === 0 || n >= (lengths[i - 1] ?? 0))).toBe(true)
    expect(new Set(lengths).size).toBeGreaterThan(2)
    // 显示的永远是原文的前缀
    expect(more.startsWith(text())).toBe(true)

    // 流结束：立即全部显示
    await view.rerender(<StreamingText testId="st" text={`${more} End.`} />)
    expect(text()).toBe(`${more} End.`)
    expect(cursor()).toBeNull()
    expect(el.hasAttribute('aria-busy')).toBe(false)
  })

  it('不再变长时追上全文；整段被替换时立即显示新的全文', async () => {
    const view = await render(<StreamingText testId="st" text="Draft" streaming />)
    await view.rerender(<StreamingText testId="st" text="Draft one two three four" streaming />)
    await expect.poll(text).toBe('Draft one two three four')
    // 光标仍在（还没有结束）
    expect(cursor()).not.toBeNull()
    await view.rerender(<StreamingText testId="st" text="A different answer" streaming />)
    expect(text()).toBe('A different answer')
  })

  it('减少动态效果时不逐字放出', async () => {
    const view = await render(<StreamingText testId="st" text="Start" streaming />, {
      reducedMotion: true,
    })
    const full = `Start ${'and more text '.repeat(10)}`
    await view.rerender(<StreamingText testId="st" text={full} streaming />)
    expect(text()).toBe(full)
    expect(cursor()).not.toBeNull()
  })
})
