/**
 * 图表引擎的封装（组件库内部，不从入口导出）：ECharts 只作为内部实现，使用方看不到它的类型与选项。
 *
 * - 第一次渲染图表时才加载（lazy.ts）：ECharts 的核心与 SVG 渲染器（engine-core.ts）只在这里用 `import()` 加载一次，
 *   每种图表再用 `import()` 加载自己需要的图表类型与组件（engine-line.ts 等，`load` 属性），加载后 `use()`。
 *   只引入 Button 等组件的应用不包含 ECharts 的代码；用到图表的应用由打包工具把 ECharts 拆成单独的分块。
 *   本目录的其他文件只能从 echarts 导入类型（编译后去掉），不能静态导入它的代码；
 * - 引擎就绪之前：图形区域已经是最终的尺寸（不跳），超过 200ms 才显示加载指示（与图表的首次加载相同）；标题、图例、
 *   视图切换与表格视图是 DOM，不等引擎。服务端与注水的第一次渲染都按「引擎未就绪」输出，两边一致；
 *   加载失败时在图形区域显示错误状态与「重试」；
 * - 实例只在 effect 中创建（元素出现、有了尺寸、引擎就绪之后），卸载或元素被替换时 dispose；
 * - 宽度随容器（ResizeObserver）；配色与动画时长在主题、明暗切换（ThemeProvider 的 cssVars）与「减少动态效果」
 *   变化后立即重新读取并应用，不等下一次数据更新；
 * - 键盘：图形区域可聚焦，方向键在数据之间移动并显示与悬停相同的提示（ECharts 的 showTip / highlight），
 *   Esc 关闭提示；读屏通过礼貌播报区读出当前项。
 */
import type { EChartsCoreOption, EChartsType } from 'echarts/core'
import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { useOptionalTheme } from '../../theme/ThemeProvider.tsx'
import { ErrorState, Loading } from '../feedback.tsx'
import { type Lazy, lazy, useLazy } from '../lazy.ts'
import { useDelayedPending } from '../useDelayedPending.ts'
import { useReducedMotion } from '../useReducedMotion.ts'
import hidden from '../visually-hidden.module.css'
import { type ChartPalette, readPalette } from './palette.ts'
import styles from './plot.module.css'

/** 引擎的核心（`init`、`use` 与 SVG 渲染器）。只用类型，代码由 `import()` 加载。 */
type EngineCore = typeof import('./engine-core.ts')

/** `use()` 接受的一个模块（图表类型、组件）。 */
export type ChartModule = Exclude<Parameters<EngineCore['use']>[0], readonly unknown[]>

/**
 * 加载一种图表需要的 ECharts 模块：每个图表在模块顶层定义一个常量，如 `() => import('./engine-line.ts')`
 * （引用不变，加载结果按它缓存）。
 */
export type ChartLoader = () => Promise<{ readonly modules: readonly ChartModule[] }>

/** 核心：加载后注册 SVG 渲染器。所有图表共用。 */
const core = lazy(() =>
  import('./engine-core.ts').then((c) => {
    c.use(c.SVGRenderer)
    return c
  }),
)

/** 每种图表的引擎（核心 + 这种图表的模块，模块已经 `use()`），按加载函数缓存。 */
const engines = new Map<ChartLoader, Lazy<EngineCore>>()

function engineFor(load: ChartLoader): Lazy<EngineCore> {
  let engine = engines.get(load)
  if (!engine) {
    engine = lazy(() =>
      Promise.all([core.load(), load()]).then(([c, { modules }]) => {
        c.use([...modules])
        return c
      }),
    )
    engines.set(load, engine)
  }
  return engine
}

/** 生成选项时的环境：配色与图形区域的尺寸。 */
export interface PlotEnv {
  readonly palette: ChartPalette
  readonly width: number
  readonly height: number
}

