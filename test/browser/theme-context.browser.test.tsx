/**
 * 主题的上下文按内容拆开：只切换看图背景（viewerStage）时，挂载着的表格与图表不重新渲染，它们只读取自己用到的
 * 密度与 CSS 变量。切换密度时表格仍然重新渲染（同时确认计数确实有效）；useTheme 的结果照常更新。
 * 用 React 的 Profiler 统计每个子树的提交次数。
 */
import { Profiler, type ProfilerOnRenderCallback } from 'react'
import { describe, expect, it } from 'vitest'
import { BarChart } from '../../src/charts.ts'
import { DataTable, type DataTableColumn, useTheme } from '../../src/index.ts'
import { plot, rendered } from './charts.tsx'
import { frames, inAct, render } from './render.tsx'

interface Project {
  readonly id: string
  readonly name: string
}
const projects: readonly Project[] = [
  { id: 'a', name: 'Atlas' },
  { id: 'b', name: 'Beacon' },
]
const columns: DataTableColumn<Project>[] = [{ key: 'name', title: 'Name' }]
const data = [
  { quarter: 'Q1', revenue: 420 },
  { quarter: 'Q2', revenue: 455 },
]
const series = [{ key: 'revenue', name: 'Revenue' }] as const

const commits = { table: 0, chart: 0 }
const count =
  (which: keyof typeof commits): ProfilerOnRenderCallback =>
  () => {
    commits[which]++
  }

let theme: ReturnType<typeof useTheme>
function Probe() {
  theme = useTheme()
  return null
}

/** 等到连续若干帧都没有新的提交（图表加载、测量、字体加载完成后的更新都结束）。 */
async function quiet() {
  await expect
    .poll(
      async () => {
        const before = commits.table + commits.chart
        await frames(10)
        return commits.table + commits.chart === before
      },
      { timeout: 5000 },
    )
    .toBe(true)
}

describe('主题上下文', () => {
  it('只切换看图背景时，表格与图表不重新渲染；切换密度时表格重新渲染', async () => {
    await render(
      <div style={{ width: 640 }}>
        <Probe />
        <Profiler id="table" onRender={count('table')}>
          <DataTable aria-label="Projects" columns={columns} rows={projects} rowKey={(p) => p.id} />
        </Profiler>
        <Profiler id="chart" onRender={count('chart')}>
          <div style={{ height: 240 }}>
            <BarChart title="Revenue" data={data} x="quarter" series={series} />
          </div>
        </Profiler>
      </div>,
    )
    await rendered(plot('Revenue'))
    await quiet()
    commits.table = 0
    commits.chart = 0

    for (const stage of ['black', 'mid', 'dark'] as const) {
      await inAct(() => theme.setViewerStage(stage))
      expect(theme.viewerStage).toBe(stage)
      await frames(2)
    }
    expect(commits).toEqual({ table: 0, chart: 0 })

    await inAct(() => theme.setDensity('compact'))
    expect(theme.density).toBe('compact')
    expect(commits.table).toBeGreaterThan(0)
  })
})
