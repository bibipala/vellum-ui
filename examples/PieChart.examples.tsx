import { PieChart } from 'vellum-ui'

const storage = [
  { key: 'images', name: 'Images', value: 412 },
  { key: 'video', name: 'Video', value: 268 },
  { key: 'documents', name: 'Documents', value: 145 },
  { key: 'archives', name: 'Archives', value: 61 },
]

const sources = [
  { key: 'search', name: 'Search', value: 4820 },
  { key: 'direct', name: 'Direct', value: 3150 },
  { key: 'social', name: 'Social', value: 1940 },
  { key: 'email', name: 'Email', value: 1210 },
  { key: 'partners', name: 'Partners', value: 640 },
  { key: 'ads', name: 'Ads', value: 420 },
  { key: 'events', name: 'Events', value: 180 },
  { key: 'other', name: 'Referrals', value: 95 },
]

/**
 * Basic usage
 * A rough split of one whole into a few parts. Hover or focus a slice to read its value and share; the table view
 * lists every item. To compare close values, use a BarChart instead.
 * @zh 基本用法
 * 一个整体粗略分成几部分。悬停或聚焦扇区读出数值与占比；表格视图列出全部项。要比较相近的数值，改用柱状图。
 */
export function Basic() {
  return (
    <PieChart
      title="Storage by file type"
      description="Gigabytes"
      data={storage}
      nameLabel="File type"
      valueLabel="Size (GB)"
      format={(v) => `${v} GB`}
    />
  )
}

/**
 * Folding into "Other"
 * Beyond `maxSlices` (6 by default), the largest items are kept and the rest become one muted "Other" slice. The
 * table view still lists all eight sources.
 * @zh 合并为「其他」
 * 超过 `maxSlices`（默认 6）时保留最大的几项，其余合并为一个弱化色的「其他」扇区。表格视图仍列出全部八个来源。
 * @section Variants
 */
export function Folding() {
  return <PieChart title="Visits by source" data={sources} />
}