/** 键盘或指针指向的一个数据项。 */
export interface NavTarget {
  readonly seriesIndex: number
  readonly dataIndex: number
  /** 由这里高亮图形（柱、扇区、点、格子）；折线图的数据点由坐标轴提示自己高亮。 */
  readonly highlight: boolean
  /** 读屏播报的文字（与提示的内容相同）。 */
  readonly text: string
}

/** 键盘浏览的模型：列 × 行的网格；一维的图形只有一行。 */
export interface ChartNav {
  readonly cols: number
  readonly rows: number
  /** 在列之间、行之间移动的按键（如柱状图横向时上下键在类别之间移动）。 */
  readonly keys: {
    readonly colNext: string
    readonly colPrev: string
    readonly rowNext?: string
    readonly rowPrev?: string
  }
  /** 某一格的数据项；没有数据时为 null（移动时跳过）。 */
  readonly target: (col: number, row: number) => NavTarget | null
}

/** 图形区域的属性。 */
export interface ChartPlotProps {
  /** 加载这种图表需要的 ECharts 模块（模块顶层的常量，见 ChartLoader）。 */
  readonly load: ChartLoader
  /** 生成 ECharts 选项（纯函数；引用变化时重新生成）。 */
  readonly build: (env: PlotEnv) => EChartsCoreOption
  readonly nav: ChartNav
  /** 读屏名称（图表标题）。 */
  readonly label: string
  /** 读屏读出的角色说明（如「折线图」）。 */
  readonly kind: string
  /** 键盘操作说明（读屏通过 aria-describedby 读出）。 */
  readonly hint: string
  /**
   * 指针最近的数据项（散点图：点很小，按最近点命中，而不是要求指针正好落在点上）。
   * 提供时由这里根据指针位置显示提示，ECharts 自己的悬停触发应关闭。
   */
  readonly nearest?: (chart: EChartsType, x: number, y: number) => NavTarget | null
}

interface Size {
  readonly width: number
  readonly height: number
}

type Pos = { col: number; row: number }

/** 在网格中从 start 出发沿 (dc, dr) 找第一个有数据的格子。 */
function seek(nav: ChartNav, start: Pos, dc: number, dr: number): Pos | null {
  let { col, row } = start
  while (col >= 0 && col < nav.cols && row >= 0 && row < nav.rows) {
    if (nav.target(col, row)) return { col, row }
    if (dc === 0 && dr === 0) return null
    col += dc
    row += dr
  }
  return null
}

