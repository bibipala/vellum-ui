/**
 * Message 与 MessageActions 在真实浏览器中的交互（docs/11 §6.2「点击区域」「键盘」「不跳」）：
 * - 消息的操作区平时透明、悬停或键盘焦点进入消息时出现，消息高度不变；`showActions="always"` 始终可见；生成中不显示；
 * - 用户消息靠右、在中性填充的气泡中，助手消息靠左、不加气泡；生成中（还没有内容）延迟出现「正在生成」，
 *   减少动态效果时指示静止；失败的「重试」、已停止的标注；
 * - 操作工具栏：只占一个 Tab 位置，←/→、Home/End 漫游焦点，再回来时落在上次的按钮上；赞、踩互斥（aria-pressed）；
 *   复制只写剪贴板、不读。
 */
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { IconButton, Message, MessageActions, type MessageFeedback } from '../../src/index.ts'
import {
  css,
  expectFocusRing,
  focused,
  ms,
  page,
  parkPointer,
  render,
  sameColor,
  token,
  userEvent,
} from './render.tsx'

afterEach(() => {
  vi.restoreAllMocks()
})

/** 替换剪贴板：记下写入的内容；readText / read 用于断言从未读取。 */
function fakeClipboard() {
  const written: string[] = []
  const writeText = vi.fn(async (text: string) => {
    written.push(text)
  })
  const readText = vi.fn(async () => '')
  const read = vi.fn(async () => [])
  vi.spyOn(navigator, 'clipboard', 'get').mockReturnValue({
    writeText,
    readText,
    read,
  } as unknown as Clipboard)
  return { written, readText, read }
}

const article = (name: string) => page.getByRole('article', { name }).element() as HTMLElement
const actionsOf = (el: HTMLElement) =>
  el.querySelector('[role="toolbar"]')?.parentElement as HTMLElement
const names = (el: Element) =>
  [...el.querySelectorAll('button')].map((b) => b.getAttribute('aria-label'))

