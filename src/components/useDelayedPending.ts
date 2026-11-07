/**
 * 加载态防闪：很快完成的加载不显示加载态，稍慢的加载也不会让骨架一闪而过。
 */
import { useEffect, useState } from 'react'

/**
 * Options of useDelayedPending.
 * @zh useDelayedPending 的选项。
 */
export interface DelayedPendingOptions {
  /**
   * Milliseconds the loading must last before the loading state is shown.
   * @zh 加载持续超过多少毫秒才显示加载态。
   * @default 200
   */
  readonly delay?: number
  /**
   * Minimum milliseconds the loading state stays shown once it has appeared, even if the loading has ended.
   * @zh 加载态一旦显示，至少保持多少毫秒，即使加载已经结束。
   * @default 400
   */
  readonly minDuration?: number
}

/** 默认取值，与 Loading、PageSkeleton 的样式延迟（令牌 `motion-delay-loading`）一致。 */
export const DELAYED_PENDING_DEFAULTS = { delay: 200, minDuration: 400 } as const

/** 防闪状态机：与 React 无关，便于用假定时器测试。组件库内部使用，不从入口导出。 */
export interface DelayedPendingMachine {
  /** 加载状态或选项变化时调用。 */
  update(pending: boolean, delay: number, minDuration: number): void
  /** 清除未到期的定时器（组件卸载时）。 */
  dispose(): void
}

/** 创建防闪状态机；是否显示加载态变化时调用 `onChange`。 */
export function createDelayedPending(onChange: (show: boolean) => void): DelayedPendingMachine {
  let shownAt: number | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  const clear = () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
  }
  return {
    update(pending, delay, minDuration) {
      clear()
      if (pending) {
        // 已在显示（含最短显示期内又开始加载）：保持显示，不重新计时
        if (shownAt === undefined)
          timer = setTimeout(() => {
            timer = undefined
            shownAt = Date.now()
            onChange(true)
          }, delay)
        return
      }
      if (shownAt === undefined) return
      const hide = () => {
        timer = undefined
        shownAt = undefined
        onChange(false)
      }
      const rest = shownAt + minDuration - Date.now()
      if (rest <= 0) hide()
      else timer = setTimeout(hide, rest)
    },
    dispose: clear,
  }
}

/**
 * Delayed appearance of loading states: returns whether a loading state (a skeleton, a loading indicator) should be
 * shown now. It becomes `true` only after `pending` has lasted `delay` (200 ms by default), and once `true` it stays
 * so for at least `minDuration` (400 ms by default), even if `pending` has already ended. Fast loads therefore show
 * no loading state at all, and slower ones do not make a skeleton flash.
 *
 * `pending` is whether something is loading, such as `query.isPending` or `query.isFetching`; `opts` sets `delay`
 * and `minDuration` in milliseconds. For a first load, also include `pending` in the condition,
 * `if (query.isPending || showSkeleton) return <PageSkeleton />`: the skeleton mounts as soon as loading starts, its
 * own 200 ms delayed fade-in hides fast loads, and this hook keeps it for at least 400 ms. When refreshing keeps the old data and only shows an indicator over it, mount the indicator
 * only while this hook returns `true`, and give Loading `immediate` so that it is not delayed twice.
 * @zh 加载态防闪：返回此刻是否应该显示加载态（骨架屏、加载指示）。`pending` 持续超过 `delay`（默认 200ms）才变为
 * `true`；一旦变为 `true`，至少保持 `minDuration`（默认 400ms），即使 `pending` 已经结束。这样很快完成的加载不显示
 * 加载态，稍慢的加载也不会让骨架一闪而过。
 *
 * `pending` 是是否在加载，如 `query.isPending`、`query.isFetching`；`opts` 设置 `delay` 与 `minDuration`（毫秒）。
 * 首次加载时把 `pending` 也放进条件，即 `if (query.isPending || showSkeleton) return <PageSkeleton />`：骨架在加载
 * 开始时就挂载，它自带的 200ms 延迟淡入让很快的加载看不到它，本 hook 负责至少显示 400ms。刷新时保留旧数据、只在上面叠加载指示的场景，指示只在本 hook 返回 `true` 时挂载，
 * 这时给 Loading 传 `immediate`，避免再延迟一次。
 * @group Utilities
 * @param pending - Whether something is loading, such as `query.isPending` or `query.isFetching`.
 * @param opts - The delay and the minimum duration, in milliseconds.
 * @returns Whether the loading state should be shown.
 * @example
 * ```tsx
 * const showSkeleton = useDelayedPending(query.isPending)
 * if (query.isPending || showSkeleton) return <PageSkeleton />
 * ```
 */
export function useDelayedPending(pending: boolean, opts: DelayedPendingOptions = {}): boolean {
  const delay = opts.delay ?? DELAYED_PENDING_DEFAULTS.delay
  const minDuration = opts.minDuration ?? DELAYED_PENDING_DEFAULTS.minDuration
  const [show, setShow] = useState(false)
  const [machine] = useState(() => createDelayedPending(setShow))
  useEffect(() => {
    machine.update(pending, delay, minDuration)
  }, [machine, pending, delay, minDuration])
  useEffect(() => () => machine.dispose(), [machine])
  return show
}
