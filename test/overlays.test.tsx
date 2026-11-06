import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

// 对话框与提示气泡渲染在 Portal 中，服务端渲染得不到它们的结构（测试环境没有 DOM）。
// 这里替换 antd 的 Modal、Tooltip，只检查封装组件把语义属性转换成了什么，转换后的效果由 antd 负责。
const received = vi.hoisted(() => ({ modal: [] as unknown[], tooltip: [] as unknown[] }))
vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>()
  return {
    ...actual,
    Modal: (props: object) => {
      received.modal.push(props)
      return null
    },
    Tooltip: (props: { children?: unknown }) => {
      received.tooltip.push(props)
      return null
    },
  }
})

const { Button, IconButton, Modal, ThemeProvider, Tooltip } = await import('../src/index.ts')

/** 被 Tooltip 包住的按钮元素的属性（Tooltip 被替换为只记录属性的桩）。 */
type TriggerProps = {
  onClick?: (e: { preventDefault: () => void }) => void
  disabled?: boolean
  htmlType?: string
  href?: string
  'aria-disabled'?: boolean
}
const lastTooltip = () =>
  received.tooltip.at(-1) as {
    title?: ReactNode
    trigger?: unknown
    children: { props: TriggerProps }
  }
const titleHtml = (tip: { title?: ReactNode }) => renderToStaticMarkup(tip.title)

describe('弹层封装（ADR 0018）', () => {
  it('Modal flush 把贴边样式类交给对话框容器（.ant-modal-container）', () => {
    received.modal.length = 0
    renderToStaticMarkup(<Modal open flush footer={null} />)
    renderToStaticMarkup(<Modal open />)
    const [flush, normal] = received.modal as { classNames?: { container?: string } }[]
    expect(flush?.classNames?.container).toMatch(/flush/)
    expect(normal?.classNames).toBeUndefined()
  })

  it('Tooltip 默认延迟 500ms 出现（docs/11 §6.2），调用方可覆盖', () => {
    received.tooltip.length = 0
    renderToStaticMarkup(<Tooltip title="说明">x</Tooltip>)
    renderToStaticMarkup(
      <Tooltip title="说明" mouseEnterDelay={0}>
        x
      </Tooltip>,
    )
    const [byDefault, overridden] = received.tooltip as { mouseEnterDelay?: number }[]
    expect(byDefault?.mouseEnterDelay).toBe(0.5)
    expect(overridden?.mouseEnterDelay).toBe(0)
  })
})

// docs/11 §6.2：因权限或条件不满足而禁用时，悬停或键盘聚焦说明原因
describe('disabledReason', () => {
  it('Button：提示在悬停与聚焦时出现；点击被拦截（阻止表单提交与链接跳转），调用方的 onClick 不执行', () => {
    received.tooltip.length = 0
    const onClick = vi.fn()
    renderToStaticMarkup(
      <Button htmlType="submit" href="/x" disabled disabledReason="没有删除权限" onClick={onClick}>
        删除
      </Button>,
    )
    const tip = lastTooltip()
    // 气泡文字对读屏隐藏：原因已由按钮的 aria-describedby 引用的隐藏元素提供，避免气泡打开时读两遍
    expect(titleHtml(tip)).toBe('<span aria-hidden="true">没有删除权限</span>')
    expect(tip.trigger).toEqual(['hover', 'focus'])
    const btn = tip.children.props
    // 不用原生 disabled（它会让按钮无法聚焦、收不到鼠标事件），而是 aria-disabled
    expect(btn.disabled).toBe(false)
    expect(btn['aria-disabled']).toBe(true)
    expect(btn.htmlType).toBe('submit')
    expect(btn.href).toBeUndefined()
    const preventDefault = vi.fn()
    btn.onClick?.({ preventDefault })
    expect(preventDefault).toHaveBeenCalledOnce()
    expect(onClick).not.toHaveBeenCalled()
  })

  it('IconButton：提示为「说明：原因」（格式随语言），即使 tooltip={false} 也显示；点击被拦截', () => {
    received.tooltip.length = 0
    renderToStaticMarkup(
      <IconButton
        icon="download"
        label="Download"
        tooltip={false}
        disabled
        disabledReason="No access"
      />,
    )
    expect(titleHtml(lastTooltip())).toBe('<span aria-hidden="true">Download: No access</span>')
    received.tooltip.length = 0
    const onClick = vi.fn()
    renderToStaticMarkup(
      <ThemeProvider locale="zh-CN">
        <IconButton
          icon="download"
          label="下载"
          tooltip={false}
          disabled
          disabledReason="没有下载权限"
          onClick={onClick}
        />
      </ThemeProvider>,
    )
    const tip = lastTooltip()
    expect(titleHtml(tip)).toBe('<span aria-hidden="true">下载：没有下载权限</span>')
    expect(tip.trigger).toEqual(['hover', 'focus'])
    const preventDefault = vi.fn()
    tip.children.props.onClick?.({ preventDefault })
    expect(preventDefault).toHaveBeenCalledOnce()
    expect(onClick).not.toHaveBeenCalled()
  })

  it('未禁用时按钮照常工作，不包提示', () => {
    received.tooltip.length = 0
    renderToStaticMarkup(<Button disabledReason="没有删除权限">删除</Button>)
    expect(received.tooltip).toEqual([])
  })
})
