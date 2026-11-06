import { readFileSync } from 'node:fs'
import { cloneElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  Avatar,
  Button,
  enUS,
  Icon,
  IconButton,
  Input,
  LinkButton,
  ListItem,
  Loading,
  PageSkeleton,
  Pill,
  Select,
  StatusDot,
  ThemeProvider,
  useTheme,
} from '../src/index.ts'

// 组件不接受 className（ADR 0016），但 Dropdown、Tooltip 等通过 cloneElement 注入的类名必须与组件自身的类合并
describe('包装组件注入的 className', () => {
  it('IconButton、Pill 保留自身样式类并合并注入的类名', () => {
    const btn = renderToStaticMarkup(
      cloneElement(<IconButton icon="more" label="更多" tooltip={false} />, {
        className: 'ant-dropdown-trigger',
      } as object),
    )
    expect(btn).toMatch(/class="[^"]*iconButton[^"]* ant-dropdown-trigger"/)
    const pill = renderToStaticMarkup(
      cloneElement(<Pill tone="success">在职</Pill>, { className: 'ant-tooltip-open' } as object),
    )
    expect(pill).toMatch(/class="[^"]*pill[^"]* ant-tooltip-open"/)
  })
})

// ADR 0018 §3：封装组件的语义属性在组件库内部实现
describe('antd 封装组件', () => {
  it('Input numeric 与运行时注入的类名合并', () => {
    const html = renderToStaticMarkup(
      cloneElement(<Input numeric defaultValue="12.50" />, {
        className: 'ant-dropdown-trigger',
      } as object),
    )
    expect(html).toMatch(/class="[^"]*numeric[^"]* ant-dropdown-trigger[^"]*"/)
  })

  it('Select block 占满宽度的样式类落在根元素上', () => {
    const html = renderToStaticMarkup(<Select block options={[]} />)
    expect(html).toMatch(/class="[^"]*ant-select[^"]*block|class="[^"]*block[^"]*ant-select/)
  })

  it('不再原样导出 antd 中与自研组件重复的组件', async () => {
    const ui: Record<string, unknown> = await import('../src/index.ts')
    for (const name of [
      'Tag',
      'Badge',
      'Card',
      'Space',
      'Layout',
      'Menu',
      'Result',
      'Empty',
      'Spin',
      'Monogram',
    ])
      expect(ui[name], name).toBeUndefined()
  })
})

// ADR 0018 §3：组件库的名字和属性不出现业务名词；场景组件不在组件库中
describe('StatusDot 与 Avatar 状态角标', () => {
  it('StatusDot 按色调输出，读屏名称优先用调用方提供的 aria-label', () => {
    const html = renderToStaticMarkup(<StatusDot tone="success" aria-label="在线" />)
    expect(html).toContain('role="img"')
    expect(html).toContain('aria-label="在线"')
    expect(html).toContain('data-tone="success"')
  })

  it('StatusDot 未传 aria-label 时用 i18n 中色调的默认名称（ThemeProvider 之外为 en-US）', () => {
    const tones = ['success', 'warning', 'danger', 'neutral', 'accent'] as const
    for (const tone of tones) {
      const html = renderToStaticMarkup(<StatusDot tone={tone} />)
      expect(html, tone).toContain(`aria-label="${enUS[`statusDot.${tone}`]}"`)
    }
  })

  it('Avatar 的 status 显示为可读出的角标，头像文字本身对读屏隐藏', () => {
    const html = renderToStaticMarkup(<Avatar name="林晓" status="warning" statusLabel="离开" />)
    expect(html).toMatch(/<span[^>]*aria-hidden="true"[^>]*>林<\/span>/)
    expect(html).toContain('aria-label="离开"')
    expect(html).toContain('data-tone="warning"')
    // 角标不能落在 aria-hidden 的子树里，否则读屏读不到：根元素不得带 aria-hidden
    expect(html).toMatch(/^<span(?![^>]*aria-hidden)[^>]*>/)
  })

  it('Avatar 不传 status 时没有角标', () => {
    expect(renderToStaticMarkup(<Avatar name="林晓" />)).not.toContain('role="img"')
  })

  it('Avatar 按名称稳定地取五种色调之一；图标头像不取色调（中性填充底）', () => {
    const tone = (html: string) => /^<span[^>]*data-tone="(\d)"/.exec(html)?.[1]
    const names = ['林晓', '周宁', '陈一鸣', '王思远', '赵敏', '孙乔', '吴桐', '郑可', '设计部']
    const tones = names.map((n) => tone(renderToStaticMarkup(<Avatar name={n} />)))
    for (const t of tones) expect(['1', '2', '3', '4', '5']).toContain(t)
    // 同一名称在任何尺寸、是否带外环时颜色都相同
    expect(tone(renderToStaticMarkup(<Avatar name="林晓" size={20} ring />))).toBe(tones[0])
    // 不同名称会分到不止一种色调
    expect(new Set(tones).size).toBeGreaterThan(2)
    expect(tone(renderToStaticMarkup(<Avatar name="系统通知" icon="bell" />))).toBeUndefined()
  })

  it('场景组件已移出组件库：PersonChip 在 ui-sdk，BrandMark 在外壳，PresenceDot 改为 StatusDot', async () => {
    const ui: Record<string, unknown> = await import('../src/index.ts')
    for (const name of ['PersonChip', 'PresenceDot', 'BrandMark'])
      expect(ui[name], name).toBeUndefined()
    expect(ui.StatusDot).toBeTypeOf('function')
  })
})

