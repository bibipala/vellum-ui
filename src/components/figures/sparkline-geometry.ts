/**
 * 迷你图的几何：把一列数值换算成 SVG 路径（视图坐标 0–100 × 0–100，SVG 用 `preserveAspectRatio="none"` 拉伸到
 * 容器大小，线宽用 `vector-effect: non-scaling-stroke` 保持 2px）。纯函数，不访问 DOM，服务端可用。
 *
 * - 横向按位置均分：第 i 个值在 i / (n - 1)，空值也占位置，所以缺数据的地方断开、末尾缺数据时线提前结束；
 * - 纵向按非空值的最小、最大值拉满；所有值相同时画在中线；
 * - null、NaN、±Infinity 都是空值，在那里断开；前后都是空值的孤立值没有线可画，单独列出，由组件画成小圆点
 *   （零长度线段配圆头线帽在 `non-scaling-stroke` 下会被浏览器画得比线宽还小，所以不用它）。
 */

/** 视图坐标的范围（横纵都是 0–100）。 */
export const SPARK_VIEW = 100

/** 迷你图的几何与摘要。 */
export interface SparklineGeometry {
  /** 折线路径（每段至少两个连续的非空值一条子路径）；没有时为空字符串。 */
  readonly line: string
  /** 面积路径（每段至少两个点的连续值，从线围到底边）；没有时为空字符串。 */
  readonly area: string
  /** 前后都是空值的孤立值的位置（视图坐标），画成小圆点。 */
  readonly isolated: readonly { readonly x: number; readonly y: number }[]
  /** 最后一个非空值的位置（视图坐标），用于末端圆点；没有非空值时为 null。 */
  readonly end: { readonly x: number; readonly y: number } | null
  /** 非空值的个数。 */
  readonly count: number
  /** 第一个与最后一个非空值、最小值与最大值；没有非空值时为 null。 */
  readonly summary: {
    readonly start: number
    readonly end: number
    readonly min: number
    readonly max: number
  } | null
}

const isValue = (v: number | null | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v)

/** 保留两位小数，路径字符串短一些，也避免浮点误差让测试与快照不稳定。 */
const r2 = (n: number) => Math.round(n * 100) / 100

/** 计算迷你图的路径、末端位置与摘要。 */
export function sparklineGeometry(data: readonly (number | null)[]): SparklineGeometry {
  const n = data.length
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  let start: number | null = null
  let last: number | null = null
  let count = 0
  for (const v of data) {
    if (!isValue(v)) continue
    if (start === null) start = v
    last = v
    count++
    if (v < min) min = v
    if (v > max) max = v
  }
  if (count === 0 || start === null || last === null)
    return { line: '', area: '', isolated: [], end: null, count: 0, summary: null }

  // 只有一个位置时放在右端：它就是「当前值」
  const x = (i: number) => r2(n === 1 ? SPARK_VIEW : (i / (n - 1)) * SPARK_VIEW)
  const y = (v: number) =>
    r2(max === min ? SPARK_VIEW / 2 : (1 - (v - min) / (max - min)) * SPARK_VIEW)

  const line: string[] = []
  const area: string[] = []
  const isolated: { x: number; y: number }[] = []
  let run: { x: number; y: number }[] = []
  let end: { x: number; y: number } | null = null
  const flush = () => {
    const first = run[0]
    const tail = run[run.length - 1]
    if (!first || !tail) return
    if (run.length === 1) isolated.push(first)
    else {
      line.push(`M${run.map((p) => `${p.x} ${p.y}`).join('L')}`)
      area.push(
        `M${first.x} ${SPARK_VIEW}L${run.map((p) => `${p.x} ${p.y}`).join('L')}L${tail.x} ${SPARK_VIEW}Z`,
      )
    }
    run = []
  }
  data.forEach((v, i) => {
    if (!isValue(v)) flush()
    else run.push({ x: x(i), y: y(v) })
  })
  // 末端圆点画在最后一个非空值上
  for (let i = n - 1; i >= 0; i--) {
    const v = data[i]
    if (isValue(v)) {
      end = { x: x(i), y: y(v) }
      break
    }
  }
  flush()
  return {
    line: line.join(''),
    area: area.join(''),
    isolated,
    end,
    count,
    summary: { start, end: last, min, max },
  }
}
