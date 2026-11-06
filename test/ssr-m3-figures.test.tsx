/**
 * 服务端渲染：数字展示组件（Sparkline、Statistic、SegmentedBar）在没有 window、document 的环境中渲染（Node），
 * 模块顶层不访问浏览器对象（导入本身就在 Node 中进行）。分段条块内文字的测量只在浏览器的布局 effect 中进行：
 * 服务端输出时文字存在（供测量）但没有 data-fit，即不显示，取保守的默认。
 */
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SegmentedBar, Sparkline, Statistic, ThemeProvider } from '../src/index.ts'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('服务端渲染（M3 数字展示）', () => {
  it('没有浏览器对象时渲染：迷你图路径与摘要、指标卡增减、分段条的块与读屏名称都输出；块内文字不显示', () => {
    expect(typeof window).toBe('undefined')
    expect(typeof document).toBe('undefined')
    const error = vi.spyOn(console, 'error')
    const html = renderToString(
      <ThemeProvider locale="en-US">
        <Sparkline data={[3, null, 5, 8]} label="Visits" area />
        <Statistic
          label="Active users"
          value={12_894}
          delta={{ value: 0.125, period: 'vs last month' }}
          trend={[1, 2, 3]}
        />
        <Statistic label="Loading tile" value={null} loading delta={{ value: 0, period: 'x' }} />
        <SegmentedBar
          variant="tall"
          label="Storage"
          items={[
            { key: 'a', name: 'Images', value: 3 },
            { key: 'b', name: 'Videos', value: 1 },
          ]}
        />
        <SegmentedBar variant="thin" label="Empty" items={[]} />
      </ThemeProvider>,
    )
    // 迷你图：读屏摘要与路径
    expect(html).toContain('aria-label="Visits: from 3 to 8, low 3, high 8"')
    expect(html).toContain('d="M66.67 60L100 0"')
    expect(html).toContain('data-sparkline-point=""')
    // 指标卡：数值、带符号的增减与读屏句子；加载时的骨架
    expect(html).toContain('12.9K')
    expect(html).toContain('+12.5%')
    expect(html).toContain('Up 12.5%, vs last month')
    expect(html).toContain('data-skeleton="value"')
    // 分段条：figure 与每块的读屏名称；块内文字输出但没有 data-fit（不显示）
    expect(html).toMatch(/<figure[^>]*aria-label="Storage"/)
    expect(html).toContain('aria-label="Images: 3 (75%)"')
    expect(html).toContain('aria-label="Videos: 1 (25%)"')
    expect(html).toMatch(/data-segment-label=""[^>]*>75%</)
    expect(html).not.toContain('data-fit')
    expect(html).toContain('data-segment-empty')
    // 服务端渲染没有报错或警告（例如布局 effect、水合相关的提示）
    expect(error).not.toHaveBeenCalled()
  })
})
