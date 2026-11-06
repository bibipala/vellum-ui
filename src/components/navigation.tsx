/**
 * 导航组件：步骤条、面包屑。antd 只作为内部实现；属性类型（含每一项的数据）去掉 style / className 等外观入口，
 * 外观由令牌统一定义：步骤条的当前步骤用强调色，已完成的步骤显示 Lucide 的勾；面包屑的分隔符是 Lucide 的
 * 右箭头，最后一项是当前页（`aria-current="page"`）。
 */
import {
  Breadcrumb as AntBreadcrumb,
  type BreadcrumbProps as AntBreadcrumbProps,
  Steps as AntSteps,
  type StepsProps as AntStepsProps,
  type BreadcrumbRef,
  type GetProp,
} from 'antd'
import type { AriaAttributes, ReactNode, RefAttributes } from 'react'
import { useT } from '../i18n/index.ts'
import { Icon } from './Icon.tsx'
import type { AnyValue, StyleKeys } from './internal.ts'
import styles from './navigation.module.css'
import { Dropdown, type DropdownProps } from './overlays.tsx'

/** 每一项数据上定制外观的属性。 */
type ItemStyleKeys = 'className' | 'style' | 'classNames' | 'styles'

// —— Steps ——

type AntStepItem = GetProp<AntStepsProps, 'items'>[number]

/** 步骤条的一项：`title`、`content`（说明）、`subTitle`、`icon`、`status`、`disabled`。 */
export type StepsItem = Omit<AntStepItem, ItemStyleKeys | 'description'>

/** Steps 已弃用的属性（antd 6 改名）。 */
type StepsDeprecatedKeys = 'direction' | 'labelPlacement' | 'progressDot'

/**
 * Props of Steps.
 * @zh Steps 属性。
 */
export interface StepsProps extends Omit<AntStepsProps, StyleKeys | StepsDeprecatedKeys | 'items'> {
  /**
   * The steps: `title`, optional `content` below the title, `subTitle`, `icon`, `status` and `disabled`. Steps before
   * `current` are finished, the step at `current` is in progress and the rest are waiting.
   * @zh 各个步骤：`title`、标题下方的 `content`、`subTitle`、`icon`、`status` 与 `disabled`。`current` 之前的步骤
   * 为已完成，`current` 为进行中，之后的为等待。
   */
  readonly items?: readonly StepsItem[]
  /**
   * Accessible name of the steps, such as "Checkout progress".
   * @zh 步骤条的读屏名称，如「下单进度」。
   */
  readonly 'aria-label'?: string
}

const STEP_ICON_SIZE = 14

/**
 * Steps show where the user is in a task of several steps. The current step uses the accent color and finished
 * steps show a check mark. With `onChange`, steps can be clicked to go back and forth.
 *
 * **Interaction**: the current step is marked with `aria-current="step"`. With `onChange`, each step is a button:
 * `Tab` focuses the steps one by one and shows the focus ring, and `Enter` / `Space` go to the focused step;
 * `disabled` steps are skipped.
 * @zh 步骤条：显示用户在多步任务中的位置。当前步骤用强调色，已完成的步骤显示勾。提供 `onChange` 时可以点击步骤来回切换。
 *
 * **交互**：当前步骤带 `aria-current="step"`。提供 `onChange` 时每个步骤都是按钮：`Tab` 逐个聚焦并显示焦点环，
 * `Enter` / 空格切换到该步骤；`disabled` 的步骤跳过。
 * @category Basic
 * @usage Multi-step forms and wizards, the progress of an approval, onboarding
 * @usageZh 分步表单与向导、审批进度、新手引导
 */
export function Steps({ items, iconRender, current = 0, initial = 0, ...rest }: StepsProps) {
  const dot = rest.type === 'dot' || rest.type === 'inline'
  return (
    <AntSteps
      {...rest}
      current={current}
      initial={initial}
      items={items?.map((item, index) =>
        // 其余字段由 rc-steps 原样放到步骤元素上：当前步骤带 aria-current
        index + initial === current
          ? ({ ...item, 'aria-current': 'step' } as AntStepItem & AriaAttributes)
          : item,
      )}
      iconRender={(node, info) => {
        // 已完成、出错的步骤用 Lucide 的勾与叉，替换 antd 的图标（自定义图标与点状步骤条不替换）
        const status = info.item.status
        const own =
          !dot && !info.item.icon && (status === 'finish' || status === 'error') ? (
            <info.components.Icon>
              <span className={styles.stepIcon}>
                <Icon name={status === 'finish' ? 'check' : 'close'} size={STEP_ICON_SIZE} />
              </span>
            </info.components.Icon>
          ) : (
            node
          )
        return iconRender ? iconRender(own, info) : own
      }}
    />
  )
}

// —— Breadcrumb ——

type AntBreadcrumbItem = NonNullable<AntBreadcrumbProps['items']>[number]

/**
 * 面包屑的一项：`title`、`href`（链接）、`onClick`（没有 `href` 时渲染为按钮）、`menu`（点击弹出的下拉菜单，菜单项为
 * `key`、`label`（或 `title`），`path` 是相对本项 `href` 的链接）。
 */
