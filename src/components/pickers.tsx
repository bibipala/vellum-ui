/**
 * 选择类输入：滑块、颜色选择、时间选择、级联选择、自动补全。antd 只作为内部实现；属性类型去掉 style / className
 * 与弹层外观入口，外观由 ThemeProvider 的令牌（theme/antd.ts）与 base.css 的修正统一定义。
 * 输入框形态的组件（时间、级联、自动补全）与 Input、Select 一样是填充式（中性底、不描边，聚焦时强调色细边与光环）。
 */
import {
  AutoComplete as AntAutoComplete,
  type AutoCompleteProps as AntAutoCompleteProps,
  Cascader as AntCascader,
  type CascaderProps as AntCascaderProps,
  ColorPicker as AntColorPicker,
  type ColorPickerProps as AntColorPickerProps,
  Slider as AntSlider,
  type SliderRangeProps as AntSliderRangeProps,
  type SliderSingleProps as AntSliderSingleProps,
  TimePicker as AntTimePicker,
  type TimePickerProps as AntTimePickerProps,
  type CascaderRef,
  type GetProps,
  type GetRef,
  type SliderRef,
} from 'antd'
import type { DefaultOptionType as CascaderOption } from 'antd/es/cascader/index.js'
import type { BaseOptionType, DefaultOptionType } from 'antd/es/select/index.js'
import {
  type HTMLAttributes,
  type JSX,
  type KeyboardEvent,
  type RefAttributes,
  useState,
} from 'react'
import { useT } from '../i18n/index.ts'
import styles from './inputs.module.css'
import { type AnyValue, type PopupStyleKeys, type StyleKeys, withInjected } from './internal.ts'
import { usePopupFocus } from './overlays.tsx'

// —— Slider ——

/** Slider 中定制外观的属性（已弃用的 `vertical` 改用 `orientation`，`onAfterChange` 改用 `onChangeComplete`）。 */
type SliderOmitKeys =
  | StyleKeys
  | 'handleStyle'
  | 'trackStyle'
  | 'railStyle'
  | 'vertical'
  | 'onAfterChange'

/**
 * Props of a single-value Slider.
 * @zh 单值 Slider 的属性。
 */
export interface SliderSingleProps
  extends Omit<AntSliderSingleProps, SliderOmitKeys>,
    RefAttributes<SliderRef> {}

/**
 * Props of a range Slider (`range`): the value is `[start, end]`.
 * @zh 范围 Slider（`range`）的属性：取值为 `[起点, 终点]`。
 */
export interface SliderRangeProps
  extends Omit<AntSliderRangeProps, SliderOmitKeys>,
    RefAttributes<SliderRef> {}

/** Slider 属性：单值，或 `range` 时的范围。 */
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
  return <AntSlider {...props} />
}

// —— ColorPicker ——

/** 颜色值：`toHexString()`、`toRgbString()`、`toCssString()` 等方法得到字符串。 */
export type ColorValue = Parameters<NonNullable<AntColorPickerProps['onChange']>>[0]

/**
 * Props of ColorPicker.
 * @zh ColorPicker 属性。
 */
export interface ColorPickerProps extends Omit<AntColorPickerProps, StyleKeys> {
  /**
   * Accessible name of the built-in trigger; the built-in text by default ("Color"). Not used when `children`
   * provides a custom trigger.
   * @zh 内置触发块的读屏名称，默认为内置文本（「颜色」）。用 `children` 自定义触发元素时不使用。
   */
  readonly 'aria-label'?: string
}

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
  ...rest
}: ColorPickerProps) {
  const t = useT()
  const [innerOpen, setInnerOpen] = useState(false)
  const open = openProp ?? innerOpen
  const change = (next: boolean) => {
    if (next && rest.disabled) return
    setInnerOpen(next)
    onOpenChange?.(next)
  }
  usePopupFocus(open, (rest.trigger ?? 'click') === 'click', '.ant-popover')
  // antd 内置的触发块是一个不可聚焦的 div：补上按钮语义、Tab 顺序与 Enter / 空格打开（多余的属性由 antd 放到这个 div 上）
  const triggerProps: HTMLAttributes<HTMLDivElement> | undefined =
    rest.children === undefined
      ? {
          role: 'button',
          tabIndex: rest.disabled ? -1 : 0,
          'aria-label': ariaLabel ?? t('colorPicker.label'),
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
      {...(triggerProps as AntColorPickerProps)}
      {...rest}
      open={open}
      onOpenChange={change}
    />
  )
}

// —— TimePicker ——

/** 时间值（dayjs 对象）。 */
export type TimeValue = NonNullable<AntTimePickerProps['value']>

/**
 * Props of TimePicker.
 * @zh TimePicker 属性。
 */
export interface TimePickerProps
  extends Omit<AntTimePickerProps, StyleKeys | PopupStyleKeys | 'ref'>,
    RefAttributes<GetRef<typeof AntTimePicker>> {}

type AntTimeRangePickerProps = GetProps<typeof AntTimePicker.RangePicker>
/**
 * Props of TimePicker.RangePicker.
 * @zh TimePicker.RangePicker 属性。
 */
export interface TimeRangePickerProps
  extends Omit<AntTimeRangePickerProps, StyleKeys | PopupStyleKeys | 'ref'>,
    RefAttributes<GetRef<typeof AntTimePicker.RangePicker>> {}

