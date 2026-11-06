/**
 * 图表容器：标题、说明、右上角操作区（含「图表 / 表格」切换）、图例、固定高度的主体与状态（加载、空、错误）。
 * 所有图表都用它；也可以单独用来包裹自定义图形，这时由使用方提供图例与表格数据。
 *
 * - 表格视图是图形的无障碍替身（浅色模式下青绿、黄、品红对表面的对比度不足 3:1），所以只要提供了表格数据，
 *   就显示切换；
 * - 首次加载显示延迟出现的加载指示，占位高度与图形相同；已有数据时重新加载保留上一次的图形、降低不透明度；
 * - 图例的标记颜色由 data-color 对应到分类色令牌（CSS 中），不写内联颜色。
 */
import { type ReactNode, useId, useState } from 'react'
import { useT } from '../../i18n/index.ts'
import { EmptyState, ErrorState, Loading } from '../feedback.tsx'
import { Segmented } from '../inputs.tsx'
import type { BaseProps } from '../layout.tsx'
import { useDelayedPending } from '../useDelayedPending.ts'
import styles from './chart-container.module.css'
import type { ChartColorSlot } from './format.ts'

/** 没有指定高度时主体的高度（像素，包含坐标轴文字）。 */
export const DEFAULT_CHART_HEIGHT = 240

/**
 * An item of a chart legend.
 * @zh 图例中的一项。
 */
export interface ChartLegendItem {
  /**
   * Identity of the item: the key of the series (or slice) it stands for.
   * @zh 图例项的身份：对应系列（或扇区）的 key。
   */
  readonly key: string
  /**
   * Text of the item; shown as text, never interpreted as HTML.
   * @zh 图例文字；作为纯文字显示，不会被当作 HTML。
   */
  readonly name: string
  /**
   * Color: a position in the categorical palette, or `'muted'` for "Other" and de-emphasized series.
   * @zh 颜色：分类色的序号，或 `'muted'`（「其他」与被弱化的系列）。
   */
  readonly color: ChartColorSlot | 'muted'
  /**
   * Shape of the marker, matching the mark of the graphic: a short line for lines, a dot for points, a square for
   * bars, areas and slices.
   * @zh 标记形状，与图形一致：折线用短线，散点用圆点，柱、面积、扇区用方块。
   * @default 'square'
   */
  readonly marker?: 'line' | 'dot' | 'square'
}

/**
 * A column of the table view.
 * @zh 表格视图的一列。
 */
export interface ChartTableColumn {
  /**
   * Key of the column in each row.
   * @zh 该列在每行数据中的键。
   */
  readonly key: string
  /**
   * Column header.
   * @zh 表头文字。
   */
  readonly title: string
  /**
   * Right-aligned with tabular numbers (columns of values).
   * @zh 右对齐、等宽数字（数值列）。
   */
  readonly numeric?: boolean
}

/**
 * The data of the table view: columns and rows of already formatted texts.
 * @zh 表格视图的数据：列与行，单元格是已经格式化好的文字。
 */
export interface ChartTableData {
  /**
   * The columns, in order; the first one usually names the category, slice or cell.
   * @zh 各列，按顺序；第一列通常是类别、扇区或格子。
   */
  readonly columns: readonly ChartTableColumn[]
  /**
   * The rows: column key → text.
   * @zh 各行：列的键 → 文字。
   */
  readonly rows: readonly Readonly<Record<string, string>>[]
}

/**
 * Props shared by every chart: title, size and states.
 * @zh 所有图表共有的属性：标题、尺寸与状态。
 */
export interface ChartCommonProps extends Pick<BaseProps, 'testId'> {
  /**
   * Title of the chart: what is plotted. It is also the accessible name of the graphic.
   * @zh 图表标题：画的是什么。同时是图形的读屏名称。
   */
  readonly title?: string
  /**
   * A short description under the title, such as the period or the unit.
   * @zh 标题下的简短说明，如时间范围、单位。
   */
  readonly description?: string
  /**
   * Height of the graphic in pixels, axis labels included. The states take the same height. The table view starts at
   * this height and grows with its rows up to 480 px (or this height when it is taller); only longer tables scroll.
   * @zh 图形的高度（像素），包含坐标轴文字。各种状态占同样的高度。表格视图从这个高度起随行数变高，最多 480px
   * （本高度更大时以本高度为准），更长的表格才在卡片内滚动。
   * @default 240
   */
  readonly height?: number
  /**
   * Loading: without data, a delayed loading indicator takes the place of the graphic; with data, the previous
   * graphic stays at reduced opacity until the new data arrives.
   * @zh 加载中：没有数据时显示延迟出现的加载指示；已有数据时保留上一次的图形并降低不透明度，直到新数据到来。
   */
  readonly loading?: boolean
  /**
   * Error: `true` shows the default error state; a node is shown as the message of the error state.
   * @zh 错误：`true` 显示默认的错误状态；传入内容时作为错误状态的说明。
   */
  readonly error?: ReactNode
  /**
   * Retry after an error; shows a "Retry" button in the error state.
   * @zh 出错后重试；提供后错误状态中显示「重试」按钮。
   */
  readonly onRetry?: () => void
  /**
   * Text of the empty state when there is no data, "No data" by default (follows `locale`).
   * @zh 没有数据时空状态的文字，默认「暂无数据」（随 `locale`）。
   */
  readonly emptyDescription?: ReactNode
  /**
   * Actions in the top-right corner, before the view switch (for example a menu or a time range).
   * @zh 右上角的操作，在视图切换之前（如菜单、时间范围）。
   */
  readonly actions?: ReactNode
  /**
   * Without the card (no background, shadow or padding), for charts inside a Panel, a dialog or a drawer.
   * @zh 不带卡片（没有底色、阴影与内边距），用于放在面板、对话框、抽屉中的图表。
   */
  readonly plain?: boolean
}

