/**
 * 图片查看器（灯箱）。背景使用中性的看图背景令牌（viewer-*），默认无色偏，避免背景色偏影响对图片颜色的判断。
 */
import { useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '../i18n/index.ts'
import { useTheme } from '../theme/ThemeProvider.tsx'
import { type ViewerStage, viewerStages } from '../tokens/viewer-stage.ts'
import { FocusScope } from './FocusScope.tsx'
import styles from './Lightbox.module.css'

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
   * Called when closing (`Esc` or the close button).
   * @zh 关闭时调用（Esc、点击关闭）。
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
 * Full-screen image viewer (lightbox) on a neutral background (the viewer background tokens, which do not follow the
 * theme by default); `Esc` closes it and `←` / `→` switch images.
 *
 * **Interaction**: when it opens, focus moves to the "Close" button; `Esc` closes it and `←` / `→` show the
 * previous and next image; `Tab` / `Shift+Tab` cycle through the buttons of the viewer and never reach the page
 * behind it; after closing, focus returns to the element that was focused before opening. The buttons show the
 * state layer on hover and press (in the neutral viewer text color); the background buttons mark the current step
 * with `aria-pressed`.
 * @zh 全屏图片查看器：中性背景（看图背景令牌，默认不随主题变化），`Esc` 关闭，`←` / `→` 切换。
 *
 * **交互**：打开时焦点移到「关闭」按钮；`Esc` 关闭，`←` / `→` 切换上一张、下一张；`Tab` / `Shift+Tab` 在看图界面的
 * 按钮之间循环，不会移到背后的页面上；关闭后焦点回到打开前的元素。按钮的悬停与按下叠加统一状态层（中性的看图文字色）；
 * 背景档位按钮以 `aria-pressed` 表示当前档位。
 * @category Media
 * @usage Previewing images, enlarging an image while picking images
 * @usageZh 图片预览、选图时放大查看
 */
export function Lightbox({ open, items, index, onIndexChange, onClose, stage }: LightboxProps) {
  const t = useT()
  const { viewerStage, setViewerStage } = useTheme()
  const current = stage ?? viewerStage
  const closeRef = useRef<HTMLButtonElement>(null)
  const total = items.length
  const item = items[index]

  const go = useCallback(
    (delta: number) => {
      if (total === 0) return
      onIndexChange?.((index + delta + total) % total)
    },
    [index, total, onIndexChange],
  )

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, go, onClose])

  if (!open || !item || typeof document === 'undefined') return null

  return createPortal(
    <div
      className={`${styles.backdrop} ${styles[current]}`}
      role="dialog"
      aria-modal="true"
      aria-label={t('lightbox.label')}
      data-vl-viewer-stage={current}
    >
      <div className={styles.toolbar}>
        <span className={styles.counter}>
          {t('lightbox.counter', { current: index + 1, total })}
        </span>
        <span className={styles.spacer} />
        <fieldset aria-label={t('lightbox.stage')} className={styles.stageGroup}>
          {viewerStages.map((s) => (
            <button
              key={s}
              type="button"
              className={styles.control}
              data-vl-state=""
              aria-pressed={s === current}
              onClick={() => setViewerStage(s)}
            >
              {t(`lightbox.stage.${s}`)}
            </button>
          ))}
        </fieldset>
        <button
          ref={closeRef}
          type="button"
          className={styles.control}
          data-vl-state=""
          onClick={onClose}
        >
          {t('lightbox.close')}
        </button>
      </div>
      {/* 看图界面是模态的：焦点限制在界面内，关闭后还给打开前的元素 */}
      <FocusScope active restoreFocus />
      <div className={styles.stage}>
        <img key={item.id} className={styles.image} src={item.src} alt={item.alt ?? ''} />
        {total > 1 && (
          <>
            <button
              type="button"
              className={`${styles.control} ${styles.nav} ${styles.prev}`}
              data-vl-state=""
              aria-label={t('lightbox.prev')}
              onClick={() => go(-1)}
            >
              ‹
            </button>
            <button
              type="button"
              className={`${styles.control} ${styles.nav} ${styles.next}`}
              data-vl-state=""
              aria-label={t('lightbox.next')}
              onClick={() => go(1)}
            >
              ›
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
