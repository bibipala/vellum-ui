/**
 * 折线图、面积图需要的 ECharts 模块：只由 LineChart.tsx 用 `import()` 加载，不要静态引入（见 engine.tsx）。
 */
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'

export const modules = [LineChart, GridComponent, TooltipComponent]
