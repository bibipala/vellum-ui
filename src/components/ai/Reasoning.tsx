/**
 * Reasoning：思考过程。
 *
 * - 思考中：旋转的加载指示（不用渐变、闪光等装饰动画）与「Thinking」；已完成：「Thought for 12s」（时长本地化）。
 * - 思考中自动展开、完成后自动收起；用户手动展开或收起过之后就不再自动改变。
 * - 标题行中是一个按钮（aria-expanded、aria-controls），它的点击区域铺满整行；悬停、按下的底色与键盘焦点环画在整行上。
 * - 展开、收起与 Sources 相同（collapse.module.css）：高度沿弹簧变化，可以中途折返。aria-controls 指向的面板总是在，
 *   其中的内容在第一次展开时才渲染，之后收起也保留，只是隐藏，读屏与 Tab 都跳过。
 */
import { type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { useT } from '../../i18n/index.ts'
import { Icon } from '../Icon.tsx'
import type { BaseProps } from '../layout.tsx'
import loadingCss from '../loading.module.css'
import collapse from './collapse.module.css'
import { formatDuration } from './duration.ts'
import styles from './reasoning.module.css'

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
 * has `aria-expanded` and `aria-controls`. Expanding and collapsing changes the height along the spring, and
 * toggling again halfway turns back from where it is; collapsed content is hidden from screen readers and `Tab`.
 * With "reduce motion" on, it expands and collapses without animation and the indicator does not spin.
 * @zh 模型回答前的思考过程：标题显示还在思考还是用了多长时间，下面是可以展开、收起的思考内容。
 *
 * **交互**：`thinking` 时内容展开，标题显示旋转的加载指示与「思考中」；思考结束后标题显示用时（「已思考 12 秒」），
 * 内容自动收起。用户手动展开或收起过之后不再自动改变。标题是按钮：悬停、按下叠加状态层，`Tab` 聚焦时整个标题显示
 * 焦点环，`Enter` / `Space` 切换，带 `aria-expanded` 与 `aria-controls`。展开、收起时高度沿弹簧变化，中途再次切换
 * 从当前高度折返；收起的内容对读屏与 `Tab` 隐藏。打开「减少动态效果」时展开、收起没有动画，加载指示不旋转。
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
  // 内容在第一次展开时才渲染（一开始就收起的长对话中不渲染看不见的思考内容），之后收起也保留
  const [opened, setOpened] = useState(expanded)
  if (expanded && !opened) setOpened(true)

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
      <div className={styles.header}>
        <span className={styles.icon}>
          {thinking ? (
            <span className={loadingCss.spin}>
              <Icon name="loader" />
            </span>
          ) : (
            <Icon name="brain" />
          )}
        </span>
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => setChosen(!expanded)}
        >
          <span data-reasoning-label="">{label}</span>
          <span className={styles.chevron}>
            <Icon name="chevron-right" size={14} />
          </span>
        </button>
      </div>
      <div id={contentId} className={collapse.collapse} data-expanded={expanded || undefined}>
        <div className={collapse.clip}>
          <div className={styles.content}>{opened && props.children}</div>
        </div>
      </div>
    </div>
  )
}
