/**
 * 媒体网格：虚拟滚动，DOM 节点数与条目数量无关，一万张图片也能稳定滚动。
 */
import { useVirtualizer } from '@tanstack/react-virtual'
import { type DragEvent, type ReactNode, useLayoutEffect, useRef, useState } from 'react'
import { useT } from '../i18n/index.ts'
import { EmptyState } from './feedback.tsx'
import styles from './ImageGrid.module.css'

/**
 * One tile of an ImageGrid: a thumbnail, or a fallback such as a file type icon for items without one.
 * @zh ImageGrid 中的一个格子：缩略图，没有缩略图的条目可以显示兜底内容（如文件类型图标）。
 */
export interface ImageGridItem {
  /**
   * Unique ID, used as the React key and in `selectedIds`.
   * @zh 唯一标识，作为 React 的 key，也用于 `selectedIds`。
   */
  readonly id: string
  /**
   * URL of the thumbnail. Images are loaded lazily, when the tile is close to the viewport.
   * @zh 缩略图的地址。图片延迟加载：格子接近视口时才加载。
   */
  readonly src: string
  /**
   * Alternative text of the image (such as its title); also the accessible name of the tile, which falls back to
   * `caption`.
   * @zh 图片的替代文字（如图片标题）；也是格子的读屏名称，省略时用 `caption`。
   */
  readonly alt?: string
  /**
   * Background color shown until the thumbnail has loaded, such as the average color from a ThumbHash, so that no
   * white tiles flash. Any CSS color.
   * @zh 缩略图加载完成前显示的底色，如 ThumbHash 的平均色，避免白块闪烁。可以是任意 CSS 颜色。
   */
  readonly placeholderColor?: string
  /**
   * Caption below the tile (or over the image on hover, with `captionPlacement="overlay"`), such as the file
   * name; long captions are truncated. Not shown when omitted.
   * @zh 格子下方的说明文字（`captionPlacement="overlay"` 时悬停显示在图片之上），如文件名；过长时省略。省略时不显示。
   */
  readonly caption?: string
  /**
   * Content shown instead of the image when `src` is empty or the image fails to load, such as an icon or a file
   * type label. Without it, a failed image stays as it is.
   * @zh `src` 为空或图片加载失败时代替图片显示的内容，如图标、文件类型标记。省略时加载失败的图片保持原样。
   */
  readonly fallback?: ReactNode
}

/**
 * Props of ImageGrid.
 * @zh ImageGrid 属性。
 */
export interface ImageGridProps {
  /**
   * Images to show.
   * @zh 图片列表。
   */
  readonly items: readonly ImageGridItem[]
  /**
   * Opens an item on click or `Enter` (usually in a Lightbox).
   * @zh 点击或回车打开某一项（通常打开 Lightbox）。
   */
  readonly onOpen?: (index: number, item: ImageGridItem) => void
  /**
   * Number of rows rendered outside the viewport (overscan), 3 by default.
   * @zh 预渲染的视口外行数，默认 3。
   */
  readonly overscan?: number
  /**
   * Called when a tile is hovered or focused; use it to prefetch the full image or prepare drag data.
   * @zh 鼠标悬停或获得焦点时调用，可用来预取大图或提前准备拖拽数据。
   */
  readonly onHover?: (index: number, item: ImageGridItem) => void
  /**
   * When set, tiles can be dragged; called in `dragstart` (set the drag data or start a custom drag here).
   * @zh 设置后格子可拖动，在 dragstart 中回调（在这里写入拖拽数据或发起自定义拖拽）。
   */
  readonly onTileDragStart?: (index: number, item: ImageGridItem, event: DragEvent) => void
  /**
   * Position of the caption: `below` (default) under the tile; `overlay` on hover, as a gradient overlay at the
   * bottom of the image, which keeps the grid cleaner and the images more prominent (the overlay uses the neutral
   * viewer background tokens).
   * @zh 说明文字的位置：`below`（默认）在格子下方；`overlay` 悬停时以渐变浮层叠在图片底部，
   * 网格更干净、图片更突出（浮层使用中性的看图背景令牌）。
   */
  readonly captionPlacement?: 'below' | 'overlay'
  /**
   * IDs of the selected tiles (shown with an accent selection ring).
   * @zh 选中的格子 ID（显示强调色选中环）。
   */
  readonly selectedIds?: ReadonlySet<string>
}

interface Layout {
  readonly columns: number
  readonly tile: number
  readonly gap: number
}

function readPx(el: HTMLElement, name: string, fallback: number): number {
  const v = Number.parseFloat(getComputedStyle(el).getPropertyValue(name))
  return Number.isFinite(v) ? v : fallback
}

/** 列数与格子尺寸来自组件令牌 `image-grid-min-column` / `image-grid-gap`，随密度变化。 */
function measure(el: HTMLElement): Layout {
  // 内容宽度 = clientWidth 减去左右内边距（容器可以留出边距，给悬停上浮与选中环留空间）
  const style = getComputedStyle(el)
  const width =
    el.clientWidth -
    (Number.parseFloat(style.paddingInlineStart) || 0) -
    (Number.parseFloat(style.paddingInlineEnd) || 0)
  const gap = readPx(el, '--vl-image-grid-gap', 8)
  const min = readPx(el, '--vl-image-grid-min-column', 200)
  const columns = Math.max(1, Math.floor((width + gap) / (min + gap)))
  const tile = columns > 0 ? (width - gap * (columns - 1)) / columns : width
  return { columns, tile, gap }
}

