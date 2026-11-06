import { ScatterChart } from 'vellum-ui'

const products = [
  { label: 'Aster', x: 12, y: 840 },
  { label: 'Birch', x: 18, y: 760 },
  { label: 'Cedar', x: 24, y: 610 },
  { label: 'Dahlia', x: 29, y: 655 },
  { label: 'Elm', x: 35, y: 480 },
  { label: 'Fern', x: 42, y: 390 },
  { label: 'Gorse', x: 48, y: 420 },
  { label: 'Hazel', x: 55, y: 260 },
  { label: 'Iris', x: 61, y: 205 },
  { label: 'Juniper', x: 70, y: 150 },
]

const builds = (offset: number, seed: number) =>
  Array.from({ length: 24 }, (_, i) => ({
    x: 20 + i * 8 + ((i * seed) % 7),
    y: Math.round(40 + offset + i * 3.2 + ((i * seed * 13) % 23)),
  }))

/**
 * Basic usage
 * One point per item; `xLabel` and `yLabel` name the axes. The pointer only has to be near a dot: the nearest
 * point within 16 px shows its tooltip.
 * @zh 基本用法
 * 每个对象一个点；`xLabel`、`yLabel` 给出两条轴的名称。指针只需靠近点：16px 以内最近的点显示提示。
 */
export function Basic() {
  return (
    <ScatterChart
      title="Price and units sold"
      description="Last quarter, per product"
      xLabel="Price"
      yLabel="Units sold"
      xFormat={(v) => `$${v}`}
      series={[{ key: 'products', name: 'Products', points: products }]}
    />
  )
}

/**
 * Two series
 * Up to 3 series: in a scatter chart any two points can be neighbors, and only the first 3 chart colors are told
 * apart in every pair. For more groups, fold them into "Other" or use small multiples.
 * @zh 两个系列
 * 最多 3 个系列：散点图中任意两点都可能相邻，只有前 3 个图表颜色两两都能分清。分组更多时合并为「其他」或拆成多个小图。
 * @section Variants
 */
export function Series() {
  return (
    <ScatterChart
      title="Build size and duration"
      xLabel="Size (MB)"
      yLabel="Duration (s)"
      series={[
        { key: 'main', name: 'Main branch', points: builds(0, 3) },
        { key: 'feature', name: 'Feature branches', points: builds(30, 5) },
      ]}
    />
  )
}
