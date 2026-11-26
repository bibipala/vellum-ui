/**
 * ToolCalls：一次或多次工具调用 / 步骤，有序列表，步骤之间有连线。
 *
 * - 每步的状态用图标 + 文字表示（不只靠颜色）：等待、进行中、成功、失败、已取消。
 * - 有输入、输出的步骤可以展开查看详情（CodeBlock 显示 JSON），默认收起，长输出在代码块内滚动；
 *   失败的原因总是直接显示，不需要展开。
 * - 可以展开的步骤，标题是按钮（aria-expanded、aria-controls）。展开、收起与 Sources 相同（collapse.module.css）：
 *   高度沿弹簧变化，可以中途折返。aria-controls 指向的面板总是在，详情在第一次展开时才渲染，之后收起也保留，只是隐藏。
 */
import { memo, useId, useMemo, useState } from 'react'
import { type MessageKey, useT } from '../../i18n/index.ts'
import { CodeBlock } from '../CodeBlock.tsx'
import { Icon, type IconName, type IconProps } from '../Icon.tsx'
import type { BaseProps } from '../layout.tsx'
import loadingCss from '../loading.module.css'
import collapse from './collapse.module.css'
import styles from './tool-calls.module.css'

/**
 * State of a step: waiting to start, running, finished, failed, or cancelled.
 * @zh 步骤的状态：等待开始、进行中、已完成、失败、已取消。
 */
export type ToolCallStatus = 'pending' | 'running' | 'success' | 'error' | 'cancelled'

/**
 * One tool call or step of ToolCalls.
 * @zh ToolCalls 中的一次工具调用或一个步骤。
 */
export interface ToolCallItem {
  /**
   * Stable key of the step (the ID of the tool call).
   * @zh 步骤的稳定标识（工具调用的编号）。
   */
  readonly key: string
  /**
   * What the step does, such as "Search the web" or the name of the tool.
   * @zh 这一步做什么，如「搜索网页」或工具的名称。
   */
  readonly title: string
  /**
   * State of the step, always shown as an icon and a text.
   * @zh 步骤的状态，总是以图标加文字显示。
   */
  readonly status: ToolCallStatus
  /**
   * A short summary under the title, such as the query or the file name.
   * @zh 标题下的简短说明，如查询词或文件名。
   */
  readonly description?: string
  /**
   * The arguments of the call. Strings are shown as they are, other values as indented JSON.
   * @zh 调用的参数。字符串原样显示，其他值显示为带缩进的 JSON。
   */
  readonly input?: unknown
  /**
   * The result of the call. Strings are shown as they are, other values as indented JSON; long results scroll
   * inside their code block.
   * @zh 调用的结果。字符串原样显示，其他值显示为带缩进的 JSON；长结果在代码块内滚动。
   */
  readonly output?: unknown
  /**
   * Why the step failed, shown under the title without expanding the details.
   * @zh 步骤失败的原因，不需要展开详情就显示在标题下。
   */
  readonly error?: string
}

/**
 * Props of ToolCalls.
 * @zh ToolCalls 属性。
 */
export interface ToolCallsProps extends Pick<BaseProps, 'testId'> {
  /**
   * The steps, in order.
   * @zh 各个步骤，按顺序排列。
   */
  readonly items: readonly ToolCallItem[]
}

const STATUS: Record<
  ToolCallStatus,
  { readonly icon: IconName; readonly tone: IconProps['tone']; readonly text: MessageKey }
> = {
  pending: { icon: 'circle-dashed', tone: 'tertiary', text: 'toolCalls.pending' },
  running: { icon: 'loader', tone: 'accent', text: 'toolCalls.running' },
  success: { icon: 'check-circle', tone: 'success', text: 'toolCalls.success' },
  error: { icon: 'x-circle', tone: 'danger', text: 'toolCalls.error' },
  cancelled: { icon: 'ban', tone: 'tertiary', text: 'toolCalls.cancelled' },
}

/** 详情的文字：字符串原样显示，其他值写成带缩进的 JSON（无法序列化时用 String）。 */
export function detailText(value: unknown): string {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2) ?? String(value)
  } catch {
    return String(value)
  }
}

/**
 * 一步的详情：输入与输出的代码块。第一次展开时才渲染，之后收起也保留（选中的文字、滚动位置不丢）。
 * 序列化（带缩进的 JSON 可能很大）只在展开时做，并按输入、输出的身份缓存：其他步骤变化、消息流式更新时不重新序列化；
 * 收起时输入、输出变了也不序列化（详情已经隐藏），保留上次展开时的文字，下次展开时再换成当前的。
 */
