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

/** 示例用的文件：不同宽高比的图片，以及 JSON、Markdown、日志、表格与一个不能预览的 PDF。 */
export interface SampleFile {
  readonly id: string
  readonly name: string
  readonly src?: string
  readonly type?: string
  readonly size?: number
  readonly content?: string
}

function samplePhoto(width: number, height: number, hue: number): string {
  const sky = `oklch(0.82 0.07 ${hue})`
  const hill = `oklch(0.52 0.08 ${(hue + 60) % 360})`
  const sun = `oklch(0.9 0.1 ${(hue + 200) % 360})`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="${sky}"/><circle cx="${width * 0.7}" cy="${height * 0.3}" r="${Math.min(width, height) * 0.12}" fill="${sun}"/><path d="M0 ${height * 0.72} Q${width * 0.3} ${height * 0.5} ${width * 0.55} ${height * 0.68} T${width} ${height * 0.62} V${height} H0Z" fill="${hill}"/></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export function sampleFiles(): SampleFile[] {
  const log = Array.from(
    { length: 40 },
    (_, i) =>
      `2026-11-14T09:${String(10 + Math.floor(i / 4)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}Z ${i % 9 === 4 ? 'WARN ' : 'INFO '} worker-${(i % 3) + 1} processed batch ${1200 + i} in ${40 + ((i * 13) % 90)} ms`,
  ).join('\n')
  return [
    { id: 'f-1', name: 'harbor-morning.png', src: samplePhoto(1600, 1000, 230), size: 482_113 },
    { id: 'f-2', name: 'meadow.png', src: samplePhoto(900, 1200, 130), size: 356_902 },
    {
      id: 'f-3',
      name: 'release-notes.md',
      content:
        '# Release notes\n\nThis release improves **sync** and adds two settings.\n\n## Changes\n\n- Faster initial sync for large projects\n- New setting: *Pause sync on metered networks*\n- Fixed a crash when a file name contained `#`\n\n> Upgrade at your convenience; no migration is needed.\n',
    },
    {
      id: 'f-4',
      name: 'settings.json',
      content:
        '{"theme":"system","sync":{"enabled":true,"interval":300,"paused":false},"recent":["Atlas","Beacon","Comet"]}',
    },
    { id: 'f-5', name: 'worker.log', content: log },
    { id: 'f-6', name: 'desert.png', src: samplePhoto(1400, 900, 40), size: 401_550 },
    { id: 'f-7', name: 'quarterly-report.pdf', type: 'application/pdf', size: 2_340_112 },
  ]
}
