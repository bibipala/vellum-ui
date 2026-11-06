/**
 * ECharts 的核心与 SVG 渲染器：只由 engine.tsx 用 `import()` 加载（第一个图表渲染时），不要静态引入，
 * 否则 ECharts 会进入使用方的入口包。
 */
export { init, use } from 'echarts/core'
export { SVGRenderer } from 'echarts/renderers'
