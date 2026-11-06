/**
 * Reasoning：思考过程（基于 @ant-design/x 的 Think，只作为内部实现）。
 *
 * - 思考中：旋转的加载指示（不用渐变、闪光等装饰动画）与「Thinking」；已完成：「Thought for 12s」（时长本地化）。
 * - 思考中自动展开、完成后自动收起；用户手动展开或收起过之后就不再自动改变。
 * - X 的标题行是一个可以点击的 div，键盘无法操作：这里在标题中放一个按钮（aria-expanded、aria-controls），
 *   点击冒泡到 X 的标题行完成切换；X 自带的展开图标换成本库的图标。
 * - 收起时保留内容节点（aria-controls 指向它，只是不显示）。
 */
import ThinkImport from '@ant-design/x/es/think/index.js'
import { type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { useT } from '../../i18n/index.ts'
import { Icon } from '../Icon.tsx'
import type { BaseProps } from '../layout.tsx'
import { formatDuration } from './duration.ts'
import styles from './reasoning.module.css'
import { esModuleDefault } from './x-interop.ts'

const Think = esModuleDefault(ThinkImport)

/**
 * Props of Reasoning.
 * @zh Reasoning 属性。
 */
export interface ReasoningProps extends Pick<BaseProps, 'testId'> {
  /**
   * The model is still thinking: a loading indicator and "Thinking" are shown, and the content is expanded.
   * When it becomes `false`, the content collapses (unless the user has expanded or collapsed it).
   * @zh 模型还在思考：显示加载指示与「思考中」，内容展开。变为 `false` 时内容自动收起（用户手动展开或收起过的除外）。
   * @default false
   */
  readonly thinking?: boolean
  /**
   * How long the thinking took, in milliseconds, shown as "Thought for 12s". When omitted, the time between
   * `thinking` turning on and off is measured; when that is unknown too (for example a conversation opened again
   * later), the header says "Thought process".
   * @zh 思考用时（毫秒），显示为「已思考 12 秒」。省略时测量 `thinking` 从开到关的时间；也无法测量时（如之后重新打开的
   * 对话），标题为「思考过程」。
   */
  readonly duration?: number
  /**
   * The reasoning text, usually a StreamingText or a Markdown that streams in while `thinking`. It is shown in
   * the secondary text color.
   * @zh 思考的内容，通常是 `thinking` 期间流式到达的 StreamingText 或 Markdown。以次要文字色显示。
   */
  readonly children?: ReactNode
}

/**
 * The reasoning of an AI model before its answer: a header that shows whether it is still thinking or how long it
 * took, and the reasoning text, which can be expanded and collapsed.
 *
 * **Interaction**: while `thinking` the content is expanded and the header shows a spinning loading indicator and
 * "Thinking"; when thinking ends, the header shows the duration ("Thought for 12s") and the content collapses.
 * Once the user expands or collapses it, it no longer changes by itself. The header is a button: hover and
 * press add the state layer, `Tab` shows the focus ring on the whole header, `Enter` / `Space` toggle it, and it
 * has `aria-expanded` and `aria-controls`. With "reduce motion" on, it expands and collapses without animation
 * and the indicator does not spin.
 * @zh 模型回答前的思考过程：标题显示还在思考还是用了多长时间，下面是可以展开、收起的思考内容。
 *
 * **交互**：`thinking` 时内容展开，标题显示旋转的加载指示与「思考中」；思考结束后标题显示用时（「已思考 12 秒」），
 * 内容自动收起。用户手动展开或收起过之后不再自动改变。标题是按钮：悬停、按下叠加状态层，`Tab` 聚焦时整个标题显示
 * 焦点环，`Enter` / `Space` 切换，带 `aria-expanded` 与 `aria-controls`。打开「减少动态效果」时展开、收起没有动画，
 * 加载指示不旋转。
 * @category AI
 * @usage The thinking of reasoning models before an answer, the plan of an agent
 * @usageZh 推理模型回答前的思考、智能体的计划
 */
export function Reasoning(props: ReasoningProps) {
  const t = useT()
  const thinking = props.thinking ?? false
  const contentId = useId()
  // 用户的选择：null 表示还没有手动切换过，跟随 thinking 自动展开与收起
  const [chosen, setChosen] = useState<boolean | null>(null)
  const expanded = chosen ?? thinking

  // 没有传入时长时，测量 thinking 从开到关的时间
  const started = useRef<number | null>(null)
  const [measured, setMeasured] = useState<number | undefined>(undefined)
  useEffect(() => {
    if (thinking) {
      started.current ??= Date.now()
      return
    }
    if (started.current !== null) {
      setMeasured(Date.now() - started.current)
      started.current = null
    }
  }, [thinking])

  const duration = props.duration ?? measured
  const label = thinking
    ? t('reasoning.thinking')
    : duration === undefined
      ? t('reasoning.process')
      : t('reasoning.done', { duration: formatDuration(duration, t) })

  return (
    <div className={styles.root} data-testid={props.testId} data-thinking={thinking || undefined}>
      <Think
        rootClassName={styles.x}
        classNames={{ status: styles.header, content: styles.content }}
        icon={<Icon name="brain" />}
        loading={
          thinking ? (
            <span className={styles.spin}>
              <Icon name="loader" />
            </span>
          ) : (
            false
          )
        }
        title={
          <button
            type="button"
            className={styles.toggle}
            aria-expanded={expanded}
            aria-controls={contentId}
          >
            <span data-reasoning-label="">{label}</span>
            <span className={styles.chevron}>
              <Icon name="chevron-right" size={14} />
            </span>
          </button>
        }
        expanded={expanded}
        onExpand={setChosen}
        destroyOnHidden={false}
      >
        <div id={contentId}>{props.children}</div>
      </Think>
    </div>
  )
}