const ToolDetails = memo(function ToolDetails(props: {
  readonly input: unknown
  readonly output: unknown
  readonly open: boolean
}) {
  const t = useT()
  // 展开时显示的输入与输出；还没有展开过时为 null（不序列化，也不渲染代码块）
  const [shown, setShown] = useState<{ readonly input: unknown; readonly output: unknown } | null>(
    null,
  )
  if (props.open && (!shown || shown.input !== props.input || shown.output !== props.output))
    setShown({ input: props.input, output: props.output })
  const shownInput = shown?.input
  const shownOutput = shown?.output
  const input = useMemo(
    () => (shownInput === undefined ? null : detailText(shownInput)),
    [shownInput],
  )
  const output = useMemo(
    () => (shownOutput === undefined ? null : detailText(shownOutput)),
    [shownOutput],
  )
  if (!shown) return null
  return (
    <div className={styles.details}>
      {input !== null && (
        <div className={styles.detail}>
          <span className={styles.detailLabel}>{t('toolCalls.input')}</span>
          <CodeBlock code={input} maxHeight="sm" copyable />
        </div>
      )}
      {output !== null && (
        <div className={styles.detail}>
          <span className={styles.detailLabel}>{t('toolCalls.output')}</span>
          <CodeBlock code={output} maxHeight="md" copyable />
        </div>
      )}
    </div>
  )
})

/**
 * A list of tool calls or steps of an AI agent, each with its state, and its input and output that can be
 * expanded. Use it for one call or for a chain of them; steps are connected by a line.
 *
 * **Interaction**: the state of each step is an icon and a text ("Running", "Failed"), never color alone; the
 * running icon spins (not with "reduce motion"). Steps with an input or output have a header button: hover and
 * press add the state layer, `Tab` shows the focus ring, `Enter` / `Space` expand the details, and it has
 * `aria-expanded` and `aria-controls`. Details are collapsed by default and show the input and output in code
 * blocks with a copy button; long output scrolls inside its block. Expanding and collapsing changes the height
 * along the spring, and toggling again halfway turns back from where it is (at once with "reduce motion").
 * The reason of a failure is always visible.
 * @zh AI 智能体的工具调用或步骤列表：每步有状态，输入与输出可以展开查看。一次调用或一串调用都用它，步骤之间有连线。
 *
 * **交互**：每步的状态是图标加文字（「进行中」「失败」），不只靠颜色；进行中的图标旋转（「减少动态效果」时不转）。
 * 有输入或输出的步骤，标题是按钮：悬停、按下叠加状态层，`Tab` 聚焦显示焦点环，`Enter` / `Space` 展开详情，带
 * `aria-expanded` 与 `aria-controls`。详情默认收起，输入与输出显示在带复制按钮的代码块中，长输出在块内滚动。
 * 展开、收起时高度沿弹簧变化，中途再次切换从当前高度折返（「减少动态效果」时立即完成）。失败的原因总是直接显示。
 * @category AI
 * @usage Tool calls of an agent (search, file reads, API calls), multi-step tasks, background jobs of an assistant
 * @usageZh 智能体的工具调用（搜索、读取文件、调用接口）、多步任务、助手的后台作业
 */
export function ToolCalls(props: ToolCallsProps) {
  const t = useT()
  const base = useId()
  const [expandedKeys, setExpandedKeys] = useState<readonly string[]>([])
  const toggle = (key: string) =>
    setExpandedKeys((keys) => (keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]))
  return (
    <div className={styles.root} data-testid={props.testId}>
      <ol className={styles.list}>
        {props.items.map((item, index) => {
          const status = STATUS[item.status]
          const collapsible = item.input !== undefined || item.output !== undefined
          const contentId = `${base}-${index}`
          const expanded = collapsible && expandedKeys.includes(item.key)
          const heading = (
            <>
              <span className={styles.title}>{item.title}</span>
              <span className={styles.status} data-status={item.status}>
                {t(status.text)}
              </span>
            </>
          )
          return (
            <li key={item.key} className={styles.item}>
              {/* 状态图标；它的 ::after 是通向下一步的连线 */}
              <span className={styles.itemIcon}>
                <span
                  className={
                    item.status === 'running' ? `${styles.icon} ${loadingCss.spin}` : styles.icon
                  }
                  data-status={item.status}
                >
                  <Icon name={status.icon} tone={status.tone} />
                </span>
              </span>
              <div className={styles.body}>
                <div className={styles.header}>
                  <div className={styles.heading}>
                    {collapsible ? (
                      <button
                        type="button"
                        className={styles.toggle}
                        data-vl-state=""
                        aria-expanded={expanded}
                        aria-controls={contentId}
                        onClick={() => toggle(item.key)}
                      >
                        {heading}
                        <span className={styles.chevron}>
                          <Icon name="chevron-right" size={14} />
                        </span>
                      </button>
                    ) : (
                      <span className={styles.label}>{heading}</span>
                    )}
                  </div>
                  {(item.description || item.error) && (
                    <div className={styles.subtitle}>
                      {item.description && (
                        <span className={styles.description}>{item.description}</span>
                      )}
                      {item.error && (
                        <span className={styles.error} data-tool-error="">
                          {item.error}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {collapsible && (
                  <div
                    id={contentId}
                    className={collapse.collapse}
                    data-expanded={expanded || undefined}
                  >
                    <div className={collapse.clip}>
                      <div className={styles.content}>
                        <ToolDetails input={item.input} output={item.output} open={expanded} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
