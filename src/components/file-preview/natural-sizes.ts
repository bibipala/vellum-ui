/**
 * 加载过的大图的原始尺寸：再次显示同一个地址时（换回来、重新打开）不用等加载就能放好。
 *
 * 文件预览共用一份，所以条目数有上限：超出时淘汰最久没有用过的（读取与写入都算使用），长时间运行的桌面应用中
 * 不会无限增长。blob: 地址不缓存：对象地址在文件不再显示时就被释放，同一个文件再次打开时是新的地址，留着只会堆积。
 */

/** 图片的原始尺寸（像素）。 */
export interface NaturalSize {
  readonly width: number
  readonly height: number
}

/** 有上限的尺寸缓存（最近最少使用的先淘汰）。 */
export interface SizeCache {
  get(src: string): NaturalSize | undefined
  has(src: string): boolean
  set(src: string, size: NaturalSize): void
  /** 当前的条目数。 */
  readonly size: number
}

/** 文件预览共用的缓存最多保留的条目数。 */
export const NATURAL_SIZE_LIMIT = 200

/** 不缓存的地址：会被释放的对象地址。 */
const transient = (src: string) => src.startsWith('blob:')

export function createSizeCache(limit: number): SizeCache {
  // Map 按插入顺序遍历：最久没有用过的在最前面，用到时删掉再插到最后
  const entries = new Map<string, NaturalSize>()
  return {
    get(src) {
      const size = entries.get(src)
      if (size !== undefined) {
        entries.delete(src)
        entries.set(src, size)
      }
      return size
    },
    has: (src) => entries.has(src),
    set(src, size) {
      if (transient(src)) return
      entries.delete(src)
      entries.set(src, size)
      while (entries.size > limit) {
        const oldest = entries.keys().next()
        if (oldest.done) break
        entries.delete(oldest.value)
      }
    },
    get size() {
      return entries.size
    },
  }
}

/** 文件预览共用的缓存。 */
export const naturalSizes = createSizeCache(NATURAL_SIZE_LIMIT)
