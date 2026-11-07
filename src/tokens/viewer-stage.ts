/**
 * 看图背景令牌（viewer-*）：图片查看器（Lightbox）、媒体网格的说明浮层等看图区域使用的中性背景与控件色。
 *
 * 默认值彩度为 0（无色偏），因为背景色偏会影响人对图片颜色的判断。它们独立于明暗模式与强调色，
 * 默认不随主题变化；确有需要时可以用主题的令牌级覆盖（`extendTheme` 的 `tokens`）修改。
 */
import { formatOklch, oklch } from './oklch.ts'

/**
 * A viewer background, the neutral background behind images in Lightbox: `mid` gray, `dark` gray or `black`.
 * @zh 看图背景，Lightbox 中图片后面的中性背景：`mid` 中灰、`dark` 深灰、`black` 黑。
 */
export type ViewerStage = 'mid' | 'dark' | 'black'

/**
 * All viewer backgrounds, from light to dark: `['mid', 'dark', 'black']`; Lightbox offers them in this order. Use it
 * to build your own background switcher with `useTheme().setViewerStage`.
 * @zh 全部看图背景，由浅到深：`['mid', 'dark', 'black']`；Lightbox 按这个顺序提供选择。可以配合
 * `useTheme().setViewerStage` 做自己的背景切换。
 * @group Theme
 */
export const viewerStages: readonly ViewerStage[] = ['mid', 'dark', 'black']

const bg = {
  mid: oklch(0.5, 0, 0),
  dark: oklch(0.22, 0, 0),
  black: oklch(0, 0, 0),
} as const

/**
 * The default values of the viewer tokens, by name without the `--vl-` prefix: the backgrounds `viewer-bg-mid`,
 * `viewer-bg-dark` and `viewer-bg-black`, the text colors `viewer-text` and `viewer-text-muted`, the controls
 * `viewer-control-bg`, `viewer-control-bg-hover` and `viewer-control-border`, and `viewer-placeholder`. They have no
 * chroma, because a tinted background changes how the colors of images are perceived, and they do not change with
 * the color mode or the accent color. The object is frozen; to change a value, override the token in a theme
 * (`tokens` of extendTheme).
 * @zh 看图令牌的默认值，键不含 `--vl-` 前缀：背景 `viewer-bg-mid`、`viewer-bg-dark`、`viewer-bg-black`，文字色
 * `viewer-text`、`viewer-text-muted`，控件 `viewer-control-bg`、`viewer-control-bg-hover`、`viewer-control-border`，以及
 * `viewer-placeholder`。它们的彩度为 0，因为有色偏的背景会影响人对图片颜色的判断；也不随明暗模式与强调色变化。对象
 * 已冻结；要修改取值，在主题中覆盖令牌（extendTheme 的 `tokens`）。
 * @group Theme
 */
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
