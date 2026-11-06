/**
 * 列宽手柄（DataTable 内部）：表头单元格结尾边缘的分隔条（WAI-ARIA 的 Window Splitter 模式，与 Splitter 一致）。
 * - 拖动用指针事件与指针捕获，拖出表头也照常跟随；
 * - 可以用 Tab 聚焦：`←` / `→` 按 16px 调整，按住 `Shift` 为 64px；`Enter` 或双击恢复默认宽度；
 * - 从右到左的页面中，向左拖动与 `←` 是加宽（手柄在单元格的左边）。
 */
import { type KeyboardEvent, type PointerEvent, useRef, useState } from 'react'
import styles from './data-table.module.css'

/** 每按一次方向键调整的像素；按住 Shift 时为 4 倍。 */
export const RESIZE_STEP = 16

export interface ResizeHandleProps {
  /** 读屏名称（如「调整“名称”的列宽」）。 */
  readonly label: string
  /** 当前宽度；弹性列还没有测量时为 null（不输出 aria-valuenow）。 */
  readonly width: number | null
  readonly min: number
  readonly max: number
  /** 开始调整：返回调整的起点（弹性列在这时按实际宽度定下来）。 */
  readonly onStart: () => number
  /** 新的宽度（由调用方限制在范围内）。 */
  readonly onChange: (width: number) => void
  /** 一次调整结束（松开指针、按键之后）：保存。 */
  readonly onCommit: () => void
  /** 恢复默认宽度。 */
  readonly onReset: () => void
  /** 拖动开始与结束（表格据此显示调整列宽的光标、不选中文字）。 */
  readonly onDragChange: (dragging: boolean) => void
}

const isRtl = (el: Element) => getComputedStyle(el).direction === 'rtl'

export function ResizeHandle(props: ResizeHandleProps) {
  const [dragging, setDragging] = useState(false)
  const drag = useRef<{ pointer: number; from: number; size: number; sign: number } | null>(null)

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    // 不阻止默认操作：按下照常把焦点给手柄（鼠标聚焦不显示焦点环，之后可以接着用方向键）
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = {
      pointer: e.pointerId,
      from: e.clientX,
      size: props.onStart(),
      sign: isRtl(e.currentTarget) ? -1 : 1,
    }
    setDragging(true)
    props.onDragChange(true)
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.pointer !== e.pointerId) return
    props.onChange(d.size + d.sign * (e.clientX - d.from))
  }
  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.pointer !== e.pointerId) return
    drag.current = null
    setDragging(false)
    props.onDragChange(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId)
    props.onCommit()
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      const grow = (e.key === 'ArrowRight' ? 1 : -1) * (isRtl(e.currentTarget) ? -1 : 1)
      props.onChange(props.onStart() + grow * (e.shiftKey ? RESIZE_STEP * 4 : RESIZE_STEP))
      props.onCommit()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      props.onReset()
    }
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: 可聚焦、可调整的分隔条（WAI-ARIA Window Splitter）没有对应的原生元素，<hr> 不能聚焦与拖动
    <div
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label={props.label}
      aria-valuenow={props.width === null ? undefined : Math.round(props.width)}
      aria-valuemin={props.min}
      aria-valuemax={props.max}
      className={styles.resizer}
      data-vl-state=""
      data-dragging={dragging || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
      onKeyDown={onKeyDown}
      onDoubleClick={props.onReset}
    />
  )
}
