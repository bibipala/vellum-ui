import { type Ref, type RefCallback, useCallback, useImperativeHandle, useRef } from 'react'

/** 合并引用：React 19 的回调清理函数优先；没有清理函数的回调与对象引用在卸载时置空。 */
export function composeRefs<T>(...refs: (Ref<T> | undefined)[]): RefCallback<T> {
  return (value) => {
    const cleanups = refs.map((ref) => {
      if (typeof ref === 'function') return ref(value)
      if (ref) ref.current = value
      return undefined
    })
    if (value === null) return
    return () => {
      refs.forEach((ref, i) => {
        const cleanup = cleanups[i]
        if (typeof cleanup === 'function') cleanup()
        else if (typeof ref === 'function') ref(null)
        else if (ref) ref.current = null
      })
    }
  }
}

/** Checkbox、Radio 的内部句柄只用于取出原生 input，不把依赖的句柄暴露给使用方。 */
export function useInputRef(ref: Ref<HTMLInputElement> | undefined) {
  const handle = useRef<{ input: HTMLInputElement | null }>(null)
  // 不让 antd 合并使用方的回调引用：它会丢弃 React 19 的清理函数，还可能保留更换前的回调。
  useImperativeHandle<HTMLInputElement | null, HTMLInputElement | null>(
    ref,
    () => handle.current?.input ?? null,
    [],
  )
  return useCallback((value: { input: HTMLInputElement | null } | null) => {
    handle.current = value
  }, [])
}
