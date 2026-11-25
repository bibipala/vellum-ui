/**
 * 文件预览中大图原始尺寸的缓存：条目数有上限，超出时淘汰最久没有用过的；不缓存会被释放的 blob: 地址。
 */
import { describe, expect, it } from 'vitest'
import {
  createSizeCache,
  NATURAL_SIZE_LIMIT,
  naturalSizes,
} from '../src/components/file-preview/natural-sizes.ts'

const size = (n: number) => ({ width: n, height: n + 1 })

describe('图片原始尺寸的缓存', () => {
  it('最多保留 limit 项：超出时淘汰最久没有用过的，读取与重新写入都算使用', () => {
    const cache = createSizeCache(3)
    cache.set('a.png', size(1))
    cache.set('b.png', size(2))
    cache.set('c.png', size(3))
    // 读取 a：它变成最近用过的，下一次淘汰 b
    expect(cache.get('a.png')).toEqual(size(1))
    cache.set('d.png', size(4))
    expect(cache.size).toBe(3)
    expect(cache.has('b.png')).toBe(false)
    expect(cache.has('a.png')).toBe(true)
    // 重新写入 c：同样变成最近用过的，下一次淘汰 a
    cache.set('c.png', size(30))
    cache.set('e.png', size(5))
    expect(cache.has('a.png')).toBe(false)
    expect(cache.get('c.png')).toEqual(size(30))
    expect([cache.has('d.png'), cache.has('e.png')]).toEqual([true, true])
    expect(cache.size).toBe(3)
  })

  it('不缓存 blob: 地址：对象地址不再显示时就被释放，再次打开是新的地址', () => {
    const cache = createSizeCache(3)
    cache.set('blob:http://localhost/0b6e4a1c-0000-4000-8000-000000000000', size(1))
    expect(cache.size).toBe(0)
    expect(cache.has('blob:http://localhost/0b6e4a1c-0000-4000-8000-000000000000')).toBe(false)
    // 其他地址照常缓存（包括 data: 地址）
    cache.set('data:image/svg+xml,%3Csvg%2F%3E', size(2))
    cache.set('https://example.com/photo.jpg', size(3))
    expect(cache.size).toBe(2)
  })

  it('文件预览共用的缓存有上限', () => {
    expect(NATURAL_SIZE_LIMIT).toBeLessThanOrEqual(500)
    for (let i = 0; i < NATURAL_SIZE_LIMIT * 3; i++)
      naturalSizes.set(`https://example.com/photos/${i}.jpg`, size(i))
    expect(naturalSizes.size).toBe(NATURAL_SIZE_LIMIT)
    // 留下的是最近写入的
    expect(naturalSizes.has(`https://example.com/photos/${NATURAL_SIZE_LIMIT * 3 - 1}.jpg`)).toBe(
      true,
    )
    expect(naturalSizes.has('https://example.com/photos/0.jpg')).toBe(false)
  })
})
