/** 示例与 Storybook 用的占位图：程序生成的 SVG，不含任何真实图片。 */
export interface SampleImage {
  readonly id: string
  readonly src: string
  readonly alt: string
  readonly placeholderColor: string
}

export function sampleImages(count: number): SampleImage[] {
  return Array.from({ length: count }, (_, i) => {
    const hue = (i * 47) % 360
    const bg = `oklch(0.78 0.06 ${hue})`
    const fg = `oklch(0.45 0.09 ${(hue + 40) % 360})`
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect width="400" height="400" fill="${bg}"/><circle cx="${120 + ((i * 37) % 160)}" cy="${140 + ((i * 53) % 120)}" r="${60 + (i % 5) * 14}" fill="${fg}" opacity="0.8"/><path d="M0 ${300 - (i % 7) * 10} Q200 ${220 + (i % 9) * 8} 400 ${290 - (i % 4) * 12} L400 400 L0 400Z" fill="${fg}" opacity="0.5"/></svg>`
    return {
      id: `sample-${i}`,
      src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
      alt: `Sample image ${i + 1}`,
      placeholderColor: bg,
    }
  })
}
