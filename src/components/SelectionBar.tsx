/**
 * 批量操作栏：多选之后在原位替换工具栏（docs/11 §6.1「多选」「位置一致」「撤销优先于确认」）。
 *
 * - 工具栏与操作栏叠在同一个网格单元里（selection-bar.module.css），容器的高度不随切换变化，下方的内容不移动；
 *   隐藏的一层透明、用 inert 排除键盘与读屏，淡出期间也不能操作；
 * - 数量变化时由状态区礼貌播报（「已选 3 项」「已清除选择」），不打断读屏；
 * - 焦点在栏内时按 Esc 清除选择。栏隐藏时焦点若在栏内，移到 `returnFocus` 指定的元素、最后一次改变选择时焦点所在的
 *   元素（通常是行的复选框）、工具栏中第一个可聚焦的元素，最后是容器本身，不落到 body。
 */
import {
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useT } from '../i18n/index.ts'
import { IconButton, LinkButton } from './Extras.tsx'
import type { BaseProps } from './layout.tsx'
import { Toolbar } from './patterns.tsx'
import styles from './selection-bar.module.css'
import hidden from './visually-hidden.module.css'

/**
 * Props of SelectionBar.
 * @zh SelectionBar 属性。
 */
export interface SelectionBarProps extends Pick<BaseProps, 'testId'> {
  /**
   * Number of selected items. With 0 the bar is hidden and `toolbar` is shown in its place.
   * @zh 已选的数量。为 0 时不显示操作栏，原位显示 `toolbar`。
   */
  readonly count: number
  /**
   * Number of all results (all pages), when known. With it, the bar says "All N selected" once everything is
   * selected, and offers "Select all N" before that if `onSelectAll` is set.
   * @zh 全部结果（所有页）的数量，已知时提供。提供后全部选中时显示「已选全部 N 项」；未全选且提供了 `onSelectAll` 时显示「选择全部 N 项」。
   */
  readonly total?: number
  /**
   * Clears the selection: called by the clear button and by `Esc` while focus is in the bar.
   * @zh 清除选择：清除按钮与焦点在栏内时按 `Esc` 调用。
   */
  readonly onClear: () => void
  /**
   * Selects all `total` results, for example all pages instead of the current one. The "Select all N" button is
   * shown while `count` is less than `total`.
   * @zh 选择全部 `total` 项结果，如所有页而不只是当前页。`count` 小于 `total` 时显示「选择全部 N 项」按钮。
   */
  readonly onSelectAll?: () => void
  /**
   * The toolbar shown while nothing is selected (usually a Toolbar with search and filters). The bar replaces it in
   * place and both take the same space, so the content below does not move. Without it, the space is kept empty.
   * @zh 没有选中任何项时显示的工具栏（通常是带搜索与筛选的 Toolbar）。操作栏在原位替换它，两者占同一块位置，下方的内容不移动。
   * 不提供时，这块位置空着。
   */
  readonly toolbar?: ReactNode
  /**
   * Bulk actions on the right, usually Buttons; put destructive ones last with `danger`. Prefer actions that can be
   * undone (with "Undo" in a message) over confirmations.
   * @zh 右侧的批量操作，通常是 Button；危险操作放在最后并加 `danger`。可恢复的操作优先用消息条的「撤销」，不弹确认。
   */
  readonly children?: ReactNode
  /**
   * Where focus goes when the bar hides while it has focus (after "Clear selection", `Esc`, or an action that
   * empties the selection), for example the table. By default, the element that had focus when the selection last
   * changed (such as the checkbox of a row), otherwise the first focusable element of `toolbar`.
   * @zh 栏在有焦点时隐藏（「清除选择」、`Esc`，或清空了选择的操作）之后焦点的去处，如表格。默认回到最后一次改变选择时焦点所在的
   * 元素（如行的复选框），它不在了就去 `toolbar` 中第一个可聚焦的元素。
   */
  readonly returnFocus?: () => HTMLElement | null | undefined
}

const FOCUSABLE =
  'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

