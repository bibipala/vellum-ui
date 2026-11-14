/**
 * 图片查看器（灯箱）。背景使用中性的看图背景令牌（viewer-*），默认无色偏，避免背景色偏影响对图片颜色的判断。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '../i18n/index.ts'
import { useTheme } from '../theme/ThemeProvider.tsx'
import { type ViewerStage, viewerStages } from '../tokens/viewer-stage.ts'
import { FocusScope } from './FocusScope.tsx'
import styles from './Lightbox.module.css'
import { useReducedMotion } from './useReducedMotion.ts'

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
 *
 * **Motion**: it fades in and the image grows into place along the spring once it has loaded; switching images
 * slides the new one in from the side you move toward; closing fades it out and shrinks the image slightly (the
 * viewer no longer takes clicks or focus while it closes). Opening it again while it closes turns it back from
 * where it is.
 * @zh 全屏图片查看器：中性背景（看图背景令牌，默认不随主题变化），`Esc` 关闭，`←` / `→` 切换。
 *
 * **交互**：打开时焦点移到「关闭」按钮；`Esc` 关闭，`←` / `→` 切换上一张、下一张；`Tab` / `Shift+Tab` 在看图界面的
 * 按钮之间循环，不会移到背后的页面上；关闭后焦点回到打开前的元素。按钮的悬停与按下叠加统一状态层（中性的看图文字色）；
 * 背景档位按钮以 `aria-pressed` 表示当前档位。
 *
 * **动效**：打开时淡入，图片加载后沿弹簧放大到位；换图时新图从前进方向一侧滑入；关闭时淡出、图片略微缩小
 * （关闭过程中不再接收点击与焦点）。关闭途中再次打开，从当前状态折返。
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
  const visible = open && items[index] !== undefined
  // 关闭的过渡期间仍显示关闭前的那张图
  const lastItem = useRef(items[index])
  if (visible) lastItem.current = items[index]
  const item = lastItem.current
  const reduced = useReducedMotion()
  // 是否在页面上：打开时立即挂载；关闭后等淡出结束（或「减少动态效果」时立即）再卸载
  const [present, setPresent] = useState(visible)
  const leaving = present && !visible
  // 换图的方向：用按钮或方向键换图时，新图从前进方向一侧滑入；由外部改变序号时只淡入放大
  const direction = useRef<'next' | 'prev' | undefined>(undefined)
  // 重新打开时的第一张图不带方向
  const wasVisible = useRef(visible)
  if (visible && !wasVisible.current) direction.current = undefined
  wasVisible.current = visible
  // 已加载完成的图片：图片加载后才开始进场，过渡不会落在一张还没有内容的图上
  const [loadedId, setLoadedId] = useState<string | null>(null)

  useEffect(() => {
    if (visible) setPresent(true)
    else if (reduced) setPresent(false)
  }, [visible, reduced])

  // 淡出的兜底：过渡被打断或没有触发 transitionend 时，按离场时长卸载
  useEffect(() => {
    if (!leaving) return
    const timer = setTimeout(() => setPresent(false), exitMs() + 100)
    return () => clearTimeout(timer)
  }, [leaving])

  const go = useCallback(
    (delta: number) => {
      if (total === 0) return
      direction.current = delta > 0 ? 'next' : 'prev'
      onIndexChange?.((index + delta + total) % total)
    },
    [index, total, onIndexChange],
  )

  useEffect(() => {
    if (visible) closeRef.current?.focus()
  }, [visible])

  useEffect(() => {
    if (!visible) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible, go, onClose])

  if (!(visible || present) || item === undefined || typeof document === 'undefined') return null

  return createPortal(
    <div
      className={`${styles.backdrop} ${styles[current]}`}
      role="dialog"
      aria-modal="true"
      aria-label={t('lightbox.label')}
      data-vl-viewer-stage={current}
      data-leaving={leaving || undefined}
      inert={leaving}
      onTransitionEnd={(e) => {
        if (leaving && e.target === e.currentTarget && e.propertyName === 'opacity') {
          setPresent(false)
        }
      }}
    >
      <div className={styles.toolbar}>
        <span className={styles.counter}>
          {t('lightbox.counter', { current: index + 1, total })}
        </span>
        <span className={styles.spacer} />
        {stage === undefined && (
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
        )}
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
      {/* 看图界面是模态的：焦点限制在界面内，关闭（开始淡出）时还给打开前的元素 */}
      <FocusScope active={!leaving} restoreFocus />
      <div className={styles.stage}>
        <img
          key={item.id}
          className={styles.image}
          src={item.src}
          alt={item.alt ?? ''}
          data-enter={direction.current}
          data-loaded={loadedId === item.id || undefined}
          // 已在缓存中的图片挂载时就是加载完成的状态
          ref={(el) => {
            if (el?.complete) setLoadedId(item.id)
          }}
          onLoad={() => setLoadedId(item.id)}
          // 加载失败也显示出来：浏览器在图片的位置显示替代文字
          onError={() => setLoadedId(item.id)}
        />
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

/** 关闭淡出的时长（motion-duration-fast，毫秒）；「减少动态效果」时为 0 */
function exitMs(): number {
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue('--vl-motion-duration-fast')
    .trim()
  const n = Number.parseFloat(v)
  return Number.isFinite(n) ? (v.endsWith('ms') ? n : n * 1000) : 0
}