// docs/11 §6.2：可点击的自研组件用统一状态层（base.css 的 data-vl-state）
describe('统一状态层', () => {
  it('IconButton 与可点击的 ListItem 带状态层，展示用的 ListItem 没有', () => {
    expect(renderToStaticMarkup(<IconButton icon="more" label="更多" tooltip={false} />)).toContain(
      'data-vl-state=""',
    )
    const clickable = renderToStaticMarkup(<ListItem title="林晓" onClick={() => {}} />)
    expect(clickable).toMatch(/^<div[^>]*data-vl-state=""/)
    // 主体是原生按钮：Tab 可聚焦，Enter / Space 触发
    expect(clickable).toContain('<button type="button"')
    expect(renderToStaticMarkup(<ListItem title="林晓" />)).not.toContain('data-vl-state')
  })
})

/** 取出 aria-describedby 指向的元素的文字。 */
function describedText(html: string): string | undefined {
  const id = html.match(/aria-describedby="([^"]+)"/)?.[1]
  if (!id) return undefined
  const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return html.match(new RegExp(`<span id="${esc}" hidden="">([^<]*)</span>`))?.[1]
}

describe('IconButton disabledReason', () => {
  it('禁用并给出原因时改用 aria-disabled（仍可聚焦），原因通过 aria-describedby 读出', () => {
    const html = renderToStaticMarkup(
      <IconButton icon="download" label="下载" disabled disabledReason="没有下载权限" />,
    )
    expect(html).toContain('aria-disabled="true"')
    expect(html).not.toMatch(/<button[^>]* disabled=""/)
    expect(describedText(html)).toBe('没有下载权限')
  })

  it('没有原因时仍是原生 disabled；未禁用时原因不生效', () => {
    const plain = renderToStaticMarkup(<IconButton icon="download" label="下载" disabled />)
    expect(plain).toMatch(/<button[^>]* disabled=""/)
    expect(plain).not.toContain('aria-disabled')
    const enabled = renderToStaticMarkup(
      <IconButton icon="download" label="下载" disabledReason="没有下载权限" />,
    )
    expect(enabled).not.toContain('aria-disabled')
    expect(enabled).not.toContain('没有下载权限')
  })
})

describe('Button disabledReason 与加载', () => {
  it('禁用并给出原因：aria-disabled（仍可聚焦）、沿用 antd 禁用外观，原因通过 aria-describedby 读出', () => {
    const html = renderToStaticMarkup(
      <Button htmlType="submit" disabled disabledReason="没有删除权限">
        删除
      </Button>,
    )
    expect(html).toMatch(/<button[^>]*aria-disabled="true"/)
    expect(html).not.toMatch(/<button[^>]* disabled=""/)
    expect(html).toMatch(/class="[^"]*ant-btn-disabled/)
    expect(html).toContain('type="submit"')
    expect(describedText(html)).toBe('没有删除权限')
  })

  it('没有原因时是原生 disabled；未禁用时原因不生效', () => {
    expect(renderToStaticMarkup(<Button disabled>删除</Button>)).toMatch(/<button[^>]* disabled=""/)
    const enabled = renderToStaticMarkup(<Button disabledReason="没有删除权限">删除</Button>)
    expect(enabled).not.toContain('aria-disabled')
    expect(enabled).not.toContain('没有删除权限')
  })

  it('没有图标的按钮带「加载时宽度不变」的样式类，有图标的按钮沿用 antd（图标位换成加载指示）', () => {
    expect(renderToStaticMarkup(<Button loading>保存</Button>)).toMatch(
      /class="[^"]*textButton[^"]*ant-btn-loading|class="[^"]*ant-btn-loading[^"]*textButton/,
    )
    const withIcon = renderToStaticMarkup(
      <Button loading icon={<Icon name="download" />}>
        导出
      </Button>,
    )
    expect(withIcon).toContain('ant-btn-loading')
    expect(withIcon).not.toContain('textButton')
  })
})

