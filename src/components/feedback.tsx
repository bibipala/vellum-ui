/**
 * 反馈组件：空状态、错误状态、加载、页面骨架、危险操作确认。
 * 请求失败不应显示成空表；这些组件让每种状态都有统一的样子。
 */
import { App as AntApp, Input, Skeleton, Spin } from 'antd'
import { type ReactNode, useState } from 'react'
import { useT } from '../i18n/index.ts'
import { Button } from './basic.tsx'
import { EmptyArt } from './EmptyArt.tsx'
import { FocusScope } from './FocusScope.tsx'
import styles from './feedback.module.css'
import { Icon, type IconName } from './Icon.tsx'
import type { BaseProps } from './layout.tsx'

const base = (p: BaseProps) => ({
  'data-testid': p.testId,
  'aria-label': p['aria-label'],
  id: p.id,
})

/** EmptyState 属性。 */
export interface EmptyStateProps extends BaseProps {
  /**
   * Main text: why this place is empty, such as "No projects yet".
   * @zh 主文字：说明这里为什么是空的，如「还没有项目」。
   */
  readonly title?: ReactNode
  /**
   * Additional text: what the user can do next.
   * @zh 补充说明：下一步可以做什么。
   */
  readonly description?: ReactNode
  /**
   * Call to action, usually a primary button.
   * @zh 引导操作，通常是一个主按钮。
   */
  readonly action?: ReactNode
  /**
   * An icon instead of the default illustration (easier to understand when it relates to the content, such as a
   * folder or a message).
   * @zh 用图标代替默认插画（与内容相关时更易理解，如文件夹、消息）。
   */
  readonly icon?: IconName
  /**
   * Size: `md` for a whole page or a large area, `sm` inside lists and panels.
   * @zh 尺寸：md 用于整页或整块区域；sm 用于列表、面板内部。
   * @default 'md'
   */
  readonly size?: 'sm' | 'md'
  /**
   * Fills the height of the parent and centers the content.
   * @zh 占满父容器高度并居中。
   */
  readonly fill?: boolean
}

/**
 * Empty state: an icon or illustration, an explanation and a call to action. Use it when a list has no data, a
 * search has no results or nothing is selected.
 * @zh 空状态：图标或插画、说明与引导操作。列表无数据、搜索无结果、未选择内容时使用。
 * @category Feedback
 * @usage Empty lists, searches without results, nothing selected in a split view, features not configured yet
 * @usageZh 列表为空、搜索无结果、主从分栏未选择、功能尚未配置
 */
export function EmptyState(props: EmptyStateProps) {
  const t = useT()
  const size = props.size ?? 'md'
  return (
    <div
      {...base(props)}
      role={props.role ?? 'status'}
      className={styles.state}
      data-size={size}
      data-fill={props.fill || undefined}
    >
      {props.icon ? (
        <span className={styles.iconCircle}>
          <Icon name={props.icon} size={size === 'sm' ? 18 : 24} />
        </span>
      ) : (
        <EmptyArt size={size === 'sm' ? 56 : 88} />
      )}
      <div className={styles.text}>
        <div className={styles.title}>{props.title ?? t('empty.description')}</div>
        {props.description && <div className={styles.description}>{props.description}</div>}
      </div>
      {props.action}
    </div>
  )
}

/** ErrorState 属性。 */
export interface ErrorStateProps extends BaseProps {
  /**
   * Title, "Failed to load" by default.
   * @zh 标题，默认「加载失败」。
   */
  readonly title?: ReactNode
  /**
   * Description of the error: a text readable by users, converted from the error; never show the raw exception.
   * @zh 错误说明：转换后的用户可读文本，不要显示原始异常。
   */
  readonly message?: ReactNode
  /**
   * Retry: when provided, a "Retry" button is shown.
   * @zh 重试：提供后显示「重试」按钮。
   */
  readonly onRetry?: () => void
  /**
   * Size: `md` for a whole page or a large area, `sm` inside lists and panels.
   * @zh 尺寸：md 用于整页或整块区域；sm 用于列表、面板内部。
   * @default 'md'
   */
  readonly size?: 'sm' | 'md'
  /**
   * Fills the height of the parent and centers the content.
   * @zh 占满父容器高度并居中。
   */
  readonly fill?: boolean
}

/**
 * Error state: shown instead of the content when loading fails, with the reason and a way to retry. Never hide an
 * error behind an empty state or an empty table.
 * @zh 错误状态：加载失败时代替内容显示，说明原因并提供重试。不要用空状态或空表掩盖错误。
 * @category Feedback
 * @usage Failed requests for a list or details, lost connection to a service, missing permissions
 * @usageZh 列表或详情请求失败、服务连接失败、权限不足
 */
