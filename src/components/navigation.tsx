/**
 * 导航组件：步骤条、面包屑。antd 只作为内部实现；对外的属性与每一项的数据由本库声明（ADR 0021），
 * 外观由令牌统一定义：步骤条的当前步骤用强调色，已完成的步骤显示 Lucide 的勾；面包屑的分隔符是 Lucide 的
 * 右箭头，最后一项是当前页（`aria-current="page"`）。
 */
import {
  Breadcrumb as AntBreadcrumb,
  type BreadcrumbProps as AntBreadcrumbProps,
  Steps as AntSteps,
} from 'antd'
import type { AriaAttributes, MouseEvent, ReactNode } from 'react'
import { useT } from '../i18n/index.ts'
import { Icon } from './Icon.tsx'
import styles from './navigation.module.css'
import { Dropdown, type DropdownMenu } from './overlays.tsx'

// —— Steps ——

/**
 * A step of Steps.
 * @zh Steps 的一个步骤。
 */
export interface StepsItem {
  /**
   * Name of the step.
   * @zh 步骤的名称。
   */
  readonly title: ReactNode
  /**
   * Text below the title, such as what the step is about or when it was done.
   * @zh 标题下方的文字，如步骤的内容或完成时间。
   */
  readonly content?: ReactNode
  /**
   * The step cannot be clicked (only matters with `onChange`).
   * @zh 不能点击这个步骤（只在提供 `onChange` 时有意义）。
   */
  readonly disabled?: boolean
}

/** Steps 自有的属性。 */
interface StepsOwnProps {
  /**
   * The steps: `title`, optional `content` below the title, and `disabled`. Steps before `current` are finished,
   * the step at `current` is in progress and the rest are waiting.
   * @zh 各个步骤：`title`、标题下方的 `content` 与 `disabled`。`current` 之前的步骤为已完成，`current` 为进行中，
   * 之后的为等待。
   */
  readonly items: readonly StepsItem[]
  /**
   * Index of the current step, starting at 0.
   * @zh 当前步骤的序号，从 0 开始。
   * @default 0
   */
  readonly current?: number
  /**
   * Status of the current step: `error` marks it as failed.
   * @zh 当前步骤的状态：`error` 表示失败。
   * @default 'process'
   */
  readonly status?: 'wait' | 'process' | 'finish' | 'error'
  /**
   * Called with the index of a step when it is clicked; without it, the steps cannot be clicked.
   * @zh 点击步骤时调用，参数是该步骤的序号；不提供时步骤不能点击。
   */
  readonly onChange?: (current: number) => void
  /**
   * Direction: `vertical` for narrow columns.
   * @zh 方向：窄列中用 `vertical`。
   * @default 'horizontal'
   */
  readonly orientation?: 'horizontal' | 'vertical'
  /**
   * Size: `sm` for dense layouts.
   * @zh 尺寸：紧凑布局用 `sm`。
   * @default 'md'
   */
  readonly size?: 'sm' | 'md'
  /**
   * Accessible name of the steps, such as "Checkout progress".
   * @zh 步骤条的读屏名称，如「下单进度」。
   */
  readonly 'aria-label'?: string
}

/**
 * Props of Steps.
 * @zh Steps 属性。
 */
export interface StepsProps extends StepsOwnProps {}

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
export function Steps(props: StepsProps) {
  const { items, current = 0, status, onChange, orientation, size } = props
  return (
    <AntSteps
      current={current}
      status={status}
      onChange={onChange}
      orientation={orientation}
      size={size === 'sm' ? 'small' : undefined}
      aria-label={props['aria-label']}
      items={items.map(
        ({ title, content, disabled }, index) =>
          // 其余字段由 rc-steps 原样放到步骤元素上：当前步骤带 aria-current
          ({
            title,
            content,
            disabled,
            ...(index === current ? { 'aria-current': 'step' } : {}),
          }) as { title: ReactNode } & AriaAttributes,
      )}
      iconRender={(node, info) => {
        // 已完成、出错的步骤用 Lucide 的勾与叉，替换 antd 的图标
        const itemStatus = info.item.status
        return itemStatus === 'finish' || itemStatus === 'error' ? (
          <info.components.Icon>
            <span className={styles.stepIcon}>
              <Icon name={itemStatus === 'finish' ? 'check' : 'close'} size={STEP_ICON_SIZE} />
            </span>
          </info.components.Icon>
        ) : (
          node
        )
      }}
    />
  )
}

