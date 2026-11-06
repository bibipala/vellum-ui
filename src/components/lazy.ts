/**
 * 按需加载的模块（组件库内部，不从入口导出）：第一次用到时才 `import()`，使用方的打包工具把它拆成单独的分块，
 * 没有用到这个组件的应用不包含它的代码。图表引擎（ECharts）与 Markdown 渲染器用它加载。
 *
 * - 只加载一次，结果缓存；正在加载时共用同一个 Promise；失败后再次调用会重新加载；
 * - 组件用 useLazy 读取：服务端渲染与注水的第一次渲染总是「还没有加载」（useSyncExternalStore 的服务端快照），
 *   两边输出一致，没有注水不一致；之后已经加载过的模块直接可用，不再经过「加载中」。
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

/** 一个按需加载的模块。 */
export interface Lazy<T> {
  /** 已加载的值；还没有加载完成时为 null。 */
  readonly current: () => T | null
  /** 开始加载（只加载一次；失败后再次调用会重新加载）。 */
  readonly load: () => Promise<T>
  /** 加载完成时通知（useSyncExternalStore 的 subscribe）。 */
  readonly subscribe: (onChange: () => void) => () => void
}

/** 由加载函数（通常是 `() => import('./x.ts')`）创建按需加载的模块。在模块顶层创建，引用保持不变。 */
export function lazy<T>(loader: () => Promise<T>): Lazy<T> {
  let value: T | null = null
  let promise: Promise<T> | null = null
  const listeners = new Set<() => void>()
  return {
    current: () => value,
    load() {
      if (value !== null) return Promise.resolve(value)
      promise ??= loader().then(
        (v) => {
          value = v
          for (const notify of listeners) notify()
          return v
        },
        (error: unknown) => {
          promise = null
          throw error
        },
      )
      return promise
    },
    subscribe(onChange) {
      listeners.add(onChange)
      return () => {
        listeners.delete(onChange)
      }
    },
  }
}

const serverSnapshot = () => null

/** useLazy 的结果。 */
export interface LazyState<T> {
  /** 已加载的值；还没有加载完成（含服务端渲染与注水的第一次渲染）时为 null。 */
  readonly value: T | null
  /** 加载失败（原因已输出到控制台）。 */
  readonly failed: boolean
  /** 重新加载。 */
  readonly retry: () => void
}

/**
 * 读取按需加载的模块，没有加载时在 effect 中开始加载。
 * @param module - 模块顶层用 `lazy()` 创建的模块。
 * @param what - 写进控制台错误信息的名称，如 `'the chart engine'`。
 */
export function useLazy<T>(module: Lazy<T>, what: string): LazyState<T> {
  const value = useSyncExternalStore(module.subscribe, module.current, serverSnapshot)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt 是重试的触发条件
  useEffect(() => {
    if (value !== null) return
    let alive = true
    module.load().catch((error: unknown) => {
      // 不吞掉：使用方在控制台看到原因（多为网络或部署问题），组件显示自己的兜底内容
      console.error(`[vellum-ui] Failed to load ${what}.`, error)
      if (alive) setFailed(true)
    })
    return () => {
      alive = false
    }
  }, [module, value, what, attempt])
  const retry = useCallback(() => {
    setFailed(false)
    setAttempt((n) => n + 1)
  }, [])
  return { value, failed, retry }
}
