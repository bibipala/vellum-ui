/**
 * 图片查看器（灯箱）。背景使用中性的看图背景令牌（viewer-*），默认无色偏，避免背景色偏影响对图片颜色的判断。
 * 实现就是只有图片的文件预览（file-preview/FilePreview.tsx），文字用 lightbox.* 的键。
 */
import { useMemo } from 'react'
import type { ViewerStage } from '../tokens/viewer-stage.ts'
import { type FilePreviewItem, imageTexts, PreviewDialog } from './file-preview/FilePreview.tsx'

/**
 * One image of a Lightbox.
 * @zh Lightbox 中的一张图片。
 */
export interface LightboxItem {
  /**
   * Unique ID; when the current image changes, the image element is replaced, so the previous image is not shown
   * while the next one loads.
   * @zh 唯一标识；切换图片时据此替换图片元素，下一张加载时不会还显示上一张。
   */
  readonly id: string
  /**
   * URL of the full-size image.
   * @zh 大图的地址。
   */
  readonly src: string
  /**
   * Alternative text, read by screen readers and shown by the browser when the image fails to load.
   * @zh 替代文字，供读屏读出，图片加载失败时由浏览器显示。
   */
  readonly alt?: string
}

/**
 * Props of Lightbox.
 * @zh Lightbox 属性。
 */
export interface LightboxProps {
  /**
   * Whether the viewer is open.
   * @zh 是否打开。
   */
  readonly open: boolean
  /**
   * Images to switch between.
   * @zh 可切换的图片列表。
   */
  readonly items: readonly LightboxItem[]
  /**
   * Index of the image shown (controlled).
   * @zh 当前显示的图片序号（受控）。
   */
  readonly index: number
  /**
   * Called when switching to another image.
   * @zh 切换图片时调用。
   */
  readonly onIndexChange?: (index: number) => void
  /**
   * Called when closing (`Esc`, the close button, clicking outside the image, dragging it away).
   * @zh 关闭时调用（`Esc`、关闭按钮、点击图片以外的地方、把图片拖走）。
   */
  readonly onClose: () => void
  /**
   * Fixed background step; when omitted, the viewer background from ThemeProvider is used and can be changed in
   * the toolbar.
   * @zh 指定背景档位；省略时使用 ThemeProvider 中的看图背景档位，并可在工具栏切换。
   */
  readonly stage?: ViewerStage
}

/**
 * Full-window image viewer (lightbox) on a neutral background (the viewer background tokens, which do not follow the
 * theme by default); `Esc` closes it and `←` / `→` switch images. It is FilePreview with images only: use
 * FilePreview when the list may contain other files.
 *
 * **Interaction**: when it opens, focus moves to the "Close" button; `Esc` closes it and `←` / `→` show the
 * previous and next image; `Tab` / `Shift+Tab` cycle through the buttons of the viewer and never reach the page
 * behind it; after closing, focus returns to the element that was focused before opening. Images zoom with the wheel,
 * a pinch, `+` / `-` or the zoom buttons, a double click switches between fitting the window and the actual size, and
 * zoomed images are dragged to move them; dragging an image sideways switches images and dragging it up or down
 * closes the viewer. The background swatches mark the current step with `aria-pressed`.
 *
 * **Motion**: an image opened from a thumbnail grows out of it along the spring and flies back into it when closing
 * (see FilePreview); otherwise the viewer fades in and the image grows into place once it has loaded. Switching
 * images slides them along a track, and every motion can be interrupted.
 * @zh 全屏看图：中性背景（看图背景令牌，默认不随主题变化），`Esc` 关闭，`←` / `→` 切换。它就是只有图片的 FilePreview：
 * 列表中可能有其他文件时用 FilePreview。
 *
 * **交互**：打开时焦点移到「关闭」按钮；`Esc` 关闭，`←` / `→` 切换上一张、下一张；`Tab` / `Shift+Tab` 在看图界面的
 * 按钮之间循环，不会移到背后的页面上；关闭后焦点回到打开前的元素。图片用滚轮、双指、`+` / `-` 或缩放按钮缩放，双击在
 * 适合窗口与实际大小之间切换，放大后拖动平移；横向拖动图片切换，上下拖动关闭。背景色块以 `aria-pressed` 表示当前档位。
 *
 * **动效**：从缩略图打开的图片沿弹簧从缩略图中长出，关闭时飞回缩略图（见 FilePreview）；否则淡入，图片加载后放大到位。
 * 切换图片时沿轨道滑动，所有动效都可以中途打断。
 * @category Media
 * @usage Previewing images, enlarging an image while picking images
 * @usageZh 图片预览、选图时放大查看
 */
export function Lightbox({ open, items, index, onIndexChange, onClose, stage }: LightboxProps) {
  const files = useMemo(
    () =>
      items.map(
        (item): FilePreviewItem => ({
          id: item.id,
          name: item.alt ?? '',
          src: item.src,
          // 不按文件名判断：Lightbox 的每一项都是图片
          type: 'image/*',
          alt: item.alt ?? '',
        }),
      ),
    [items],
  )
  return (
    <PreviewDialog
      open={open}
      items={files}
      index={index}
      onIndexChange={onIndexChange}
      onClose={onClose}
      stage={stage}
      texts={imageTexts}
    />
  )
}