/** 打开着弹层（下拉菜单、气泡确认、选择器）的触发元素：这时的 Esc 属于弹层，由它自己关闭。 */
const OPEN_TRIGGER = /^ant-(?:dropdown|popover|popconfirm)-open$/

function hasOpenPopup(target: Element, bar: Element): boolean {
  for (let el: Element | null = target; el && el !== bar; el = el.parentElement) {
    if (el.getAttribute('aria-expanded') === 'true') return true
    if ([...el.classList].some((c) => OPEN_TRIGGER.test(c))) return true
  }
  return false
}

/**
 * A bar for bulk actions on selected items: it shows how many are selected, a clear button, "Select all N" and
 * your actions, and replaces the toolbar in place while anything is selected.
 *
 * **Interaction**: when `count` becomes greater than 0, the bar fades in and rises slightly over the toolbar, which
 * fades out; both take the same space, so the content below does not move. With "reduce motion" on, they only
 * fade. Screen readers announce the count politely ("3 selected", "Selection cleared"). `Tab` reaches the clear
 * button, "Select all N" and the actions; `Esc` while focus is in the bar clears the selection. When the bar hides
 * while it has focus, focus returns to `returnFocus`, to the element that last changed the selection (such as the
 * checkbox of a row) or to the toolbar, never to the page body. Numbers use tabular figures and the format of the
 * locale.
 * @zh 批量操作栏：显示已选数量、清除按钮、「选择全部 N 项」与使用方的操作，有选中项时在原位替换工具栏。
 *
 * **交互**：`count` 大于 0 时，操作栏在工具栏的位置淡入并轻微上移，工具栏淡出；两者占同一块位置，下方的内容不移动。
 * 「减少动态效果」打开时只淡入淡出。读屏礼貌播报数量（「已选 3 项」「已清除选择」）。`Tab` 依次到达清除按钮、
 * 「选择全部 N 项」与各个操作；焦点在栏内时按 `Esc` 清除选择。栏在有焦点时隐藏，焦点回到 `returnFocus`、最后一次改变选择的
 * 元素（如行的复选框）或工具栏，不会落到页面的 body 上。数字使用等宽数字与当前语言的写法。
 * @category Patterns
 * @usage Bulk actions on selected table rows, files in an image grid or messages; "Select all" across pages
 * @usageZh 表格选中行、图片网格中选中的文件、消息的批量操作；跨页的「选择全部」
 */
