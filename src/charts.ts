/**
 * vellum-ui/charts —— 基于 ECharts 的图表：LineChart、AreaChart、BarChart、PieChart、DonutChart、ScatterChart、Heatmap
 * 与它们共用的外框 ChartContainer。
 *
 * 需要使用方安装 echarts（可选的 peer 依赖，只有本入口用到）。图表引擎在第一次渲染时按需加载，核心入口不引用本入口的模块。
 * 本入口与核心入口共用同一份模块（主题上下文、令牌、组件）：发布产物中它按相对路径导入核心模块，不另带一份副本。
 * 数值写法 `ValueFormat` 与分类色序号 `ChartColorSlot` 也用于核心入口的 Statistic、Sparkline、SegmentedBar，从 `vellum-ui` 导入。
 */

export { BarChart, type BarChartProps } from './components/charts/BarChart.tsx'
export {
  type ChartCommonProps,
  ChartContainer,
  type ChartContainerProps,
  type ChartLegendItem,
  type ChartTableColumn,
  type ChartTableData,
} from './components/charts/ChartContainer.tsx'
export type { ChartXValue } from './components/charts/cartesian.ts'
export { Heatmap, type HeatmapProps } from './components/charts/Heatmap.tsx'
export type { HeatmapCell } from './components/charts/heatmap-model.ts'
export {
  AreaChart,
  type AreaChartProps,
  type LineAreaChartProps,
  LineChart,
  type LineChartProps,
} from './components/charts/LineChart.tsx'
export {
  DonutChart,
  type DonutChartProps,
  PieChart,
  type PieChartProps,
} from './components/charts/PieChart.tsx'
export type { PieChartDatum } from './components/charts/pie.ts'
export { ScatterChart, type ScatterChartProps } from './components/charts/ScatterChart.tsx'
export type { ScatterPoint, ScatterSeries } from './components/charts/scatter.ts'
export type { ChartSeries } from './components/charts/series.ts'
