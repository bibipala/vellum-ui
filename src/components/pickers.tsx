/**
 * 选择类输入：滑块、颜色选择、级联选择、自动补全。antd 只作为内部实现，对外的属性、选项与值的类型由本库声明（ADR 0021）。
 * 输入框形态的组件（级联、自动补全）与 Input、Select 一样是填充式（中性底、不描边，聚焦时强调色细边与光环）。
 */
import {
  AutoComplete as AntAutoComplete,
  Cascader as AntCascader,
  ColorPicker as AntColorPicker,
  Slider as AntSlider,
} from 'antd'
import {
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  useState,
} from 'react'
import { useT } from '../i18n/index.ts'
import type { ControlSize } from './basic.tsx'
import { useFieldLabel } from './fieldLabel.ts'
import styles from './inputs.module.css'
import { toAntSize, withInjected } from './internal.ts'
import { usePopupFocus } from './overlays.tsx'
import type { FieldAttributes } from './select.tsx'

// antd 的属性类型与本库的声明在结构上兼容，但 antd 的泛型与重载让直接传递很繁琐：内部统一转成宽松的对象再交给 antd
type Loose = Record<string, unknown>

// —— Slider ——

/** 单值与范围共有的属性。 */
interface SliderCommonProps {
  /**
   * Smallest value.
   * @zh 最小值。
   * @default 0
   */
  readonly min?: number
  /**
   * Largest value.
   * @zh 最大值。
   * @default 100
   */
  readonly max?: number
  /**
   * Step between values; `null` allows only the values in `marks`.
   * @zh 取值的步长；为 `null` 时只能选 `marks` 中的值。
   * @default 1
   */
  readonly step?: number | null
  /**
   * Labels under the track: value → text.
   * @zh 轨道下方的刻度：值 → 文字。
   */
  readonly marks?: Readonly<Record<number, ReactNode>>
  /**
   * Disables the slider.
   * @zh 禁用。
   */
  readonly disabled?: boolean
  /**
   * Accessible name of the handle(s), when there is no visible label.
   * @zh 手柄的读屏名称，没有可见的标签时提供。
   */
  readonly 'aria-label'?: string
  /**
   * Id of the element that labels the slider.
   * @zh 作为标签的元素的 id。
   */
  readonly 'aria-labelledby'?: string
  /**
   * Id of the element that describes the slider, such as a hint.
   * @zh 说明这个滑块的元素（如提示文字）的 id。
   */
  readonly 'aria-describedby'?: string
  /**
   * Id of the slider (Form.Item sets it).
   * @zh 滑块的 id（Form.Item 会设置）。
   */
  readonly id?: string
  /**
   * Test id, output as `data-testid`.
   * @zh 测试定位，输出为 `data-testid`。
   */
  readonly 'data-testid'?: string
}

/**
 * Single value (default)
 * One handle; `value`, `defaultValue` and the callbacks use a number.
 * @zh 单个值（默认）
 * 一个手柄；`value`、`defaultValue` 与回调都用一个数值。
 */
interface SliderSingleProps extends SliderCommonProps {
  /**
   * Picks a range `[start, end]` with two handles instead of one value.
   * @zh 用两个手柄选择范围 `[起点, 终点]`，而不是一个值。
   */
  readonly range?: false
  /**
   * Current value (controlled).
   * @zh 当前值（受控）。
   */
  readonly value?: number
  /**
   * Initial value (uncontrolled).
   * @zh 初始值（非受控）。
   */
  readonly defaultValue?: number
  /**
   * Called while the value changes, including during dragging.
   * @zh 值变化时调用，拖动过程中也会调用。
   */
  readonly onChange?: (value: number) => void
  /**
   * Called once when dragging ends or a key changes the value, such as to save it.
   * @zh 拖动结束或按键改变值时调用一次，如用于保存。
   */
  readonly onChangeComplete?: (value: number) => void
}

/**
 * Range: `range`
 * Two handles; `value`, `defaultValue` and the callbacks use a pair `[start, end]`, with `start <= end`.
 * @zh 范围：`range`
 * 两个手柄；`value`、`defaultValue` 与回调都用一对数值 `[起点, 终点]`，起点不大于终点。
 */
