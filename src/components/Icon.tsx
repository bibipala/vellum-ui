/**
 * 图标：统一使用 Lucide（ISC 许可）的线性图标，线宽一致。
 * 使用方按名称引用（如菜单 `icon: 'files'`），或者直接传图标组件（`icon={Plus}`）。
 *
 * 按名称取图标是唯一会用到名称注册表（iconRegistry.ts）的路径：注册表在这里静态导入，名称图标在首次绘制与服务端渲染时
 * 就是图标。组件库内部的固定图标不经过这里，直接导入要用的 Lucide 图标用 Glyph 渲染，只画自己固定图标的组件因此
 * 不包含注册表。
 */
import { Glyph, type GlyphOptions, glyphAttributes, type IconComponent } from './glyph.tsx'
import type { IconName } from './iconNames.ts'
import { registry } from './iconRegistry.ts'

/**
 * Props of Icon.
 * @zh Icon 属性。
 */
export interface IconProps {
  /**
   * Icon name, see `iconNames` (only registered icons can be used). Give `name` or `icon`; with neither, Icon
   * renders an empty space of the same size.
   * @zh 图标名称，见 `iconNames`（只能使用登记过的图标）。`name` 与 `icon` 给一个；都不给时留出同样大小的空位。
   */
  readonly name?: IconName
  /**
   * Icon component instead of a name, such as Lucide's `Plus`; it takes precedence over `name`. Any Lucide icon
   * works, not only the registered ones.
   * @zh 用图标组件代替名称，如 Lucide 的 `Plus`；同时给了 `name` 时以它为准。任何 Lucide 图标都可以，不限于登记过的。
   */
  readonly icon?: IconComponent
  /**
   * Size in pixels, 16 by default.
   * @zh 像素尺寸，默认 16。
   */
  readonly size?: number
  /**
   * Stroke width, 1.75 by default (thin but crisp).
   * @zh 线宽，默认 1.75（细而清晰）。
   */
  readonly strokeWidth?: number
  /**
   * Color: `inherit` follows the text color (default); the others are semantic colors. State colors such as hover
   * and selected are controlled by the surrounding element.
   * @zh 颜色：inherit 跟随文字颜色（默认）；其余为语义色。悬停、选中等状态色由外层元素控制。
   * @default 'inherit'
   */
  readonly tone?: 'inherit' | 'secondary' | 'tertiary' | 'accent' | 'danger' | 'success' | 'warning'
  /**
   * Text label for meaningful icons; omit it for purely decorative icons (hidden from screen readers).
   * @zh 有含义的图标需要文字说明；纯装饰图标省略（对读屏隐藏）。
   */
  readonly label?: string
}

/** 空图标：与图标同样大小、同样读屏属性的空 `<svg>`。Icon 既没有 `name` 也没有 `icon` 时用它占位。 */
function Blank(options: GlyphOptions) {
  const { size, 'aria-hidden': hidden, 'aria-label': label, role } = glyphAttributes(options)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden={hidden}
      aria-label={label}
      role={role}
    />
  )
}

/**
 * 组件库内部：渲染使用方给的图标，名称或图标组件（Button、IconButton、菜单项等的 `icon`）。
 * 只有名称会用到注册表。
 */
export function AnyIcon({
  icon,
  ...options
}: GlyphOptions & { readonly icon: IconName | IconComponent }) {
  return <Glyph icon={typeof icon === 'string' ? registry[icon] : icon} {...options} />
}

/**
 * A line icon (Lucide) with a consistent stroke width, given by name (`name="plus"`) or as an icon component
 * (`icon={Plus}`).
 *
 * Names cover the registered icons (`iconNames`). A component can be any Lucide icon, or an SVG of your own that
 * accepts `IconComponentProps`; it is drawn with the same size, stroke width and `tone`.
 * @zh 线性图标（Lucide），线宽统一，按名称（`name="plus"`）或图标组件（`icon={Plus}`）指定。
 *
 * 名称只包括登记过的图标（`iconNames`）。图标组件可以是任何 Lucide 图标，也可以是接受 `IconComponentProps` 的自定义
 * SVG 组件，按同样的尺寸、线宽与 `tone` 绘制。
 * @category Basic
 * @usage Icons in buttons, list items, menus and empty states; menu items take the same names or components
 * @usageZh 按钮、列表行、菜单、空状态中的图标；菜单配置的 `icon` 字段用同一套名称或图标组件
 */
export function Icon({ name, icon, ...options }: IconProps) {
  if (icon) return <Glyph icon={icon} {...options} />
  // 两者都没给时留出空位，不返回 null：返回类型与原来相同
  return name ? <Glyph icon={registry[name]} {...options} /> : <Blank {...options} />
}
