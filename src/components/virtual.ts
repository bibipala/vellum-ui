/**
 * 虚拟滚动的公共部分（VirtualList、MessageList、ImageGrid、DataTable 共用；组件库内部使用，不从入口导出）。
 *
 * - 取键函数：虚拟化库把取键函数（getItemKey）的身份当作重新计算全部位置的条件。使用方的 getKey 常是内联函数，
 *   如果直接包一层传过去，滚动引起的每次渲染都要为全部项重新取键、重新计算位置。这里只在数据变化时换新。
 * - 保留焦点所在的项：它滚出可见区域时也保持挂载，否则元素被卸载，焦点落到 body 上，键盘用户失去位置。
 * - 按键查找位置：每份数据最多建立一次键到位置的表，在第一次查找时才建立。
 */
import { defaultRangeExtractor, type Range } from '@tanstack/react-virtual'
import { type FocusEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'

/** 项的键（与虚拟化库的键相同）。 */
export type ItemKey = string | number

/**
 * 虚拟化库的取键函数：数据（items）不变时身份不变；数据变化（插入、删除、重新排序）时换新，虚拟化库随之重新取键。
 * getKey 每次渲染可以是新的函数，通过 ref 读取最新的一个。只换 getKey、数据不变时不重新取键：同一份数据的键应当不变。
 */
export function useItemKey<T>(
  items: readonly T[],
  getKey: (item: T, index: number) => ItemKey,
): (index: number) => ItemKey {
  const latest = useRef(getKey)
  latest.current = getKey
  return useCallback(
    (index: number) => {
      const item = items[index]
      return item === undefined ? index : latest.current(item, index)
    },
    [items],
  )
}

/**
 * 按键查找项在 items 中的位置（没有时为 -1）：每份数据（items）最多建立一次键到位置的表，并且在第一次查找时才建立，
 * 只滚动、不查找时没有开销。getKey 通过 ref 读取最新的一个：同一份数据的键应当不变。同一个键出现多次时取第一个
 * （与 findIndex 相同）。
 */
export function useKeyIndex<T>(
  items: readonly T[],
  getKey: (item: T, index: number) => ItemKey,
): (key: ItemKey) => number {
  const latest = useRef(getKey)
  latest.current = getKey
  return useMemo(() => {
    let table: Map<ItemKey, number> | null = null
    return (key: ItemKey) => {
      if (table === null) {
        const built = new Map<ItemKey, number>()
        items.forEach((item, i) => {
          const k = latest.current(item, i)
          if (!built.has(k)) built.set(k, i)
        })
        table = built
      }
      return table.get(key) ?? -1
    }
  }, [items])
}

/** 焦点所在的项：键，以及焦点进入时它的位置（数据没有变化时直接用这个位置，不必查找）。 */
interface Focused {
  readonly key: ItemKey
  readonly index: number
}

/** useRetainedFocus 的结果。 */
export interface RetainedFocus {
  /** 焦点所在的项在 items 中的位置；焦点不在任何一项中，或者这一项已经不在 items 中时为 -1。 */
  readonly index: number
  /** 焦点所在项的键；没有时为 null。 */
  readonly key: ItemKey | null
  /** 焦点进入第 index 项时调用（-1：焦点在容器中，但不在任何一项中）。 */
  readonly enter: (index: number) => void
  /** 容器的 onBlur：焦点移出容器（或窗口失去焦点）时不再保留。 */
  readonly onBlur: (event: FocusEvent<Element>) => void
}

/**
 * 记下焦点所在的项（按键，数据变化后仍能找到它）。容器的 onFocus 中找到焦点所在的项并调用 `enter`，onBlur 用返回的
 * `onBlur`；`index` 交给 useRetainedRange（按行虚拟化的网格先换算成所在的行）。
 *
 * 按键查找的结果按数据缓存：滚动引起的渲染不重新查找；数据变化时先看原来的位置，没有移动就不遍历。
 * 已经有按键查找的函数（useKeyIndex）时传入 `indexOf`，与其他查找共用同一张表，不再单独遍历。
 * 焦点所在的项被删除后不再保留，以后同一个键再出现时也不特殊对待。
 */
export function useRetainedFocus<T>(
  items: readonly T[],
  getKey: (item: T, index: number) => ItemKey,
  indexOf?: (key: ItemKey) => number,
): RetainedFocus {
  const latest = useRef(getKey)
  latest.current = getKey
  const [focused, setFocused] = useState<Focused | null>(null)
  const index = useMemo(() => {
    if (focused === null) return -1
    const keyOf = latest.current
    const at = items[focused.index]
    if (at !== undefined && keyOf(at, focused.index) === focused.key) return focused.index
    return indexOf
      ? indexOf(focused.key)
      : items.findIndex((item, i) => keyOf(item, i) === focused.key)
  }, [items, focused, indexOf])
  useEffect(() => {
    if (focused !== null && index < 0) setFocused(null)
  }, [focused, index])
  return {
    index,
    key: index < 0 ? null : (focused?.key ?? null),
    enter: (i) => {
      const item = i < 0 ? undefined : items[i]
      const next = item === undefined ? null : { key: latest.current(item, i), index: i }
      setFocused((prev) =>
        prev === next || (prev && next && prev.key === next.key && prev.index === next.index)
          ? prev
          : next,
      )
    },
    onBlur: (event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(null)
    },
  }
}

/**
 * 虚拟化库的 rangeExtractor：默认的渲染范围（可见区域加上预渲染），再加上第 keep 项（-1：不保留）。
 * 渲染的项因此可能不连续，各项按自己的位置摆放（绝对定位，或者像 DataTable 那样用占位行撑开空隙）。
 */
export function useRetainedRange(keep: number): (range: Range) => number[] {
  return useCallback(
    (range: Range) => {
      const indexes = defaultRangeExtractor(range)
      if (keep < 0 || keep >= range.count || indexes.includes(keep)) return indexes
      return [...indexes, keep].sort((a, b) => a - b)
    },
    [keep],
  )
}