interface SliderRangeProps extends SliderCommonProps {
  /**
   * Picks a range `[start, end]` with two handles instead of one value.
   * @zh 用两个手柄选择范围 `[起点, 终点]`，而不是一个值。
   */
  readonly range: true
  /**
   * Current range (controlled).
   * @zh 当前范围（受控）。
   */
  readonly value?: readonly [number, number]
  /**
   * Initial range (uncontrolled).
   * @zh 初始范围（非受控）。
   */
  readonly defaultValue?: readonly [number, number]
  /**
   * Called while the range changes, including during dragging.
   * @zh 范围变化时调用，拖动过程中也会调用。
   */
  readonly onChange?: (value: [number, number]) => void
  /**
   * Called once when dragging ends or a key changes the range.
   * @zh 拖动结束或按键改变范围时调用一次。
   */
  readonly onChangeComplete?: (value: [number, number]) => void
}

/**
 * Props of Slider: one value, or a range with `range`.
 * @zh Slider 属性：一个值，或 `range` 时的范围。
 */
export type SliderProps = SliderSingleProps | SliderRangeProps

/**
 * Slider picks a number, or a range with `range`, by dragging a handle along a track. The track is a neutral fill
 * and the selected part uses the accent color. When the exact value matters, put an InputNumber next to it.
 *
 * **Interaction**: hovering or dragging a handle shows its value in a tooltip. `Tab` focuses a handle and shows the
 * focus ring; `←` / `→` (and `↑` / `↓`) change the value by one `step`, `Page Up` / `Page Down` by larger steps,
 * and `Home` / `End` go to the minimum and maximum.
 * @zh 滑块：沿轨道拖动手柄选择一个数值，`range` 时选择一个范围。轨道为中性填充，选中的部分用强调色。需要精确数值时
 * 在旁边配一个 InputNumber。
 *
 * **交互**：悬停或拖动手柄时用提示显示当前值。`Tab` 聚焦手柄并显示焦点环；`←` / `→`（以及 `↑` / `↓`）按 `step`
 * 调整，`Page Up` / `Page Down` 大步调整，`Home` / `End` 到最小值与最大值。
 * @category Basic
 * @usage Volume and zoom, opacity, price and size ranges in filters
 * @usageZh 音量与缩放、不透明度、筛选中的价格与尺寸范围
 */
export function Slider(props: SliderProps) {
  const {
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    ...rest
  } = props
  const label = useFieldLabel(props)
  // antd 把根元素上的 aria-* 留在外层 div 上；读屏名称要放在手柄（role="slider"）上
  return (
    <AntSlider
      {...(rest as Loose)}
      ariaLabelForHandle={ariaLabel}
      ariaLabelledByForHandle={label['aria-labelledby'] ?? ariaLabelledBy}
      ariaDescribedByForHandle={label['aria-describedby'] ?? ariaDescribedBy}
    />
  )
}

// —— ColorPicker ——

/**
 * A group of preset colors offered by ColorPicker.
 * @zh ColorPicker 提供的一组预设颜色。
 */
export interface ColorPreset {
  /**
   * Title of the group.
   * @zh 分组标题。
   */
  readonly label: ReactNode
  /**
   * Colors in the group, as CSS color strings such as `#2D6BF3`.
   * @zh 组内的颜色，CSS 颜色字符串，如 `#2D6BF3`。
   */
  readonly colors: readonly string[]
}

