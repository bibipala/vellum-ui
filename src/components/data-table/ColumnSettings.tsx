/**
 * 列设置（DataTable 内部）：工具栏右侧的按钮打开气泡卡片，按显示顺序列出全部列：
 * - 复选框显示 / 隐藏；不可隐藏的列（`hideable: false`）与最后一个显示的列禁用，旁边写明原因（读屏通过 aria-describedby 读出）；
 * - 上移 / 下移按钮在同一个固定分组内调整顺序（键盘可用；按到分组边上时焦点移到另一个方向的按钮，不丢失）；
 * - 「固定到开头」「固定到结尾」两个切换按钮（aria-pressed），再按一次取消固定；
 * - 「恢复默认」：顺序、显示、固定与列宽都回到列定义的默认值。
 */
// 复选框直接用 antd 的（本库的 Checkbox 只是它的薄封装）：inputs.tsx 中 Form、TreeSelect 等复合组件的静态成员
// （`Form.useWatch`、`TreeSelect.SHOW_ALL`）在模块顶层读取属性，打包工具认为有副作用而保留，只引入 Checkbox 也会
// 带上 Form、Select、TreeSelect、Tree（gzip 后约 80 KiB）
import { Checkbox } from 'antd'
import { useId, useLayoutEffect, useRef, useState } from 'react'
import { useT } from '../../i18n/index.ts'
import { Button } from '../basic.tsx'
import { IconButton } from '../Extras.tsx'
import { Popover } from '../overlays.tsx'
import styles from './data-table.module.css'
import {
  type ColumnState,
  canHide,
  canMove,
  type DataTablePin,
  isHidden,
  type ModelColumn,
  moveColumn,
  orderedColumns,
  pinOf,
} from './model.ts'

export interface ColumnSettingsProps<C extends ModelColumn> {
  readonly columns: readonly C[]
  readonly state: ColumnState
  readonly labelOf: (column: C) => string
  readonly onChange: (next: ColumnState) => void
  readonly onReset: () => void
}

function SettingsPanel<C extends ModelColumn>(props: ColumnSettingsProps<C>) {
  const t = useT()
  const baseId = useId()
  const { columns, state, onChange } = props
  const list = orderedColumns(columns, state)
  const shownCount = list.filter((c) => !isHidden(c, state)).length
  const buttons = useRef(new Map<string, HTMLButtonElement | null>())
  const pending = useRef<{ key: string; delta: -1 | 1 } | null>(null)

  // 移到分组边上后，按下的按钮变为禁用、失去焦点：把焦点移到另一个方向的按钮
  useLayoutEffect(() => {
    const p = pending.current
    if (!p) return
    pending.current = null
    const self = buttons.current.get(`${p.key}:${p.delta}`)
    if (self && !self.disabled && document.activeElement === self) return
    if (self && !self.disabled) self.focus()
    else buttons.current.get(`${p.key}:${-p.delta}`)?.focus()
  })

  const move = (key: string, delta: -1 | 1) => {
    const next = moveColumn(columns, state, key, delta)
    if (!next) return
    pending.current = { key, delta }
    onChange(next)
  }
  const setPin = (key: string, pin: DataTablePin | null) =>
    onChange({ ...state, pin: { ...state.pin, [key]: pin } })

  return (
    <div className={styles.settings}>
      <ul className={styles.settingsList} aria-label={t('dataTable.columns.list')}>
        {list.map((c) => {
          const label = props.labelOf(c)
          const shown = !isHidden(c, state)
          const locked = !canHide(c)
          const last = shown && shownCount === 1
          const hintId = `${baseId}-${c.key}-hint`
          const pin = pinOf(c, state)
          const ref = (delta: -1 | 1) => (el: HTMLButtonElement | null) => {
            buttons.current.set(`${c.key}:${delta}`, el)
          }
          return (
            <li key={c.key} className={styles.settingsItem}>
              <Checkbox
                checked={shown}
                disabled={locked || last}
                aria-describedby={locked || last ? hintId : undefined}
                onChange={(e) =>
                  onChange({ ...state, hidden: { ...state.hidden, [c.key]: !e.target.checked } })
                }
              >
                <span className={styles.settingsLabel}>{label}</span>
              </Checkbox>
              {(locked || last) && (
                <span id={hintId} className={styles.settingsHint}>
                  {locked ? t('dataTable.columns.alwaysShown') : t('dataTable.columns.lastShown')}
                </span>
              )}
              <span className={styles.settingsActions}>
                <IconButton
                  ref={ref(-1)}
                  size="sm"
                  icon="arrow-up"
                  label={t('dataTable.columns.moveUp', { column: label })}
                  disabled={!canMove(columns, state, c.key, -1)}
                  onClick={() => move(c.key, -1)}
                />
                <IconButton
                  ref={ref(1)}
                  size="sm"
                  icon="arrow-down"
                  label={t('dataTable.columns.moveDown', { column: label })}
                  disabled={!canMove(columns, state, c.key, 1)}
                  onClick={() => move(c.key, 1)}
                />
                <IconButton
                  size="sm"
                  icon="pin-start"
                  data-pin-toggle=""
                  active={pin === 'start'}
                  label={t('dataTable.columns.pinStart', { column: label })}
                  onClick={() => setPin(c.key, pin === 'start' ? null : 'start')}
                />
                <IconButton
                  size="sm"
                  icon="pin-end"
                  data-pin-toggle=""
                  active={pin === 'end'}
                  label={t('dataTable.columns.pinEnd', { column: label })}
                  onClick={() => setPin(c.key, pin === 'end' ? null : 'end')}
                />
              </span>
            </li>
          )
        })}
      </ul>
      <div className={styles.settingsFooter}>
        <Button size="small" onClick={props.onReset}>
          {t('dataTable.columns.reset')}
        </Button>
      </div>
    </div>
  )
}

/** 工具栏右侧的「列设置」按钮与气泡卡片。 */
export function ColumnSettings<C extends ModelColumn>(props: ColumnSettingsProps<C>) {
  const t = useT()
  const [open, setOpen] = useState(false)
  return (
    <Popover
      trigger="click"
      placement="bottomRight"
      open={open}
      onOpenChange={setOpen}
      title={t('dataTable.columns')}
      content={<SettingsPanel {...props} />}
    >
      <IconButton icon="columns" label={t('dataTable.columns')} aria-expanded={open} />
    </Popover>
  )
}