/**
 * Props of ChartContainer.
 * @zh ChartContainer 属性。
 */
export interface ChartContainerProps extends ChartCommonProps {
  /**
   * The graphic, sized to fill the body (`height` pixels high, as wide as the container).
   * @zh 图形，占满主体（高 `height` 像素、与容器同宽）。
   */
  readonly children?: ReactNode
  /**
   * Legend items; the legend is shown from two items on (a single series is named by the title).
   * @zh 图例项；两项及以上时显示图例（只有一个系列时由标题说明）。
   */
  readonly legend?: readonly ChartLegendItem[]
  /**
   * Keys of the legend items that are hidden (controlled). With `onHiddenKeysChange`, the legend items become
   * toggle buttons.
   * @zh 被隐藏的图例项的 key（受控）。提供 `onHiddenKeysChange` 后，图例项成为可切换的按钮。
   */
  readonly hiddenKeys?: readonly string[]
  /**
   * Called with the new hidden keys when a legend item is toggled.
   * @zh 切换图例项时调用，参数是新的隐藏项。
   */
  readonly onHiddenKeysChange?: (keys: readonly string[]) => void
  /**
   * The same data as a table: when given, a "Chart / Table" switch appears in the top-right corner.
   * @zh 以表格表示的同一份数据：提供后右上角出现「图表 / 表格」切换。
   */
  readonly table?: ChartTableData
  /**
   * There is no data: shows the empty state (or the loading indicator while `loading`).
   * @zh 没有数据：显示空状态（`loading` 时显示加载指示）。
   */
  readonly empty?: boolean
}

/** 把图表的共有属性原样交给 ChartContainer。 */
export function commonProps(p: ChartCommonProps): ChartCommonProps {
  return {
    title: p.title,
    description: p.description,
    height: p.height,
    loading: p.loading,
    error: p.error,
    onRetry: p.onRetry,
    emptyDescription: p.emptyDescription,
    actions: p.actions,
    plain: p.plain,
    testId: p.testId,
  }
}

type View = 'chart' | 'table'