/** ColorPicker 自有的属性。 */
interface ColorPickerOwnProps {
  /**
   * Current color as a hex string (controlled), such as `#2d6bf3`, or `#2d6bf380` with transparency.
   * @zh 当前颜色（受控），十六进制字符串，如 `#2d6bf3`；带透明度时如 `#2d6bf380`。
   */
  readonly value?: string
  /**
   * Initial color (uncontrolled); any CSS color string.
   * @zh 初始颜色（非受控），任意 CSS 颜色字符串。
   */
  readonly defaultValue?: string
  /**
   * Called with the new color as a lowercase hex string (with alpha when it is not opaque).
   * @zh 颜色变化时调用，参数是小写的十六进制字符串（不透明时不带透明度）。
   */
  readonly onChange?: (value: string) => void
  /**
   * Groups of preset colors shown below the panel.
   * @zh 面板下方的预设颜色分组。
   */
  readonly presets?: readonly ColorPreset[]
  /**
   * Shows the value as text next to the swatch.
   * @zh 在色块旁以文字显示取值。
   */
  readonly showText?: boolean
  /**
   * Hides the alpha slider: the color is always opaque.
   * @zh 隐藏透明度滑块：颜色总是不透明。
   */
  readonly disabledAlpha?: boolean
  /**
   * Disables the picker.
   * @zh 禁用。
   */
  readonly disabled?: boolean
  /**
   * Size of the swatch.
   * @zh 色块的尺寸。
   */
  readonly size?: ControlSize
  /**
   * The panel is open (controlled).
   * @zh 面板是否打开（受控）。
   */
  readonly open?: boolean
  /**
   * Called when the panel opens or closes.
   * @zh 面板打开或关闭时调用。
   */
  readonly onOpenChange?: (open: boolean) => void
  /**
   * Accessible name of the built-in trigger; the built-in text by default ("Color"). Not used when `children`
   * provides a custom trigger.
   * @zh 内置触发块的读屏名称，默认为内置文本（「颜色」）。用 `children` 自定义触发元素时不使用。
   */
  readonly 'aria-label'?: string
  /**
   * Custom trigger instead of the swatch, such as a Button.
   * @zh 自定义的触发元素（代替色块），如 Button。
   */
  readonly children?: ReactElement
}

/**
 * Props of ColorPicker.
 * @zh ColorPicker 属性。
 */
export interface ColorPickerProps extends ColorPickerOwnProps {}

/** 打开面板的按键：与按钮一致。 */
const isActivation = (e: KeyboardEvent) => e.key === 'Enter' || e.key === ' '

/**
 * ColorPicker picks a color in a panel (saturation area, hue and alpha, a text field in HEX, RGB or HSB) and shows
 * it in a swatch; `presets` offers a set of colors to pick from, and `showText` shows the value next to the
 * swatch.
 *
 * **Interaction**: the swatch is a button: `Tab` focuses it and shows the focus ring, and `Enter` / `Space` or a
 * click open the panel, with focus moving into the panel. `Esc` closes it and focus returns to the swatch.
 * @zh 颜色选择：在面板中选择颜色（饱和度区域、色相与透明度、HEX / RGB / HSB 文本输入），结果显示在色块中；`presets`
 * 提供一组预设颜色，`showText` 在色块旁显示取值。
 *
 * **交互**：色块是一个按钮：`Tab` 聚焦并显示焦点环，`Enter` / 空格或点击打开面板，焦点移入面板；`Esc` 关闭，
 * 焦点回到色块。
 * @category Basic
 * @usage Label and tag colors, brand colors in settings, annotation colors
 * @usageZh 标签颜色、设置中的品牌色、标注颜色
 */
export function ColorPicker({
  open: openProp,
  onOpenChange,
  'aria-label': ariaLabel,
  onChange,
  size,
  ...rest
}: ColorPickerProps) {
  const t = useT()
  const label = useFieldLabel({ 'aria-label': ariaLabel })
  const [innerOpen, setInnerOpen] = useState(false)
  const open = openProp ?? innerOpen
  const change = (next: boolean) => {
    if (next && rest.disabled) return
    setInnerOpen(next)
    onOpenChange?.(next)
  }
  usePopupFocus(open, true, '.ant-popover')
  // antd 内置的触发块是一个不可聚焦的 div：补上按钮语义、Tab 顺序与 Enter / 空格打开（多余的属性由 antd 放到这个 div 上）
  const triggerProps: HTMLAttributes<HTMLDivElement> | undefined =
    rest.children === undefined
      ? {
          role: 'button',
          tabIndex: rest.disabled ? -1 : 0,
          'aria-label': ariaLabel ?? t('colorPicker.label'),
          ...label,
          'aria-haspopup': 'dialog',
          'aria-expanded': open,
          'aria-disabled': rest.disabled || undefined,
          onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
            if (!isActivation(e) || e.target !== e.currentTarget) return
            e.preventDefault()
            change(!open)
          },
        }
      : undefined
  return (
    <AntColorPicker
      {...(triggerProps as Loose)}
      {...(rest as Loose)}
      size={toAntSize(size)}
      onChange={onChange ? (color) => onChange(color.toHexString()) : undefined}
      open={open}
      onOpenChange={change}
    />
  )
}

// —— Cascader ——