// —— Breadcrumb ——

/**
 * An item of a Breadcrumb.
 * @zh Breadcrumb 的一项。
 */
export interface BreadcrumbItem {
  /**
   * Text of the item.
   * @zh 这一项的文字。
   */
  readonly title: ReactNode
  /**
   * Address the item links to.
   * @zh 这一项链接到的地址。
   */
  readonly href?: string
  /**
   * Called when the item is clicked. An item with `onClick` and without `href` is rendered as a button.
   * @zh 点击这一项时调用。有 `onClick`、没有 `href` 的项渲染为按钮。
   */
  readonly onClick?: (event: MouseEvent<HTMLElement>) => void
  /**
   * A dropdown menu opened by the item, such as sibling folders; the item is then a button.
   * @zh 这一项打开的下拉菜单，如同级文件夹；这时这一项是按钮。
   */
  readonly menu?: DropdownMenu
}

/** Breadcrumb 自有的属性。 */
interface BreadcrumbOwnProps {
  /**
   * The path from the top level to the current page; the last item is the current page and is not a link. Items
   * with `href` are links; items with only `onClick` are rendered as buttons; items with `menu` are buttons that open
   * a dropdown menu (such as sibling folders).
   * @zh 从顶层到当前页面的路径；最后一项是当前页，不是链接。带 `href` 的项是链接；只有 `onClick` 的项渲染为按钮；
   * 带 `menu` 的项是打开下拉菜单（如同级文件夹）的按钮。
   */
  readonly items: readonly BreadcrumbItem[]
  /**
   * Accessible name of the navigation landmark; the built-in text by default ("Breadcrumb").
   * @zh 导航区域的读屏名称，默认为内置文本（「面包屑」）。
   */
  readonly 'aria-label'?: string
}

/**
 * Props of Breadcrumb.
 * @zh Breadcrumb 属性。
 */
export interface BreadcrumbProps extends BreadcrumbOwnProps {}

type AntBreadcrumbItem = NonNullable<AntBreadcrumbProps['items']>[number]

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
export function Breadcrumb({ items, 'aria-label': ariaLabel }: BreadcrumbProps) {
  const t = useT()
  const last = items.length - 1
  return (
    <AntBreadcrumb
      aria-label={ariaLabel ?? t('breadcrumb.label')}
      separator={
        <span className={styles.separator}>
          <Icon name="chevron-right" size={14} />
        </span>
      }
      items={items.map(({ title, href, onClick, menu }, index): AntBreadcrumbItem => {
        if (index === last) return { title, 'aria-current': 'page' } as AntBreadcrumbItem
        // 带菜单的项：antd 的触发元素是不可聚焦的 span、悬停打开，改为按钮 + Dropdown（点击打开，焦点进出与 Dropdown 一致）
        if (menu)
          return {
            title: (
              <Dropdown trigger={['click']} menu={menu}>
                <button
                  type="button"
                  className={styles.crumbButton}
                  data-vl-state=""
                  onClick={onClick}
                >
                  {title}
                  <span className={styles.menuIcon}>
                    <Icon name="chevron-down" size={12} />
                  </span>
                </button>
              </Dropdown>
            ),
          }
        // 只有点击事件、没有链接的项：antd 渲染为不可聚焦的 span，改为真正的按钮，键盘才能操作
        if (onClick && href === undefined)
          return {
            title: (
              <button
                type="button"
                className={styles.crumbButton}
                data-vl-state=""
                onClick={onClick}
              >
                {title}
              </button>
            ),
          }
        return { title, href, onClick }
      })}
    />
  )
}
