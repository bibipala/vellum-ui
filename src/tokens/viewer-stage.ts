/**
 * 看图背景令牌（viewer-*）：图片查看器（Lightbox）、媒体网格的说明浮层等看图区域使用的中性背景与控件色。
 *
 * 默认值彩度为 0（无色偏），因为背景色偏会影响人对图片颜色的判断。它们独立于明暗模式与强调色，
 * 默认不随主题变化；确有需要时可以用主题的令牌级覆盖（`extendTheme` 的 `tokens`）修改。
 */
import { formatOklch, oklch } from './oklch.ts'

/** 看图背景档位：中灰、深灰、黑。 */
export type ViewerStage = 'mid' | 'dark' | 'black'

export const viewerStages: readonly ViewerStage[] = ['mid', 'dark', 'black']

const bg = {
  mid: oklch(0.5, 0, 0),
  dark: oklch(0.22, 0, 0),
  black: oklch(0, 0, 0),
} as const

/** 看图背景令牌的默认值（键不含 `--vl-` 前缀）。对象被冻结，修改请用主题覆盖。 */
export const viewerStageTokens: Readonly<Record<string, string>> = Object.freeze({
  'viewer-bg-mid': formatOklch(bg.mid),
  'viewer-bg-dark': formatOklch(bg.dark),
  'viewer-bg-black': formatOklch(bg.black),
  'viewer-text': formatOklch(oklch(0.96, 0, 0)),
  'viewer-text-muted': formatOklch(oklch(0.78, 0, 0)),
  'viewer-control-bg': formatOklch(oklch(0, 0, 0, 0.45)),
  'viewer-control-bg-hover': formatOklch(oklch(0, 0, 0, 0.65)),
  'viewer-control-border': formatOklch(oklch(1, 0, 0, 0.18)),
  'viewer-placeholder': formatOklch(oklch(0.4, 0, 0)),
})
