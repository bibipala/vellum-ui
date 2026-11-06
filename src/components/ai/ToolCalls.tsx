/**
 * ToolCalls：一次或多次工具调用 / 步骤（基于 @ant-design/x 的 ThoughtChain，只作为内部实现）。
 *
 * - 每步的状态用图标 + 文字表示（不只靠颜色）：等待、进行中、成功、失败、已取消。
 * - 有输入、输出的步骤可以展开查看详情（CodeBlock 显示 JSON），默认收起，长输出在代码块内滚动；
 *   失败的原因总是直接显示，不需要展开。
 * - X 的标题是可以点击的 div，键盘无法操作：这里在标题中放一个按钮（aria-expanded、aria-controls），
 *   点击冒泡到 X 的标题完成切换；X 自带的状态图标与展开图标换成本库的图标与文字。
 */
import ThoughtChainImport from '@ant-design/x/es/thought-chain/index.js'
import { useId, useState } from 'react'
import { type MessageKey, useT } from '../../i18n/index.ts'
import { CodeBlock } from '../CodeBlock.tsx'
import { Icon, type IconName, type IconProps } from '../Icon.tsx'
import type { BaseProps } from '../layout.tsx'
import styles from './tool-calls.module.css'
import { esModuleDefault } from './x-interop.ts'

const ThoughtChain = esModuleDefault(ThoughtChainImport)

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
 * A list of tool calls or steps of an AI agent, each with its state, and its input and output that can be
 * expanded. Use it for one call or for a chain of them; steps are connected by a line.
 *
 * **Interaction**: the state of each step is an icon and a text ("Running", "Failed"), never color alone; the
 * running icon spins (not with "reduce motion"). Steps with an input or output have a header button: hover and
 * press add the state layer, `Tab` shows the focus ring, `Enter` / `Space` expand the details, and it has
 * `aria-expanded` and `aria-controls`. Details are collapsed by default and show the input and output in code
 * blocks with a copy button; long output scrolls inside its block. The reason of a failure is always visible.
 * @zh AI 智能体的工具调用或步骤列表：每步有状态，输入与输出可以展开查看。一次调用或一串调用都用它，步骤之间有连线。
 *
 * **交互**：每步的状态是图标加文字（「进行中」「失败」），不只靠颜色；进行中的图标旋转（「减少动态效果」时不转）。
 * 有输入或输出的步骤，标题是按钮：悬停、按下叠加状态层，`Tab` 聚焦显示焦点环，`Enter` / `Space` 展开详情，带
 * `aria-expanded` 与 `aria-controls`。详情默认收起，输入与输出显示在带复制按钮的代码块中，长输出在块内滚动。
 * 失败的原因总是直接显示。
 * @category AI
 * @usage Tool calls of an agent (search, file reads, API calls), multi-step tasks, background jobs of an assistant
 * @usageZh 智能体的工具调用（搜索、读取文件、调用接口）、多步任务、助手的后台作业
 */
export function ToolCalls(props: ToolCallsProps) {
  const t = useT()
  const base = useId()
  const [expandedKeys, setExpandedKeys] = useState<string[]>([])
  const items = props.items.map((item, index) => {
    const status = STATUS[item.status]
    const hasInput = item.input !== undefined
    const hasOutput = item.output !== undefined
    const collapsible = hasInput || hasOutput
    const contentId = `${base}-${index}`
    const expanded = expandedKeys.includes(item.key)
    const heading = (
      <>
        <span className={styles.title}>{item.title}</span>
        <span className={styles.status} data-status={item.status}>
          {t(status.text)}
        </span>
      </>
    )
    return {
      key: item.key,
      icon: (
        <span className={styles.icon} data-status={item.status}>
          <Icon name={status.icon} tone={status.tone} />
        </span>
      ),
      title: collapsible ? (
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={expanded}
          aria-controls={contentId}
        >
          {heading}
          <span className={styles.chevron}>
            <Icon name="chevron-right" size={14} />
          </span>
        </button>
      ) : (
        <span className={styles.heading}>{heading}</span>
      ),
      description:
        item.description || item.error ? (
          <>
            {item.description && <span className={styles.description}>{item.description}</span>}
            {item.error && (
              <span className={styles.error} data-tool-error="">
                {item.error}
              </span>
            )}
          </>
        ) : undefined,
      content: collapsible ? (
        <div id={contentId} className={styles.details}>
          {hasInput && (
            <div className={styles.detail}>
              <span className={styles.detailLabel}>{t('toolCalls.input')}</span>
              <CodeBlock code={detailText(item.input)} maxHeight="sm" copyable />
            </div>
          )}
          {hasOutput && (
            <div className={styles.detail}>
              <span className={styles.detailLabel}>{t('toolCalls.output')}</span>
              <CodeBlock code={detailText(item.output)} maxHeight="md" copyable />
            </div>
          )}
        </div>
      ) : undefined,
      collapsible,
      destroyOnHidden: false,
    }
  })
  return (
    <div className={styles.root} data-testid={props.testId}>
      <ThoughtChain
        rootClassName={styles.x}
        classNames={{
          item: styles.item,
          itemHeader: styles.header,
          itemIcon: styles.itemIcon,
          itemContent: styles.content,
        }}
        items={items}
        expandedKeys={expandedKeys}
        onExpand={setExpandedKeys}
      />
    </div>
  )
}