/**
 * An option of Cascader; `children` are the options of the next level.
 * @zh Cascader 的一个选项；`children` 是下一级的选项。
 */
export interface CascaderOption<V = string> {
  /**
   * Value of the option.
   * @zh 选项的值。
   */
  readonly value: V
  /**
   * Text of the option.
   * @zh 选项的文字。
   */
  readonly label: ReactNode
  /**
   * Options of the next level.
   * @zh 下一级的选项。
   */
  readonly children?: readonly CascaderOption<V>[]
  /**
   * The option cannot be chosen.
   * @zh 选项不可选。
   */
  readonly disabled?: boolean
}

/** 单选与多选共有的属性。 */
interface CascaderCommonProps<V> extends FieldAttributes {
  /**
   * The options of the first level.
   * @zh 第一级的选项。
   */
  readonly options: readonly CascaderOption<V>[]
  /**
   * Text shown while nothing is chosen.
   * @zh 没有选择时显示的文字。
   */
  readonly placeholder?: string
  /**
   * Lets the user type to search across all levels.
   * @zh 可以输入文字在所有层级中搜索。
   */
  readonly showSearch?: boolean
  /**
   * Shows a clear button while something is chosen.
   * @zh 有选择时显示清除按钮。
   * @default true
   */
  readonly allowClear?: boolean
  /**
   * Disables the field.
   * @zh 禁用。
   */
  readonly disabled?: boolean
  /**
   * Fills the width of the container.
   * @zh 占满容器的宽度。
   */
  readonly block?: boolean
  /**
   * Size: `sm` in table rows and toolbars, `lg` for prominent forms. Without it, the size follows the density.
   * @zh 尺寸：`sm` 用于表格行内与工具栏，`lg` 用于醒目的表单。省略时随密度。
   */
  readonly size?: ControlSize
  /**
   * Appearance: `filled` (neutral background, the default) or `borderless`.
   * @zh 外观：`filled` 填充式（中性底，默认）或 `borderless` 无底色。
   * @default 'filled'
   */
  readonly variant?: 'filled' | 'borderless'
  /**
   * Validation status, usually set by Form.Item.
   * @zh 校验状态，通常由 Form.Item 设置。
   */
  readonly status?: 'error' | 'warning'
}

/**
 * Single selection (default)
 * The value is the path from the first level to the chosen option, such as `['asia', 'cn', 'shanghai']`; `null`
 * when nothing is chosen.
 * @zh 单选（默认）
 * 值是从第一级到所选选项的路径，如 `['asia', 'cn', 'shanghai']`；没有选择时为 `null`。
 */
interface CascaderSingleProps<V> extends CascaderCommonProps<V> {
  /**
   * Allows choosing several options; the value becomes an array of paths.
   * @zh 可以选择多个选项，值变为路径的数组。
   */
  readonly multiple?: false
  /**
   * With `multiple`: when all children of an option are chosen, show only the `parent` or only the `child`
   * options.
   * @zh 与 `multiple` 一起使用：某个选项的子选项全部选中时，只显示父选项（`parent`）或只显示子选项（`child`）。
   */
  readonly showChecked?: undefined
  /**
   * Path of the chosen option, from the first level (controlled), such as `['asia', 'cn', 'shanghai']`.
   * @zh 所选选项的路径，从第一级开始（受控），如 `['asia', 'cn', 'shanghai']`。
   */
  readonly value?: readonly V[] | null
  /**
   * Initial path (uncontrolled).
   * @zh 初始路径（非受控）。
   */
  readonly defaultValue?: readonly V[] | null
  /**
   * Called with the new path; `null` when cleared.
   * @zh 路径变化时调用；清除时为 `null`。
   */
  readonly onChange?: (value: V[] | null) => void
}

/**
 * Multiple selection: `multiple`
 * Options are chosen with checkboxes, and the value is an array of paths. Choosing an option chooses all its
 * children; `showChecked` decides whether a fully chosen option is kept as one path or as the paths of its children.
 * @zh 多选：`multiple`
 * 用复选框选择选项，值是路径的数组。选中一个选项即选中它的全部子选项；`showChecked` 决定全部选中的选项是作为一条
 * 路径保留，还是展开为各个子选项的路径。
 */
