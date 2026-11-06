/**
 * 图表提示：内容用 DOM 节点构造，文字一律经 `textContent` 写入。
 *
 * 系列名、类别名来自使用方的数据（表头、接口返回），是不可信文本：ECharts 的 formatter 可以返回 HTMLElement，
 * 这里从不拼接 HTML 字符串，名字里即使有 `<img onerror=…>` 也只会作为文字显示。
 */
import type { ChartPalette } from './palette.ts'
import styles from './tooltip.module.css'

/** 提示中的一行：系列颜色的短线、数值、系列名。 */
export interface TooltipRow {
  readonly color: string
  readonly value: string
  readonly name: string
}

/** 提示的内容：标题（类别、扇区、格子坐标）与若干行。 */
export interface TooltipContent {
  readonly title?: string
  readonly rows: readonly TooltipRow[]
}

function el(tag: string, className: string | undefined, text?: string): HTMLElement {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

/** 构造提示内容的 DOM（只在浏览器中、由 ECharts 显示提示时调用）。 */
export function tooltipElement(content: TooltipContent): HTMLElement {
  const root = el('div', styles.content)
  root.dataset.vlChartTooltip = ''
  if (content.title !== undefined) root.appendChild(el('div', styles.title, content.title))
  for (const r of content.rows) {
    const row = el('div', styles.row)
    const key = el('span', styles.key)
    key.style.backgroundColor = r.color
    row.append(key, el('span', styles.value, r.value), el('span', styles.name, r.name))
    root.appendChild(row)
  }
  return root
}

/** 提示内容的纯文字（键盘浏览时给读屏播报）。 */
export function tooltipText(content: TooltipContent): string {
  const rows = content.rows.map((r) => `${r.name} ${r.value}`)
  return [content.title, ...rows].filter(Boolean).join(', ')
}

/**
 * 所有图表共用的提示外观：浮层底色、浮起阴影、大圆角（令牌变量写在 extraCssText 中，主题切换后自动生效），
 * 限制在图表区域内显示，移动时的过渡与更新动画一致（「减少动态效果」时为 0）。
 */
export function tooltipBase(p: ChartPalette) {
  return {
    show: true,
    confine: true,
    showDelay: 0,
    hideDelay: 80,
    enterable: false,
    padding: 0,
    borderWidth: 0,
    backgroundColor: p.surface,
    transitionDuration: p.updateMs / 1000,
    extraCssText: [
      'background: var(--vl-color-bg-elevated)',
      'box-shadow: var(--vl-shadow-float)',
      'border-radius: var(--vl-radius-lg)',
      'padding: var(--vl-space-2) var(--vl-space-3)',
      'font-family: var(--vl-font-family-body)',
      'color: var(--vl-color-text-primary)',
    ].join(';'),
  } as const
}