export function ErrorState(props: ErrorStateProps) {
  const t = useT()
  const size = props.size ?? 'md'
  return (
    <div
      {...base(props)}
      role={props.role ?? 'alert'}
      className={styles.state}
      data-size={size}
      data-fill={props.fill || undefined}
    >
      <span className={styles.iconCircle} data-tone="danger">
        <Icon name="alert" size={size === 'sm' ? 18 : 24} />
      </span>
      <div className={styles.text}>
        <div className={styles.title}>{props.title ?? t('error.title')}</div>
        {props.message && <div className={styles.description}>{props.message}</div>}
      </div>
      {props.onRetry && <Button onClick={props.onRetry}>{t('error.retry')}</Button>}
    </div>
  )
}

/** Loading 属性。 */
export interface LoadingProps extends BaseProps {
  /**
   * Text for screen readers and the tooltip, "Loading" by default.
   * @zh 读屏与提示文字，默认「加载中」。
   */
  readonly label?: string
  /**
   * Fills the height of the parent and centers the indicator (loading a whole area).
   * @zh 占满父容器高度并居中（整块区域加载）。
   */
  readonly fill?: boolean
  /**
   * Shows the indicator immediately, without the 200 ms delayed appearance. Only use it when the indicator is
   * controlled by useDelayedPending and mounted only while that is true, so the delay is not applied twice (for
   * example when old data stays visible during a refresh, with the indicator on top of it).
   * @zh 立即显示，不做 200ms 的延迟出现。只在加载指示由 useDelayedPending 控制、在它为 true 时才挂载的场景使用，
   * 避免重复延迟（如刷新时保留旧数据、在上面叠加载指示）。
   */
  readonly immediate?: boolean
}

/**
 * Loading indicator: a centered spinner. Pages with a known layout should use PageSkeleton instead; use this one
 * only for short, local loading.
 *
 * **Interaction**: stays invisible after mounting and fades in after 200 ms, so loads that finish quickly do not
 * flash an indicator; "stay visible for at least 400 ms once shown" is controlled with useDelayedPending. Not
 * interactive; screen readers announce "Loading".
 * @zh 加载指示：居中的旋转指示。已知结构的页面优先用 PageSkeleton，只有局部、短暂的加载用它。
 *
 * **交互**：挂载后先保持不可见，200ms 后才淡入，很快完成的加载不会闪出指示；「出现后至少显示 400ms」
 * 用 useDelayedPending 控制。不可交互，读屏读出「加载中」。
 * @category Feedback
 * @usage Short loading inside drawers, dialogs and panels
 * @usageZh 抽屉、弹窗、面板内部的短暂加载
 */
export function Loading(props: LoadingProps) {
  const t = useT()
  const label = props.label ?? t('spin.loading')
  return (
    <div
      {...base(props)}
      role="status"
      aria-label={label}
      className={styles.loading}
      data-fill={props.fill || undefined}
      data-immediate={props.immediate || undefined}
    >
      <Spin />
    </div>
  )
}

/** PageSkeleton 属性。 */
export interface PageSkeletonProps extends BaseProps {
  /**
   * Shape of the skeleton: `list` for list pages (title + list or table); `detail` for detail pages (title +
   * blocks of information); `split` for split view pages (list or navigation on the left + content on the right).
   * @zh 骨架形状：`list` 列表类页面（标题 + 列表或表格）；`detail` 详情类页面（标题 + 信息块）；
   * `split` 主从分栏页面（左侧列表或导航 + 右侧内容）。
   * @default 'list'
   */
  readonly variant?: 'list' | 'detail' | 'split'
  /**
   * Shows the skeleton immediately, without the 200 ms delayed appearance. Only use it when the skeleton is
   * controlled by useDelayedPending and mounted only while that is true, so the delay is not applied twice.
   * @zh 立即显示，不做 200ms 的延迟出现。只在骨架由 useDelayedPending 控制、在它为 true 时才挂载的场景使用，避免重复延迟。
   */
  readonly immediate?: boolean
}

/**
 * Page skeleton: replaces the whole page while its data loads for the first time; its shape is close to the final
 * page, which reduces layout shifts.
 *
 * **Interaction**: stays invisible after mounting and fades in after 200 ms, so loads that finish quickly do not
 * flash a skeleton; together with useDelayedPending, a skeleton that has appeared stays for at least 400 ms:
 * `if (query.isPending || showSkeleton) return <PageSkeleton />`. Not interactive.
 * @zh 页面骨架：页面数据首次加载时代替整页内容，形状接近最终页面，减少跳动。
 *
 * **交互**：挂载后先保持不可见，200ms 后才淡入，很快完成的加载不会闪出骨架；配合 useDelayedPending
 * 保证骨架一旦出现至少显示 400ms：`if (query.isPending || showSkeleton) return <PageSkeleton />`。不可交互。
 * @category Feedback
 * @usage First load of list pages, detail pages and split view pages
 * @usageZh 列表类、详情类、主从分栏页面的首次加载
 */
