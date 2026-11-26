/**
 * 图标的渲染：把一个图标组件按本库的尺寸、线宽与色调画出来。组件库内部的固定图标（排序箭头、关闭按钮、
 * 展开箭头、状态图标……）直接导入要用的 Lucide 图标，用 Glyph 渲染；按名称取图标的路径在 Icon.tsx，
 * 只有它导入名称注册表。这里不引用注册表，只用 Glyph 画固定图标的组件只打包自己用到的图标。
 */
import type { ComponentType } from 'react'

/**
 * Props that Icon passes to an icon component. Lucide icons (`import { Plus } from 'lucide-react'`) accept them; a
 * component of another icon set, or an SVG of your own, works too if it accepts them, or passes them on to its
 * `<svg>`.
 * @zh Icon 传给图标组件的属性。Lucide 图标（`import { Plus } from 'lucide-react'`）都接受这些属性；其他图标库的
 * 组件、或者自己画的 SVG 组件，只要接受这些属性（或把它们传给自己的 `<svg>`）也可以使用。
 */
export interface IconComponentProps {
  /**
   * Width and height in pixels.
   * @zh 宽高（像素）。
   */
  readonly size?: number
  /**
   * Stroke width in the units of a 24 × 24 view box, already scaled for `size`: the line is 1.75 px wide on screen
   * by default, whatever the size.
   * @zh 线宽，单位是 24 × 24 视图框中的单位，已按 `size` 换算：无论图标多大，屏幕上的线宽默认都是 1.75 像素。
   */
  readonly strokeWidth?: number
  /**
   * Stroke color: `currentColor` (the text color) or a semantic color variable, such as
   * `var(--vl-color-danger)`.
   * @zh 描线颜色：`currentColor`（文字颜色）或语义色变量，如 `var(--vl-color-danger)`。
   */
  readonly color?: string
  /**
   * `true` for a decorative icon (hidden from screen readers).
   * @zh 纯装饰的图标为 `true`（对读屏隐藏）。
   */
  readonly 'aria-hidden'?: boolean
  /**
   * Accessible name of a meaningful icon.
   * @zh 有含义的图标的读屏名称。
   */
  readonly 'aria-label'?: string
  /**
   * `img` for a meaningful icon.
   * @zh 有含义的图标为 `img`。
   */
  readonly role?: string
}

/**
 * An icon component, such as Lucide's `Plus` (`import { Plus } from 'lucide-react'`), accepted wherever an icon name
 * is: `<Button icon={Plus}>`, `<Icon icon={Plus} />`, menu items and so on. Names (`icon="plus"`) are convenient
 * and work in data such as menu configurations, but cover only the registered icons (`iconNames`); a component can
 * be any Lucide icon, or an SVG of your own. Both are drawn with the same size, stroke width and `tone`.
 * @zh 图标组件，如 Lucide 的 `Plus`（`import { Plus } from 'lucide-react'`），可以用在所有接受图标名的地方：
 * `<Button icon={Plus}>`、`<Icon icon={Plus} />`、菜单项等。名称（`icon="plus"`）写起来方便，也能写在菜单配置等数据里，
 * 但只包括登记过的图标（`iconNames`）；图标组件可以是任何 Lucide 图标，也可以是自己画的 SVG。两者按同样的尺寸、线宽与
 * `tone` 绘制。
 */
export type IconComponent = ComponentType<IconComponentProps>

/** 默认像素尺寸。 */
const ICON_DEFAULT_SIZE = 16

/** 默认线宽（屏幕上的像素）：细而清晰。 */
const ICON_DEFAULT_STROKE = 1.75

/** 图标的色调：inherit 跟随文字颜色，其余为语义色。与 IconProps 的 `tone` 相同。 */
export type GlyphTone =
  | 'inherit'
  | 'secondary'
  | 'tertiary'
  | 'accent'
  | 'danger'
  | 'success'
  | 'warning'

const TONE: Record<GlyphTone, string | undefined> = {
  inherit: undefined,
  secondary: 'var(--vl-color-text-secondary)',
  tertiary: 'var(--vl-color-text-tertiary)',
  accent: 'var(--vl-color-accent-text)',
  danger: 'var(--vl-color-danger)',
  success: 'var(--vl-color-success)',
  warning: 'var(--vl-color-warning)',
}

/** 图标的尺寸、线宽、色调与读屏名称（同 IconProps）。 */
export interface GlyphOptions {
  readonly size?: number
  readonly strokeWidth?: number
  readonly tone?: GlyphTone
  readonly label?: string
}

/** 图标外层的属性：尺寸、颜色与读屏名称。Icon 没有图标时的占位 `<svg>` 也用它，两者占同样的位置。 */
export function glyphAttributes({
  size = ICON_DEFAULT_SIZE,
  strokeWidth = ICON_DEFAULT_STROKE,
  tone = 'inherit',
  label,
}: GlyphOptions) {
  return {
    size,
    // 线宽按屏幕像素给出，换算成 24 × 24 视图框中的单位，大小图标的线一样粗。与 Lucide 的 absoluteStrokeWidth
    // 算法相同（先乘后除，结果逐位一致），但不把这个 Lucide 专有的属性传给使用方的组件
    strokeWidth: (strokeWidth * 24) / size,
    color: TONE[tone] ?? 'currentColor',
    'aria-hidden': label ? undefined : true,
    'aria-label': label,
    role: label ? 'img' : undefined,
  } satisfies IconComponentProps
}

/**
 * 组件库内部：用本库的尺寸、线宽与色调渲染一个图标组件（Lucide 图标或使用方的组件）。
 * 输出与原来按名称渲染的 Icon 逐字节相同。
 */
export function Glyph({ icon: C, ...options }: GlyphOptions & { readonly icon: IconComponent }) {
  return <C {...glyphAttributes(options)} />
}
