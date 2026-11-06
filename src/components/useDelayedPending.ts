/**
 * 加载态防闪：很快完成的加载不显示加载态，稍慢的加载也不会让骨架一闪而过。
 */
import { useEffect, useState } from 'react'

/** useDelayedPending 的选项。 */
export interface DelayedPendingOptions {
  /** 加载持续超过多少毫秒才显示加载态。默认 200。 */
  readonly delay?: number
  /** 加载态一旦显示，至少保持多少毫秒。默认 400。 */
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
 * 加载态防闪：返回此刻是否应该显示加载态（骨架屏、加载指示）。
 * `pending` 持续超过 `delay`（默认 200ms）才变为 true；一旦变为 true，至少保持 `minDuration`（默认 400ms），
 * 即使 `pending` 已经结束。这样很快完成的加载不显示加载态，稍慢的加载也不会让骨架一闪而过。
 *
 * 首次加载时把 `pending` 也放进条件：骨架在加载开始时就挂载，它自带的 200ms 延迟淡入与本 hook 同时生效，
 * 本 hook 负责「至少显示 400ms」。刷新时保留旧数据、只在上面叠加载指示的场景，指示只在本 hook 为 true 时挂载，
 * 这时给 Loading 传 `immediate`，避免再延迟一次。
 *
 * @param pending - 是否在加载，如 `query.isPending`、`query.isFetching`。
 * @param opts - 延迟与最短显示时长（毫秒）。
 * @returns 是否应该显示加载态。
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
