/**
 * 图片：加载时显示占位，失败时显示兜底内容，点击（或 `Enter` / 空格）放大预览。预览就是 FilePreview（只有这一张
 * 图片）：从图片的位置长出、关闭时飞回，可以缩放与拖动；焦点约束、`Esc` 关闭与关闭后焦点回到图片也由它处理。
 * 预览背景使用中性的看图背景令牌（viewer-*，档位随 ThemeProvider 的看图背景），不随主题色变化。
 *
 * 安全（ADR 0020「影响」中的安全要求）：`src` 与预览的 `src` 原样交给 `<img>`，不做任何拼接或改写；来源由使用方负责。
 */
import { type CSSProperties, type ReactNode, useId, useMemo, useState } from 'react'
import { useT } from '../i18n/index.ts'
import { type FilePreviewItem, imageTexts, PreviewDialog } from './file-preview/FilePreview.tsx'
import { Icon } from './Icon.tsx'
import styles from './Image.module.css'

/**
 * Options of the preview.
 * @zh 预览的选项。
 */
export interface ImagePreviewOptions {
  /**
   * Address of the image shown in the preview, such as a larger version; the `src` of the image by default.
   * @zh 预览中显示的图片地址（如更大的版本），默认与图片的 `src` 相同。
   */
  readonly src?: string
  /**
   * Whether the preview is open (controlled).
   * @zh 预览是否打开（受控）。
   */
  readonly open?: boolean
  /**
   * Called when the preview opens or closes.
   * @zh 预览打开或关闭时调用。
   */
  readonly onOpenChange?: (open: boolean) => void
}

/** Image 自有的属性。 */
interface ImageOwnProps {
  /**
   * Address of the image, passed to `<img>` as it is.
   * @zh 图片地址，原样交给 `<img>`。
   */
  readonly src?: string
  /**
   * Text alternative of the image, read by screen readers; it is also the accessible name of the preview button.
   * Use an empty string only for decorative images without preview.
   * @zh 图片的替代文字，供读屏读出，也是预览按钮的读屏名称。只有不预览的装饰图片才用空字符串。
   */
  readonly alt?: string
  /**
   * Shown over the image area while it loads: a neutral fill by default; `false` shows nothing. Give the image a
   * `width` and `height` so that the area keeps its size while loading.
   * @zh 加载时覆盖在图片区域上的占位：默认是中性填充；`false` 不显示。请给图片设置 `width` 与 `height`，加载期间区域大小不变。
   * @default true
   */
  readonly placeholder?: ReactNode
  /**
   * Shown instead of the image when it fails to load: an image icon and the built-in text ("Failed to load") by
   * default. A failed image cannot be previewed.
   * @zh 图片加载失败时代替图片显示的内容：默认是图片图标与内置文本（「加载失败」）。加载失败的图片不能预览。
   */
  readonly fallback?: ReactNode
  /**
   * Opens a larger preview on click or `Enter` / `Space`; `false` turns it off. The object form sets the address of
   * the preview and makes it controlled.
   * @zh 点击或 `Enter` / 空格打开放大预览；`false` 关闭预览。对象形式可以指定预览的图片地址，或受控打开。
   * @default true
   */
  readonly preview?: boolean | ImagePreviewOptions
  /**
   * How the image fills a `width` × `height` area: `cover` crops it, `contain` shows all of it.
   * @zh 图片如何填充 `width` × `height` 的区域：`cover` 裁切铺满，`contain` 完整显示。
   * @default 'cover'
   */
  readonly fit?: 'cover' | 'contain'
  /**
   * Corner radius: `md` for thumbnails in lists and forms, `lg` for cards, `none` for images that fill an area.
   * @zh 圆角：`md` 用于列表与表单中的缩略图，`lg` 用于卡片，`none` 用于铺满区域的图片。
   * @default 'md'
   */
  readonly radius?: 'none' | 'md' | 'lg'
  /**
   * Width of the image: a number in pixels or a CSS length.
   * @zh 图片的宽度：像素数，或者 CSS 长度。
   */
  readonly width?: number | string
  /**
   * Height of the image: a number in pixels or a CSS length.
   * @zh 图片的高度：像素数，或者 CSS 长度。
   */
  readonly height?: number | string
  /**
   * `lazy` loads the image only when it comes near the visible area, for long lists of images.
   * @zh `lazy` 在图片接近可见区域时才加载，用于图片较多的长列表。
   * @default 'eager'
   */
  readonly loading?: 'lazy' | 'eager'
}

/**
 * Props of Image.
 * @zh Image 属性。
 */
export interface ImageProps extends ImageOwnProps {}

type Status = 'loading' | 'loaded' | 'error'

