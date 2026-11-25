/** 性能测试共用的观察器；调用方用 finally 停止，失败时也不泄漏采样。 */
import { afterPaint } from '../render.tsx'

export function longTasks() {
  const durations: number[] = []
  const at: number[] = []
  const origin = performance.now()
  const record = (entries: readonly PerformanceEntry[]) => {
    for (const entry of entries) {
      durations.push(Math.round(entry.duration))
      at.push(Math.round(entry.startTime - origin))
    }
  }
  const observer = new PerformanceObserver((list) => record(list.getEntries()))
  observer.observe({ type: 'longtask' })
  return {
    durations,
    at,
    stop: async () => {
      try {
        await afterPaint()
      } finally {
        record(observer.takeRecords())
        observer.disconnect()
      }
    },
  }
}

/** 连续记录真实帧间隔，停止时取消已经排队的回调。 */
export function frameIntervals() {
  const intervals: number[] = []
  let last: number | undefined
  let pending: number
  const onFrame = (now: number) => {
    if (last !== undefined) intervals.push(now - last)
    last = now
    pending = requestAnimationFrame(onFrame)
  }
  pending = requestAnimationFrame(onFrame)
  return { intervals, stop: () => cancelAnimationFrame(pending) }
}