function TimePickerRoot(props: TimePickerProps) {
  return <AntTimePicker {...props} />
}

function TimeRangePicker(props: TimeRangePickerProps) {
  return <AntTimePicker.RangePicker {...props} />
}

/** TimePicker 及其静态成员。 */
export interface TimePickerComponent {
  /** 渲染时间选择。 */
  (props: TimePickerProps): JSX.Element
  /** 时间范围选择：开始与结束两个时间。 */
  readonly RangePicker: (props: TimeRangePickerProps) => JSX.Element
}

/**
 * Time picker: picks a time of day from columns of hours, minutes and seconds, or by typing it; `format="HH:mm"`
 * hides the seconds and `minuteStep` sets the interval. Use `TimePicker.RangePicker` for a start and an end time.
 *
 * **Interaction**: filled input like Input. Clicking or pressing `Enter` opens the panel; typing a time and pressing
 * `Enter` confirms it; `Esc` closes the panel. Focus stays in the input.
 * @zh 时间选择：在时、分、秒列中选择一天中的时间，或直接输入；`format="HH:mm"` 不显示秒，`minuteStep` 设置间隔。
 * 起止时间用 `TimePicker.RangePicker`。
 *
 * **交互**：与 Input 一样是填充式。点击或按 `Enter` 打开面板；输入时间后按 `Enter` 确认；`Esc` 关闭面板。
 * 焦点始终在输入框中。
 * @category Basic
 * @usage Opening hours, reminder times, the time range of a shift
 * @usageZh 营业时间、提醒时间、班次的时间范围
 */
export const TimePicker: TimePickerComponent = /* @__PURE__ */ Object.assign(TimePickerRoot, {
  RangePicker: TimeRangePicker,
})

// —— Cascader ——

/** 级联选择的选项：`value`、`label`、`children`，可带 `disabled`、`isLeaf`。 */
export type CascaderOptionType = CascaderOption

/** Cascader 已弃用的外观入口。 */
type CascaderStyleKeys =
  | PopupStyleKeys
  | 'dropdownMenuColumnStyle'
  | 'popupMenuColumnStyle'
  | 'bordered'

/**
 * Props of Cascader.
 * @zh Cascader 属性。
 */
export interface CascaderProps<
  O extends CascaderOptionType = CascaderOptionType,
  Multiple extends boolean = boolean,
> extends Omit<AntCascaderProps<O, keyof O, Multiple>, StyleKeys | CascaderStyleKeys>,
    RefAttributes<CascaderRef> {
  /**
   * Fills the width of the container. Use it for cascaders in form fields, and outside forms when the cascader must
   * be as wide as other inputs.
   * @zh 占满容器宽度。表单项中的级联选择、表单以外需要与其他输入框等宽时使用。
   */
  readonly block?: boolean
}

function CascaderRoot<
  O extends CascaderOptionType = CascaderOptionType,
  Multiple extends boolean = boolean,
>({ block, ...rest }: CascaderProps<O, Multiple>) {
  const Cmp = AntCascader as unknown as (
    props: AntCascaderProps<O, keyof O, Multiple>,
  ) => JSX.Element
  return <Cmp {...rest} className={withInjected(block ? styles.block : undefined, rest)} />
}

/** Cascader 及其静态成员。 */
export interface CascaderComponent {
  /** 渲染级联选择。 */
  <O extends CascaderOptionType = CascaderOptionType, Multiple extends boolean = boolean>(
    props: CascaderProps<O, Multiple>,
  ): JSX.Element
  /** 多选的回填策略：子节点全选时只显示父节点。 */
  readonly SHOW_PARENT: typeof AntCascader.SHOW_PARENT
  /** 多选的回填策略：只显示子节点。 */
  readonly SHOW_CHILD: typeof AntCascader.SHOW_CHILD
}

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
export const Cascader: CascaderComponent = /* @__PURE__ */ Object.assign(CascaderRoot, {
  SHOW_PARENT: AntCascader.SHOW_PARENT,
  SHOW_CHILD: AntCascader.SHOW_CHILD,
})

// —— AutoComplete ——

/** AutoComplete 已弃用的外观入口与数据写法（`dataSource` 改用 `options`）。 */
type AutoCompleteOmitKeys = StyleKeys | PopupStyleKeys | 'dataSource'

/** 自动补全的引用：`focus()`、`blur()`、`scrollTo()`。 */
export type AutoCompleteRef = GetRef<typeof AntAutoComplete>

/**
 * Props of AutoComplete.
 * @zh AutoComplete 属性。
 */
export interface AutoCompleteProps<
  V = AnyValue,
  O extends BaseOptionType | DefaultOptionType = DefaultOptionType,
> extends Omit<AntAutoCompleteProps<V, O>, AutoCompleteOmitKeys>,
    RefAttributes<AutoCompleteRef> {
  /**
   * Fills the width of the container, like Select `block`.
   * @zh 占满容器宽度，与 Select 的 `block` 相同。
   */
  readonly block?: boolean
}

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
export function AutoComplete<
  V = AnyValue,
  O extends BaseOptionType | DefaultOptionType = DefaultOptionType,
>({ block, ...rest }: AutoCompleteProps<V, O>) {
  return (
    <AntAutoComplete<V, O>
      {...rest}
      className={withInjected(block ? styles.block : undefined, rest)}
    />
  )
}
