import { Image, Inline } from 'vellum-ui'
import { sampleImages } from '../stories/sample.ts'

const [first, second] = sampleImages(2)

/**
 * Basic usage
 * Give the image a `width` and `height`: the placeholder keeps the area while it loads, then the image fades in.
 * Click it, or press `Enter`, to open the preview on the neutral viewer background.
 * @zh 基本用法
 * 给图片设置 `width` 与 `height`：加载时占位保持区域大小，加载完成后图片淡入。点击或按 `Enter` 在中性的看图背景上
 * 打开预览。
 */
export function Basic() {
  return <Image src={first?.src} alt={first?.alt} width={160} height={120} />
}

/**
 * Fit, radius and no preview
 * `fit="contain"` shows the whole image, `radius` sets the corners and `preview={false}` turns off the preview.
 * @zh 填充方式、圆角与不预览
 * `fit="contain"` 完整显示图片，`radius` 设置圆角，`preview={false}` 关闭预览。
 * @section Variants
 */
export function Variants() {
  return (
    <Inline gap={4}>
      <Image src={second?.src} alt={second?.alt} width={160} height={96} fit="contain" />
      <Image src={second?.src} alt={second?.alt} width={96} height={96} radius="lg" />
      <Image
        src={first?.src}
        alt={first?.alt}
        width={96}
        height={96}
        radius="none"
        preview={false}
      />
    </Inline>
  )
}

/**
 * Loading and failed
 * While loading, a neutral placeholder covers the area; when the image fails to load, a fallback replaces it and the
 * image cannot be previewed.
 * @zh 加载中与加载失败
 * 加载时中性占位覆盖图片区域；加载失败时以兜底内容代替图片，并且不能预览。
 * @section States
 */
export function States() {
  return (
    <Inline gap={4}>
      {/* An image that cannot be decoded: fails without a network request */}
      <Image src="data:image/png;base64,AAAA" alt="Missing photo" width={160} height={120} />
    </Inline>
  )
}
