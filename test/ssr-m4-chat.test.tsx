/**
 * 服务端渲染：AI 对话组件（MessageList、Message、MessageActions、PromptInput、PromptSuggestions）在没有 window、
 * document 的环境中渲染（Node），模块顶层不访问浏览器对象（导入本身就在 Node 中进行）。贴底、测量、拖放只在浏览器的
 * effect 中进行。
 */
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  Message,
  MessageActions,
  MessageList,
  PromptInput,
  PromptSuggestions,
  ThemeProvider,
} from '../src/index.ts'

afterEach(() => {
  vi.restoreAllMocks()
})

const ssr = (ui: React.ReactNode) =>
  renderToString(<ThemeProvider locale="en-US">{ui}</ThemeProvider>)

describe('服务端渲染（M4 AI 对话）', () => {
  it('没有浏览器对象时渲染消息的各种状态与操作', () => {
    expect(typeof window).toBe('undefined')
    expect(typeof document).toBe('undefined')
    const error = vi.spyOn(console, 'error')
    const html = ssr(
      <>
        <Message author="user">Hello</Message>
        <Message
          author="assistant"
          name="Helper"
          meta="10:42"
          actions={<MessageActions copyText="Hi" onRetry={() => {}} onFeedbackChange={() => {}} />}
        >
          Hi there
        </Message>
        <Message author="assistant" status="streaming" />
        <Message author="assistant" status="error" onRetry={() => {}}>
          Partial
        </Message>
        <Message author="assistant" status="stopped">
          Half
        </Message>
      </>,
    )
    expect(html).toMatch(/<article[^>]*aria-label="You"[^>]*data-author="user"/)
    expect(html).toMatch(/<article[^>]*aria-label="Helper"/)
    expect(html).toContain('10:42')
    // 操作：工具栏、复制、重试、赞踩（切换按钮，未按下）
    expect(html).toMatch(/role="toolbar"[^>]*aria-label="Message actions"/)
    expect(html).toContain('aria-label="Copy"')
    expect(html).toContain('aria-label="Retry"')
    expect(html).toMatch(/aria-label="Like" aria-pressed="false"/)
    expect(html).toMatch(/aria-label="Dislike" aria-pressed="false"/)
    // 状态：生成中（还没有内容）、失败（说明与重试）、已停止
    expect(html).toMatch(/aria-busy="true"[^>]*data-status="streaming"/)
    expect(html).toContain('Generating')
    expect(html).toContain('Couldn&#x27;t generate a reply')
    expect(html).toContain('Stopped')
    expect(error).not.toHaveBeenCalled()
  })

  it('消息列表：输出带名称的滚动区与空的列表（可见范围在浏览器中才确定）；没有消息时输出空状态', () => {
    const error = vi.spyOn(console, 'error')
    const items = Array.from({ length: 50 }, (_, i) => ({ id: `m${i}`, text: `Message ${i}` }))
    const html = ssr(
      <MessageList
        items={items}
        getKey={(m) => m.id}
        renderItem={(m) => <Message author="assistant">{m.text}</Message>}
        streaming
      />,
    )
    expect(html).toMatch(/<section[^>]*aria-label="Conversation"[^>]*tabindex="0"/)
    expect(html).toMatch(/<ul[^>]*aria-busy="true"/)
    // 服务端没有滚动元素，不知道可见范围：只输出结构，不输出消息。浏览器的首次渲染同样没有消息（滚动元素在提交后才
    // 存在），两者一致，水合时不会不匹配；挂载后在末端渲染可见的消息
    expect(html).not.toContain('Message 49')
    expect(html).toMatch(/<ul[^>]*><\/ul>/)
    expect(html).toContain('role="status"')
    const empty = ssr(
      <MessageList
        items={[] as { id: string }[]}
        getKey={(m) => m.id}
        renderItem={() => null}
        empty={<p>How can I help?</p>}
      />,
    )
    expect(empty).toContain('How can I help?')
    expect(error).not.toHaveBeenCalled()
  })

  it('输入框：文本框带读屏名称与占位文字，附件卡片、发送与停止按钮；禁用原因', () => {
    const error = vi.spyOn(console, 'error')
    const file = new File(['x'.repeat(2048)], 'plan.pdf', { type: 'application/pdf' })
    const html = ssr(
      <>
        <PromptInput allowFiles defaultFiles={[file]} defaultValue="Hello" />
        <PromptInput generating onStop={() => {}} />
        <PromptInput disabled disabledReason="Archived" />
      </>,
    )
    expect(html).toMatch(/<textarea[^>]*aria-label="Message"/)
    expect(html).toContain('placeholder="Type a message"')
    expect(html).toContain('>Hello</textarea>')
    expect(html).toMatch(/<ul[^>]*aria-label="Attachments"/)
    expect(html).toContain('plan.pdf')
    expect(html).toContain('2.0 KB')
    expect(html).toContain('aria-label="Remove plan.pdf"')
    expect(html).toContain('aria-label="Attach files"')
    expect(html).toContain('aria-label="Send"')
    expect(html).toContain('aria-label="Stop generating"')
    expect(html).toMatch(/<textarea[^>]*aria-disabled="true"[^>]*readOnly=""/i)
    expect(html).toContain('Archived')
    expect(error).not.toHaveBeenCalled()
  })

  it('提示建议：列表与按钮、说明、禁用', () => {
    const error = vi.spyOn(console, 'error')
    const html = ssr(
      <PromptSuggestions
        layout="vertical"
        items={[
          { key: 'a', label: 'Plan the launch', description: 'A checklist', icon: 'sparkles' },
          { key: 'b', label: 'Translate', disabled: true },
        ]}
      />,
    )
    expect(html).toMatch(/<ul[^>]*data-layout="vertical"[^>]*aria-label="Suggestions"/)
    expect(html).toContain('Plan the launch')
    expect(html).toContain('A checklist')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>.*Translate/)
    expect(error).not.toHaveBeenCalled()
  })
})