/** 图形区域：ECharts 实例的宿主。 */
export function ChartPlot(props: ChartPlotProps) {
  const theme = useOptionalTheme()
  const hintId = useId()
  const [el, setEl] = useState<HTMLDivElement | null>(null)
  const [size, setSize] = useState<Size | null>(null)
  const [palette, setPalette] = useState<ChartPalette | null>(null)
  const [chart, setChart] = useState<EChartsType | null>(null)
  const chartRef = useRef<EChartsType | null>(null)
  const [announce, setAnnounce] = useState('')
  const pos = useRef<Pos | null>(null)
  const shown = useRef<NavTarget | null>(null)
  const applied = useRef<{
    size: Size
    build: ChartPlotProps['build']
    palette: ChartPalette
  } | null>(null)
  const ready = size !== null && size.width > 0 && size.height > 0

  // 尺寸：容器变宽变窄时重绘
  useLayoutEffect(() => {
    if (!el) return
    const measure = () => {
      const width = Math.round(el.clientWidth)
      const height = Math.round(el.clientHeight)
      setSize((s) => (s && s.width === width && s.height === height ? s : { width, height }))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [el])

  // 配色：主题、明暗切换后重新读取。网页字体加载完成后也重新读取一次：ECharts 按当时的字体测量坐标轴文字的宽度，
  // 用后备字体测得的宽度偏窄，最长的类别名会被裁掉几个像素
  const cssVars = theme?.cssVars
  const [fontsLoaded, setFontsLoaded] = useState(0)
  useEffect(() => {
    const fonts = typeof document === 'undefined' ? undefined : document.fonts
    if (!fonts || fonts.status === 'loaded') return
    let alive = true
    fonts.ready.then(() => {
      if (alive) setFontsLoaded((n) => n + 1)
    })
    return () => {
      alive = false
    }
  }, [])
  // 「减少动态效果」（系统设置或应用内开关）变化时也重新读取：动画时长来自动效令牌，设置打开时令牌归零。
  // 只在下一次数据更新时才读取的话，打开设置后图表还会继续播放动画
  const reducedMotion = useReducedMotion()
  // biome-ignore lint/correctness/useExhaustiveDependencies: cssVars、fontsLoaded、reducedMotion 是触发条件，配色从 DOM 读取
  useLayoutEffect(() => {
    if (el) setPalette(readPalette(el))
  }, [el, cssVars, fontsLoaded, reducedMotion])

  // 引擎：第一次渲染时开始加载。加载超过 200ms 才显示加载指示，显示后至少保持 400ms（useDelayedPending）；
  // 指示消失之后才创建实例，入场动画不会在指示下面播放
  const { value: engine, failed, retry } = useLazy(engineFor(props.load), 'the chart engine')
  const waiting = engine === null && !failed
  const showWaiting = useDelayedPending(waiting)
  const usable = engine !== null && !showWaiting

  // 实例：元素出现、有了尺寸、引擎就绪之后创建，卸载时释放（尺寸变化只 resize，不重建实例）
  useEffect(() => {
    if (!el || !ready || !usable || !engine) return
    const instance = engine.init(el, null, { renderer: 'svg' })
    instance.on('finished', () => {
      el.dataset.rendered = 'true'
    })
    chartRef.current = instance
    setChart(instance)
    return () => {
      instance.dispose()
      chartRef.current = null
      applied.current = null
      pos.current = null
      shown.current = null
      delete el.dataset.rendered
      setChart(null)
    }
  }, [el, ready, usable, engine])

  // 选项：数据、配色、尺寸变化时更新。只有尺寸变化时不做过渡动画（拖动改变宽度时图形直接跟随）
  const { build } = props
  const navRef = useRef(props.nav)
  navRef.current = props.nav
  // biome-ignore lint/correctness/useExhaustiveDependencies: show 只读 ref，不随渲染变化
  useEffect(() => {
    if (!chart || !palette || !size || !ready) return
    const last = applied.current
    const resized = !last || last.size.width !== size.width || last.size.height !== size.height
    if (last && resized) chart.resize({ width: size.width, height: size.height })
    const option = build({ palette, width: size.width, height: size.height })
    const sizeOnly = last !== null && resized && last.build === build && last.palette === palette
    // data-rendered 表示「当前的选项已经画完」（ECharts 的 finished：动画结束、没有待渲染的内容）
    if (el) delete el.dataset.rendered
    chart.setOption(sizeOnly ? { ...option, animationDurationUpdate: 0 } : option, {
      replaceMerge: ['series'],
    })
    applied.current = { size, build, palette }
    // 数据变化后，键盘指向的项可能已经不存在：重新显示当前位置（或关闭提示）
    if (shown.current && pos.current) {
      const target = navRef.current.target(pos.current.col, pos.current.row)
      shown.current = null
      if (target) show(target)
      else {
        chart.dispatchAction({ type: 'hideTip' })
        setAnnounce('')
      }
    }
  }, [chart, palette, size, ready, build, el])

  const show = (target: NavTarget | null) => {
    const instance = chartRef.current
    if (!instance) return
    const prev = shown.current
    if (prev?.highlight)
      instance.dispatchAction({
        type: 'downplay',
        seriesIndex: prev.seriesIndex,
        dataIndex: prev.dataIndex,
      })
    shown.current = target
    if (!target) {
      instance.dispatchAction({ type: 'hideTip' })
      return
    }
    if (target.highlight)
      instance.dispatchAction({
        type: 'highlight',
        seriesIndex: target.seriesIndex,
        dataIndex: target.dataIndex,
      })
    instance.dispatchAction({
      type: 'showTip',
      seriesIndex: target.seriesIndex,
      dataIndex: target.dataIndex,
    })
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const { nav } = props
    const { keys } = nav
    if (e.key === 'Escape') {
      // 只在确实有提示时拦截：没有提示时 Esc 照常交给外层（如关闭对话框）
      if (!shown.current) return
      e.preventDefault()
      e.stopPropagation()
      show(null)
      setAnnounce('')
      return
    }
    const p = pos.current
    const last = nav.cols - 1
    let next: Pos | null = null
    if (e.key === keys.colNext)
      next = p
        ? seek(nav, { col: p.col + 1, row: p.row }, 1, 0)
        : seek(nav, { col: 0, row: 0 }, 1, 0)
    else if (e.key === keys.colPrev)
      next = p
        ? seek(nav, { col: p.col - 1, row: p.row }, -1, 0)
        : seek(nav, { col: last, row: 0 }, -1, 0)
    else if (keys.rowNext && e.key === keys.rowNext)
      next = p
        ? seek(nav, { col: p.col, row: p.row + 1 }, 0, 1)
        : seek(nav, { col: 0, row: 0 }, 1, 0)
    else if (keys.rowPrev && e.key === keys.rowPrev)
      next = p
        ? seek(nav, { col: p.col, row: p.row - 1 }, 0, -1)
        : seek(nav, { col: 0, row: nav.rows - 1 }, 1, 0)
    else if (e.key === 'Home') next = seek(nav, { col: 0, row: p?.row ?? 0 }, 1, 0)
    else if (e.key === 'End') next = seek(nav, { col: last, row: p?.row ?? 0 }, -1, 0)
    else return
    e.preventDefault()
    // 已在边缘：停在原处，重新显示当前项（提示被 Esc 关闭后再按方向键也会回来）
    const at = next ?? p
    if (!at) return
    const target = nav.target(at.col, at.row)
    if (!target) return
    pos.current = at
    show(target)
    setAnnounce(target.text)
  }

  const { nearest } = props
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!chart) return
    if (!nearest) {
      // 指针接管：键盘高亮的图形恢复原样，提示交给 ECharts 的悬停
      const prev = shown.current
      if (prev?.highlight)
        chart.dispatchAction({
          type: 'downplay',
          seriesIndex: prev.seriesIndex,
          dataIndex: prev.dataIndex,
        })
      shown.current = null
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    const target = nearest(chart, e.clientX - rect.left, e.clientY - rect.top)
    const prev = shown.current
    if (
      target?.seriesIndex === prev?.seriesIndex &&
      target?.dataIndex === prev?.dataIndex &&
      Boolean(target) === Boolean(prev)
    )
      return
    show(target)
  }
  const onPointerLeave = () => {
    if (nearest && shown.current) show(null)
  }
  const onBlur = () => {
    if (shown.current) show(null)
    setAnnounce('')
  }

  if (failed)
    return (
      <div className={styles.wrap}>
        <ErrorState size="sm" fill onRetry={retry} />
      </div>
    )
  return (
    <div className={styles.wrap}>
      <div
        ref={setEl}
        className={styles.plot}
        role="application"
        aria-roledescription={props.kind}
        aria-label={props.label}
        aria-describedby={hintId}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: role="application" 的图形区域用方向键浏览，必须能聚焦；没有对应的原生元素
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        onBlur={onBlur}
      />
      <span id={hintId} className={hidden.hidden}>
        {props.hint}
      </span>
      <span className={hidden.hidden} aria-live="polite">
        {announce}
      </span>
      {(waiting || showWaiting) && (
        <div className={styles.pending}>
          <Loading fill />
        </div>
      )}
    </div>
  )
}