export type BreadcrumbItem = Omit<AntBreadcrumbItem, 'className' | 'style' | 'dropdownProps'>

type BreadcrumbMenu = NonNullable<BreadcrumbItem['menu']>

/** 面包屑项的下拉菜单：转成 Dropdown 的菜单（`path` 拼在本项的 `href` 后面作为链接，与 antd 相同）。 */
function toDropdownMenu(menu: BreadcrumbMenu, href: string | undefined): DropdownProps['menu'] {
  const { items: menuItems, ...menuProps } = menu
  return {
    ...menuProps,
    items: menuItems?.map(({ key, title, label, path, href: _href, ...other }, index) => {
      const text = label ?? title
      return {
        ...other,
        key: key ?? index,
        label: path ? <a href={`${href ?? ''}${path}`}>{text}</a> : text,
      }
    }),
  }
}

/**
 * Props of Breadcrumb.
 * @zh Breadcrumb 属性。
 */
export interface BreadcrumbProps<T extends Record<string, AnyValue> = Record<string, AnyValue>>
  extends Omit<AntBreadcrumbProps<T>, StyleKeys | 'routes' | 'items'>,
    RefAttributes<BreadcrumbRef> {
  /**
   * The path from the top level to the current page; the last item is the current page and is not a link. Items
   * with `href` are links; items with only `onClick` are rendered as buttons; items with `menu` are buttons that open
   * a dropdown menu (such as sibling folders).
   * @zh 从顶层到当前页面的路径；最后一项是当前页，不是链接。带 `href` 的项是链接；只有 `onClick` 的项渲染为按钮；
   * 带 `menu` 的项是打开下拉菜单（如同级文件夹）的按钮。
   */
  readonly items?: readonly BreadcrumbItem[]
  /**
   * Accessible name of the navigation landmark; the built-in text by default ("Breadcrumb").
   * @zh 导航区域的读屏名称，默认为内置文本（「面包屑」）。
   */
  readonly 'aria-label'?: string
}

/**
 * Breadcrumb shows where the current page is in the hierarchy and links to its parent pages. Use it on detail
 * pages several levels deep; the page title stays in the page header.
 *
 * **Interaction**: links and buttons in the path are secondary text; hover adds the state layer, and `Tab` focus
 * shows the focus ring. The last item is the current page (`aria-current="page"`) and is not interactive. An item
 * with `menu` opens its dropdown menu on click or `Enter`, like Dropdown: focus moves into the menu and returns to
 * the item after closing.
 * @zh 面包屑：显示当前页面在层级中的位置，并链接到上级页面。用于层级较深的详情页；页面标题仍放在页面头中。
 *
 * **交互**：路径中的链接与按钮为次要文字色，悬停叠加状态层，`Tab` 聚焦显示焦点环。最后一项是当前页
 * （`aria-current="page"`），不可交互。带 `menu` 的项点击或按 `Enter` 弹出下拉菜单，与 Dropdown 相同：焦点进入菜单，
 * 关闭后回到该项。
 * @category Basic
 * @usage Folder paths, the parent pages of a detail page, settings subpages
 * @usageZh 文件夹路径、详情页的上级页面、设置子页面
 */
export function Breadcrumb<T extends Record<string, AnyValue> = Record<string, AnyValue>>({
  items,
  separator,
  'aria-label': ariaLabel,
  ...rest
}: BreadcrumbProps<T>) {
  const t = useT()
  const last = (items?.length ?? 0) - 1
  return (
    <AntBreadcrumb<T>
      {...rest}
      aria-label={ariaLabel ?? t('breadcrumb.label')}
      separator={
        separator ?? (
          <span className={styles.separator}>
            <Icon name="chevron-right" size={14} />
          </span>
        )
      }
      items={items?.map((item, index): AntBreadcrumbItem => {
        if (index === last)
          return { ...item, onClick: undefined, href: undefined, 'aria-current': 'page' }
        // 带菜单的项：antd 的触发元素是不可聚焦的 span、悬停打开，改为按钮 + Dropdown（点击打开，焦点进出与 Dropdown 一致）
        if (item.menu) {
          const { menu, title, href, onClick, ...other } = item
          return {
            ...other,
            title: (
              <Dropdown trigger={['click']} menu={toDropdownMenu(menu, href)}>
                <button
                  type="button"
                  className={styles.crumbButton}
                  data-vl-state=""
                  onClick={onClick}
                >
                  {title as ReactNode}
                  <span className={styles.menuIcon}>
                    <Icon name="chevron-down" size={12} />
                  </span>
                </button>
              </Dropdown>
            ),
          }
        }
        // 只有点击事件、没有链接的项：antd 渲染为不可聚焦的 span，改为真正的按钮，键盘才能操作
        if (item.onClick && item.href === undefined && item.path === undefined) {
          const { onClick, title, ...other } = item
          return {
            ...other,
            title: (
              <button
                type="button"
                className={styles.crumbButton}
                data-vl-state=""
                onClick={onClick}
              >
                {title as ReactNode}
              </button>
            ),
          }
        }
        return item
      })}
    />
  )
}