export function PageSkeleton(props: PageSkeletonProps) {
  const t = useT()
  const variant = props.variant ?? 'list'
  return (
    <div
      {...base(props)}
      role="status"
      aria-label={t('spin.loading')}
      aria-busy="true"
      className={styles.skeleton}
      data-variant={variant}
      data-immediate={props.immediate || undefined}
    >
      <Skeleton active title={{ width: '30%' }} paragraph={{ rows: 1, width: '50%' }} />
      {variant === 'split' ? (
        <div className={styles.skeletonSplit}>
          <Skeleton active title={false} paragraph={{ rows: 8 }} />
          <Skeleton active title={false} paragraph={{ rows: 8 }} />
        </div>
      ) : (
        <Skeleton active title={false} paragraph={{ rows: variant === 'detail' ? 6 : 8 }} />
      )}
    </div>
  )
}

/**
 * Options of a danger confirmation: what is passed to the `confirm` function returned by useConfirmDanger.
 * @zh 危险确认的选项：传给 useConfirmDanger 返回的 `confirm` 函数的参数。
 */
export interface ConfirmDangerOptions {
  /**
   * Title of the dialog, naming the action, such as "Delete project".
   * @zh 对话框标题，写明操作，如「删除项目」。
   */
  readonly title: string
  /**
   * The consequences: what is deleted and whether it can be restored.
   * @zh 后果说明：会删除什么、能否恢复。
   */
  readonly description: ReactNode
  /**
   * Text the user must type before "Confirm" is enabled, usually the name of the object (compared exactly,
   * case-sensitive). Without it, a click on "Confirm" is enough.
   * @zh 用户必须输入的确认文字，输入一致后「确认」才可用，通常是对象名称（完全一致，区分大小写）。不传时只需点击
   * 「确认」。
   */
  readonly confirmText?: string
  /**
   * Text of the confirm button, such as "Delete"; the built-in "Confirm" text of the current locale by default.
   * @zh 确认按钮的文字，如「删除」；默认为当前语言的内置文本「确认」。
   */
  readonly okText?: string
}

function ConfirmInput(props: { expected: string; onMatch: (ok: boolean) => void }) {
  const t = useT()
  const [value, setValue] = useState('')
  return (
    <div className={styles.confirmInput}>
      <div>{t('confirm.typeToConfirm', { name: props.expected })}</div>
      <Input
        autoFocus
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          props.onMatch(e.target.value === props.expected)
        }}
        data-testid="confirm-danger-input"
      />
    </div>
  )
}

/**
 * Danger confirmation: returns `confirm(options)`, which resolves to true when the user confirms. Irreversible
 * actions (deleting, clearing data) can require typing the name of the object before confirming. Must be used
 * inside `<App>`.
 *
 * **Interaction**: when the dialog opens, focus is on "Cancel" (pressing `Enter` does not confirm by accident);
 * when a name is required, focus is in the input and "Confirm" stays disabled until the name matches. `Tab`
 * cycles inside the dialog, `Esc` cancels, and focus returns to the element that was focused before opening.
 * @zh 危险操作确认：返回 `confirm(options)`，用户确认时 resolve 为 true。
 * 不可恢复的操作（删除、清除数据）要求输入对象名称后才能确认。必须在 `<App>` 之内使用。
 *
 * **交互**：打开后默认焦点在「取消」上（回车不会误确认）；要求输入名称时焦点在输入框中，输入一致前「确认」不可用。
 * `Tab` 在对话框内循环，`Esc` 取消，关闭后焦点回到打开前的元素。
 * @category Feedback
 * @usage Irreversible actions such as deleting, clearing data, transferring ownership or disbanding a team
 * @usageZh 删除、清除数据、移交所有权、解散团队等不可恢复的操作
 */
export function useConfirmDanger(): (options: ConfirmDangerOptions) => Promise<boolean> {
  const { modal } = AntApp.useApp()
  const t = useT()
  return (o) =>
    new Promise<boolean>((resolve) => {
      const needText = Boolean(o.confirmText)
      const m = modal.confirm({
        title: o.title,
        content: (
          <div className={styles.confirmBody}>
            <div>{o.description}</div>
            {o.confirmText && (
              <ConfirmInput
                expected={o.confirmText}
                onMatch={(ok) => m.update({ okButtonProps: { danger: true, disabled: !ok } })}
              />
            )}
            <FocusScope active />
          </div>
        ),
        okText: o.okText ?? t('confirm.ok'),
        cancelText: t('confirm.cancel'),
        // 危险确认的默认焦点在「取消」上（antd 默认在「确认」上）；要求输入名称时焦点在输入框中（autoFocus）
        focusable: { autoFocusButton: needText ? null : 'cancel' },
        okButtonProps: { danger: true, disabled: needText },
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      })
    })
}