// docs/11 §6.2「不闪」：骨架与加载指示挂载后延迟 200ms 才淡入（纯 CSS）
describe('Loading 与 PageSkeleton 延迟出现', () => {
  it('样式：延迟取令牌 motion-delay-loading，延迟期间保持不可见；immediate 时不再延迟', () => {
    const css = readFileSync(
      new URL('../src/components/feedback.module.css', import.meta.url),
      'utf8',
    )
    expect(css).toMatch(
      /\.loading,\s*\.skeleton\s*\{\s*animation:[^;]*var\(--vl-motion-delay-loading\)\s*both;/,
    )
    expect(css).toMatch(/@keyframes pending-in\s*\{\s*from\s*\{\s*opacity:\s*0;/)
    expect(css).toMatch(
      /\.loading\[data-immediate\],\s*\.skeleton\[data-immediate\]\s*\{\s*animation-delay:\s*var\(--vl-motion-duration-instant\)/,
    )
  })

  it('immediate 输出为 data-immediate，默认没有', () => {
    expect(renderToStaticMarkup(<Loading />)).not.toContain('data-immediate')
    expect(renderToStaticMarkup(<Loading immediate />)).toContain('data-immediate="true"')
    expect(renderToStaticMarkup(<PageSkeleton immediate />)).toContain('data-immediate="true"')
  })
})

// 文字链接按钮：强调色文字的行内操作，统一替代 antd 的 type="link"
describe('LinkButton', () => {
  it('输出原生按钮（type=button）与色调，图标在文字前', () => {
    const html = renderToStaticMarkup(
      <LinkButton icon="alert" tone="danger">
        重试
      </LinkButton>,
    )
    expect(html).toMatch(
      /^<button type="button"[^>]*class="[^"]*linkButton[^"]*"[^>]*data-tone="danger"/,
    )
    expect(html).toMatch(/lucide-circle-alert[\s\S]*重试<\/button>$/)
    expect(renderToStaticMarkup(<LinkButton>查看</LinkButton>)).toContain('data-tone="accent"')
  })

  it('合并运行时注入的类名（Popconfirm、Dropdown 作为触发器时）', () => {
    const html = renderToStaticMarkup(
      cloneElement(<LinkButton>撤销</LinkButton>, { className: 'ant-popover-open' } as object),
    )
    expect(html).toMatch(/class="[^"]*linkButton[^"]* ant-popover-open"/)
  })

  it('Button 不再接受 type="link"（统一用 LinkButton）', () => {
    // @ts-expect-error 强调色文字链接改用 LinkButton
    const el = <Button type="link">旧写法</Button>
    expect(el).toBeTruthy()
  })
})

// 外壳把密度保存在本机：ThemeProvider 受控时，useTheme().setDensity 通过 onDensityChange 通知外部
let probed: ReturnType<typeof useTheme> | undefined
function Probe() {
  probed = useTheme()
  return null
}

describe('ThemeProvider 密度', () => {
  it('受控密度：编译出对应的控件高度，setDensity 触发 onDensityChange', () => {
    const changes: string[] = []
    renderToStaticMarkup(
      <ThemeProvider density="compact" onDensityChange={(d) => changes.push(d)}>
        <Probe />
      </ThemeProvider>,
    )
    const ctx = probed
    expect(ctx?.density).toBe('compact')
    expect(ctx?.cssVars['--vl-control-height-md']).toBe('28px')
    ctx?.setDensity('comfortable')
    expect(changes).toEqual(['comfortable'])
  })
})
