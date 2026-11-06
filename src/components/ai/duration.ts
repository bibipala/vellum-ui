/**
 * 时长的本地化写法（Reasoning 的「Thought for 12s」）：不足一分钟写秒数（至少 1 秒），一分钟起写分与秒。
 * 格式来自文本表（`reasoning.seconds`、`reasoning.minutes`），数字按 `format.locale` 写出；服务端与浏览器结果相同
 * （不依赖各运行环境支持程度不同的 Intl.DurationFormat）。组件库内部使用，不从入口导出。
 */
import type { MessageKey } from '../../i18n/index.ts'

type Translate = (key: MessageKey, params?: Readonly<Record<string, string | number>>) => string

/** 把毫秒数写成本地化的时长。 */
export function formatDuration(ms: number, t: Translate): string {
  const total = Math.max(1, Math.round(ms / 1000))
  const number = new Intl.NumberFormat(t('format.locale'), { maximumFractionDigits: 0 })
  if (total < 60) return t('reasoning.seconds', { seconds: number.format(total) })
  return t('reasoning.minutes', {
    minutes: number.format(Math.floor(total / 60)),
    seconds: number.format(total % 60),
  })
}
