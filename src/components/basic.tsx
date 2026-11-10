/**
 * 基础与数据组件：在 Ant Design 6 之上的封装。使用方从本包取用这些组件，不直接导入 antd。
 * 外观由 ThemeProvider 注入的令牌控制；这里补充 i18n 默认文本、按钮交互与标题层级。
 */
import { Button as AntButton, Empty as AntEmpty } from 'antd'
import type { ButtonHTMLAttributes, CSSProperties, MouseEvent, ReactNode, Ref } from 'react'
import { useId } from 'react'
import { useT } from '../i18n/index.ts'
import styles from './basic.module.css'
import { EmptyArt } from './EmptyArt.tsx'
import { Icon, type IconName } from './Icon.tsx'
import { type NativeProps, toAntSize, withInjected } from './internal.ts'
import { DisabledReasonTooltip } from './overlays.tsx'

const cx = (...names: (string | undefined | false)[]) => names.filter(Boolean).join(' ')

/**
 * Size of a control: `sm` inside table rows and toolbars, `md` by default, `lg` for prominent forms such as the
 * sign-in page.
 * @zh 控件尺寸：`sm` 用于表格行内与工具栏，`md` 为默认，`lg` 用于醒目的表单（如登录页）。
 */
export type ControlSize = 'sm' | 'md' | 'lg'

/** Button 自有的属性；其余是原生 button 元素的属性。 */
interface ButtonOwnProps {
  /**
   * Appearance: `primary` for the main action (solid accent color, at most one per area), `default` for
   * secondary actions (neutral fill), `dashed` for adding something to a list, `text` for a neutral text button
   * (a background appears on hover). For accent-colored text links, use LinkButton.
   * @zh 外观：`primary` 主操作（强调色实心，每个区域最多一个），`default` 次要操作（中性填充），`dashed`
   * 向列表添加内容，`text` 中性文字按钮（悬停出现底色）。强调色的文字链接用 LinkButton。
   * @default 'default'
   */
  readonly variant?: 'primary' | 'default' | 'dashed' | 'text'
  /**
   * Semantic color: `danger` for destructive actions such as deleting; combine it with any `variant`.
   * @zh 语义色：`danger` 用于删除等危险操作，可以与任意 `variant` 组合。
   */
  readonly tone?: 'danger'
  /**
   * Size: `sm` in table rows and toolbars, `lg` for prominent forms. Without it, the size follows the density.
   * @zh 尺寸：`sm` 用于表格行内与工具栏，`lg` 用于醒目的表单。省略时随密度。
   */
  readonly size?: ControlSize
  /**
   * Icon before the text, by name (like IconButton, LinkButton and menu items); its size follows `size`. For a
   * button with only an icon, use IconButton.
   * @zh 文字前的图标，写图标名（与 IconButton、LinkButton、菜单项一致），大小随 `size`。只有图标的按钮用 IconButton。
   */
  readonly icon?: IconName
  /**
   * Shows a loading indicator and ignores clicks; the width stays the same.
   * @zh 显示加载指示并忽略点击，宽度不变。
   */
  readonly loading?: boolean
  /**
   * Stretches the button to the width of its container.
   * @zh 占满容器的宽度。
   */
  readonly block?: boolean
  /**
   * Native button type: `submit` submits the enclosing form, `reset` resets it. The default is `button`, which
   * does neither (unlike a bare `<button>`).
   * @zh 原生按钮类型：`submit` 提交所在的表单，`reset` 重置表单。默认 `button`，两者都不做（与裸 `<button>` 不同）。
   * @default 'button'
   */
  readonly type?: 'button' | 'submit' | 'reset'
  /**
   * Turns the button into a link to this address (rendered as `<a>`).
   * @zh 把按钮变成指向这个地址的链接（输出为 `<a>`）。
   */
  readonly href?: string
  /**
   * Where the link opens, such as `_blank`; only with `href`.
   * @zh 链接在哪里打开，如 `_blank`；只在有 `href` 时有效。
   */
  readonly target?: string
  /**
   * Downloads the linked file instead of opening it; a string sets the file name. Only with `href`.
   * @zh 下载链接指向的文件而不是打开它；是字符串时作为文件名。只在有 `href` 时有效。
   */
  readonly download?: boolean | string
  /**
   * Relationship of the linked page, such as `nofollow`; only with `href`. With `target="_blank"` and no `rel`,
   * the button sets `noopener noreferrer`, so the opened page cannot reach this one through `window.opener`.
   * @zh 链接页面与当前页面的关系，如 `nofollow`；只在有 `href` 时有效。`target="_blank"` 且没有给 `rel` 时，按钮设为
   * `noopener noreferrer`，打开的页面不能通过 `window.opener` 访问当前页面。
   */
  readonly rel?: string
  /**
   * Disabled reason: an explanation shown on hover or keyboard focus while `disabled`, such as "You don't have
   * permission to delete" or "Select a file first". With a reason, the button can still be focused with `Tab`
   * (`aria-disabled`) and screen readers read the reason through `aria-describedby`; clicks, `Enter`, form
   * submission (`type="submit"`) and link navigation have no effect.
   * @zh 禁用原因：`disabled` 时悬停或键盘聚焦显示的说明，如「没有删除权限」「请先选择文件」。
   * 提供后按钮仍可用 Tab 聚焦（`aria-disabled`），读屏通过 `aria-describedby` 读出原因；
   * 点击、回车、表单提交（`type="submit"`）与链接跳转都不会生效。
   */
  readonly disabledReason?: string
  /**
   * Button text.
   * @zh 按钮文字。
   */
  readonly children?: ReactNode
  /**
   * The rendered `<button>` (or `<a>` with `href`).
   * @zh 渲染出的 `<button>`（有 `href` 时是 `<a>`）。
   */
  readonly ref?: Ref<HTMLButtonElement | HTMLAnchorElement>
}