export function SelectionBar(props: SelectionBarProps) {
  const t = useT()
  const locale = t('format.locale')
  const numbers = useMemo(() => new Intl.NumberFormat(locale), [locale])
  const visible = props.count > 0

  // 淡出期间仍显示最后的数量（不变成「已选 0 项」）
  const [shown, setShown] = useState({ count: props.count, total: props.total })
  if (visible && (shown.count !== props.count || shown.total !== props.total))
    setShown({ count: props.count, total: props.total })

  const all = shown.total !== undefined && shown.count >= shown.total
  const summary = t(all ? 'selectionBar.allSelected' : 'selectionBar.selected', {
    count: numbers.format(shown.count),
  })
  const showSelectAll =
    props.onSelectAll !== undefined && shown.total !== undefined && shown.count < shown.total

  // 数量变化时礼貌播报；挂载时（包括一开始就有选中项）不播报
  const [announcement, setAnnouncement] = useState('')
  const lastCount = useRef(props.count)
  useEffect(() => {
    const was = lastCount.current
    if (was === props.count) return
    lastCount.current = props.count
    setAnnouncement(props.count > 0 ? summary : was > 0 ? t('selectionBar.cleared') : '')
  }, [props.count, summary, t])

  const rootRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const clearRef = useRef<HTMLButtonElement>(null)
  const latest = useRef(props)
  useLayoutEffect(() => {
    latest.current = props
  })

  // 最后一次改变选择时焦点所在的元素（通常是行的复选框）：清除后回到这里
  const origin = useRef<HTMLElement | null>(null)
  useLayoutEffect(() => {
    if (props.count === 0) return
    const active = document.activeElement
    if (
      active instanceof HTMLElement &&
      active !== document.body &&
      !barRef.current?.contains(active)
    )
      origin.current = active
  }, [props.count])

  // inert 由下面的 effect 管理（顺序关系到焦点）；首次渲染（包括服务端渲染）直接输出，此后 React 不再改动它
  const [initialInert] = useState(() => ({ toolbar: visible, bar: !visible }))

  // 切换：先让出现的一层可以操作，焦点在消失的一层里时移过去，再把消失的一层设为 inert（顺序反过来焦点会先丢到 body）
  const wasVisible = useRef<boolean | null>(null)
  useLayoutEffect(() => {
    const bar = barRef.current
    const toolbar = toolbarRef.current
    const root = rootRef.current
    if (!bar || !toolbar || !root) return
    const was = wasVisible.current
    wasVisible.current = visible
    const incoming = visible ? bar : toolbar
    const outgoing = visible ? toolbar : bar
    incoming.inert = false
    if (was !== null && was !== visible && outgoing.contains(document.activeElement)) {
      if (visible) clearRef.current?.focus()
      else {
        const candidates = [
          latest.current.returnFocus?.(),
          origin.current,
          toolbar.querySelector<HTMLElement>(FOCUSABLE),
        ]
        let moved = false
        for (const el of candidates) {
          if (!el?.isConnected || bar.contains(el)) continue
          el.focus()
          moved = document.activeElement === el
          if (moved) break
        }
        if (!moved) {
          root.tabIndex = -1
          root.focus()
        }
      }
    }
    outgoing.inert = true
  }, [visible])

  // 栏内获得过焦点的元素被移除时（如全部选中后「选择全部」消失、操作按钮随选择变化），焦点移到清除按钮，不丢到 body
  const lastFocused = useRef<HTMLElement | null>(null)
  useLayoutEffect(() => {
    const el = lastFocused.current
    if (!visible || !el || el.isConnected) return
    lastFocused.current = null
    const active = document.activeElement
    if (!active || active === document.body) clearRef.current?.focus()
  })

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Escape' || e.defaultPrevented || e.nativeEvent.isComposing) return
    // 弹层（如操作按钮打开的菜单）渲染在别处，但事件沿 React 树冒泡到这里：只处理栏内的按键，打开着弹层时 Esc 属于弹层
    const target = e.target as Element
    if (!e.currentTarget.contains(target) || hasOpenPopup(target, e.currentTarget)) return
    e.preventDefault()
    e.stopPropagation()
    props.onClear()
  }
  const onFocus = (e: FocusEvent<HTMLDivElement>) => {
    if (e.target instanceof HTMLElement) lastFocused.current = e.target
  }

  return (
    <div
      ref={rootRef}
      className={styles.root}
      data-selected={visible || undefined}
      data-testid={props.testId}
    >
      <div
        ref={toolbarRef}
        className={styles.layer}
        data-layer="toolbar"
        data-hidden={visible || undefined}
        inert={initialInert.toolbar || undefined}
      >
        {props.toolbar}
      </div>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: 只收拢栏内的 Esc 与焦点；角色由里面的工具栏（role="toolbar"）提供 */}
      <div
        ref={barRef}
        className={`${styles.layer} ${styles.bar}`}
        data-layer="bar"
        data-hidden={!visible || undefined}
        inert={initialInert.bar || undefined}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
      >
        <Toolbar aria-label={t('selectionBar.label')} actions={props.children}>
          <span className={styles.summary}>
            <IconButton
              ref={clearRef}
              icon="close"
              label={t('selectionBar.clear')}
              onClick={props.onClear}
            />
            <span className={styles.count}>{summary}</span>
          </span>
          {showSelectAll && (
            <LinkButton onClick={props.onSelectAll}>
              {t('selectionBar.selectAll', { total: numbers.format(shown.total ?? 0) })}
            </LinkButton>
          )}
        </Toolbar>
      </div>
      <span className={hidden.hidden} role="status">
        {announcement}
      </span>
    </div>
  )
}