describe('Message', () => {
  it('操作区平时透明，悬停或键盘焦点进入消息时出现，消息高度不变；showActions="always" 始终可见', async () => {
    await render(
      <div style={{ width: 640 }}>
        <button type="button">Before</button>
        <Message author="assistant" name="Helper" actions={<MessageActions copyText="Hi" />}>
          Hi there
        </Message>
        <Message author="assistant" name="Pinned" showActions="always" actions={<MessageActions />}>
          Always
        </Message>
      </div>,
    )
    const msg = article('Helper')
    const actions = actionsOf(msg)
    expect(css(actions).opacity).toBe('0')
    const height = msg.getBoundingClientRect().height
    await userEvent.hover(msg)
    await expect.poll(() => css(actions).opacity).toBe('1')
    expect(msg.getBoundingClientRect().height).toBe(height)
    // 过渡取 fast 令牌
    expect(ms(css(actions).transitionDuration)).toBe(ms(token('motion-duration-fast')))
    await parkPointer()
    await expect.poll(() => css(actions).opacity).toBe('0')
    // 键盘：从前面的按钮 Tab 进入消息的操作
    page.getByRole('button', { name: 'Before' }).element().focus()
    await userEvent.tab()
    expect(focused()?.getAttribute('aria-label')).toBe('Copy')
    await expect.poll(() => css(actions).opacity).toBe('1')
    expectFocusRing(focused() as Element, 2)
    expect(css(actionsOf(article('Pinned'))).opacity).toBe('1')
  })

  it('用户消息靠右、在中性填充的气泡中；助手消息靠左、不加气泡、占满宽度', async () => {
    await render(
      <div style={{ width: 640 }} data-testid="frame">
        <Message author="user">Short question</Message>
        <Message author="assistant">A reply that is a bit longer than the question.</Message>
      </div>,
    )
    const frame = page.getByTestId('frame').element().getBoundingClientRect()
    const user = article('You').querySelector('[data-vl-announce]') as HTMLElement
    const reply = article('Assistant').querySelector('[data-vl-announce]') as HTMLElement
    expect(Math.round(user.getBoundingClientRect().right)).toBe(Math.round(frame.right))
    expect(user.getBoundingClientRect().width).toBeLessThan(frame.width / 2)
    expect(sameColor(css(user).backgroundColor, token('color-fill'))).toBe(true)
    expect(css(user).borderTopWidth).toBe('0px')
    expect(Math.round(reply.getBoundingClientRect().left)).toBe(Math.round(frame.left))
    expect(Math.round(reply.getBoundingClientRect().width)).toBe(Math.round(frame.width))
    expect(css(reply).backgroundColor).toBe('rgba(0, 0, 0, 0)')
    // 纯文本保留换行
    expect(css(user).whiteSpace).toBe('pre-wrap')
  })

  it('生成中：没有内容时延迟出现「正在生成」，不显示操作；减少动态效果时指示静止', async () => {
    const { rerender } = await render(
      <Message author="assistant" status="streaming" actions={<MessageActions copyText="x" />} />,
    )
    const pending = page.getByText('Generating').element() as HTMLElement
    expect(ms(css(pending).animationDelay)).toBe(ms(token('motion-delay-loading')))
    expect(document.querySelector('[role="toolbar"]')).toBeNull()
    expect(article('Assistant').getAttribute('aria-busy')).toBe('true')
    // 收到内容后指示消失；完成后出现操作
    await rerender(
      <Message author="assistant" status="streaming" actions={<MessageActions copyText="x" />}>
        Partial
      </Message>,
    )
    expect(document.body.textContent).not.toContain('Generating')
    await rerender(
      <Message author="assistant" status="done" actions={<MessageActions copyText="x" />}>
        Partial reply
      </Message>,
    )
    expect(document.querySelector('[role="toolbar"]')).not.toBeNull()
    expect(article('Assistant').getAttribute('aria-busy')).toBeNull()
  })

  it('减少动态效果：加载指示的旋转时长为 0', async () => {
    await render(<Message author="assistant" status="streaming" />, { reducedMotion: true })
    const spin = page.getByText('Generating').element().querySelector('span') as HTMLElement
    expect(ms(css(spin).animationDuration)).toBe(0)
  })

  it('失败：保留内容、显示说明与「重试」；已停止：显示标注', async () => {
    const onRetry = vi.fn()
    await render(
      <>
        <Message author="assistant" name="Failed" status="error" onRetry={onRetry}>
          Half of the
        </Message>
        <Message author="assistant" name="Halted" status="stopped">
          The first
        </Message>
        <Message author="assistant" name="Custom" status="error" error="The model is busy" />
      </>,
    )
    expect(article('Failed').textContent).toContain('Half of the')
    expect(article('Failed').textContent).toContain("Couldn't generate a reply")
    await userEvent.click(page.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(article('Halted').textContent).toContain('Stopped')
    expect(article('Custom').textContent).toContain('The model is busy')
    expect(article('Custom').querySelector('button')).toBeNull()
  })
})

/** 受控的反馈：外加前后两个按钮，检查 Tab 顺序。 */
function Rated(props: { readonly onChange?: (f: MessageFeedback) => void }) {
  const [feedback, setFeedback] = useState<MessageFeedback>(null)
  return (
    <>
      <button type="button">Before</button>
      <MessageActions
        copyText="Reply text"
        onRetry={() => {}}
        feedback={feedback}
        onFeedbackChange={(f) => {
          setFeedback(f)
          props.onChange?.(f)
        }}
      >
        <IconButton icon="share" size="sm" label="Share" />
      </MessageActions>
      <button type="button">After</button>
    </>
  )
}

describe('MessageActions', () => {
  it('工具栏只占一个 Tab 位置：←/→ 循环移动，Home/End 到两端，离开后回来落在上次的按钮上', async () => {
    await render(<Rated />)
    const toolbar = page.getByRole('toolbar', { name: 'Message actions' }).element()
    expect(names(toolbar)).toEqual(['Copy', 'Retry', 'Like', 'Dislike', 'Share'])
    page.getByRole('button', { name: 'Before' }).element().focus()
    await userEvent.tab()
    expect(focused()?.getAttribute('aria-label')).toBe('Copy')
    await userEvent.keyboard('{ArrowRight}')
    expect(focused()?.getAttribute('aria-label')).toBe('Retry')
    await userEvent.keyboard('{End}')
    expect(focused()?.getAttribute('aria-label')).toBe('Share')
    await userEvent.keyboard('{ArrowRight}')
    expect(focused()?.getAttribute('aria-label')).toBe('Copy')
    await userEvent.keyboard('{ArrowLeft}')
    expect(focused()?.getAttribute('aria-label')).toBe('Share')
    await userEvent.keyboard('{Home}{ArrowRight}{ArrowRight}')
    expect(focused()?.getAttribute('aria-label')).toBe('Like')
    // 只有当前按钮在 Tab 顺序中：Tab 直接离开工具栏
    await userEvent.tab()
    expect(focused()?.textContent).toBe('After')
    await userEvent.tab({ shift: true })
    expect(focused()?.getAttribute('aria-label')).toBe('Like')
    expectFocusRing(focused() as Element, 2)
    const tabbable = [...toolbar.querySelectorAll('button')].filter((b) => b.tabIndex === 0)
    expect(tabbable.map((b) => b.getAttribute('aria-label'))).toEqual(['Like'])
  })

  it('赞、踩是互斥的切换按钮（aria-pressed）；再次按下取消', async () => {
    const onChange = vi.fn()
    await render(<Rated onChange={onChange} />)
    const like = page.getByRole('button', { name: 'Like' })
    const dislike = page.getByRole('button', { name: 'Dislike' })
    expect(like.element().getAttribute('aria-pressed')).toBe('false')
    await userEvent.click(like)
    await expect.poll(() => like.element().getAttribute('aria-pressed')).toBe('true')
    expect(onChange).toHaveBeenLastCalledWith('like')
    await userEvent.click(dislike)
    await expect.poll(() => dislike.element().getAttribute('aria-pressed')).toBe('true')
    expect(like.element().getAttribute('aria-pressed')).toBe('false')
    expect(onChange).toHaveBeenLastCalledWith('dislike')
    // 键盘：空格切换
    dislike.element().focus()
    await userEvent.keyboard(' ')
    await expect.poll(() => dislike.element().getAttribute('aria-pressed')).toBe('false')
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('不受控：不传 feedback 时按钮自己保存状态', async () => {
    const onChange = vi.fn()
    await render(<MessageActions onFeedbackChange={onChange} />)
    const like = page.getByRole('button', { name: 'Like' })
    await userEvent.click(like)
    await expect.poll(() => like.element().getAttribute('aria-pressed')).toBe('true')
    expect(onChange).toHaveBeenCalledWith('like')
  })

  it('复制只写入剪贴板、从不读取，并播报「Copied」', async () => {
    const clip = fakeClipboard()
    const onCopy = vi.fn()
    await render(<MessageActions copyText="The **reply**" onCopy={onCopy} />)
    await userEvent.click(page.getByRole('button', { name: 'Copy' }))
    await expect.poll(() => clip.written).toEqual(['The **reply**'])
    expect(onCopy).toHaveBeenCalledWith('The **reply**')
    expect(clip.readText).not.toHaveBeenCalled()
    expect(clip.read).not.toHaveBeenCalled()
    await expect.element(page.getByRole('status')).toHaveTextContent('Copied')
  })
})