interface CascaderMultipleProps<V> extends CascaderCommonProps<V> {
  /**
   * Allows choosing several options; the value becomes an array of paths.
   * @zh 可以选择多个选项，值变为路径的数组。
   */
  readonly multiple: true
  /**
   * When all children of an option are chosen, show only the `parent` (the default) or only the `child` options.
   * @zh 某个选项的子选项全部选中时，只显示父选项（`parent`，默认）或只显示子选项（`child`）。
   * @default 'parent'
   */
  readonly showChecked?: 'parent' | 'child'
  /**
   * Paths of the chosen options (controlled).
   * @zh 所选选项的路径（受控）。
   */
  readonly value?: readonly (readonly V[])[] | null
  /**
   * Initial paths (uncontrolled).
   * @zh 初始路径（非受控）。
   */
  readonly defaultValue?: readonly (readonly V[])[] | null
  /**
   * Called with the new paths.
   * @zh 路径变化时调用。
   */
  readonly onChange?: (value: V[][]) => void
}

/**
 * Props of Cascader: one path by default, several with `multiple`.
 * @zh Cascader 属性：默认选择一条路径，`multiple` 时选择多条。
 */
export type CascaderProps<V = string> = CascaderSingleProps<V> | CascaderMultipleProps<V>

/**
 * Cascader picks a value from options nested in several levels, such as region → city → district or category →
 * subcategory; each level opens in its own column. Add `showSearch` to search across all levels, and `multiple` for
 * several values.
 *
 * **Interaction**: filled input like Select. `↓` or `Enter` opens the columns; `↑` / `↓` move within a column,
 * `→` opens the next level and `←` goes back; `Enter` picks the highlighted option; `Esc` closes the columns. Focus
 * stays in the input.
 * @zh 级联选择：从多层嵌套的选项中选择，如地区 → 城市 → 区县、分类 → 子分类，每一层在单独的一列中展开。`showSearch`
 * 跨层级搜索，`multiple` 多选。
 *
 * **交互**：与 Select 一样是填充式。`↓` 或 `Enter` 展开；`↑` / `↓` 在列内移动，`→` 展开下一层，`←` 返回上一层；
 * `Enter` 选中高亮的选项；`Esc` 收起。焦点始终在输入框中。
 * @category Basic
 * @usage Regions and addresses, nested categories, choosing a folder by path
 * @usageZh 地区与地址、多级分类、按路径选择文件夹
 */
export function Cascader<V = string>(props: CascaderProps<V>) {
  const { block, size, showChecked, value, defaultValue, onChange, ...rest } = props
  const label = useFieldLabel(rest)
  return (
    <AntCascader
      {...(rest as Loose)}
      {...label}
      onChange={
        onChange ? (v: unknown) => (onChange as (v: unknown) => void)(v ?? null) : undefined
      }
      value={(value === null ? undefined : value) as never}
      defaultValue={(defaultValue === null ? undefined : defaultValue) as never}
      // 静态成员（AntCascader.SHOW_PARENT 等）的值就是这些字符串；不在模块顶层读取，以免打包工具保留整个 Cascader
      showCheckedStrategy={
        showChecked === 'child'
          ? 'SHOW_CHILD'
          : showChecked === 'parent'
            ? 'SHOW_PARENT'
            : undefined
      }
      size={toAntSize(size)}
      className={withInjected(block ? styles.block : undefined, rest)}
    />
  )
}

// —— AutoComplete ——

/**
 * A suggestion of AutoComplete.
 * @zh AutoComplete 的一个建议。
 */
export interface AutoCompleteOption {
  /**
   * Text filled into the field when the suggestion is chosen.
   * @zh 选择这个建议时填入框中的文字。
   */
  readonly value: string
  /**
   * Content shown in the list; `value` by default.
   * @zh 在列表中显示的内容，默认是 `value`。
   */
  readonly label?: ReactNode
}