function Tile({
  item,
  onOpen,
  onHover,
  onDragStart,
  overlay,
  selected,
}: {
  item: ImageGridItem
  onOpen?: () => void
  onHover?: () => void
  onDragStart?: (e: DragEvent) => void
  overlay: boolean
  selected: boolean
}) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const showFallback = item.fallback !== undefined && (!item.src || failed)
  return (
    <div className={styles.cell} data-selected={selected || undefined}>
      <button
        type="button"
        className={styles.tile}
        data-fallback={showFallback || undefined}
        // 没有图片的格子与其他可点击元素一样叠加状态层；图片格子不叠，避免改变图片的观感
        data-vl-state={showFallback ? '' : undefined}
        aria-pressed={selected || undefined}
        style={item.placeholderColor ? { background: item.placeholderColor } : undefined}
        onClick={onOpen}
        onMouseEnter={onHover}
        onFocus={onHover}
        draggable={onDragStart ? true : undefined}
        onDragStart={onDragStart}
        aria-label={item.alt ?? item.caption}
      >
        {showFallback ? (
          <span className={styles.fallback}>{item.fallback}</span>
        ) : (
          <img
            className={loaded ? `${styles.image} ${styles.loaded}` : styles.image}
            src={item.src}
            alt={item.alt ?? ''}
            loading="lazy"
            decoding="async"
            draggable={false}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
          />
        )}
        {overlay && item.caption !== undefined && !showFallback && (
          <span className={styles.overlay} title={item.caption}>
            {item.caption}
          </span>
        )}
      </button>
      {!overlay && item.caption !== undefined && (
        <span className={styles.caption} title={item.caption}>
          {item.caption}
        </span>
      )}
    </div>
  )
}

/**
 * Virtualized media grid: shows images or other items as a grid of thumbnails; even with tens of thousands of
 * items only the visible part is rendered, and tiles can be selected with the keyboard. The height comes from the
 * parent (it fills the parent's height by default); the background follows the surrounding container.
 *
 * **Interaction**: tiles are buttons; `Tab` shows an inset focus ring and `Enter` / `Space` open the tile
 * (`onOpen`). On hover, image tiles lift slightly and the image zooms in slowly; pressing does not scale them.
 * Image tiles have no state layer, so the look of the images is not changed. Tiles without an image that show
 * their `fallback` have a neutral fill, show the state layer on hover and press, and do not lift. Tiles in
 * `selectedIds` show an accent selection ring.
 * @zh 虚拟化媒体网格：以缩略图网格展示图片或其他条目，上万项也只渲染可见部分，键盘可选择。
 * 容器高度由父元素决定（默认占满父元素高度）；背景跟随所在容器。
 *
 * **交互**：格子是按钮，`Tab` 聚焦时显示向内的焦点环，`Enter` / `Space` 打开（`onOpen`）；悬停时图片格子轻微上浮、
 * 图片缓慢放大，按下不缩放；为了不改变图片的观感，图片格子不叠加统一状态层。没有图片、显示 `fallback` 的格子
 * 是中性填充底，悬停、按下叠加统一状态层，不上浮。`selectedIds` 中的格子显示强调色选中环。
 * @category Media
 * @usage Albums and galleries, grid views of assets or attachments, picking images
 * @usageZh 相册与图库、素材或附件的网格视图、选图
 */
export function ImageGrid({
  items,
  onOpen,
  overscan = 3,
  onHover,
  onTileDragStart,
  captionPlacement = 'below',
  selectedIds,
}: ImageGridProps) {
  const t = useT()
  const scrollRef = useRef<HTMLElement>(null)
  const [layout, setLayout] = useState<Layout>({ columns: 1, tile: 200, gap: 8 })

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const update = () => {
      const next = measure(el)
      setLayout((prev) =>
        prev.columns === next.columns && prev.tile === next.tile && prev.gap === next.gap
          ? prev
          : next,
      )
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const rowCount = Math.ceil(items.length / layout.columns)
  const overlay = captionPlacement === 'overlay'
  // 有说明文字时每行多出一行文字的高度（近似值，实际高度由虚拟器测量）
  const captionExtra = !overlay && items.some((i) => i.caption !== undefined) ? layout.gap * 3 : 0
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => layout.tile + layout.gap + captionExtra,
    overscan,
  })

  // 布局（列数、格子尺寸）变化后行高随之变化，需要让虚拟器重新测量
  // biome-ignore lint/correctness/useExhaustiveDependencies: layout 是触发条件而非读取的值
  useLayoutEffect(() => {
    virtualizer.measure()
  }, [virtualizer, layout])

  return (
    <section ref={scrollRef} className={styles.scroller} aria-label={t('imageGrid.label')}>
      {items.length === 0 ? (
        <div className={styles.empty}>
          <EmptyState title={t('imageGrid.empty')} />
        </div>
      ) : (
        <div className={styles.inner} style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((row) => {
            const start = row.index * layout.columns
            const rowItems = items.slice(start, start + layout.columns)
            return (
              <div
                key={row.key}
                data-index={row.index}
                ref={virtualizer.measureElement}
                className={styles.row}
                style={{
                  transform: `translateY(${row.start}px)`,
                  gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
                }}
              >
                {rowItems.map((item, i) => (
                  <Tile
                    key={item.id}
                    item={item}
                    onOpen={onOpen ? () => onOpen(start + i, item) : undefined}
                    onHover={onHover ? () => onHover(start + i, item) : undefined}
                    onDragStart={
                      onTileDragStart ? (e) => onTileDragStart(start + i, item, e) : undefined
                    }
                    overlay={overlay}
                    selected={selectedIds?.has(item.id) ?? false}
                  />
                ))}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