/**
 * Props of Button.
 * @zh Button 属性。
 */
export interface ButtonProps
  extends ButtonOwnProps,
    // 原生的 color 属性早已废弃，而 antd 的 color 是另一种写法（预设色），不接收
    Omit<NativeProps<ButtonHTMLAttributes<HTMLButtonElement>, ButtonOwnProps>, 'color'> {}

const preventClick = (e: MouseEvent) => e.preventDefault()

/**
 * Buttons trigger an action. Use `variant="primary"` for the primary action (at most one per area), add
 * `tone="danger"` for destructive actions, and use the default style for secondary actions. For accent-colored
 * text actions in table rows, on cards and next to body text, use LinkButton.
 *
 * **Interaction**: hover and press change the color according to the theme tokens (press takes effect
 * immediately and recovers 120 ms after release, without scaling); `Tab` focus shows the focus ring, and
 * `Enter` / `Space` trigger the button. While `loading`, the width stays the same and clicks are ignored: a button
 * with an icon replaces the icon with the loading indicator, a button without an icon keeps its text in place but
 * hidden, with the loading indicator centered. While `disabled`, it does not respond; with `disabledReason`, the
 * reason is shown on hover or focus.
 * @zh 按钮。主操作用 `variant="primary"`（每个区域最多一个），危险操作加 `tone="danger"`，次要操作用默认样式。
 * 表格行内、卡片上与正文并排的强调色文字操作用 LinkButton。
 *
 * **交互**：悬停、按下按主题令牌变色（按下立即生效，松开 120ms 恢复，不缩放）；`Tab` 聚焦显示焦点环，
 * `Enter` / `Space` 触发。`loading` 时宽度不变、忽略点击：有图标的把图标换成加载指示，没有图标的文字保持占位但隐藏，
 * 加载指示居中。`disabled` 时不响应，提供 `disabledReason` 时悬停或聚焦显示原因。
 * @category Basic
 * @usage Primary action of a page header, form submission, confirming a dialog
 * @usageZh 页面头的主操作、表单提交、弹窗确认
 */
export function Button(props: ButtonProps) {
  const { icon, ...rest } = props
  return (
    <ButtonBase
      {...rest}
      icon={icon && <Icon name={icon} size={buttonIconSize(props.size)} />}
      iconSize={icon ? buttonIconSize(props.size) : undefined}
    />
  )
}

/** 按钮中图标的大小，与 IconButton 的同档尺寸一致。 */
const buttonIconSize = (size: ControlSize | undefined) =>
  size === 'lg' ? 18 : size === 'sm' ? 14 : 16

/**
 * 组件库内部的按钮：图标可以是任意元素（CopyButton 要给图标上色）。`iconSize` 是图标的像素大小，加载指示与它一样大。
 * 不从入口导出：公开的 Button 只接受图标名。
 */
