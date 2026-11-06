/**
 * 服务端渲染：图表在没有 window、document、navigator 的环境中渲染（Node，navigator 也去掉）。
 * 引入 ECharts 的模块本身不访问 DOM，实例只在 effect 中创建，所以服务端输出容器、标题、图例与空的图形区域，不抛错。
 */
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AreaChart,
  BarChart,
  ChartContainer,
  DonutChart,
  Heatmap,
  LineChart,
  PieChart,
  ScatterChart,
  ThemeProvider,
} from '../src/index.ts'

afterEach(() => {
  vi.unstubAllGlobals()
})

const rows = [
  { month: 'Jan', a: 1, b: 2 },
  { month: 'Feb', a: 3, b: 4 },
]
const slices = [
  { key: 'x', name: 'Xray', value: 3 },
  { key: 'y', name: 'Yankee', value: 2 },
  { key: 'z', name: 'Zulu', value: 1 },
]
const series = [
  { key: 'a', name: 'Alpha' },
  { key: 'b', name: 'Beta' },
] as const

describe('服务端渲染（图表）', () => {
  it('没有浏览器对象时渲染：输出容器、标题、图例与图形区域，不创建图表实例', () => {
    vi.stubGlobal('navigator', undefined)
    expect(typeof window).toBe('undefined')
    expect(typeof document).toBe('undefined')
    const html = renderToString(
      <ThemeProvider locale="en-US">
        <LineChart title="Line title" data={rows} x="month" series={series} />
        <AreaChart title="Area title" data={rows} x="month" series={series} stacked />
        <BarChart title="Bar title" data={rows} x="month" series={series} stacked showValues />
        <BarChart
          title="Horizontal title"
          data={rows}
          x="month"
          series={series}
          orientation="horizontal"
        />
        <PieChart title="Pie title" data={slices} maxSlices={2} />
        <DonutChart title="Donut title" data={slices} />
        <ScatterChart
          title="Scatter title"
          xLabel="Price"
          series={[{ key: 's', name: 'Items', points: [{ x: 1, y: 2 }] }]}
        />
        <Heatmap
          title="Heatmap title"
          xCategories={['a', 'b']}
          yCategories={['r']}
          data={[
            { x: 'a', y: 'r', value: 1 },
            { x: 'b', y: 'r', value: 3 },
          ]}
        />
        <ChartContainer title="Custom title" height={120}>
          <div>Custom graphic</div>
        </ChartContainer>
        <LineChart title="Empty line" data={[]} x="month" series={series} />
      </ThemeProvider>,
    )
    for (const title of [
      'Line title',
      'Area title',
      'Bar title',
      'Horizontal title',
      'Pie title',
      'Donut title',
      'Scatter title',
      'Heatmap title',
      'Custom title',
      'Empty line',
    ])
      expect(html).toContain(title)
    // 9 个图表 + 1 个自定义容器；热力图的色标也是 figure
    expect(html.match(/<figure/g)).toHaveLength(11)
    expect(html).toContain('role="application"')
    expect(html).toContain('aria-roledescription="Line chart"')
    expect(html).toContain('aria-roledescription="Area chart"')
    expect(html).toContain('aria-roledescription="Bar chart"')
    expect(html).toContain('aria-roledescription="Pie chart"')
    expect(html).toContain('aria-roledescription="Donut chart"')
    expect(html).toContain('aria-roledescription="Scatter chart"')
    expect(html).toContain('aria-roledescription="Heatmap"')
    expect(html).toContain('aria-label="Color scale from 1 to 3"')
    // 饼图合并后的「其他」出现在图例中
    expect(html).toContain('>Other</span>')
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('Custom graphic')
    expect(html).toContain('No data')
    // 图形区域是空的：ECharts 的 SVG 只在浏览器中、effect 里生成
    const plots = [...html.matchAll(/<div[^>]*role="application"[^>]*>(.*?)<\/div>/g)]
    // 折线、面积、两个柱状图、饼图、环形图、散点图、热力图各一个；空的图表显示空状态，没有图形区域
    expect(plots).toHaveLength(8)
    for (const m of plots) expect(m[1]).toBe('')
  })
})
