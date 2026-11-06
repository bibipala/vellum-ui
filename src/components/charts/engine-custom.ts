/**
 * 柱状图、热力图需要的 ECharts 模块（自定义系列）：只由 BarChart.tsx、Heatmap.tsx 用 `import()` 加载，
 * 不要静态引入（见 engine.tsx）。
 */
import { CustomChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'

export const modules = [CustomChart, GridComponent, TooltipComponent]