/**
 * Image with a placeholder while loading, a fallback when loading fails, and a larger preview on click. The preview
 * is FilePreview with this one image: it grows out of the image onto a neutral viewer background (the `viewer-*`
 * tokens, the viewer background step of ThemeProvider), so the colors of the image are not affected by the theme.
 * For many images use ImageGrid with FilePreview or Lightbox.
 *
 * **Interaction**: the image fades in when it has loaded. With preview, the image is a button: `Tab` focuses it and
 * shows the focus ring, hovering shows a magnifier, and a click or `Enter` / `Space` open the preview. In the
 * preview, the image zooms with the wheel, a pinch, `+` / `-` or a double click and is dragged when zoomed; focus
 * stays inside it, `Esc` (or dragging the image up or down) closes it, the image flies back into place, and focus
 * returns to the image.
 * @zh 图片：加载时显示占位，加载失败时显示兜底内容，点击放大预览。预览就是只有这一张图片的 FilePreview：从图片的位置
 * 长出到中性的看图背景上（`viewer-*` 令牌，档位取 ThemeProvider 的看图背景），图片的颜色不受主题影响。图片多时用
 * ImageGrid 加 FilePreview 或 Lightbox。
 *
 * **交互**：图片加载完成后淡入。可以预览时图片是一个按钮：`Tab` 聚焦并显示焦点环，悬停显示放大镜，点击或 `Enter` / 空格
 * 打开预览。预览中图片可以用滚轮、双指、`+` / `-` 或双击缩放，放大后拖动平移；焦点限制在预览内，`Esc`（或上下拖动
 * 图片）关闭，图片飞回原处，焦点回到图片上。
 * @category Media
 * @usage Thumbnails in detail pages and forms, cover images, images in messages
 * @usageZh 详情页与表单中的缩略图、封面图、消息中的图片
 */
export function Image({
  src,
  alt,
  placeholder = true,
  fallback,
  preview = true,
  fit = 'cover',
  radius = 'md',
  width,
  height,
  loading,
}: ImageProps) {
  const t = useT()
  const id = useId()
  // 加载结果按地址记录：地址变化后自动回到「加载中」
  const [result, setResult] = useState<{ readonly src: string; readonly ok: boolean } | null>(null)
  const status: Status = !src
    ? 'error'
    : result?.src === src
      ? result.ok
        ? 'loaded'
        : 'error'
      : 'loading'
  const settle = (ok: boolean) => {
    if (src) setResult((prev) => (prev?.src === src && prev.ok === ok ? prev : { src, ok }))
  }

  const options = typeof preview === 'object' ? preview : undefined
  const [innerOpen, setInnerOpen] = useState(false)
  const open = options?.open ?? innerOpen
  const setOpen = (next: boolean) => {
    if (options?.open === undefined) setInnerOpen(next)
    options?.onOpenChange?.(next)
  }
  const previewable = preview !== false && status !== 'error'
  const previewSrc = options?.src ?? src ?? ''
  const items = useMemo(
    (): FilePreviewItem[] => [
      { id, name: alt ?? '', src: previewSrc, type: 'image/*', alt: alt ?? '' },
    ],
    [id, alt, previewSrc],
  )

  const size: CSSProperties = { width, height }
  const image = (
    <img
      className={styles.img}
      src={src}
      alt={previewable ? '' : alt}
      style={size}
      loading={loading}
      draggable={previewable ? false : undefined}
      // 已在缓存中的图片挂载时就已加载完成，不会再触发 load
      ref={(el) => {
        if (el?.complete && el.getAttribute('src')) settle(el.naturalWidth > 0)
      }}
      onLoad={() => settle(true)}
      onError={() => settle(false)}
    />
  )
  return (
    <span className={styles.root} data-status={status} data-fit={fit} data-radius={radius}>
      {status === 'error' ? (
        <span className={styles.fallback} style={size} role="img" aria-label={alt || undefined}>
          {fallback ?? (
            <>
              <Icon name="image" size={20} />
              <span className={styles.fallbackText}>{t('image.error')}</span>
            </>
          )}
        </span>
      ) : previewable ? (
        // 预览从这个按钮飞出、关闭时飞回（data-vl-preview-id 与预览项的标识相同）
        <button
          type="button"
          className={styles.frame}
          aria-label={alt}
          data-vl-preview-id={id}
          onClick={() => setOpen(true)}
        >
          {image}
          <span className={styles.cover} aria-hidden="true">
            <Icon name="scan-search" size={20} />
          </span>
        </button>
      ) : (
        <span className={styles.frame}>{image}</span>
      )}
      {status === 'loading' && placeholder !== false && (
        <span className={styles.placeholder} aria-hidden="true">
          {placeholder === true ? null : placeholder}
        </span>
      )}
      {preview !== false && (
        <PreviewDialog
          open={open && previewable}
          items={items}
          index={0}
          onClose={() => setOpen(false)}
          texts={imageTexts}
        />
      )}
    </span>
  )
}
