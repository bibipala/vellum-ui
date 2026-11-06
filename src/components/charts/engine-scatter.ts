/**
 * 散点图需要的 ECharts 模块：只由 ScatterChart.tsx 用 `import()` 加载，不要静态引入（见 engine.tsx）。
 */
import { ScatterChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'

export const modules = [ScatterChart, GridComponent, TooltipComponent]