function Legend(props: {
  items: readonly ChartLegendItem[]
  hidden: readonly string[]
  onChange?: (keys: readonly string[]) => void
  concealed: boolean
}) {
  const t = useT()
  const { items, hidden, onChange } = props
  const toggle = (key: string) =>
    onChange?.(hidden.includes(key) ? hidden.filter((k) => k !== key) : [...hidden, key])
  return (
    <ul
      className={styles.legend}
      aria-label={t('chart.legend')}
      data-concealed={props.concealed || undefined}
      aria-hidden={props.concealed || undefined}
      inert={props.concealed || undefined}
    >
      {items.map((item) => {
        const swatch = (
          <span
            className={styles.swatch}
            data-color={item.color}
            data-marker={item.marker ?? 'square'}
            aria-hidden
          />
        )
        const name = <span className={styles.legendName}>{item.name}</span>
        return (
          <li key={item.key}>
            {onChange ? (
              <button
                type="button"
                className={styles.legendItem}
                data-vl-state=""
                aria-pressed={!hidden.includes(item.key)}
                onClick={() => toggle(item.key)}
              >
                {swatch}
                {name}
              </button>
            ) : (
              <span className={styles.legendItem}>
                {swatch}
                {name}
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * 表格视图：原生 `<table>`，只用令牌。不用 DataTable：它自己是滚动容器（表头只在给了 `height` / `fill` 时吸顶），
 * 而这里的表格要随行数变高、超过上限才在图表主体内滚动并吸顶；排序、选择、列宽、虚拟滚动等功能这里也用不到
 * （gzip 后多约 21 KiB）。单元格是已经格式化好的文字，作为 React 文本输出，不会被当作 HTML。
 */
function ChartTable(props: { data: ChartTableData; labelledBy: string | undefined }) {
  const { columns, rows } = props.data
  return (
    <table className={styles.table} aria-labelledby={props.labelledBy}>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.key} scope="col" data-numeric={c.numeric || undefined}>
              {c.title}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((cells, i) => (
          // 行没有身份，只按位置对应（数据变化时整表重新渲染，没有状态需要保留）
          // biome-ignore lint/suspicious/noArrayIndexKey: 见上一行
          <tr key={i}>
            {columns.map((c) => (
              <td key={c.key} data-numeric={c.numeric || undefined}>
                {cells[c.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/**
 * A card for a chart: title, description, actions, legend, the graphic and its states. Every chart of the library
 * is built on it; use it directly to give a custom graphic the same frame, legend, table view and states.
 *
 * **Interaction**: legend items are toggle buttons (`aria-pressed`) when `onHiddenKeysChange` is given; hiding an
 * item never changes the colors of the others. With `table`, the "Chart / Table" switch shows the same data as a
 * table. The first load shows a loading indicator after 200 ms at the height of the graphic; reloading keeps the
 * previous graphic at reduced opacity (`aria-busy`) instead of flashing a skeleton.
 * @zh 图表卡片：标题、说明、操作、图例、图形及其状态。组件库的所有图表都基于它；也可以直接用它给自定义图形
 * 同样的外框、图例、表格视图与状态。
 *
 * **交互**：提供 `onHiddenKeysChange` 时图例项是切换按钮（`aria-pressed`），隐藏某一项不会改变其他项的颜色。
 * 提供 `table` 时，「图表 / 表格」切换以表格显示同一份数据。首次加载在 200ms 后显示加载指示，高度与图形相同；
 * 重新加载时保留上一次的图形并降低不透明度（`aria-busy`），不闪骨架。
 * @category Charts
 * @usage Wrapping a custom graphic (a map, a diagram) so that it matches the other charts of a dashboard
 * @usageZh 包裹自定义图形（地图、示意图），与仪表盘中的其他图表保持一致
 */
export function ChartContainer(props: ChartContainerProps) {
  const t = useT()
  const id = useId()
  const [view, setView] = useState<View>('chart')
  const height = props.height ?? DEFAULT_CHART_HEIGHT
  const loading = props.loading ?? false
  const showLoading = useDelayedPending(loading)
  const hasError = props.error !== undefined && props.error !== null && props.error !== false
  const empty = props.empty ?? false
  const legend = props.legend ?? []
  const hidden = props.hiddenKeys ?? []
  const table = props.table
  const titleId = `${id}-title`
  const descriptionId = `${id}-description`
  const hasHead = Boolean(props.title || props.description || props.actions || table)
  const currentView: View = table ? view : 'chart'

  let body: ReactNode
  if (hasError)
    body = (
      <ErrorState
        size="sm"
        fill
        message={props.error === true ? undefined : props.error}
        onRetry={props.onRetry}
      />
    )
  else if (empty && (loading || showLoading)) body = <Loading fill />
  else if (empty)
    body = <EmptyState size="sm" fill title={props.emptyDescription ?? t('chart.empty')} />
  else if (currentView === 'table' && table)
    body = <ChartTable data={table} labelledBy={props.title ? titleId : undefined} />
  else body = props.children

  const refreshing = !hasError && !empty && showLoading
  // 状态（错误、空、首次加载）与图形同高；高度很小时状态的内容放不下，主体随内容变高，而不是裁掉文字与按钮
  const showingState = hasError || empty
  return (
    <figure
      className={styles.root}
      data-plain={props.plain || undefined}
      aria-labelledby={props.title ? titleId : undefined}
      aria-describedby={props.description ? descriptionId : undefined}
      aria-busy={loading || undefined}
      data-testid={props.testId}
    >
      {hasHead && (
        <div className={styles.head}>
          <div className={styles.headText}>
            {props.title && (
              <div className={styles.title} id={titleId}>
                {props.title}
              </div>
            )}
            {props.description && (
              <div className={styles.description} id={descriptionId}>
                {props.description}
              </div>
            )}
          </div>
          {(props.actions || table) && (
            <div className={styles.actions}>
              {props.actions}
              {table && (
                <Segmented<View>
                  size="small"
                  // 错误与空状态下没有可切换的内容；保留控件的位置，标题行不跳
                  disabled={showingState}
                  aria-label={t('chart.view.label')}
                  value={view}
                  onChange={setView}
                  options={[
                    { value: 'chart', label: t('chart.view.chart') },
                    { value: 'table', label: t('chart.view.table') },
                  ]}
                />
              )}
            </div>
          )}
        </div>
      )}
      {legend.length >= 2 && (
        <Legend
          items={legend}
          hidden={hidden}
          onChange={props.onHiddenKeysChange}
          // 表格视图中图例不起作用，但保留它的位置：切换视图时卡片高度不变
          concealed={currentView === 'table'}
        />
      )}
      <div
        className={styles.body}
        data-view={currentView}
        data-refreshing={refreshing || undefined}
        style={
          showingState
            ? { minHeight: height }
            : currentView === 'table'
              ? {
                  minHeight: height,
                  maxHeight: `max(${height}px, var(--vl-chart-table-max-height))`,
                }
              : { height }
        }
      >
        {body}
      </div>
    </figure>
  )
}
