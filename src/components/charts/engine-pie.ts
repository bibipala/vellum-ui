/**
 * 饼图、环形图需要的 ECharts 模块：只由 PieChart.tsx 用 `import()` 加载，不要静态引入（见 engine.tsx）。
 */
import { PieChart } from 'echarts/charts'
import { TooltipComponent } from 'echarts/components'

export const modules = [PieChart, TooltipComponent]