/** AutoComplete 自有的属性。 */
interface AutoCompleteOwnProps extends FieldAttributes {
  /**
   * The suggestions, usually filtered in `onSearch`.
   * @zh 建议，通常在 `onSearch` 中筛选。
   */
  readonly options?: readonly AutoCompleteOption[]
  /**
   * Current text (controlled).
   * @zh 当前文字（受控）。
   */
  readonly value?: string
  /**
   * Initial text (uncontrolled).
   * @zh 初始文字（非受控）。
   */
  readonly defaultValue?: string
  /**
   * Called with the new text, when typing or choosing a suggestion.
   * @zh 文字变化时调用，包括输入与选择建议。
   */
  readonly onChange?: (value: string) => void
  /**
   * Called with the typed text, to update the suggestions.
   * @zh 输入文字时调用，用于更新建议。
   */
  readonly onSearch?: (text: string) => void
  /**
   * Called when a suggestion is chosen.
   * @zh 选择一个建议时调用。
   */
  readonly onSelect?: (value: string) => void
  /**
   * Filters the suggestions by the typed text: `true` keeps those that contain it (ignoring case), or a function.
   * Leave it out when `onSearch` already filters them.
   * @zh 按输入的文字筛选建议：`true` 保留包含它的建议（不区分大小写），也可以是函数。在 `onSearch` 中已经筛选时省略。
   */
  readonly filterOption?: boolean | ((text: string, option: AutoCompleteOption) => boolean)
  /**
   * Text shown while the field is empty.
   * @zh 框为空时显示的文字。
   */
  readonly placeholder?: string
  /**
   * Shows a clear button while the field has text.
   * @zh 有文字时显示清除按钮。
   */
  readonly allowClear?: boolean
  /**
   * Disables the field.
   * @zh 禁用。
   */
  readonly disabled?: boolean
  /**
   * Fills the width of the container.
   * @zh 占满容器的宽度。
   */
  readonly block?: boolean
  /**
   * Size: `sm` in table rows and toolbars, `lg` for prominent forms. Without it, the size follows the density.
   * @zh 尺寸：`sm` 用于表格行内与工具栏，`lg` 用于醒目的表单。省略时随密度。
   */
  readonly size?: ControlSize
  /**
   * Appearance: `filled` (neutral background, the default) or `borderless`.
   * @zh 外观：`filled` 填充式（中性底，默认）或 `borderless` 无底色。
   * @default 'filled'
   */
  readonly variant?: 'filled' | 'borderless'
  /**
   * Validation status, usually set by Form.Item.
   * @zh 校验状态，通常由 Form.Item 设置。
   */
  readonly status?: 'error' | 'warning'
}

/**
 * Props of AutoComplete.
 * @zh AutoComplete 属性。
 */
export interface AutoCompleteProps extends AutoCompleteOwnProps {}

const containsText = (text: string, option: AutoCompleteOption) =>
  option.value.toLowerCase().includes(text.toLowerCase())

/**
 * AutoComplete is a text input that suggests values while typing; unlike Select, any text can be entered. Provide
 * the suggestions with `options`, usually filtered in `onSearch`.
 *
 * **Interaction**: filled input like Input. Suggestions open while typing; `↑` / `↓` move the highlight, `Enter`
 * fills in the highlighted suggestion and `Esc` closes the list without changing the text. Focus stays in the
 * input.
 * @zh 自动补全：输入时给出建议的文本输入框；与 Select 不同，可以输入任意文字。建议用 `options` 给出，通常在
 * `onSearch` 中过滤。
 *
 * **交互**：与 Input 一样是填充式。输入时展开建议；`↑` / `↓` 移动高亮，`Enter` 填入高亮的建议，`Esc` 收起建议而不改变
 * 文字。焦点始终在输入框中。
 * @category Basic
 * @usage Email addresses and domains, tags, search with suggestions
 * @usageZh 邮箱地址与域名、标签、带建议的搜索
 */
export function AutoComplete({ block, size, filterOption, onChange, ...rest }: AutoCompleteProps) {
  const label = useFieldLabel(rest)
  return (
    <AntAutoComplete
      {...(rest as Loose)}
      {...label}
      // 清除时 antd 给 undefined：文字输入的「空」是空字符串
      onChange={onChange ? (v: string | undefined) => onChange(v ?? '') : undefined}
      filterOption={
        filterOption === true
          ? (text: string, option?: AutoCompleteOption) =>
              option ? containsText(text, option) : false
          : typeof filterOption === 'function'
            ? (text: string, option?: AutoCompleteOption) =>
                option ? filterOption(text, option) : false
            : filterOption
      }
      size={toAntSize(size)}
      className={withInjected(block ? styles.block : undefined, rest)}
    />
  )
}