export function ButtonBase(
  props: Omit<ButtonProps, 'icon'> & { icon?: ReactNode; iconSize?: number | undefined },
) {
  const {
    variant = 'default',
    tone,
    size,
    type = 'button',
    loading,
    download,
    rel,
    disabledReason,
    iconSize,
    ...rest
  } = props
  const reasonId = useId()
  // 有图标的按钮加载时，antd 把图标换成加载指示，指示的大小取按钮字号（1em，14px），比图标窄，按钮随之变窄：
  // 让加载指示与图标一样大
  const style =
    iconSize === undefined
      ? undefined
      : ({ '--button-icon-size': `${iconSize}px` } as CSSProperties)
  // 没有图标的按钮加载时，antd 会在文字前插入加载指示、按钮变宽；改为文字透明占位、指示居中
  const className = withInjected(
    rest.icon ? (iconSize === undefined ? undefined : styles.iconSized) : styles.textButton,
    rest,
  )
  const common = {
    ...rest,
    // 危险的次要按钮：浅红底配红字、不描边，与中性填充的次要按钮同一种形态（antd 默认是红色描边）
    ...(tone === 'danger' && variant === 'default'
      ? { color: 'danger' as const, variant: 'filled' as const }
      : { type: variant, danger: tone === 'danger' }),
    size: toAntSize(size),
    htmlType: type,
    loading,
    // antd 的类型没有 download，它把多余的属性原样交给 <a>
    ...(download === undefined ? {} : ({ download } as object)),
    rel: rest.href
      ? (rel ?? (rest.target === '_blank' ? 'noopener noreferrer' : undefined))
      : undefined,
  }
  if (!rest.disabled || !disabledReason)
    return <AntButton {...common} className={className} style={style} />
  // 原生 disabled 的按钮不能聚焦、也收不到鼠标事件，原因无从显示：改用 aria-disabled，外观沿用 antd 的禁用样式，
  // 并拦截点击。preventDefault 同时阻止表单提交（含输入框里按回车的隐式提交）与链接跳转
  return (
    <DisabledReasonTooltip id={reasonId} reason={disabledReason}>
      <AntButton
        {...common}
        disabled={false}
        href={undefined}
        aria-disabled
        aria-describedby={cx(rest['aria-describedby'], reasonId)}
        className={cx(className, 'ant-btn-disabled')}
        style={style}
        onClick={preventClick}
      />
    </DisabledReasonTooltip>
  )
}

/**
 * 组件库内部的紧凑空状态：antd 组件（下拉选项、表格）没有数据时的占位。不从入口导出，对外用 EmptyState。
 */
export function BuiltinEmpty() {
  const t = useT()
  return (
    <AntEmpty image={<EmptyArt />} className={styles.empty} description={t('empty.description')} />
  )
}

/**
 * Props of Heading.
 * @zh Heading 属性。
 */
export interface HeadingProps {
  /**
   * Heading level, which sets both the element (`h1` … `h4`) and the size: 1 for the page title (usually rendered
   * by Page, 2xl), 2 for block titles (xl), 3 for subsection titles (lg), 4 for the lowest titles, at body size
   * (md). Section uses the same levels and sizes.
   * @zh 标题级别，同时决定元素（`h1` … `h4`）与字号：1 页面标题（通常由 Page 生成，2xl）、2 区块标题（xl）、
   * 3 小节标题（lg）、4 最低一级的标题，与正文同字号（md）。Section 的级别与字号与此相同。
   * @default 2
   */
  readonly level?: 1 | 2 | 3 | 4
  /**
   * Heading text.
   * @zh 标题文字。
   */
  readonly children?: ReactNode
}

/**
 * A heading whose font, weight and letter spacing come from tokens. Use Page for page titles and Section for
 * group titles; use Heading on its own only in other places.
 * @zh 标题：标题字体、字重与字距取令牌。页面标题用 Page，分组标题用 Section，其余场景才单独用它。
 * @category Basic
 * @usage Titles in dialogs, drawers and custom areas
 * @usageZh 弹窗、抽屉、自定义区域中的标题
 */
export function Heading({ level = 2, children }: HeadingProps) {
  const Tag = `h${level}` as const
  return <Tag className={cx(styles.heading, styles[`h${level}`])}>{children}</Tag>
}
